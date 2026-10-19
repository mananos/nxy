//! Where the Ascua app listens and where `ascua-hook` connects.
//!
//! Windows uses a named pipe scoped to the user; Unix uses a socket file under
//! `XDG_RUNTIME_DIR`, which is `0700`, so other users can't reach it.

use std::io;

use interprocess::local_socket::Name;

#[cfg(windows)]
pub fn endpoint() -> io::Result<Name<'static>> {
    use interprocess::local_socket::{GenericNamespaced, ToNsName};

    let user = std::env::var("USERNAME").unwrap_or_default();
    format!("ascua-{user}").to_ns_name::<GenericNamespaced>()
}

#[cfg(unix)]
pub fn endpoint() -> io::Result<Name<'static>> {
    use interprocess::local_socket::{GenericFilePath, ToFsName};

    let dir = std::env::var_os("XDG_RUNTIME_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    dir.join("ascua.sock").to_fs_name::<GenericFilePath>()
}
