use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::util::Timeout;
use shared_domain::RawSolanaEvent;
use std::time::Duration;

pub struct KafkaProducer {
    producer: FutureProducer,
    topic: String,
}

impl KafkaProducer {
    pub fn new(brokers: &str, topic: String) -> Self {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("message.timeout.ms", "5000")
            .create()
            .expect("Failed to create Kafka producer");

        Self { producer, topic }
    }

    pub async fn send_event(&self, event: RawSolanaEvent) {
        if let Ok(payload) = serde_json::to_string(&event) {
            let record = FutureRecord::to(&self.topic)
                .payload(&payload)
                .key("solana_event");

            let _ = self.producer.send(record, Timeout::After(Duration::from_secs(0))).await;
        }
    }
}
