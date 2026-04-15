use std::{fs, path::PathBuf};

use serde_json::Value;

#[derive(Clone)]
pub struct CacheStore {
    base_path: PathBuf,
}

impl CacheStore {
    pub fn new() -> Self {
        let base_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../backend/cache");

        Self { base_path }
    }

    pub fn read_json(&self, file_name: &str) -> Result<Value, String> {
        let path = self.base_path.join(file_name);
        let raw = fs::read_to_string(&path)
            .map_err(|error| format!("Failed to read cache file {}: {}", path.display(), error))?;

        serde_json::from_str(&raw)
            .map_err(|error| format!("Failed to parse cache file {}: {}", path.display(), error))
    }
}
