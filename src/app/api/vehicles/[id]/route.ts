import { z } from "zod";
import { getClientId } from "@/lib/db/client-id";
import { setMileage, setNickname } from "@/lib/db/garage";

// Per-visitor data, and writes. Never a cacheable render.
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  mileage: z.number().int().positive().max(2_000_000).optional(),
  nickname: z.string().max(60).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "That update is not valid." }, { status: 400 });
  }

  try {
    const clientId = await getClientId();
    if (parsed.data.mileage != null) await setMileage(clientId, id, parsed.data.mileage);
    if (parsed.data.nickname !== undefined) await setNickname(clientId, id, parsed.data.nickname);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Failed to update vehicle:", error);
    return Response.json({ error: "Could not save that change." }, { status: 500 });
  }
}
