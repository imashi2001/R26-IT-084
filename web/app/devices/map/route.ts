import { handleMapPins } from "@/lib/handlers/devices";
import { errorResponse, optionsResponse } from "@/lib/http";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function GET(request: Request) {
  try {
    return await handleMapPins(request);
  } catch (err) {
    return errorResponse(err, request);
  }
}
