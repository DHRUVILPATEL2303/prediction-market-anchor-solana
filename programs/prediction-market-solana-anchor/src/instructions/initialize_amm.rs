use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::{AmmPool, Market, PredictionMarketError};

#[derive(Accounts)]
pub struct InitializeAmm<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [
            b"market",
            authority.key().as_ref(),
            &market.market_id.to_le_bytes()
        ],
        bump = market.bump,
        has_one = authority @ PredictionMarketError::Unauthorized
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = authority,
        space = 8 + AmmPool::INIT_SPACE,
        seeds = [
            b"amm",
            market.key().as_ref()
        ],
        bump
    )]
    pub amm: Account<'info, AmmPool>,

    /// CHECK: PDA used only as YES/NO mint authority.
    #[account(
        seeds = [
            b"outcome-authority",
            market.key().as_ref()
        ],
        bump
    )]
    pub outcome_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        seeds = [
            b"yes-mint",
            market.key().as_ref()
        ],
        bump,
        mint::decimals = 6,
        mint::authority = outcome_authority,
        mint::freeze_authority = outcome_authority
    )]
    pub yes_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [
            b"no-mint",
            market.key().as_ref()
        ],
        bump,
        mint::decimals = 6,
        mint::authority = outcome_authority,
        mint::freeze_authority = outcome_authority
    )]
    pub no_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_amm(ctx: Context<InitializeAmm>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= 1000, PredictionMarketError::InValidFeeBps);

    let amm = &mut ctx.accounts.amm;

    amm.market = ctx.accounts.market.key();

    amm.yes_mint = ctx.accounts.yes_mint.key();
    amm.no_mint = ctx.accounts.no_mint.key();

    amm.yes_reserve = 0;
    amm.no_reserve = 0;

    amm.lp_supply = 0;

    amm.fee_bps = fee_bps;

    amm.bump = ctx.bumps.amm;

    Ok(())
}

