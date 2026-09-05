use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum RawSolanaEvent {
    Transaction(String),
    LogSignature(String),
}
