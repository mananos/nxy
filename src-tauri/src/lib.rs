mod bridge;
mod perch;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(bridge::Pending::default())
        .manage(perch::Perch::default())
        .invoke_handler(tauri::generate_handler![
            bridge::resolve,
            perch::drag,
            perch::layout
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").expect("main window");
            perch::restore(app.handle(), &window)?;
            // Idle Ascua never steals clicks; the perch watcher flips this as the cursor
            // reaches Ascua or a bubble is up.
            window.set_ignore_cursor_events(true)?;
            perch::watch(app.handle().clone());
            bridge::listen(app.handle().clone())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
