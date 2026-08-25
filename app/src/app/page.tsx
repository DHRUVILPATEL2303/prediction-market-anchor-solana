import type { Metadata } from "next";
import AppWrapper from "./AppWrapper";

export const metadata: Metadata = {
  title: "PredictSol — Solana Prediction Markets",
  description:
    "Decentralized prediction markets powered by Solana and Anchor. Bet on real-world outcomes with full on-chain transparency.",
};

export default function Home() {
  // AppWrapper is a Client Component that does dynamic import with ssr:false
  return <AppWrapper />;
}
