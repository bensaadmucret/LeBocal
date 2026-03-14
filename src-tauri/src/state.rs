use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{self, Value};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const DB_FILE: &str = "le-bocal-prod.db";

pub type SharedStore = Arc<Mutex<Store>>;

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
          );",
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
          .query_row(
            "SELECT id FROM notes ORDER BY updated_at DESC LIMIT 1",
            [],
            |row| row.get(0),
          )
          .optional()
          .map_err(|err| format!("Impossible de récupérer la note active : {err}"))?;
        if let Some(id_str) = first_id {
          self.save_active_id(conn, Uuid::parse_str(&id_str).ok())?;
        }
      }
    }
    Ok(())
  }

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
        let tags = serde_json::from_str(&tags_json).unwrap_or_default();
        let tasks = serde_json::from_str(&tasks_json).unwrap_or_default();
        let sections = serde_json::from_str(&sections_json).unwrap_or_default();
        let blocks = serde_json::from_str(&blocks_json).unwrap_or_default();
        Ok(Note {
          id: Uuid::parse_str(&id).unwrap_or_else(|_| Uuid::new_v4()),
          title,
          summary,
          status,
          tags,
          updated_at,
          tasks,
          sections,
          blocks,
        })
      })
      .map_err(|err| format!("Impossible de lire les notes : {err}"))?;
    let mut notes = Vec::new();
    for note in rows {
      notes.push(note.map_err(|err| format!("Erreur lors de l'extraction d'une note : {err}"))?);
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
        let tags = serde_json::from_str(&tags_json).unwrap_or_default();
        let tasks = serde_json::from_str(&tasks_json).unwrap_or_default();
        let sections = serde_json::from_str(&sections_json).unwrap_or_default();
        let blocks = serde_json::from_str(&blocks_json).unwrap_or_default();
        Ok(Note {
          id: Uuid::parse_str(&id).unwrap_or(note_id),
          title,
          summary,
          status,
          tags,
          updated_at,
          tasks,
          sections,
          blocks,
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
    Ok(match value {
      Some(v) => Uuid::parse_str(&v).ok(),
      None => None,
    })
  }

  fn save_active_id(&self, conn: &Connection, note_id: Option<Uuid>) -> Result<(), String> {
    conn
      .execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('active_note_id', ?1)",
        [note_id.map(|id| id.to_string())],
      )
      .map_err(|err| format!("Impossible d'enregistrer l'ID actif : {err}"))?;
    Ok(())
  }

  #[allow(dead_code)]
  fn notes_count(&self, conn: &Connection) -> Result<i64, String> {
    conn
      .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
      .map_err(|err| format!("Impossible de compter les notes : {err}"))
  }

  pub fn snapshot(&self) -> AppData {
    let conn = self.conn().expect("Connexion SQLite" );
    self.load_app_data(&conn).expect("Chargement AppData")
  }

  #[allow(dead_code)]
  pub fn list_notes(&self) -> Vec<Note> {
    let conn = self.conn().expect("Connexion SQLite");
    self.fetch_notes(&conn).expect("Liste des notes")
  }

  #[allow(dead_code)]
  pub fn get_note(&self, note_id: &Uuid) -> Option<Note> {
    let conn = self.conn().ok()?;
    self.fetch_note_by_id(&conn, *note_id).ok()
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
    conn
      .execute("DELETE FROM notes WHERE id = ?1", params![note_id.to_string()])
      .map_err(|err| format!("Impossible de supprimer la note : {err}"))?;
    let active = self.fetch_active_note_id(&conn)?;
    if active == Some(note_id) {
      let fallback: Option<String> = conn
        .query_row(
          "SELECT id FROM notes ORDER BY updated_at DESC LIMIT 1",
          [],
          |row| row.get(0),
        )
        .optional()
        .map_err(|err| format!("Impossible de récupérer la note fallback : {err}"))?;
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

}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
  pub notes: Vec<Note>,
  pub active_note_id: Option<Uuid>,
}

impl Default for AppData {
  fn default() -> Self {
    Self {
      notes: Vec::new(),
      active_note_id: None,
    }
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
  pub fn touch(&mut self) {
    self.updated_at = Utc::now().timestamp_millis();
  }

  pub fn apply_patch(&mut self, patch: &NoteUpdatePayload) {
    if let Some(title) = &patch.title {
      self.title = title.trim().to_string();
    }
    if let Some(summary) = &patch.summary {
      self.summary = summary.trim().to_string();
    }
    if let Some(status) = &patch.status {
      self.status = status.to_string();
    }
    if let Some(tags) = &patch.tags {
      self.tags = tags
        .iter()
        .map(|tag| tag.trim().to_string())
        .filter(|tag| !tag.is_empty())
        .collect();
    }
    if let Some(tasks) = &patch.tasks {
      self.tasks = tasks.clone();
    }
    if let Some(sections) = &patch.sections {
      self.sections = sections.clone();
    }
    if let Some(blocks) = &patch.blocks {
      self.blocks = blocks.clone();
    }
  }

  pub fn duplicate(&self) -> Note {
    let mut clone = self.clone();
    clone.id = Uuid::new_v4();
    let base = if self.title.is_empty() {
      "Sans titre".to_string()
    } else {
      self.title.clone()
    };
    clone.title = format!("{base} (copie)");
    clone
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Sections {
  pub problem: String,
  pub standardization: String,
  pub prioritization: String,
  pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
  pub id: Uuid,
  pub label: String,
  pub done: bool,
}

impl Default for Task {
  fn default() -> Self {
    Self {
      id: Uuid::new_v4(),
      label: String::new(),
      done: false,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
  pub id: Uuid,
  #[serde(rename = "type")]
  pub kind: String,
  #[serde(default)]
  pub data: Value,
}

impl Default for Block {
  fn default() -> Self {
    Self {
      id: Uuid::new_v4(),
      kind: "text".into(),
      data: Value::Null,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NoteUpdatePayload {
  pub title: Option<String>,
  pub summary: Option<String>,
  pub status: Option<String>,
  pub tags: Option<Vec<String>>,
  pub tasks: Option<Vec<Task>>,
  pub sections: Option<Sections>,
  pub blocks: Option<Vec<Block>>,
}
