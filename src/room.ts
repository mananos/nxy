import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Ascua } from "./ascua";
import { draggable } from "./drag";
import { applyLayout, type Layout } from "./layout";

type State = "ghost" | "expanding" | "open" | "collapsing";

export interface Room {
  expand(): Promise<void>;
  collapse(): Promise<void>;
  isOpen(): boolean;
}

interface Expanded {
  originX: number;
  originY: number;
}

const GLYPH_MAX = "□";
const GLYPH_RESTORE = "❐";

const GHOST = 120;
const MS = 420;
const FADE_MS = 120;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function mountRoom(el: HTMLElement, ghostHost: HTMLElement, ascua: Ascua): Room {
  const bar = el.querySelector<HTMLElement>("#room-bar")!;
  const close = el.querySelector<HTMLButtonElement>("#room-close")!;
  const maxBtn = el.querySelector<HTMLButtonElement>("#room-max")!;
  const win = getCurrentWindow();
  let state: State = "ghost";
  let expanding: Promise<void> = Promise.resolve();

  let origin = { x: 0, y: 0 };
  let openSize = { w: 0, h: 0 };

  function setMax(max: boolean) {
    if (max) document.body.dataset.max = "1";
    else delete document.body.dataset.max;
    maxBtn.setAttribute("aria-label", max ? "Restore" : "Maximize");
    maxBtn.textContent = max ? GLYPH_RESTORE : GLYPH_MAX;
  }

  async function syncMax() {
    if (state !== "open") return;
    try {
      setMax(await win.isMaximized());
    } catch {
      // keep the state tracked from the button
    }
  }
  win.onResized(syncMax).catch(() => {});

  // Grow (forward) or shrink (reverse) the panel out of / into the ghost's spot.
  async function animate(forward: boolean) {
    const duration = reduced.matches ? 0 : MS;
    const cx = origin.x + GHOST / 2;
    const cy = origin.y + GHOST / 2;
    el.style.transformOrigin = `${cx}px ${cy}px`;
    ghostHost.style.cssText = `left:${origin.x}px;top:${origin.y}px;right:auto;bottom:auto`;
    const options: KeyframeAnimationOptions = {
      duration,
      easing: EASE,
      fill: "both",
      direction: forward ? "normal" : "reverse",
    };
    const panel = el.animate(
      [
        { transform: `scale(${GHOST / el.offsetWidth}, ${GHOST / el.offsetHeight})`, opacity: 0.5 },
        { transform: "none", opacity: 1 },
      ],
      options,
    );
    const ghost = ghostHost.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: `translate(${el.offsetWidth / 2 - cx}px, ${el.offsetHeight / 2 - cy}px) scale(1.8)`, opacity: 0 },
      ],
      options,
    );
    await Promise.all([panel.finished, ghost.finished]);
    return () => {
      panel.cancel();
      ghost.cancel();
    };
  }

  async function expand() {
    if (state !== "ghost") return;
    state = "expanding";
    expanding = (async () => {
      let ok = false;
      try {
        const r = await invoke<Expanded>("expand");
        origin = { x: r.originX, y: r.originY };
        el.hidden = false;
        const cleanup = await animate(true);
        ascua.pause(true);
        document.body.dataset.room = "open";
        cleanup();
        openSize = { w: el.offsetWidth, h: el.offsetHeight };
        syncMax();
        ok = true;
      } catch {
        // fall through to the cleanup below
      } finally {
        if (ok) {
          state = "open";
        } else {
          el.hidden = true;
          delete document.body.dataset.room;
          ascua.pause(false);
          state = "ghost";
          try {
            applyLayout(await invoke<Layout>("collapse"));
            ghostHost.style.cssText = "";
          } catch {
            // the window stays as it is; the state is already back to ghost
          }
        }
      }
    })();
    await expanding;
  }

  let collapsing: Promise<void> | undefined;

  function collapse(): Promise<void> {
    if (collapsing) return collapsing;
    collapsing = (async () => {
      if (state === "expanding") await expanding;
      if (state !== "open") return;
      state = "collapsing";
      let cleanup = () => {};
      try {
        document.body.dataset.room = "closing";
        if (!reduced.matches) await sleep(FADE_MS);
        ascua.pause(false);
        // The shrink targets the ghost's original spot; once the window was
        // resized or maximized that spot is stale, so the fade alone has to do.
        const stale =
          document.body.dataset.max === "1" ||
          el.offsetWidth !== openSize.w ||
          el.offsetHeight !== openSize.h;
        const running = stale ? undefined : animate(false);
        delete document.body.dataset.room;
        if (running) cleanup = await running;
        el.hidden = true;
        applyLayout(await invoke<Layout>("collapse"));
      } finally {
        el.hidden = true;
        delete document.body.dataset.room;
        ascua.pause(false);
        ghostHost.style.cssText = "";
        cleanup();
        setMax(false);
        state = "ghost";
        collapsing = undefined;
      }
    })();
    return collapsing;
  }

  const wasDragged = draggable(bar);
  bar.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    wasDragged();
    collapse();
  });
  close.addEventListener("click", () => collapse());
  maxBtn.addEventListener("click", async () => {
    try {
      setMax(await invoke<boolean>("toggle_maximize"));
    } catch {
      // leave the state as it was
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state === "open") collapse();
  });

  return { expand, collapse, isOpen: () => state !== "ghost" };
}
