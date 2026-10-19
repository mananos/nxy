/// <reference types="vite/client" />
import "./ascua.css";

export type Act =
  | "idle" | "wave" | "dance" | "mate" | "look" | "stretch" | "yawn" | "meditate"
  | "sleep" | "code" | "read" | "think" | "juggle" | "alert" | "warn" | "ask" | "cheer";

type Mouth = "smile" | "open" | "o" | "yawn" | "sleep" | "warn" | "flat";

export const MOUTH: Record<Act, Mouth> = {
  idle: "smile",
  wave: "open",
  dance: "open",
  mate: "o",
  look: "smile",
  stretch: "o",
  yawn: "yawn",
  meditate: "smile",
  sleep: "sleep",
  code: "flat",
  read: "smile",
  think: "o",
  juggle: "open",
  alert: "open",
  warn: "warn",
  ask: "o",
  cheer: "open",
};

export const TONE: Partial<Record<Act, string>> = { sleep: "sleep", alert: "alert", warn: "warn", ask: "ask", cheer: "happy" };

const star = (x: number, y: number, r: number): string => {
  const k = r * 0.28;
  return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`;
};

// A wavy hem: same commands in both frames so SMIL can morph between them.
const hem = (x0: number, x1: number, n: number, y: number, up: number, down: number): string => {
  const w = (x1 - x0) / n;
  let d = "";
  for (let i = 0; i < n; i++) d += `Q${x1 - w * (i + 0.5)} ${i % 2 ? up : down} ${x1 - w * (i + 1)} ${y}`;
  return d;
};
const morph = (cls: string, a: string, b: string, dur: string, fill = ""): string =>
  `<path class="${cls}" d="${a}" ${fill}><animate attributeName="d" dur="${dur}" repeatCount="indefinite" values="${a};${b};${a}"/></path>`;

const SHEET_A = `M30 62C30 38 44 26 60 26C76 26 90 38 90 62L90 94${hem(30, 90, 6, 94, 88, 100)}Z`;
const SHEET_B = `M30 62C30 38 44 26 60 26C76 26 90 38 90 62L90 94${hem(30, 90, 6, 94, 100, 88)}Z`;
const sheet = (cls: string, fill: string): string => morph(cls, SHEET_A, SHEET_B, "1.6s", fill);
const ARMS = (id: string): string =>
  `<g class="arm arml"><ellipse cx="28" cy="68" rx="5" ry="8" fill="url(#${id}-b)"/></g><g class="arm armr"><ellipse cx="92" cy="68" rx="5" ry="8" fill="url(#${id}-b)"/></g>`;

// Blank lens: a shine sweeps across; a glow rect pulses with the state.
const shine = (id: string, clip: string): string =>
  `<clipPath id="${id}-vc">${clip}</clipPath><g clip-path="url(#${id}-vc)"><rect class="shine" x="44" y="36" width="5" height="34" transform="rotate(25 46 53)"/></g>`;
const BAND = (id: string): string =>
  `<rect class="visor" x="37" y="45" width="46" height="19" rx="6"/><rect class="visor-glow glowfill" x="37" y="45" width="46" height="19" rx="6" opacity="0"/>` +
  shine(id, `<rect x="37" y="45" width="46" height="19" rx="6"/>`);

const HEADSET =
  `<path class="hband" d="M27 54C25 14 95 14 93 54"/>` +
  `<rect class="cup" x="20" y="45" width="11" height="19" rx="5"/><rect class="cup" x="89" y="45" width="11" height="19" rx="5"/>` +
  `<rect class="cupled" x="22.5" y="51" width="2" height="7" rx="1"/><rect class="cupled" x="95.5" y="51" width="2" height="7" rx="1"/>` +
  `<path class="boom" d="M28 62Q34 76 48 74"/><circle class="cup" cx="49" cy="74" r="2.6"/>`;

const MOUTHS =
  `<path class="mouth m-smile ink-s" d="M-4 8 q4 4 8 0"/>` +
  `<path class="mouth m-open ink" d="M-4.5 7.5 q4.5 8 9 0 z"/>` +
  `<ellipse class="mouth m-o ink" cx="0" cy="10" rx="2.4" ry="3"/>` +
  `<ellipse class="mouth m-yawn ink" cx="0" cy="11" rx="3.6" ry="5"/>` +
  `<path class="mouth m-sleep ink-s" d="M-2.5 10 h5"/>` +
  `<path class="mouth m-warn ink-s" d="M-6 11 l3 -2.4 l3 2.4 l3 -2.4 l3 2.4"/>` +
  `<path class="mouth m-flat ink-s" d="M-4 10 h8"/>`;

const PROPS =
  `<g class="prop p-code"><rect class="screen" x="44" y="72" width="32" height="18" rx="2"/><rect class="laptop" x="40" y="89" width="40" height="4" rx="1.5"/></g>` +
  `<g class="prop p-read"><path class="page" d="M44 74l16 4v12l-16 -4z"/><path class="page" d="M76 74l-16 4v12l16 -4z"/><path class="spine" d="M60 78v12"/></g>` +
  `<g class="prop p-mate"><path class="bombilla" d="M63 70L81 77"/><ellipse class="gourd" cx="84" cy="84" rx="7" ry="8"/><ellipse class="yerba" cx="84" cy="77" rx="5.5" ry="1.8"/><g class="steam"><path d="M86 72q-2 -4 0 -8"/><path d="M91 73q2 -4 0 -8"/></g></g>` +
  `<g class="prop p-juggle">${[0, 1, 2].map(() => `<g class="mini"><path class="minig" transform="translate(60 55)" d="M-5 2C-5 -4 -2.5 -6 0 -6C2.5 -6 5 -4 5 2L5 6L2.5 4.5L0 6L-2.5 4.5L-5 6Z"/></g>`).join("")}</g>`;

const FX =
  `<g class="prop p-bang"><text class="glowfill bang" x="94" y="32">!</text></g>` +
  `<g class="prop p-q"><text class="glowfill q" x="92" y="32">?</text></g>` +
  `<g class="prop p-z"><text class="glowfill z" x="84" y="30">z</text><text class="glowfill z" x="92" y="22">z</text></g>` +
  `<g class="prop p-spark"><path class="glowfill spark" d="${star(22, 30, 6)}"/><path class="glowfill spark" d="${star(98, 34, 5)}"/><path class="glowfill spark" d="${star(90, 12, 4)}"/></g>` +
  `<g class="prop p-notes riser"><text class="glowfill" x="20" y="44">♪</text><text class="glowfill" x="94" y="36">♫</text><text class="glowfill" x="28" y="22">♪</text></g>` +
  `<g class="prop p-glyphs riser glyphs"><text class="glowfill" x="22" y="44">{}</text><text class="glowfill" x="88" y="38">&lt;/&gt;</text><text class="glowfill" x="92" y="18">01</text></g>` +
  `<g class="prop p-think"><circle class="glowfill" cx="86" cy="26" r="2.4"/><circle class="glowfill" cx="93" cy="18" r="3.2"/><circle class="glowfill" cx="101" cy="9" r="4"/></g>`;

export const ghost = (id: string): string =>
  `<svg class="ch v-blank" viewBox="0 0 120 120" aria-label="Ascua">` +
  `<defs><linearGradient id="${id}-b" gradientUnits="userSpaceOnUse" x1="0" y1="24" x2="0" y2="104"><stop offset="0" class="c1" stop-opacity="1"/><stop offset="0.45" class="c2" stop-opacity="1"/><stop offset="0.95" class="c2" stop-opacity="0"/></linearGradient>` +
  `<radialGradient id="${id}-glow"><stop offset="0" class="gl" stop-opacity="0.45"/><stop offset="1" class="gl" stop-opacity="0"/></radialGradient></defs>` +
  `<ellipse class="aura" cx="60" cy="58" rx="44" ry="46" fill="url(#${id}-glow)"/>` +
  `<ellipse class="shadow" cx="60" cy="110" rx="20" ry="3.5"/>` +
  `<g class="float"><g class="squash"><g class="ghost-body">${sheet("body", `fill="url(#${id}-b)"`)}${ARMS(id)}${HEADSET}` +
  `<g class="look">${BAND(id)}<g transform="translate(60 61) scale(0.9)">${MOUTHS}</g></g></g>${PROPS}` +
  `<g class="prop p-glitch"><path class="tint tint-l" fill="#f43f5e" d="${SHEET_A}"/><path class="tint tint-r" fill="#22d3ee" d="${SHEET_A}"/></g>` +
  `</g></g>${FX}</svg>`;

export function setAct(el: HTMLElement, act: Act): void {
  el.dataset.act = act;
  el.dataset.tone = TONE[act] ?? "idle";
  el.dataset.mouth = MOUTH[act];
}

export interface Ascua {
  element: HTMLElement;
  act: Act;
  play(act: Act): void;
  pause(on: boolean): void;
}

export function mountAscua(host: HTMLElement, id: string): Ascua {
  host.innerHTML = `<div class="ascua"><div class="flip">${ghost(id)}</div></div>`;
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
