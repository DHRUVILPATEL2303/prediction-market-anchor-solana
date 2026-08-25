import { MarketDetails } from "../../components/MarketDetails";

// In Next.js 16 app router with Turbopack, params might need to be awaited in some setups, but typically standard props work.
export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MarketDetails marketId={id} />;
}
