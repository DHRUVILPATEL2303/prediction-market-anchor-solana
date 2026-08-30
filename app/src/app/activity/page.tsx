"use client";

import { useWallet } from "@solana/wallet-adapter-react";

export default function ActivityPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="act-pg">
        <div className="act-hd">
          <h1 className="act-title">Activity</h1>
        </div>
        <div className="conn-prompt">
          <div className="conn-prompt-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
            </svg>
          </div>
          <h2>Connect your wallet</h2>
          <p>Connect a Solana wallet to view your transaction history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="act-pg">
      <div className="act-hd">
        <h1 className="act-title">Activity</h1>
      </div>

      {/* Placeholder for activity list */}
      <div className="empty-state" style={{ border: "1px solid var(--line)", borderRadius: "var(--r2)", background: "var(--surface)" }}>
        <h3>No recent activity</h3>
        <p>Your transactions will appear here.</p>
      </div>

      {/* Example of what the list would look like (hidden for now) */}
      <div className="act-list" style={{ display: "none" }}>
        <div className="act-item">
          <div className="act-icon act-icon-buy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="act-info">
            <div className="act-desc">Bought YES in "Will SOL reach $250 by end of year?"</div>
            <div className="act-time">Today, 2:45 PM</div>
          </div>
          <div className="act-right">
            <div className="act-amt">150 USDC</div>
            <div className="act-status tx-confirmed"><span className="tx-dot" /> Confirmed</div>
          </div>
        </div>
        <div className="act-item">
          <div className="act-icon act-icon-sell">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="act-info">
            <div className="act-desc">Sold NO in "Will Apple release a car by 2026?"</div>
            <div className="act-time">Yesterday, 11:30 AM</div>
          </div>
          <div className="act-right">
            <div className="act-amt">45.50 USDC</div>
            <div className="act-status tx-confirmed"><span className="tx-dot" /> Confirmed</div>
          </div>
        </div>
        <div className="act-item">
          <div className="act-icon act-icon-other">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="act-info">
            <div className="act-desc">Added Liquidity to "Will Bitcoin flip Gold by 2030?"</div>
            <div className="act-time">May 12, 9:00 AM</div>
          </div>
          <div className="act-right">
            <div className="act-amt">500 USDC</div>
            <div className="act-status tx-failed"><span className="tx-dot" /> Failed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
