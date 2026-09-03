"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { useMemo, useCallback } from "react";
import { Program, AnchorProvider, BN, Idl, Wallet, utils } from "@coral-xyz/anchor";
import idl from "../idl.json";
import { MarketAccount, AmmAccount } from "../types";

export const PROGRAM_ID = new PublicKey(
  "7PBhPD5n3Qe18BoFR4uiRNVTCoqz3RYh9mypf6CC3tww"
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

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
  const { program, wallet, connection } = useProgram();

  async function createMarket(
    question: string,
    endTimeUnix: number,
    feeBps: number,
    paymentMintAddress: string,
    treasuryAddress?: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const marketIdBN = new BN(Date.now());
    const paymentMint = new PublicKey(paymentMintAddress);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), wallet.publicKey.toBuffer(), marketIdBN.toArrayLike(Buffer, "le", 8)],
      PROGRAM_ID
    );
    const [vaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from("vault-authority"), marketPda.toBuffer()], PROGRAM_ID);
    const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), marketPda.toBuffer()], PROGRAM_ID);

    const ixMarket = await program.methods
      .initializeMarket(marketIdBN, question, new BN(endTimeUnix), feeBps)
      .accounts({
        owner: wallet.publicKey,
        market: marketPda,
        vaultAuthority,
        vault,
        paymentMint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        treasury: treasuryAddress ? new PublicKey(treasuryAddress) : wallet.publicKey,
      })
      .instruction();

    const [amm] = PublicKey.findProgramAddressSync([Buffer.from("amm"), marketPda.toBuffer()], PROGRAM_ID);
    const [outcomeAuthority] = PublicKey.findProgramAddressSync([Buffer.from("outcome-authority"), marketPda.toBuffer()], PROGRAM_ID);
    const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes-mint"), marketPda.toBuffer()], PROGRAM_ID);
    const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no-mint"), marketPda.toBuffer()], PROGRAM_ID);

    const ixAmm = await program.methods.initializeAmm(feeBps).accounts({
      authority: wallet.publicKey,
      market: marketPda,
      amm,
      outcomeAuthority,
      yesMint,
      noMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).instruction();

    const [ammAuthority] = PublicKey.findProgramAddressSync([Buffer.from("amm-authority"), marketPda.toBuffer()], PROGRAM_ID);
    const [paymentVault] = PublicKey.findProgramAddressSync([Buffer.from("payment-vault"), marketPda.toBuffer()], PROGRAM_ID);
    const [yesVault] = PublicKey.findProgramAddressSync([Buffer.from("yes-vault"), marketPda.toBuffer()], PROGRAM_ID);
    const [noVault] = PublicKey.findProgramAddressSync([Buffer.from("no-vault"), marketPda.toBuffer()], PROGRAM_ID);

    const ixAmmVaults = await program.methods.initializeAmmVaults().accounts({
      authority: wallet.publicKey,
      market: marketPda,
      amm,
      ammAuthority,
      paymentMint,
      yesMint,
      noMint,
      paymentVault,
      yesVault,
      noVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).instruction();

    const tx = new Transaction().add(ixMarket).add(ixAmm).add(ixAmmVaults);
    const signature = await wallet.sendTransaction(tx, connection);
    return { tx: signature, marketPda: marketPda.toString() };
  }

  async function addLiquidity(
    marketPubkey: string,
    amount: number,
    paymentMintAddress: string,
    providerTokenAccount: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const market = new PublicKey(marketPubkey);
    const providerTA = new PublicKey(providerTokenAccount);
    const paymentAmountBN = new BN(amount);

    const [amm] = PublicKey.findProgramAddressSync([Buffer.from("amm"), market.toBuffer()], PROGRAM_ID);
    const [ammAuthority] = PublicKey.findProgramAddressSync([Buffer.from("amm-authority"), market.toBuffer()], PROGRAM_ID);
    const [outcomeAuthority] = PublicKey.findProgramAddressSync([Buffer.from("outcome-authority"), market.toBuffer()], PROGRAM_ID);
    const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes-mint"), market.toBuffer()], PROGRAM_ID);
    const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no-mint"), market.toBuffer()], PROGRAM_ID);
    const [paymentVault] = PublicKey.findProgramAddressSync([Buffer.from("payment-vault"), market.toBuffer()], PROGRAM_ID);
    const [yesVault] = PublicKey.findProgramAddressSync([Buffer.from("yes-vault"), market.toBuffer()], PROGRAM_ID);
    const [noVault] = PublicKey.findProgramAddressSync([Buffer.from("no-vault"), market.toBuffer()], PROGRAM_ID);

    const [lpPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp-position"), wallet.publicKey.toBuffer(), amm.toBuffer()],
      PROGRAM_ID
    );

    const [providerYesAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), yesMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const [providerNoAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), noMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const ixAddLiquidity = await program.methods
      .addLiquidity(paymentAmountBN)
      .accounts({
        provider: wallet.publicKey,
        market,
        amm,
        ammAuthority,
        outcomeAuthority,
        paymentVault,
        providerPaymentAccount: providerTA,
        yesMint,
        noMint,
        yesVault,
        noVault,
        providerYesAccount,
        providerNoAccount,
        lpPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = new Transaction();
    tx.add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, providerYesAccount, wallet.publicKey, yesMint));
    tx.add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, providerNoAccount, wallet.publicKey, noMint));
    tx.add(ixAddLiquidity);

    const signature = await wallet.sendTransaction(tx, connection);
    return { tx: signature };
  }

  async function removeLiquidity(
    marketPubkey: string,
    shares: number,
    providerTokenAccount: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const market = new PublicKey(marketPubkey);
    const sharesBN = new BN(shares);

    const [amm] = PublicKey.findProgramAddressSync([Buffer.from("amm"), market.toBuffer()], PROGRAM_ID);
    const [ammAuthority] = PublicKey.findProgramAddressSync([Buffer.from("amm-authority"), market.toBuffer()], PROGRAM_ID);
    const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes-mint"), market.toBuffer()], PROGRAM_ID);
    const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no-mint"), market.toBuffer()], PROGRAM_ID);
    const [yesVault] = PublicKey.findProgramAddressSync([Buffer.from("yes-vault"), market.toBuffer()], PROGRAM_ID);
    const [noVault] = PublicKey.findProgramAddressSync([Buffer.from("no-vault"), market.toBuffer()], PROGRAM_ID);
    const [lpPosition] = PublicKey.findProgramAddressSync([Buffer.from("lp-position"), wallet.publicKey.toBuffer(), amm.toBuffer()], PROGRAM_ID);

    const [providerYesAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), yesMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const [providerNoAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), noMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const ixRemoveLiquidity = await program.methods
      .removeLiquidity(sharesBN)
      .accounts({
        provider: wallet.publicKey,
        market,
        amm,
        ammAuthority,
        yesVault,
        noVault,
        providerYesAccount,
        providerNoAccount,
        lpPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = new Transaction();
    tx.add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, providerYesAccount, wallet.publicKey, yesMint));
    tx.add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, providerNoAccount, wallet.publicKey, noMint));
    tx.add(ixRemoveLiquidity);

    const signature = await wallet.sendTransaction(tx, connection);
    return { tx: signature };
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
    const buyerTA = new PublicKey(buyerTokenAccount);

    const [amm] = PublicKey.findProgramAddressSync([Buffer.from("amm"), market.toBuffer()], PROGRAM_ID);
    const [ammAuthority] = PublicKey.findProgramAddressSync([Buffer.from("amm-authority"), market.toBuffer()], PROGRAM_ID);
    const [outcomeAuthority] = PublicKey.findProgramAddressSync([Buffer.from("outcome-authority"), market.toBuffer()], PROGRAM_ID);

    const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes-mint"), market.toBuffer()], PROGRAM_ID);
    const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no-mint"), market.toBuffer()], PROGRAM_ID);

    const [paymentVault] = PublicKey.findProgramAddressSync([Buffer.from("payment-vault"), market.toBuffer()], PROGRAM_ID);
    const [yesVault] = PublicKey.findProgramAddressSync([Buffer.from("yes-vault"), market.toBuffer()], PROGRAM_ID);
    const [noVault] = PublicKey.findProgramAddressSync([Buffer.from("no-vault"), market.toBuffer()], PROGRAM_ID);

    const [userYesAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), yesMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const [userNoAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), noMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const amountBN = new BN(amount);
    const minAmountOutBN = new BN(0);
    const directionArg = side === "Yes" ? { usdcToYes: {} } : { usdcToNo: {} };

    const ixSwap = await program.methods
      .swap(amountBN, minAmountOutBN, directionArg as never)
      .accounts({
        user: wallet.publicKey,
        market,
        amm,
        ammAuthority,
        outcomeAuthority,
        yesMint,
        noMint,
        paymentVault,
        yesVault,
        noVault,
        userPaymentAccount: buyerTA,
        userYesAccount,
        userNoAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = new Transaction();
    tx.add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, userYesAccount, wallet.publicKey, yesMint));
    tx.add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, userNoAccount, wallet.publicKey, noMint));
    tx.add(ixSwap);

    const signature = await wallet.sendTransaction(tx, connection);
    return { tx: signature };
  }

  async function sellShares(
    marketPubkey: string,
    side: "Yes" | "No",
    amountToSwap: number,
    amountToRedeem: number,
    sellerTokenAccount: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");

    const market = new PublicKey(marketPubkey);
    const sellerTA = new PublicKey(sellerTokenAccount);

    const [amm] = PublicKey.findProgramAddressSync([Buffer.from("amm"), market.toBuffer()], PROGRAM_ID);
    const [ammAuthority] = PublicKey.findProgramAddressSync([Buffer.from("amm-authority"), market.toBuffer()], PROGRAM_ID);
    const [outcomeAuthority] = PublicKey.findProgramAddressSync([Buffer.from("outcome-authority"), market.toBuffer()], PROGRAM_ID);
    const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes-mint"), market.toBuffer()], PROGRAM_ID);
    const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no-mint"), market.toBuffer()], PROGRAM_ID);
    const [paymentVault] = PublicKey.findProgramAddressSync([Buffer.from("payment-vault"), market.toBuffer()], PROGRAM_ID);
    const [yesVault] = PublicKey.findProgramAddressSync([Buffer.from("yes-vault"), market.toBuffer()], PROGRAM_ID);
    const [noVault] = PublicKey.findProgramAddressSync([Buffer.from("no-vault"), market.toBuffer()], PROGRAM_ID);

    const [userYesAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), yesMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const [userNoAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), noMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const swapAmountBN = new BN(amountToSwap);
    const redeemAmountBN = new BN(amountToRedeem);
    const minAmountOutBN = new BN(0);
    const directionArg = side === "Yes" ? { yesToNo: {} } : { noToYes: {} };

    const ixSwap = await program.methods
      .swap(swapAmountBN, minAmountOutBN, directionArg as never)
      .accounts({
        user: wallet.publicKey,
        market,
        amm,
        ammAuthority,
        outcomeAuthority,
        yesMint,
        noMint,
        paymentVault,
        yesVault,
        noVault,
        userPaymentAccount: sellerTA,
        userYesAccount,
        userNoAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const ixRedeem = await program.methods
      .redeemCompleteSet(redeemAmountBN)
      .accounts({
        user: wallet.publicKey,
        market,
        ammAuthority,
        paymentVault,
        yesMint,
        noMint,
        userYesAccount,
        userNoAccount,
        userPaymentAccount: sellerTA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const tx = new Transaction().add(ixSwap).add(ixRedeem);
    const signature = await wallet.sendTransaction(tx, connection);
    return { tx: signature };
  }

  async function resolveMarket(marketPubkey: string, outcome: "Yes" | "No" | "Cancelled") {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    const market = new PublicKey(marketPubkey);
    let outcomeArg;
    if (outcome === "Yes") outcomeArg = { yes: {} };
    else if (outcome === "No") outcomeArg = { no: {} };
    else outcomeArg = { cancelled: {} };

    const tx = await program.methods
      .resolveMarket(outcomeArg as never)
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
      .cancelMarket()
      .accounts({
        market,
        authority: wallet.publicKey,
      })
      .rpc();
    return { tx };
  }

  async function claimWinnings(
    marketPubkey: string,
    claimerTokenAccount: string
  ) {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    const market = new PublicKey(marketPubkey);
    const claimerTA = new PublicKey(claimerTokenAccount);

    const [ammAuthority] = PublicKey.findProgramAddressSync([Buffer.from("amm-authority"), market.toBuffer()], PROGRAM_ID);
    const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes-mint"), market.toBuffer()], PROGRAM_ID);
    const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no-mint"), market.toBuffer()], PROGRAM_ID);
    const [paymentVault] = PublicKey.findProgramAddressSync([Buffer.from("payment-vault"), market.toBuffer()], PROGRAM_ID);

    const [userYesAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), yesMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const [userNoAccount] = PublicKey.findProgramAddressSync(
      [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), noMint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const tx = await program.methods
      .claimAmmWinnings()
      .accounts({
        user: wallet.publicKey,
        market,
        ammAuthority,
        paymentVault,
        yesMint,
        noMint,
        userYesAccount,
        userNoAccount,
        userPaymentAccount: claimerTA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    return { tx };
  }

  return { createMarket, addLiquidity, removeLiquidity, buyShares, sellShares, resolveMarket, cancelMarket, claimWinnings };
}

export async function fetchMarket(
  program: Program,
  marketPubkey: string
): Promise<MarketAccount | null> {
  try {
    const pk = new PublicKey(marketPubkey);
    const a = await (program.account as any).market.fetch(pk);
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
    console.error("fetchMarket error:", e);
    return null;
  }
}

export async function fetchAmm(program: Program<Idl>, marketPubkey: string): Promise<AmmAccount | null> {
  try {
    const market = new PublicKey(marketPubkey);
    const [amm] = PublicKey.findProgramAddressSync([Buffer.from("amm"), market.toBuffer()], PROGRAM_ID);
    const account = await (program.account as any).ammPool.fetch(amm) as any;
    return {
      publicKey: amm.toString(),
      market: account.market.toString(),
      yesReserve: account.yesReserve.toString(),
      noReserve: account.noReserve.toString(),
      lpSupply: account.lpSupply.toString(),
      feeBps: account.feeBps,
    };
  } catch (err) {
    console.error("Failed to fetch AMM:", err);
    return null;
  }
}

export async function fetchAllMarkets(
  program: Program
): Promise<MarketAccount[]> {
  try {
    const connection = program.provider.connection;
    const programId = program.programId;

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

    let amms: any[] = [];
    try {
      amms = await (program.account as any).ammPool.all();
    } catch (e) {
      console.warn("Failed to fetch AMMs in fetchAllMarkets", e);
    }
    const ammMap = new Map();
    for (const a of amms) {
      ammMap.set(a.account.market.toString(), a.account);
    }

    const validMarkets: MarketAccount[] = [];

    for (const raw of rawAccounts) {
      try {
        const decoded = await program.coder.accounts.decode("market", raw.account.data);
        const marketPubkey = raw.pubkey.toString();
        const amm = ammMap.get(marketPubkey);

        validMarkets.push({
          publicKey: marketPubkey,
          marketId: decoded.marketId.toString(),
          question: decoded.question,
          authority: decoded.authority.toString(),
          endTime: decoded.endTime.toNumber(),
          feeBps: decoded.feeBps,
          totalYes: decoded.totalYes.toString(),
          totalNo: decoded.totalNo.toString(),
          totalAmount: decoded.totalAmount ? decoded.totalAmount.toString() : "0",
          yesReserve: amm ? amm.yesReserve.toString() : undefined,
          noReserve: amm ? amm.noReserve.toString() : undefined,
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
        console.warn("Skipped un-decodable market:", raw.pubkey.toString());
      }
    }

    return validMarkets;
  } catch (e) {
    console.error("fetchAllMarkets error:", e);
    return [];
  }
}
