# Roadmap

What we have decided, what we are weighing, and what comes next. Update it when a decision changes.

## Vision

One desktop app with two modes:

- **Companion** (always on, small): a configurable character on screen that answers Claude Code permissions and questions, greets you by name, sends notifications and reacts to what Claude does.
- **Workbench** (a window that opens when you click the companion): diffs of what Claude changed, git (branches, fetch, pull, push, merge into, IntelliJ style), file and text search, Claude Code sessions, and nxy (plans, checkpoints, reviews, memory, stats).

What sets it apart from [Coucou](https://github.com/Louis-CFM/coucou) (a notch companion for Claude Code) is **nxy plus the git/diff workbench**. A companion alone would compete with something that already exists.

## Decisions

- **Character decided (2026-10-17): the ghost "Auriculares" (variant key `hauris`), default theme coral, named Ascua.** A faded sheet ghost with a blank visor, a mouth, a headset with state LEDs and a mic. It replaces the candle mecha. Its act set is 17 acts: walk and sit were dropped (no legs, faded lower body, and the companion no longer walks); juggle (Task/subagents) became mini ghosts orbiting; mate is held in the arm with the bombilla at the mouth; read/code props sit at arm height; headset LEDs pulse on dance/code.
- **Stay on Tauri 2.** Rust, local socket IPC and the hook already exist; small binary and low RAM for an always-on app. Node pieces (Claude Agent SDK, nxy `.mjs` entries) run as a child process (`claude --output-format stream-json`) or a Node sidecar. Electron only if most of the logic ends up in Node.
- **No VS Code fork, no IDE from scratch.** A fork means monthly rebases, no Microsoft marketplace (Open VSX only), and no Pylance, C# Dev Kit, Remote-SSH or Live Share.
- **Workbench, not IDE.** No LSP, autocomplete or debugger. To edit code seriously: an "open in VS Code / IntelliJ" button at the file and line.
- **Colour encodes state** for any character: alert magenta, warn amber/red, ask cyan, cheer green/gold, sleep indigo.
- Claude-activity acts (code, read, think, juggle) only play on real hook events, never at random.
- The companion no longer walks; you drag it and its position is remembered (plan 67b90af0, review 5c55d1 fixed in full).

## Open questions

- ~~Which character?~~ Decided: see Decisions. The exploration rounds (Sábana family, consumed-by-the-terminal, Prompt variants, blank lenses, helmets) were removed from the repo once the character was ported.
- Long-term goal: a tool for you and nxy users, or a product that competes with Cursor/Windsurf? It changes scope, not the "no fork" decision.

## Next steps

1. ~~Plan 67b90af0 (drag, remembered position) and the 9 findings of review 5c55d1.~~ Done.
2. Real test: `npm run tauri dev` plus a real PermissionRequest. Then the first commit.
3. ~~Define the character~~ Done: Auriculares, coral, Ascua. Ported into `src/ascua.ts` / `src/ascua.css` (replacing the candle) with the 17 acts; the exploration HTMLs were removed.
4. `Character` interface (mount, act, theme) so characters are interchangeable implementations of the same 17 acts.
5. Settings: your name, character, theme. Stored in `app_config_dir` next to `position.json`.
6. Notifications: Claude Code `Stop` and `Notification` hooks over the same IPC, plus `tauri-plugin-notification`.
7. Map tool activity to acts: Read/Grep → read, Edit/Write → code, Task → juggle, thinking → think.
8. Workbench v1: per-file diffs and git status (read only).
9. Workbench v2: branches, fetch, pull, push, merge into, file and text search.
10. nxy in the workbench: approve plans, pick review findings, memory, stats.
11. Later: integrations with other tools, sounds, a thin VS Code extension that uses the same IPC.

## Workbench tech notes

| Piece | Choice |
|---|---|
| Diff and light editing | Monaco (VS Code's diff editor); CodeMirror 6 if we want lighter |
| Git | Shell out to the real `git` from Rust (credentials, SSH and hooks just work); read state with `git status --porcelain=v2` |
| File search | `ignore` crate (respects .gitignore) + `nucleo` (Helix's fuzzy matcher) |
| Text search | `grep-searcher` (ripgrep's engine) |
| Notifications | `tauri-plugin-notification` |

## Ghost ideas

- Translucent; fades out when idle, falls asleep, and shows up again when something happens.
- Comes in through the edge of the window when it appears.
- Glitches (red/cyan split) on destructive commands.
- Voluta is the smoke Ascua leaves when it goes out; Farolito carries Ascua's ember in a lantern. Both link the two characters if we keep them together.
