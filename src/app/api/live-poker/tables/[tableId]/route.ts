import { NextResponse } from "next/server";
import { closeLivePokerTable } from "@/lib/live-poker/apply-buy-in-request";
import {
  getAuthenticatedLivePokerUser,
  getLivePokerConvexSecret,
  livePokerConvex,
} from "@/lib/live-poker/server-auth";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tableId: string }> }
) {
  const user = await getAuthenticatedLivePokerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tableId: rawTableId } = await context.params;
  const tableId = rawTableId as Id<"livePokerTables">;
  const table = await livePokerConvex.query(api.live_poker.getLivePokerTable, {
    tableId,
  });
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }
  if (table.createdById !== user._id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const workerResult = await closeLivePokerTable(tableId, table);
  if (!("ok" in workerResult)) {
    return NextResponse.json(
      { error: workerResult.error },
      { status: workerResult.status }
    );
  }

  await livePokerConvex.action(api.live_poker.serverDeleteLivePokerTable, {
    secret: getLivePokerConvexSecret(),
    tableId,
    userId: user._id,
  });
  return NextResponse.json({ ok: true });
}
