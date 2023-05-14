use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

const MARKET_STATE_SEED: &'static [u8] = b"market_state";
const MARKET_WALLET_SEED: &'static [u8] = b"market_wallet";
#[program]
pub mod parimutuel_sports {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, game_id: String) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(init, payer = creator, seeds = [MARKET_STATE_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()],bump, space = 1000)]
    pub market: Account<'info, Market>,
    pub another_wallet: Account<'info, TokenAccount>,
    pub token_mint: Account<'info, Mint>,
    #[account(init, payer = creator, seeds = [MARKET_WALLET_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()], bump, token::mint = token_mint, token::authority = market)]
    pub market_wallet: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}



#[account]
pub struct Market {
    pub game_id: String,
    pub win_odds: u8,
    pub loss_odds: u8,
    pub game_label: String,
    pub end_time: u64,
    pub buffer_time: u64,
    pub token_mint: Pubkey,
    pub position_count: u8,
    pub creator: Pubkey,
}
