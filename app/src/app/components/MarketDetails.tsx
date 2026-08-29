"use client";

import { useEffect, useState, useCallback } from "react";
import { useProgram, useMarketActions, fetchMarket, fetchAmm, PROGRAM_ID } from "../lib/program";
import { MarketAccount, AmmAccount } from "../types";
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

// Calculate the exact amount to swap so the output equals the amount to redeem
function calculateExactSwapAmount(
  totalSellAmount: number,
  reserveIn: number,
  reserveOut: number,
  feeBps: number
): number {
  if (totalSellAmount === 0 || reserveIn === 0 || reserveOut === 0) return 0;
  const fRem = (10000 - feeBps) / 10000;
  
  const a = fRem;
  const b = reserveIn + reserveOut * fRem - totalSellAmount * fRem;
  const c = -reserveIn * totalSellAmount;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0; // Math error

  const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  return Math.floor(x1);
}

export function MarketDetails({ marketId }: { marketId: string }) {
  const { program } = useProgram();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { resolveMarket, cancelMarket, claimWinnings, buyShares, sellShares, addLiquidity, removeLiquidity } = useMarketActions();

  const [market, setMarket] = useState<MarketAccount | null>(null);
  const [amm, setAmm] = useState<AmmAccount | null>(null);
  
  // Native SPL Token Balances
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [yesBalance, setYesBalance] = useState<string>("0");
  const [noBalance, setNoBalance] = useState<string>("0");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Trade Form State
  const [tradeMode, setTradeMode] = useState<"Buy" | "Sell">("Buy");
  const [side, setSide] = useState<"Yes" | "No">("Yes");
  const [amount, setAmount] = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState("");
  
  // Admin State
  const [liquidityAmount, setLiquidityAmount] = useState("");

  const loadData = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      const m = await fetchMarket(program, marketId);
      setMarket(m);
      if (m) {
        const a = await fetchAmm(program, marketId);
        setAmm(a);
      }

      if (m && connected && publicKey) {
        const paymentMint = new PublicKey(m.paymentMint);
        const marketPubkey = new PublicKey(marketId);

        const [yesMint] = PublicKey.findProgramAddressSync([Buffer.from("yes-mint"), marketPubkey.toBuffer()], PROGRAM_ID);
        const [noMint] = PublicKey.findProgramAddressSync([Buffer.from("no-mint"), marketPubkey.toBuffer()], PROGRAM_ID);

        // Fetch balances
        try {
          const usdcAta = await getAssociatedTokenAddress(paymentMint, publicKey);
          const usdcInfo = await connection.getTokenAccountBalance(usdcAta);
          setUsdcBalance(usdcInfo.value.uiAmountString || "0");
        } catch { setUsdcBalance("0"); }
        
        try {
          const yesAta = await getAssociatedTokenAddress(yesMint, publicKey);
          const yesInfo = await connection.getTokenAccountBalance(yesAta);
          setYesBalance(yesInfo.value.uiAmountString || "0");
        } catch { setYesBalance("0"); }
        
        try {
          const noAta = await getAssociatedTokenAddress(noMint, publicKey);
          const noInfo = await connection.getTokenAccountBalance(noAta);
          setNoBalance(noInfo.value.uiAmountString || "0");
        } catch { setNoBalance("0"); }
      }
    } catch (err) {
      setError("Failed to load market");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, connected, publicKey]);

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
      await claimWinnings(marketId, ata.toString());
      await loadData();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!market || !publicKey) return;
    const amountNum = parseFloat(liquidityAmount);
    if (!amountNum || amountNum < 10) return setError("Minimum liquidity amount is 10 USDC");
    setActionLoading(true);
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      const rawAmount = Math.floor(amountNum * 1_000_000);
      await addLiquidity(marketId, rawAmount, market.paymentMint, ata.toString());
      setLiquidityAmount("");
      await loadData();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!market || !publicKey) return;
    const amountNum = parseFloat(liquidityAmount);
    if (!amountNum || amountNum <= 0) return setError("Invalid liquidity amount");
    setActionLoading(true);
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      const rawAmount = Math.floor(amountNum * 1_000_000);
      await removeLiquidity(marketId, rawAmount, ata.toString());
      setLiquidityAmount("");
      await loadData();
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setActionLoading(false);
    }
  };

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !publicKey) { setTradeError("Connect your wallet first"); return; }
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) { setTradeError("Enter a valid amount"); return; }

    if (!market) return;

    setTradeLoading(true);
    setTradeError("");
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      
      const ataInfo = await connection.getAccountInfo(ata);
      if (!ataInfo && tradeMode === "Buy") {
        setTradeError("You don't have a token account for this mint. Please create one first or get USDC.");
        setTradeLoading(false);
        return;
      }

      const rawAmount = Math.floor(amountNum * 1_000_000);

      if (tradeMode === "Buy") {
        await buyShares(
          market.publicKey,
          side,
          rawAmount,
          market.paymentMint,
          ata.toString()
        );
      } else {
        // Exact Math to eliminate dust!
        // If selling YES, we swap YES for NO. 
        // reserveIn = yesReserve, reserveOut = noReserve.
        if (!amm) throw new Error("AMM data not loaded");
        
        const resIn = side === "Yes" ? Number(amm.yesReserve) : Number(amm.noReserve);
        const resOut = side === "Yes" ? Number(amm.noReserve) : Number(amm.yesReserve);
        
        const swapAmount = calculateExactSwapAmount(rawAmount, resIn, resOut, amm.feeBps);
        const redeemAmount = rawAmount - swapAmount;
        
        if (swapAmount <= 0 || redeemAmount <= 0) {
          throw new Error("Amount too small to sell or pool lacks liquidity");
        }

        await sellShares(
          market.publicKey,
          side,
          swapAmount,
          redeemAmount,
          ata.toString()
        );
      }
      
      setAmount("");
      await loadData(); // refresh position
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTradeError(msg);
    } finally {
      setTradeLoading(false);
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
  
  // Price Calculation from AMM Reserves
  const yesRes = amm ? BigInt(amm.yesReserve) : 0n;
  const noRes = amm ? BigInt(amm.noReserve) : 0n;
  const totalRes = yesRes + noRes;
  
  // Price of YES is noReserve / totalRes
  const yesPercent = totalRes === 0n ? 50 : Number((noRes * 100n) / totalRes);
  const noPercent = 100 - yesPercent;
  
  const yesPrice = (yesPercent / 100).toFixed(2);
  const noPrice = (noPercent / 100).toFixed(2);

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
            <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Trade</h2>
              {connected && <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Wallet: {usdcBalance} USDC</span>}
            </div>
            
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <button 
                className={`tab-btn ${tradeMode === "Buy" ? "active" : ""}`} 
                onClick={() => setTradeMode("Buy")}
                style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: tradeMode === "Buy" ? '2px solid #3b82f6' : '2px solid transparent', color: tradeMode === "Buy" ? 'white' : '#94a3b8', cursor: 'pointer', fontWeight: 600 }}
              >
                Buy
              </button>
              <button 
                className={`tab-btn ${tradeMode === "Sell" ? "active" : ""}`} 
                onClick={() => setTradeMode("Sell")}
                style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: tradeMode === "Sell" ? '2px solid #3b82f6' : '2px solid transparent', color: tradeMode === "Sell" ? 'white' : '#94a3b8', cursor: 'pointer', fontWeight: 600 }}
              >
                Sell
              </button>
            </div>
            
            <form onSubmit={handleTrade} style={{ padding: '1.5rem' }}>
              <div className="side-selector" style={{ marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  className={`side-btn yes-btn ${side === "Yes" ? "active-yes" : ""}`}
                  onClick={() => setSide("Yes")}
                  style={{ padding: "16px" }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "1.2rem", letterSpacing: "1px" }}>YES</span>
                    <span style={{ fontSize: "0.9rem" }}>${yesPrice}</span>
                    <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{yesPercent}% chance</span>
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
                    <span style={{ fontSize: "0.9rem" }}>${noPrice}</span>
                    <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>{noPercent}% chance</span>
                  </div>
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">
                  Amount {tradeMode === "Buy" ? "(USDC)" : `(Shares to Liquidate)`}
                </label>
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
                  <span className="amount-suffix">{tradeMode === "Buy" ? "USDC" : "Shares"}</span>
                </div>
              </div>

              <div className="buy-summary" style={{ marginBottom: '1.5rem' }}>
                <div className="summary-row">
                  <span>Action</span>
                  <span>{tradeMode} <span className={side === "Yes" ? "yes-color" : "no-color"}>{side}</span></span>
                </div>
                <div className="summary-row">
                  <span>Protocol Fee</span>
                  <span>{(market.feeBps / 100).toFixed(2)}%</span>
                </div>
              </div>

              {tradeError && <div className="form-error" style={{ marginBottom: '1rem' }}>{tradeError}</div>}

              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '14px' }} disabled={tradeLoading}>
                {tradeLoading ? "Processing…" : `${tradeMode} ${side}`}
              </button>
            </form>
          </div>
        )}

        {/* Your Position Panel */}
        {connected && (
          <div className="panel position-panel">
            <h2>Your Balances</h2>
            <div className="position-stats">
              <div className="stat">
                <span className="stat-label">YES Shares</span>
                <span className="stat-value yes-color">{yesBalance}</span>
              </div>
              <div className="stat">
                <span className="stat-label">NO Shares</span>
                <span className="stat-value no-color">{noBalance}</span>
              </div>
            </div>
            
            {/* Settlement actions */}
            {(market.outcome === "Yes" || market.outcome === "No" || market.outcome === "Cancelled") && (
              <div className="settlement-action">
                <button className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleClaim} disabled={actionLoading}>
                  {actionLoading ? "Processing..." : "Claim Winnings / Refund"}
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
            
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: '1.5rem' }}>
              <h3>Manage AMM Liquidity</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>Supply USDC so users can start trading!</p>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Amount (USDC or LP Shares)"
                  value={liquidityAmount}
                  onChange={(e) => setLiquidityAmount(e.target.value)}
                  min="0"
                  step="any"
                  style={{ flex: 1 }}
                />
                <button className="btn-primary" onClick={handleAddLiquidity} disabled={actionLoading}>Add</button>
                <button className="btn-secondary" onClick={handleRemoveLiquidity} disabled={actionLoading}>Remove</button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
