use anchor_lang::prelude::*;

use crate::{AmmPool, Market, PredictionMarketError};



#[derive(Accounts)]
pub struct InitializeAmm<'info> {

    #[account(mut)]
    pub authority : Signer<'info>,


    #[account(seeds=[b"market",authority.key().as_ref(), &market.market_id.to_le_bytes()], bump=market.bump,has_one = authority @PredictionMarketError::Unauthorized)]
    pub market : Account<'info,Market>,

    #[account(init, payer = authority, space = 8 + AmmPool::INIT_SPACE,seeds = [b"amm",market.key().as_ref()],bump, )]
    pub amm : Account<'info,AmmPool>,


    pub system_program : Program<'info,System>,
    
}


pub fn initalize_amm(ctx : Context<InitializeAmm>, fee_bps : u16) -> Result<()> {
    require!(fee_bps <=1000, PredictionMarketError::InValidFeeBps);
    
    let amm = &mut ctx.accounts.amm;
    amm.market = ctx.accounts.market.key();
    amm.no_reserve= 0;
    amm.yes_reserve=0;
    amm.lp_supply=0;
    amm.fee_bps=fee_bps;
    amm.bump=ctx.bumps.amm;

    Ok(())
}