import { getClientId } from "@/lib/db/client-id";
import { getOrCreateAliasToken } from "@/lib/db/garage";
import { displayAddress } from "@/lib/inbound/postmark";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clientId = await getClientId();
    const token = await getOrCreateAliasToken(clientId);
    return Response.json(displayAddress(token));
  } catch (error) {
    console.error("Failed to load service address:", error);
    return Response.json({ error: "Could not load your service email." }, { status: 500 });
  }
}
