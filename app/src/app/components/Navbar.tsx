"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Navbar() {
  const { publicKey } = useWallet();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 17.5 9.5 13l3 2.5L19 8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M15.5 8H19v3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="brand-name">PredictSol</span>
        <span className="brand-badge">DEVNET</span>
      </div>
      <div className="navbar-right">
        {publicKey && (
          <div className="wallet-address">
            {publicKey.toString().slice(0, 4)}…{publicKey.toString().slice(-4)}
          </div>
        )}
        <WalletMultiButton className="wallet-btn" />
      </div>
    </nav>
  );
}
