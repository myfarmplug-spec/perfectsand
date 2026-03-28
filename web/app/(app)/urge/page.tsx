"use client";

import { useAppState } from "@/components/app-shell/app-provider";
import { BattleArenaView } from "@/components/urge/battle-arena-view";
import { UrgeCheckInView } from "@/components/urge/urge-check-in-view";

export default function UrgePage() {
  const { state, startBattle } = useAppState();

  if (state.battle.active) {
    return <BattleArenaView />;
  }

  return (
    <UrgeCheckInView
      onStart={(trigger, emotion) => startBattle(trigger, emotion)}
    />
  );
}
