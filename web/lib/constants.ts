import { Flame, MoonStar, Smartphone, Sunrise, Target, TriangleAlert } from "lucide-react";

import type {
  AppState,
  BattleStepId,
  MissionKey,
  PricingPlanId,
  TriggerOption,
} from "@/lib/types";
import { generateId } from "@/lib/utils";

export const STORAGE_KEY = "perfect-sand-next-state";
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
export const INITIAL_TOKENS = 50;
export const DAILY_LOCK_BONUS = 5;
export const CONTROL_LEVEL_GOAL = 100;
export const BATTLE_DURATION_SECONDS = 600;
export const DAILY_LOGIN_BONUS = 3;

export const triggerOptions: Array<{
  label: TriggerOption;
  description: string;
  icon: typeof Smartphone;
}> = [
  {
    label: "Porn / Sexual urges",
    description: "You want clean control when the pressure comes.",
    icon: TriangleAlert,
  },
  {
    label: "Social media / Phone",
    description: "Cut the scroll before it cuts your focus.",
    icon: Smartphone,
  },
  {
    label: "Laziness / Procrastination",
    description: "Build movement when your body wants to stall.",
    icon: Target,
  },
  {
    label: "Anger / Emotions",
    description: "Stay grounded when your mood starts dragging you.",
    icon: Flame,
  },
  {
    label: "Others",
    description: "Keep it private. Osa still gets the point.",
    icon: MoonStar,
  },
];

export const motivationalTruths = [
  "The urge will peak and fade. You don’t have to act.",
  "Discipline is choosing what you want most over what you want now.",
  "You are not your urges. You are the one who masters them.",
];

export const missionIcons: Record<MissionKey, typeof Sunrise> = {
  morning: Sunrise,
  focus: Target,
  night: MoonStar,
};

export const battleSteps: Array<{
  id: BattleStepId;
  title: string;
  detail: string;
}> = [
  {
    id: "stand",
    title: "Stand up immediately. Move your body.",
    detail: "Break the position. Reset the moment before it grows.",
  },
  {
    id: "walk",
    title: "Walk to another room or step outside.",
    detail: "Change the scene. Give your body a new signal.",
  },
  {
    id: "water",
    title: "Splash cold water on face, wrists, neck.",
    detail: "Let the body cool down so your mind can catch up.",
  },
  {
    id: "breathe",
    title: "Breathe with me.",
    detail: "In for 4. Hold for 7. Out for 8.",
  },
  {
    id: "remember",
    title: "Remember: This feeling will pass.",
    detail: "You dey control. The wave is not the boss here.",
  },
];

export const suggestedPrompts = [
  "Urge is very strong right now",
  "Help me with my morning routine",
  "Why do I keep slipping at night?",
];

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const pricingPlans: Array<{
  id: PricingPlanId;
  title: string;
  price: string;
  amountKobo: number;
  tagline: string;
  tokens: number;
  popular?: boolean;
}> = [
  {
    id: "starter",
    title: "Starter Pack",
    price: "₦700",
    amountKobo: 70000,
    tagline: "50 tokens — about 2–3 weeks of Osa support",
    tokens: 50,
  },
  {
    id: "popular",
    title: "Power Pack",
    price: "₦2,000",
    amountKobo: 200000,
    tagline: "150 tokens — best value for serious warriors",
    tokens: 150,
    popular: true,
  },
  {
    id: "champion",
    title: "Champion Pack",
    price: "₦5,000",
    amountKobo: 500000,
    tagline: "400 tokens — unlimited Osa access for months",
    tokens: 400,
  },
];

export function buildInitialState(): AppState {
  const now = new Date();
  const urgeCreatedAt = new Date(now.getTime() - 1000 * 60 * 90).toISOString();
  const completedDays = Array.from({ length: 84 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    if (index % 5 === 0 || index % 7 === 0) {
      return null;
    }

    return date.toISOString();
  }).filter(Boolean) as string[];

  return {
    onboardingComplete: false,
    dayLocked: false,
    showWinModal: false,
    controlLevel: 68,
    streak: {
      current: 12,
      longest: 27,
    },
    profile: {
      name: "Prince",
      userId: "local-prince",
      initials: "PO",
      primaryTrigger: "Porn / Sexual urges" as TriggerOption,
      tokens: 0,
      level: 3,
      levelName: "Sand Guardian",
    },
    winsToday: {
      urgesResisted: 3,
      routinesDone: 2,
    },
    mission: {
      morning: {
        title: "Morning Routine 🌅",
        subtitle: "Start calm before the noise begins.",
        items: [
          {
            id: "morning-phone",
            label: "No phone first 10 minutes",
            completed: true,
          },
          {
            id: "morning-water",
            label: "Cold water on face",
            completed: true,
          },
          {
            id: "morning-silence",
            label: "5 min silence + one intention",
            completed: false,
          },
        ],
      },
      focus: {
        completed: 1,
        goal: 2,
      },
      night: {
        title: "Night Shutdown 🌙",
        subtitle: "Close the day without giving the night too much room.",
        items: [
          {
            id: "night-review",
            label: "Review day",
            completed: false,
          },
          {
            id: "night-screens",
            label: "No screens after 10pm",
            completed: false,
          },
          {
            id: "night-sleep",
            label: "Sleep before 12",
            completed: false,
          },
        ],
      },
    },
    urgeHistory: [
      {
        id: generateId("urge"),
        trigger: "Late night scrolling",
        emotion: "Restless",
        resisted: true,
        createdAt: urgeCreatedAt,
        learned: "Cold water worked",
      },
      {
        id: generateId("urge"),
        trigger: "Alone in room",
        emotion: "Tempted",
        resisted: true,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 18).toISOString(),
        learned: "Stepping outside broke the wave",
      },
      {
        id: generateId("urge"),
        trigger: "After Instagram reels",
        emotion: "Foggy",
        resisted: false,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 44).toISOString(),
        note: "Recorded honestly. Tomorrow is another chance. You are not your urges.",
      },
    ],
    battle: {
      active: false,
      trigger: "Late night scrolling",
      emotion: "Tempted",
      secondsLeft: BATTLE_DURATION_SECONDS,
      completedSteps: [],
    },
    chat: [
      {
        id: generateId("chat"),
        role: "assistant",
        content: "I dey here, Prince. Wetin dey happen? Talk to me.",
        createdAt: new Date().toISOString(),
      },
    ],
    completedDays,
    analysisSummary:
      "You resist better in mornings. Evenings need extra protocols.",
  };
}
