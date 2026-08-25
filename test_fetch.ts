import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import idl from "./app/src/app/idl.json" assert { type: "json" };
import { Keypair } from "@solana/web3.js";

async function main() {
  const connection = new Connection("https://devnet.helius-rpc.com/?api-key=b07f07b6-4c5a-417d-9c31-93300c828917");
  const wallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(idl as any, provider);

  try {
    const markets = await program.account.market.all();
    console.log("Markets found:", markets.length);
    markets.forEach(m => console.log(m.publicKey.toString()));
  } catch (e) {
    console.error("Error fetching markets:", e);
  }
}

main();
