import { getClientId } from "@/lib/db/client-id";
import { loadGarage } from "@/lib/db/garage";

// Per-visitor data, and writes. Never a cacheable render.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clientId = await getClientId();
    return Response.json(await loadGarage(clientId));
  } catch (error) {
    console.error("Failed to load garage:", error);
    return Response.json({ error: "Could not load your garage." }, { status: 500 });
  }
}
