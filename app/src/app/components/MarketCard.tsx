"use client";

import Link from "next/link";
import { MarketAccount } from "../types";

interface Props {
  market: MarketAccount;
}

function outcomeLabel(outcome: string) {
  if (outcome === "Yes")       return { label: "Resolved YES", cls: "badge-yes" };
  if (outcome === "No")        return { label: "Resolved NO",  cls: "badge-no"  };
  if (outcome === "Cancelled") return { label: "Cancelled",    cls: "badge-cancelled" };
  return { label: "Active", cls: "badge-active" };
}

function formatShares(raw: string) {
  const n = BigInt(raw);
  if (n === 0n) return "0.00";
  const whole = n / 1_000_000n;
  const frac  = n % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0").slice(0, 2)}`;
}

export function MarketCard({ market }: Props) {
  const totalYes   = BigInt(market.totalYes);
  const totalNo    = BigInt(market.totalNo);
  const total      = totalYes + totalNo;
  const yesPercent = total === 0n ? 50 : Number((totalYes * 100n) / total);
  const noPercent  = 100 - yesPercent;
  const { label, cls } = outcomeLabel(market.outcome);

  const isExpired = Date.now() / 1000 > market.endTime;
  const timeLeft  = market.endTime * 1000 - Date.now();
  const daysLeft  = Math.max(0, Math.floor(timeLeft / 86400000));

  const isActive = market.outcome === "Unresolved" && !isExpired;

  return (
    <Link
      href={`/market/${market.publicKey}`}
      className={`market-card${market.outcome !== "Unresolved" ? " market-card-resolved" : ""}`}
    >
      <div className="market-card-inner">
        {/* Header */}
        <div className="market-card-header">
          <span className={`badge ${cls}`}>
            <span className="badge-dot" />
            {label}
          </span>
          <span className="market-id">#{market.marketId}</span>
        </div>

        {/* Question */}
        <h3 className="market-question">{market.question}</h3>

        {/* Progress */}
        <div className="progress-bar-wrap">
          <div className="progress-bar">
            <div className="progress-yes" style={{ width: `${yesPercent}%` }} />
            <div className="progress-no"  style={{ width: `${noPercent}%`  }} />
          </div>
          <div className="progress-labels">
            <span className="yes-color">{yesPercent}% YES</span>
            <span className="no-color">{noPercent}% NO</span>
          </div>
        </div>

        {/* Pool stats */}
        <div className="market-stats">
          <div className="stat">
            <span className="stat-label">YES Pool</span>
            <span className="stat-value yes-color">{formatShares(market.totalYes)} <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>USDC</span></span>
          </div>
          <div className="stat">
            <span className="stat-label">NO Pool</span>
            <span className="stat-value no-color">{formatShares(market.totalNo)} <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 600 }}>USDC</span></span>
          </div>
        </div>

        {/* Meta */}
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
      </div>

      {/* Creator bar */}
      <div className="market-creator">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
        </svg>
        Creator: {market.authority.slice(0, 4)}…{market.authority.slice(-4)}
      </div>

      {/* CTA */}
      {isActive && (
        <div className="card-cta">
          <div className="btn-trade">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 17.5 9.5 13l3 2.5L19 8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15.5 8H19v3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Trade Now
          </div>
        </div>
      )}
    </Link>
  );
}
