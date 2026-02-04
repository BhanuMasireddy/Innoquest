import { 
  users,
  teams, 
  participants, 
  scanLogs,
  type User, 
  type InsertUser, 
  type Team,
  type InsertTeam,
  type Participant, 
  type InsertParticipant,
  type ParticipantWithTeam,
  type ScanLog,
  type InsertScanLog,
  type ScanLogWithParticipant
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

const SALT_ROUNDS = 10;

export interface IStorage {
  // Users/Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(email: string, password: string, firstName: string, lastName?: string, role?: string): Promise<User>;
  validatePassword(user: User, password: string): Promise<boolean>;

  // Teams
  getTeams(): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  deleteTeam(id: string): Promise<void>;

  // Participants
  getParticipants(): Promise<ParticipantWithTeam[]>;
  getParticipantsByTeam(teamId: string): Promise<Participant[]>;
  getParticipantById(id: string): Promise<Participant | undefined>;
  getParticipantByQrHash(qrHash: string): Promise<ParticipantWithTeam | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipantCheckIn(id: string, isCheckedIn: boolean): Promise<Participant | undefined>;
  deleteParticipant(id: string): Promise<void>;

  // Scan Logs
  getScanLogs(): Promise<ScanLog[]>;
  getRecentScansWithParticipants(limit?: number): Promise<ScanLogWithParticipant[]>;
  createScanLog(scanLog: InsertScanLog): Promise<ScanLog>;

  // Stats
  getStats(): Promise<{ total: number; checkedIn: number; percentage: number; teamCount: number }>;

  // Seed admin
  seedAdminUser(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users/Auth
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(email: string, password: string, firstName: string, lastName?: string, role: string = "volunteer"): Promise<User> {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
      firstName,
      lastName: lastName || null,
      role,
    }).returning();
    return newUser;
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  // Teams
  async getTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(desc(teams.createdAt));
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async deleteTeam(id: string): Promise<void> {
    await db.delete(participants).where(eq(participants.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));
  }

  // Participants
  async getParticipants(): Promise<ParticipantWithTeam[]> {
    const result = await db
      .select()
      .from(participants)
      .leftJoin(teams, eq(participants.teamId, teams.id))
      .orderBy(desc(participants.createdAt));

    return result.map((row) => ({
      ...row.participants,
      team: row.teams!,
    }));
  }

  async getParticipantsByTeam(teamId: string): Promise<Participant[]> {
    return await db.select().from(participants).where(eq(participants.teamId, teamId));
  }

  async getParticipantById(id: string): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id));
    return participant;
  }

  async getParticipantByQrHash(qrHash: string): Promise<ParticipantWithTeam | undefined> {
    const result = await db
      .select()
      .from(participants)
      .leftJoin(teams, eq(participants.teamId, teams.id))
      .where(eq(participants.qrCodeHash, qrHash));

    if (result.length === 0) return undefined;
    
    return {
      ...result[0].participants,
      team: result[0].teams!,
    };
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

  async deleteParticipant(id: string): Promise<void> {
    await db.delete(scanLogs).where(eq(scanLogs.participantId, id));
    await db.delete(participants).where(eq(participants.id, id));
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
      .leftJoin(teams, eq(participants.teamId, teams.id))
      .orderBy(desc(scanLogs.timestamp))
      .limit(limit);

    return logs.map((row) => ({
      ...row.scan_logs,
      participant: {
        ...row.participants!,
        team: row.teams!,
      },
    }));
  }

  async createScanLog(scanLog: InsertScanLog): Promise<ScanLog> {
    const [newLog] = await db.insert(scanLogs).values(scanLog).returning();
    return newLog;
  }

  // Stats
  async getStats(): Promise<{ total: number; checkedIn: number; percentage: number; teamCount: number }> {
    const allParticipants = await db.select().from(participants);
    const allTeams = await db.select().from(teams);
    const total = allParticipants.length;
    const checkedIn = allParticipants.filter((p) => p.isCheckedIn).length;
    const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const teamCount = allTeams.length;

    return { total, checkedIn, percentage, teamCount };
  }

  // Seed admin user
  async seedAdminUser(): Promise<void> {
    const adminEmail = "bhanureddym7@gmail.com";
    const existingAdmin = await this.getUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      await this.createUser(
        adminEmail,
        "admin123", // Default password - user should change this
        "Bhanu",
        "Reddy",
        "admin"
      );
      console.log("Created admin user: bhanureddym7@gmail.com (password: admin123)");
    }
  }
}

export const storage = new DatabaseStorage();

// Helper function to generate QR code hash
export function generateQrHash(participantId: string, email: string): string {
  return crypto.createHash("sha256").update(`${participantId}-${email}-${Date.now()}`).digest("hex");
}
