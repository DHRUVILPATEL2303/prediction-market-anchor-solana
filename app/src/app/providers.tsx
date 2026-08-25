"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

const WalletContextProvider = dynamic(
  () => import("./components/WalletProvider").then((mod) => mod.WalletContextProvider),
  { ssr: false }
);

export function Providers({ children }: { children: ReactNode }) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
}
