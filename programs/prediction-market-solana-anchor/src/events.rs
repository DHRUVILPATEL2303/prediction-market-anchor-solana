use anchor_lang::prelude::*;

use crate::Outcome;

#[event]
pub struct MarketCreated {
    pub market_id: u64,
    pub market: Pubkey,
    pub authority: Pubkey,
    pub question : String,
    pub end_time : i64,
    pub fee_bps : u16
}


#[event]
pub struct MarketResolved {
    pub market : Pubkey,
    pub authority : Pubkey,
    pub outcome : Outcome
    
}


#[event]
pub struct MarketCancelled {
    pub market: Pubkey,
    pub authority: Pubkey,
}
