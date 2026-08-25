"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Navbar() {
  const { publicKey } = useWallet();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="brand-icon">⚡</div>
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
