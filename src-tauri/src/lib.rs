mod state;

use state::{AppData, NoteUpdatePayload, SharedStore};
use tauri::{Manager, State};
use uuid::Uuid;

#[tauri::command]
fn get_app_data(store: State<SharedStore>) -> Result<AppData, String> {
  let store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  Ok(store.snapshot())
}

#[tauri::command]
fn create_note(store: State<SharedStore>, payload: Option<NoteUpdatePayload>) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.create_note(payload.unwrap_or_default())?;
  Ok(store.snapshot())
}

#[tauri::command]
fn update_note(store: State<SharedStore>, note_id: String, payload: NoteUpdatePayload) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  let id = parse_uuid(&note_id)?;
  store.update_note(id, payload)?;
  Ok(store.snapshot())
}

#[tauri::command]
fn delete_note(store: State<SharedStore>, note_id: String) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  let id = parse_uuid(&note_id)?;
  store.delete_note(id)
}

#[tauri::command]
fn duplicate_note(store: State<SharedStore>, note_id: String) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  let id = parse_uuid(&note_id)?;
  store.duplicate_note(id)?;
  Ok(store.snapshot())
}

#[tauri::command]
fn set_active_note(store: State<SharedStore>, note_id: String) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  let id = parse_uuid(&note_id)?;
  store.set_active_note(id)?;
  Ok(store.snapshot())
}

fn parse_uuid(input: &str) -> Result<Uuid, String> {
  Uuid::parse_str(input).map_err(|_| "Identifiant de note invalide".to_string())
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

      let shared_store = state::Store::initialize(app.handle())?;
      app.manage(shared_store);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_app_data,
      create_note,
      update_note,
      delete_note,
      duplicate_note,
      set_active_note,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
