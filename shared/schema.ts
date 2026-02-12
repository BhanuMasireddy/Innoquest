import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  uuid,
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