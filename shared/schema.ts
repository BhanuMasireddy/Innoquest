import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

/* =======================
   Teams
======================= */
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false), // ✅ ADD
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

/* =======================
   Labs
======================= */
export const labs = pgTable("labs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false), // ✅ ADD
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLabSchema = createInsertSchema(labs).omit({
  id: true,
  createdAt: true,
});
export type InsertLab = z.infer<typeof insertLabSchema>;
export type Lab = typeof labs.$inferSelect;

/* =======================
   Participants
======================= */
export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  labId: uuid("lab_id").notNull().references(() => labs.id),
  isCheckedIn: boolean("is_checked_in").notNull().default(false),
  qrCodeHash: text("qr_code_hash").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  isCheckedIn: true,
  createdAt: true,
});
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participants.$inferSelect;

/* =======================
   Extended Types
======================= */
export type ParticipantWithTeamAndLab = Participant & {
  team: Team;
  lab: Lab;
};

export const mealTypes = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const;
export type MealType = (typeof mealTypes)[number];

export const systemModeConfig = pgTable("system_mode_config", {
  id: text("id").primaryKey().default("global"),
  mode: text("mode").notNull().default("ATTENDANCE"), // ATTENDANCE | MEAL
  selectedMealType: text("selected_meal_type"),
  allowedLabIds: text("allowed_lab_ids").array().notNull().default(sql`'{}'::text[]`),
  allowedScannerIds: text("allowed_scanner_ids").array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mealConsumptions = pgTable(
  "meal_consumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    mealType: text("meal_type").notNull(), // BREAKFAST | LUNCH | SNACKS | DINNER
    consumedAt: timestamp("consumed_at").defaultNow(),
  },
  (table) => ({
    participantMealUnique: uniqueIndex("meal_consumptions_participant_meal_unique").on(
      table.participantId,
      table.mealType
    ),
  })
);

export const insertMealConsumptionSchema = createInsertSchema(mealConsumptions).omit({
  id: true,
  consumedAt: true,
});
export type InsertMealConsumption = z.infer<typeof insertMealConsumptionSchema>;
export type MealConsumption = typeof mealConsumptions.$inferSelect;

export const updateSystemModeSchema = z.object({
  mode: z.enum(["ATTENDANCE", "MEAL"]),
  selectedMealType: z.enum(mealTypes).nullable().optional(),
  allowedLabIds: z.array(z.string()).optional(),
  allowedScannerIds: z.array(z.string()).optional(),
});
export type UpdateSystemModeInput = z.infer<typeof updateSystemModeSchema>;

/* =======================
   Scan Logs
======================= */
export const scanPreviewSchema = z.object({
  participantId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  teamName: z.string(),
  labName: z.string(),
  isCheckedIn: z.boolean(),
   qr_hash: z.string(),
});

export const scanLogs = pgTable("scan_logs", {
  id: uuid("id").defaultRandom().primaryKey(),

  participantId: uuid("participant_id")
    .references(() => participants.id, { onDelete: "cascade" }),

  scannedBy: text("scanned_by").notNull(),   // ✅ TEXT

  scanType: text("scan_type").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});


export const insertScanLogSchema = createInsertSchema(scanLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertScanLog = z.infer<typeof insertScanLogSchema>;
export type ScanLog = typeof scanLogs.$inferSelect;

export type ScanPreview = z.infer<typeof scanPreviewSchema>;
export type ScanLogWithParticipant = ScanLog & {
  participant: ParticipantWithTeamAndLab;
};
