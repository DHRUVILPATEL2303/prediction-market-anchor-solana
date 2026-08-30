"use client";

import { useState } from "react";
import { useMarketActions } from "../lib/program";
import { useWallet } from "@solana/wallet-adapter-react";

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
      await createMarket(question.trim(), endTimeUnix, feeBps, mintAddress);
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
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <h2 className="modal-hd-title">Create Prediction Market</h2>
            <p className="modal-hd-sub">Deploy a new on-chain market</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-bd">
            <div className="form-grp">
              <label className="form-lbl">Question</label>
              <textarea
                className="form-ta"
                placeholder="e.g., Will SOL reach $250 by end of year?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={128}
                rows={3}
              />
              <div className="form-hint" style={{ textAlign: "right", marginTop: 2 }}>
                <span style={{ color: question.length > 100 ? "var(--no-dk)" : "var(--t3)" }}>
                  {question.length}
                </span> / 128
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-grp">
                <label className="form-lbl">Resolution Date</label>
                <input
                  type="datetime-local"
                  className="form-inp"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="form-grp">
                <label className="form-lbl">Fee (BPS)</label>
                <input
                  type="number"
                  className="form-inp"
                  value={feeBps}
                  onChange={(e) => setFeeBps(Number(e.target.value))}
                  min={0}
                  max={1000}
                />
                <div className="form-hint" style={{ marginTop: 2 }}>
                  {(feeBps / 100).toFixed(2)}% trading fee
                </div>
              </div>
            </div>

            <div className="form-grp">
              <label className="form-lbl">Payment Mint</label>
              <input
                type="text"
                className="form-inp"
                value={mintAddress}
                onChange={(e) => setMintAddress(e.target.value)}
                style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}
              />
              <div className="form-hint" style={{ marginTop: 2 }}>
                Default is Devnet USDC
              </div>
            </div>

            {error && <div className="form-err">{error}</div>}
          </div>

          <div className="modal-ft">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Deploying…" : "Create Market"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
