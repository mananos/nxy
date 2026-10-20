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

interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Staged {
  ghostX: number;
  ghostY: number;
  stageW: number;
  stageH: number;
  room: Insets;
}

// Compact ghost window size; must match perch.rs and tauri.conf.json.
const COMPACT = { w: 420, h: 320 };

const GLYPH_MAX = "□";
const GLYPH_RESTORE = "❐";

const GHOST = 120;
const spd = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spd")) || 1;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function mountRoom(el: HTMLElement, ghostHost: HTMLElement, ascua: Ascua): Room {
  const bar = el.querySelector<HTMLElement>("#room-bar")!;
  const close = el.querySelector<HTMLButtonElement>("#room-close")!;
  const maxBtn = el.querySelector<HTMLButtonElement>("#room-max")!;
  const win = getCurrentWindow();
  let state: State = "ghost";
  let expanding: Promise<void> = Promise.resolve();

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

  // Park the ghost at (x, y) and point the room's closed clip at that spot.
  function place(x: number, y: number, stageW: number, stageH: number) {
    const s = document.body.style;
    s.setProperty("--gl", `${x}px`);
    s.setProperty("--gt", `${y}px`);
    s.setProperty("--gr", `${stageW - x - GHOST}px`);
    s.setProperty("--gb", `${stageH - y - GHOST}px`);
    ghostHost.style.cssText = `left:${x}px;top:${y}px;right:auto;bottom:auto`;
  }

  function setRoom(r: Insets | null) {
    const s = document.body.style;
    const vars: [string, keyof Insets][] = [
      ["--rl", "left"],
      ["--rt", "top"],
      ["--rr", "right"],
      ["--rb", "bottom"],
    ];
    for (const [v, k] of vars) {
      if (r) s.setProperty(v, `${r[k]}px`);
      else s.removeProperty(v);
    }
  }

  // Run fn with transitions off, committing its style changes before they come back on.
  function snap(fn: () => void) {
    document.body.dataset.snap = "1";
    try {
      fn();
      void el.offsetWidth;
    } finally {
      delete document.body.dataset.snap;
    }
  }

  // Run apply synchronously in the first resize event that reaches w x h (so the first
  // frame painted at that size is already right), right away if already there, or on timeout.
  // The returned promise has a cancel(): disarms without applying (use when the window
  // change it was waiting for failed).
  function onViewport(
    w: number,
    h: number,
    apply: () => void,
    timeoutMs = 300,
  ): Promise<void> & { cancel: () => void } {
    const match = () =>
      Math.abs(window.innerWidth - w) <= 1 && Math.abs(window.innerHeight - h) <= 1;
    let cancel = () => {};
    let promise: Promise<void>;
    if (match()) {
      apply();
      promise = Promise.resolve();
    } else {
      promise = new Promise<void>((resolve) => {
        let timer = 0;
        const disarm = () => {
          window.removeEventListener("resize", onResize);
          clearTimeout(timer);
        };
        const done = () => {
          disarm();
          try {
            apply();
          } finally {
            resolve();
          }
        };
        const onResize = () => {
          if (match()) done();
        };
        cancel = () => {
          disarm();
          resolve();
        };
        window.addEventListener("resize", onResize);
        timer = window.setTimeout(done, timeoutMs);
      });
    }
    return Object.assign(promise, { cancel: () => cancel() });
  }

  function clearPlace() {
    for (const v of ["--gl", "--gt", "--gr", "--gb"]) document.body.style.removeProperty(v);
  }

  async function expand() {
    if (state !== "ghost") return;
    state = "expanding";
    expanding = (async () => {
      let ok = false;
      try {
        const s = await invoke<Staged>("expand");
        const p = onViewport(s.stageW, s.stageH, () =>
          snap(() => {
            place(s.ghostX, s.ghostY, s.stageW, s.stageH);
            setRoom(s.room);
            el.hidden = false;
          }),
        );
        try {
          await invoke("stage");
        } catch (e) {
          p.cancel();
          throw e;
        }
        await p;
        void el.offsetWidth; // commit the closed clip before opening
        document.body.dataset.room = "waking";
        await sleep(260 * spd());
        document.body.dataset.room = "open";
        await sleep(700 * spd());
        const q = onViewport(
          s.stageW - s.room.left - s.room.right,
          s.stageH - s.room.top - s.room.bottom,
          () => snap(() => setRoom(null)),
        );
        try {
          await invoke("settle");
        } catch (e) {
          q.cancel();
          throw e;
        }
        await q;
        ascua.pause(true);
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
          clearPlace();
          setRoom(null);
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
      try {
        ascua.pause(false);
        const m = await invoke<Staged>("measure");
        const p = onViewport(m.stageW, m.stageH, () =>
          snap(() => {
            setRoom(m.room);
            place(m.ghostX, m.ghostY, m.stageW, m.stageH);
            setMax(false);
          }),
        );
        try {
          await invoke("stage");
        } catch (e) {
          p.cancel();
          throw e;
        }
        await p;
        document.body.dataset.room = "closing";
        await sleep(900 * spd());
        const q = onViewport(COMPACT.w, COMPACT.h, () => {
          el.hidden = true;
          delete document.body.dataset.room;
          ghostHost.style.cssText = "";
          clearPlace();
          setRoom(null);
        });
        try {
          applyLayout(await invoke<Layout>("collapse"));
        } catch (e) {
          q.cancel();
          throw e;
        }
        await q;
      } finally {
        el.hidden = true;
        delete document.body.dataset.room;
        ascua.pause(false);
        ghostHost.style.cssText = "";
        clearPlace();
        setRoom(null);
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
