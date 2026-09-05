mod domain;
mod infrastructure;
mod application;

use crate::domain::events::EventProvider;
use crate::infrastructure::webhook::WebhookProvider;
use crate::infrastructure::wss::WssProvider;
use dotenvy::dotenv;
use std::env;
use tokio::sync::mpsc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    
    let mode = env::var("INGESTION_MODE").unwrap_or_else(|_| "wss".to_string());
    let (tx, mut rx) = mpsc::channel(100);

    let provider: Box<dyn EventProvider> = match mode.as_str() {
        "webhook" => Box::new(WebhookProvider {
            port: env::var("PORT").unwrap_or_else(|_| "8080".to_string()).parse().unwrap(),
        }),
        _ => Box::new(WssProvider {
            url: env::var("RPC_WS_URL").unwrap_or_else(|_| "ws://127.0.0.1:8900".to_string()),
            program_id: env::var("PROGRAM_ID").unwrap_or_else(|_| "7PBhPD5n3Qe18BoFR4uiRNVTCoqz3RYh9mypf6CC3tww".to_string()),
        }),
    };

    println!("Starting indexer service in {} mode...", mode);
    provider.start_listening(tx).await?;

    while let Some(event) = rx.recv().await {
        println!("Received event: {:?}", event);
    }

    Ok(())
}
