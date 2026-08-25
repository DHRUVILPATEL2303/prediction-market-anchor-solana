export interface MarketAccount {
  publicKey: string;
  marketId: string;
  question: string;
  authority: string;
  endTime: number;
  feeBps: number;
  totalYes: string;
  totalNo: string;
  totalAmount: string; // new field in IDL
  treasury: string;
  outcome: "Unresolved" | "Yes" | "No" | "Cancelled";
  paymentMint: string;
}

export interface PositionAccount {
  publicKey: string;
  owner: string;
  market: string;
  yesShares: string;
  noShares: string;
  claimed: boolean;
  refunded: boolean; // new field in IDL
}
