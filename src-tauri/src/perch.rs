//! Where Ascua sits on screen: placement, click hit-testing, dragging and the
//! remembered spot. The window is bigger than Ascua (room for the bubble), so Ascua
//! hugs one of its corners and the window flips around it to stay on screen.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use std::{fs, thread};

use serde::Serialize;
use serde_json::{Value, json};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewWindow,
};

/// Side of `#ascua-host` in CSS px; must match src/styles.css.
const ASCUA_CSS: f64 = 120.0;
const MARGIN: i32 = 16;
const POLL: Duration = Duration::from_millis(40);
const SETTLE: Duration = Duration::from_millis(600);
/// Re-read window geometry at least this often, and whenever the cursor is within
/// `NEAR` px of the window.
const REMEASURE: Duration = Duration::from_millis(250);
const NEAR: i32 = 40;

/// Which window corner Ascua sits in. The default is today's look: right/bottom.
#[derive(Serialize, Clone, Copy, Default)]
pub struct Layout {
    left: bool,
    top: bool,
}

#[derive(Default)]
pub struct Perch {
    layout: Mutex<Layout>,
    bubble: AtomicBool,
    clickable: AtomicBool,
}

/// Ascua's screen top-left and side, plus the window's bounds, all in physical px.
#[derive(Clone, Copy)]
struct Rect {
    at: PhysicalPosition<i32>,
    side: i32,
    /// Window left, top, right, bottom.
    win: (i32, i32, i32, i32),
}

fn ascua_rect(window: &WebviewWindow, layout: Layout) -> tauri::Result<Rect> {
    let side = (ASCUA_CSS * window.scale_factor()?).round() as i32;
    let pos = window.outer_position()?;
    let size = window.outer_size()?;
    let (w, h) = (size.width as i32, size.height as i32);
    let x = if layout.left { 0 } else { w - side };
    let y = if layout.top { 0 } else { h - side };
    Ok(Rect {
        at: PhysicalPosition::new(pos.x + x, pos.y + y),
        side,
        win: (pos.x, pos.y, pos.x + w, pos.y + h),
    })
}

fn current(app: &AppHandle, window: &WebviewWindow) -> tauri::Result<Rect> {
    let layout = *app.state::<Perch>().layout.lock().unwrap();
    ascua_rect(window, layout)
}

/// Pure placement. Clamps Ascua's top-left `ascua` into `area` (left, top, right,
/// bottom) and picks, per axis, the corner whose window still fits. Returns the
/// window's top-left and the layout.
fn fit(
    ascua: (i32, i32),
    side: i32,
    win: (i32, i32),
    area: (i32, i32, i32, i32),
) -> ((i32, i32), Layout) {
    let (left_edge, top_edge, right_edge, bottom_edge) = area;
    let x = ascua.0.min(right_edge - side).max(left_edge);
    let y = ascua.1.min(bottom_edge - side).max(top_edge);
    let right = x + side - win.0 >= left_edge;
    let bottom = y + side - win.1 >= top_edge;
    let win_x = if right { x + side - win.0 } else { x };
    let win_y = if bottom { y + side - win.1 } else { y };
    ((win_x, win_y), Layout { left: !right, top: !bottom })
}

/// Puts Ascua's top-left at `ascua` (clamped into its monitor's work area) and moves
/// the window so it still fits on screen, flipping the corner Ascua sits in.
fn place(app: &AppHandle, window: &WebviewWindow, ascua: PhysicalPosition<i32>) -> tauri::Result<()> {
    // The move can land on a monitor with another DPI, which changes the window's
    // physical size; measure again afterwards and place once more if it changed.
    for _ in 0..2 {
        let scale = window.scale_factor()?;
        let side = (ASCUA_CSS * scale).round() as i32;
        let size = window.outer_size()?;

        let center = (ascua.x + side / 2, ascua.y + side / 2);
        let monitor = match window.monitor_from_point(center.0 as f64, center.1 as f64)? {
            Some(monitor) => Some(monitor),
            None => window.primary_monitor()?,
        };
        let area = match monitor {
            Some(monitor) => {
                let area = monitor.work_area();
                (
                    area.position.x,
                    area.position.y,
                    area.position.x + area.size.width as i32,
                    area.position.y + area.size.height as i32,
                )
            }
            None => (i32::MIN / 2, i32::MIN / 2, i32::MAX / 2, i32::MAX / 2),
        };
        let (win_pos, layout) = fit(
            (ascua.x, ascua.y),
            side,
            (size.width as i32, size.height as i32),
            area,
        );

        // Layout first, so the frontend flips before the window moves under it.
        *app.state::<Perch>().layout.lock().unwrap() = layout;
        let _ = app.emit("layout", layout);
        window.set_position(PhysicalPosition::new(win_pos.0, win_pos.1))?;

        if window.scale_factor()? == scale && window.outer_size()? == size {
            break;
        }
    }
    Ok(())
}

fn position_file(app: &AppHandle) -> Option<std::path::PathBuf> {
    Some(app.path().app_config_dir().ok()?.join("position.json"))
}

fn saved_position(app: &AppHandle) -> Option<PhysicalPosition<i32>> {
    let text = fs::read_to_string(position_file(app)?).ok()?;
    let value: Value = serde_json::from_str(&text).ok()?;
    Some(PhysicalPosition::new(
        value["x"].as_i64()? as i32,
        value["y"].as_i64()? as i32,
    ))
}

fn save_position(app: &AppHandle, at: PhysicalPosition<i32>) {
    let Some(file) = position_file(app) else { return };
    if let Some(dir) = file.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let _ = fs::write(file, json!({ "x": at.x, "y": at.y }).to_string());
}

