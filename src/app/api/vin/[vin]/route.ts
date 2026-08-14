import { decodeVin, isPlausibleVin, openRecalls } from "@/lib/vin";

export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ vin: string }> }) {
  const { vin } = await params;

  if (!isPlausibleVin(vin)) {
    return Response.json({ error: "That does not look like a 17 character VIN." }, { status: 400 });
  }

  try {
    const decode = await decodeVin(vin);

    // Recalls need make, model, and year, so a VIN that will not decode cannot
    // reach them. Return the decode anyway rather than failing the whole call.
    let recalls: Awaited<ReturnType<typeof openRecalls>> = [];
    let recallsAvailable = false;
    if (decode.make && decode.model && decode.year) {
      try {
        recalls = await openRecalls(decode.make, decode.model, decode.year);
        recallsAvailable = true;
      } catch (error) {
        console.error("Recall lookup failed:", error);
      }
    }

    return Response.json({ decode, recalls, recallsAvailable });
  } catch (error) {
    console.error("VIN decode failed:", error);
    return Response.json({ error: "The NHTSA lookup is not responding right now." }, { status: 502 });
  }
}
