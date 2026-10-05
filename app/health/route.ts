export const dynamic = "force-dynamic";

/** Endpoint public cho uptime monitor — cùng mục đích với /health của client-mim-trading. */
export function GET() {
  return Response.json({ status: "ok" });
}
