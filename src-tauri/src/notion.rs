use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::Mutex;

const NOTION_API_BASE: &str = "https://api.notion.com/v1";
const NOTION_VERSION: &str = "2022-06-28";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionConfig {
  pub access_token: String,
  pub workspace_name: Option<String>,
  pub connected_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NotionSyncStatus {
  pub last_sync_at: Option<String>,
  pub sync_count: i32,
  pub errors: Vec<String>,
  pub is_syncing: bool,
}

pub type SharedNotionClient = Arc<Mutex<NotionClient>>;

#[derive(Debug, Clone)]
pub struct NotionClient {
  config: Option<NotionConfig>,
  http: Client,
  status: NotionSyncStatus,
}

impl NotionClient {
  pub fn new() -> Self {
    Self {
      config: None,
      http: Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_default(),
      status: NotionSyncStatus::default(),
    }
  }

  pub fn with_config(config: NotionConfig) -> Self {
    Self {
      config: Some(config),
      http: Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap_or_default(),
      status: NotionSyncStatus::default(),
    }
  }

  // ── Connection ──

  #[allow(dead_code)]
  pub fn is_connected(&self) -> bool {
    self.config.is_some()
  }

  #[allow(dead_code)]
  pub fn config(&self) -> Option<&NotionConfig> {
    self.config.as_ref()
  }

  pub fn set_config(&mut self, config: NotionConfig) {
    self.config = Some(config);
  }

  pub fn disconnect(&mut self) {
    self.config = None;
    self.status = NotionSyncStatus::default();
  }

  pub fn status(&self) -> &NotionSyncStatus {
    &self.status
  }

  // ── API calls ──

  fn auth_header(&self) -> Option<String> {
    self.config.as_ref().map(|c| {
      format!("Bearer {}", c.access_token)
    })
  }

  /// Verify the token works by fetching the user info
  pub async fn verify_connection(&self) -> Result<NotionUserInfo, String> {
    let auth = self.auth_header().ok_or("Non connecté à Notion")?;
    let resp = self.http
      .get(format!("{}/users/me", NOTION_API_BASE))
      .header("Authorization", &auth)
      .header("Notion-Version", NOTION_VERSION)
      .send()
      .await
      .map_err(|e| format!("Erreur réseau : {e}"))?;

    if !resp.status().is_success() {
      let status = resp.status();
      let body = resp.text().await.unwrap_or_default();
      return Err(format!("Notion API error {} : {}", status, body));
    }

    resp.json::<NotionUserInfo>().await.map_err(|e| format!("Réponse invalide : {e}"))
  }

  /// Search for pages/databases in the workspace
  pub async fn search(&self, query: &str) -> Result<Vec<NotionSearchResult>, String> {
    let auth = self.auth_header().ok_or("Non connecté à Notion")?;
    let body = json!({
      "query": query,
      "filter": { "property": "object", "value": "page" }
    });

    let resp = self.http
      .post(format!("{}/search", NOTION_API_BASE))
      .header("Authorization", &auth)
      .header("Notion-Version", NOTION_VERSION)
      .header("Content-Type", "application/json")
      .json(&body)
      .send()
      .await
      .map_err(|e| format!("Erreur réseau : {e}"))?;

    if !resp.status().is_success() {
      let status = resp.status();
      let body = resp.text().await.unwrap_or_default();
      return Err(format!("Notion API error {} : {}", status, body));
    }

    let search_resp: Value = resp.json().await.map_err(|e| format!("Réponse invalide : {e}"))?;
    let results = search_resp["results"]
      .as_array()
      .map(|arr| {
        arr.iter().filter_map(|item| {
          let id = item["id"].as_str()?.to_string();
          let title = item["properties"]["title"]["title"]
            .as_array()
            .map(|t| t.iter().filter_map(|p| p["plain_text"].as_str()).collect::<Vec<_>>().join(""))
            .unwrap_or_default();
          let url = item["url"].as_str()?.to_string();
          let icon = item["icon"]["emoji"].as_str().map(|s| s.to_string());
          let parent_type = item["parent"]["type"].as_str().unwrap_or("unknown").to_string();
          Some(NotionSearchResult { id, title, url, icon, parent_type })
        }).collect::<Vec<_>>()
      })
      .unwrap_or_default();

    Ok(results)
  }

  /// Create a new page in Notion
  pub async fn create_page(&self, parent_id: &str, title: &str, content: &str) -> Result<NotionPage, String> {
    let auth = self.auth_header().ok_or("Non connecté à Notion")?;

    let children = markdown_to_notion_blocks(content);

    let body = json!({
      "parent": { "page_id": parent_id },
      "properties": {
        "title": { "title": [{ "text": { "content": title } }] }
      },
      "children": children
    });

    let resp = self.http
      .post(format!("{}/pages", NOTION_API_BASE))
      .header("Authorization", &auth)
      .header("Notion-Version", NOTION_VERSION)
      .header("Content-Type", "application/json")
      .json(&body)
      .send()
      .await
      .map_err(|e| format!("Erreur réseau : {e}"))?;

    if !resp.status().is_success() {
      let status = resp.status();
      let body = resp.text().await.unwrap_or_default();
      return Err(format!("Notion API error {} : {}", status, body));
    }

    let page: Value = resp.json().await.map_err(|e| format!("Réponse invalide : {e}"))?;
    Ok(NotionPage {
      id: page["id"].as_str().unwrap_or_default().to_string(),
      url: page["url"].as_str().unwrap_or_default().to_string(),
    })
  }

  /// Update an existing page's content
  #[allow(dead_code)]
  pub async fn update_page_content(&self, page_id: &str, content: &str) -> Result<(), String> {
    let auth = self.auth_header().ok_or("Non connecté à Notion")?;

    // First, delete existing blocks
    let existing = self.fetch_page_blocks(page_id).await?;
    for block in &existing {
      let _ = self.http
        .delete(format!("{}/blocks/{}", NOTION_API_BASE, block))
        .header("Authorization", &auth)
        .header("Notion-Version", NOTION_VERSION)
        .send()
        .await;
    }

    // Then append new blocks
    let children = markdown_to_notion_blocks(content);
    if children.is_empty() { return Ok(()); }

    let body = json!({ "children": children });
    let resp = self.http
      .patch(format!("{}/blocks/{}/children", NOTION_API_BASE, page_id))
      .header("Authorization", &auth)
      .header("Notion-Version", NOTION_VERSION)
      .header("Content-Type", "application/json")
      .json(&body)
      .send()
      .await
      .map_err(|e| format!("Erreur réseau : {e}"))?;

    if !resp.status().is_success() {
      let status = resp.status();
      let body = resp.text().await.unwrap_or_default();
      return Err(format!("Notion API error {} : {}", status, body));
    }

    Ok(())
  }

  /// Fetch all block IDs for a page
  #[allow(dead_code)]
  async fn fetch_page_blocks(&self, page_id: &str) -> Result<Vec<String>, String> {
    let auth = self.auth_header().ok_or("Non connecté à Notion")?;
    let resp = self.http
      .get(format!("{}/blocks/{}/children", NOTION_API_BASE, page_id))
      .header("Authorization", &auth)
      .header("Notion-Version", NOTION_VERSION)
      .send()
      .await
      .map_err(|e| format!("Erreur réseau : {e}"))?;

    if !resp.status().is_success() { return Ok(vec![]); }

    let data: Value = resp.json().await.unwrap_or_default();
    Ok(
      data["results"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|b| b["id"].as_str().map(String::from)).collect())
        .unwrap_or_default(),
    )
  }

  /// Get a page's properties
  pub async fn get_page(&self, page_id: &str) -> Result<NotionPageDetail, String> {
    let auth = self.auth_header().ok_or("Non connecté à Notion")?;
    let resp = self.http
      .get(format!("{}/pages/{}", NOTION_API_BASE, page_id))
      .header("Authorization", &auth)
      .header("Notion-Version", NOTION_VERSION)
      .send()
      .await
      .map_err(|e| format!("Erreur réseau : {e}"))?;

    if !resp.status().is_success() {
      let status = resp.status();
      return Err(format!("Page introuvable ({})", status));
    }

    let page: Value = resp.json().await.map_err(|e| format!("Réponse invalide : {e}"))?;
    let title = page["properties"]["title"]["title"]
      .as_array()
      .map(|t| t.iter().filter_map(|p| p["plain_text"].as_str()).collect::<Vec<_>>().join(""))
      .unwrap_or_default();

    Ok(NotionPageDetail {
      id: page["id"].as_str().unwrap_or_default().to_string(),
      url: page["url"].as_str().unwrap_or_default().to_string(),
      title,
      created_time: page["created_time"].as_str().unwrap_or_default().to_string(),
      last_edited_time: page["last_edited_time"].as_str().unwrap_or_default().to_string(),
    })
  }
}

