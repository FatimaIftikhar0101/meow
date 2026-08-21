//! The desktop shell.
//!
//! Deliberately thin. The panel is a web app that this wraps, and the only
//! things that live here are the ones a browser genuinely cannot do. Keeping
//! the Rust surface small is what makes the choice of Tauri reversible: if the
//! shell ever becomes friction, the same frontend ships as a web build and
//! loses only what is below.

use keyring::Entry;

/// Where the credential is filed in the OS store.
///
/// The service name is the bundle identifier so the entry is attributable in
/// Credential Manager or Keychain Access, rather than appearing as an unnamed
/// secret somebody is tempted to delete.
const SERVICE: &str = "com.meow.backoffice";
const ACCOUNT: &str = "staff-session";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

/// Store the session token in the OS credential store.
///
/// This is the reason the panel is a desktop app rather than a browser tab.
/// `localStorage` is readable by any script that reaches the page, and the
/// token it would hold belongs to someone who can move money and read customer
/// PII. Here it is held by the operating system, encrypted at rest under the
/// user's login, and never exposed to the webview except when asked for.
#[tauri::command]
fn save_token(token: String) -> Result<(), String> {
    entry()?.set_password(&token).map_err(|e| e.to_string())
}

/// Read the stored token back, if there is one.
///
/// A missing entry is `Ok(None)` rather than an error: "nobody has signed in on
/// this machine yet" is the ordinary first-run state, not a failure, and the
/// caller should not have to tell the two apart from an error string.
#[tauri::command]
fn load_token() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        // An empty value is what `delete_token` leaves behind when it could not
        // remove the entry outright. Reporting it as a token would hand the
        // caller a string that cannot authenticate anything.
        Ok(token) if token.is_empty() => Ok(None),
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Forget the token. Signing out must not leave the credential behind.
///
/// If the entry cannot be removed — a locked keyring, a backend that refuses —
/// overwrite it before giving up. A blank credential is not a usable session,
/// so the stored value stops being dangerous even when the delete itself
/// cannot be made to work. Only if that fails too is this a real error, and
/// then the caller has to be told rather than left assuming it worked.
#[tauri::command]
fn delete_token() -> Result<(), String> {
    let entry = entry()?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        // Already gone is the outcome the caller wanted.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(delete_err) => match entry.set_password("") {
            Ok(()) => Ok(()),
            Err(_) => Err(delete_err.to_string()),
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Desktop-only, matching the Cargo target guard.
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_token,
            load_token,
            delete_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
