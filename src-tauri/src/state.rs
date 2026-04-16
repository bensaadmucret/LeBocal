use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{self, Value};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use crate::notion::NotionConfig;

const DB_FILE: &str = "le-bocal-prod.db";

pub type SharedStore = Arc<Mutex<Store>>;

// ═══════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════

#[derive(Debug, Clone)]
pub struct Store {
  db_path: PathBuf,
}

impl Store {
  pub fn initialize(app: &AppHandle) -> Result<SharedStore, String> {
    let data_dir = app
      .path()
      .app_data_dir()
      .map_err(|err| format!("Impossible de récupérer le dossier app_data : {err}"))?;
    std::fs::create_dir_all(&data_dir)
      .map_err(|err| format!("Impossible de créer le dossier de stockage : {err}"))?;
    let store = Store {
      db_path: data_dir.join(DB_FILE),
    };
    {
      let conn = store.conn()?;
      store.ensure_schema(&conn)?;
      store.ensure_initial_note(&conn)?;
      store.ensure_budget_defaults(&conn)?;
    }
    Ok(Arc::new(Mutex::new(store)))
  }

  fn conn(&self) -> Result<Connection, String> {
    Connection::open(&self.db_path).map_err(|err| format!("Impossible d'ouvrir la base SQLite : {err}"))
  }

  fn ensure_schema(&self, conn: &Connection) -> Result<(), String> {
    conn
      .execute_batch(
        "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            status TEXT NOT NULL,
            tags TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            tasks TEXT NOT NULL,
            sections TEXT NOT NULL,
            blocks TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
          );

          CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            tag TEXT NOT NULL,
            label TEXT NOT NULL,
            accent TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS templates (
            id TEXT PRIMARY KEY,
            icon TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            accent TEXT NOT NULL,
            payload TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS budget_accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'EUR',
            balance REAL NOT NULL DEFAULT 0,
            target REAL,
            alert_threshold REAL,
            icon TEXT,
            color TEXT,
            tags TEXT,
            description TEXT
          );

          CREATE TABLE IF NOT EXISTS budget_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            color TEXT NOT NULL,
            icon TEXT,
            parent_id TEXT
          );

          CREATE TABLE IF NOT EXISTS budget_transactions (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category_id TEXT NOT NULL,
            label TEXT NOT NULL,
            date TEXT NOT NULL,
            note_id TEXT,
            memo TEXT
          );

          CREATE TABLE IF NOT EXISTS budget_preferences (
            key TEXT PRIMARY KEY,
            value TEXT
          );

          CREATE TABLE IF NOT EXISTS budget_bank_profiles (
            id TEXT PRIMARY KEY,
            bank_name TEXT NOT NULL,
            account_label TEXT NOT NULL,
            account_number TEXT,
            currency TEXT NOT NULL DEFAULT 'EUR',
            balance REAL NOT NULL DEFAULT 0,
            target REAL,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS budget_trip_plans (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            duration_days INTEGER NOT NULL DEFAULT 0,
            transports TEXT NOT NULL,
            lodging TEXT,
            activities TEXT NOT NULL,
            alerts TEXT NOT NULL,
            linked_bank_profile_id TEXT,
            estimated_total REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS calendar_events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            start_date TEXT NOT NULL,
            end_date TEXT,
            is_all_day INTEGER NOT NULL DEFAULT 0,
            category_id TEXT NOT NULL DEFAULT 'sage',
            color TEXT NOT NULL DEFAULT '#95a392',
            linked_note_id TEXT,
            linked_budget_transaction_id TEXT,
            recurrence TEXT NOT NULL DEFAULT 'none',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );

          CREATE TABLE IF NOT EXISTS calendar_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            icon TEXT
          );

