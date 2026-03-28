"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Shield } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setPending(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setPending(false);
      return;
    }

    // Trigger row created via DB trigger (handle_new_user)
    // Redirect to onboarding
    router.replace("/onboarding");
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 px-4">
      {/* Logo */}
      <div className="space-y-2 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-sand-500/24 bg-sand-500/12">
          <Shield className="size-7 text-sand-300" />
        </div>
        <p className="text-xs uppercase tracking-[0.28em] text-sand-300/80">
          Perfect Sand
        </p>
        <h1 className="text-2xl font-semibold text-white">Start your journey</h1>
        <p className="text-sm text-ink-100/68">
          50 free tokens. No credit card. Just discipline.
        </p>
      </div>

      {/* Form */}
      <Card className="border-white/8 bg-white/4">
        <CardContent className="space-y-4 px-5 py-6">
          {error && (
            <div className="rounded-[16px] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-100/65">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full rounded-[18px] border border-white/10 bg-[#111826] px-4 py-3 text-base text-white outline-none placeholder:text-ink-100/35 transition focus:border-sand-500/40 focus:ring-1 focus:ring-sand-500/20"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-100/65">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8+ characters"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-[18px] border border-white/10 bg-[#111826] px-4 py-3 pr-12 text-base text-white outline-none placeholder:text-ink-100/35 transition focus:border-sand-500/40 focus:ring-1 focus:ring-sand-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-100/45 hover:text-ink-100/75"
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Token preview badge */}
            <div className="flex items-center gap-2 rounded-[16px] border border-sand-500/18 bg-sand-500/8 px-4 py-3">
              <span className="text-lg">🪙</span>
              <div>
                <p className="text-sm font-semibold text-sand-100">50 free tokens on signup</p>
                <p className="text-xs text-sand-300/72">
                  All non-AI features unlimited & free forever
                </p>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending || !email || !password}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create Account — Let's Go"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-ink-100/55">
        Already building?{" "}
        <Link
          href="/login"
          className="font-medium text-sand-300 hover:text-sand-100 transition"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
