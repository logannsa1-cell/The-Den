import { createInsertSchema } from "drizzle-zod";
import { boolean, date, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const studyHabitPreferencesTable = pgTable("study_habit_preferences", {
  userId: text("user_id").primaryKey(),
  timeZone: text("time_zone").notNull().default("UTC"),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderTime: text("reminder_time"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertStudyHabitPreferencesSchema = createInsertSchema(studyHabitPreferencesTable).omit({
  updatedAt: true,
});
export type InsertStudyHabitPreferences = z.infer<typeof insertStudyHabitPreferencesSchema>;
export type StudyHabitPreferences = typeof studyHabitPreferencesTable.$inferSelect;

export const studyActivityDaysTable = pgTable(
  "study_activity_days",
  {
    userId: text("user_id").notNull(),
    activityDate: date("activity_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.activityDate], name: "study_activity_days_user_date_pk" }),
  ],
);

export const insertStudyActivityDaySchema = createInsertSchema(studyActivityDaysTable).omit({
  createdAt: true,
});
export type InsertStudyActivityDay = z.infer<typeof insertStudyActivityDaySchema>;
export type StudyActivityDay = typeof studyActivityDaysTable.$inferSelect;
