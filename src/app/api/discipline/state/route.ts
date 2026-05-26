import {
  readServerDisciplineState,
  syncServerDisciplineState,
  type ServerDisciplineSyncPayload,
} from "@/features/discipline/lib/discipline-server-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await readServerDisciplineState());
}

export async function PUT(request: Request) {
  let payload: ServerDisciplineSyncPayload;

  try {
    payload = (await request.json()) as ServerDisciplineSyncPayload;
  } catch {
    return Response.json({ error: "Invalid Discipline state payload." }, { status: 400 });
  }

  return Response.json(await syncServerDisciplineState(payload));
}