// ═══════════════════════════════════════════════════
// Notion API types
// ═══════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionUserInfo {
  pub id: String,
  pub name: Option<String>,
  pub avatar_url: Option<String>,
  pub r#type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionSearchResult {
  pub id: String,
  pub title: String,
  pub url: String,
  pub icon: Option<String>,
  pub parent_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionPage {
  pub id: String,
  pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionPageDetail {
  pub id: String,
  pub url: String,
  pub title: String,
  pub created_time: String,
  pub last_edited_time: String,
}

// ═══════════════════════════════════════════════════
// Markdown → Notion blocks converter
// ═══════════════════════════════════════════════════

fn markdown_to_notion_blocks(content: &str) -> Vec<Value> {
  let mut blocks = Vec::new();
  for line in content.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() { continue; }

    // Heading
    if trimmed.starts_with("### ") {
      blocks.push(json!({
        "object": "block", "type": "heading_3",
        "heading_3": { "rich_text": [{ "type": "text", "text": { "content": &trimmed[4..] } }] }
      }));
    } else if trimmed.starts_with("## ") {
      blocks.push(json!({
        "object": "block", "type": "heading_2",
        "heading_2": { "rich_text": [{ "type": "text", "text": { "content": &trimmed[3..] } }] }
      }));
    } else if trimmed.starts_with("# ") {
      blocks.push(json!({
        "object": "block", "type": "heading_1",
        "heading_1": { "rich_text": [{ "type": "text", "text": { "content": &trimmed[2..] } }] }
      }));
    }
    // Checklist
    else if trimmed.starts_with("- [x] ") || trimmed.starts_with("- [ ] ") {
      let checked = trimmed.starts_with("- [x] ");
      let text = trimmed.trim_start_matches("- [x] ").trim_start_matches("- [ ] ");
      blocks.push(json!({
        "object": "block", "type": "to_do",
        "to_do": {
          "rich_text": [{ "type": "text", "text": { "content": text } }],
          "checked": checked
        }
      }));
    }
    // Bullet
    else if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
      let text = trimmed[2..].trim();
      blocks.push(json!({
        "object": "block", "type": "bulleted_list_item",
        "bulleted_list_item": { "rich_text": [{ "type": "text", "text": { "content": text } }] }
      }));
    }
    // Code block (simple: single line with backticks)
    else if trimmed.starts_with('`') && trimmed.ends_with('`') && trimmed.len() > 2 {
      let code = &trimmed[1..trimmed.len()-1];
      blocks.push(json!({
        "object": "block", "type": "code",
        "code": { "rich_text": [{ "type": "text", "text": { "content": code } }], "language": "plain text" }
      }));
    }
    // Paragraph (default)
    else {
      blocks.push(json!({
        "object": "block", "type": "paragraph",
        "paragraph": { "rich_text": [{ "type": "text", "text": { "content": trimmed } }] }
      }));
    }

    // Notion API limit: 100 blocks per request
    if blocks.len() >= 100 { break; }
  }
  blocks
}

