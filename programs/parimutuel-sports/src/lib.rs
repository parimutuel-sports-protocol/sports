use std::str::FromStr;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, Transfer},
};
use switchboard_v2::AggregatorAccountData;

declare_id!("BvnkwA2K3R41Hex1M56ck5BQktu7RBKLaEFqitiLNDHU");

const MARKET_STATE_SEED: &'static [u8] = b"market_state";
const MARKET_WALLET_SEED: &'static [u8] = b"market_wallet";
const USER_STATE_SEED: &'static [u8] = b"user_state";

const PLATFORM_FEES: u8 = 1;
const PLATFORM_WALLET: &str = "Ezn2vzUx19ph7vXw4YEK5WrTHSA5RccnVpn1nuWz5dEX";

pub fn calculate_multipler(mut multiplier: u32, minutes: u32) -> (u32, u32) {
    let mut iterations = 1;
    while multiplier != 1 {
        multiplier = multiplier / 2;
        iterations += 1;
    }
    let multiplier_half_time = minutes / iterations;
    return (iterations, multiplier_half_time);
}

pub fn get_current_multiplier(
    initial_multiplier: u32,
    minutes_left: u32,
    initial_minutes: u32,
) -> u32 {
    let mut multiplier = initial_multiplier;
    let (iterations, multiplier_half_time) =
        calculate_multipler(initial_multiplier, initial_minutes);
    if multiplier_half_time == 0 {
        return multiplier;
    }
    let pow = (initial_minutes - minutes_left) / multiplier_half_time;
    let mut i = 0;
    while i < pow {
        multiplier = multiplier / 2;
        i += 1;
    }
    return multiplier;
}

pub fn get_minutes(current_time: u64, expiry_time: u64) -> u32 {
    let diff = expiry_time - current_time;
    let minutes = (diff / (60)) as u32;
    return minutes;
}

pub fn get_linear_multiplier(initial_multiplier: f64, total_time: f64, time_left: f64) -> f64 {
    let multiplier = (time_left / total_time) * initial_multiplier;
    if multiplier < 1.0 {
        return 1.0;
    }
    ((multiplier * 10.0).round())/10.0
}

