import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "./components/Navbar";

export const metadata: Metadata = {
  title: "PredictSol — Prediction Markets on Solana",
  description:
    "Decentralized prediction markets on Solana. Trade YES/NO outcome shares with on-chain transparency.",
  keywords: ["prediction market", "solana", "defi", "trading"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <div className="app">
            <Navbar />
            <main className="main-content">{children}</main>
            <footer className="footer">
              <div className="footer-l">
                <span className="footer-brand">PredictSol</span>
                <span className="footer-txt">Solana Devnet · Anchor Protocol</span>
              </div>
              <div className="footer-r">
                <a href="https://solana.com" target="_blank" rel="noreferrer" className="footer-lnk">Solana</a>
                <a href="https://anchor-lang.com" target="_blank" rel="noreferrer" className="footer-lnk">Anchor</a>
                <span className="footer-lnk">Docs</span>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