          CREATE TABLE IF NOT EXISTS user_preferences (
            key TEXT PRIMARY KEY,
            value TEXT
          );
          ",
      )
      .map_err(|err| format!("Impossible de créer le schéma SQLite : {err}"))
  }

  fn ensure_initial_note(&self, conn: &Connection) -> Result<(), String> {
    let count: i64 = conn
      .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
      .map_err(|err| format!("Impossible de compter les notes : {err}"))?;
    if count == 0 {
      let mut note = Note::default();
      note.touch();
      self.insert_or_replace_note(conn, &note)?;
      self.save_active_id(conn, Some(note.id))?;
    } else {
      let active = self.fetch_active_note_id(conn)?;
      if active.is_none() {
        let first_id: Option<String> = conn
          .query_row("SELECT id FROM notes ORDER BY updated_at DESC LIMIT 1", [], |row| row.get(0))
          .optional()
          .map_err(|err| format!("Impossible de récupérer la note active : {err}"))?;
        if let Some(id_str) = first_id {
          self.save_active_id(conn, Uuid::parse_str(&id_str).ok())?;
        }
      }
    }
    Ok(())
  }

  fn ensure_budget_defaults(&self, conn: &Connection) -> Result<(), String> {
    // Default categories if none exist
    let cat_count: i64 = conn
      .query_row("SELECT COUNT(*) FROM budget_categories", [], |row| row.get(0))
      .map_err(|err| format!("Impossible de compter les catégories : {err}"))?;
    if cat_count == 0 {
      for cat in BudgetCategory::defaults() {
        conn.execute(
          "INSERT OR REPLACE INTO budget_categories (id, name, type, color, icon, parent_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
          params![cat.id, cat.name, cat.r#type, cat.color, cat.icon, cat.parent_id],
        ).map_err(|err| format!("Impossible d'insérer la catégorie par défaut : {err}"))?;
      }
    }
    // Default preferences
    let pref_count: i64 = conn
      .query_row("SELECT COUNT(*) FROM budget_preferences", [], |row| row.get(0))
      .map_err(|err| format!("Impossible de compter les préférences : {err}"))?;
    if pref_count == 0 {
      conn
        .execute("INSERT INTO budget_preferences (key, value) VALUES ('defaultCurrency', 'EUR')", [])
        .map_err(|err| format!("Impossible d'insérer les préférences par défaut : {err}"))?;
    }
    // Default calendar categories
    let cal_cat_count: i64 = conn
      .query_row("SELECT COUNT(*) FROM calendar_categories", [], |row| row.get(0))
      .map_err(|err| format!("Impossible de compter les catégories calendrier : {err}"))?;
    if cal_cat_count == 0 {
      for cat in CalendarCategory::defaults() {
        conn.execute(
          "INSERT OR REPLACE INTO calendar_categories (id, name, color, icon) VALUES (?1, ?2, ?3, ?4)",
          params![cat.id, cat.name, cat.color, cat.icon],
        ).map_err(|err| format!("Impossible d'insérer la catégorie calendrier par défaut : {err}"))?;
      }
    }
    Ok(())
  }

  // ── Note persistence ──

  fn insert_or_replace_note(&self, conn: &Connection, note: &Note) -> Result<(), String> {
    conn
      .execute(
        "INSERT OR REPLACE INTO notes (id, title, summary, status, tags, updated_at, tasks, sections, blocks)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
          note.id.to_string(),
          note.title,
          note.summary,
          note.status,
          serde_json::to_string(&note.tags).map_err(|err| format!("Tags invalides : {err}"))?,
          note.updated_at,
          serde_json::to_string(&note.tasks).map_err(|err| format!("Tasks invalides : {err}"))?,
          serde_json::to_string(&note.sections).map_err(|err| format!("Sections invalides : {err}"))?,
          serde_json::to_string(&note.blocks).map_err(|err| format!("Blocks invalides : {err}"))?,
        ],
      )
      .map_err(|err| format!("Impossible d'enregistrer la note : {err}"))?;
    Ok(())
  }

  fn load_app_data(&self, conn: &Connection) -> Result<AppData, String> {
    Ok(AppData {
      notes: self.fetch_notes(conn)?,
      active_note_id: self.fetch_active_note_id(conn)?,
      collections: self.fetch_collections(conn)?,
      templates: self.fetch_templates(conn)?,
    })
  }

  fn fetch_notes(&self, conn: &Connection) -> Result<Vec<Note>, String> {
    let mut stmt = conn
      .prepare("SELECT id, title, summary, status, tags, updated_at, tasks, sections, blocks FROM notes ORDER BY updated_at DESC")
      .map_err(|err| format!("Impossible de préparer la requête notes : {err}"))?;
    let rows = stmt
      .query_map([], |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        let summary: String = row.get(2)?;
        let status: String = row.get(3)?;
        let tags_json: String = row.get(4)?;
        let updated_at: i64 = row.get(5)?;
        let tasks_json: String = row.get(6)?;
        let sections_json: String = row.get(7)?;
        let blocks_json: String = row.get(8)?;
        Ok(Note {
          id: Uuid::parse_str(&id).unwrap_or_else(|_| Uuid::new_v4()),
          title, summary, status,
          tags: serde_json::from_str(&tags_json).unwrap_or_default(),
          updated_at,
          tasks: serde_json::from_str(&tasks_json).unwrap_or_default(),
          sections: serde_json::from_str(&sections_json).unwrap_or_default(),
          blocks: serde_json::from_str(&blocks_json).unwrap_or_default(),
        })
      })
      .map_err(|err| format!("Impossible de lire les notes : {err}"))?;
    let mut notes = Vec::new();
    for note in rows {
      notes.push(note.map_err(|err| format!("Erreur extraction note : {err}"))?);
    }
    Ok(notes)
  }

  fn fetch_note_by_id(&self, conn: &Connection, note_id: Uuid) -> Result<Note, String> {
    conn
      .prepare("SELECT id, title, summary, status, tags, updated_at, tasks, sections, blocks FROM notes WHERE id = ?1")
      .map_err(|err| format!("Impossible de préparer la requête note : {err}"))?
      .query_row(params![note_id.to_string()], |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        let summary: String = row.get(2)?;
        let status: String = row.get(3)?;
        let tags_json: String = row.get(4)?;
        let updated_at: i64 = row.get(5)?;
        let tasks_json: String = row.get(6)?;
        let sections_json: String = row.get(7)?;
        let blocks_json: String = row.get(8)?;
        Ok(Note {
          id: Uuid::parse_str(&id).unwrap_or(note_id),
          title, summary, status,
          tags: serde_json::from_str(&tags_json).unwrap_or_default(),
          updated_at,
          tasks: serde_json::from_str(&tasks_json).unwrap_or_default(),
          sections: serde_json::from_str(&sections_json).unwrap_or_default(),
          blocks: serde_json::from_str(&blocks_json).unwrap_or_default(),
        })
      })
      .map_err(|err| format!("Note introuvable : {err}"))
  }

  fn fetch_active_note_id(&self, conn: &Connection) -> Result<Option<Uuid>, String> {
    let value: Option<String> = conn
      .prepare("SELECT value FROM meta WHERE key = 'active_note_id'")
      .map_err(|err| format!("Impossible de préparer la requête meta : {err}"))?
      .query_row([], |row| row.get(0))
      .optional()
      .map_err(|err| format!("Impossible de lire la meta active : {err}"))?;
    Ok(value.and_then(|v| Uuid::parse_str(&v).ok()))
  }

  fn save_active_id(&self, conn: &Connection, note_id: Option<Uuid>) -> Result<(), String> {
    conn
      .execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('active_note_id', ?1)", [note_id.map(|id| id.to_string())])
      .map_err(|err| format!("Impossible d'enregistrer l'ID actif : {err}"))?;
    Ok(())
  }

  fn fetch_collections(&self, conn: &Connection) -> Result<Vec<Collection>, String> {
    let mut stmt = conn
      .prepare("SELECT id, tag, label, accent FROM collections ORDER BY rowid")
      .map_err(|err| format!("Impossible de préparer la requête collections : {err}"))?;
    let rows = stmt.query_map([], |row| {
      Ok(Collection { id: row.get(0)?, tag: row.get(1)?, label: row.get(2)?, accent: row.get(3)? })
    }).map_err(|err| format!("Impossible de lire les collections : {err}"))?;
    let mut items = Vec::new();
    for item in rows { items.push(item.map_err(|err| format!("Erreur collection : {err}"))?); }
    Ok(items)
  }

  fn fetch_templates(&self, conn: &Connection) -> Result<Vec<TemplateDefinition>, String> {
    let mut stmt = conn
      .prepare("SELECT id, icon, title, description, accent, payload FROM templates ORDER BY rowid")
      .map_err(|err| format!("Impossible de préparer la requête templates : {err}"))?;
    let rows = stmt.query_map([], |row| {
      let payload_json: String = row.get(5)?;
      Ok(TemplateDefinition {
        id: row.get(0)?, icon: row.get(1)?, title: row.get(2)?,
        description: row.get(3)?, accent: row.get(4)?,
        payload: serde_json::from_str(&payload_json).unwrap_or_default(),
      })
    }).map_err(|err| format!("Impossible de lire les templates : {err}"))?;
    let mut items = Vec::new();
    for item in rows { items.push(item.map_err(|err| format!("Erreur template : {err}"))?); }
    Ok(items)
  }

  // ── Public API: Notes ──

  pub fn snapshot(&self) -> AppData {
    let conn = self.conn().expect("Connexion SQLite");
    self.load_app_data(&conn).expect("Chargement AppData")
  }

  pub fn set_active_note(&mut self, note_id: Uuid) -> Result<(), String> {
    let conn = self.conn()?;
    self.fetch_note_by_id(&conn, note_id)?;
    self.save_active_id(&conn, Some(note_id))
  }

  pub fn create_note(&mut self, payload: NoteUpdatePayload) -> Result<Note, String> {
    let mut note = Note::default();
    note.apply_patch(&payload);
    note.touch();
    let conn = self.conn()?;
    self.insert_or_replace_note(&conn, &note)?;
    self.save_active_id(&conn, Some(note.id))?;
    Ok(note)
  }

  pub fn update_note(&mut self, note_id: Uuid, payload: NoteUpdatePayload) -> Result<Note, String> {
    let conn = self.conn()?;
    let mut note = self.fetch_note_by_id(&conn, note_id)?;
    note.apply_patch(&payload);
    note.touch();
    self.insert_or_replace_note(&conn, &note)?;
    Ok(note)
  }

  pub fn delete_note(&mut self, note_id: Uuid) -> Result<AppData, String> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![note_id.to_string()])
      .map_err(|err| format!("Impossible de supprimer la note : {err}"))?;
    let active = self.fetch_active_note_id(&conn)?;
    if active == Some(note_id) {
      let fallback: Option<String> = conn
        .query_row("SELECT id FROM notes ORDER BY updated_at DESC LIMIT 1", [], |row| row.get(0))
        .optional().map_err(|err| format!("Impossible de récupérer la note fallback : {err}"))?;
      self.save_active_id(&conn, fallback.and_then(|id| Uuid::parse_str(&id).ok()))?;
    }
    self.load_app_data(&conn)
  }

  pub fn duplicate_note(&mut self, note_id: Uuid) -> Result<Note, String> {
    let conn = self.conn()?;
    let original = self.fetch_note_by_id(&conn, note_id)?;
    let mut duplicate = original.duplicate();
    duplicate.touch();
    self.insert_or_replace_note(&conn, &duplicate)?;
    Ok(duplicate)
  }

  // ── Public API: Collections ──

  pub fn create_collection(&mut self, input: CollectionInput) -> Result<(), String> {
    let conn = self.conn()?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
      "INSERT OR REPLACE INTO collections (id, tag, label, accent) VALUES (?1, ?2, ?3, ?4)",
      params![id, input.tag, input.label, input.accent],
    ).map_err(|err| format!("Impossible de créer la collection : {err}"))?;
    Ok(())
  }

  pub fn update_collection(&mut self, collection_id: &str, input: CollectionInput) -> Result<(), String> {
    let conn = self.conn()?;
    conn.execute(
      "UPDATE collections SET tag = ?1, label = ?2, accent = ?3 WHERE id = ?4",
      params![input.tag, input.label, input.accent, collection_id],
    ).map_err(|err| format!("Impossible de mettre à jour la collection : {err}"))?;
    Ok(())
  }

  pub fn delete_collection(&mut self, collection_id: &str) -> Result<(), String> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM collections WHERE id = ?1", params![collection_id])
      .map_err(|err| format!("Impossible de supprimer la collection : {err}"))?;
    Ok(())
  }

  // ── Public API: Templates ──

  pub fn create_template(&mut self, input: TemplateInput) -> Result<(), String> {
    let conn = self.conn()?;
    let id = Uuid::new_v4().to_string();
    let payload_json = serde_json::to_string(&input.payload).map_err(|err| format!("Payload invalide : {err}"))?;
    conn.execute(
      "INSERT OR REPLACE INTO templates (id, icon, title, description, accent, payload) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      params![id, input.icon, input.title, input.description, input.accent, payload_json],
    ).map_err(|err| format!("Impossible de créer le template : {err}"))?;
    Ok(())
  }

  pub fn update_template(&mut self, template_id: &str, input: TemplateInput) -> Result<(), String> {
    let conn = self.conn()?;
    let payload_json = serde_json::to_string(&input.payload).map_err(|err| format!("Payload invalide : {err}"))?;
    conn.execute(
      "UPDATE templates SET icon = ?1, title = ?2, description = ?3, accent = ?4, payload = ?5 WHERE id = ?6",
      params![input.icon, input.title, input.description, input.accent, payload_json, template_id],
    ).map_err(|err| format!("Impossible de mettre à jour le template : {err}"))?;
    Ok(())
  }

  pub fn delete_template(&mut self, template_id: &str) -> Result<(), String> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM templates WHERE id = ?1", params![template_id])
      .map_err(|err| format!("Impossible de supprimer le template : {err}"))?;
    Ok(())
  }

  // ── Public API: Budget ──

  pub fn budget_snapshot(&self) -> BudgetData {
    let conn = self.conn().expect("Connexion SQLite");
    self.load_budget_data(&conn).expect("Chargement BudgetData")
  }

  fn load_budget_data(&self, conn: &Connection) -> Result<BudgetData, String> {
    Ok(BudgetData {
      accounts: self.fetch_budget_accounts(conn)?,
      transactions: self.fetch_budget_transactions(conn)?,
      categories: self.fetch_budget_categories(conn)?,
      preferences: self.fetch_budget_preferences(conn)?,
      bank_profiles: self.fetch_bank_profiles(conn)?,
      trip_plans: self.fetch_trip_plans(conn)?,
    })
  }

  fn fetch_budget_accounts(&self, conn: &Connection) -> Result<Vec<BudgetAccountRow>, String> {
    let mut stmt = conn
      .prepare("SELECT id, name, type, currency, balance, target, alert_threshold, icon, color, tags, description FROM budget_accounts ORDER BY rowid")
      .map_err(|err| format!("Requête budget_accounts : {err}"))?;
    let rows = stmt.query_map([], |row| {
      Ok(BudgetAccountRow {
        id: row.get(0)?, name: row.get(1)?, r#type: row.get(2)?, currency: row.get(3)?,
        balance: row.get(4)?, target: row.get(5)?, alert_threshold: row.get(6)?,
        icon: row.get(7)?, color: row.get(8)?, tags: row.get(9)?, description: row.get(10)?,
      })
    }).map_err(|err| format!("Lecture budget_accounts : {err}"))?;
    let mut items = Vec::new();
    for item in rows { items.push(item.map_err(|err| format!("Erreur compte : {err}"))?); }
    Ok(items)
  }

  fn fetch_budget_transactions(&self, conn: &Connection) -> Result<Vec<BudgetTransactionRow>, String> {
    let mut stmt = conn
      .prepare("SELECT id, account_id, type, amount, category_id, label, date, note_id, memo FROM budget_transactions ORDER BY date DESC")
      .map_err(|err| format!("Requête budget_transactions : {err}"))?;
    let rows = stmt.query_map([], |row| {
      Ok(BudgetTransactionRow {
        id: row.get(0)?, account_id: row.get(1)?, r#type: row.get(2)?,
        amount: row.get(3)?, category_id: row.get(4)?, label: row.get(5)?,
        date: row.get(6)?, note_id: row.get(7)?, memo: row.get(8)?,
      })
    }).map_err(|err| format!("Lecture budget_transactions : {err}"))?;
    let mut items = Vec::new();
    for item in rows { items.push(item.map_err(|err| format!("Erreur transaction : {err}"))?); }
    Ok(items)
  }

  fn fetch_budget_categories(&self, conn: &Connection) -> Result<Vec<BudgetCategory>, String> {
    let mut stmt = conn
      .prepare("SELECT id, name, type, color, icon, parent_id FROM budget_categories ORDER BY rowid")
      .map_err(|err| format!("Requête budget_categories : {err}"))?;
    let rows = stmt.query_map([], |row| {
      Ok(BudgetCategory { id: row.get(0)?, name: row.get(1)?, r#type: row.get(2)?, color: row.get(3)?, icon: row.get(4)?, parent_id: row.get(5)? })
    }).map_err(|err| format!("Lecture budget_categories : {err}"))?;
    let mut items = Vec::new();
    for item in rows { items.push(item.map_err(|err| format!("Erreur catégorie : {err}"))?); }
    Ok(items)
  }

  fn fetch_budget_preferences(&self, conn: &Connection) -> Result<BudgetPreferences, String> {
    let currency: Option<String> = conn
      .query_row("SELECT value FROM budget_preferences WHERE key = 'defaultCurrency'", [], |row| row.get(0))
      .optional()
      .map_err(|err| format!("Lecture préférences : {err}"))?;
    Ok(BudgetPreferences { default_currency: currency.unwrap_or_else(|| "EUR".to_string()) })
  }

  fn fetch_bank_profiles(&self, conn: &Connection) -> Result<Vec<BudgetBankProfileRow>, String> {
    let mut stmt = conn
      .prepare("SELECT id, bank_name, account_label, account_number, currency, balance, target, notes, created_at, updated_at FROM budget_bank_profiles ORDER BY rowid")
      .map_err(|err| format!("Requête bank_profiles : {err}"))?;
    let rows = stmt.query_map([], |row| {
      Ok(BudgetBankProfileRow {
        id: row.get(0)?, bank_name: row.get(1)?, account_label: row.get(2)?,
        account_number: row.get(3)?, currency: row.get(4)?, balance: row.get(5)?,
        target: row.get(6)?, notes: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)?,
      })
    }).map_err(|err| format!("Lecture bank_profiles : {err}"))?;
    let mut items = Vec::new();
    for item in rows { items.push(item.map_err(|err| format!("Erreur bank profile : {err}"))?); }
    Ok(items)
  }

  fn fetch_trip_plans(&self, conn: &Connection) -> Result<Vec<BudgetTripPlanRow>, String> {
    let mut stmt = conn
      .prepare("SELECT id, title, start_date, end_date, duration_days, transports, lodging, activities, alerts, linked_bank_profile_id, estimated_total, notes, created_at, updated_at FROM budget_trip_plans ORDER BY rowid")
      .map_err(|err| format!("Requête trip_plans : {err}"))?;
    let rows = stmt.query_map([], |row| {
      let transports_json: String = row.get(5)?;
      let lodging_json: Option<String> = row.get(6)?;
      let activities_json: String = row.get(7)?;
      let alerts_json: String = row.get(8)?;
      Ok(BudgetTripPlanRow {
        id: row.get(0)?, title: row.get(1)?, start_date: row.get(2)?, end_date: row.get(3)?,
        duration_days: row.get(4)?,
        transports: serde_json::from_str(&transports_json).unwrap_or_default(),
        lodging: lodging_json.and_then(|j| serde_json::from_str(&j).ok()),
        activities: serde_json::from_str(&activities_json).unwrap_or_default(),
        alerts: serde_json::from_str(&alerts_json).unwrap_or_default(),
        linked_bank_profile_id: row.get(9)?, estimated_total: row.get(10)?,
        notes: row.get(11)?, created_at: row.get(12)?, updated_at: row.get(13)?,
      })
    }).map_err(|err| format!("Lecture trip_plans : {err}"))?;
    let mut items = Vec::new();
    for item in rows { items.push(item.map_err(|err| format!("Erreur trip plan : {err}"))?); }
    Ok(items)
  }

  pub fn create_budget_account(&mut self, input: BudgetAccountInput) -> Result<(), String> {
    let conn = self.conn()?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
      "INSERT INTO budget_accounts (id, name, type, currency, balance, target, alert_threshold, icon, color, tags, description) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10)",
      params![id, input.name, input.r#type, input.currency, input.target, input.alert_threshold, input.icon, input.color, input.tags, input.description],
    ).map_err(|err| format!("Impossible de créer le compte : {err}"))?;
    Ok(())
  }

  pub fn update_budget_account(&mut self, account_id: &str, input: BudgetAccountInput) -> Result<(), String> {
    let conn = self.conn()?;
    conn.execute(
      "UPDATE budget_accounts SET name = ?1, type = ?2, currency = ?3, target = ?4, alert_threshold = ?5, icon = ?6, color = ?7, tags = ?8, description = ?9 WHERE id = ?10",
      params![input.name, input.r#type, input.currency, input.target, input.alert_threshold, input.icon, input.color, input.tags, input.description, account_id],
    ).map_err(|err| format!("Impossible de mettre à jour le compte : {err}"))?;
    Ok(())
  }

  pub fn delete_budget_account(&mut self, account_id: &str) -> Result<(), String> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM budget_transactions WHERE account_id = ?1", params![account_id])
      .map_err(|err| format!("Impossible de supprimer les transactions : {err}"))?;
    conn.execute("DELETE FROM budget_accounts WHERE id = ?1", params![account_id])
      .map_err(|err| format!("Impossible de supprimer le compte : {err}"))?;
    Ok(())
  }

  pub fn record_budget_transaction(&mut self, input: BudgetTransactionInput) -> Result<(), String> {
    let conn = self.conn()?;
    let id = Uuid::new_v4().to_string();
    // Update account balance
    let current_balance: f64 = conn
      .query_row("SELECT balance FROM budget_accounts WHERE id = ?1", params![input.account_id], |row| row.get(0))
      .map_err(|err| format!("Compte introuvable : {err}"))?;
    let sign = if input.r#type == "expense" { -1.0 } else { 1.0 };
    let new_balance = current_balance + sign * input.amount;
    conn.execute("UPDATE budget_accounts SET balance = ?1 WHERE id = ?2", params![new_balance, input.account_id])
      .map_err(|err| format!("Impossible de mettre à jour le solde : {err}"))?;
    conn.execute(
      "INSERT INTO budget_transactions (id, account_id, type, amount, category_id, label, date, note_id, memo) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
      params![id, input.account_id, input.r#type, input.amount, input.category_id, input.label, input.date, input.note_id, input.memo],
    ).map_err(|err| format!("Impossible d'enregistrer la transaction : {err}"))?;
    Ok(())
  }

  pub fn update_budget_transaction(&mut self, transaction_id: &str, input: BudgetTransactionInput) -> Result<(), String> {
    let conn = self.conn()?;
    // Revert old transaction effect
    let (old_account_id, old_type, old_amount): (String, String, f64) = conn
      .query_row("SELECT account_id, type, amount FROM budget_transactions WHERE id = ?1", params![transaction_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
      .map_err(|err| format!("Transaction introuvable : {err}"))?;
    let old_sign = if old_type == "expense" { -1.0 } else { 1.0 };
    let current_balance: f64 = conn
      .query_row("SELECT balance FROM budget_accounts WHERE id = ?1", params![old_account_id], |row| row.get(0))
      .map_err(|err| format!("Compte introuvable : {err}"))?;
    conn.execute("UPDATE budget_accounts SET balance = ?1 WHERE id = ?2", params![current_balance - old_sign * old_amount, old_account_id])
      .map_err(|err| format!("Impossible de rembourser le solde : {err}"))?;
    // Apply new transaction
    let new_sign = if input.r#type == "expense" { -1.0 } else { 1.0 };
    let new_balance: f64 = conn
      .query_row("SELECT balance FROM budget_accounts WHERE id = ?1", params![input.account_id], |row| row.get(0))
      .map_err(|err| format!("Compte introuvable : {err}"))?;
    conn.execute("UPDATE budget_accounts SET balance = ?1 WHERE id = ?2", params![new_balance + new_sign * input.amount, input.account_id])
      .map_err(|err| format!("Impossible de mettre à jour le solde : {err}"))?;
    conn.execute(
      "UPDATE budget_transactions SET account_id = ?1, type = ?2, amount = ?3, category_id = ?4, label = ?5, date = ?6, note_id = ?7, memo = ?8 WHERE id = ?9",
      params![input.account_id, input.r#type, input.amount, input.category_id, input.label, input.date, input.note_id, input.memo, transaction_id],
    ).map_err(|err| format!("Impossible de mettre à jour la transaction : {err}"))?;
    Ok(())
  }

  pub fn delete_budget_transaction(&mut self, transaction_id: &str) -> Result<(), String> {
    let conn = self.conn()?;
    let (account_id, tx_type, amount): (String, String, f64) = conn
      .query_row("SELECT account_id, type, amount FROM budget_transactions WHERE id = ?1", params![transaction_id], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
      .map_err(|err| format!("Transaction introuvable : {err}"))?;
    let sign = if tx_type == "expense" { -1.0 } else { 1.0 };
    let current_balance: f64 = conn
      .query_row("SELECT balance FROM budget_accounts WHERE id = ?1", params![account_id], |row| row.get(0))
      .map_err(|err| format!("Compte introuvable : {err}"))?;
    conn.execute("UPDATE budget_accounts SET balance = ?1 WHERE id = ?2", params![current_balance - sign * amount, account_id])
      .map_err(|err| format!("Impossible de rembourser le solde : {err}"))?;
    conn.execute("DELETE FROM budget_transactions WHERE id = ?1", params![transaction_id])
      .map_err(|err| format!("Impossible de supprimer la transaction : {err}"))?;
    Ok(())
  }

  pub fn link_budget_transaction_note(&mut self, transaction_id: &str, note_id: Option<&str>) -> Result<(), String> {
    let conn = self.conn()?;
    conn.execute("UPDATE budget_transactions SET note_id = ?1 WHERE id = ?2", params![note_id, transaction_id])
      .map_err(|err| format!("Impossible de lier la transaction : {err}"))?;
    Ok(())
  }

  pub fn save_budget_trip_plan(&mut self, input: BudgetTripPlanInput) -> Result<(), String> {
    let conn = self.conn()?;
    let now = Utc::now().to_rfc3339();
    let transports_json = serde_json::to_string(&input.transports).map_err(|err| format!("Transports invalides : {err}"))?;
    let lodging_json = input.lodging.as_ref().map(|l| serde_json::to_string(l)).transpose().map_err(|err| format!("Lodging invalide : {err}"))?;
    let activities_json = serde_json::to_string(&input.activities).map_err(|err| format!("Activities invalides : {err}"))?;
    let alerts_json = serde_json::to_string(&input.alerts).map_err(|err| format!("Alerts invalides : {err}"))?;

    if let Some(ref id) = input.id {
      conn.execute(
        "UPDATE budget_trip_plans SET title = ?1, start_date = ?2, end_date = ?3, duration_days = ?4, transports = ?5, lodging = ?6, activities = ?7, alerts = ?8, linked_bank_profile_id = ?9, estimated_total = ?10, notes = ?11, updated_at = ?12 WHERE id = ?13",
        params![input.title, input.start_date, input.end_date, input.duration_days, transports_json, lodging_json, activities_json, alerts_json, input.linked_bank_profile_id, input.estimated_total, input.notes, now, id],
      ).map_err(|err| format!("Impossible de mettre à jour le plan : {err}"))?;
    } else {
      let id = Uuid::new_v4().to_string();
      conn.execute(
        "INSERT INTO budget_trip_plans (id, title, start_date, end_date, duration_days, transports, lodging, activities, alerts, linked_bank_profile_id, estimated_total, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![id, input.title, input.start_date, input.end_date, input.duration_days, transports_json, lodging_json, activities_json, alerts_json, input.linked_bank_profile_id, input.estimated_total, input.notes, now, now],
      ).map_err(|err| format!("Impossible de créer le plan : {err}"))?;
    }
    Ok(())
  }

  pub fn delete_budget_trip_plan(&mut self, plan_id: &str) -> Result<(), String> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM budget_trip_plans WHERE id = ?1", params![plan_id])
      .map_err(|err| format!("Impossible de supprimer le plan : {err}"))?;
    Ok(())
  }

  pub fn create_bank_profile(&mut self, input: BudgetBankProfileInput) -> Result<(), String> {
    let conn = self.conn()?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
      "INSERT INTO budget_bank_profiles (id, bank_name, account_label, account_number, currency, balance, target, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
      params![id, input.bank_name, input.account_label, input.account_number, input.currency, input.balance, input.target, input.notes, now, now],
    ).map_err(|err| format!("Impossible de créer le profil bancaire : {err}"))?;
    Ok(())
  }

  pub fn update_bank_profile(&mut self, profile_id: &str, input: BudgetBankProfileInput) -> Result<(), String> {
    let conn = self.conn()?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
      "UPDATE budget_bank_profiles SET bank_name = ?1, account_label = ?2, account_number = ?3, currency = ?4, balance = ?5, target = ?6, notes = ?7, updated_at = ?8 WHERE id = ?9",
      params![input.bank_name, input.account_label, input.account_number, input.currency, input.balance, input.target, input.notes, now, profile_id],
    ).map_err(|err| format!("Impossible de mettre à jour le profil bancaire : {err}"))?;
    Ok(())
  }

  pub fn delete_bank_profile(&mut self, profile_id: &str) -> Result<(), String> {
    let conn = self.conn()?;
    conn.execute("DELETE FROM budget_bank_profiles WHERE id = ?1", params![profile_id])
      .map_err(|err| format!("Impossible de supprimer le profil bancaire : {err}"))?;
    Ok(())
  }
}

// ═══════════════════════════════════════════════════
// Note types (unchanged from original)
// ═══════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
  pub notes: Vec<Note>,
  pub active_note_id: Option<Uuid>,
  #[serde(default)]
  pub collections: Vec<Collection>,
  #[serde(default)]
  pub templates: Vec<TemplateDefinition>,
}

impl Default for AppData {
  fn default() -> Self {
    Self { notes: Vec::new(), active_note_id: None, collections: Vec::new(), templates: Vec::new() }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
  pub id: Uuid,
  pub title: String,
  pub summary: String,
  pub status: String,
  pub tags: Vec<String>,
  pub updated_at: i64,
  pub tasks: Vec<Task>,
  pub sections: Sections,
  pub blocks: Vec<Block>,
}

impl Default for Note {
  fn default() -> Self {
    Self {
      id: Uuid::new_v4(),
      title: "Plan d'optimisation des listes de tâches".into(),
      summary: "Ce document présente un plan stratégique pour optimiser les pratiques actuelles de listes de tâches dans l'organisation.".into(),
      status: "brouillon".into(),
      tags: Vec::new(),
      updated_at: Utc::now().timestamp_millis(),
      tasks: Vec::new(),
      sections: Sections::default(),
      blocks: Vec::new(),
    }
  }
}

impl Note {
  pub fn touch(&mut self) { self.updated_at = Utc::now().timestamp_millis(); }

  pub fn apply_patch(&mut self, patch: &NoteUpdatePayload) {
    if let Some(title) = &patch.title { self.title = title.trim().to_string(); }
    if let Some(summary) = &patch.summary { self.summary = summary.trim().to_string(); }
    if let Some(status) = &patch.status { self.status = status.to_string(); }
    if let Some(tags) = &patch.tags { self.tags = tags.iter().map(|t| t.trim().to_string()).filter(|t| !t.is_empty()).collect(); }
    if let Some(tasks) = &patch.tasks { self.tasks = tasks.clone(); }
    if let Some(sections) = &patch.sections { self.sections = sections.clone(); }
    if let Some(blocks) = &patch.blocks { self.blocks = blocks.clone(); }
  }

  pub fn duplicate(&self) -> Note {
    let mut clone = self.clone();
    clone.id = Uuid::new_v4();
    let base = if self.title.is_empty() { "Sans titre".to_string() } else { self.title.clone() };
    clone.title = format!("{base} (copie)");
    clone
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Sections { pub problem: String, pub standardization: String, pub prioritization: String, pub snippet: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task { pub id: Uuid, pub label: String, pub done: bool }

impl Default for Task {
  fn default() -> Self { Self { id: Uuid::new_v4(), label: String::new(), done: false } }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Block { pub id: Uuid, #[serde(rename = "type")] pub kind: String, #[serde(default)] pub data: Value }

impl Default for Block {
  fn default() -> Self { Self { id: Uuid::new_v4(), kind: "text".into(), data: Value::Null } }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NoteUpdatePayload {
  pub title: Option<String>, pub summary: Option<String>, pub status: Option<String>,
  pub tags: Option<Vec<String>>, pub tasks: Option<Vec<Task>>,
  pub sections: Option<Sections>, pub blocks: Option<Vec<Block>>,
}

// ═══════════════════════════════════════════════════
// Collection & Template types
// ═══════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Collection { pub id: String, pub tag: String, pub label: String, pub accent: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionInput { pub tag: String, pub label: String, pub accent: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateDefinition {
  pub id: String, pub icon: String, pub title: String,
  pub description: String, pub accent: String, pub payload: NoteUpdatePayload,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateInput {
  pub icon: String, pub title: String, pub description: String,
  pub accent: String, pub payload: NoteUpdatePayload,
}

// ═══════════════════════════════════════════════════
// Budget types
// ═══════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetData {
  pub accounts: Vec<BudgetAccountRow>,
  pub transactions: Vec<BudgetTransactionRow>,
  pub categories: Vec<BudgetCategory>,
  pub preferences: BudgetPreferences,
  pub bank_profiles: Vec<BudgetBankProfileRow>,
  pub trip_plans: Vec<BudgetTripPlanRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetAccountRow {
  pub id: String, pub name: String, pub r#type: String,
  pub currency: String, pub balance: f64,
  pub target: Option<f64>, pub alert_threshold: Option<f64>,
  pub icon: Option<String>, pub color: Option<String>,
  pub tags: Option<String>, pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetTransactionRow {
  pub id: String, pub account_id: String, pub r#type: String,
  pub amount: f64, pub category_id: String, pub label: String,
  pub date: String, pub note_id: Option<String>, pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetCategory {
  pub id: String, pub name: String, pub r#type: String,
  pub color: String, pub icon: Option<String>, pub parent_id: Option<String>,
}

impl BudgetCategory {
  fn defaults() -> Vec<Self> {
    vec![
      Self { id: "cat-1".into(), name: "Salaire".into(), r#type: "income".into(), color: "bg-emerald-50 text-emerald-700".into(), icon: Some("💼".into()), parent_id: None },
      Self { id: "cat-2".into(), name: "Hébergement".into(), r#type: "expense".into(), color: "bg-indigo-50 text-indigo-700".into(), icon: Some("🏨".into()), parent_id: Some("vacances".into()) },
      Self { id: "cat-3".into(), name: "Transport".into(), r#type: "expense".into(), color: "bg-sky-50 text-sky-600".into(), icon: Some("✈️".into()), parent_id: Some("vacances".into()) },
      Self { id: "cat-4".into(), name: "Frais bancaires".into(), r#type: "expense".into(), color: "bg-rose-50 text-rose-600".into(), icon: Some("🏦".into()), parent_id: None },
      Self { id: "cat-5".into(), name: "Intérêts".into(), r#type: "income".into(), color: "bg-amber-50 text-amber-600".into(), icon: Some("📈".into()), parent_id: None },
    ]
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetPreferences { pub default_currency: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetBankProfileRow {
  pub id: String, pub bank_name: String, pub account_label: String,
  pub account_number: Option<String>, pub currency: String, pub balance: f64,
  pub target: Option<f64>, pub notes: Option<String>,
  pub created_at: String, pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetTripPlanRow {
  pub id: String, pub title: String, pub start_date: String,
  pub end_date: String, pub duration_days: i32,
  pub transports: Value, pub lodging: Option<Value>,
  pub activities: Value, pub alerts: Value,
  pub linked_bank_profile_id: Option<String>,
  pub estimated_total: f64, pub notes: Option<String>,
  pub created_at: String, pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetAccountInput {
  pub name: String, pub r#type: String, pub currency: String,
  pub target: Option<f64>, pub alert_threshold: Option<f64>,
  pub icon: Option<String>, pub color: Option<String>,
  pub tags: Option<String>, pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetTransactionInput {
  pub account_id: String, pub r#type: String, pub amount: f64,
  pub category_id: String, pub label: String, pub date: String,
  pub note_id: Option<String>, pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetTripPlanInput {
  pub id: Option<String>, pub title: String,
  pub start_date: String, pub end_date: String,
  pub duration_days: i32, pub transports: Value,
  pub lodging: Option<Value>, pub activities: Value,
  pub alerts: Value, pub linked_bank_profile_id: Option<String>,
  pub estimated_total: f64, pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetBankProfileInput {
  pub bank_name: String, pub account_label: String,
  pub account_number: Option<String>, pub currency: String,
  pub balance: f64, pub target: Option<f64>, pub notes: Option<String>,
}

// ═══════════════════════════════════════════════════
// Calendar types
// ═══════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarCategory {
  pub id: String, pub name: String, pub color: String, pub icon: Option<String>,
}

impl CalendarCategory {
  fn defaults() -> Vec<Self> {
    vec![
      Self { id: "sage".into(), name: "Personnel".into(), color: "#95a392".into(), icon: Some("🏠".into()) },
      Self { id: "clay".into(), name: "Travail".into(), color: "#c9b0a1".into(), icon: Some("💼".into()) },
      Self { id: "coral".into(), name: "Important".into(), color: "#FF8B7B".into(), icon: Some("⭐".into()) },
      Self { id: "mint".into(), name: "Meeting".into(), color: "#A8E6CF".into(), icon: Some("👥".into()) },
      Self { id: "sky".into(), name: "Loisirs".into(), color: "#A8D8EA".into(), icon: Some("🎯".into()) },
    ]
  }
}

// ═══════════════════════════════════════════════════
// User Preferences
// ═══════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
  pub display_name: Option<String>,
  pub avatar_path: Option<String>,
  pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferences {
  pub language: String,
  pub date_format: String,
  pub week_starts_on: String, // "monday" | "sunday"
  pub default_note_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
  pub profile: UserProfile,
  pub preferences: AppPreferences,
  pub notion_config: Option<NotionConfig>,
}

impl Store {
  pub fn get_user_preferences(&self) -> Result<UserPreferences, String> {
    let conn = self.conn()?;
    let profile_json: Option<String> = conn
      .query_row("SELECT value FROM user_preferences WHERE key = 'profile'", [], |row| row.get(0))
      .optional()
      .map_err(|e| format!("Lecture profil: {e}"))?;
    let prefs_json: Option<String> = conn
      .query_row("SELECT value FROM user_preferences WHERE key = 'preferences'", [], |row| row.get(0))
      .optional()
      .map_err(|e| format!("Lecture préférences: {e}"))?;
    let notion_json: Option<String> = conn
      .query_row("SELECT value FROM user_preferences WHERE key = 'notion_config'", [], |row| row.get(0))
      .optional()
      .map_err(|e| format!("Lecture notion config: {e}"))?;

    let profile = profile_json
      .and_then(|s| serde_json::from_str(&s).ok())
      .unwrap_or_default();
    let preferences = prefs_json
      .and_then(|s| serde_json::from_str(&s).ok())
      .unwrap_or_else(|| AppPreferences {
        language: "fr".into(),
        date_format: "DD/MM/YYYY".into(),
        week_starts_on: "monday".into(),
        default_note_status: "draft".into(),
      });
    let notion_config = notion_json
      .and_then(|s| serde_json::from_str(&s).ok());

    Ok(UserPreferences { profile, preferences, notion_config })
  }

  pub fn set_user_preferences(&self, prefs: UserPreferences) -> Result<(), String> {
    let mut conn = self.conn()?;
    let tx = conn.transaction().map_err(|e| format!("Début transaction: {e}"))?;
    
    let profile_json = serde_json::to_string(&prefs.profile)
      .map_err(|e| format!("Sérialisation profil: {e}"))?;
    let prefs_json = serde_json::to_string(&prefs.preferences)
      .map_err(|e| format!("Sérialisation préférences: {e}"))?;

    tx.execute(
      "INSERT INTO user_preferences (key, value) VALUES ('profile', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [&profile_json],
    ).map_err(|e| format!("Sauvegarde profil: {e}"))?;

    tx.execute(
      "INSERT INTO user_preferences (key, value) VALUES ('preferences', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [&prefs_json],
    ).map_err(|e| format!("Sauvegarde préférences: {e}"))?;

    if let Some(ref notion) = prefs.notion_config {
      let notion_json = serde_json::to_string(notion)
        .map_err(|e| format!("Sérialisation notion config: {e}"))?;
      tx.execute(
        "INSERT INTO user_preferences (key, value) VALUES ('notion_config', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [&notion_json],
      ).map_err(|e| format!("Sauvegarde notion config: {e}"))?;
    } else {
      // Remove notion_config if None
      tx.execute(
        "DELETE FROM user_preferences WHERE key = 'notion_config'",
        [],
      ).map_err(|e| format!("Suppression notion config: {e}"))?;
    }

    tx.commit().map_err(|e| format!("Commit transaction: {e}"))?;
    Ok(())
  }
}
