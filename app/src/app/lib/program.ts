"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, BN, Idl, Wallet } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useMemo } from "react";
import idl from "../idl.json";
import { MarketAccount } from "../types";

const PROGRAM_ID = new PublicKey(
  "96GMnsCYX1oHM2fJoD7QMZqWT7TDLc6mq8soGJKVDggs"
);



export function useProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return null;
    return new AnchorProvider(
      connection,
      wallet as unknown as Wallet,
      { commitment: "confirmed" }
    );
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(idl as Idl, provider);
  }, [provider]);

  return { program, provider, wallet, connection };
}

export function useMarketActions() {
  const { program, wallet } = useProgram();

  async function createMarket(
    question: string,
    endTimeUnix: number,
    feeBps: number,
    paymentMintAddress: string,
    treasuryAddress?: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const marketId = BigInt(Date.now());
    const marketIdBN = new BN(marketId.toString());
    const paymentMint = new PublicKey(paymentMintAddress);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        wallet.publicKey.toBuffer(),
        marketIdBN.toArrayLike(Buffer, "le", 8),
      ],
      PROGRAM_ID
    );

    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault-authority"), marketPda.toBuffer()],
      PROGRAM_ID
    );

    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      PROGRAM_ID
    );

    const tx = await program.methods
      .initializeMarketAnchor(
        marketIdBN,
        question,
        new BN(endTimeUnix),
        feeBps
      )
      .accounts({
        owner: wallet.publicKey,
        market: marketPda,
        vaultAuthority,
        vault,
        paymentMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        // Treasury must be a system-owned account (wallet address works perfectly)
        treasury: treasuryAddress ? new PublicKey(treasuryAddress) : wallet.publicKey,
      })
      .rpc();

    return { tx, marketPda: marketPda.toString() };
  }

  async function buyShares(
    marketPubkey: string,
    side: "Yes" | "No",
    amount: number,
    paymentMintAddress: string,
    buyerTokenAccount: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const market = new PublicKey(marketPubkey);
    const paymentMint = new PublicKey(paymentMintAddress);
    const buyerTA = new PublicKey(buyerTokenAccount);

    const [position] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        wallet.publicKey.toBuffer(),
        market.toBuffer(),
      ],
      PROGRAM_ID
    );

    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), market.toBuffer()],
      PROGRAM_ID
    );

    const sideArg = side === "Yes" ? { yes: {} } : { no: {} };
    const amountBN = new BN(amount);

    const tx = await program.methods
      .buyAnchor(sideArg as never, amountBN)
      .accounts({
        buyer: wallet.publicKey,
        market,
        position,
        buyerTokenAccount: buyerTA,
        vault,
        paymentMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { tx };
  }

  return { createMarket, buyShares };
}

export async function fetchAllMarkets(
  program: Program
): Promise<MarketAccount[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = await (program.account as any).market.all();
  return accounts.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any): MarketAccount => ({
      publicKey: a.publicKey.toString(),
      marketId: a.account.marketId.toString(),
      question: a.account.question,
      authority: a.account.authority.toString(),
      endTime: a.account.endTime.toNumber(),
      feeBps: a.account.feeBps,
      totalYes: a.account.totalYes.toString(),
      totalNo: a.account.totalNo.toString(),
      treasury: a.account.treasury.toString(),
      outcome: a.account.outcome.unresolved
        ? "Unresolved"
        : a.account.outcome.yes
        ? "Yes"
        : "No",
      paymentMint: a.account.paymentMint.toString(),
    })
  );
}
