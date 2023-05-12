import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ParimutuelSports } from "../target/types/parimutuel_sports";

describe("parimutuel-sports", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ParimutuelSports as Program<ParimutuelSports>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
