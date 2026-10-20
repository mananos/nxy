# nxy-ascua

Ascua is a little ghost with a headset that stays wherever you drag it on your screen (the position is remembered across launches). It answers Claude Code `PermissionRequest` hooks: you approve or reject from a bubble, Ascua reacts differently to destructive commands and questions, and it lives its own life (floats, dances, naps in place) in between.

## Layout

- `src/` frontend (TypeScript, Vite): the Ascua SVG, its life loop and the permission bubble
- `src/character/` the Ascua character art (all rights reserved, see `NOTICE`)
- `src-tauri/` the Tauri app
- `ipc/` shared local socket endpoint used by the app and the hook
- `hook/` the `ascua-hook` binary that Claude Code runs
- `preview.html` per-act preview with FPS readout; `ROADMAP.md` vision, decisions and next steps

## Development

```sh
npm install
cargo build -p ascua-hook
npm run tauri dev
```

To preview the mascot alone, run `npm run dev` and open `/preview.html`.

## Hook setup

Add a `PermissionRequest` hook to `.claude/settings.local.json` whose command is the absolute path to `target/debug/ascua-hook.exe`:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "/abs/path/to/target/debug/ascua-hook.exe", "timeout": 600 }
        ]
      }
    ]
  }
}
```

If the app is not running, the hook fails open and Claude Code asks in the terminal as usual.

## License

Code: Apache-2.0 (see `LICENSE`).

The Ascua name and character, the art in `src/character/` and the icons in `src-tauri/icons/` are **not** under Apache-2.0: all rights reserved. See `NOTICE`.
