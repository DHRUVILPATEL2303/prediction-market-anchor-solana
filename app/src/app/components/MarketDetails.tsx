"use client";

import { useEffect, useState, useCallback } from "react";
import { useProgram, useMarketActions, fetchMarket, fetchAmm, PROGRAM_ID } from "../lib/program";
import { MarketAccount, AmmAccount } from "../types";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

/* ── Helpers ──────────────────────────────────────────────────── */
function fmtUSDC(raw: string): string {
  const n = BigInt(raw);
  if (n === 0n) return "$0.00";
  const whole = n / 1_000_000n;
  const frac  = n % 1_000_000n;
  if (whole >= 1_000_000n) return `$${(Number(whole) / 1_000_000).toFixed(2)}M`;
  if (whole >= 1_000n)     return `$${(Number(whole) / 1_000).toFixed(1)}K`;
  return `$${whole}.${frac.toString().padStart(6, "0").slice(0, 2)}`;
}

function fmtShares(raw: string): string {
  const n = BigInt(raw);
  if (n === 0n) return "0.00";
  const whole = n / 1_000_000n;
  const frac  = n % 1_000_000n;
  return `${whole}.${frac.toString().padStart(6, "0").slice(0, 2)}`;
}

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
  return Math.floor((-b + Math.sqrt(discriminant)) / (2 * a));
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

