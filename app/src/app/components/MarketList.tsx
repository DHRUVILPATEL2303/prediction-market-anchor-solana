"use client";

import { useEffect, useState, useCallback } from "react";
import { useProgram, fetchAllMarkets } from "../lib/program";
import { MarketAccount } from "../types";
import { MarketCard } from "./MarketCard";
import { CreateMarketModal } from "./CreateMarketModal";
import { useWallet } from "@solana/wallet-adapter-react";

export function MarketList() {
  const { program } = useProgram();
  const { connected } = useWallet();
  const [markets, setMarkets] = useState<MarketAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"All" | "Active" | "Resolved">("All");
  const [searchQuery, setSearchQuery] = useState("");

  const loadMarkets = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    setError("");
    try {
      const all = await fetchAllMarkets(program);
      // Sort by market id desc (newest first)
      all.sort((a, b) => (BigInt(b.marketId) > BigInt(a.marketId) ? 1 : -1));
      setMarkets(all);
    } catch (err: unknown) {
      setError("Failed to load markets: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, [program]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const filtered = markets.filter((m) => {
    const matchesFilter =
      filter === "All" ||
      (filter === "Active" && m.outcome === "Unresolved") ||
      (filter === "Resolved" && m.outcome !== "Unresolved");
    const matchesSearch = m.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="market-list-container">
      {/* Hero */}
      <div className="hero">
        <div className="hero-glow" />
        <h1 className="hero-title">
          Predict the <span className="gradient-text">Future</span>
        </h1>
        <p className="hero-subtitle">
          Bet on real-world outcomes with on-chain transparency, powered by Solana.
        </p>
        {connected && (
          <button className="btn-create-market" onClick={() => setShowCreate(true)}>
            + Create Market
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="market-controls">
        <div className="filter-tabs">
          {(["All", "Active", "Resolved"] as const).map((f) => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? "filter-tab-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search markets…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn-refresh" onClick={loadMarkets} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && <div className="error-banner">{error}</div>}

      {/* Not connected */}
      {!connected && (
        <div className="connect-prompt">
          <div className="connect-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2>Connect your wallet to get started</h2>
          <p>View markets and place predictions on Solana devnet.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      )}

      {/* Markets Grid */}
      {!loading && connected && (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">—</div>
              <h3>No markets found</h3>
              <p>Be the first to create a prediction market!</p>
              <button className="btn-primary" onClick={() => setShowCreate(true)}>
                Create Market
              </button>
            </div>
          ) : (
            <div className="markets-grid">
              {filtered.map((m) => (
                <MarketCard key={m.publicKey} market={m} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateMarketModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            setTimeout(loadMarkets, 2000);
          }}
        />
      )}
    </div>
  );
}
