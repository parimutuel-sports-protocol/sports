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
  let x: anchor.web3.Keypair;

  let USDCMint: anchor.web3.PublicKey; // token which would be staked
  let bobTokenAccount: any; // bob token account
  let casTokenAccount: any; // cas token account
  let aliceTokenAccount: any; // alice Token account
  let adminTokenAccount: any; // admin Token account

  let initialMintAmount = 10000000000_000000;

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
    const bobPrivate =
      "32xvprYYtFrmoUn9YnEVJ6GUyJ613Qs5abbKCr7gPj2wiCeksUGFRzgDsUEjCKP6WSkMzcBZfnhguMs8JkH4UMGP";

    alice = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode(alicePrivate))
    );
    bob = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode(bobPrivate))
    );
    cas = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode(casPrivate))
    );
    admin = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode(adminPrivate))
    );

    x = anchor.web3.Keypair.fromSecretKey(
      new Uint8Array(bs58.decode('4uVWvi3EgR9nGR7cYQGr1JVfQ1otgDpCVuoGeafZ8d1cwa7aRHQgCvo89JqhsJgujAZTqzd13k98b4iV2ndxbwAs'))
    );

    const treasuryPDA = new PublicKey("BHdA5vdCrGygMYRV611djrArupdiSgraG5sCnauE3S7");

    USDCMint = new anchor.web3.PublicKey(
      "CAb5AhUMS4EbKp1rEoNJqXGy94Abha4Tg4FrHz7zZDZ3"
    );

    it("Get the associated token account and mint tokens", async () => {
      // await provider.connection.confirmTransaction(
      //   await provider.connection.requestAirdrop(x.publicKey, 100000000),
      //   "confirmed"
      // );

      const TempAliceTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
        provider.connection,
        alice,
        USDCMint,
        alice.publicKey,
        false
      );

      const TempBobTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
        provider.connection,
        bob,
        USDCMint,
        bob.publicKey,
        false
      );

      const TempCasTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
        provider.connection,
        cas,
        USDCMint,
        cas.publicKey,
        false
      );

      const TempAdminTokenAccount = await spl.getOrCreateAssociatedTokenAccount(
        provider.connection,
        admin,
        USDCMint,
        admin.publicKey,
        false
      );

      aliceTokenAccount = TempAliceTokenAccount.address;
      bobTokenAccount = TempBobTokenAccount.address;
      casTokenAccount = TempCasTokenAccount.address;
      adminTokenAccount = TempAdminTokenAccount.address;

      const _aliceTokenAccountBefore = await spl.getAccount(
        provider.connection,
        aliceTokenAccount
      );
      const _bobTokenAccountBefore = await spl.getAccount(
        provider.connection,
        bobTokenAccount
      );
      const _casTokenAccountBefore = await spl.getAccount(
        provider.connection,
        casTokenAccount
      );
      const _adminTokenAccountBefore = await spl.getAccount(
        provider.connection,
        adminTokenAccount
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

      await spl.mintTo(
        provider.connection,
        bob,
        USDCMint,
        bobTokenAccount,
        admin.publicKey,
        initialMintAmount,
        [admin]
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
        admin,
        USDCMint,
        adminTokenAccount,
        admin.publicKey,
        initialMintAmount,
        [admin]
      );

      await spl.mintTo(
        provider.connection,
        admin,
        USDCMint,
        treasuryPDA,
        admin.publicKey,
        initialMintAmount,
        [admin]
      )

      const _aliceTokenAccountAfter = await spl.getAccount(
        provider.connection,
        aliceTokenAccount
      );
      const _bobTokenAccountAfter = await spl.getAccount(
        provider.connection,
        bobTokenAccount
      );
      const _casTokenAccountAfter = await spl.getAccount(
        provider.connection,
        casTokenAccount
      );
      const _adminTokenAccountAfter = await spl.getAccount(
        provider.connection,
        adminTokenAccount
      );

      assert.equal(
        initialMintAmount,
        _aliceTokenAccountAfter.amount - _aliceTokenAccountBefore.amount
      );
      assert.equal(
        initialMintAmount,
        _bobTokenAccountAfter.amount - _bobTokenAccountBefore.amount
      );
      assert.equal(
        initialMintAmount,
        _casTokenAccountAfter.amount - _casTokenAccountBefore.amount
      );
      assert.equal(
        initialMintAmount,
        _adminTokenAccountAfter.amount - _adminTokenAccountBefore.amount
      );
    });
  }

  const gameId = uuidv4();
  console.log("This is gameID", gameId);
  // const outcomes = [
  //   "Alonso",
  //   "Albon",
  //   "Bottas",
  //   "Gasly",
  //   "Hamilton",
  //   "Hulkenberg",
  //   "Magnussen",
  //   "Norris",
  //   "Perez",
  //   "Piastri",
  //   "Sainz",
  //   "Sergio",
  //   "Stroll",
  //   "Tsunoda",
  //   "Verstappen",
  //   "Zhou",
  // ];
  // const results = [
  //   new anchor.BN(14),
  //   new anchor.BN(23),
  //   new anchor.BN(77),
  //   new anchor.BN(10),
  //   new anchor.BN(44),
  //   new anchor.BN(27),
  //   new anchor.BN(20),
  //   new anchor.BN(4),
  //   new anchor.BN(11),
  //   new anchor.BN(81),
  //   new anchor.BN(55),
  //   new anchor.BN(15),
  //   new anchor.BN(18),
  //   new anchor.BN(22),
  //   new anchor.BN(1),
  //   new anchor.BN(24),
  // ];
  const outcomes = ["India", "Australia"];
  const results = [new anchor.BN(1), new anchor.BN(2)];
  const feedKey = new PublicKey("GVmpRFXTV2NHxKsKF1w5FFEdnha6aSfXWUyEJukm7i3n");
  const initialMultiplier = 8;
  // const realExpiryTimestamp = (new Date("06/04/2023 06:25:00 PM").getTime())/1000;
  const currentTime = Date.now() / 1000;
  const realExpiryTimestamp = currentTime + 100000;
  // console.log("real expiry time", realExpiryTimestamp, Date.parse("06/04/2023 06:25:00 PM"), currentTime);
  const futureTime = currentTime;
  const expiryTime = currentTime + 10000;

  const getMarketStatePDA = (gameId) => {
    const [marketStatePDA, marketStateBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("market_state"),
          Buffer.from(gameId.substring(0, 18)),
          Buffer.from(gameId.substring(18, 36)),
        ],
        program.programId
      );
    return { marketStatePDA, marketStateBump };
  };

  const getMarketPoolPDA = (gameId) => {
    const [marketPoolPDA, marketPoolBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("market_wallet"),
          Buffer.from(gameId.substring(0, 18)),
          Buffer.from(gameId.substring(18, 36)),
        ],
        program.programId
      );
    return { marketPoolPDA, marketPoolBump };
  };

  const getUserStatePDA = (gameId, userKey) => {
    const [userStatePDA, userStateBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_state"),
          Buffer.from(gameId.substring(0, 18)),
          Buffer.from(gameId.substring(18, 36)),
          userKey.toBuffer(),
        ],
        program.programId
      );
    return { userStatePDA, userStateBump };
  };

  const getPlatformStatePDA = () => {
    const [platformStatePDA, platformStateBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("platform_state")],
        program.programId
      );
    return { platformStatePDA, platformStateBump };
  };

  const getPlatformWalletPDA = () => {
    const [platformWalletPDA, platformWalletBump] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("platform_wallet")],
        program.programId
      );
    return { platformWalletPDA, platformWalletBump };
  };

  it("create market", async () => {
    const { marketStatePDA, marketStateBump } = getMarketStatePDA(gameId);
    const { marketPoolPDA, marketPoolBump } = getMarketPoolPDA(gameId);

    const tx = await program.methods
      .createMarket(
        gameId,
        feedKey,
        outcomes,
        results,
        new anchor.BN(realExpiryTimestamp),
        1,
        initialMultiplier
      )
      .accounts({
        creator: alice.publicKey,
        marketState: marketStatePDA,
        tokenMint: USDCMint,
        marketWallet: marketPoolPDA,
        creatorTokenAccount: aliceTokenAccount,
        // switchboardAggregator: feedKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([alice])
      .rpc();

    console.log("THis is tx for create market", tx);
  });

  it("test tokens distribution", async () => {
    const { marketStatePDA, marketStateBump } = getMarketStatePDA(gameId);
    const { platformStatePDA, platformStateBump } = getPlatformStatePDA();
    const { platformWalletPDA, platformWalletBump } = getPlatformWalletPDA();

    const ownerTokenAccount = await spl.getAssociatedTokenAddress(USDCMint, x.publicKey);

    const tx = await program.methods
      .getToken(gameId, new anchor.BN(100 * 10**6), platformStateBump)
      .accounts({
        owner: x.publicKey,
        ownerTokenAccount: ownerTokenAccount,
        platformState: platformStatePDA,
        platformWallet: platformWalletPDA,
        marketState: marketStatePDA,
        tokenMint: USDCMint,
        platformSolWallet: alice.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: spl.TOKEN_PROGRAM_ID,
        associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      }).signers([x]).rpc();
    
    console.log("This is tx", tx);
  });

  // it("bet", async () => {
  //   const {marketStatePDA, marketStateBump} = getMarketStatePDA(gameId);
  //   const {marketPoolPDA, marketPoolBump} = getMarketPoolPDA(gameId);

  //   const {userStatePDA: aliceStatePDA, userStateBump: aliceStateBump} = getUserStatePDA(gameId, alice.publicKey);
  //   const {userStatePDA: bobStatePDA, userStateBump: bobStateBump} = getUserStatePDA(gameId, bob.publicKey);
  //   const {userStatePDA: casStatePDA, userStateBump: casStateBump} = getUserStatePDA(gameId, cas.publicKey);
  //   const {userStatePDA: adminStatePDA, userStateBump: adminStateBump} = getUserStatePDA(gameId, admin.publicKey);

  //   const homeOutcome = "India";
  //   const awayOutcome = "Australia";
  //   const betAmount = 10000;
  //   try {
  //     // Alice bets on AWAY
  //     const aliceTx = await program.methods
  //     .bet(gameId, marketStateBump, awayOutcome, new anchor.BN(betAmount), new anchor.BN(currentTime))
  //     .accounts({
  //       bettor: alice.publicKey,
  //       bettorTokenAccount: aliceTokenAccount,
  //       marketState: marketStatePDA,
  //       userBetState: aliceStatePDA,
  //       tokenMint: USDCMint,
  //       marketWallet: marketPoolPDA,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       tokenProgram: spl.TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //     })
  //     .signers([alice])
  //     .rpc();
  //     console.log("THis is tx for alice", aliceTx);
  //     // bob bets on HOME
  //     const bobTx1 = await program.methods
  //     .bet(gameId, marketStateBump, homeOutcome, new anchor.BN(betAmount), new anchor.BN(futureTime))
  //     .accounts({
  //       bettor: bob.publicKey,
  //       bettorTokenAccount: bobTokenAccount,
  //       marketState: marketStatePDA,
  //       userBetState: bobStatePDA,
  //       tokenMint: USDCMint,
  //       marketWallet: marketPoolPDA,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       tokenProgram: spl.TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //     })
  //     .signers([bob])
  //     .rpc();

  //     // const bobTx2 = await program.methods
  //     // .bet(gameId, marketStateBump, awayOutcome, new anchor.BN(betAmount * 2), new anchor.BN(futureTime))
  //     // .accounts({
  //     //   bettor: bob.publicKey,
  //     //   bettorTokenAccount: bobTokenAccount,
  //     //   marketState: marketStatePDA,
  //     //   userBetState: bobStatePDA,
  //     //   tokenMint: USDCMint,
  //     //   marketWallet: marketPoolPDA,
  //     //   systemProgram: anchor.web3.SystemProgram.programId,
  //     //   tokenProgram: spl.TOKEN_PROGRAM_ID,
  //     //   associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
  //     //   rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //     // })
  //     // .signers([bob])
  //     // .rpc();

  //     // Cas bets on HOME
  //     const casTx = await program.methods
  //     .bet(gameId, marketStateBump, homeOutcome, new anchor.BN(betAmount), new anchor.BN(currentTime))
  //     .accounts({
  //       bettor: cas.publicKey,
  //       bettorTokenAccount: casTokenAccount,
  //       marketState: marketStatePDA,
  //       userBetState: casStatePDA,
  //       tokenMint: USDCMint,
  //       marketWallet: marketPoolPDA,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       tokenProgram: spl.TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //     })
  //     .signers([cas])
  //     .rpc();

  //     // Admin bets on Away
  //     const adminTx = await program.methods
  //     .bet(gameId, marketStateBump, awayOutcome, new anchor.BN(betAmount), new anchor.BN(futureTime))
  //     .accounts({
  //       bettor: admin.publicKey,
  //       bettorTokenAccount: adminTokenAccount,
  //       marketState: marketStatePDA,
  //       userBetState: adminStatePDA,
  //       tokenMint: USDCMint,
  //       marketWallet: marketPoolPDA,
  //       systemProgram: anchor.web3.SystemProgram.programId,
  //       tokenProgram: spl.TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //     })
  //     .signers([admin])
  //     .rpc();

  //     // console.log("THis is tx for bet", tx);
  //   } catch (error) {
  //     console.log("this is error in bet", error);
  //   }

  // });

  // it("settle", async () => {
  //   const {marketStatePDA, marketStateBump} = getMarketStatePDA(gameId);
  //   const {marketPoolPDA, marketPoolBump} = getMarketPoolPDA(gameId);

  //   const {userStatePDA: bobStatePDA, userStateBump: bobStateBump} = getUserStatePDA(gameId, bob.publicKey);
  //   const {userStatePDA: casStatePDA, userStateBump: casStateBump} = getUserStatePDA(gameId, cas.publicKey);

  //   const outcome = "HOME";
  //   const betAmount = 10000;
  //   try {
  //     // Alice and Bob has won

  //     const _bobTokenAccountBefore = await spl.getAccount(
  //       provider.connection,
  //       bobTokenAccount
  //     );
  //     console.log("Bob TOKEN Balance before: ", _bobTokenAccountBefore.amount);

  //     const bobTx = await program.methods
  //     .settle(gameId, marketStateBump)
  //     .accounts({
  //       bettor: bob.publicKey,
  //       bettorTokenAccount: bobTokenAccount,
  //       marketState: marketStatePDA,
  //       userBetState: bobStatePDA,
  //       tokenMint: USDCMint,
  //       marketWallet: marketPoolPDA,
  //       platformWallet: aliceTokenAccount,
  //       creatorWallet: aliceTokenAccount,
  //       switchboardAggregator: feedKey,
  //       tokenProgram: spl.TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //     })
  //     .signers([bob])
  //     .rpc();

  //     const _bobTokenAccountAfter = await spl.getAccount(
  //       provider.connection,
  //       bobTokenAccount
  //     );
  //     console.log("bob TOKEN Balance After: ", _bobTokenAccountAfter.amount);
  //     console.log("bob TOKEN difference: ", _bobTokenAccountAfter.amount - _bobTokenAccountBefore.amount);

  //     // console.log("This is tx for settle bob", bobTx);

  //     const _casTokenAccountBefore = await spl.getAccount(
  //       provider.connection,
  //       casTokenAccount
  //     );
  //     console.log("Cas TOKEN Balance before: ", _casTokenAccountBefore.amount);

  //     const casTx = await program.methods
  //     .settle(gameId, marketStateBump)
  //     .accounts({
  //       bettor: cas.publicKey,
  //       bettorTokenAccount: casTokenAccount,
  //       marketState: marketStatePDA,
  //       userBetState: casStatePDA,
  //       tokenMint: USDCMint,
  //       marketWallet: marketPoolPDA,
  //       platformWallet: aliceTokenAccount,
  //       creatorWallet: aliceTokenAccount,
  //       switchboardAggregator: feedKey,
  //       tokenProgram: spl.TOKEN_PROGRAM_ID,
  //       associatedTokenProgram: spl.ASSOCIATED_TOKEN_PROGRAM_ID,
  //       rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //     })
  //     .signers([cas])
  //     .rpc();

  //     // console.log("This is tx for settle alice", casTx);
  //     const _casTokenAccountAfter = await spl.getAccount(
  //       provider.connection,
  //       casTokenAccount
  //     );
  //     console.log("cas TOKEN Balance After: ", _casTokenAccountAfter.amount);
  //     console.log("cas TOKEN difference: ", _casTokenAccountAfter.amount - _casTokenAccountBefore.amount);
  //   } catch (error) {
  //     console.log("this is error for settle", error);
  //   }

  // });
});
