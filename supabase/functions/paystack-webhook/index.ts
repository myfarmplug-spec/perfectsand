// Supabase Edge Function: paystack-webhook
// Verifies Paystack signature, credits tokens on successful payment
// Deploy: supabase functions deploy paystack-webhook
// Set in Paystack dashboard: https://<project>.supabase.co/functions/v1/paystack-webhook

import { createClient } from "jsr:@supabase/supabase-js@2";
import { hmac } from "jsr:@noble/hashes@1/hmac";
import { sha512 } from "jsr:@noble/hashes@1/sha2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

// Token packages (must match pricing-view.tsx)
const TOKEN_PACKAGES: Record<string, number> = {
  starter: 50,
  popular: 150,
  champion: 400,
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY")!;

    // Verify HMAC-SHA512 signature
    const encoder = new TextEncoder();
    const mac = hmac(sha512, encoder.encode(secretKey), encoder.encode(body));
    const expectedSig = bytesToHex(mac);

    if (expectedSig !== signature) {
      console.error("Paystack signature mismatch");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);

    // Only process successful charge events
    if (event.event !== "charge.success") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference, metadata, amount, status } = event.data;

    if (status !== "success") {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = metadata?.user_id;
    const planId = metadata?.plan_id;

    if (!userId || !planId) {
      console.error("Missing user_id or plan_id in metadata");
      return new Response(JSON.stringify({ error: "Missing metadata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokensToAdd = TOKEN_PACKAGES[planId];
    if (!tokensToAdd) {
      console.error(`Unknown plan_id: ${planId}`);
      return new Response(JSON.stringify({ error: "Unknown plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency: check if reference already processed
    const { data: existing } = await adminClient
      .from("token_transactions")
      .select("id")
      .eq("paystack_reference", reference)
      .single();

    if (existing) {
      console.log(`Reference ${reference} already processed`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current balance
    const { data: tokenRow } = await adminClient
      .from("tokens")
      .select("balance")
      .eq("user_id", userId)
      .single();

    const currentBalance = tokenRow?.balance ?? 0;
    const newBalance = currentBalance + tokensToAdd;

    // Credit tokens + log transaction
    await Promise.all([
      adminClient
        .from("tokens")
        .update({ balance: newBalance, last_updated: new Date().toISOString() })
        .eq("user_id", userId),

      adminClient.from("token_transactions").insert({
        user_id: userId,
        type: "purchase",
        amount: tokensToAdd,
        description: `Purchased ${tokensToAdd} tokens (${planId} plan)`,
        paystack_reference: reference,
        status: "completed",
      }),
    ]);

    console.log(`Credited ${tokensToAdd} tokens to user ${userId} — balance now ${newBalance}`);

    return new Response(
      JSON.stringify({ received: true, credited: tokensToAdd, newBalance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("paystack-webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
