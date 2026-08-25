"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useMemo, useCallback } from "react";
import { Program, AnchorProvider, BN, Idl, Wallet, utils } from "@coral-xyz/anchor";
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

    // Generate a unique market ID using timestamp since there is no on-chain counter
    const marketIdBN = new BN(Date.now());
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

  async function resolveMarket(marketPubkey: string, outcome: "Yes" | "No" | "Cancelled") {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    const market = new PublicKey(marketPubkey);
    let outcomeArg;
    if (outcome === "Yes") outcomeArg = { yes: {} };
    else if (outcome === "No") outcomeArg = { no: {} };
    else outcomeArg = { cancelled: {} };

    const tx = await program.methods
      .resolveMarketAnchor(outcomeArg as never)
      .accounts({
        market,
        authority: wallet.publicKey,
      })
      .rpc();
    return { tx };
  }

  async function cancelMarket(marketPubkey: string) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    const market = new PublicKey(marketPubkey);
    const tx = await program.methods
      .cancelMarketAnchor()
      .accounts({
        market,
        authority: wallet.publicKey,
      })
      .rpc();
    return { tx };
  }

  async function claimWinnings(
    marketPubkey: string,
    paymentMintAddress: string,
    claimerTokenAccount: string,
    treasuryTokenAccount: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    const market = new PublicKey(marketPubkey);
    const paymentMint = new PublicKey(paymentMintAddress);
    
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), wallet.publicKey.toBuffer(), market.toBuffer()],
      PROGRAM_ID
    );
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault-authority"), market.toBuffer()],
      PROGRAM_ID
    );
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), market.toBuffer()],
      PROGRAM_ID
    );

    const tx = await program.methods
      .claimAnchor()
      .accounts({
        claimer: wallet.publicKey,
        market,
        position,
        vaultAuthority,
        vault,
        paymentMint,
        claimerTokenAccount: new PublicKey(claimerTokenAccount),
        tresuryTokenAccount: new PublicKey(treasuryTokenAccount),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    return { tx };
  }

  async function refundPosition(
    marketPubkey: string,
    paymentMintAddress: string,
    refunderTokenAccount: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    const market = new PublicKey(marketPubkey);
    const paymentMint = new PublicKey(paymentMintAddress);

    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), wallet.publicKey.toBuffer(), market.toBuffer()],
      PROGRAM_ID
    );
    const [vaultAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault-authority"), market.toBuffer()],
      PROGRAM_ID
    );
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), market.toBuffer()],
      PROGRAM_ID
    );

    const tx = await program.methods
      .refundAnchor()
      .accounts({
        refunder: wallet.publicKey,
        market,
        position,
        vaultAuthority,
        vault,
        paymentMint,
        refunderTokenAccount: new PublicKey(refunderTokenAccount),
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    return { tx };
  }

  const fetchUserPosition = useCallback(async (marketPubkey: string) => {
    if (!program || !wallet.publicKey) return null;
    const market = new PublicKey(marketPubkey);
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), wallet.publicKey.toBuffer(), market.toBuffer()],
      PROGRAM_ID
    );
    try {
      const acc = await program.account.position.fetch(position);
      return {
        publicKey: position.toString(),
        owner: acc.owner.toString(),
        market: acc.market.toString(),
        yesShares: acc.yesShares.toString(),
        noShares: acc.noShares.toString(),
        claimed: acc.claimed,
        refunded: acc.refunded,
      };
    } catch (e) {
      return null;
    }
  }, [program, wallet.publicKey]);

  return { createMarket, buyShares, resolveMarket, cancelMarket, claimWinnings, refundPosition, fetchUserPosition };
}

export async function fetchMarket(
  program: Program,
  marketPubkey: string
): Promise<MarketAccount | null> {
  try {
    const pk = new PublicKey(marketPubkey);
    const a = await program.account.market.fetch(pk);
    return {
      publicKey: pk.toString(),
      marketId: a.marketId.toString(),
      question: a.question,
      authority: a.authority.toString(),
      endTime: a.endTime.toNumber(),
      feeBps: a.feeBps,
      totalYes: a.totalYes.toString(),
      totalNo: a.totalNo.toString(),
      totalAmount: a.totalAmount ? a.totalAmount.toString() : "0",
      treasury: a.treasury.toString(),
      outcome: a.outcome.unresolved
        ? "Unresolved"
        : a.outcome.yes
        ? "Yes"
        : a.outcome.no
        ? "No"
        : "Cancelled",
      paymentMint: a.paymentMint.toString(),
    };
  } catch (e) {
    console.error("fetchAllMarkets error:", e);
    return [];
  }
}

export async function fetchAllMarkets(
  program: Program
): Promise<MarketAccount[]> {
  try {
    // Instead of using program.account.market.all() which crashes if ANY old account fails to decode,
    // we manually fetch all program accounts and attempt to decode them one by one.
    const connection = program.provider.connection;
    const programId = program.programId;
    
    // We filter by the exact 8-byte discriminator for the Market account to avoid fetching positions
    // Discriminator for Market is hash("account:Market")[..8]
    const marketDiscriminator = Buffer.from([219, 190, 213, 55, 0, 227, 198, 154]);

    const rawAccounts = await connection.getProgramAccounts(programId, {
      commitment: "confirmed",
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: utils.bytes.bs58.encode(marketDiscriminator),
          },
        },
      ],
    });

    const validMarkets: MarketAccount[] = [];

    for (const raw of rawAccounts) {
      try {
        const decoded = await program.coder.accounts.decode("market", raw.account.data);
        validMarkets.push({
          publicKey: raw.pubkey.toString(),
          marketId: decoded.marketId.toString(),
          question: decoded.question,
          authority: decoded.authority.toString(),
          endTime: decoded.endTime.toNumber(),
          feeBps: decoded.feeBps,
          totalYes: decoded.totalYes.toString(),
          totalNo: decoded.totalNo.toString(),
          totalAmount: decoded.totalAmount ? decoded.totalAmount.toString() : "0",
          treasury: decoded.treasury.toString(),
          outcome: decoded.outcome.unresolved
            ? "Unresolved"
            : decoded.outcome.yes
            ? "Yes"
            : decoded.outcome.no
            ? "No"
            : "Cancelled",
          paymentMint: decoded.paymentMint.toString(),
        });
      } catch (decodeErr) {
        // Skip accounts that fail to decode (e.g. old schema versions before total_amount was added)
        console.warn("Skipped un-decodable market:", raw.pubkey.toString());
      }
    }

    return validMarkets;
  } catch (e) {
    console.error("fetchAllMarkets error:", e);
    return [];
  }
}
