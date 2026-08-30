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
  yesReserve?: string;
  noReserve?: string;
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

export interface AmmAccount {
  publicKey: string;
  market: string;
  yesReserve: string;
  noReserve: string;
  lpSupply: string;
  feeBps: number;
}
