use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Counter {
    pub count: u64,
    pub authority: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub market_id: u64, //unique_market_id

    #[max_len(128)]
    pub question: String, //market_name
    pub authority: Pubkey,    //creator
    pub end_time: i64,        //unx_timestamp
    pub fee_bps: u16,         //fee_in_basic_points
    pub total_yes: u64,       //total_yes_shares
    pub total_no: u64,        //total_no_shares
    pub treasury: Pubkey,     //receiver_of_protocol_fees
    pub outcome: Outcome,     //Unresolved, Yes,No
    pub bump: u8,             //PDA_bump
    pub payment_mint: Pubkey, //market_accepts_payment_mint
    pub vault_bump: u8,       //vault_token_account_PDA_bump
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Outcome {
    Unresolved,
    Yes,
    No,
}


#[derive(AnchorDeserialize, AnchorSerialize, Clone, Copy, PartialEq, Eq,InitSpace)]
pub enum Side {
    Yes,
    No,
}

#[account]
#[derive(InitSpace)]
pub struct  Position {
    pub owner: Pubkey,
    pub market: Pubkey,   
    pub yes_shares: u64,
    pub no_shares: u64,
    pub claimed: bool,
    pub bump: u8,
}
