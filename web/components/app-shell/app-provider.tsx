"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import confetti from "canvas-confetti";
import type { User } from "@supabase/supabase-js";

import {
  BATTLE_DURATION_SECONDS,
  DAILY_LOCK_BONUS,
  SUPABASE_URL,
  buildInitialState,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { registerServiceWorker, type DeferredInstallPrompt } from "@/lib/pwa";
import { loadAppState, saveAppState } from "@/lib/storage";
import type {
  AppState,
  BattleStepId,
  ChatMessage,
  DbProgress,
  Notification,
  NotificationVariant,
  PricingPlanId,
  TriggerOption,
  UrgeRecord,
} from "@/lib/types";
import { calculateAge, generateId } from "@/lib/utils";

type OsaRequestOptions = {
  prompt: string;
  trigger?: string;
  emotion?: string;
};

type CompleteDayResult = {
  success?: boolean;
  alreadyDone?: boolean;
  balance: number;
  tokensEarned?: number;
  streak: number;
  controlLevel: number;
  levelName: string;
  guardianLevel: number;
  message: string;
};

type AppContextValue = {
  // Auth
  user: User | null;
  hydrated: boolean;
  signOut: () => Promise<void>;

  // State
  state: AppState;
  notifications: Notification[];

  // Onboarding
  completeOnboarding: (data: {
    name: string;
    trigger: TriggerOption;
    dob?: string;
  }) => Promise<void>;

  // Mission
  toggleMissionItem: (section: "morning" | "night", itemId: string) => void;
  completeFocusBlock: () => void;

  // Day lock
  lockToday: () => Promise<void>;
  closeWinModal: () => void;

  // Battle
  startBattle: (trigger: string, emotion: string) => void;
  toggleBattleStep: (stepId: BattleStepId) => void;
  tickBattle: () => void;
  finishBattle: (resisted: boolean) => Promise<void>;

  // Osa AI
  sendOsaMessage: (options: OsaRequestOptions) => Promise<string>;

  // Tokens
  refreshTokens: () => Promise<void>;

  // Utilities
  launchConfetti: () => void;
  notify: (message: string, variant?: NotificationVariant) => void;
  dismissNotification: (id: string) => void;

  // PWA
  installReady: boolean;
  isOnline: boolean;
  requestInstall: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}

function hasUnlimitedAccess(unlimitedUntil?: string) {
  if (!unlimitedUntil) return false;
  return new Date(unlimitedUntil) > new Date();
}

export function AppProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<AppState>(buildInitialState);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [installReady, setInstallReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const deferredPromptRef = useRef<DeferredInstallPrompt | null>(null);
  const battleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── PWA & Service Worker ──────────────────────────────────────────────────
  useEffect(() => {
    registerServiceWorker();
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPromptRef.current = event as unknown as DeferredInstallPrompt;
      setInstallReady(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  // ─── Auth + Initial Data Load ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function init() {
      // Load local state first (instant, offline-capable)
      const localState = loadAppState();

      // Get auth session
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;

      if (mounted) {
        setUser(currentUser);

        if (currentUser) {
          // Merge local state with server data
          const serverState = await fetchServerState(currentUser.id, session?.access_token);
          setState({ ...localState, ...serverState });
        } else {
          setState(localState);
        }

        setHydrated(true);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;

        if (!mounted) return;
        setUser(currentUser);

        if (event === "SIGNED_IN" && currentUser) {
          const serverState = await fetchServerState(currentUser.id, session?.access_token);
          setState((prev) => ({ ...prev, ...serverState }));
        }

        if (event === "SIGNED_OUT") {
          setState(buildInitialState());
        }
      }
    );

    // Realtime: listen for token balance changes
    const tokenChannel = supabase
      .channel("tokens-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tokens" },
        (payload) => {
          if (!mounted) return;
          const newBalance = (payload.new as { balance: number }).balance;
          setState((prev) => ({
            ...prev,
            profile: { ...prev.profile, tokens: newBalance },
          }));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      supabase.removeChannel(tokenChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Persist local state to localStorage ───────────────────────────────────
  useEffect(() => {
    if (hydrated) {
      saveAppState(state);
    }
  }, [hydrated, state]);

  // ─── Battle Timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.battle.active) {
      battleTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (!prev.battle.active) return prev;
          if (prev.battle.secondsLeft <= 1) {
            clearInterval(battleTimerRef.current!);
            return {
              ...prev,
              battle: { ...prev.battle, active: false, secondsLeft: 0 },
            };
          }
          return {
            ...prev,
            battle: { ...prev.battle, secondsLeft: prev.battle.secondsLeft - 1 },
          };
        });
      }, 1000);
    } else if (battleTimerRef.current) {
      clearInterval(battleTimerRef.current);
    }

    return () => {
      if (battleTimerRef.current) clearInterval(battleTimerRef.current);
    };
  }, [state.battle.active]);

  // ─── Fetch server state (tokens, progress, profile) ─────────────────────────
  async function fetchServerState(
    userId: string,
    accessToken?: string
  ): Promise<Partial<AppState>> {
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type Row = Record<string, any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const today = new Date().toISOString().split("T")[0];

      const [
        { data: dbUser },
        { data: progress },
        { data: tokens },
        { data: todayLog },
        { data: urges },
        { data: lockedDays },
      ] = (await Promise.all([
        db.from("users").select("*").eq("id", userId).single(),
        db.from("user_progress").select("*").eq("user_id", userId).single(),
        db.from("tokens").select("balance").eq("user_id", userId).single(),
        db.from("daily_logs").select("*").eq("user_id", userId).eq("date", today).single(),
        db.from("urges").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        db.from("daily_logs").select("date").eq("user_id", userId).eq("day_locked", true).order("date", { ascending: false }).limit(100),
      ])) as [
        { data: Row | null },
        { data: Row | null },
        { data: Row | null },
        { data: Row | null },
        { data: Row[] | null },
        { data: Row[] | null },
      ];

      const tokenBalance = (tokens?.balance as number) ?? 50;
      const name = (dbUser?.full_name ?? dbUser?.code_name ?? "Prince") as string;
      const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

      const urgeHistory: UrgeRecord[] = (urges ?? []).map((u: Row) => ({
        id: u.id as string,
        trigger: u.trigger_type as string,
        emotion: (u.emotion ?? "Unknown") as string,
        resisted: u.resisted as boolean,
        note: u.note ?? undefined,
        learned: u.learned ?? undefined,
        createdAt: u.created_at as string,
      }));

      const completedDays = (lockedDays ?? []).map((d: Row) => d.date as string);

      return {
        onboardingComplete: (dbUser?.onboarding_complete ?? false) as boolean,
        dayLocked: (todayLog?.day_locked ?? false) as boolean,
        controlLevel: (progress?.control_level ?? 0) as number,
        streak: {
          current: (progress?.current_streak ?? 0) as number,
          longest: (progress?.longest_streak ?? 0) as number,
        },
        profile: {
          userId,
          name,
          initials,
          tokens: tokenBalance,
          level: (progress?.sand_guardian_level ?? 1) as number,
          levelName: (progress?.level_name ?? "Sand Cadet") as string,
          primaryTrigger: (dbUser?.biggest_trigger as TriggerOption) ?? undefined,
          dob: (dbUser?.dob as string) ?? undefined,
          age: dbUser?.dob ? calculateAge(dbUser.dob as string) : undefined,
        },
        urgeHistory,
        completedDays,
        winsToday: {
          urgesResisted: urgeHistory.filter((u) => u.resisted && u.createdAt.startsWith(today)).length,
          routinesDone: todayLog
            ? ([todayLog.morning_done, todayLog.focus_done, todayLog.night_done] as boolean[]).filter(Boolean).length
            : 0,
        },
      };
    } catch (err) {
      console.error("fetchServerState error:", err);
      return {};
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────
  const notify = useCallback(
    (message: string, variant: NotificationVariant = "info") => {
      const id = generateId("notif");
      setNotifications((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 4500);
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const launchConfetti = useCallback(() => {
    void confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#d4a017", "#f6d775", "#00c853", "#ffffff"],
    });
  }, []);

  const requestInstall = useCallback(async () => {
    if (!deferredPromptRef.current) return;
    await deferredPromptRef.current.prompt();
    deferredPromptRef.current = null;
    setInstallReady(false);
  }, []);

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState(buildInitialState());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Onboarding ─────────────────────────────────────────────────────────────
  const completeOnboarding = useCallback(
    async (data: { name: string; trigger: TriggerOption; dob?: string }) => {
      if (!user) return;

      const initials = data.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      // Save to Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("users")
        .update({
          full_name: data.name,
          biggest_trigger: data.trigger,
          dob: data.dob ?? null,
          onboarding_complete: true,
        })
        .eq("id", user.id);

      setState((prev) => ({
        ...prev,
        onboardingComplete: true,
        profile: {
          ...prev.profile,
          name: data.name,
          initials,
          primaryTrigger: data.trigger,
          dob: data.dob,
          age: data.dob ? calculateAge(data.dob) : undefined,
        },
        chat: [
          {
            id: generateId("chat"),
            role: "assistant",
            content: `Welcome, ${data.name.split(" ")[0]}. Your first day starts now. You've got this. 🏆`,
            createdAt: new Date().toISOString(),
            tokenCost: 0,
          },
        ],
      }));

      launchConfetti();
      notify("50 free tokens waiting. Osa is ready.", "success");
    },
    [user, launchConfetti, notify, supabase]
  );

  // ─── Mission ─────────────────────────────────────────────────────────────────
  const toggleMissionItem = useCallback(
    (section: "morning" | "night", itemId: string) => {
      setState((prev) => {
        const updated = {
          ...prev.mission[section],
          items: prev.mission[section].items.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          ),
        };

        return {
          ...prev,
          mission: { ...prev.mission, [section]: updated },
        };
      });
    },
    []
  );

  const completeFocusBlock = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mission: {
        ...prev.mission,
        focus: {
          ...prev.mission.focus,
          completed: prev.mission.focus.completed + 1,
        },
      },
      winsToday: {
        ...prev.winsToday,
        routinesDone: prev.winsToday.routinesDone + 1,
      },
    }));
    notify("Focus block complete. Legend move! 💼", "success");
  }, [notify]);

  // ─── Day Lock ────────────────────────────────────────────────────────────────
  const lockToday = useCallback(async () => {
    if (state.dayLocked) {
      notify("You already locked today. You held body! 🔥", "info");
      return;
    }

    if (!user) {
      notify("Sign in to save your progress.", "warning");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/complete-day`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      const result = (await response.json()) as CompleteDayResult;

      if (result.alreadyDone) {
        setState((prev) => ({ ...prev, dayLocked: true }));
        notify(result.message, "info");
        return;
      }

      if (!response.ok || !result.success) {
        notify("Could not lock today. Try again.", "warning");
        return;
      }

      setState((prev) => ({
        ...prev,
        dayLocked: true,
        showWinModal: true,
        profile: { ...prev.profile, tokens: result.balance },
        streak: {
          current: result.streak,
          longest: Math.max(prev.streak.longest, result.streak),
        },
        controlLevel: result.controlLevel,
        completedDays: [
          new Date().toISOString().split("T")[0],
          ...prev.completedDays,
        ],
      }));

      launchConfetti();
      notify(result.message, "success");
    } catch {
      notify("You dey offline. Progress saved locally.", "warning");
      setState((prev) => ({ ...prev, dayLocked: true }));
    }
  }, [state.dayLocked, user, supabase, launchConfetti, notify]);

  const closeWinModal = useCallback(() => {
    setState((prev) => ({ ...prev, showWinModal: false }));
  }, []);

  // ─── Battle ──────────────────────────────────────────────────────────────────
  const startBattle = useCallback((trigger: string, emotion: string) => {
    setState((prev) => ({
      ...prev,
      battle: {
        active: true,
        trigger,
        emotion,
        secondsLeft: BATTLE_DURATION_SECONDS,
        completedSteps: [],
      },
    }));
  }, []);

  const toggleBattleStep = useCallback((stepId: BattleStepId) => {
    setState((prev) => {
      const already = prev.battle.completedSteps.includes(stepId);
      return {
        ...prev,
        battle: {
          ...prev.battle,
          completedSteps: already
            ? prev.battle.completedSteps.filter((s) => s !== stepId)
            : [...prev.battle.completedSteps, stepId],
        },
      };
    });
  }, []);

  const tickBattle = useCallback(() => {
    setState((prev) => {
      if (!prev.battle.active || prev.battle.secondsLeft <= 0) return prev;
      return {
        ...prev,
        battle: { ...prev.battle, secondsLeft: prev.battle.secondsLeft - 1 },
      };
    });
  }, []);

  const finishBattle = useCallback(
    async (resisted: boolean) => {
      const { trigger, emotion } = state.battle;

      setState((prev) => {
        const newRecord: UrgeRecord = {
          id: generateId("urge"),
          trigger,
          emotion,
          resisted,
          createdAt: new Date().toISOString(),
        };

        return {
          ...prev,
          battle: {
            ...prev.battle,
            active: false,
            secondsLeft: BATTLE_DURATION_SECONDS,
            completedSteps: [],
          },
          urgeHistory: [newRecord, ...prev.urgeHistory],
          winsToday: resisted
            ? {
                ...prev.winsToday,
                urgesResisted: prev.winsToday.urgesResisted + 1,
              }
            : prev.winsToday,
        };
      });

      if (resisted) {
        launchConfetti();
        notify("You held body! That was the hard part. 🔥", "success");
      } else {
        notify("No shame. You logged it honestly. Now reset.", "info");
      }

      // Persist to Supabase (fire-and-forget, offline safe)
      if (user) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const db2 = supabase as any;
          await db2.from("urges").insert({
            user_id: user.id,
            trigger_type: trigger,
            emotion,
            resisted,
          });

          if (resisted) {
            await db2.from("user_progress")
              .update({ total_urges_resisted: state.urgeHistory.filter((u) => u.resisted).length + 1 })
              .eq("user_id", user.id);
          }
        } catch {
          // Offline — will sync next time
        }
      }
    },
    [state.battle, state.urgeHistory, user, supabase, launchConfetti, notify]
  );

  // ─── Osa AI Chat (via Edge Function) ────────────────────────────────────────
  const sendOsaMessage = useCallback(
    async ({ prompt, trigger, emotion }: OsaRequestOptions): Promise<string> => {
      if (!prompt.trim()) return "";

      const hasUnlimited = hasUnlimitedAccess(state.profile.unlimitedUntil);

      if (!hasUnlimited && state.profile.tokens <= 0) {
        notify("You're out of tokens. Top up to keep talking to Osa.", "warning");
        return "You dey short on tokens. Go top up — I go still be here.";
      }

      // Add user message immediately (optimistic)
      const userMsg: ChatMessage = {
        id: generateId("chat"),
        role: "user",
        content: prompt,
        createdAt: new Date().toISOString(),
        tokenCost: 0,
      };

      setState((prev) => ({ ...prev, chat: [...prev.chat, userMsg] }));

      // Fallback for offline
      if (!isOnline) {
        const fallback = "You dey strong. Stay with it — Osa go here when you reconnect.";
        const offlineMsg: ChatMessage = {
          id: generateId("chat"),
          role: "assistant",
          content: fallback,
          createdAt: new Date().toISOString(),
          tokenCost: 0,
        };
        setState((prev) => ({ ...prev, chat: [...prev.chat, offlineMsg] }));
        return fallback;
      }

      if (!user) {
        const loginMsg = "Sign in to talk to Osa.";
        notify(loginMsg, "warning");
        return loginMsg;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/send-osa-message`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              message: prompt,
              trigger: trigger ?? state.battle.trigger ?? state.profile.primaryTrigger,
              emotion: emotion ?? state.battle.emotion,
              history: state.chat.slice(-6).map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          }
        );

        if (response.status === 402) {
          notify("You're out of tokens. Top up to keep talking to Osa.", "warning");
          return "You dey short on tokens. Go top up — I go still be here.";
        }

        if (!response.ok) throw new Error("Edge function error");

        const data = (await response.json()) as { reply: string; balance: number };

        const osaMsg: ChatMessage = {
          id: generateId("chat"),
          role: "assistant",
          content: data.reply,
          createdAt: new Date().toISOString(),
          tokenCost: 1,
        };

        setState((prev) => ({
          ...prev,
          chat: [...prev.chat, osaMsg],
          profile: {
            ...prev.profile,
            tokens: hasUnlimited ? prev.profile.tokens : data.balance,
          },
        }));

        return data.reply;
      } catch {
        const fallback = "I dey here. Network dey give us trouble — try again.";
        const errMsg: ChatMessage = {
          id: generateId("chat"),
          role: "assistant",
          content: fallback,
          createdAt: new Date().toISOString(),
          tokenCost: 0,
        };
        setState((prev) => ({ ...prev, chat: [...prev.chat, errMsg] }));
        return fallback;
      }
    },
    [state.profile, state.battle, state.chat, user, isOnline, supabase, notify]
  );

  // ─── Refresh tokens from DB ──────────────────────────────────────────────────
  const refreshTokens = useCallback(async () => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("tokens")
      .select("balance")
      .eq("user_id", user.id)
      .single() as { data: { balance: number } | null };
    if (data) {
      setState((prev) => ({
        ...prev,
        profile: { ...prev.profile, tokens: data.balance },
      }));
    }
  }, [user, supabase]);

  const value: AppContextValue = {
    user,
    hydrated,
    signOut,
    state,
    notifications,
    completeOnboarding,
    toggleMissionItem,
    completeFocusBlock,
    lockToday,
    closeWinModal,
    startBattle,
    toggleBattleStep,
    tickBattle,
    finishBattle,
    sendOsaMessage,
    refreshTokens,
    launchConfetti,
    notify,
    dismissNotification,
    installReady,
    isOnline,
    requestInstall,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
