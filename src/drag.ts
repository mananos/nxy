import { invoke } from "@tauri-apps/api/core";

// A press that moves beyond DRAG_PX starts an OS window drag; a plain click does not.
// Returns a check for "was the last press a drag?" that also resets the flag.
const DRAG_PX = 4;

export function draggable(el: HTMLElement): () => boolean {
  let press: { x: number; y: number } | null = null;
  let dragged = false;
  el.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    press = { x: event.screenX, y: event.screenY };
    dragged = false;
  });
  el.addEventListener("pointermove", (event) => {
    if (!press || !(event.buttons & 1)) return;
    if (Math.hypot(event.screenX - press.x, event.screenY - press.y) <= DRAG_PX) return;
    dragged = true;
    press = null;
    invoke("drag").catch(() => {});
  });
  return () => {
    const was = dragged;
    dragged = false;
    return was;
  };
}
