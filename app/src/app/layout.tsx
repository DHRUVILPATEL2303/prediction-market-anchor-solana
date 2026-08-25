import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <div className="app">
            <Navbar />
            <main className="main-content">{children}</main>
            <footer className="footer">
              <p>PredictSol · Built on Solana Devnet · Powered by Anchor</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