/// Convert Le Bocal note content to markdown for Notion sync
pub fn note_to_markdown(title: &str, summary: &str, tasks: &[(String, bool)], blocks: &[Value]) -> String {
  let mut md = String::new();
  md.push_str(&format!("# {}\n\n", title));
  if !summary.is_empty() { md.push_str(&format!("{}\n\n", summary)); }
  if !tasks.is_empty() {
    md.push_str("## Tâches\n");
    for (label, done) in tasks {
      md.push_str(&format!("- [{}] {}\n", if *done { "x" } else { " " }, label));
    }
    md.push('\n');
  }
  if !blocks.is_empty() {
    md.push_str("## Contenu\n");
    for block in blocks {
      let kind = block["type"].as_str().unwrap_or("text");
      match kind {
        "text" | "paragraph" => {
          let text = block["data"]["text"].as_str().or_else(|| block["data"]["content"].as_str()).unwrap_or("");
          if !text.is_empty() { md.push_str(&format!("{}\n\n", text)); }
        }
        "code" => {
          let code = block["data"]["code"].as_str().or_else(|| block["data"]["content"].as_str()).unwrap_or("");
          let lang = block["data"]["language"].as_str().unwrap_or("");
          md.push_str(&format!("```{}\n{}\n```\n\n", lang, code));
        }
        "checklist" => {
          let items = block["data"]["items"].as_array();
          if let Some(items) = items {
            for item in items {
              let text = item["text"].as_str().unwrap_or("");
              let checked = item["checked"].as_bool().unwrap_or(false);
              md.push_str(&format!("- [{}] {}\n", if checked { "x" } else { " " }, text));
            }
          }
          md.push('\n');
        }
        _ => {
          let content = block["data"]["content"].as_str().or_else(|| block["data"]["text"].as_str()).unwrap_or("");
          if !content.is_empty() { md.push_str(&format!("{}\n\n", content)); }
        }
      }
    }
  }
  md
}
