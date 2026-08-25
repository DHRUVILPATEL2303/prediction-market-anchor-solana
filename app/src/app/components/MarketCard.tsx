"use client";

import { useState } from "react";
import { MarketAccount } from "../types";
import { BuyModal } from "./BuyModal";

interface Props {
  market: MarketAccount;
}

function outcomeLabel(outcome: string) {
  if (outcome === "Yes") return { label: "Resolved YES", cls: "badge-yes" };
  if (outcome === "No") return { label: "Resolved NO", cls: "badge-no" };
  return { label: "Active", cls: "badge-active" };
}

function formatShares(raw: string) {
  const n = BigInt(raw);
  if (n === 0n) return "0";
  // Assuming 6 decimals (USDC)
  const whole = n / 1_000_000n;
  const frac = n % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0").slice(0, 2)}`;
}

export function MarketCard({ market }: Props) {
  const [showBuy, setShowBuy] = useState(false);
  const totalYes = BigInt(market.totalYes);
  const totalNo = BigInt(market.totalNo);
  const total = totalYes + totalNo;
  const yesPercent = total === 0n ? 50 : Number((totalYes * 100n) / total);
  const noPercent = 100 - yesPercent;
  const { label, cls } = outcomeLabel(market.outcome);
  const isExpired = Date.now() / 1000 > market.endTime;
  const timeLeft = market.endTime * 1000 - Date.now();
  const daysLeft = Math.max(0, Math.floor(timeLeft / 86400000));

  return (
    <>
      <div className={`market-card ${market.outcome !== "Unresolved" ? "market-card-resolved" : ""}`}>
        <div className="market-card-header">
          <span className={`badge ${cls}`}>{label}</span>
          <span className="market-id">#{market.marketId}</span>
        </div>

        <h3 className="market-question">{market.question}</h3>

        <div className="market-stats">
          <div className="stat">
            <span className="stat-label">YES Pool</span>
            <span className="stat-value yes-color">{formatShares(market.totalYes)} USDC</span>
          </div>
          <div className="stat">
            <span className="stat-label">NO Pool</span>
            <span className="stat-value no-color">{formatShares(market.totalNo)} USDC</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-bar-wrap">
          <div className="progress-bar">
            <div
              className="progress-yes"
              style={{ width: `${yesPercent}%` }}
            />
            <div
              className="progress-no"
              style={{ width: `${noPercent}%` }}
            />
          </div>
          <div className="progress-labels">
            <span className="yes-color">{yesPercent}% YES</span>
            <span className="no-color">{noPercent}% NO</span>
          </div>
        </div>

        <div className="market-meta">
          <div className="meta-item">
            <span className="meta-label">Fee</span>
            <span className="meta-value">{(market.feeBps / 100).toFixed(2)}%</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">{isExpired ? "Ended" : "Ends in"}</span>
            <span className="meta-value">
              {isExpired
                ? new Date(market.endTime * 1000).toLocaleDateString()
                : `${daysLeft}d`}
            </span>
          </div>
        </div>

        <div className="market-creator">
          Creator: {market.authority.slice(0, 4)}…{market.authority.slice(-4)}
        </div>

        {market.outcome === "Unresolved" && !isExpired && (
          <button className="btn-trade" onClick={() => setShowBuy(true)}>
            Place Bet
          </button>
        )}
      </div>

      {showBuy && (
        <BuyModal
          market={market}
          onClose={() => setShowBuy(false)}
          onSuccess={() => setShowBuy(false)}
        />
      )}
    </>
  );
}
