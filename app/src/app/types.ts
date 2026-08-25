export interface MarketAccount {
  publicKey: string;
  marketId: string;
  question: string;
  authority: string;
  endTime: number;
  feeBps: number;
  totalYes: string;
  totalNo: string;
  treasury: string;
  outcome: "Unresolved" | "Yes" | "No";
  paymentMint: string;
}

export interface PositionAccount {
  publicKey: string;
  owner: string;
  market: string;
  yesShares: string;
  noShares: string;
  claimed: boolean;
}
