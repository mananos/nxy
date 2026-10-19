import type { Act, Ascua } from "./ascua";

export type Need = "alert" | "warn" | "ask";

export interface Life {
  need(act: Need): void;
  celebrate(): void;
  release(): void;
  poke(): void;
}

// Ascua's life when nobody needs it: stays where the user put it, does small
// things in place, naps when bored. need() plays an alert/warn/ask act right
// away, celebrate() cheers then releases, release() returns to its life,
// poke() waves or wakes it.
const BORED_AFTER = 50_000; // ms of quiet before it yawns and sleeps

const LIFE: Act[] = ["idle", "dance", "mate", "look", "stretch", "meditate", "wave"];
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function live(ascua: Ascua): Life {
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let quietSince = Date.now();

  const later = (ms: number, fn: () => void) => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  const doSomething = () => {
    ascua.play(pick(LIFE));
    later(rand(4500, 8000), life);
  };
  function life() {
    if (busy) return;
    if (Date.now() - quietSince > BORED_AFTER) {
      ascua.play("yawn");
      later(3200, () => ascua.play("sleep"));
      return;
    }
    doSomething();
  }

  ascua.play("idle");
  later(1500, life);

  function release() {
    busy = false;
    quietSince = Date.now();
    ascua.play("idle");
    later(1500, life);
  }

  return {
    need(act) {
      quietSince = Date.now();
      clearTimeout(timer);
      busy = true;
      ascua.play(act);
    },
    celebrate() {
      ascua.play("cheer");
      later(1800, release);
    },
    release,
    poke() {
      quietSince = Date.now();
      if (busy) return;
      const asleep = ascua.act === "sleep";
      ascua.play(asleep ? "stretch" : "wave");
      later(asleep ? 3000 : 2200, life);
    },
  };
}
