"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Gem, Loader2, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import Link from "next/link";

import { useAppState } from "@/components/app-shell/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { pricingPlans } from "@/lib/constants";
import type { PricingPlanId } from "@/lib/types";

// Paystack inline script type
declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata: { user_id: string; plan_id: string };
        onClose: () => void;
        callback: (response: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
  }
}

const planIcons: Record<PricingPlanId, typeof WalletCards> = {
  starter: WalletCards,
  popular: BadgeCheck,
  champion: Gem,
};

export function PricingView() {
  const { state, user, refreshTokens, notify } = useAppState();
  const [loadingPlan, setLoadingPlan] = useState<PricingPlanId | null>(null);
  const paystackLoaded = useRef(false);

  // Load Paystack inline script once
  useEffect(() => {
    if (paystackLoaded.current) return;
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => { paystackLoaded.current = true; };
    document.head.appendChild(script);
  }, []);

  function generateRef() {
    return `ps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function handleBuy(planId: PricingPlanId) {
    if (!user?.email) {
      notify("Sign in to buy tokens.", "warning");
      return;
    }

    const plan = pricingPlans.find((p) => p.id === planId);
    if (!plan) return;

    if (!window.PaystackPop) {
      notify("Paystack is loading. Try again in a moment.", "info");
      return;
    }

    setLoadingPlan(planId);

    const handler = window.PaystackPop.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email: user.email,
      amount: plan.amountKobo,
      currency: "NGN",
      ref: generateRef(),
      metadata: {
        user_id: user.id,
        plan_id: planId,
      },
      onClose: () => {
        setLoadingPlan(null);
      },
      callback: async (response) => {
        setLoadingPlan(null);
        // Webhook handles token credit. Refresh balance after short delay.
        notify(`Payment received! ${plan.tokens} tokens incoming… 🪙`, "success");
        setTimeout(() => {
          void refreshTokens();
        }, 3000);
        // Log reference for support
        console.log("Paystack ref:", response.reference);
      },
    });

    handler.openIframe();
  }

  return (
    <div className="space-y-6">
      {/* Balance header */}
      <Card className="border-sand-500/16 bg-linear-to-br from-[#17141b] via-[#10161e] to-[#101a22]">
        <CardContent className="space-y-4 px-5 py-6">
          <Badge variant="default">Fair pricing</Badge>
          <h2 className="text-3xl font-semibold text-white">Keep the Fire Burning</h2>
          <p className="text-sm text-ink-100/72">
            Clear support. No guilt tricks. Just options that make sense.
          </p>
          <div className="rounded-[26px] border border-sand-500/18 bg-sand-500/10 p-5">
            <p className="text-sm text-sand-100/80">Current Balance</p>
            <p className="mt-2 text-4xl font-semibold text-white">
              🪙 {state.profile.tokens} tokens
            </p>
            <p className="mt-2 text-sm text-ink-100/55">
              Each Osa reply costs 1 token. Day complete gives +5 free.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid gap-4">
        {pricingPlans.map((plan) => {
          const Icon = planIcons[plan.id];
          const isLoading = loadingPlan === plan.id;

          return (
            <Card
              key={plan.id}
              className={`overflow-hidden transition ${
                plan.popular
                  ? "border-sand-500/28 bg-linear-to-br from-[#1b1820] to-[#121824] shadow-[0_0_30px_rgba(212,160,23,0.08)]"
                  : "border-white/8 bg-white/4"
              }`}
            >
              {plan.popular && (
                <div className="flex items-center gap-1.5 bg-sand-500/15 px-5 py-2 text-xs font-medium text-sand-300">
                  <Sparkles className="size-3" />
                  Best value for serious warriors
                </div>
              )}
              <CardContent className="space-y-4 px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-sand-300/76">
                      {plan.popular ? "Most Popular" : "Package"}
                    </p>
                    <h3 className="mt-1.5 text-2xl font-semibold text-white">{plan.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-100/72">{plan.tagline}</p>
                  </div>
                  <div className="rounded-full bg-white/7 p-3 text-sand-300">
                    <Icon className="size-5" />
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold text-white">{plan.price}</span>
                  <span className="mb-1 text-sm text-ink-100/55">· {plan.tokens} tokens</span>
                </div>

                <Button
                  size="lg"
                  variant={plan.popular ? "default" : "secondary"}
                  className="w-full"
                  disabled={!!loadingPlan}
                  onClick={() => void handleBuy(plan.id)}
                >
                  {isLoading ? (
                    <><Loader2 className="size-4 animate-spin" />Opening payment…</>
                  ) : (
                    `Buy ${plan.title} — ${plan.price}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trust badges */}
      <Card className="border-white/8 bg-white/4">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">🔒 Secured by Paystack</Badge>
            <Badge variant="muted">Flutterwave</Badge>
            <Badge variant="muted">OPay</Badge>
          </div>
          <div className="flex items-center gap-3 rounded-[20px] border border-[#00c853]/18 bg-[#00c853]/8 p-4">
            <ShieldCheck className="size-5 shrink-0 text-[#00c853]" />
            <p className="text-sm text-white">
              Join 2,847 Nigerians building discipline with Perfect Sand
            </p>
          </div>
          <p className="text-xs text-ink-100/45">
            Tokens are non-refundable. Contact support for issues:{" "}
            <Link href="mailto:support@voiceofosa.com" className="underline hover:text-ink-100/70">
              support@voiceofosa.com
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
