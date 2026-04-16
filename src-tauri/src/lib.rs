mod state;
mod notion;

use state::{
  AppData, NoteUpdatePayload, SharedStore, BudgetData, BudgetAccountInput, BudgetTransactionInput,
  BudgetTripPlanInput, BudgetBankProfileInput, CollectionInput, TemplateInput,
  UserPreferences,
};
use tauri::AppHandle;
use notion::{NotionClient, NotionConfig, SharedNotionClient, note_to_markdown};
use tauri::{Manager, State};
use uuid::Uuid;

fn parse_uuid(input: &str) -> Result<Uuid, String> {
  Uuid::parse_str(input).map_err(|_| "Identifiant invalide".to_string())
}

// ── Notes ──

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

// ── Collections ──

#[tauri::command]
fn create_collection(store: State<SharedStore>, input: CollectionInput) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.create_collection(input)?;
  Ok(store.snapshot())
}

#[tauri::command]
fn update_collection(store: State<SharedStore>, collection_id: String, input: CollectionInput) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.update_collection(&collection_id, input)?;
  Ok(store.snapshot())
}

#[tauri::command]
fn delete_collection(store: State<SharedStore>, collection_id: String) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.delete_collection(&collection_id)?;
  Ok(store.snapshot())
}

// ── Templates ──

#[tauri::command]
fn create_template(store: State<SharedStore>, input: TemplateInput) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.create_template(input)?;
  Ok(store.snapshot())
}

#[tauri::command]
fn update_template(store: State<SharedStore>, template_id: String, input: TemplateInput) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.update_template(&template_id, input)?;
  Ok(store.snapshot())
}

#[tauri::command]
fn delete_template(store: State<SharedStore>, template_id: String) -> Result<AppData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.delete_template(&template_id)?;
  Ok(store.snapshot())
}

// ── Budget ──

#[tauri::command]
fn get_budget_data(store: State<SharedStore>) -> Result<BudgetData, String> {
  let store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn create_budget_account(store: State<SharedStore>, input: BudgetAccountInput) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.create_budget_account(input)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn update_budget_account(store: State<SharedStore>, account_id: String, input: BudgetAccountInput) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.update_budget_account(&account_id, input)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn delete_budget_account(store: State<SharedStore>, account_id: String) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.delete_budget_account(&account_id)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn record_budget_transaction(store: State<SharedStore>, input: BudgetTransactionInput) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.record_budget_transaction(input)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn update_budget_transaction(store: State<SharedStore>, transaction_id: String, input: BudgetTransactionInput) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.update_budget_transaction(&transaction_id, input)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn delete_budget_transaction(store: State<SharedStore>, transaction_id: String) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.delete_budget_transaction(&transaction_id)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn link_budget_transaction_note(store: State<SharedStore>, transaction_id: String, note_id: Option<String>) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.link_budget_transaction_note(&transaction_id, note_id.as_deref())?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn save_budget_trip_plan(store: State<SharedStore>, input: BudgetTripPlanInput) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.save_budget_trip_plan(input)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn delete_budget_trip_plan(store: State<SharedStore>, plan_id: String) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.delete_budget_trip_plan(&plan_id)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn create_bank_profile(store: State<SharedStore>, input: BudgetBankProfileInput) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.create_bank_profile(input)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn update_bank_profile(store: State<SharedStore>, profile_id: String, input: BudgetBankProfileInput) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.update_bank_profile(&profile_id, input)?;
  Ok(store.budget_snapshot())
}

#[tauri::command]
fn delete_bank_profile(store: State<SharedStore>, profile_id: String) -> Result<BudgetData, String> {
  let mut store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.delete_bank_profile(&profile_id)?;
  Ok(store.budget_snapshot())
}

// ── Notion Integration ──

#[tauri::command]
async fn notion_connect(notion: State<'_, SharedNotionClient>, store: State<'_, SharedStore>, access_token: String) -> Result<NotionConfig, String> {
  let config = NotionConfig {
    access_token: access_token.clone(),
    workspace_name: None,
    connected_at: Some(chrono::Utc::now().to_rfc3339()),
  };
  let client = NotionClient::with_config(config.clone());
  let user_info = client.verify_connection().await?;
  let mut notion = notion.lock().await;
  let mut final_config = config;
  final_config.workspace_name = user_info.name;
  notion.set_config(final_config.clone());
  
  // Save to user preferences
  let store_lock = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  let mut prefs = store_lock.get_user_preferences().unwrap_or_default();
  prefs.notion_config = Some(final_config.clone());
  store_lock.set_user_preferences(prefs).map_err(|e| format!("Échec sauvegarde Notion: {e}"))?;
  
  Ok(final_config)
}

#[tauri::command]
async fn notion_disconnect(notion: State<'_, SharedNotionClient>, store: State<'_, SharedStore>) -> Result<(), String> {
  let mut notion = notion.lock().await;
  notion.disconnect();
  
  // Remove from user preferences
  let store_lock = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  let mut prefs = store_lock.get_user_preferences().unwrap_or_default();
  prefs.notion_config = None;
  store_lock.set_user_preferences(prefs).map_err(|e| format!("Échec suppression Notion: {e}"))?;
  
  Ok(())
}

#[tauri::command]
async fn notion_status(notion: State<'_, SharedNotionClient>) -> Result<notion::NotionSyncStatus, String> {
  let notion = notion.lock().await;
  Ok(notion.status().clone())
}

