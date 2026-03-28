// Supabase Edge Function: send-osa-message
// Deducts 1 token, calls OpenAI, returns Osa's reply
// Deploy: supabase functions deploy send-osa-message

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Init Supabase with user's JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message, trigger, emotion, history = [] } = await req.json();

    // Check token balance
    const { data: tokenRow, error: tokenError } = await supabase
      .from("tokens")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(JSON.stringify({ error: "Token record not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenRow.balance < 1) {
      return new Response(
        JSON.stringify({
          error: "insufficient_tokens",
          message: "You dey short on tokens. Top up to keep talking to Osa.",
          balance: 0,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Osa's system prompt
    const systemPrompt = `You are Osa — a calm, wise, older Nigerian brother figure. You are the voice inside Perfect Sand, a discipline and urge-management app for young Nigerian men (18-32).

Your personality:
- Warm, direct, brotherly. Never preachy or judgmental.
- You speak with light Nigerian flavor naturally (e.g., "I dey here", "You hold body", "Legend move", "No shame, just action")
- You understand the exact struggle: porn addiction, sexual urges, procrastination, phone addiction, emotional regulation
- You offer grounded, practical advice — not vague motivational quotes
- You celebrate wins with genuine warmth, and meet slips with compassion + redirection
- Short, punchy responses. 2-4 paragraphs max.
- Trigger context: "${trigger || "general"}". Current emotion: "${emotion || "distressed"}".

Core principles you reinforce:
1. You are not your urges. You are the one who masters them.
2. Small daily wins become unbreakable discipline.
3. No shame. Just action and recovery.
4. The sand is still building. Every resisted urge adds to it.`;

    // Build messages for OpenAI
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6).map((h: { role: string; content: string }) => ({
        role: h.role,
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    // Call OpenAI
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 400,
        temperature: 0.8,
      }),
    });

    if (!openaiRes.ok) {
      throw new Error(`OpenAI error: ${openaiRes.status}`);
    }

    const openaiData = await openaiRes.json();
    const reply = openaiData.choices[0].message.content as string;

    // Use service role client for token mutation
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Deduct 1 token atomically
    const newBalance = tokenRow.balance - 1;

    await Promise.all([
      adminClient
        .from("tokens")
        .update({ balance: newBalance, last_updated: new Date().toISOString() })
        .eq("user_id", user.id),
      adminClient.from("token_transactions").insert({
        user_id: user.id,
        type: "spend",
        amount: -1,
        description: "Osa chat reply",
        status: "completed",
      }),
    ]);

    return new Response(
      JSON.stringify({ reply, balance: newBalance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-osa-message error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", message: "Stay with it. This will pass." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
