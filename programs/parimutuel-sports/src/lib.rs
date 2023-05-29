use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use switchboard_v2::AggregatorAccountData;

declare_id!("BvnkwA2K3R41Hex1M56ck5BQktu7RBKLaEFqitiLNDHU");

const MARKET_STATE_SEED: &'static [u8] = b"market_state";
const MARKET_WALLET_SEED: &'static [u8] = b"market_wallet";
const USER_STATE_SEED: &'static [u8] = b"user_state";

const PLATFORM_FEES: u8 = 1;
#[program]
pub mod parimutuel_sports {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        game_id: String,
        feed: Pubkey,
        outcomes: Vec<String>,
        expected_results: Vec<u64>,
        expiry_time: u64,
        creator_fees: u8,
    ) -> Result<()> {
        let market_state = &mut ctx.accounts.market_state;

        market_state.game_id = game_id;
        market_state.feed = feed;
        market_state.expiry_time = expiry_time;
        market_state.creator_fees = creator_fees;
        market_state.creator = ctx.accounts.creator.key();
        market_state.token_mint = ctx.accounts.token_mint.key();

        let mut total_outcomes: Vec<Outcome> = Vec::new();
        for index in 0..outcomes.len() {
            let new_outcome = Outcome {
                total_bet_amount: 0,
                total_bets: 0,
                expected_result: expected_results[index],
                name: outcomes[index].clone(),
            };
            total_outcomes.push(new_outcome);
        }
        market_state.outcomes = total_outcomes;
        Ok(())
    }

    pub fn bet(
        ctx: Context<Bet>,
        game_id: String,
        state_bump: u8,
        outcome: String,
        bet_amount: u64,
    ) -> Result<()> {
        let market_state = &mut ctx.accounts.market_state;
        let user_bet_state = &mut ctx.accounts.user_bet_state;

        let expiry_time = market_state.expiry_time;
        let current_time = Clock::get()?.unix_timestamp as u64;

        if expiry_time < current_time {
            return Err(error!(ErrorCodes::MarketExpired));
        }

        let token_mint = market_state.token_mint;
        let user_token_mint = ctx.accounts.token_mint.key();
        if token_mint != user_token_mint {
            return Err(error!(ErrorCodes::MarketExpired));
        }

        // Transfer the bet amount to the pool

        let bump_vector = state_bump.to_le_bytes();
        let inner = vec![
            MARKET_STATE_SEED,
            game_id.as_bytes()[..18].as_ref(),
            game_id.as_bytes()[18..].as_ref(),
            bump_vector.as_ref(),
        ];
        let outer = vec![inner.as_slice()];

        // Below is the actual instruction that we are going to send to the Token program.
        let transfer_instruction = Transfer {
            from: ctx.accounts.bettor_token_account.to_account_info(),
            to: ctx.accounts.market_wallet.to_account_info(),
            authority: ctx.accounts.bettor.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            outer.as_slice(), //signer PDA
        );

        anchor_spl::token::transfer(cpi_ctx, bet_amount)?;

        msg!("transfer happened");

        
        // user_bet_state.outcome = outcome.clone();
        // user_bet_state.bet = bet_amount;

        let outcomes = &mut market_state.outcomes;
        // let outcome_index = outcomes.iter().find(|&x| x.name == outcome).ok_or_else(err)
        let mut outcome_index = usize::MAX;
        for i in 0..outcomes.len() {
            if &outcomes[i].name == &outcome {
                outcome_index = i;
                break;
            }
        }

        if user_bet_state.bets.len() == 0 {
            let mut bets = Vec::new();
            let user_bet = UserOutcome {
                name: outcome,
                expected_result: outcomes[outcome_index].expected_result,
                bet: bet_amount
            };
            bets.push(user_bet);
            user_bet_state.bets = bets;
        } else {
            let bets = &mut user_bet_state.bets;
            let mut bet_index = usize::MAX;
            for i in 0..bets.len() {
                if bets[i].name == outcome {
                    bet_index = i;
                }
            }
            if bet_index == usize::MAX {
                let user_bet = UserOutcome {
                    name: outcome,
                    expected_result: outcomes[outcome_index].expected_result,
                    bet: bet_amount
                };
                bets.push(user_bet);
            } else {
                bets[bet_index].bet += bet_amount;
            }
        }
        outcomes[outcome_index].total_bet_amount += bet_amount;
        outcomes[outcome_index].total_bets += 1;

        Ok(())
    }

    pub fn settle(ctx: Context<Settle>, game_id: String, state_bump: u8) -> Result<()> {
        let market_state = &mut ctx.accounts.market_state;
        let user_bet_state = &mut ctx.accounts.user_bet_state;

        let expiry_time = market_state.expiry_time;
        let current_time = Clock::get()?.unix_timestamp as u64;

        // if expiry_time > current_time {
        //     return Err(error!(ErrorCodes::BettingNotOver));
        // } 

        let oracle_key = &ctx.accounts.switchboard_aggregator;
        if oracle_key.key() != market_state.feed {
            return Err(error!(ErrorCodes::InvalidFeedKey))
        }

        let feed = oracle_key.load()?;
        // get result
        let val: u64 = feed.get_result()?.try_into()?;

        msg!("This is value from oracle {}", val);

        let mut win = false;
        let outcomes = &mut market_state.outcomes;
        let user_bets = &user_bet_state.bets;
        let mut outcome_index = usize::MAX;
        let mut total_pool = 0;
        let mut user_bet_win_index = usize::MAX;
        
        for j in 0..user_bets.len() {
            if user_bets[j].expected_result == val {
                win = true;
                user_bet_win_index = j;
                break;
            }
        }

        let mut is_result_announced = false;

        for i in 0..outcomes.len() {
            total_pool += outcomes[i].total_bet_amount;
            if win {
                if outcomes[i].expected_result == user_bets[user_bet_win_index].expected_result {
                    outcome_index = i;
                }
            }
            if val == outcomes[i].expected_result {
                is_result_announced = true;
            }
        }


        if !is_result_announced {
            return Err(error!(ErrorCodes::ResultNotAnnounced))
        }



        msg!("This is result {}", win);

        if win {
            let user_bet_amount = user_bet_state.bets[user_bet_win_index].bet;
            let winnings = (user_bet_amount * total_pool) / outcomes[outcome_index].total_bet_amount;
            msg!("This is winnings {} {} {} ", winnings, total_pool, user_bet_amount);
            // Transfer the bet amount to the pool

            let bump_vector = state_bump.to_le_bytes();
            let inner = vec![
                MARKET_STATE_SEED,
                game_id.as_bytes()[..18].as_ref(),
                game_id.as_bytes()[18..].as_ref(),
                bump_vector.as_ref(),
            ];
            let outer = vec![inner.as_slice()];

            // Below is the actual instruction that we are going to send to the Token program.
            let transfer_instruction = Transfer {
                from: ctx.accounts.market_wallet.to_account_info(),
                to: ctx.accounts.bettor_token_account.to_account_info(),
                authority: ctx.accounts.market_state.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                outer.as_slice(), //signer PDA
            );

            anchor_spl::token::transfer(cpi_ctx, winnings)?;

            msg!("transfer happened");
            
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(init, payer = creator, seeds = [MARKET_STATE_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()],bump, space = 1000)]
    pub market_state: Account<'info, Market>,
    pub token_mint: Account<'info, Mint>,
    #[account(init, payer = creator, seeds = [MARKET_WALLET_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()], bump, token::mint = token_mint, token::authority = market_state)]
    pub market_wallet: Account<'info, TokenAccount>,
    // pub switchboard_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct Bet<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,
    #[account(
        mut,
        constraint=bettor_token_account.owner == bettor.key(),
        constraint=bettor_token_account.mint == token_mint.key()
    )]
    pub bettor_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [MARKET_STATE_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()],bump)]
    pub market_state: Account<'info, Market>,
    #[account(init, payer = bettor, seeds = [USER_STATE_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref(), bettor.key().as_ref()],bump, space = 48 + 8 + 8)]
    pub user_bet_state: Account<'info, UserBet>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut, seeds = [MARKET_WALLET_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()], bump)]
    pub market_wallet: Account<'info, TokenAccount>,
    // pub switchboard_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(game_id: String)]
