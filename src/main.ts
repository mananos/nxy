import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { mountAscua } from "./ascua";
import { live, type Need } from "./life";
import { draggable } from "./drag";
import { applyLayout, type Layout } from "./layout";
import { mountRoom } from "./room";

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

const room = mountRoom(document.querySelector<HTMLElement>("#room")!, host, ascua);

// A plain click pokes (after DBL_MS, so a double-click can cancel it); a double-click opens the room.
const DBL_MS = 500; // the Windows default double-click interval
let pokeTimer: ReturnType<typeof setTimeout> | undefined;
const wasDragged = draggable(host);
host.addEventListener("click", (event) => {
  if (wasDragged() || event.detail > 1) return;
  clearTimeout(pokeTimer);
  pokeTimer = setTimeout(() => life.poke(), DBL_MS);
});
host.addEventListener("dblclick", () => {
  clearTimeout(pokeTimer);
  room.expand();
});

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

let arrivals: Promise<void> = Promise.resolve();

listen<PermissionRequest>("permission-request", ({ payload }) => {
  // Serialise so a burst of requests keeps its order while the room collapses.
  arrivals = arrivals
    .then(async () => {
      if (room.isOpen()) await room.collapse().catch(() => {});
      queue.push(payload);
      if (queue.length === 1) life.need(actFor(payload));
      render();
    })
    .catch(() => {});
});