/* ── Component ────────────────────────────────────────────────── */
export function MarketDetails({ marketId }: { marketId: string }) {
  const { program } = useProgram();
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const {
    resolveMarket, cancelMarket, claimWinnings,
    buyShares, sellShares, addLiquidity, removeLiquidity,
  } = useMarketActions();

  const [market, setMarket] = useState<MarketAccount | null>(null);
  const [amm,    setAmm]    = useState<AmmAccount | null>(null);

  const [usdcBalance, setUsdcBalance] = useState("0");
  const [yesBalance,  setYesBalance]  = useState("0");
  const [noBalance,   setNoBalance]   = useState("0");

  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error,         setError]         = useState("");

  const [tradeMode,    setTradeMode]    = useState<"Buy" | "Sell">("Buy");
  const [side,         setSide]         = useState<"Yes" | "No">("Yes");
  const [amount,       setAmount]       = useState("");
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError,   setTradeError]   = useState("");

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
          [Buffer.from("yes-mint"), marketPubkey.toBuffer()], PROGRAM_ID
        );
        const [noMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("no-mint"), marketPubkey.toBuffer()], PROGRAM_ID
        );
        try {
          const ata  = await getAssociatedTokenAddress(paymentMint, publicKey);
          const info = await connection.getTokenAccountBalance(ata);
          setUsdcBalance(info.value.uiAmountString || "0");
        } catch { setUsdcBalance("0"); }
        try {
          const ata  = await getAssociatedTokenAddress(yesMint, publicKey);
          const info = await connection.getTokenAccountBalance(ata);
          setYesBalance(info.value.uiAmountString || "0");
        } catch { setYesBalance("0"); }
        try {
          const ata  = await getAssociatedTokenAddress(noMint, publicKey);
          const info = await connection.getTokenAccountBalance(ata);
          setNoBalance(info.value.uiAmountString || "0");
        } catch { setNoBalance("0"); }
      }
    } catch { setError("Failed to load market"); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId, connected, publicKey]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Handlers ─────────────────────────────────────────── */
  const handleResolve = async (outcome: "Yes" | "No" | "Cancelled") => {
    setActionLoading(true);
    try { await resolveMarket(marketId, outcome); await loadData(); }
    catch (e: any) { setError(e.message || String(e)); }
    finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try { await cancelMarket(marketId); await loadData(); }
    catch (e: any) { setError(e.message || String(e)); }
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
    } catch (e: any) { setError(e.message || String(e)); }
    finally { setActionLoading(false); }
  };

  const handleAddLiquidity = async () => {
    if (!market || !publicKey) return;
    const n = parseFloat(liquidityAmount);
    if (!n || n < 1) return setError("Minimum 1 USDC");
    setActionLoading(true);
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      await addLiquidity(marketId, Math.floor(n * 1_000_000), market.paymentMint, ata.toString());
      setLiquidityAmount(""); await loadData();
    } catch (e: any) { setError(e.message || String(e)); }
    finally { setActionLoading(false); }
  };

  const handleRemoveLiquidity = async () => {
    if (!market || !publicKey) return;
    const n = parseFloat(liquidityAmount);
    if (!n || n <= 0) return setError("Invalid amount");
    setActionLoading(true);
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata = await getAssociatedTokenAddress(mintPubkey, publicKey);
      await removeLiquidity(marketId, Math.floor(n * 1_000_000), ata.toString());
      setLiquidityAmount(""); await loadData();
    } catch (e: any) { setError(e.message || String(e)); }
    finally { setActionLoading(false); }
  };

  async function handleTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !publicKey) return setTradeError("Connect your wallet first");
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return setTradeError("Enter a valid amount");
    if (!market) return;

    setTradeLoading(true);
    setTradeError("");
    try {
      const mintPubkey = new PublicKey(market.paymentMint);
      const ata        = await getAssociatedTokenAddress(mintPubkey, publicKey);

      const ataInfo = await connection.getAccountInfo(ata);
      if (!ataInfo && tradeMode === "Buy") {
        setTradeError("No USDC token account found. Get USDC on devnet first.");
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
        if (swapAmount <= 0 || redeemAmount <= 0) throw new Error("Amount too small or insufficient liquidity");
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

  /* ── Loading / error states ────────────────────────── */
  if (loading) {
    return (
      <div className="detail-pg">
        <div className="skel-item" style={{ height: 20, width: 100, border: "none", marginBottom: 24 }} />
        
        <div className="detail-hd">
          <div className="detail-hd-top">
            <div className="skel-item" style={{ height: 40, width: "70%", border: "none", margin: 0 }} />
          </div>
          <div className="detail-meta-row" style={{ marginTop: 20, gap: 24 }}>
            <div className="skel-item" style={{ height: 24, width: 100, border: "none", margin: 0 }} />
            <div className="skel-item" style={{ height: 24, width: 140, border: "none", margin: 0 }} />
            <div className="skel-item" style={{ height: 24, width: 80, border: "none", margin: 0 }} />
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-left" style={{ gap: 24 }}>
            <div className="skel-item" style={{ height: 240, margin: 0 }} />
            <div className="skel-item" style={{ height: 180, margin: 0 }} />
          </div>
          <div className="tp" style={{ padding: 0, overflow: "hidden", background: "transparent", border: "none" }}>
            <div className="skel-item" style={{ height: 480, margin: 0 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="detail-pg">
        <div className="err-bar">Market not found.</div>
      </div>
    );
  }

  /* ── Derived values ─────────────────────────────────── */
  const isExpired   = Date.now() / 1000 > market.endTime;
  const isAuthority = publicKey?.toString() === market.authority;
  const isActive    = market.outcome === "Unresolved" && !isExpired;
  const isSettled   = market.outcome === "Yes" || market.outcome === "No" || market.outcome === "Cancelled";

  const yesRes  = amm ? BigInt(amm.yesReserve) : 0n;
  const noRes   = amm ? BigInt(amm.noReserve)  : 0n;
  const totalRes = yesRes + noRes;

  // Price of YES = noReserve / totalRes (CPMM)
  const yesPct  = totalRes === 0n ? 50 : Number((noRes * 100n) / totalRes);
  const noPct   = 100 - yesPct;
  const yesPrice = (yesPct / 100).toFixed(2);
  const noPrice  = (noPct  / 100).toFixed(2);

  const daysLeft = Math.max(0, Math.floor((market.endTime * 1000 - Date.now()) / 86_400_000));
  const endDateStr = new Date(market.endTime * 1000).toLocaleDateString("en", {
    year: "numeric", month: "short", day: "numeric",
  });
  const category = detectCategory(market.question);

  let statusCls = "s-active"; let statusLabel = "Active";
  if (market.outcome === "Yes")        { statusCls = "s-yes"; statusLabel = "Resolved YES"; }
  else if (market.outcome === "No")    { statusCls = "s-no";  statusLabel = "Resolved NO";  }
  else if (market.outcome === "Cancelled") { statusCls = "s-cancelled"; statusLabel = "Cancelled"; }

  // Estimated shares / payout for buy
  const amountNum   = parseFloat(amount) || 0;
  const rawAmt      = Math.floor(amountNum * 1_000_000);
  const price       = side === "Yes" ? yesPct / 100 : noPct / 100;
  const estShares   = price > 0 ? (amountNum / price).toFixed(2) : "0.00";
  const estPayout   = estShares;
  const priceImpact = amountNum > 0 && totalRes > 0n
    ? ((amountNum * 1_000_000 / Number(totalRes)) * 100).toFixed(2)
    : "0.00";

  const submitDisabled = tradeLoading || !connected || !amount || parseFloat(amount) <= 0;

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="detail-pg">
      {/* Back */}
      <Link href="/" className="detail-back">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All Markets
      </Link>

      {/* Header */}
      <div className="detail-hd">
        <div className="detail-hd-top">
          <h1 className="detail-q">{market.question}</h1>
          <span className={`s-badge ${statusCls}`}>{statusLabel}</span>
        </div>

        <div className="detail-meta-row">
          <div className="detail-meta-item">
            <span className="detail-meta-lbl">Category</span>
            <span className="detail-meta-val">{category}</span>
          </div>
          <div className="detail-meta-item">
            <span className="detail-meta-lbl">{isExpired ? "Ended" : "Ends"}</span>
            <span className="detail-meta-val">
              {isExpired ? endDateStr : `${endDateStr} (${daysLeft}d)`}
            </span>
          </div>
          <div className="detail-meta-item">
            <span className="detail-meta-lbl">Fee</span>
            <span className="detail-meta-val">{(market.feeBps / 100).toFixed(2)}%</span>
          </div>
          <div className="detail-meta-item">
            <span className="detail-meta-lbl">Creator</span>
            <span className="detail-meta-val" style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
              {market.authority.slice(0, 4)}…{market.authority.slice(-4)}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="err-bar" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Body */}
      <div className="detail-body">
        {/* Left column */}
        <div className="detail-left">
          {/* Probability */}
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-hd-title">Current Probability</span>
              <span className="panel-hd-sub">Based on AMM reserves</span>
            </div>
            <div className="panel-body">
              <div className="prob-row">
                <div className="prob-out">
                  <span className="prob-lbl prob-lbl-yes">YES</span>
                  <span className="prob-pct prob-pct-yes">{yesPct}%</span>
                  <span className="prob-price">${yesPrice} per share</span>
                </div>
                <div className="prob-divider" />
                <div className="prob-out">
                  <span className="prob-lbl prob-lbl-no">NO</span>
                  <span className="prob-pct prob-pct-no">{noPct}%</span>
                  <span className="prob-price">${noPrice} per share</span>
                </div>
              </div>

              <div className="prob-bar">
                <div className="prob-bar-fill" style={{ width: `${yesPct}%` }} />
              </div>
              <div className="prob-bar-lbls">
                <span style={{ color: "var(--yes-dk)", fontWeight: 700 }}>{yesPct}% YES</span>
                <span style={{ color: "var(--no-dk)",  fontWeight: 700 }}>{noPct}% NO</span>
              </div>
            </div>
          </div>

          {/* Pool stats */}
          <div className="panel">
            <div className="panel-hd">
              <span className="panel-hd-title">Market Stats</span>
            </div>
            <div className="pool-grid">
              <div className="pool-cell">
                <div className="pool-lbl">YES Pool</div>
                <div className="pool-val pool-val-yes">{fmtUSDC(market.totalYes)}</div>
              </div>
              <div className="pool-cell">
                <div className="pool-lbl">NO Pool</div>
                <div className="pool-val pool-val-no">{fmtUSDC(market.totalNo)}</div>
              </div>
              <div className="pool-cell">
                <div className="pool-lbl">Total Volume</div>
                <div className="pool-val">
                  {fmtUSDC((BigInt(market.totalYes) + BigInt(market.totalNo)).toString())}
                </div>
              </div>
              <div className="pool-cell">
                <div className="pool-lbl">Market ID</div>
                <div className="pool-val" style={{ fontSize: 13 }}>#{market.marketId}</div>
              </div>
            </div>
          </div>

          {/* AMM Reserves */}
          {amm && (
            <div className="panel">
              <div className="panel-hd">
                <span className="panel-hd-title">AMM Reserves</span>
                <span className="panel-hd-sub">Constant product market maker</span>
              </div>
              <div className="pool-grid">
                <div className="pool-cell">
                  <div className="pool-lbl">YES Reserve</div>
                  <div className="pool-val pool-val-yes">{fmtShares(amm.yesReserve)}</div>
                </div>
                <div className="pool-cell">
                  <div className="pool-lbl">NO Reserve</div>
                  <div className="pool-val pool-val-no">{fmtShares(amm.noReserve)}</div>
                </div>
                <div className="pool-cell">
                  <div className="pool-lbl">k (invariant)</div>
                  <div className="pool-val" style={{ fontSize: 11, letterSpacing: 0 }}>
                    {totalRes === 0n ? "—" : (Number(yesRes) * Number(noRes) / 1e12).toFixed(0)}
                  </div>
                </div>
                <div className="pool-cell">
                  <div className="pool-lbl">Fee</div>
                  <div className="pool-val">{(market.feeBps / 100).toFixed(2)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Your position */}
          {connected && (
            <div className="panel pos-panel">
              <div className="panel-hd">
                <span className="panel-hd-title">Your Position</span>
                <span className="panel-hd-sub">{usdcBalance} USDC available</span>
              </div>
              <div className="pos-row">
                <span className="pos-lbl">YES Shares</span>
                <span className="pos-val pos-val-yes">{yesBalance}</span>
              </div>
              <div className="pos-row">
                <span className="pos-lbl">NO Shares</span>
                <span className="pos-val pos-val-no">{noBalance}</span>
              </div>
              {isSettled && (
                <div className="pos-row">
                  <button className="btn-claim" onClick={handleClaim} disabled={actionLoading}>
                    {actionLoading ? "Processing…" : "Claim Winnings / Refund"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Admin */}
          {isAuthority && market.outcome === "Unresolved" && (
            <div className="panel">
              <div className="panel-hd">
                <span className="panel-hd-title">Admin Controls</span>
                <span className="panel-hd-sub">You created this market</span>
              </div>
              <div className="admin-body">
                <p className="admin-desc">
                  Resolve the market once the outcome is known. This action is irreversible.
                </p>
                <div className="admin-row">
                  <button className="btn-res-yes" onClick={() => handleResolve("Yes")} disabled={actionLoading}>
                    Resolve YES
                  </button>
                  <button className="btn-res-no" onClick={() => handleResolve("No")} disabled={actionLoading}>
                    Resolve NO
                  </button>
                  <button className="btn-cancel-mkt" onClick={handleCancel} disabled={actionLoading}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Liquidity Management (Public) */}
          {market.outcome === "Unresolved" && (
            <div className="panel">
              <div className="panel-hd">
                <span className="panel-hd-title">Liquidity Pool</span>
                <span className="panel-hd-sub">Provide liquidity to earn fees</span>
              </div>
              <div className="admin-body">
                <p className="admin-desc">
                  Anyone can provide USDC to the AMM pool.
                </p>
                <div className="liq-row">
                  <input
                    type="number"
                    className="liq-input"
                    placeholder="Amount (USDC / LP shares)"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    min="0"
                    step="any"
                  />
                  <button className="btn-sm btn-sm-p" onClick={handleAddLiquidity} disabled={actionLoading}>Add Liq.</button>
                  <button className="btn-sm btn-sm-s" onClick={handleRemoveLiquidity} disabled={actionLoading}>Remove</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column — Trading Panel */}
        {isActive && (
          <div className="tp">
            <div className="tp-hd">
              <span className="tp-hd-title">Trade</span>
              {connected && (
                <span className="tp-bal">{usdcBalance} USDC</span>
              )}
            </div>

            {/* Buy / Sell tabs */}
            <div className="tp-tabs">
              <button
                className={`tp-tab tp-tab-buy${tradeMode === "Buy" ? " tp-tab-buy-a" : ""}`}
                onClick={() => setTradeMode("Buy")}
              >
                Buy
              </button>
              <button
                className={`tp-tab tp-tab-sell${tradeMode === "Sell" ? " tp-tab-sell-a" : ""}`}
                onClick={() => setTradeMode("Sell")}
              >
                Sell
              </button>
            </div>

            <form className="tp-body" onSubmit={handleTrade}>
              {/* YES / NO outcome selector */}
              <div className="out-sel">
                <button
                  type="button"
                  className={`out-btn out-btn-yes${side === "Yes" ? " out-btn-yes-a" : ""}`}
                  onClick={() => setSide("Yes")}
                >
                  <span className="out-btn-side">YES</span>
                  <span className="out-btn-pct">{yesPct}%</span>
                  <span className="out-btn-price">${yesPrice} / share</span>
                </button>
                <button
                  type="button"
                  className={`out-btn out-btn-no${side === "No" ? " out-btn-no-a" : ""}`}
                  onClick={() => setSide("No")}
                >
                  <span className="out-btn-side">NO</span>
                  <span className="out-btn-pct">{noPct}%</span>
                  <span className="out-btn-price">${noPrice} / share</span>
                </button>
              </div>

              {/* Amount */}
              <div className="amt-wrap">
                <div className="amt-lbl-row">
                  <span className="fld-lbl">
                    {tradeMode === "Buy" ? "Amount" : "Shares to sell"}
                  </span>
                  {connected && (
                    <span className="fld-bal">
                      Bal:{" "}
                      <strong>
                        {tradeMode === "Buy"
                          ? `${usdcBalance} USDC`
                          : `${side === "Yes" ? yesBalance : noBalance} shares`}
                      </strong>
                    </span>
                  )}
                </div>
                <div className="amt-row">
                  <input
                    type="number"
                    className="amt-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="any"
                  />
                  <span className="amt-unit">
                    {tradeMode === "Buy" ? "USDC" : "SHRS"}
                  </span>
                </div>
              </div>

              {/* Order summary */}
              <div className="order-sum">
                <div className="ord-row">
                  <span className="ord-lbl">Outcome</span>
                  <span className="ord-val" style={{ color: side === "Yes" ? "var(--yes-dk)" : "var(--no-dk)" }}>
                    {tradeMode} {side}
                  </span>
                </div>
                {tradeMode === "Buy" && (
                  <>
                    <div className="ord-row">
                      <span className="ord-lbl">Est. shares</span>
                      <span className="ord-val">{amountNum > 0 ? estShares : "—"}</span>
                    </div>
                    <div className="ord-row">
                      <span className="ord-lbl">Max payout</span>
                      <span className="ord-val">{amountNum > 0 ? `$${estPayout}` : "—"}</span>
                    </div>
                    <div className="ord-row">
                      <span className="ord-lbl">Price impact</span>
                      <span className="ord-val">~{priceImpact}%</span>
                    </div>
                  </>
                )}
                <div className="ord-row">
                  <span className="ord-lbl">Protocol fee</span>
                  <span className="ord-val">{(market.feeBps / 100).toFixed(2)}%</span>
                </div>
              </div>

              {tradeError && <div className="tp-error">{tradeError}</div>}

              {connected ? (
                <button
                  type="submit"
                  className={tradeMode === "Buy" ? "btn-buy" : "btn-sell"}
                  disabled={submitDisabled}
                >
                  {tradeLoading
                    ? "Processing…"
                    : `${tradeMode} ${side} ${amountNum > 0 ? `— $${amountNum.toFixed(2)}` : ""}`}
                </button>
              ) : (
                <button type="button" className="btn-conn" disabled>
                  Connect wallet to trade
                </button>
              )}
            </form>
          </div>
        )}

        {/* Resolved / expired — no trading panel, show settlement panel */}
        {!isActive && connected && isSettled && (
          <div className="panel" style={{ alignSelf: "start" }}>
            <div className="panel-hd">
              <span className="panel-hd-title">Settlement</span>
            </div>
            <div style={{ padding: "14px" }}>
              <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 12, lineHeight: 1.5 }}>
                {market.outcome === "Cancelled"
                  ? "This market was cancelled. Claim a full refund of your shares."
                  : `Market resolved ${market.outcome.toUpperCase()}. Winning shares pay out $1.00 each.`}
              </p>
              <button className="btn-claim" onClick={handleClaim} disabled={actionLoading}>
                {actionLoading ? "Processing…" : "Claim Winnings / Refund"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