#[tauri::command]
async fn notion_get_config(notion: State<'_, SharedNotionClient>) -> Result<Option<notion::NotionConfig>, String> {
  let notion = notion.lock().await;
  Ok(notion.config().cloned())
}

#[tauri::command]
async fn notion_search(notion: State<'_, SharedNotionClient>, query: String) -> Result<Vec<notion::NotionSearchResult>, String> {
  let notion = notion.lock().await;
  notion.search(&query).await
}

#[tauri::command]
async fn notion_get_page(notion: State<'_, SharedNotionClient>, page_id: String) -> Result<notion::NotionPageDetail, String> {
  let notion = notion.lock().await;
  notion.get_page(&page_id).await
}

#[tauri::command]
async fn notion_push_note(
  store: State<'_, SharedStore>,
  notion: State<'_, SharedNotionClient>,
  note_id: String,
  parent_page_id: String,
) -> Result<notion::NotionPage, String> {
  let (title, summary, tasks, blocks_json) = {
    let s = store.lock().map_err(|_| "Store verrouillé")?;
    let data = s.snapshot();
    let note = data.notes.iter().find(|n| n.id.to_string() == note_id)
      .ok_or("Note introuvable")?;
    let tasks: Vec<(String, bool)> = note.tasks.iter().map(|t| (t.label.clone(), t.done)).collect();
    let blocks_json: serde_json::Value = serde_json::to_value(&note.blocks).map_err(|e| e.to_string())?;
    (note.title.clone(), note.summary.clone(), tasks, blocks_json)
  };
  let blocks_arr = blocks_json.as_array().cloned().unwrap_or_default();
  let content = note_to_markdown(&title, &summary, &tasks, &blocks_arr);

  let notion_client = notion.lock().await;
  notion_client.create_page(&parent_page_id, &title, &content).await
}

#[tauri::command]
async fn notion_push_all_notes(
  store: State<'_, SharedStore>,
  notion: State<'_, SharedNotionClient>,
  parent_page_id: String,
) -> Result<Vec<notion::NotionPage>, String> {
  let notes_data = {
    let s = store.lock().map_err(|_| "Store verrouillé")?;
    let data = s.snapshot();
    data.notes.iter().map(|note| {
      let tasks: Vec<(String, bool)> = note.tasks.iter().map(|t| (t.label.clone(), t.done)).collect();
      let blocks_json: serde_json::Value = serde_json::to_value(&note.blocks).unwrap_or_default();
      (note.title.clone(), note.summary.clone(), tasks, blocks_json)
    }).collect::<Vec<_>>()
  };

  let notion_client = notion.lock().await;
  let mut results = Vec::new();
  for (title, summary, tasks, blocks_json) in &notes_data {
    let blocks_arr = blocks_json.as_array().cloned().unwrap_or_default();
    let content = note_to_markdown(title, summary, tasks, &blocks_arr);
    match notion_client.create_page(&parent_page_id, title, &content).await {
      Ok(page) => results.push(page),
      Err(e) => { eprintln!("Failed to push note {}: {}", title, e); }
    }
  }
  Ok(results)
}

// ── User Preferences ──

#[tauri::command]
fn get_user_preferences(store: State<SharedStore>) -> Result<UserPreferences, String> {
  let store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.get_user_preferences()
}

#[tauri::command]
fn set_user_preferences(store: State<SharedStore>, prefs: UserPreferences) -> Result<(), String> {
  let store = store.lock().map_err(|_| "Impossible de verrouiller le store".to_string())?;
  store.set_user_preferences(prefs)
}

// ── Avatar Upload (Base64 storage in SQLite) ──

#[tauri::command]
async fn upload_avatar(_app: AppHandle, base64_data: String) -> Result<String, String> {
  // Validate base64 image data
  if !base64_data.starts_with("data:image/") {
    return Err("Format d'image invalide".to_string());
  }
  
  // Extract mime type and check size (limit to ~2MB)
  let size_estimate = base64_data.len() * 3 / 4;
  if size_estimate > 2_000_000 {
    return Err("Image trop grande (max 2MB)".to_string());
  }
  
  Ok(base64_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let shared_store = state::Store::initialize(app.handle())?;
      
      // Load Notion config from user preferences if available
      let notion_config = {
        let store = shared_store.lock().map_err(|_| "Failed to lock store")?;
        store.get_user_preferences().ok().and_then(|p| p.notion_config)
      };
      
      let notion_client = if let Some(config) = notion_config {
        SharedNotionClient::new(tokio::sync::Mutex::new(NotionClient::with_config(config)))
      } else {
        SharedNotionClient::new(tokio::sync::Mutex::new(NotionClient::new()))
      };
      
      app.manage(shared_store);
      app.manage(notion_client);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // Notes
      get_app_data,
      create_note,
      update_note,
      delete_note,
      duplicate_note,
      set_active_note,
      // Collections
      create_collection,
      update_collection,
      delete_collection,
      // Templates
      create_template,
      update_template,
      delete_template,
      // Budget
      get_budget_data,
      create_budget_account,
      update_budget_account,
      delete_budget_account,
      record_budget_transaction,
      update_budget_transaction,
      delete_budget_transaction,
      link_budget_transaction_note,
      save_budget_trip_plan,
      delete_budget_trip_plan,
      create_bank_profile,
      update_bank_profile,
      delete_bank_profile,
      // Notion
      notion_connect,
      notion_disconnect,
      notion_status,
      notion_get_config,
      notion_search,
      notion_get_page,
      notion_push_note,
      notion_push_all_notes,
      // User Preferences
      get_user_preferences,
      set_user_preferences,
      upload_avatar,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
