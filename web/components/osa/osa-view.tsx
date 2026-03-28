"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, MessageCircle, SendHorizontal } from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { suggestedPrompts } from "@/lib/constants";

export function OsaView() {
  const { state, sendOsaMessage, isOnline } = useAppState();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.chat]);

  async function handleSend(prompt: string) {
    const text = prompt.trim();
    if (!text || pending) return;
    setInput("");
    setPending(true);
    await sendOsaMessage({ prompt: text });
    setPending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(input);
    }
  }

  const tokenLow = state.profile.tokens <= 5 && state.profile.tokens > 0;
  const tokenEmpty = state.profile.tokens === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header card */}
      <Card className="border-white/8 bg-linear-to-br from-[#151c28] to-[#111622]">
        <CardContent className="px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-14 border border-sand-500/20">
                <AvatarFallback className="bg-sand-500/12 text-sand-300 font-semibold">
                  OSA
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold text-white">Talking with Osa</p>
                <p className="text-sm text-ink-100/65">
                  Your calm older brother on standby.
                </p>
              </div>
            </div>
            <Badge
              variant="default"
              className={
                tokenEmpty
                  ? "border-red-500/30 bg-red-500/15 text-red-300"
                  : tokenLow
                  ? "border-orange-500/30 bg-orange-500/12 text-orange-300"
                  : ""
              }
            >
              🪙 {state.profile.tokens} tokens
            </Badge>
          </div>

          {!isOnline && (
            <div className="mt-3 rounded-[14px] border border-orange-500/20 bg-orange-500/8 px-4 py-2.5 text-sm text-orange-300">
              You dey offline. Osa go respond when network returns.
            </div>
          )}

          {tokenEmpty && (
            <div className="mt-3 rounded-[14px] border border-red-500/20 bg-red-500/8 px-4 py-2.5">
              <p className="text-sm text-red-300">
                Out of tokens. Lock today&apos;s mission for +5 free tokens 🔒
              </p>
            </div>
          )}

          {tokenLow && !tokenEmpty && (
            <div className="mt-3 rounded-[14px] border border-orange-500/20 bg-orange-500/8 px-4 py-2.5 text-sm text-orange-300">
              Only {state.profile.tokens} tokens left. Choose wisely.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat messages */}
      <Card className="border-white/8 bg-white/4">
        <CardContent className="flex flex-col gap-3 px-4 py-4">
          <AnimatePresence initial={false}>
            {state.chat.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-relaxed ${
                    message.role === "assistant"
                      ? "bg-[#121827] text-white"
                      : "bg-sand-500 text-ink-900"
                  }`}
                >
                  {message.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {pending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 rounded-[22px] bg-[#121827] px-4 py-3">
                <LoaderCircle className="size-4 animate-spin text-sand-300" />
                <span className="text-sm text-ink-100/60">Osa is thinking…</span>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </CardContent>
      </Card>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-2">
        {suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={pending || tokenEmpty}
            onClick={() => void handleSend(prompt)}
            className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-ink-100/80 transition hover:bg-white/8 disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <Card className="border-white/8 bg-white/4">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                disabled={tokenEmpty}
                placeholder={
                  tokenEmpty
                    ? "Top up tokens to continue talking to Osa…"
                    : "Type your message… (Enter to send)"
                }
                className="min-h-28 w-full resize-none rounded-[20px] border border-white/8 bg-[#121827] px-4 py-3 text-base text-white outline-none placeholder:text-ink-100/35 transition focus:border-sand-500/32 disabled:opacity-40"
              />
              <MessageCircle className="pointer-events-none absolute bottom-4 right-4 size-4 text-ink-100/30" />
            </div>
            <Button
              size="icon"
              className="mb-0.5 shrink-0"
              onClick={() => void handleSend(input)}
              disabled={pending || !input.trim() || tokenEmpty}
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-ink-100/55">
            Each Osa reply costs 1 token. Choose wisely.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
