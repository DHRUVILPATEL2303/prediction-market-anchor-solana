"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Navbar() {
  const { publicKey } = useWallet();
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const navLinks = [
    { href: "/",          label: "Markets" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/activity",  label: "Activity" },
  ];

  return (
    <nav className="nav">
      <div className="nav-inner">
        {/* Left */}
        <div className="nav-left">
          <Link href="/" className="nav-logo">
            <span className="nav-logo-mark">PS</span>
            <span className="nav-logo-name">PredictSol</span>
          </Link>

          <div className="nav-links">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link${pathname === l.href ? " nav-link-active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
            <a href="#" className="nav-link">Docs</a>
          </div>
        </div>

        {/* Right */}
        <div className="nav-right">
          <div className="nav-search">
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

          <div className="nav-badge">
            <span className="nav-badge-dot" />
            Devnet
          </div>

          {publicKey && (
            <span className="nav-addr">
              {publicKey.toString().slice(0, 4)}…{publicKey.toString().slice(-4)}
            </span>
          )}

          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}
