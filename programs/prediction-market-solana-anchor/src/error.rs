use anchor_lang::prelude::*;



#[error_code]
pub enum PredictionMarketError {
    #[msg("Endtime Must Be Greater Than Start Time")]
    InValidEndTime,

    #[msg("Fee Bps Must Be Less Than 1000")]
    InValidFeeBps,

    #[msg("Question Must Not Be Empty")]
    InValidQuestion,

    #[msg("Question Must Not Be Empty")]
    QuestionIsTooLong,

    #[msg("Invalid Market")]
    InvalidMarket,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("No Refund Available")]
    NoRefundAvailable,

    #[msg("Insufficient Balance")]
    InsufficientBalance,

    #[msg("Market Not Cancelled")]
    MarketNotCancelled,

    #[msg("Already Refunded")]
    AlreadyRefunded,
    #[msg("Insufficient Vault Funds")]
    InsufficientVaultFunds,

    #[msg("No Winning Shares")]
    NoWinningShares,

    #[msg("Already Claimed")]
    AlreadyClaimed,

    #[msg("Market Not Resolved Yet")]
    MarketNotResolved,


    #[msg("Invalid Position")]
    InvalidPosition,
    #[msg("Invalid Amount . Amount must be greater than 0")]
    InvalidAmount,

    #[msg("Market Already Resolved")]
    MarketAlreadyResolved,

    #[msg("Invalid Outcome")]
    InvalidOutcome,

    #[msg("Invalid Mint ")]
    InvalidMint,

    #[msg("Market Closed")]
    MarketClosed,

    #[msg("Math Overflow Cannot be Increased")]
    MathOverflow,

    #[msg("Market Not Ended")]
    MarketNotEnded,
}
