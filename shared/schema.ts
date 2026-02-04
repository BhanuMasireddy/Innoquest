import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// Profiles table - extends users with role
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().unique(),
  email: text("email").notNull(),
  role: text("role").notNull().default("volunteer"),
});

export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true });
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

// Participants table
export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  teamName: text("team_name").notNull(),
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
  participant: Participant;
};
