use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::Message;
use shared_domain::RawSolanaEvent;
use solana_utils::{decode_event, PredictionMarketEvent};
use sqlx::PgPool;

pub struct EventConsumer {
    consumer: StreamConsumer,
    pool: PgPool,
}

impl EventConsumer {
    pub fn new(brokers: &str, group_id: &str, topic: &str, pool: PgPool) -> Self {
        let consumer: StreamConsumer = ClientConfig::new()
            .set("group.id", group_id)
            .set("bootstrap.servers", brokers)
            .set("enable.partition.eof", "false")
            .set("session.timeout.ms", "6000")
            .set("enable.auto.commit", "true")
            .create()
            .expect("Consumer creation failed");

        consumer.subscribe(&[topic]).expect("Can't subscribe to specified topic");

        Self { consumer, pool }
    }

    pub async fn run(&self) {
        loop {
            match self.consumer.recv().await {
                Err(e) => println!("Kafka error: {}", e),
                Ok(m) => {
                    let payload = match m.payload_view::<str>() {
                        None => "",
                        Some(Ok(s)) => s,
                        Some(Err(e)) => {
                            println!("Error while deserializing message payload: {:?}", e);
                            ""
                        }
                    };

                    if let Ok(raw_event) = serde_json::from_str::<RawSolanaEvent>(payload) {
                        self.handle_raw_event(raw_event).await;
                    }
                }
            };
        }
    }

    async fn handle_raw_event(&self, event: RawSolanaEvent) {
        if let RawSolanaEvent::LogSignature(sig) = event {
   
            println!("Received signature: {}", sig);
        }
    }
}
