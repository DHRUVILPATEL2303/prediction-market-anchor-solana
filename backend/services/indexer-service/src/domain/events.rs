use async_trait::async_trait;
use shared_domain::RawSolanaEvent;
use std::error::Error;
use tokio::sync::mpsc::Sender;

#[async_trait]
pub trait EventProvider: Send + Sync {
    async fn start_listening(&self, sender: Sender<RawSolanaEvent>) -> Result<(), Box<dyn Error>>;
}