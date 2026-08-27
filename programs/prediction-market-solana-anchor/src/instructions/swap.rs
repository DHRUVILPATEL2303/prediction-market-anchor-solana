use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

use crate::{AmmPool, Market, Outcome, PredictionMarketError, SwapDirection};

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [
            b"market",
            market.authority.as_ref(),
            &market.market_id.to_le_bytes()
        ],
        bump = market.bump
    )]
    pub market: Box<Account<'info, Market>>,

    #[account(
        mut,
        seeds = [b"amm", market.key().as_ref()],
        bump = amm.bump,
        constraint = amm.market == market.key()
            @ PredictionMarketError::InvalidMarket
    )]
    pub amm: Box<Account<'info, AmmPool>>,

    /// CHECK: PDA used only as AMM vault authority.
    #[account(
        seeds = [b"amm-authority", market.key().as_ref()],
        bump
    )]
    pub amm_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        address = amm.payment_vault,
        constraint = payment_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = payment_vault.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub payment_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        address = amm.yes_vault,
        constraint = yes_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = yes_vault.mint == amm.yes_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub yes_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        address = amm.no_vault,
        constraint = no_vault.owner == amm_authority.key()
            @ PredictionMarketError::Unauthorized,
        constraint = no_vault.mint == amm.no_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub no_vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_payment_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_payment_account.mint == market.payment_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub user_payment_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_yes_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_yes_account.mint == amm.yes_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub user_yes_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = user_no_account.owner == user.key()
            @ PredictionMarketError::Unauthorized,
        constraint = user_no_account.mint == amm.no_mint
            @ PredictionMarketError::InvalidMint
    )]
    pub user_no_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn swap(
    ctx: Context<Swap>,
    amount_in: u64,
    min_amount_out: u64,
    direction: SwapDirection,
) -> Result<()> {
    require!(amount_in > 0, PredictionMarketError::InvalidAmount);

    let market = &ctx.accounts.market;

    require!(
        market.outcome == Outcome::Unresolved,
        PredictionMarketError::MarketAlreadyResolved
    );

    let now = Clock::get()?.unix_timestamp;

    require!(now < market.end_time, PredictionMarketError::MarketClosed);

    let amm = &mut ctx.accounts.amm;

    let fee = (amount_in as u128)
        .checked_mul(amm.fee_bps as u128)
        .ok_or(PredictionMarketError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let amount_in_after_fee = (amount_in as u128)
        .checked_sub(fee)
        .ok_or(PredictionMarketError::MathOverflow)?;

    require!(
        amount_in_after_fee > 0,
        PredictionMarketError::InvalidAmount
    );

    match direction {
        SwapDirection::UsdcToYes => {
            let payment_reserve = ctx.accounts.payment_vault.amount;
            let yes_reserve = ctx.accounts.yes_vault.amount;

            let amount_out = calculate_amount_out(
                payment_reserve,
                yes_reserve,
                amount_in_after_fee,
            )?;

            require!(
                amount_out >= min_amount_out,
                PredictionMarketError::SlippageExceeded
            );

            require!(
                ctx.accounts.user_payment_account.amount >= amount_in,
                PredictionMarketError::InsufficientBalance
            );

            transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info().key(),
                    Transfer {
                        from: ctx.accounts.user_payment_account.to_account_info(),
                        to: ctx.accounts.payment_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                amount_in,
            )?;

            let market_key = market.key();
            let bump = [ctx.bumps.amm_authority];

            let signer_seeds: &[&[u8]] =
                &[b"amm-authority", market_key.as_ref(), &bump];

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().key(),
                    Transfer {
                        from: ctx.accounts.yes_vault.to_account_info(),
                        to: ctx.accounts.user_yes_account.to_account_info(),
                        authority: ctx.accounts.amm_authority.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                amount_out,
            )?;

            amm.yes_reserve = yes_reserve
                .checked_sub(amount_out)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }

        SwapDirection::UsdcToNo => {
            let payment_reserve = ctx.accounts.payment_vault.amount;
            let no_reserve = ctx.accounts.no_vault.amount;

            let amount_out = calculate_amount_out(
                payment_reserve,
                no_reserve,
                amount_in_after_fee,
            )?;

            require!(
                amount_out >= min_amount_out,
                PredictionMarketError::SlippageExceeded
            );

            require!(
                ctx.accounts.user_payment_account.amount >= amount_in,
                PredictionMarketError::InsufficientBalance
            );

            transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info().key(),
                    Transfer {
                        from: ctx.accounts.user_payment_account.to_account_info(),
                        to: ctx.accounts.payment_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                amount_in,
            )?;

            let market_key = market.key();
            let bump = [ctx.bumps.amm_authority];

            let signer_seeds: &[&[u8]] =
                &[b"amm-authority", market_key.as_ref(), &bump];

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().key(),
                    Transfer {
                        from: ctx.accounts.no_vault.to_account_info(),
                        to: ctx.accounts.user_no_account.to_account_info(),
                        authority: ctx.accounts.amm_authority.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                amount_out,
            )?;

            amm.no_reserve = no_reserve
                .checked_sub(amount_out)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }

        SwapDirection::YesToUsdc => {
            let yes_reserve = ctx.accounts.yes_vault.amount;
            let payment_reserve = ctx.accounts.payment_vault.amount;

            let amount_out = calculate_amount_out(
                yes_reserve,
                payment_reserve,
                amount_in_after_fee,
            )?;

            require!(
                amount_out >= min_amount_out,
                PredictionMarketError::SlippageExceeded
            );

            require!(
                ctx.accounts.user_yes_account.amount >= amount_in,
                PredictionMarketError::InsufficientBalance
            );

            transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info().key(),
                    Transfer {
                        from: ctx.accounts.user_yes_account.to_account_info(),
                        to: ctx.accounts.yes_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                amount_in,
            )?;

            let market_key = market.key();
            let bump = [ctx.bumps.amm_authority];

            let signer_seeds: &[&[u8]] =
                &[b"amm-authority", market_key.as_ref(), &bump];

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().key(),
                    Transfer {
                        from: ctx.accounts.payment_vault.to_account_info(),
                        to: ctx.accounts.user_payment_account.to_account_info(),
                        authority: ctx.accounts.amm_authority.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                amount_out,
            )?;

            amm.yes_reserve = yes_reserve
                .checked_add(amount_in)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }

        SwapDirection::NoToUsdc => {
            let no_reserve = ctx.accounts.no_vault.amount;
            let payment_reserve = ctx.accounts.payment_vault.amount;

            let amount_out = calculate_amount_out(
                no_reserve,
                payment_reserve,
                amount_in_after_fee,
            )?;

            require!(
                amount_out >= min_amount_out,
                PredictionMarketError::SlippageExceeded
            );

            require!(
                ctx.accounts.user_no_account.amount >= amount_in,
                PredictionMarketError::InsufficientBalance
            );

            transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info().key(),
                    Transfer {
                        from: ctx.accounts.user_no_account.to_account_info(),
                        to: ctx.accounts.no_vault.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                amount_in,
            )?;

            let market_key = market.key();
            let bump = [ctx.bumps.amm_authority];

            let signer_seeds: &[&[u8]] =
                &[b"amm-authority", market_key.as_ref(), &bump];

            transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().key(),
                    Transfer {
                        from: ctx.accounts.payment_vault.to_account_info(),
                        to: ctx.accounts.user_payment_account.to_account_info(),
                        authority: ctx.accounts.amm_authority.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                amount_out,
            )?;

            amm.no_reserve = no_reserve
                .checked_add(amount_in)
                .ok_or(PredictionMarketError::MathOverflow)?;
        }
    }

    Ok(())
}

fn calculate_amount_out(
    reserve_in: u64,
    reserve_out: u64,
    amount_in_after_fee: u128,
) -> Result<u64> {
    require!(
        reserve_in > 0 && reserve_out > 0,
        PredictionMarketError::InvalidLiquidity
    );

    let reserve_in = reserve_in as u128;
    let reserve_out = reserve_out as u128;

    let k = reserve_in
        .checked_mul(reserve_out)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let new_reserve_in = reserve_in
        .checked_add(amount_in_after_fee)
        .ok_or(PredictionMarketError::MathOverflow)?;

    let new_reserve_out = k
        .checked_div(new_reserve_in)
        .ok_or(PredictionMarketError::MathOverflow)?;

    require!(
        reserve_out > new_reserve_out,
        PredictionMarketError::InsufficientLiquidity
    );

    let amount_out = reserve_out
        .checked_sub(new_reserve_out)
        .ok_or(PredictionMarketError::MathOverflow)?;

    u64::try_from(amount_out).map_err(|_| PredictionMarketError::MathOverflow.into())
}

fn swap_usdc_to_token(
    ctx: &Context<Swap>,
    amount_in: u64,
    amount_in_after_fee: u128,
    min_amount_out: u64,
    yes: bool,
) -> Result<()> {
    let payment_reserve = ctx.accounts.payment_vault.amount;

    let token_reserve = if yes {
        ctx.accounts.yes_vault.amount
    } else {
        ctx.accounts.no_vault.amount
    };

    let amount_out = calculate_amount_out(payment_reserve, token_reserve, amount_in_after_fee)?;

    require!(
        amount_out >= min_amount_out,
        PredictionMarketError::SlippageExceeded
    );

    require!(
        ctx.accounts.user_payment_account.amount >= amount_in,
        PredictionMarketError::InsufficientBalance
    );

    let payment_transfer = Transfer {
        from: ctx.accounts.user_payment_account.to_account_info(),
        to: ctx.accounts.payment_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };

    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().key(),
            payment_transfer,
        ),
        amount_in,
    )?;

    let market_key = ctx.accounts.market.key();
    let bump = [ctx.bumps.amm_authority];

    let signer_seeds: &[&[u8]] = &[b"amm-authority", market_key.as_ref(), &bump];

    let signer = &[signer_seeds];

    if yes {
        let token_transfer = Transfer {
            from: ctx.accounts.yes_vault.to_account_info(),
            to: ctx.accounts.user_yes_account.to_account_info(),
            authority: ctx.accounts.amm_authority.to_account_info(),
        };

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().key(),
                token_transfer,
                signer,
            ),
            amount_out,
        )?;
    } else {
        let token_transfer = Transfer {
            from: ctx.accounts.no_vault.to_account_info(),
            to: ctx.accounts.user_no_account.to_account_info(),
            authority: ctx.accounts.amm_authority.to_account_info(),
        };

        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().key(),
                token_transfer,
                signer,
            ),
            amount_out,
        )?;
    }

    Ok(())
}

