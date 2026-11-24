use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub store_name: String,
    pub tagline: String,
    pub address: String,
    pub city: String,
    pub phone: String,
    pub ntn: String,
    pub currency_symbol: String,
    pub receipt_privacy_enforced: bool,
    pub station_id: String,
    pub is_primary_server: bool,
    pub mesh_port: u16,
    pub peer_station_id: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            store_name: "Ameer Perfumes".to_string(),
            tagline: "Artisanal Perfumery & Pure Concentrated Oils".to_string(),
            address: "Shop #4, Luxury Perfume Galleria, Main Boulevard".to_string(),
            city: "Lahore, Pakistan".to_string(),
            phone: "+92 42 3578 9000".to_string(),
            ntn: "7849201-4".to_string(),
            currency_symbol: "Rs.".to_string(),
            receipt_privacy_enforced: true, // Invariant from Owner Decision A
            station_id: "POS-01".to_string(),
            is_primary_server: true,
            mesh_port: 7878,
            peer_station_id: "POS-02".to_string(),
        }
    }
}

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Self {
        let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("AmeerPerfumes");
        if !path.exists() {
            let _ = fs::create_dir_all(&path);
        }
        path.push("config.json");
        Self { config_path: path }
    }

    pub fn load_or_create(&self) -> AppConfig {
        if self.config_path.exists() {
            if let Ok(contents) = fs::read_to_string(&self.config_path) {
                if let Ok(config) = serde_json::from_str::<AppConfig>(&contents) {
                    return config;
                }
            }
        }
        let default_config = AppConfig::default();
        let _ = self.save(&default_config);
        default_config
    }

    pub fn save(&self, config: &AppConfig) -> Result<(), std::io::Error> {
        let json = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, json)?;
        Ok(())
    }
}
