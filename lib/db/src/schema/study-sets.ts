import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const studySetsTable = pgTable(
  "study_sets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("study_sets_user_created_idx").on(table.userId, table.createdAt),
  ],
);
