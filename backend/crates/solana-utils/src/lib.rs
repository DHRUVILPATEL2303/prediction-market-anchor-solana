use anchor_client::anchor_lang::prelude::*;
use anchor_client::anchor_lang::AnchorDeserialize;
use solana_sdk::pubkey::Pubkey;

#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Outcome {
    Unresolved,
    Yes,
    No,
    Cancelled,
}

#[derive(AnchorDeserialize, AnchorSerialize, Debug, Clone)]
pub struct MarketCreatedEvent {
    pub market_id: u64,
    pub market: Pubkey,
    pub authority: Pubkey,
    pub question: String,
    pub end_time: i64,
    pub fee_bps: u16,
}

#[derive(AnchorDeserialize, AnchorSerialize, Debug, Clone)]
pub struct MarketResolvedEvent {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub outcome: Outcome,
}

#[derive(AnchorDeserialize, AnchorSerialize, Debug, Clone)]
pub struct MarketCancelledEvent {
    pub market: Pubkey,
    pub authority: Pubkey,
}

pub enum PredictionMarketEvent {
    MarketCreated(MarketCreatedEvent),
    MarketResolved(MarketResolvedEvent),
    MarketCancelled(MarketCancelledEvent),
}

pub fn decode_event(data: &[u8]) -> Option<PredictionMarketEvent> {
    if data.len() < 8 {
        return None;
    }

    let discriminator = &data[0..8];
    let payload = &data[8..];

    let market_created_disc =
        anchor_client::anchor_lang::solana_program::hash::hash(b"event:MarketCreated").to_bytes()
            [..8]
            .to_vec();
    let market_resolved_disc =
        anchor_client::anchor_lang::solana_program::hash::hash(b"event:MarketResolved").to_bytes()
            [..8]
            .to_vec();
    let market_cancelled_disc =
        anchor_client::anchor_lang::solana_program::hash::hash(b"event:MarketCancelled").to_bytes()
            [..8]
            .to_vec();

    if discriminator == market_created_disc.as_slice() {
        if let Ok(event) = MarketCreatedEvent::deserialize(&mut &payload[..]) {
            return Some(PredictionMarketEvent::MarketCreated(event));
        }
    } else if discriminator == market_resolved_disc.as_slice() {
        if let Ok(event) = MarketResolvedEvent::deserialize(&mut &payload[..]) {
            return Some(PredictionMarketEvent::MarketResolved(event));
        }
    } else if discriminator == market_cancelled_disc.as_slice() {
        if let Ok(event) = MarketCancelledEvent::deserialize(&mut &payload[..]) {
            return Some(PredictionMarketEvent::MarketCancelled(event));
        }
    }

    None
}
