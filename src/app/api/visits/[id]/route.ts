import { getClientId } from "@/lib/db/client-id";
import { removeVisit } from "@/lib/db/garage";

// Per-visitor data, and writes. Never a cacheable render.
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const clientId = await getClientId();
    // Soft delete: the row stays, so a removed record still leaves a trace that
    // it once existed. A history a seller can silently empty is worth nothing.
    await removeVisit(clientId, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to remove visit:", error);
    return Response.json({ error: "Could not remove that record." }, { status: 500 });
  }
}
