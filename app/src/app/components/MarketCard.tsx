"use client";

import Link from "next/link";
import { MarketAccount } from "../types";

interface Props {
  market: MarketAccount;
}

// Simple keyword-based category detection
function detectCategory(q: string): string {
  const s = q.toLowerCase();
  if (/\b(btc|eth|sol|crypto|bitcoin|ethereum|defi|nft|token|blockchain|web3|usdc)\b/.test(s)) return "Crypto";
  if (/\b(election|vote|president|congress|senate|politi|govern|democrat|republican)\b/.test(s)) return "Politics";
  if (/\b(world cup|nba|nfl|league|championship|sport|game|match|team|player|score|goal)\b/.test(s)) return "Sports";
  if (/\b(ai|gpt|openai|tech|software|apple|google|microsoft|model|llm)\b/.test(s)) return "Technology";
  if (/\b(fed|interest|inflation|stock|economy|gdp|rate|bond|nasdaq|s&p)\b/.test(s)) return "Finance";
  return "General";
}

function formatUSDC(raw: string): string {
  const n = BigInt(raw);
  if (n === 0n) return "$0";
  const whole = n / 1_000_000n;
  if (whole >= 1_000_000n) return `$${(Number(whole) / 1_000_000).toFixed(1)}M`;
  if (whole >= 1_000n)     return `$${(Number(whole) / 1_000).toFixed(0)}K`;
  return `$${whole}`;
}

export function MarketCard({ market }: Props) {
  const yesRes     = market.yesReserve ? BigInt(market.yesReserve) : 0n;
  const noRes      = market.noReserve ? BigInt(market.noReserve) : 0n;
  const totalRes   = yesRes + noRes;
  const yesPct     = totalRes === 0n ? 50 : Number((noRes * 100n) / totalRes);
  const noPct      = 100 - yesPct;
  const yesPrice   = (yesPct / 100).toFixed(2);
  const noPrice    = (noPct  / 100).toFixed(2);

  const isExpired  = Date.now() / 1000 > market.endTime;
  const isResolved = market.outcome !== "Unresolved";
  const daysLeft   = Math.max(0, Math.floor((market.endTime * 1000 - Date.now()) / 86_400_000));

  const category = detectCategory(market.question);
  const volume   = formatUSDC(
    (BigInt(market.totalYes) + BigInt(market.totalNo)).toString()
  );

  let statusCls = "s-active";
  let statusLabel = "Active";
  if (market.outcome === "Yes")        { statusCls = "s-yes";  statusLabel = "YES"; }
  else if (market.outcome === "No")    { statusCls = "s-no";   statusLabel = "NO";  }
  else if (market.outcome === "Cancelled") { statusCls = "s-cancelled"; statusLabel = "Cancelled"; }

  return (
    <Link
      href={`/market/${market.publicKey}`}
      className={`mkt-item${isResolved ? " mkt-item-resolved" : ""}`}
    >
      {/* Top row: question + probability */}
      <div className="mkt-top">
        <h3 className="mkt-q">{market.question}</h3>
        <div className="mkt-right">
          <span className="mkt-prob-yes">{yesPct}%</span>
          <span className="cat-tag">{category}</span>
        </div>
      </div>

      {/* Outcome bar */}
      <div className="mkt-bar-wrap">
        <div className="mkt-bar">
          <div className="mkt-bar-fill" style={{ width: `${yesPct}%` }} />
        </div>
      </div>

      {/* Prices */}
      <div className="mkt-prices">
        <div className="mkt-price-item">
          <span className="price-lbl price-lbl-yes">YES</span>
          <span className="price-val">${yesPrice}</span>
        </div>
        <div className="mkt-price-item">
          <span className="price-lbl price-lbl-no">NO</span>
          <span className="price-val">${noPrice}</span>
        </div>
      </div>

      {/* Meta row */}
      <div className="mkt-meta">
        <div className="mkt-meta-item">
          <span className="mkt-meta-val">{volume}</span>
          <span>vol</span>
        </div>
        <div className="mkt-meta-item">
          <span className="mkt-meta-val">{(market.feeBps / 100).toFixed(1)}%</span>
          <span>fee</span>
        </div>
        <div className="mkt-meta-item">
          {isExpired || isResolved
            ? <><span className="mkt-meta-val">{new Date(market.endTime * 1000).toLocaleDateString("en", { month: "short", day: "numeric" })}</span><span>ended</span></>
            : <><span className="mkt-meta-val">{daysLeft}d</span><span>remaining</span></>
          }
        </div>
        <div className="mkt-meta-item">
          <span className={`s-badge ${statusCls}`}>{statusLabel}</span>
        </div>
      </div>
    </Link>
  );
}
