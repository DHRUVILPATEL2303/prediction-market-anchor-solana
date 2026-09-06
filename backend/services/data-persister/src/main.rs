mod infrastructure;

use crate::infrastructure::db::establish_connection;
use crate::infrastructure::kafka_consumer::EventConsumer;
use dotenvy::dotenv;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    
    let pool = establish_connection().await;
    

    sqlx::migrate!("../../migrations").run(&pool).await?;

    let kafka_brokers = env::var("KAFKA_BROKERS").unwrap_or_else(|_| "localhost:9092".to_string());
    let kafka_topic = env::var("KAFKA_TOPIC").unwrap_or_else(|_| "solana_events".to_string());
    let group_id = env::var("KAFKA_GROUP_ID").unwrap_or_else(|_| "data_persister_group".to_string());
    
    let consumer = EventConsumer::new(&kafka_brokers, &group_id, &kafka_topic, pool);
    
    println!("Starting data persister service...");
    consumer.run().await;

    Ok(())
}
