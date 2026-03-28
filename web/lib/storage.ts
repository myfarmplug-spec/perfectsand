import type { AppState } from "@/lib/types";
import { STORAGE_KEY, buildInitialState } from "@/lib/constants";

export function loadAppState() {
  if (typeof window === "undefined") {
    return buildInitialState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return buildInitialState();
    }

    const parsed = JSON.parse(raw) as AppState;
    return {
      ...buildInitialState(),
      ...parsed,
      profile: {
        ...buildInitialState().profile,
        ...parsed.profile,
      },
      mission: {
        ...buildInitialState().mission,
        ...parsed.mission,
      },
      streak: {
        ...buildInitialState().streak,
        ...parsed.streak,
      },
      winsToday: {
        ...buildInitialState().winsToday,
        ...parsed.winsToday,
      },
      battle: {
        ...buildInitialState().battle,
        ...parsed.battle,
      },
    };
  } catch {
    return buildInitialState();
  }
}

export function saveAppState(state: AppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetAppState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
