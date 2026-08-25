"use client";

import "./globals.css";
import { WalletContextProvider } from "./components/WalletProvider";
import { Navbar } from "./components/Navbar";
import { MarketList } from "./components/MarketList";

export default function ClientApp() {
  return (
    <WalletContextProvider>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <MarketList />
        </main>
        <footer className="footer">
          <p>PredictSol · Built on Solana Devnet · Powered by Anchor</p>
        </footer>
      </div>
    </WalletContextProvider>
  );
}