pub struct Settle<'info> {
    #[account(mut)]
    pub bettor: Signer<'info>,
    #[account(
        mut,
        constraint=bettor_token_account.owner == bettor.key(),
        constraint=bettor_token_account.mint == token_mint.key()
    )]
    pub bettor_token_account: Account<'info, TokenAccount>,
    #[account(mut, seeds = [MARKET_STATE_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()],bump)]
    pub market_state: Account<'info, Market>,
    #[account(mut, seeds = [USER_STATE_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref(), bettor.key().as_ref()],bump)]
    pub user_bet_state: Account<'info, UserBet>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut, seeds = [MARKET_WALLET_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()], bump)]
    pub market_wallet: Account<'info, TokenAccount>,
    pub switchboard_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub struct Outcome {
    pub total_bets: u64,       // 8
    pub total_bet_amount: u64, // 32*10
    pub name: String,          // 40
    pub expected_result: u64,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub struct UserOutcome {
    pub name: String,          // 40
    pub expected_result: u64,
    pub bet: u64
}


#[account]
pub struct Market {
    pub game_id: String,
    pub expiry_time: u64,
    pub feed: Pubkey,
    pub creator: Pubkey,
    pub creator_fees: u8,
    pub outcomes: Vec<Outcome>,
    pub token_mint: Pubkey,
}

#[account]
pub struct UserBet {
    pub bets: Vec<UserOutcome>,
}

#[error_code]
#[derive(Eq, PartialEq)]
pub enum ErrorCodes {
    #[msg("Switchboard feed has not been updated in 5 minutes")]
    StaleFeed,
    #[msg("The betting is closed")]
    MarketExpired,
    #[msg("The market token mint doesnt match the user token mint")]
    TokenMintMismatch,
    #[msg("The betting is still open")]
    BettingNotOver,
    #[msg("The oracle feed key is not valid")]
    InvalidFeedKey,
    #[msg("The Game result is not announced yet")]
    ResultNotAnnounced,
}
