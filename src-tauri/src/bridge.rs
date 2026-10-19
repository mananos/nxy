//! Receives Claude Code permission requests from `ascua-hook`, shows them to the
//! frontend, and sends the user's decision back as the hook's stdout.

use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Write};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::thread;

use interprocess::local_socket::{ListenerOptions, Stream, prelude::*};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager, State};

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

/// Waiting hook connections, keyed by request id. The value is the line to write back.
#[derive(Default)]
pub struct Pending(Mutex<HashMap<u64, mpsc::Sender<String>>>);

#[derive(Serialize, Clone)]
struct Request {
    id: u64,
    tool: String,
    summary: String,
    input: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Decision {
    Allow,
    Deny,
    /// Let Claude Code show its own prompt in the terminal.
    Terminal,
}

pub fn listen(app: AppHandle) -> io::Result<()> {
    let listener = ListenerOptions::new()
        .name(ascua_ipc::endpoint()?)
        .try_overwrite(true)
        .create_sync()?;

    thread::spawn(move || {
        for conn in listener.incoming().filter_map(Result::ok) {
            let app = app.clone();
            thread::spawn(move || {
                let _ = serve(&app, conn);
            });
        }
    });
    Ok(())
}

fn serve(app: &AppHandle, conn: Stream) -> io::Result<()> {
    let mut conn = BufReader::new(conn);
    let mut line = String::new();
    conn.read_line(&mut line)?;
    let event: Value = serde_json::from_str(&line).map_err(io::Error::other)?;

    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    let (reply_tx, reply_rx) = mpsc::channel();
    app.state::<Pending>().0.lock().unwrap().insert(id, reply_tx);

    let tool = event["tool_name"].as_str().unwrap_or("?").to_owned();
    let input = event["tool_input"].clone();
    let request = Request { id, summary: summarize(&tool, &input), tool, input };

    crate::perch::set_bubble(app, true);
    let _ = app.emit("permission-request", request);

    // Blocks until the user decides. If Ascua quits, the sender drops and we hang up.
    let reply = reply_rx.recv().unwrap_or_default();
    writeln!(conn.get_mut(), "{reply}")
}

#[tauri::command]
pub fn resolve(app: AppHandle, pending: State<Pending>, id: u64, decision: Decision) {
    let mut waiting = pending.0.lock().unwrap();
    if let Some(reply_tx) = waiting.remove(&id) {
        let _ = reply_tx.send(hook_output(decision));
    }
    crate::perch::set_bubble(&app, !waiting.is_empty());
}

fn hook_output(decision: Decision) -> String {
    let decision = match decision {
        Decision::Allow => json!({ "behavior": "allow" }),
        Decision::Deny => json!({ "behavior": "deny", "message": "Rejected from Ascua." }),
        Decision::Terminal => return String::new(),
    };
    json!({
        "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": decision }
    })
    .to_string()
}

fn summarize(tool: &str, input: &Value) -> String {
    let text = |key: &str| input[key].as_str().unwrap_or("?");
    match tool {
        "Bash" => text("command").to_owned(),
        "Edit" | "MultiEdit" | "Write" | "Read" => format!("{tool} {}", text("file_path")),
        _ => tool.to_owned(),
    }
}
