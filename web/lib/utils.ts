import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(totalSeconds % 60, 0)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function calculateAge(dateOfBirth?: string) {
  if (!dateOfBirth) {
    return undefined;
  }

  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasNotBirthdayYet =
    today.getMonth() < dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());

  if (hasNotBirthdayYet) {
    age -= 1;
  }

  return age;
}

export function percent(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / max) * 100));
}

export function isToday(value: string) {
  const current = new Date();
  const target = new Date(value);
  return current.toDateString() === target.toDateString();
}
