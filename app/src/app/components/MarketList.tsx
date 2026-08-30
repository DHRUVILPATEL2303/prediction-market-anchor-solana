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
      all.sort((a, b) => (BigInt(b.marketId) > BigInt(a.marketId) ? 1 : -1));
      setMarkets(all);
    } catch (err: unknown) {
      setError("Failed to load markets: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  const filtered = markets.filter((m) => {
    const matchesFilter =
      filter === "All" ||
      (filter === "Active"   && m.outcome === "Unresolved") ||
      (filter === "Resolved" && m.outcome !== "Unresolved");
    const matchesSearch = m.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeCount   = markets.filter((m) => m.outcome === "Unresolved").length;
  const resolvedCount = markets.filter((m) => m.outcome !== "Unresolved").length;

  return (
    <div>
      {/* Hero */}
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />

        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot" />
          Live on Solana Devnet
        </div>

        <h1 className="hero-title">
          Predict the{" "}
          <span className="gradient-text">Future.</span>
          <br />
          Win Big.
        </h1>
        <p className="hero-subtitle">
          Decentralized prediction markets powered by Solana. Trade on real-world
          outcomes with full on-chain transparency and instant settlement.
        </p>

        <div className="hero-actions">
          {connected && (
            <button className="btn-create-market" onClick={() => setShowCreate(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Create Market
            </button>
          )}
        </div>

        {/* Stats bar */}
        {connected && markets.length > 0 && (
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{markets.length}</span>
              <span className="hero-stat-label">Total Markets</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value" style={{ color: "var(--yes)" }}>{activeCount}</span>
              <span className="hero-stat-label">Active</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value" style={{ color: "var(--text-muted)" }}>{resolvedCount}</span>
              <span className="hero-stat-label">Resolved</span>
            </div>
          </div>
        )}
      </section>

      <div className="market-list-container">
        {/* Controls */}
        <div className="market-controls">
          <div className="controls-left">
            <div className="filter-tabs">
              {(["All", "Active", "Resolved"] as const).map((f) => (
                <button
                  key={f}
                  className={`filter-tab${filter === f ? " filter-tab-active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="search-wrap">
              <span className="search-icon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="text"
                className="search-input"
                placeholder="Search markets…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="controls-right">
            {connected && (
              <span className="controls-label">
                {filtered.length} market{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
            <button className="btn-refresh" onClick={loadMarkets} disabled={loading}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transition: "transform 0.4s", transform: loading ? "rotate(360deg)" : "none" }}>
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeLinecap="round" />
                <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" strokeLinecap="round" />
                <path d="M8 16H3v5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <div className="error-banner" style={{ marginBottom: 24 }}>{error}</div>}

        {/* Not connected */}
        {!connected && (
          <div className="connect-prompt">
            <div className="connect-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 12V22H4V12" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 7H2v5h20V7z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 22V7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>Connect your wallet</h2>
            <p>Connect your Solana wallet to view markets and place predictions on devnet.</p>
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
                <div className="empty-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                  </svg>
                </div>
                <h3>No markets found</h3>
                <p>
                  {searchQuery
                    ? `No markets match "${searchQuery}". Try a different search.`
                    : "Be the first to create a prediction market!"}
                </p>
                {!searchQuery && (
                  <button className="btn-primary" onClick={() => setShowCreate(true)}>
                    Create Market
                  </button>
                )}
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
      </div>

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