/// Places Ascua at its remembered spot, or bottom-right of the primary monitor.
pub fn restore(app: &AppHandle, window: &WebviewWindow) -> tauri::Result<()> {
    let side = (ASCUA_CSS * window.scale_factor()?).round() as i32;
    if let Some(saved) = saved_position(app) {
        let center = (saved.x + side / 2, saved.y + side / 2);
        let on_screen = window.available_monitors()?.iter().any(|monitor| {
            let area = monitor.work_area();
            center.0 >= area.position.x
                && center.0 < area.position.x + area.size.width as i32
                && center.1 >= area.position.y
                && center.1 < area.position.y + area.size.height as i32
        });
        if on_screen {
            return place(app, window, saved);
        }
    }
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(());
    };
    let area = monitor.work_area();
    place(
        app,
        window,
        PhysicalPosition::new(
            area.position.x + area.size.width as i32 - side - MARGIN,
            area.position.y + area.size.height as i32 - side - MARGIN,
        ),
    )
}

/// Polls the cursor so only Ascua's square (or the whole window while a bubble is
/// up) takes clicks, and saves the spot once a drag has settled.
pub fn watch(app: AppHandle) {
    thread::spawn(move || {
        let mut last = None;
        let mut saved = None;
        let mut since = Instant::now();
        // Window geometry is cached: most ticks only read the cursor.
        let mut rect: Option<Rect> = None;
        let mut measured = Instant::now();
        loop {
            thread::sleep(POLL);
            let Some(window) = app.get_webview_window("main") else { break };
            let perch = app.state::<Perch>();
            let cursor = window.cursor_position().ok();

            let near = |r: &Rect| {
                cursor.is_some_and(|c| {
                    c.x >= (r.win.0 - NEAR) as f64
                        && c.x < (r.win.2 + NEAR) as f64
                        && c.y >= (r.win.1 - NEAR) as f64
                        && c.y < (r.win.3 + NEAR) as f64
                })
            };
            if rect.is_none_or(|r| near(&r) || measured.elapsed() >= REMEASURE) {
                match current(&app, &window) {
                    Ok(r) => {
                        rect = Some(r);
                        measured = Instant::now();
                    }
                    Err(_) => continue,
                }
            }
            let Some(Rect { at, side, .. }) = rect else { continue };

            let inside = cursor.is_some_and(|c| {
                c.x >= at.x as f64
                    && c.x < (at.x + side) as f64
                    && c.y >= at.y as f64
                    && c.y < (at.y + side) as f64
            });
            let want = perch.bubble.load(Ordering::Relaxed) || inside;
            if want != perch.clickable.load(Ordering::Relaxed)
                && window.set_ignore_cursor_events(!want).is_ok()
            {
                perch.clickable.store(want, Ordering::Relaxed);
            }

            let key = (at.x, at.y);
            if last != Some(key) {
                if last.is_none() {
                    saved = Some(key); // the startup spot is already known
                }
                last = Some(key);
                since = Instant::now();
            } else if saved != Some(key) && since.elapsed() >= SETTLE {
                saved = Some(key);
                save_position(&app, at);
                // A drag may have left the open bubble off-screen: flip it.
                if perch.bubble.load(Ordering::Relaxed) {
                    let _ = place(&app, &window, at);
                    rect = None;
                }
            }
        }
    });
}

/// A bubble needs the whole window clickable and on screen; re-place first so it
/// opens on the free side of Ascua.
pub fn set_bubble(app: &AppHandle, shown: bool) {
    app.state::<Perch>().bubble.store(shown, Ordering::Relaxed);
    if !shown {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(rect) = current(app, &window) {
            let _ = place(app, &window, rect.at);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: (i32, i32, i32, i32) = (0, 0, 1000, 800);
    const WIN: (i32, i32) = (420, 600);

    fn run(ascua: (i32, i32)) -> ((i32, i32), bool, bool) {
        let (pos, l) = fit(ascua, 120, WIN, AREA);
        (pos, l.left, l.top)
    }

    #[test]
    fn bottom_right_default_keeps_corner() {
        // Ascua at (860,664): window grows up and to the left.
        assert_eq!(run((860, 664)), ((560, 184), false, false));
    }

    #[test]
    fn top_left_corner_flips_both_axes() {
        assert_eq!(run((0, 0)), ((0, 0), true, true));
    }

    #[test]
    fn right_edge_flips_nothing_when_room_on_left() {
        // Clamped to right edge (880), room above/left.
        assert_eq!(run((5000, 700)), ((580, 200), false, false));
    }

    #[test]
    fn left_edge_flips_x_only() {
        let ((wx, wy), left, top) = run((100, 700));
        assert_eq!((wx, left), (100, true));
        assert_eq!((wy, top), (680 + 120 - 600, false));
    }

    #[test]
    fn top_edge_flips_y_only() {
        assert_eq!(run((800, 0)), ((500, 0), false, true));
    }

    #[test]
    fn clamps_negative_and_overflow() {
        assert_eq!(run((-50, -50)), ((0, 0), true, true));
        assert_eq!(run((9999, 9999)), ((580, 200), false, false));
    }

    #[test]
    fn work_area_narrower_than_window_prefers_left_corner() {
        let (pos, l) = fit((100, 300), 120, (420, 600), (0, 0, 300, 800));
        assert_eq!((pos.0, l.left), (100, true));
        assert_eq!((pos.1, l.top), (300, true));
    }
}

#[tauri::command]
pub fn drag(window: WebviewWindow) {
    let _ = window.start_dragging();
}

#[tauri::command]
pub fn layout(state: State<Perch>) -> Layout {
    *state.layout.lock().unwrap()
}
