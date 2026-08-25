use anchor_lang::prelude::*;

use crate::{Market, Outcome, Side};

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
pub struct SharesPurchased {
    pub buyer: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub amount: u64,
}

#[event]
pub struct MarketResolved {
    pub market : Pubkey,
    pub authority : Pubkey,
    pub outcome : Outcome
    
}

#[event]
pub struct WinningsClaimed {
    pub claimer: Pubkey,
    pub market: Pubkey,
    pub shares: u64,
    pub fee: u64,
    pub payout: u64,
}