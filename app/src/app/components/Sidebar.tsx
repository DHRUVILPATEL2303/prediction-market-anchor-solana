"use client";

import { MarketAccount } from "../types";
import Link from "next/link";

interface Props {
  markets: MarketAccount[];
  loading: boolean;
  connected: boolean;
  onCreateMarket: () => void;
}

function formatUSDC(raw: bigint): string {
  if (raw === 0n) return "$0";
  const whole = raw / 1_000_000n;
  if (whole >= 1_000_000n) return `$${(Number(whole) / 1_000_000).toFixed(1)}M`;
  if (whole >= 1_000n)     return `$${(Number(whole) / 1_000).toFixed(0)}K`;
  return `$${whole}`;
}

function detectCategory(q: string): string {
  const s = q.toLowerCase();
  if (/\b(btc|eth|sol|crypto|bitcoin|ethereum|defi|nft|token|blockchain|web3|usdc)\b/.test(s)) return "Crypto";
  if (/\b(election|vote|president|congress|senate|politi|govern|democrat|republican)\b/.test(s)) return "Politics";
  if (/\b(world cup|nba|nfl|league|championship|sport|game|match|team|player|score|goal)\b/.test(s)) return "Sports";
  if (/\b(ai|gpt|openai|tech|software|apple|google|microsoft|model|llm)\b/.test(s)) return "Technology";
  if (/\b(fed|interest|inflation|stock|economy|gdp|rate|bond|nasdaq)\b/.test(s)) return "Finance";
  return "General";
}

export function Sidebar({ markets, loading, connected, onCreateMarket }: Props) {
  const activeMarkets = markets.filter((m) => m.outcome === "Unresolved");
  const resolvedMarkets = markets.filter((m) => m.outcome !== "Unresolved");

  const totalVolume = markets.reduce((acc, m) => {
    return acc + BigInt(m.totalYes) + BigInt(m.totalNo);
  }, 0n);

  // Top markets by pool size
  const trending = [...markets]
    .filter((m) => m.outcome === "Unresolved")
    .sort((a, b) => {
      const aTotal = BigInt(a.totalYes) + BigInt(a.totalNo);
      const bTotal = BigInt(b.totalYes) + BigInt(b.totalNo);
      return bTotal > aTotal ? 1 : -1;
    })
    .slice(0, 4);

  return (
    <aside className="sidebar">
      {/* Platform stats */}
      <div className="sb-card">
        <div className="sb-hd">
          <span className="sb-hd-title">Platform Stats</span>
          <span className="sb-hd-sub">Devnet</span>
        </div>
        <div className="stats-grid">
          <div className="stats-cell">
            <div className="stats-cell-lbl">Markets</div>
            <div className="stats-cell-val">{loading ? "—" : markets.length}</div>
          </div>
          <div className="stats-cell">
            <div className="stats-cell-lbl">Active</div>
            <div className="stats-cell-val stats-cell-val-yes">
              {loading ? "—" : activeMarkets.length}
            </div>
          </div>
          <div className="stats-cell">
            <div className="stats-cell-lbl">Total Volume</div>
            <div className="stats-cell-val">
              {loading ? "—" : formatUSDC(totalVolume)}
            </div>
          </div>
          <div className="stats-cell">
            <div className="stats-cell-lbl">Resolved</div>
            <div className="stats-cell-val">{loading ? "—" : resolvedMarkets.length}</div>
          </div>
        </div>
      </div>

      {/* Trending markets */}
      {trending.length > 0 && (
        <div className="sb-card">
          <div className="sb-hd">
            <span className="sb-hd-title">Top Markets</span>
            <span className="sb-hd-sub">By volume</span>
          </div>
          <div className="sb-body">
            {trending.map((m, i) => {
              const yesRes   = m.yesReserve ? BigInt(m.yesReserve) : 0n;
              const noRes    = m.noReserve ? BigInt(m.noReserve) : 0n;
              const totalRes = yesRes + noRes;
              const yesPct   = totalRes === 0n ? 50 : Number((noRes * 100n) / totalRes);
              return (
                <Link href={`/market/${m.publicKey}`} key={m.publicKey} className="trend-item">
                  <span className="trend-rank">#{i + 1}</span>
                  <span className="trend-q">{m.question}</span>
                  <span className="trend-prob">{yesPct}%</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {markets.length > 0 && (
        <div className="sb-card">
          <div className="sb-hd">
            <span className="sb-hd-title">By Category</span>
          </div>
          <div className="sb-body">
            {(["Crypto", "Politics", "Sports", "Technology", "Finance", "General"] as const).map((cat) => {
              const count = markets.filter((m) => detectCategory(m.question) === cat).length;
              if (count === 0) return null;
              return (
                <div key={cat} className="trend-item" style={{ cursor: "default" }}>
                  <span className="trend-q" style={{ fontWeight: 400 }}>{cat}</span>
                  <span className="trend-prob" style={{ color: "var(--t2)", fontWeight: 600 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create market */}
      {connected && (
        <div className="sb-card">
          <div className="sb-create">
            <p className="sb-create-text">
              Create a new prediction market. Set the question, end date, and fee.
            </p>
            <button className="sb-create-btn" onClick={onCreateMarket}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Create Market
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
