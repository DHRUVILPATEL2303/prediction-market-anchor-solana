use crate::domain::events::EventProvider;
use async_trait::async_trait;
use shared_domain::RawSolanaEvent;
use solana_client::pubsub_client::PubsubClient;
use solana_client::rpc_config::{RpcTransactionLogsConfig, RpcTransactionLogsFilter};
use std::error::Error;
use tokio::sync::mpsc::Sender;

pub struct WssProvider {
    pub url: String,
    pub program_id: String,
}

#[async_trait]
impl EventProvider for WssProvider {
    async fn start_listening(&self, sender: Sender<RawSolanaEvent>) -> Result<(), Box<dyn Error>> {
        let (mut _client, receiver) = PubsubClient::logs_subscribe(
            &self.url,
            RpcTransactionLogsFilter::Mentions(vec![self.program_id.clone()]),
            RpcTransactionLogsConfig { commitment: None },
        )?;

        tokio::spawn(async move {
            loop {
                if let Ok(response) = receiver.recv() {
                    let _ = sender
                        .send(RawSolanaEvent::LogSignature(response.value.signature))
                        .await;
                }
            }
        });

        Ok(())
    }
}