fn swap_token_to_usdc(
    ctx: &Context<Swap>,
    amount_in: u64,
    amount_in_after_fee: u128,
    min_amount_out: u64,
    yes: bool,
) -> Result<()> {
    let token_reserve = if yes {
        ctx.accounts.yes_vault.amount
    } else {
        ctx.accounts.no_vault.amount
    };

    let payment_reserve = ctx.accounts.payment_vault.amount;

    let amount_out = calculate_amount_out(token_reserve, payment_reserve, amount_in_after_fee)?;

    require!(
        amount_out >= min_amount_out,
        PredictionMarketError::SlippageExceeded
    );

    let user_token_balance = if yes {
        ctx.accounts.user_yes_account.amount
    } else {
        ctx.accounts.user_no_account.amount
    };

    require!(
        user_token_balance >= amount_in,
        PredictionMarketError::InsufficientBalance
    );

    if yes {
        let token_transfer = Transfer {
            from: ctx.accounts.user_yes_account.to_account_info(),
            to: ctx.accounts.yes_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info().key(), token_transfer),
            amount_in,
        )?;
    } else {
        let token_transfer = Transfer {
            from: ctx.accounts.user_no_account.to_account_info(),
            to: ctx.accounts.no_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        transfer(
            CpiContext::new(ctx.accounts.token_program.to_account_info().key(), token_transfer),
            amount_in,
        )?;
    }

    let market_key = ctx.accounts.market.key();
    let bump = [ctx.bumps.amm_authority];

    let signer_seeds: &[&[u8]] = &[b"amm-authority", market_key.as_ref(), &bump];

    let signer = &[signer_seeds];

    let payment_transfer = Transfer {
        from: ctx.accounts.payment_vault.to_account_info(),
        to: ctx.accounts.user_payment_account.to_account_info(),
        authority: ctx.accounts.amm_authority.to_account_info(),
    };

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info().key(),
            payment_transfer,
            signer,
        ),
        amount_out,
    )?;

    Ok(())
}
