// Ascua character art. Copyright (c) 2026 mananos. All rights reserved.
// Not covered by the Apache-2.0 license of this repository; see NOTICE.
import "./wisp.css";

const star = (x: number, y: number, r: number): string => {
  const k = r * 0.28;
  return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`;
};

// Body: a will-o'-the-wisp, half ghost and half ember: a round belly, a tall tip and a small lick
// on the side, both swaying.
// Both frames use the same commands so SMIL can morph between them.
const BODY = "M60 98C42 98 31 86 31 72C31 61 35 53 41 46C44 42 45 37 43 30C50 33 54 39 54 46C56 38 58 30 64 22C66 19 67 15 66 11C74 20 81 32 85 43C89 52 89 62 89 72C89 86 78 98 60 98Z";
const BODY_B = "M60 98C42 98 31 86 31 72C31 61 35 53 41 46C45 42 47 36 46 29C51 33 54 39 54 46C55 38 56 30 60 23C61 20 61 16 59 12C70 20 81 32 85 43C89 52 89 62 89 72C89 86 78 98 60 98Z";
const sway = (cls: string, paint = ""): string =>
  `<path class="${cls}" d="${BODY}" ${paint}><animate attributeName="d" dur="2.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" values="${BODY};${BODY_B};${BODY}"/></path>`;

// Inside: heat rising from the bottom, an inner flame that flickers behind the face, and a soft sheen.
const CORE =
  `<path class="inner" d="M60 94C49 94 42 87 42 78C42 69 49 62 54 55C57 50 59 44 61 34C66 45 72 54 76 62C79 68 79 73 78 78C77 87 71 94 60 94Z"/>` +
  `<path class="sheen" d="M38 70C38 61 41 55 45 50"/>`;

// Sparks leave the tip and go out.
// Sparks are tiny diamonds that leave the tips, drift and go out.
const spark = (x: number, y: number, r: number): string => `<path class="ember" d="M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z"/>`;
const EMBERS = spark(66, 8, 1.8) + spark(62, 6, 1.3) + spark(43, 26, 1.2);

const ARMS =
  `<g class="arm arml"><rect class="limb" x="24" y="68" width="8" height="12" rx="4"/></g>` +
  `<g class="arm armr"><rect class="limb" x="88" y="68" width="8" height="12" rx="4"/></g>`;

// Face: two pills and a faint blush; joy, sleep and alarm reshape the eyes. A mouth only when it says something.
const EYES =
  `<g class="eye e-open"><rect class="blink" x="46" y="56" width="7" height="12" rx="3.5"/><rect class="blink" x="67" y="56" width="7" height="12" rx="3.5"/></g>` +
  `<g class="eye e-wide"><rect x="45" y="54" width="9" height="15" rx="4.5"/><rect x="66" y="54" width="9" height="15" rx="4.5"/></g>` +
  `<g class="eye e-closed"><rect x="45" y="62" width="9" height="3" rx="1.5"/><rect x="66" y="62" width="9" height="3" rx="1.5"/></g>` +
  `<g class="eye e-happy"><path class="line" d="M45.5 64l4 -5l4 5M66.5 64l4 -5l4 5"/></g>` +
  `<g class="eye e-squint"><path class="line" d="M46 57l7 4.5l-7 4.5M74 57l-7 4.5l7 4.5"/></g>`;

const MOUTHS =
  `<rect class="mouth m-open" x="56.5" y="73" width="7" height="4.5" rx="2.25"/>` +
  `<rect class="mouth m-o" x="58" y="73" width="4" height="4" rx="2"/>` +
  `<rect class="mouth m-yawn" x="57.5" y="72" width="5" height="7" rx="2.5"/>`;

const MINI = "M0 7C-4 7 -6 4 -6 1C-6 -3 -3 -4 -1 -8C1 -5 6 -3 6 1C6 4 4 7 0 7Z";
const PROPS =
  `<g class="prop p-code"><rect class="screen" x="44" y="76" width="32" height="16" rx="2"/><rect class="laptop" x="40" y="91" width="40" height="4" rx="1.5"/></g>` +
  `<g class="prop p-read"><path class="page" d="M44 78l16 4v12l-16 -4z"/><path class="page" d="M76 78l-16 4v12l16 -4z"/><path class="spine" d="M60 82v12"/></g>` +
  `<g class="prop p-mate"><path class="bombilla" d="M62 76L81 80"/><ellipse class="gourd" cx="84" cy="87" rx="7" ry="8"/><ellipse class="yerba" cx="84" cy="80" rx="5.5" ry="1.8"/><g class="steam"><path d="M86 75q-2 -4 0 -8"/><path d="M91 76q2 -4 0 -8"/></g></g>` +
  `<g class="prop p-juggle">${[0, 1, 2].map(() => `<g class="mini"><path class="limb" transform="translate(60 60)" d="${MINI}"/></g>`).join("")}</g>`;

const FX =
  `<g class="prop p-bang"><text class="glowfill bang" x="94" y="36">!</text></g>` +
  `<g class="prop p-q"><text class="glowfill q" x="92" y="36">?</text></g>` +
  `<g class="prop p-z"><text class="glowfill z" x="84" y="34">z</text><text class="glowfill z" x="92" y="26">z</text></g>` +
  `<g class="prop p-spark"><path class="glowfill spark" d="${star(22, 38, 6)}"/><path class="glowfill spark" d="${star(98, 42, 5)}"/><path class="glowfill spark" d="${star(92, 20, 4)}"/></g>` +
  `<g class="prop p-notes riser"><text class="glowfill" x="18" y="52">♪</text><text class="glowfill" x="94" y="44">♫</text><text class="glowfill" x="24" y="30">♪</text></g>` +
  `<g class="prop p-glyphs riser glyphs"><text class="glowfill" x="18" y="52">{}</text><text class="glowfill" x="88" y="46">&lt;/&gt;</text><text class="glowfill" x="92" y="26">01</text></g>` +
  `<g class="prop p-think"><circle class="glowfill" cx="86" cy="32" r="2.4"/><circle class="glowfill" cx="93" cy="24" r="3.2"/><circle class="glowfill" cx="101" cy="15" r="4"/></g>`;

export const wisp =(id: string): string =>
  `<svg class="ch" viewBox="0 0 120 120" aria-label="Ascua">` +
  `<defs><radialGradient id="${id}-heat" gradientUnits="userSpaceOnUse" cx="60" cy="98" r="44"><stop offset="0" class="c2" stop-opacity="0.55"/><stop offset="1" class="c2" stop-opacity="0"/></radialGradient>` +
  `<linearGradient id="${id}-rim" gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="0" y2="98"><stop offset="0" class="gl" stop-opacity="1"/><stop offset="1" class="gl" stop-opacity="0.35"/></linearGradient></defs>` +
  `<g class="float"><g class="squash"><g class="wisp-body">${ARMS}${sway("halo")}${sway("body")}${sway("heat", `fill="url(#${id}-heat)"`)}${CORE}${sway("rim", `stroke="url(#${id}-rim)"`)}` +
  `<g class="look face"><ellipse class="cheek" cx="42.5" cy="72" rx="3.6" ry="2"/><ellipse class="cheek" cx="77.5" cy="72" rx="3.6" ry="2"/>${EYES}${MOUTHS}</g></g>${PROPS}` +
  `<g class="prop p-glitch"><path class="tint tint-l" fill="#f43f5e" d="${BODY}"/><path class="tint tint-r" fill="#22d3ee" d="${BODY}"/></g>` +
  `</g><g>${EMBERS}</g></g>${FX}</svg>`;
