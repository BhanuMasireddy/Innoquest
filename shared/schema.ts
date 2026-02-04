import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// Teams table
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teams).omit({ 
  id: true, 
  createdAt: true 
});
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teams.$inferSelect;

// Participants table - linked to teams
export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  teamId: uuid("team_id").notNull().references(() => teams.id),
  isCheckedIn: boolean("is_checked_in").notNull().default(false),
  qrCodeHash: text("qr_code_hash").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertParticipantSchema = createInsertSchema(participants).omit({ 
  id: true, 
  isCheckedIn: true, 
  createdAt: true 
});
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participants.$inferSelect;

// Extended participant with team info
export type ParticipantWithTeam = Participant & {
  team: Team;
};

// Scan logs table
export const scanLogs = pgTable("scan_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  participantId: uuid("participant_id").notNull().references(() => participants.id),
  scannedBy: varchar("scanned_by").notNull(),
  scanType: text("scan_type").notNull().default("ENTRY"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertScanLogSchema = createInsertSchema(scanLogs).omit({ 
  id: true, 
  timestamp: true 
});
export type InsertScanLog = z.infer<typeof insertScanLogSchema>;
export type ScanLog = typeof scanLogs.$inferSelect;

// Extended scan log with participant info
export type ScanLogWithParticipant = ScanLog & {
  participant: ParticipantWithTeam;
};
