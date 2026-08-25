import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import idl from "./app/src/app/idl.json";
import { Keypair } from "@solana/web3.js";

async function main() {
  const connection = new Connection("https://devnet.helius-rpc.com/?api-key=b07f07b6-4c5a-417d-9c31-93300c828917", "confirmed");
  const wallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
  const program = new Program(idl as any, provider);

  const marketDiscriminator = Buffer.from([219, 213, 55, 0, 227, 198, 154, 39]);
  
  const rawAccounts = await connection.getProgramAccounts(program.programId, {
    commitment: "confirmed",
    encoding: "base64",
    filters: [
      { memcmp: { offset: 0, bytes: require("@coral-xyz/anchor").utils.bytes.bs58.encode(marketDiscriminator) } }
    ]
  });
  
  console.log(`Found ${rawAccounts.length} raw accounts with market discriminator.`);
  
  let decodedCount = 0;
  for (const raw of rawAccounts) {
    console.log(`Account ${raw.pubkey.toString()} length: ${raw.account.data.length}`);
    try {
      const decoded = await program.coder.accounts.decode("market", raw.account.data);
      console.log(`Successfully decoded ${raw.pubkey.toString()}! Question: ${decoded.question}`);
      decodedCount++;
    } catch (e) {
      console.log(`Failed to decode ${raw.pubkey.toString()}: ${e.message}`);
    }
  }
  console.log(`Successfully decoded ${decodedCount} out of ${rawAccounts.length} accounts.`);
}

main().catch(console.error);
