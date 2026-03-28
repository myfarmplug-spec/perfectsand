// Supabase Edge Function: complete-day
// Verifies day not already locked, awards +5 tokens, updates streak/progress
// Deploy: supabase functions deploy complete-day

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Check if already locked today
    const { data: existingLog } = await supabase
      .from("daily_logs")
      .select("id, day_locked")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (existingLog?.day_locked) {
      // Already completed — return current state without awarding again
      const { data: tokens } = await supabase
        .from("tokens")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      return new Response(
        JSON.stringify({
          alreadyDone: true,
          message: "You already locked today. You held body! 🔥",
          balance: tokens?.balance ?? 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use admin client for all mutations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert daily log as locked
    await adminClient.from("daily_logs").upsert({
      user_id: user.id,
      date: today,
      day_locked: true,
      locked_at: new Date().toISOString(),
    });

    // Fetch current token balance and progress
    const [{ data: tokenRow }, { data: progress }] = await Promise.all([
      adminClient.from("tokens").select("balance").eq("user_id", user.id).single(),
      adminClient.from("user_progress").select("*").eq("user_id", user.id).single(),
    ]);

    const currentBalance = tokenRow?.balance ?? 0;
    const newBalance = currentBalance + 5;

    // Calculate new streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data: yesterdayLog } = await adminClient
      .from("daily_logs")
      .select("day_locked")
      .eq("user_id", user.id)
      .eq("date", yesterdayStr)
      .single();

    const currentStreak = progress?.current_streak ?? 0;
    const newStreak = yesterdayLog?.day_locked ? currentStreak + 1 : 1;
    const longestStreak = Math.max(progress?.longest_streak ?? 0, newStreak);
    const totalDaysLocked = (progress?.total_days_locked ?? 0) + 1;

    // Run all mutations in parallel
    await Promise.all([
      // Update tokens
      adminClient
        .from("tokens")
        .update({ balance: newBalance, last_updated: new Date().toISOString() })
        .eq("user_id", user.id),

      // Log transaction
      adminClient.from("token_transactions").insert({
        user_id: user.id,
        type: "earn",
        amount: 5,
        description: "Day Complete — you held body today 🔥",
        status: "completed",
      }),

      // Update progress
      adminClient
        .from("user_progress")
        .update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          total_days_locked: totalDaysLocked,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id),
    ]);

    // Recalculate level (call the DB function)
    await adminClient.rpc("recalculate_level", { p_user_id: user.id });

    // Fetch updated progress for response
    const { data: updatedProgress } = await adminClient
      .from("user_progress")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        balance: newBalance,
        tokensEarned: 5,
        streak: newStreak,
        longestStreak,
        controlLevel: updatedProgress?.control_level ?? 0,
        levelName: updatedProgress?.level_name ?? "Sand Cadet",
        guardianLevel: updatedProgress?.sand_guardian_level ?? 1,
        message: `+5 tokens earned. You held body today! 🔥 Streak: ${newStreak} days.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("complete-day error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
