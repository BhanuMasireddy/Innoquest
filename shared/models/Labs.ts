import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const labs = pgTable("labs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});