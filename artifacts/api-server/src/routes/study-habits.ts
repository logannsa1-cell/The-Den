import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetStudyHabitStateResponse,
  RecordStudyActivityBody,
  RecordStudyActivityResponse,
  UpdateStudyHabitPreferencesBody,
  UpdateStudyHabitPreferencesResponse,
} from "@workspace/api-zod";
import {
  db,
  studyActivityDaysTable,
  studyHabitPreferencesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isValidTimeZone, localDateKey, summarizeStudyDays } from "../lib/study-habits";

const router: IRouter = Router();

async function getState(userId: string) {
  const [preferences] = await db
    .select()
    .from(studyHabitPreferencesTable)
    .where(eq(studyHabitPreferencesTable.userId, userId))
    .limit(1);
  const rows = await db
    .select({ activityDate: studyActivityDaysTable.activityDate })
    .from(studyActivityDaysTable)
    .where(eq(studyActivityDaysTable.userId, userId))
    .orderBy(desc(studyActivityDaysTable.activityDate));
  const timeZone = preferences?.timeZone ?? "UTC";

  return {
    ...summarizeStudyDays(
      rows.map((row) => row.activityDate),
      localDateKey(new Date(), timeZone),
    ),
    reminderEnabled: preferences?.reminderEnabled ?? false,
    reminderTime: preferences?.reminderTime ?? null,
    timeZone,
  };
}

router.get("/study-habits", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  res.json(GetStudyHabitStateResponse.parse(await getState(userId)));
});

router.put("/study-habits", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateStudyHabitPreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { reminderEnabled, reminderTime, timeZone } = parsed.data;
  if (!isValidTimeZone(timeZone)) {
    res.status(400).json({ error: "Choose a valid time zone." });
    return;
  }
  if (reminderEnabled && !reminderTime) {
    res.status(400).json({ error: "Choose a reminder time before enabling reminders." });
    return;
  }

  const userId = res.locals.userId as string;
  await db
    .insert(studyHabitPreferencesTable)
    .values({ userId, reminderEnabled, reminderTime, timeZone })
    .onConflictDoUpdate({
      target: studyHabitPreferencesTable.userId,
      set: { reminderEnabled, reminderTime, timeZone, updatedAt: new Date() },
    });

  res.json(
    UpdateStudyHabitPreferencesResponse.parse(await getState(userId)),
  );
});

router.post(
  "/study-habits/activity",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = RecordStudyActivityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { timeZone } = parsed.data;
    if (!isValidTimeZone(timeZone)) {
      res.status(400).json({ error: "Choose a valid time zone." });
      return;
    }

    const userId = res.locals.userId as string;
    const [preferences] = await db
      .select({ timeZone: studyHabitPreferencesTable.timeZone })
      .from(studyHabitPreferencesTable)
      .where(eq(studyHabitPreferencesTable.userId, userId))
      .limit(1);
    const activityTimeZone = preferences?.timeZone ?? timeZone;
    if (!preferences) {
      await db
        .insert(studyHabitPreferencesTable)
        .values({ userId, timeZone: activityTimeZone })
        .onConflictDoNothing();
    }
    const activityDate = localDateKey(new Date(), activityTimeZone);
    await db
      .insert(studyActivityDaysTable)
      .values({ userId, activityDate })
      .onConflictDoNothing();

    res.json(
      RecordStudyActivityResponse.parse(await getState(userId)),
    );
  },
);

export default router;
