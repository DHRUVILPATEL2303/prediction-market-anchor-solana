"use client";

import { useState } from "react";
import { useMarketActions } from "../lib/program";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { MarketAccount } from "../types";
import { getAssociatedTokenAddress } from "@solana/spl-token";

interface Props {
  market: MarketAccount;
  onSuccess: () => void;
  onClose: () => void;
}

export function BuyModal({ market, onSuccess, onClose }: Props) {
  const { buyShares } = useMarketActions();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [side, setSide] = useState<"Yes" | "No">("Yes");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !publicKey) { setError("Connect your wallet first"); return; }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) { setError("Enter a valid amount"); return; }

    setLoading(true);
    setError("");
    try {
      // Find buyer's associated token account for the payment mint
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);

      // Verify the ATA exists
      const ataInfo = await connection.getAccountInfo(ata);
      if (!ataInfo) {
        setError("You don't have a token account for this mint. Please create one first.");
        setLoading(false);
        return;
      }

      // Convert to raw units (assuming 6 decimals for USDC)
      const rawAmount = Math.floor(amountNum * 1_000_000);

      const result = await buyShares(
        market.publicKey,
        side,
        rawAmount,
        market.paymentMint,
        ata.toString()
      );
      console.log("Buy tx:", result.tx);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const totalYes = BigInt(market.totalYes);
  const totalNo = BigInt(market.totalNo);
  const total = totalYes + totalNo;
  const yesPercent = total === 0n ? 50 : Number((totalYes * 100n) / total);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card buy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Place Bet</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <p className="buy-question">{market.question}</p>

        <form onSubmit={handleBuy} className="modal-form">
          <div className="side-selector">
            <button
              type="button"
              className={`side-btn yes-btn ${side === "Yes" ? "active-yes" : ""}`}
              onClick={() => setSide("Yes")}
            >
              <span className="side-icon">✅</span>
              <span className="side-label">YES</span>
              <span className="side-odds">{yesPercent}%</span>
            </button>
            <button
              type="button"
              className={`side-btn no-btn ${side === "No" ? "active-no" : ""}`}
              onClick={() => setSide("No")}
            >
              <span className="side-icon">❌</span>
              <span className="side-label">NO</span>
              <span className="side-odds">{100 - yesPercent}%</span>
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (USDC)</label>
            <div className="amount-input-wrap">
              <input
                type="number"
                className="form-input amount-input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="any"
              />
              <span className="amount-suffix">USDC</span>
            </div>
          </div>

          <div className="buy-summary">
            <div className="summary-row">
              <span>Side</span>
              <span className={side === "Yes" ? "yes-color" : "no-color"}>{side}</span>
            </div>
            <div className="summary-row">
              <span>Protocol Fee</span>
              <span>{(market.feeBps / 100).toFixed(2)}%</span>
            </div>
            <div className="summary-row">
              <span>Shares received</span>
              <span>≈ {amount || "0"} shares</span>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <span className="btn-loading"><span className="spinner" />Buying…</span>
              ) : `Buy ${side} Shares`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
