"use client";

import { useState } from "react";
import { useMarketActions } from "../lib/program";
import { useWallet } from "@solana/wallet-adapter-react";

// Well-known devnet USDC mint
const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export function CreateMarketModal({ onSuccess, onClose }: Props) {
  const { createMarket } = useMarketActions();
  const { connected } = useWallet();
  const [question, setQuestion] = useState("");
  const [endDate, setEndDate] = useState("");
  const [feeBps, setFeeBps] = useState(100);
  const [mintAddress, setMintAddress] = useState(DEVNET_USDC_MINT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected) { setError("Connect your wallet first"); return; }
    if (!question.trim()) { setError("Question is required"); return; }
    if (!endDate) { setError("End date is required"); return; }

    const endTimeUnix = Math.floor(new Date(endDate).getTime() / 1000);
    if (endTimeUnix <= Math.floor(Date.now() / 1000)) {
      setError("End time must be in the future");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // treasury defaults to wallet.publicKey inside createMarket (system-owned ✓)
      const result = await createMarket(question.trim(), endTimeUnix, feeBps, mintAddress);
      console.log("Market created:", result.tx);
      onSuccess();
    } catch (err: unknown) {
      // Try to surface a readable Anchor error from program logs
      let msg = err instanceof Error ? err.message : String(err);
      const anyErr = err as Record<string, unknown>;
      if (Array.isArray(anyErr?.logs)) {
        const logLine = (anyErr.logs as string[]).find((l: string) =>
          l.includes("Error Message:")
        );
        if (logLine) msg = logLine.replace(/.*Error Message: /, "");
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create Prediction Market</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Question</label>
            <textarea
              className="form-textarea"
              placeholder="Will BTC reach $150k by end of 2025?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={128}
              rows={3}
            />
            <span className="form-hint">{question.length}/128 characters</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">End Date &amp; Time</label>
              <input
                type="datetime-local"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fee (basis points)</label>
              <input
                type="number"
                className="form-input"
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                min={0}
                max={1000}
                placeholder="100 = 1%"
              />
              <span className="form-hint">= {(feeBps / 100).toFixed(2)}%</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Mint (SPL Token)</label>
            <input
              type="text"
              className="form-input"
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
              placeholder="Mint address"
            />
            <span className="form-hint">Default: Devnet USDC</span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <span className="btn-loading"><span className="spinner" />Creating…</span>
              ) : "Create Market"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
