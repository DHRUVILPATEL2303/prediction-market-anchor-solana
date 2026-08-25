"use client";

import dynamic from "next/dynamic";

// Anchor + wallet adapter code must only run client-side.
// This wrapper is a Client Component so ssr:false is allowed here.
const ClientApp = dynamic(() => import("./ClientApp"), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: "100vh",
      background: "#080b14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#4a6080",
      fontFamily: "Inter, sans-serif",
      fontSize: "14px",
    }}>
      Loading…
    </div>
  ),
});

export default function AppWrapper() {
  return <ClientApp />;
}
