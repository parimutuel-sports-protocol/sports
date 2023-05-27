import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ParimutuelSports } from "../target/types/parimutuel_sports";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";
const assert = require("assert");
import * as spl from "@solana/spl-token";
import { v4 as uuidv4 } from "uuid";
import { PublicKey } from "@solana/web3.js";

describe("parimutuel-sports", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  console.log(provider.connection.rpcEndpoint);

  const program = anchor.workspace
    .ParimutuelSports as Program<ParimutuelSports>;

  // TODO: Add docs of what each of whese keys represent.
  let alice: anchor.web3.Keypair; // Just another Keypair
  let bob: anchor.web3.Keypair; // Just another Keypair
  let cas: anchor.web3.Keypair; // stakeholder who would stake on the application
  let dan: anchor.web3.Keypair; // Just another keypair
  let admin: anchor.web3.Keypair; // This is the authority which is responsible for creating job, application and changing state of application

  let USDCMint: anchor.web3.PublicKey; // token which would be staked
  let casTokenAccount: any; // cas token account
  let aliceTokenAccount: any; // alice Token account

  let initialMintAmount = 100000000;
  const stakeAmount = 4000;
  const maxAmountPerApplication = 10000;

  if (provider.connection.rpcEndpoint == "http://localhost:8899") {
    alice = anchor.web3.Keypair.generate(); // HR
    bob = anchor.web3.Keypair.generate(); // Applicant
    cas = anchor.web3.Keypair.generate(); // Stakeholder
    dan = anchor.web3.Keypair.generate(); // Stakeholder
    admin = anchor.web3.Keypair.generate(); // Admin

    it("Funds all users", async () => {
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(alice.publicKey, 10000000000),
        "confirmed"
      );
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(bob.publicKey, 10000000000),
        "confirmed"
      );
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(cas.publicKey, 10000000000),
        "confirmed"
      );
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(dan.publicKey, 10000000000),
        "confirmed"
      );

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(admin.publicKey, 10000000000),
        "confirmed"
      );

      const aliceUserBalance = await provider.connection.getBalance(
        alice.publicKey
      );
      const bobUserBalance = await provider.connection.getBalance(
        bob.publicKey
      );
      const casUserBalance = await provider.connection.getBalance(
        cas.publicKey
      );
      const danUserBalance = await provider.connection.getBalance(
        dan.publicKey
      );
      const adminUserBalance = await provider.connection.getBalance(
        admin.publicKey
      );

      assert.strictEqual(10000000000, aliceUserBalance);
      assert.strictEqual(10000000000, bobUserBalance);
      assert.strictEqual(10000000000, casUserBalance);
      assert.strictEqual(10000000000, danUserBalance);
      assert.strictEqual(10000000000, adminUserBalance);
    });

    it("create USDC mint and mint some tokens to stakeholders", async () => {
      USDCMint = await spl.createMint(
        provider.connection,
        admin,
        admin.publicKey,
        null,
        6
      );

      casTokenAccount = await spl.createAccount(
        provider.connection,
        cas,
        USDCMint,
        cas.publicKey
      );

      aliceTokenAccount = await spl.createAccount(
        provider.connection,
        alice,
        USDCMint,
        alice.publicKey
      );

      await spl.mintTo(
        provider.connection,
        cas,
        USDCMint,
        casTokenAccount,
        admin.publicKey,
        initialMintAmount,
        [admin]
      );

      await spl.mintTo(
        provider.connection,
        alice,
        USDCMint,
        aliceTokenAccount,
        admin.publicKey,
        initialMintAmount,
        [admin]
      );

      let casTokenAccountUpdated = await spl.getAccount(
        provider.connection,
        casTokenAccount
      );
      let aliceTokenAccountUpdated = await spl.getAccount(
        provider.connection,
        aliceTokenAccount
      );

      assert.equal(initialMintAmount, casTokenAccountUpdated.amount);
      assert.equal(initialMintAmount, aliceTokenAccountUpdated.amount);
    });
  } else {
    // These are the private keys of accounts which i have created and have deposited some SOL in it.
    // Since we cannot airdrop much SOL on devnet (fails most of the time), i have previously airdropped some SOL so that these accounts
    // can be used for testing on devnet.
    // We can have them in another file and import them. But these are only for testing and has 0 balance on mainnet.
    const alicePrivate =
      "472ZS33Lftn7wdM31QauCkmpgFKFvgBRg6Z6NGtA6JgeRi1NfeZFRNvNi3b3sh5jvrQWrgiTimr8giVs9oq4UM5g";
    const casPrivate =
      "4CpgQ2g3KojCEpLwUDVjzFNWoMbvUqqQodHMPjN6B71mRy7dCuwWxCW8F9zjUrxsYDJyDpu1cbiERc8bkFR41USt";
    const adminPrivate =
      "2HKjYz8yfQxxhRS5f17FRCx9kDp7ATF5R4esLnKA4VaUsMA5zquP5XkQmvv9J5ZUD6wAjD4iBPYXDzQDNZmQ1eki";

    alice = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode(alicePrivate))
    );
    cas = anchor.web3.Keypair.generate();
    admin = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode(adminPrivate))
    );

    USDCMint = new anchor.web3.PublicKey(
      "CAb5AhUMS4EbKp1rEoNJqXGy94Abha4Tg4FrHz7zZDZ3"
    );

    it("Get the associated token account and mint tokens", async () => {
      // await provider.connection.confirmTransaction(
      //   await provider.connection.requestAirdrop(alice.publicKey, 100000000),
      //   "confirmed"
      // );

      const TempAliceTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
        provider.connection,
        alice,
        USDCMint,
        alice.publicKey,
        false
      );

      aliceTokenAccount = TempAliceTokenAccount.address;

      const _aliceTokenAccountBefore = await spl.getAccount(
        provider.connection,
        aliceTokenAccount 
      );

      await spl.mintTo(
        provider.connection,
        alice,
        USDCMint,
        aliceTokenAccount,
        admin.publicKey,
        initialMintAmount,
        [admin]
      );

      const _aliceTokenAccountAfter = await spl.getAccount(
        provider.connection,
        aliceTokenAccount
      );

      assert.equal(
        initialMintAmount,
        _aliceTokenAccountAfter.amount - _aliceTokenAccountBefore.amount
      );
    });
  }

  const gameId = uuidv4();
  const outcomes = ["HOME", "AWAY"];
  const feedKey = new PublicKey("GZkZoR3tRcEWfqkvXk2A6XQHpS2etN8rkD3NeP5VaRVe");

  it("create market", async () => {
    const [marketStatePDA, marketStateBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("market_state"),
          Buffer.from(gameId.substring(0, 18)),
          Buffer.from(gameId.substring(18, 36)),
        ],
        program.programId
      );

    const [marketPoolPDA, marketPoolBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("market_wallet"),
          Buffer.from(gameId.substring(0, 18)),
          Buffer.from(gameId.substring(18, 36)),
        ],
        program.programId
      );

    const expiryTime = Date.now() + 1000000;
    const tx = await program.methods
      .createMarket(gameId, feedKey, outcomes, new anchor.BN(expiryTime), 10)
      .accounts({
        creator: alice.publicKey,
        marketState: marketStatePDA,
        tokenMint: USDCMint,
        marketWallet: marketPoolPDA,
        // switchboardAggregator: feedKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([alice])
      .rpc();

    console.log("THis is tx for create market", tx);
  });

  it("bet", async () => {
    const [marketStatePDA, marketStateBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("market_state"),
          Buffer.from(gameId.substring(0, 18)),
          Buffer.from(gameId.substring(18, 36)),
        ],
        program.programId
      );

    const [marketPoolPDA, marketPoolBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("market_wallet"),
          Buffer.from(gameId.substring(0, 18)),
          Buffer.from(gameId.substring(18, 36)),
        ],
        program.programId
      );
    
    const [userStatePDA, userStateBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("user_state"),
        Buffer.from(gameId.substring(0, 18)),
        Buffer.from(gameId.substring(18, 36)),
        alice.publicKey.toBuffer()
      ],
      program.programId
    )

    const outcome = "HOME";
    const betAmount = 10000;
    try {
      const tx = await program.methods
      .bet(gameId, marketStateBump, outcome, new anchor.BN(betAmount))
      .accounts({
        bettor: alice.publicKey,
        bettorTokenAccount: aliceTokenAccount,
        marketState: marketStatePDA,
        userBetState: userStatePDA,
        tokenMint: USDCMint,
        marketWallet: marketPoolPDA,
        // switchboardAggregator: feedKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([alice])
      .rpc();
      console.log("THis is tx for bet", tx);
    } catch (error) {
      console.log("this is error", error);
    }
    

  });
});
