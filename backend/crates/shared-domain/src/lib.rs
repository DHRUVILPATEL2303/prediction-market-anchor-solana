use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize,Debug,Clone)]
pub enum RawSolanaEvent {
    Transaction(String),
    LogSignature(String),
}
