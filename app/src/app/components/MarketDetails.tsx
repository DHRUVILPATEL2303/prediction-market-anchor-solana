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
  if (n === 0n) return "0.00";
  const whole = n / 1_000_000n;
  const frac  = n % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0").slice(0, 2)}`;
}

// Calculate exact swap amount so output equals amount to redeem
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
  if (discriminant < 0) return 0;
  const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  return Math.floor(x1);
}

function outcomeLabel(outcome: string) {
  if (outcome === "Yes")       return { label: "Resolved YES", cls: "badge-yes" };
  if (outcome === "No")        return { label: "Resolved NO",  cls: "badge-no"  };
  if (outcome === "Cancelled") return { label: "Cancelled",    cls: "badge-cancelled" };
  return { label: "Active", cls: "badge-active" };
}

export function MarketDetails({ marketId }: { marketId: string }) {
  const { program } = useProgram();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const { resolveMarket, cancelMarket, claimWinnings, buyShares, sellShares, addLiquidity, removeLiquidity } =
    useMarketActions();

  const [market, setMarket] = useState<MarketAccount | null>(null);
  const [amm, setAmm]       = useState<AmmAccount | null>(null);

  // Balances
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [yesBalance,  setYesBalance]  = useState<string>("0");
  const [noBalance,   setNoBalance]   = useState<string>("0");

  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,         setError]         = useState("");

  // Trade form
  const [tradeMode,    setTradeMode]    = useState<"Buy" | "Sell">("Buy");
  const [side,         setSide]         = useState<"Yes" | "No">("Yes");
  const [amount,       setAmount]       = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError,   setTradeError]   = useState("");

  // Admin
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
        const paymentMint  = new PublicKey(m.paymentMint);
        const marketPubkey = new PublicKey(marketId);

        const [yesMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("yes-mint"), marketPubkey.toBuffer()],
          PROGRAM_ID
        );
        const [noMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("no-mint"), marketPubkey.toBuffer()],
          PROGRAM_ID
        );

        try {
          const usdcAta  = await getAssociatedTokenAddress(paymentMint, publicKey);
          const usdcInfo = await connection.getTokenAccountBalance(usdcAta);
          setUsdcBalance(usdcInfo.value.uiAmountString || "0");
        } catch { setUsdcBalance("0"); }

        try {
          const yesAta  = await getAssociatedTokenAddress(yesMint, publicKey);
          const yesInfo = await connection.getTokenAccountBalance(yesAta);
          setYesBalance(yesInfo.value.uiAmountString || "0");
        } catch { setYesBalance("0"); }

        try {
          const noAta  = await getAssociatedTokenAddress(noMint, publicKey);
          const noInfo = await connection.getTokenAccountBalance(noAta);
          setNoBalance(noInfo.value.uiAmountString || "0");
        } catch { setNoBalance("0"); }
      }
    } catch {
      setError("Failed to load market");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, connected, publicKey]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Action handlers ─────────────────────────────────────────── */
  const handleResolve = async (outcome: "Yes" | "No" | "Cancelled") => {
    setActionLoading(true);
    try {
      await resolveMarket(marketId, outcome);
      await loadData();
    } catch (err: any) { setError(err.message || String(err)); }
    finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try {
      await cancelMarket(marketId);
      await loadData();
    } catch (err: any) { setError(err.message || String(err)); }
    finally { setActionLoading(false); }
  };

  const handleClaim = async () => {
    if (!market || !publicKey) return setError("Wallet not connected");
    setActionLoading(true);
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      await claimWinnings(marketId, ata.toString());
      await loadData();
    } catch (err: any) { setError(err.message || String(err)); }
    finally { setActionLoading(false); }
  };

  const handleAddLiquidity = async () => {
    if (!market || !publicKey) return;
    const amountNum = parseFloat(liquidityAmount);
    if (!amountNum || amountNum < 1) return setError("Minimum liquidity amount is 1 USDC");
    setActionLoading(true);
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      const rawAmount = Math.floor(amountNum * 1_000_000);
      await addLiquidity(marketId, rawAmount, market.paymentMint, ata.toString());
      setLiquidityAmount("");
      await loadData();
    } catch (err: any) { setError(err.message || String(err)); }
    finally { setActionLoading(false); }
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
    } catch (err: any) { setError(err.message || String(err)); }
    finally { setActionLoading(false); }
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
      const ata        = await getAssociatedTokenAddress(mintPubkey, publicKey);

      const ataInfo = await connection.getAccountInfo(ata);
      if (!ataInfo && tradeMode === "Buy") {
        setTradeError("You don't have a token account for this mint. Please get USDC first.");
        setTradeLoading(false);
        return;
      }

      const rawAmount = Math.floor(amountNum * 1_000_000);

      if (tradeMode === "Buy") {
        await buyShares(market.publicKey, side, rawAmount, market.paymentMint, ata.toString());
      } else {
        if (!amm) throw new Error("AMM data not loaded");

        const resIn  = side === "Yes" ? Number(amm.yesReserve) : Number(amm.noReserve);
        const resOut = side === "Yes" ? Number(amm.noReserve)  : Number(amm.yesReserve);

        const swapAmount   = calculateExactSwapAmount(rawAmount, resIn, resOut, amm.feeBps);
        const redeemAmount = rawAmount - swapAmount;

        if (swapAmount <= 0 || redeemAmount <= 0) {
          throw new Error("Amount too small to sell or pool lacks liquidity");
        }

        await sellShares(market.publicKey, side, swapAmount, redeemAmount, ata.toString());
      }

      setAmount("");
      await loadData();
    } catch (err: unknown) {
      setTradeError(err instanceof Error ? err.message : String(err));
    } finally {
      setTradeLoading(false);
    }
  }

  /* ── Loading / error states ──────────────────────────────────── */
  if (loading) {
    return (
      <div className="market-details-loading">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
        </svg>
        Loading market…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="market-details-page">
        <div className="error-banner">Market not found or could not be loaded.</div>
      </div>
    );
  }

  /* ── Derived values ──────────────────────────────────────────── */
  const isExpired    = Date.now() / 1000 > market.endTime;
  const isAuthority  = publicKey?.toString() === market.authority;
  const isActive     = market.outcome === "Unresolved" && !isExpired;

  const yesRes   = amm ? BigInt(amm.yesReserve) : 0n;
  const noRes    = amm ? BigInt(amm.noReserve)  : 0n;
  const totalRes = yesRes + noRes;

  // Price of YES = noReserve / totalRes (CPMM convention)
  const yesPercent = totalRes === 0n ? 50 : Number((noRes  * 100n) / totalRes);
  const noPercent  = 100 - yesPercent;
  const yesPrice   = (yesPercent / 100).toFixed(2);
  const noPrice    = (noPercent  / 100).toFixed(2);

  const { label, cls } = outcomeLabel(market.outcome);

  const endDate   = new Date(market.endTime * 1000);
  const timeLeft  = market.endTime * 1000 - Date.now();
  const daysLeft  = Math.max(0, Math.floor(timeLeft / 86400000));

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="market-details-page">
      {/* Back */}
      <Link href="/" className="back-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Markets
      </Link>

      {/* Header card */}
      <div className="market-header-card">
        <div className="market-header-top">
          <span className={`badge ${cls}`}>
            <span className="badge-dot" />
            {label}
          </span>
          <span className="market-id">#{market.marketId}</span>
        </div>

        <h1 className="market-details-title">{market.question}</h1>

        {/* Probability pills */}
        <div className="probability-display">
          <div className="prob-pill prob-pill-yes">
            <div>
              <div className="prob-label">YES</div>
              <div className="prob-value">{yesPercent}%</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--yes)", opacity: 0.7 }}>
              ${yesPrice}
            </div>
          </div>
          <div className="prob-pill prob-pill-no">
            <div>
              <div className="prob-label">NO</div>
              <div className="prob-value">{noPercent}%</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--no)", opacity: 0.7 }}>
              ${noPrice}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="details-progress-bar">
          <div className="progress-yes" style={{ width: `${yesPercent}%` }} />
          <div className="progress-no"  style={{ width: `${noPercent}%`  }} />
        </div>
        <div className="details-progress-labels">
          <span className="yes-color">{yesPercent}% chance YES</span>
          <span className="no-color">{noPercent}% chance NO</span>
        </div>

        {/* Info row */}
        <div className="market-info-row">
          <div className="market-info-item">
            <span className="info-label">YES Pool</span>
            <span className="info-value yes-color">{formatShares(market.totalYes)} USDC</span>
          </div>
          <div className="market-info-item">
            <span className="info-label">NO Pool</span>
            <span className="info-value no-color">{formatShares(market.totalNo)} USDC</span>
          </div>
          <div className="market-info-item">
            <span className="info-label">Protocol Fee</span>
            <span className="info-value">{(market.feeBps / 100).toFixed(2)}%</span>
          </div>
          <div className="market-info-item">
            <span className="info-label">{isExpired ? "Ended" : "Ends"}</span>
            <span className="info-value">
              {isExpired ? endDate.toLocaleDateString() : `${daysLeft}d left`}
            </span>
          </div>
          <div className="market-info-item">
            <span className="info-label">Creator</span>
            <span className="info-value" style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
              {market.authority.slice(0, 6)}…{market.authority.slice(-4)}
            </span>
          </div>
        </div>
      </div>

      {/* Global error */}
      {error && <div className="error-banner" style={{ marginBottom: 20 }}>{error}</div>}

      {/* Two-column panels */}
      <div className="market-panels">
        {/* Left column */}
        <div className="market-panels-left">
          {/* Your Balances */}
          {connected && (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Your Position</span>
                <span className="panel-subtitle">{usdcBalance} USDC available</span>
              </div>
              <div className="panel-body">
                <div className="position-stats">
                  <div className="position-stat position-stat-yes">
                    <span className="position-stat-label">YES Shares</span>
                    <span className="position-stat-value">{yesBalance}</span>
                  </div>
                  <div className="position-stat position-stat-no">
                    <span className="position-stat-label">NO Shares</span>
                    <span className="position-stat-value">{noBalance}</span>
                  </div>
                </div>

                {/* Settlement */}
                {(market.outcome === "Yes" || market.outcome === "No" || market.outcome === "Cancelled") && (
                  <div className="settlement-action">
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                      {market.outcome === "Cancelled"
                        ? "This market was cancelled. Claim your refund below."
                        : `Market resolved ${market.outcome.toUpperCase()}. Claim your winnings below.`}
                    </p>
                    <button className="btn-primary" style={{ width: "100%" }} onClick={handleClaim} disabled={actionLoading}>
                      {actionLoading ? "Processing…" : "Claim Winnings / Refund"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin panel */}
          {isAuthority && market.outcome === "Unresolved" && (
            <div className="panel admin-panel">
              <div className="panel-header">
                <span className="panel-title">Admin Controls</span>
                <span className="panel-subtitle">Market creator</span>
              </div>
              <div className="panel-body admin-panel">
                <p className="admin-desc">
                  You are the creator of this market. Resolve it once the outcome is known.
                </p>

                <div className="admin-actions">
                  <button className="btn-resolve-yes" onClick={() => handleResolve("Yes")} disabled={actionLoading}>
                    ✓ Resolve YES
                  </button>
                  <button className="btn-resolve-no" onClick={() => handleResolve("No")} disabled={actionLoading}>
                    ✗ Resolve NO
                  </button>
                  <button className="btn-secondary" onClick={handleCancel} disabled={actionLoading}>
                    Cancel Market
                  </button>
                </div>

                {/* Liquidity */}
                <div className="liquidity-section">
                  <span className="liquidity-title">Manage AMM Liquidity</span>
                  <span className="liquidity-desc">Supply USDC so users can start trading!</span>
                  <div className="liquidity-inputs">
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
                    <button className="btn-primary" onClick={handleAddLiquidity} disabled={actionLoading}>
                      Add
                    </button>
                    <button className="btn-secondary" onClick={handleRemoveLiquidity} disabled={actionLoading}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column — Trade panel */}
        {isActive && (
          <div className="trade-panel">
            <div className="panel-header">
              <span className="panel-title">Trade</span>
              {connected && (
                <span className="panel-subtitle">{usdcBalance} USDC</span>
              )}
            </div>

            {/* Buy / Sell tabs */}
            <div className="trade-tabs">
              <button
                className={`trade-tab${tradeMode === "Buy"  ? " trade-tab-active-buy"  : ""}`}
                onClick={() => setTradeMode("Buy")}
              >
                Buy
              </button>
              <button
                className={`trade-tab${tradeMode === "Sell" ? " trade-tab-active-sell" : ""}`}
                onClick={() => setTradeMode("Sell")}
              >
                Sell
              </button>
            </div>

            <form className="trade-body" onSubmit={handleTrade}>
              {/* YES / NO selector */}
              <div className="side-selector">
                <button
                  type="button"
                  className={`side-btn side-btn-yes${side === "Yes" ? " active-yes" : ""}`}
                  onClick={() => setSide("Yes")}
                >
                  <span className="side-btn-label">YES</span>
                  <span className="side-btn-price">{yesPercent}%</span>
                  <span className="side-btn-chance">${yesPrice} / share</span>
                </button>
                <button
                  type="button"
                  className={`side-btn side-btn-no${side === "No" ? " active-no" : ""}`}
                  onClick={() => setSide("No")}
                >
                  <span className="side-btn-label">NO</span>
                  <span className="side-btn-price">{noPercent}%</span>
                  <span className="side-btn-chance">${noPrice} / share</span>
                </button>
              </div>

              {/* Amount */}
              <div className="amount-section">
                <div className="amount-label">
                  <span className="form-label">
                    {tradeMode === "Buy" ? "Amount (USDC)" : "Shares to liquidate"}
                  </span>
                  {connected && (
                    <span className="amount-balance">
                      Balance:{" "}
                      <strong>
                        {tradeMode === "Buy"
                          ? `${usdcBalance} USDC`
                          : `${side === "Yes" ? yesBalance : noBalance} shares`}
                      </strong>
                    </span>
                  )}
                </div>
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
                  <span className="amount-suffix">
                    {tradeMode === "Buy" ? "USDC" : "SHRS"}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="trade-summary">
                <div className="summary-row">
                  <span className="summary-label">Action</span>
                  <span className="summary-value">
                    {tradeMode}{" "}
                    <span className={side === "Yes" ? "yes-color" : "no-color"}>{side}</span>
                  </span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Protocol Fee</span>
                  <span className="summary-value">{(market.feeBps / 100).toFixed(2)}%</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Current Price</span>
                  <span className="summary-value">
                    ${side === "Yes" ? yesPrice : noPrice} / share
                  </span>
                </div>
              </div>

              {tradeError && <div className="form-error" style={{ marginBottom: 16 }}>{tradeError}</div>}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", padding: "14px" }}
                disabled={tradeLoading || !connected}
              >
                {!connected
                  ? "Connect Wallet"
                  : tradeLoading
                  ? "Processing…"
                  : `${tradeMode} ${side}`}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
