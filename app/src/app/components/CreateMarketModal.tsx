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
  const [question,    setQuestion]    = useState("");
  const [endDate,     setEndDate]     = useState("");
  const [feeBps,      setFeeBps]      = useState(100);
  const [mintAddress, setMintAddress] = useState(DEVNET_USDC_MINT);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected)        { setError("Connect your wallet first"); return; }
    if (!question.trim())  { setError("Question is required"); return; }
    if (!endDate)          { setError("End date is required"); return; }

    const endTimeUnix = Math.floor(new Date(endDate).getTime() / 1000);
    if (endTimeUnix <= Math.floor(Date.now() / 1000)) {
      setError("End time must be in the future");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await createMarket(question.trim(), endTimeUnix, feeBps, mintAddress);
      console.log("Market created:", result.tx);
      onSuccess();
    } catch (err: unknown) {
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
          <div>
            <h2 className="modal-title">Create Prediction Market</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Deploy a new on-chain prediction market
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Question */}
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
                  <path d="M12 17h.01" strokeLinecap="round" />
                </svg>
                Question
              </span>
            </label>
            <textarea
              className="form-textarea"
              placeholder="Will BTC reach $150k by end of 2025?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={128}
              rows={3}
            />
            <span className="form-hint">
              {question.length}/128 characters
              {question.length > 100 && (
                <span style={{ color: "var(--no)", marginLeft: 8 }}>
                  {128 - question.length} remaining
                </span>
              )}
            </span>
          </div>

          {/* End date + Fee */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                    <line x1="8"  y1="2" x2="8"  y2="6" strokeLinecap="round" />
                    <line x1="3"  y1="10" x2="21" y2="10" />
                  </svg>
                  End Date &amp; Time
                </span>
              </label>
              <input
                type="datetime-local"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23" strokeLinecap="round" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" />
                  </svg>
                  Fee (basis points)
                </span>
              </label>
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

          {/* Mint */}
          <div className="form-group">
            <label className="form-label">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M14.83 9A4 4 0 0 0 8 12a4 4 0 0 0 6.83 3" strokeLinecap="round" />
                </svg>
                Payment Mint (SPL Token)
              </span>
            </label>
            <input
              type="text"
              className="form-input"
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
              placeholder="Mint address"
              style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
            />
            <span className="form-hint">Default: Devnet USDC</span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                  Creating…
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                  Create Market
                </span>
              )}
            </button>
          </div>
        </form>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
