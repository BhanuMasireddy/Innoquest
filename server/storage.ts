import { 
  profiles, 
  participants, 
  scanLogs,
  type Profile, 
  type InsertProfile, 
  type Participant, 
  type InsertParticipant,
  type ScanLog,
  type InsertScanLog,
  type ScanLogWithParticipant
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as crypto from "crypto";

export interface IStorage {
  // Profiles
  getProfile(userId: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  getOrCreateProfile(userId: string, email: string): Promise<Profile>;

  // Participants
  getParticipants(): Promise<Participant[]>;
  getParticipantById(id: string): Promise<Participant | undefined>;
  getParticipantByQrHash(qrHash: string): Promise<Participant | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipantCheckIn(id: string, isCheckedIn: boolean): Promise<Participant | undefined>;

  // Scan Logs
  getScanLogs(): Promise<ScanLog[]>;
  getRecentScansWithParticipants(limit?: number): Promise<ScanLogWithParticipant[]>;
  createScanLog(scanLog: InsertScanLog): Promise<ScanLog>;

  // Stats
  getStats(): Promise<{ total: number; checkedIn: number; percentage: number }>;

  // Seed data
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Profiles
  async getProfile(userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    return profile;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await db.insert(profiles).values(profile).returning();
    return newProfile;
  }

  async getOrCreateProfile(userId: string, email: string): Promise<Profile> {
    let profile = await this.getProfile(userId);
    if (!profile) {
      profile = await this.createProfile({
        userId,
        email,
        role: "admin", // First user becomes admin
      });
    }
    return profile;
  }

  // Participants
  async getParticipants(): Promise<Participant[]> {
    return await db.select().from(participants).orderBy(desc(participants.createdAt));
  }

  async getParticipantById(id: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id));
    return participant;
  }

  async getParticipantByQrHash(qrHash: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.qrCodeHash, qrHash));
    return participant;
  }

  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const [newParticipant] = await db.insert(participants).values(participant).returning();
    return newParticipant;
  }

  async updateParticipantCheckIn(id: string, isCheckedIn: boolean): Promise<Participant | undefined> {
    const [updated] = await db
      .update(participants)
      .set({ isCheckedIn })
      .where(eq(participants.id, id))
      .returning();
    return updated;
  }

  // Scan Logs
  async getScanLogs(): Promise<ScanLog[]> {
    return await db.select().from(scanLogs).orderBy(desc(scanLogs.timestamp));
  }

  async getRecentScansWithParticipants(limit: number = 10): Promise<ScanLogWithParticipant[]> {
    const logs = await db
      .select()
      .from(scanLogs)
      .leftJoin(participants, eq(scanLogs.participantId, participants.id))
      .orderBy(desc(scanLogs.timestamp))
      .limit(limit);

    return logs.map((row) => ({
      ...row.scan_logs,
      participant: row.participants!,
    }));
  }

  async createScanLog(scanLog: InsertScanLog): Promise<ScanLog> {
    const [newLog] = await db.insert(scanLogs).values(scanLog).returning();
    return newLog;
  }

  // Stats
  async getStats(): Promise<{ total: number; checkedIn: number; percentage: number }> {
    const allParticipants = await db.select().from(participants);
    const total = allParticipants.length;
    const checkedIn = allParticipants.filter((p) => p.isCheckedIn).length;
    const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return { total, checkedIn, percentage };
  }

  // Seed data with sample participants
  async seedData(): Promise<void> {
    const existingParticipants = await this.getParticipants();
    if (existingParticipants.length > 0) {
      return; // Already seeded
    }

    const sampleParticipants = [
      { name: "Alex Chen", email: "alex.chen@email.com", teamName: "Team Quantum" },
      { name: "Sarah Johnson", email: "sarah.j@email.com", teamName: "Code Warriors" },
      { name: "Marcus Lee", email: "marcus.lee@email.com", teamName: "Team Quantum" },
      { name: "Emily Davis", email: "emily.d@email.com", teamName: "Binary Blasters" },
      { name: "James Wilson", email: "james.w@email.com", teamName: "Code Warriors" },
      { name: "Priya Patel", email: "priya.p@email.com", teamName: "Hack Masters" },
      { name: "Ryan Thompson", email: "ryan.t@email.com", teamName: "Binary Blasters" },
      { name: "Lisa Wang", email: "lisa.w@email.com", teamName: "Hack Masters" },
      { name: "David Kim", email: "david.k@email.com", teamName: "Team Quantum" },
      { name: "Jessica Brown", email: "jessica.b@email.com", teamName: "Neural Network" },
      { name: "Chris Anderson", email: "chris.a@email.com", teamName: "Neural Network" },
      { name: "Mia Garcia", email: "mia.g@email.com", teamName: "Byte Brigade" },
    ];

    for (const p of sampleParticipants) {
      const qrHash = crypto.createHash("sha256").update(`${p.email}-${Date.now()}-${Math.random()}`).digest("hex");
      await this.createParticipant({
        name: p.name,
        email: p.email,
        teamName: p.teamName,
        qrCodeHash: qrHash,
      });
    }

    console.log("Seeded database with sample participants");
  }
}

export const storage = new DatabaseStorage();
