/// <reference types="vite/client" />
import "./ascua.css";
import { wisp } from "./character/wisp";

export type Act =
  | "idle" | "wave" | "dance" | "mate" | "look" | "stretch" | "yawn" | "meditate"
  | "sleep" | "code" | "read" | "think" | "juggle" | "alert" | "warn" | "ask" | "cheer";

type Mouth = "none" | "open" | "o" | "yawn";
type Eyes = "happy" | "open" | "wide" | "closed" | "squint";

export const MOUTH: Record<Act, Mouth> = {
  idle: "none",
  wave: "open",
  dance: "open",
  mate: "o",
  look: "none",
  stretch: "o",
  yawn: "yawn",
  meditate: "none",
  sleep: "none",
  code: "none",
  read: "none",
  think: "o",
  juggle: "open",
  alert: "open",
  warn: "none",
  ask: "o",
  cheer: "open",
};

const EYES: Record<Act, Eyes> = {
  idle: "open",
  wave: "happy",
  dance: "happy",
  mate: "closed",
  look: "open",
  stretch: "closed",
  yawn: "closed",
  meditate: "closed",
  sleep: "closed",
  code: "open",
  read: "open",
  think: "open",
  juggle: "happy",
  alert: "wide",
  warn: "squint",
  ask: "open",
  cheer: "happy",
};

const TONE: Partial<Record<Act, string>> = { sleep: "sleep", alert: "alert", warn: "warn", ask: "ask", cheer: "happy" };

function setAct(el: HTMLElement, act: Act): void {
  el.dataset.act = act;
  el.dataset.tone = TONE[act] ?? "idle";
  el.dataset.mouth = MOUTH[act];
  el.dataset.eyes = EYES[act];
}

export interface Ascua {
  element: HTMLElement;
  act: Act;
  play(act: Act): void;
  pause(on: boolean): void;
}

export function mountAscua(host: HTMLElement, id: string): Ascua {
  host.innerHTML = `<div class="ascua"><div class="flip">${wisp(id)}</div></div>`;
  const element = host.querySelector<HTMLElement>(".ascua")!;
  const svg = element.querySelector<SVGSVGElement>("svg")!;
  let held = false;
  let asleep = false;
  let sleepTimer: ReturnType<typeof setTimeout> | undefined;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync = () => {
    const paused = held || document.hidden || asleep || reduced.matches;
    element.classList.toggle("paused", paused);
    if (paused) svg.pauseAnimations();
    else svg.unpauseAnimations();
  };
  const ascua: Ascua = {
    element,
    act: "idle",
    play(act) {
      ascua.act = act;
      setAct(element, act);
      clearTimeout(sleepTimer);
      asleep = false;
      if (act === "sleep") sleepTimer = setTimeout(() => { asleep = true; sync(); }, 1200);
      sync();
    },
    pause(on) {
      held = on;
      sync();
    },
  };
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  ascua.play("idle");
  return ascua;
}