pub fn get_win_amount(
    total_winnable_amount: u64,
    total_weighted_amount: u64,
    total_weighted_win_amount: u64,
    personal_weighted_amount: u64,
    personal_bet_amount: u64,
) -> u64 {
    let win_ratio = (total_weighted_amount as f64) / (total_weighted_win_amount as f64);
    let personal_weighted_win_amount = win_ratio * (personal_weighted_amount as f64);
    let winnings = personal_bet_amount
        + ((personal_weighted_win_amount * (total_winnable_amount as f64))
            / (total_weighted_amount as f64)) as u64;
    return winnings;
}

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
        initial_multiplier: u32,
    ) -> Result<()> {
        let market_state = &mut ctx.accounts.market_state;

        market_state.game_id = game_id;
        market_state.feed = feed;
        market_state.start_time = Clock::get()?.unix_timestamp as u64;
        market_state.expiry_time = expiry_time;
        market_state.creator_fees = creator_fees;
        market_state.creator = ctx.accounts.creator.key();
        market_state.token_mint = ctx.accounts.token_mint.key();
        market_state.creator_token_account = ctx.accounts.creator_token_account.key();
        market_state.platform_fees_settled = false;
        market_state.initial_multiplier = initial_multiplier;

        let mut total_outcomes: Vec<Outcome> = Vec::new();
        for index in 0..outcomes.len() {
            let new_outcome = Outcome {
                total_bet_amount: 0,
                total_bets: 0,
                total_weighted_bet_amount: 0,
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
        current_time: u64,
    ) -> Result<()> {
        let market_state = &mut ctx.accounts.market_state;
        let user_bet_state = &mut ctx.accounts.user_bet_state;

        let initial_multiplier = market_state.initial_multiplier;
        let start_time = market_state.start_time;
        let expiry_time = market_state.expiry_time;
        // let current_time = Clock::get()?.unix_timestamp as u64;

        if expiry_time < current_time {
            return Err(error!(ErrorCodes::MarketExpired));
        }

        let token_mint = market_state.token_mint;
        let user_token_mint = ctx.accounts.token_mint.key();
        if token_mint != user_token_mint {
            return Err(error!(ErrorCodes::MarketExpired));
        }

        let time_left = expiry_time - current_time;
        let total_time = expiry_time - start_time;
        let linear_multiplier = get_linear_multiplier(
            initial_multiplier as f64,
            total_time as f64,
            time_left as f64,
        );
        msg!("This is linear multiplier {}", linear_multiplier);

        let weighted_bet_amount = (linear_multiplier * (bet_amount as f64)) as u64;

        // // Multiplier testing scenarios
        // msg!("initial multipler: 20, initial seconds: 46");
        // let mut multiplier = get_current_multiplier(20, 41, 46);
        // msg!("hours left: 41 and multipler: {}", multiplier);
        // multiplier = get_current_multiplier(20, 36, 46);
        // msg!("hours left: 36 and multipler: {}", multiplier);
        // multiplier = get_current_multiplier(20, 29, 46);
        // msg!("hours left: 29 and multipler: {}", multiplier);
        // multiplier = get_current_multiplier(20, 20, 46);
        // msg!("hours left: 20 and multipler: {}", multiplier);
        // multiplier = get_current_multiplier(20, 15, 46);
        // msg!("hours left: 15 and multipler: {}", multiplier);
        // multiplier = get_current_multiplier(20, 5, 46);
        // msg!("hours left: 5 and multipler: {}", multiplier);

        // Multiplier testing scenarios
        msg!("initial multipler: 8, initial seconds:  7000");
        let mut multiplier = get_linear_multiplier(8.0, 7000.0, 6500.0);
        msg!("hours left: 6500 and multipler: {}", multiplier);
        multiplier = get_linear_multiplier(8.0, 7000.0, 5500.0);
        msg!("hours left: 5500 and multipler: {}", multiplier);
        multiplier = get_linear_multiplier(8.0, 7000.0, 4500.0);
        msg!("hours left: 4500 and multipler: {}", multiplier);
        multiplier = get_linear_multiplier(8.0, 7000.0, 3500.0);
        msg!("hours left: 3500 and multipler: {}", multiplier);
        multiplier = get_linear_multiplier(8.0, 7000.0, 2500.0);
        msg!("hours left: 2500 and multipler: {}", multiplier);
        multiplier = get_linear_multiplier(8.0, 7000.0, 1500.0);
        msg!("hours left: 1500 and multipler: {}", multiplier);
        multiplier = get_linear_multiplier(8.0, 7000.0, 500.0);
        msg!("hours left: 500 and multipler: {}", multiplier);

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
                bet: bet_amount,
                weighted_bet_amount: weighted_bet_amount,
            };
            bets.push(user_bet);
            user_bet_state.bets = bets;
        } else {
            let bets = &mut user_bet_state.bets;
            let mut bet_index = usize::MAX;
            for i in 0..bets.len() {
                if bets[i].name == outcome {
                    bet_index = i;
                    break;
                }
            }
            msg!(
                "this is bet index {} and outcome index {}",
                bet_index,
                outcome_index
            );
            if bet_index == usize::MAX {
                let user_bet = UserOutcome {
                    name: outcome,
                    expected_result: outcomes[outcome_index].expected_result,
                    bet: bet_amount,
                    weighted_bet_amount,
                };
                bets.push(user_bet);
            } else {
                bets[bet_index].bet += bet_amount;
                bets[bet_index].weighted_bet_amount += weighted_bet_amount;
            }
        }
        outcomes[outcome_index].total_bet_amount += bet_amount;
        outcomes[outcome_index].total_bets += 1;
        outcomes[outcome_index].total_weighted_bet_amount += weighted_bet_amount;

        Ok(())
    }

    pub fn settle(ctx: Context<Settle>, game_id: String, state_bump: u8) -> Result<()> {
        let market_state = &mut ctx.accounts.market_state;
        let user_bet_state = &mut ctx.accounts.user_bet_state;

        let market_state_address = market_state.to_account_info();
        let creator_fee_percent = market_state.creator_fees;
        let fees_settled = market_state.platform_fees_settled;
        let expiry_time = market_state.expiry_time;
        let current_time = Clock::get()?.unix_timestamp as u64;

        // if expiry_time > current_time {
        //     return Err(error!(ErrorCodes::BettingNotOver));
        // }

        let oracle_key = &ctx.accounts.switchboard_aggregator;
        if oracle_key.key() != market_state.feed {
            return Err(error!(ErrorCodes::InvalidFeedKey));
        }

        let feed = oracle_key.load()?;
        // get result
        let val: u64 = feed.get_result()?.try_into()?;

        msg!("This is value from oracle {}", val);

        let mut win = false;
        let outcomes = market_state.outcomes.clone();
        let user_bets = &user_bet_state.bets;
        let mut outcome_index = usize::MAX;
        let mut total_pool = 0;
        let mut total_weighted_pool = 0;
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
            total_weighted_pool += outcomes[i].total_weighted_bet_amount;
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
            return Err(error!(ErrorCodes::ResultNotAnnounced));
        }

        msg!("This is result {}", win);

        if win {
            let platform_fees = (total_pool * PLATFORM_FEES as u64) / 100;
            let creator_fees = (total_pool * creator_fee_percent as u64) / 100;
            total_pool = total_pool - platform_fees - creator_fees;

            let bump_vector = state_bump.to_le_bytes();
            let inner = vec![
                MARKET_STATE_SEED,
                game_id.as_bytes()[..18].as_ref(),
                game_id.as_bytes()[18..].as_ref(),
                bump_vector.as_ref(),
            ];
            let outer = vec![inner.as_slice()];

            if !fees_settled {
                if ctx.accounts.platform_wallet.key() != Pubkey::from_str(PLATFORM_WALLET).unwrap()
                {
                    return Err(error!(ErrorCodes::InvalidPlatformWallet));
                }

                if ctx.accounts.creator_wallet.key() != market_state.creator_token_account {
                    return Err(error!(ErrorCodes::InvalidCreatorWallet));
                }

                // Transfer to platform wallet
                let transfer_instruction = Transfer {
                    from: ctx.accounts.market_wallet.to_account_info(),
                    to: ctx.accounts.platform_wallet.to_account_info(),
                    authority: market_state_address.clone(),
                };
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_instruction,
                    outer.as_slice(), //signer PDA
                );

                anchor_spl::token::transfer(cpi_ctx, platform_fees)?;
                msg!("Platform transferred {}", platform_fees);

                // Transfer to creator wallet
                let transfer_instruction = Transfer {
                    from: ctx.accounts.market_wallet.to_account_info(),
                    to: ctx.accounts.creator_wallet.to_account_info(),
                    authority: market_state_address.clone(),
                };
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_instruction,
                    outer.as_slice(), //signer PDA
                );

                anchor_spl::token::transfer(cpi_ctx, creator_fees)?;
                msg!("Creator transferred {}", creator_fees);

                market_state.platform_fees_settled = true;
            }
            let user_bet_amount = user_bet_state.bets[user_bet_win_index].bet;
            // let winnings =
            //     (user_bet_amount * total_pool) / outcomes[outcome_index].total_bet_amount;
            let total_weighted_win_amount = outcomes[outcome_index].total_weighted_bet_amount;
            let total_win_amount = outcomes[outcome_index].total_bet_amount;
            let user_weighted_bet_amount =
                user_bet_state.bets[user_bet_win_index].weighted_bet_amount;
            let total_winnable_pool = total_pool - total_win_amount;
            let winnings = get_win_amount(
                total_winnable_pool,
                total_weighted_pool,
                total_weighted_win_amount,
                user_weighted_bet_amount,
                user_bet_amount,
            );
            msg!(
                "This is winnings {} {} {} {}",
                winnings,
                total_pool,
                user_weighted_bet_amount,
                user_bet_amount
            );
            // Transfer the bet amount to the pool

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

            user_bet_state.settled = true;
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
    #[account(
        mut,
        constraint=creator_token_account.owner == creator.key(),
        constraint=creator_token_account.mint == token_mint.key()
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    // pub switchboard_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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
    #[account(init_if_needed, payer = bettor, seeds = [USER_STATE_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref(), bettor.key().as_ref()],bump, space = 500)]
    pub user_bet_state: Account<'info, UserBet>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut, seeds = [MARKET_WALLET_SEED, game_id.as_bytes()[..18].as_ref(), game_id.as_bytes()[18..].as_ref()], bump)]
    pub market_wallet: Account<'info, TokenAccount>,
    // pub switchboard_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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
    #[account(mut)]
    pub creator_wallet: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub platform_wallet: Box<Account<'info, TokenAccount>>,
    pub switchboard_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub struct Outcome {
    pub total_bets: u64,                // 8
    pub total_bet_amount: u64,          // 8
    pub total_weighted_bet_amount: u64, // 8
    pub name: String,                   // 40
    pub expected_result: u64,           // 8
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq)]
pub struct UserOutcome {
    pub name: String, // 40
    pub expected_result: u64,
    pub bet: u64,
    pub weighted_bet_amount: u64,
}

#[account]
pub struct Market {
    pub game_id: String,
    pub start_time: u64,
    pub expiry_time: u64,
    pub feed: Pubkey,
    pub creator: Pubkey,
    pub creator_fees: u8,
    pub creator_token_account: Pubkey,
    pub outcomes: Vec<Outcome>,
    pub token_mint: Pubkey,
    pub initial_multiplier: u32,
    pub platform_fees_settled: bool,
}

#[account]
pub struct UserBet {
    pub bets: Vec<UserOutcome>,
    pub settled: bool,
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
    #[msg("The platform wallet provided does not match the platform wallet")]
    InvalidPlatformWallet,
    #[msg("The creator wallet provided does not match the creator wallet of the game")]
    InvalidCreatorWallet,
}
