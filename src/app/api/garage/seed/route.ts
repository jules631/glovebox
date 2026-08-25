import { getClientId } from "@/lib/db/client-id";
import { loadGarage, saveDemoReceipt } from "@/lib/db/garage";
import { seedReceipts } from "@/lib/seed";

// Per-visitor data, and writes. Never a cacheable render.
export const dynamic = "force-dynamic";

// The demo garage is opt in.
//
// The previous version wrote fixture cars into storage for anyone who arrived
// empty handed, which meant a real first-time user saw somebody else's Mazda
// instead of their own empty garage. That hides the hardest problem this
// product has rather than solving it. Now the empty state is the real empty
// state, and loading the demo is a button someone presses on purpose.
export async function POST() {
  try {
    const clientId = await getClientId();
    const existing = await loadGarage(clientId);
    if (existing.vehicles.length) {
      return Response.json({ error: "This garage already has vehicles in it." }, { status: 409 });
    }

    for (const receipt of seedReceipts()) {
      await saveDemoReceipt(clientId, receipt);
    }

    return Response.json(await loadGarage(clientId));
  } catch (error) {
    console.error("Failed to load the demo garage:", error);
    return Response.json({ error: "Could not load the demo garage." }, { status: 500 });
  }
}
