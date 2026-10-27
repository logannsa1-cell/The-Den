import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  DeleteStudySetParams,
  ListStudySetsResponse,
  UpsertStudySetBody,
  UpsertStudySetParams,
  UpsertStudySetResponse,
} from "@workspace/api-zod";
import { db, studySetsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/study-sets", requireAuth, async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select()
    .from(studySetsTable)
    .where(eq(studySetsTable.userId, userId))
    .orderBy(desc(studySetsTable.createdAt));

  const sets = rows.map((row) => {
    const payload = UpsertStudySetBody.safeParse(row.payload);
    if (!payload.success) {
      req.log.error(
        { studySetId: row.id, issueCount: payload.error.issues.length },
        "Stored study set is invalid",
      );
      throw new Error("A saved study set could not be read.");
    }
    return {
      ...payload.data,
      id: row.id,
      createdAt: row.createdAt.toISOString(),
    };
  });

  res.json(ListStudySetsResponse.parse(sets));
});

router.put("/study-sets/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpsertStudySetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpsertStudySetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  // One atomic operation: simultaneous retries cannot race into duplicate IDs,
  // and a conflicting ID owned by another account is never overwritten.
  const [saved] = await db.insert(studySetsTable).values({
    id: params.data.id, userId, payload: parsed.data,
    createdAt: new Date(), updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: studySetsTable.id,
    set: { payload: parsed.data, updatedAt: new Date() },
    setWhere: eq(studySetsTable.userId, userId),
  }).returning({ createdAt: studySetsTable.createdAt });
  if (!saved) {
    res.status(409).json({ error: "That study set belongs to another account." });
    return;
  }

  res.json(
    UpsertStudySetResponse.parse({
      ...parsed.data,
      id: params.data.id,
      createdAt: saved.createdAt.toISOString(),
    }),
  );
});

router.delete(
  "/study-sets/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = DeleteStudySetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const [deleted] = await db
      .delete(studySetsTable)
      .where(
        and(
          eq(studySetsTable.id, params.data.id),
          eq(studySetsTable.userId, userId),
        ),
      )
      .returning({ id: studySetsTable.id });

    if (!deleted) {
      res.status(404).json({ error: "Study set not found." });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
