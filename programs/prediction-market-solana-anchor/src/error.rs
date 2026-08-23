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


    #[msg("Invalid Amount . Amount must be greater than 0")]
    InvalidAmount,

    #[msg("Market Already Resolved")]
    MarketAlreadyResolved,
}
