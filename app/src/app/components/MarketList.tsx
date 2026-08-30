"use client";

import { useEffect, useState, useCallback } from "react";
import { useProgram, fetchAllMarkets } from "../lib/program";
import { MarketAccount } from "../types";
import { MarketCard } from "./MarketCard";
import { Sidebar } from "./Sidebar";
import { CreateMarketModal } from "./CreateMarketModal";
import { useWallet } from "@solana/wallet-adapter-react";

type FilterCat = "All" | "Crypto" | "Politics" | "Sports" | "Technology" | "Finance" | "General";
type SortKey   = "newest" | "ending" | "volume" | "active";

function detectCategory(q: string): string {
  const s = q.toLowerCase();
  if (/\b(btc|eth|sol|crypto|bitcoin|ethereum|defi|nft|token|blockchain|web3|usdc)\b/.test(s)) return "Crypto";
  if (/\b(election|vote|president|congress|senate|politi|govern|democrat|republican)\b/.test(s)) return "Politics";
  if (/\b(world cup|nba|nfl|league|championship|sport|game|match|team|player|score|goal)\b/.test(s)) return "Sports";
  if (/\b(ai|gpt|openai|tech|software|apple|google|microsoft|model|llm)\b/.test(s)) return "Technology";
  if (/\b(fed|interest|inflation|stock|economy|gdp|rate|bond|nasdaq)\b/.test(s)) return "Finance";
  return "General";
}

const CATEGORIES: FilterCat[] = ["All", "Crypto", "Politics", "Sports", "Technology", "Finance", "General"];

export function MarketList() {
  const { program } = useProgram();
  const { connected } = useWallet();
  const [markets, setMarkets] = useState<MarketAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [cat, setCat] = useState<FilterCat>("All");
  const [sort, setSort] = useState<SortKey>("newest");
  const [search, setSearch] = useState("");

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

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  // Filter + sort
  let filtered = markets.filter((m) => {
    if (cat !== "All" && detectCategory(m.question) !== cat) return false;
    if (search && !m.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (sort === "ending")  return a.endTime - b.endTime;
    if (sort === "volume")  {
      const av = BigInt(a.totalYes) + BigInt(a.totalNo);
      const bv = BigInt(b.totalYes) + BigInt(b.totalNo);
      return bv > av ? 1 : -1;
    }
    if (sort === "active")  {
      const aA = a.outcome === "Unresolved" ? 0 : 1;
      const bA = b.outcome === "Unresolved" ? 0 : 1;
      return aA - bA;
    }
    return BigInt(b.marketId) > BigInt(a.marketId) ? 1 : -1;
  });

  return (
    <div className="pg">
      {/* Filter bar */}
      <div className="fbar">
        <div className="fbar-left">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`cat-tab${cat === c ? " cat-tab-active" : ""}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="fbar-right">
          <select
            className="sort-pick"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="newest">Newest</option>
            <option value="volume">Highest Volume</option>
            <option value="ending">Ending Soon</option>
            <option value="active">Active First</option>
          </select>

          <div className="search-box">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search markets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            className="btn-refresh"
            onClick={loadMarkets}
            disabled={loading}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transition: "transform 0.4s", transform: loading ? "rotate(180deg)" : "none" }}>
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" strokeLinecap="round" />
              <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" strokeLinecap="round" />
              <path d="M8 16H3v5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {loading ? "Loading…" : "Refresh"}
          </button>

          {connected && (
            <button className="btn-create" onClick={() => setShowCreate(true)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              New Market
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="pg-layout">
        {/* Main column */}
        <div className="pg-main">
          {/* List header */}
          {connected && !loading && (
            <div className="list-hd">
              <span className="list-hd-title">
                {cat === "All" ? "All Markets" : cat}
              </span>
              <span className="list-hd-count">
                {filtered.length} market{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Error */}
          {error && <div className="err-bar">{error}</div>}

          {/* Not connected */}
          {!connected && (
            <div className="conn-prompt">
              <div className="conn-prompt-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
                </svg>
              </div>
              <h2>Connect your wallet</h2>
              <p>Connect a Solana wallet to view and trade on prediction markets.</p>
            </div>
          )}

          {/* Loading skeletons */}
          {loading && (
            <div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skel-item" />
              ))}
            </div>
          )}

          {/* Market list */}
          {!loading && connected && (
            <>
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <h3>No markets found</h3>
                  <p>
                    {search
                      ? `No results for "${search}"`
                      : cat !== "All"
                      ? `No ${cat} markets yet`
                      : "Be the first to create a prediction market."}
                  </p>
                </div>
              ) : (
                <div className="mkt-list">
                  {filtered.map((m) => (
                    <MarketCard key={m.publicKey} market={m} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <Sidebar
          markets={markets}
          loading={loading}
          connected={connected}
          onCreateMarket={() => setShowCreate(true)}
        />
      </div>

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
