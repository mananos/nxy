//! Claude Code hook: stdin -> Ascua -> stdout.
//!
//! Fail open. If Ascua isn't running, or anything goes wrong, print nothing and
//! exit 0 so Claude Code falls back to its own prompt. Never block Claude.

use std::io::{self, BufRead, BufReader, Read, Write};

use interprocess::local_socket::{Stream, prelude::*};

fn main() {
    let _ = run();
}

fn run() -> io::Result<()> {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let event: serde_json::Value = serde_json::from_str(&input).map_err(io::Error::other)?;

    let mut conn = BufReader::new(Stream::connect(ascua_ipc::endpoint()?)?);
    writeln!(conn.get_mut(), "{event}")?;

    let mut reply = String::new();
    conn.read_line(&mut reply)?;
    if !reply.trim().is_empty() {
        print!("{reply}");
    }
    Ok(())
}
