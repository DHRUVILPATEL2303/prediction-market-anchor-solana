"use client";

import { useEffect, useState, useCallback } from "react";
import { useProgram, useMarketActions, fetchMarket } from "../lib/program";
import { MarketAccount, PositionAccount } from "../types";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

function formatShares(raw: string) {
  const n = BigInt(raw);
  if (n === 0n) return "0";
  const whole = n / 1_000_000n;
  const frac = n % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0").slice(0, 2)}`;
}

export function MarketDetails({ marketId }: { marketId: string }) {
  const { program } = useProgram();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { resolveMarket, cancelMarket, claimWinnings, refundPosition, fetchUserPosition, buyShares } = useMarketActions();

  const [market, setMarket] = useState<MarketAccount | null>(null);
  const [position, setPosition] = useState<PositionAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Buy Form State
  const [side, setSide] = useState<"Yes" | "No">("Yes");
  const [amount, setAmount] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState("");

  const loadData = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      const m = await fetchMarket(program, marketId);
      setMarket(m);
      if (m && connected) {
        const p = await fetchUserPosition(marketId);
        setPosition(p);
      }
    } catch (err) {
      setError("Failed to load market");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, connected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResolve = async (outcome: "Yes" | "No" | "Cancelled") => {
    setActionLoading(true);
    try {
      await resolveMarket(marketId, outcome);
      await loadData();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await cancelMarket(marketId);
      await loadData();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!market || !publicKey) return setError("Wallet not connected");
    setActionLoading(true);
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      await claimWinnings(marketId, market.paymentMint, ata.toString(), market.treasury);
      await loadData();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!market || !publicKey) return setError("Wallet not connected");
    setActionLoading(true);
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      await refundPosition(marketId, market.paymentMint, ata.toString());
      await loadData();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !publicKey) { setBuyError("Connect your wallet first"); return; }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) { setBuyError("Enter a valid amount"); return; }

    if (!market) return;

    setBuyLoading(true);
    setBuyError("");
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      
      const ataInfo = await connection.getAccountInfo(ata);
      if (!ataInfo) {
        setBuyError("You don't have a token account for this mint. Please create one first.");
        setBuyLoading(false);
        return;
      }

      const rawAmount = Math.floor(amountNum * 1_000_000);
      await buyShares(
        market.publicKey,
        side,
        rawAmount,
        market.paymentMint,
        ata.toString()
      );
      
      setAmount("");
      await loadData(); // refresh position
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setBuyError(msg);
    } finally {
      setBuyLoading(false);
    }
  }

  if (loading) {
    return <div className="market-details-loading">Loading market…</div>;
  }

  if (!market) {
    return <div className="error-banner">Market not found</div>;
  }

  const isExpired = Date.now() / 1000 > market.endTime;
  const isAuthority = publicKey?.toString() === market.authority;
  const totalYes = BigInt(market.totalYes);
  const totalNo = BigInt(market.totalNo);
  const total = totalYes + totalNo;
  const yesPercent = total === 0n ? 50 : Number((totalYes * 100n) / total);
  const noPercent = 100 - yesPercent;

  return (
    <div className="market-details-container">
      <Link href="/" className="btn-secondary" style={{ display: 'inline-block', marginBottom: '2rem' }}>
        ← Back to Markets
      </Link>

      <div className="market-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <span className={`badge ${market.outcome === "Unresolved" ? "badge-active" : (market.outcome === "Yes" ? "badge-yes" : "badge-no")}`}>
             {market.outcome}
           </span>
           <span className="market-id">ID: #{market.marketId}</span>
        </div>
        <h1 className="market-details-title">{market.question}</h1>
        
        <div className="market-stats" style={{ marginTop: '2rem' }}>
          <div className="stat">
            <span className="stat-label">YES Pool</span>
            <span className="stat-value yes-color">{formatShares(market.totalYes)} USDC</span>
          </div>
          <div className="stat">
            <span className="stat-label">NO Pool</span>
            <span className="stat-value no-color">{formatShares(market.totalNo)} USDC</span>
          </div>
        </div>

        <div className="progress-bar-wrap" style={{ marginTop: '1.5rem' }}>
          <div className="progress-bar">
            <div className="progress-yes" style={{ width: `${yesPercent}%` }} />
            <div className="progress-no" style={{ width: `${noPercent}%` }} />
          </div>
          <div className="progress-labels">
            <span className="yes-color">{yesPercent}% YES</span>
            <span className="no-color">{noPercent}% NO</span>
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="market-panels">
        {/* Trading Panel */}
        {market.outcome === "Unresolved" && !isExpired && (
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <h2>Trade</h2>
            </div>
            
            <form onSubmit={handleBuy} style={{ padding: '1.5rem' }}>
              <div className="side-selector" style={{ marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  className={`side-btn yes-btn ${side === "Yes" ? "active-yes" : ""}`}
                  onClick={() => setSide("Yes")}
                  style={{ padding: "16px" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "1.2rem", letterSpacing: "1px" }}>YES</span>
                    <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>{yesPercent}% chance</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`side-btn no-btn ${side === "No" ? "active-no" : ""}`}
                  onClick={() => setSide("No")}
                  style={{ padding: "16px" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "1.2rem", letterSpacing: "1px" }}>NO</span>
                    <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>{100 - yesPercent}% chance</span>
                  </div>
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Amount (USDC)</label>
                <div className="amount-input-wrap">
                  <input
                    type="number"
                    className="form-input amount-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="any"
                  />
                  <span className="amount-suffix">USDC</span>
                </div>
              </div>

              <div className="buy-summary" style={{ marginBottom: '1.5rem' }}>
                <div className="summary-row">
                  <span>Side</span>
                  <span className={side === "Yes" ? "yes-color" : "no-color"}>{side}</span>
                </div>
                <div className="summary-row">
                  <span>Protocol Fee</span>
                  <span>{(market.feeBps / 100).toFixed(2)}%</span>
                </div>
                <div className="summary-row">
                  <span>Shares received</span>
                  <span>≈ {amount || "0"} shares</span>
                </div>
              </div>

              {buyError && <div className="form-error" style={{ marginBottom: '1rem' }}>{buyError}</div>}

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }} disabled={buyLoading}>
                {buyLoading ? "Buying…" : `Buy ${side} Shares`}
              </button>
            </form>
          </div>
        )}

        {/* Your Position Panel */}
        {connected && position && (
          <div className="panel position-panel">
            <h2>Your Position</h2>
            <div className="position-stats">
              <div className="stat">
                <span className="stat-label">YES Shares</span>
                <span className="stat-value yes-color">{formatShares(position.yesShares)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">NO Shares</span>
                <span className="stat-value no-color">{formatShares(position.noShares)}</span>
              </div>
            </div>
            
            {/* Settlement actions */}
            {(market.outcome === "Yes" || market.outcome === "No") && !position.claimed && (
              <div className="settlement-action">
                <button className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleClaim} disabled={actionLoading}>
                  {actionLoading ? "Claiming..." : "Claim Winnings"}
                </button>
              </div>
            )}
            {market.outcome === "Cancelled" && !position.refunded && (
              <div className="settlement-action">
                <button className="btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleRefund} disabled={actionLoading}>
                  {actionLoading ? "Refunding..." : "Refund"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Admin Panel */}
        {isAuthority && market.outcome === "Unresolved" && (
          <div className="panel admin-panel">
            <h2>Admin Controls</h2>
            <p>You are the creator of this market.</p>
            <div className="admin-actions">
              <button className="btn-primary yes-color" onClick={() => handleResolve("Yes")} disabled={actionLoading}>Resolve YES</button>
              <button className="btn-primary no-color" onClick={() => handleResolve("No")} disabled={actionLoading}>Resolve NO</button>
              <button className="btn-secondary" onClick={handleCancel} disabled={actionLoading}>Cancel Market</button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
