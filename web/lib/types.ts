import type { User } from "@supabase/supabase-js";
export type { User };

// ─────────────────────────────────────────────
// Supabase Database types
// ─────────────────────────────────────────────
export type Database = {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: Omit<DbUser, "created_at"> & { created_at?: string };
        Update: Partial<Omit<DbUser, "id">>;
        Relationships: [];
      };
      user_progress: {
        Row: DbProgress;
        Insert: Omit<DbProgress, "id" | "updated_at"> & { id?: string; updated_at?: string };
        Update: Partial<Omit<DbProgress, "id" | "user_id">>;
        Relationships: [];
      };
      tokens: {
        Row: DbToken;
        Insert: Omit<DbToken, "id"> & { id?: string };
        Update: Partial<Omit<DbToken, "id" | "user_id">>;
        Relationships: [];
      };
      urges: {
        Row: DbUrge;
        Insert: Omit<DbUrge, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<DbUrge, "id" | "user_id">>;
        Relationships: [];
      };
      daily_logs: {
        Row: DbDailyLog;
        Insert: Omit<DbDailyLog, "id"> & { id?: string };
        Update: Partial<Omit<DbDailyLog, "id" | "user_id">>;
        Relationships: [];
      };
      token_transactions: {
        Row: DbTokenTransaction;
        Insert: Omit<DbTokenTransaction, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Omit<DbTokenTransaction, "id" | "user_id">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      recalculate_level: {
        Args: { p_user_id: string };
        Returns: void;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type DbUser = {
  id: string;
  email: string;
  full_name: string | null;
  code_name: string | null;
  dob: string | null;
  gender: string | null;
  location: string | null;
  biggest_trigger: string | null;
  onboarding_complete: boolean;
  user_plan: "free" | "premium";
  created_at: string;
};

export type DbProgress = {
  id: string;
  user_id: string;
  control_level: number;
  current_streak: number;
  longest_streak: number;
  total_urges_resisted: number;
  total_days_locked: number;
  sand_guardian_level: number;
  level_name: string;
  updated_at: string;
};

export type DbToken = {
  id: string;
  user_id: string;
  balance: number;
  last_updated: string;
};

export type DbUrge = {
  id: string;
  user_id: string;
  trigger_type: string;
  emotion: string | null;
  note: string | null;
  resisted: boolean;
  learned: string | null;
  created_at: string;
};

export type DbDailyLog = {
  id: string;
  user_id: string;
  date: string;
  morning_done: boolean;
  focus_done: boolean;
  night_done: boolean;
  routines_completed: number;
  day_locked: boolean;
  locked_at: string | null;
};

export type DbTokenTransaction = {
  id: string;
  user_id: string;
  type: "earn" | "spend" | "purchase" | "signup_bonus";
  amount: number;
  description: string | null;
  paystack_reference: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
};

// ─────────────────────────────────────────────
// App State types
// ─────────────────────────────────────────────
export type TriggerOption =
  | "Porn / Sexual urges"
  | "Social media / Phone"
  | "Laziness / Procrastination"
  | "Anger / Emotions"
  | "Others";

export type NotificationVariant = "success" | "warning" | "info";

export type ChatRole = "assistant" | "user";

export type MissionKey = "morning" | "focus" | "night";

export type MissionChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

export type MissionSection = {
  title: string;
  subtitle: string;
  items: MissionChecklistItem[];
};

export type FocusBlocks = {
  completed: number;
  goal: number;
};

export type MissionState = {
  morning: MissionSection;
  focus: FocusBlocks;
  night: MissionSection;
};

export type UrgeRecord = {
  id: string;
  trigger: string;
  emotion: string;
  resisted: boolean;
  createdAt: string;
  note?: string;
  learned?: string;
};

export type BattleStepId = "stand" | "walk" | "water" | "breathe" | "remember";

export type BattleState = {
  active: boolean;
  recordId?: string;
  trigger: string;
  emotion: string;
  secondsLeft: number;
  completedSteps: BattleStepId[];
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  tokenCost?: number;
};

export type PricingPlanId = "starter" | "popular" | "champion";

export type ProfileState = {
  name: string;
  userId: string;
  initials: string;
  primaryTrigger?: TriggerOption;
  dob?: string;
  age?: number;
  tokens: number;
  level: number;
  levelName: string;
  unlimitedUntil?: string;
};

export type WinsState = {
  urgesResisted: number;
  routinesDone: number;
};

export type Notification = {
  id: string;
  message: string;
  variant: NotificationVariant;
};

export type AppState = {
  onboardingComplete: boolean;
  dayLocked: boolean;
  showWinModal: boolean;
  controlLevel: number;
  streak: {
    current: number;
    longest: number;
  };
  profile: ProfileState;
  winsToday: WinsState;
  mission: MissionState;
  urgeHistory: UrgeRecord[];
  battle: BattleState;
  chat: ChatMessage[];
  completedDays: string[];
  analysisSummary: string;
};
