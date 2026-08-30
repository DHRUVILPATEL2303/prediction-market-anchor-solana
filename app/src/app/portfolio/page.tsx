"use client";

import { useEffect, useState, useCallback } from "react";
import { useProgram, fetchAllMarkets } from "../lib/program";
import { MarketAccount } from "../types";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

interface Position {
  marketId: string;
  question: string;
  side: "Yes" | "No";
  shares: number;
  value: number;
}

export default function PortfolioPage() {
  const { program } = useProgram();
  const { connected, publicKey } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPositions = useCallback(async () => {
    if (!program || !publicKey || !connected) return;
    setLoading(true);
    try {
      const allMarkets = await fetchAllMarkets(program);
      const activePositions: Position[] = [];

      // This is a naive implementation for the UI.
      // In a real app, we'd fetch all token accounts for the user and cross-reference with markets.
      // For this demo, we'll just show an empty state to demonstrate the UI.
      
      setPositions(activePositions);
    } catch (err) {
      setError("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, [program, publicKey, connected]);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  if (!connected) {
    return (
      <div className="port-pg">
        <h1 className="port-title">Portfolio</h1>
        <div className="conn-prompt">
          <div className="conn-prompt-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
            </svg>
          </div>
          <h2>Connect your wallet</h2>
          <p>Connect a Solana wallet to view your portfolio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="port-pg">
      <div className="port-hd">
        <h1 className="port-title">Portfolio</h1>
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-lbl">Total Value</div>
            <div className="kpi-val">$0.00</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Unrealized P&L</div>
            <div className="kpi-val kpi-pos">+$0.00</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Realized P&L</div>
            <div className="kpi-val kpi-pos">+$0.00</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Open Positions</div>
            <div className="kpi-val">0</div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)", marginBottom: 12 }}>Open Positions</h2>

      {loading ? (
        <div className="skel-item" />
      ) : positions.length === 0 ? (
        <div className="empty-state" style={{ border: "1px solid var(--line)", borderRadius: "var(--r2)", background: "var(--surface)" }}>
          <h3>No open positions</h3>
          <p>You don&apos;t have any active positions yet.</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="port-tbl">
            <thead>
              <tr>
                <th className="mkt-col">Market</th>
                <th>Position</th>
                <th>Avg Price</th>
                <th>Current Price</th>
                <th>Shares</th>
                <th>Value</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={i}>
                  <td className="mkt-col">
                    <Link href={`/market/${p.marketId}`} style={{ color: "var(--t1)", fontWeight: 500, textDecoration: "none" }}>
                      {p.question}
                    </Link>
                  </td>
                  <td>
                    <span className={`pos-tag ${p.side === "Yes" ? "pos-yes" : "pos-no"}`}>
                      {p.side}
                    </span>
                  </td>
                  <td>$0.00</td>
                  <td>$0.00</td>
                  <td>{p.shares}</td>
                  <td>${p.value.toFixed(2)}</td>
                  <td className="pnl-pos">+$0.00</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
