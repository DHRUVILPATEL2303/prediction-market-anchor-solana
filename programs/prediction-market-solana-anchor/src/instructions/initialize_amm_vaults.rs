use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{AmmPool, Market, PredictionMarketError};

#[derive(Accounts)]
pub struct InitializeAmmVaults<'info> {
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
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        seeds = [
            b"amm",
            market.key().as_ref()
        ],
        bump = amm.bump,
        constraint = amm.market == market.key()
            @ PredictionMarketError::InvalidMarket
    )]
    pub amm: Box<Account<'info, AmmPool>>,

    /// CHECK: PDA used only as AMM vault authority.
    #[account(
        seeds = [
            b"amm-authority",
            market.key().as_ref()
        ],
        bump
    )]
    pub amm_authority: UncheckedAccount<'info>,

    #[account(
        constraint = payment_mint.key() == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub payment_mint: Box<Account<'info, Mint>>,

    #[account(address = amm.yes_mint)]
    pub yes_mint: Box<Account<'info, Mint>>,

    #[account(address = amm.no_mint)]
    pub no_mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        seeds = [
            b"payment-vault",
            market.key().as_ref()
        ],
        bump,
        token::mint = payment_mint,
        token::authority = amm_authority
    )]
    pub payment_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        seeds = [
            b"yes-vault",
            market.key().as_ref()
        ],
        bump,
        token::mint = yes_mint,
        token::authority = amm_authority
    )]
    pub yes_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = authority,
        seeds = [
            b"no-vault",
            market.key().as_ref()
        ],
        bump,
        token::mint = no_mint,
        token::authority = amm_authority
    )]
    pub no_vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_amm_vaults(
    ctx: Context<InitializeAmmVaults>
) -> Result<()> {
    let amm = &mut ctx.accounts.amm;

    amm.payment_vault = ctx.accounts.payment_vault.key();
    amm.yes_vault = ctx.accounts.yes_vault.key();
    amm.no_vault = ctx.accounts.no_vault.key();

    Ok(())
}