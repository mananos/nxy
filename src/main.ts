import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { mountAscua } from "./ascua";
import { live, type Need } from "./life";

interface PermissionRequest {
  id: number;
  tool: string;
  summary: string;
  input: unknown;
}

type Decision = "allow" | "deny" | "terminal";

// Commands that deserve a warning look before you click Approve.
const DESTRUCTIVE = /\brm\s+-\w*[rf]|--force\b|\bpush\s+-f\b|\breset\s+--hard\b|\bdel\s+\/[sq]\b|\bRemove-Item\b.*-Recurse|\bdrop\s+(table|database)\b|\bmkfs\b|\bdd\s+if=/i;

function actFor(request: PermissionRequest): Need {
  if (request.tool === "AskUserQuestion") return "ask";
  return DESTRUCTIVE.test(request.summary) ? "warn" : "alert";
}

const queue: PermissionRequest[] = [];

const host = document.querySelector<HTMLElement>("#ascua-host")!;
const ascua = mountAscua(host, "stage");
const life = live(ascua);

// A press that moves beyond DRAG_PX starts an OS window drag; a plain click pokes.
const DRAG_PX = 4;
let press: { x: number; y: number } | null = null;
let dragged = false;
host.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  press = { x: event.screenX, y: event.screenY };
  dragged = false;
});
host.addEventListener("pointermove", (event) => {
  if (!press || !(event.buttons & 1)) return;
  if (Math.hypot(event.screenX - press.x, event.screenY - press.y) <= DRAG_PX) return;
  dragged = true;
  press = null;
  invoke("drag").catch(() => {});
});
host.addEventListener("click", () => {
  if (dragged) {
    dragged = false;
    return;
  }
  life.poke();
});

interface Layout {
  left: boolean;
  top: boolean;
}

function applyLayout({ left, top }: Layout) {
  document.body.dataset.x = left ? "left" : "right";
  document.body.dataset.y = top ? "top" : "bottom";
}
invoke<Layout>("layout").then(applyLayout);
listen<Layout>("layout", ({ payload }) => applyLayout(payload));

const bubble = document.querySelector<HTMLElement>("#bubble")!;
const toolEl = document.querySelector<HTMLElement>("#tool")!;
const queuedEl = document.querySelector<HTMLElement>("#queued")!;
const summaryEl = document.querySelector<HTMLElement>("#summary")!;
const faceEl = document.querySelector<HTMLElement>("#face")!;
const avatar = mountAscua(faceEl, "face");
avatar.pause(true);

function render() {
  const current = queue[0];
  bubble.hidden = !current;
  avatar.pause(current === undefined);
  if (!current) return;

  avatar.play(actFor(current));
  toolEl.textContent = current.tool;
  summaryEl.textContent = current.summary;
  queuedEl.textContent = queue.length > 1 ? `+${queue.length - 1} waiting` : "";
}

async function decide(decision: Decision) {
  const current = queue.shift();
  render();
  if (!current) return;
  if (queue.length) life.need(actFor(queue[0]));
  else if (decision === "allow") life.celebrate();
  else life.release();
  await invoke("resolve", { id: current.id, decision });
}

bubble.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
  button.addEventListener("click", () => decide(button.dataset.decision as Decision));
});

listen<PermissionRequest>("permission-request", ({ payload }) => {
  queue.push(payload);
  if (queue.length === 1) life.need(actFor(payload));
  render();
});
