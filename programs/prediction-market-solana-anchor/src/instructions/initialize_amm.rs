use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{AmmPool, Market, PredictionMarketError};

#[derive(Accounts)]
pub struct InitializeAmm<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(seeds=[b"market",authority.key().as_ref(), &market.market_id.to_le_bytes()], bump=market.bump,has_one = authority @PredictionMarketError::Unauthorized)]
    pub market: Account<'info, Market>,

    #[account(init, payer = authority, space = 8 + AmmPool::INIT_SPACE,seeds = [b"amm",market.key().as_ref()],bump, )]
    pub amm: Account<'info, AmmPool>,

    ///CHECK : PDA used only as mint authority for YES/NO outcome tokens.
    #[account(seeds=[b"outcome-authority", market.key().as_ref()], bump)]
    pub outcome_authority: UncheckedAccount<'info>,


    ///CHECK : PDA used only as mint authority for AMM vaults.
    #[account(seeds=[b"amm-authority", amm.key().as_ref()], bump)]
    pub amm_authority : UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = outcome_authority,
        mint::freeze_authority = outcome_authority
    )]
    pub yes_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = outcome_authority,
        mint::freeze_authority = outcome_authority
    )]
    pub no_mint: Account<'info, Mint>,

    #[account(init, payer=authority, 
       token::mint=payment_mint,
       token::authority= amm_authority,
       seeds = [b"payment-vault",market.key().as_ref()],
       bump
    )]
    pub payment_vault : Account<'info,TokenAccount>,


    #[account(constraint = payment_mint.key() == market.payment_mint @PredictionMarketError::InvalidMint)]
    pub payment_mint: Account<'info, Mint>,

    #[account(init, payer = authority, token::mint=yes_mint, token::authority= amm_authority, seeds = [b"yes-vault",market.key().as_ref()],bump)]
    pub yes_vault: Account<'info, TokenAccount>,

    #[account(init, payer = authority, token::mint=no_mint, token::authority= amm_authority, seeds = [b"no-vault",market.key().as_ref()],bump)]
    pub no_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,

    pub system_program: Program<'info, System>,
}

pub fn initalize_amm(ctx: Context<InitializeAmm>, fee_bps: u16) -> Result<()> {
    require!(fee_bps <= 1000, PredictionMarketError::InValidFeeBps);

    let amm = &mut ctx.accounts.amm;
    amm.market = ctx.accounts.market.key();
    amm.yes_mint = ctx.accounts.yes_mint.key();
    amm.no_mint = ctx.accounts.no_mint.key();
    amm.payment_vault=ctx.accounts.payment_vault.key();
    amm.yes_vault=ctx.accounts.yes_vault.key();
    amm.no_vault = ctx.accounts.no_vault.key();
    amm.no_reserve = 0;
    amm.yes_reserve = 0;
    amm.lp_supply = 0;
    amm.fee_bps = fee_bps;
    amm.bump = ctx.bumps.amm;

    Ok(())
}
