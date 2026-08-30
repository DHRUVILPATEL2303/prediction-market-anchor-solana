import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "./components/Navbar";

export const metadata: Metadata = {
  title: "PredictSol — Solana Prediction Markets",
  description:
    "Decentralized prediction markets powered by Solana and Anchor. Bet on real-world outcomes with full on-chain transparency.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <div className="app">
            <Navbar />
            <main className="main-content">{children}</main>
            <footer className="footer">
              <div className="footer-left">
                <div className="footer-logo" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 17.5 9.5 13l3 2.5L19 8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M15.5 8H19v3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="footer-name">PredictSol</span>
                <div className="footer-sep" />
                <span className="footer-text">Built on Solana Devnet · Powered by Anchor</span>
              </div>
              <div className="footer-right">
                <a href="https://solana.com" target="_blank" rel="noreferrer" className="footer-link">Solana</a>
                <a href="https://anchor-lang.com" target="_blank" rel="noreferrer" className="footer-link">Anchor</a>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
