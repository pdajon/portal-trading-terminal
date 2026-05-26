import { getHyperliquidMarketMetadataPayload } from "@/lib/markets/hyperliquid-market-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fresh = searchParams.get("fresh") === "1";
  const payload = await getHyperliquidMarketMetadataPayload({ fresh });

  if (payload.degraded) {
    console.warn(
      "[portal] Hyperliquid market metadata degraded to static fallback",
      payload.error,
    );
  }

  return Response.json(payload.metadata, {
    headers: {
      "X-Portal-Market-Metadata-Mode": payload.degraded ? "fallback" : "live",
      "X-Portal-Market-Metadata-Source": payload.source,
    },
  });
}
