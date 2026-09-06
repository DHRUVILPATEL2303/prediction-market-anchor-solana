mod domain;
mod infrastructure;
mod application;

use crate::domain::events::EventProvider;
use crate::infrastructure::kafka::KafkaProducer;
use crate::infrastructure::webhook::WebhookProvider;
use crate::infrastructure::wss::WssProvider;
use dotenvy::dotenv;
use std::env;
use tokio::sync::mpsc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    
    let mode = env::var("INGESTION_MODE").unwrap_or_else(|_| "wss".to_string());
    let kafka_brokers = env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
    let kafka_topic = env::var("KAFKA_TOPIC").unwrap_or_else(|_| "solana_events".to_string());
    
    let producer = KafkaProducer::new(&kafka_brokers, kafka_topic);
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

    provider.start_listening(tx).await?;

    while let Some(event) = rx.recv().await {
        producer.send_event(event).await;
    }

    Ok(())
}
