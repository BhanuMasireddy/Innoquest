import {
  users,
  teams,
  labs,
  participants,
  scanLogs,
  type User,
  type InsertUser,
  type Team,
  type InsertTeam,
  type Lab,
  type InsertLab,
  type Participant,
  type InsertParticipant,
  type ParticipantWithTeamAndLab,
  type ScanLog,
  type InsertScanLog,
  type ScanLogWithParticipant,
  type ProfileUpdateInput,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

const SALT_ROUNDS = 10;

export interface IStorage {
  // Users/Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  createUser(
    email: string,
    password: string,
    firstName: string,
    lastName?: string,
    role?: string
  ): Promise<User>;
  validatePassword(user: User, password: string): Promise<boolean>;
  updateUserProfile(id: string, data: ProfileUpdateInput): Promise<User | undefined>;

  // Volunteers
  getVolunteers(): Promise<User[]>;
  updateVolunteer(
    id: string,
    data: {
      firstName: string;
      lastName?: string | null;
      email: string;
      organization?: string | null;
    }
  ): Promise<User | undefined>;
  getVolunteerByQrHash(qrHash: string): Promise<User | undefined>;
  generateVolunteerQrHash(userId: string): Promise<string>;
  updateVolunteerCheckIn(id: string, isCheckedIn: boolean): Promise<User | undefined>;
  deleteVolunteer(id: string): Promise<void>;

  // Teams
  getTeams(): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  getTeamByName(name: string): Promise<Team | undefined>;


  // Labs
  getLabs(): Promise<Lab[]>;
  createLab(data: InsertLab): Promise<Lab>;
  deleteLab(id: string): Promise<void>;
  getLabByName(name: string): Promise<Lab | undefined>;

  // Participants
  getParticipants(): Promise<ParticipantWithTeamAndLab[]>;
  getParticipantsByTeam(teamId: string): Promise<Participant[]>;
  getParticipantById(id: string): Promise<Participant | undefined>;
  getParticipantByQrHash(qrHash: string): Promise<ParticipantWithTeamAndLab | undefined>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipantCheckIn(id: string, isCheckedIn: boolean): Promise<Participant | undefined>;
  deleteParticipant(id: string): Promise<void>;
  getParticipantByEmail(email: string): Promise<Participant | undefined>;

  // Scan Logs
  getScanLogs(): Promise<ScanLog[]>;
  getRecentScansWithParticipants(limit?: number): Promise<ScanLogWithParticipant[]>;
  createScanLog(scanLog: InsertScanLog): Promise<ScanLog>;

  // Stats
  getStats(): Promise<{ total: number; checkedIn: number; percentage: number; teamCount: number }>;

  // Seed
  seedAdminUser(): Promise<void>;

  updateParticipantLab(
  participantId: string,
  labId: string
  ): Promise<Participant | undefined>;

}

export class DatabaseStorage implements IStorage {
  /* ================= USERS ================= */

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(email: string, password: string, firstName: string, lastName?: string, role = "volunteer") {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, firstName, lastName: lastName || null, role })
      .returning();
    return user;
  }

  async validatePassword(user: User, password: string) {
    return bcrypt.compare(password, user.passwordHash);
  }

  async updateUserProfile(id: string, data: ProfileUpdateInput) {
    const [updated] = await db
      .update(users)
      .set({
        firstName: data.firstName,
        lastName: data.lastName || null,
        phone: data.phone || null,
        bio: data.bio || null,
        organization: data.organization || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  /* ================= VOLUNTEERS ================= */

  async getVolunteers() {
    return db.select().from(users).where(eq(users.role, "volunteer")).orderBy(desc(users.createdAt));
  }

  async updateVolunteer(
    id: string,
    data: {
      firstName: string;
      lastName?: string | null;
      email: string;
      organization?: string | null;
    }
  ) {
    const [updated] = await db
      .update(users)
      .set({
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email,
        organization: data.organization || null,
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, id), eq(users.role, "volunteer")))
      .returning();
    return updated;
  }

  async getVolunteerByQrHash(qrHash: string) {
    const [volunteer] = await db
      .select()
      .from(users)
      .where(and(eq(users.qrCodeHash, qrHash), eq(users.role, "volunteer")));
    return volunteer;
  }

  async generateVolunteerQrHash(userId: string) {
    const qrHash = crypto.createHash("sha256").update(`volunteer-${userId}-${Date.now()}`).digest("hex");
    await db.update(users).set({ qrCodeHash: qrHash }).where(eq(users.id, userId));
    return qrHash;
  }

  async updateVolunteerCheckIn(id: string, isCheckedIn: boolean) {
    const [updated] = await db
      .update(users)
      .set({
        isCheckedIn: isCheckedIn ? "true" : "false",
        lastCheckIn: isCheckedIn ? new Date() : null,
      })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteVolunteer(id: string) {
    await db.delete(scanLogs).where(eq(scanLogs.scannedBy, id));
    await db.delete(users).where(eq(users.id, id));
  }

  /* ================= TEAMS ================= */

  async getAllTeams() {
  return db.select().from(teams);
}


  getTeams() {
  return db.select().from(teams);
}



  async getTeamById(id: string) {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team;
  }

  async createTeam(team: InsertTeam) {
    const [newTeam] = await db.insert(teams).values(team).returning();
    return newTeam;
  }

  async deleteTeam(id: string) {
    await db.delete(participants).where(eq(participants.teamId, id));
    await db.delete(teams).where(eq(teams.id, id));
  }

  async getTeamByName(name: string) {
    const [team] = await db.select().from(teams).where(eq(teams.name, name));
    return team;
  }

  /* ================= LABS ================= */

  async getAllLabs() {
  return db.select().from(labs)
  .where(eq(labs.isSystem, false))
  .orderBy(desc(labs.createdAt));
}

  async getTeamsByLab(labId: string): Promise<Team[]> {
  const result = await db
    .selectDistinct({
      id: teams.id,
      name: teams.name,
      description: teams.description,
      createdBy: teams.createdBy,
      isSystem: teams.isSystem,
      createdAt: teams.createdAt,
    })
    .from(participants)
    .innerJoin(teams, eq(participants.teamId, teams.id))
    .where(eq(participants.labId, labId));

  return result;
}


  async getLabs() {
    return db.select().from(labs).orderBy(desc(labs.createdAt));
  }

  async createLab(data: InsertLab) {
    const [lab] = await db.insert(labs).values(data).returning();
    return lab;
  }

  async deleteLab(id: string): Promise<void> {
    try {
      await db.delete(participants).where(eq(participants.labId, id));
      await db.delete(labs).where(eq(labs.id, id));
    } catch (error) {
      console.error("Database error during lab deletion:", error);
      throw error;
    }
  }

  async getLabByName(name: string) {
    const [lab] = await db.select().from(labs).where(eq(labs.name, name));
    return lab;
  }

  /* ================= PARTICIPANTS ================= */

  async getParticipants(): Promise<ParticipantWithTeamAndLab[]> {
    const result = await db
      .select()
      .from(participants)
      .leftJoin(teams, eq(participants.teamId, teams.id))
      .leftJoin(labs, eq(participants.labId, labs.id))
      .orderBy(desc(participants.createdAt));

    return result.map((row) => ({
      ...row.participants,
      team: row.teams!,
      lab: row.labs!,
    }));
  }

  async checkoutAllParticipants() {
  return db
    .update(participants)
    .set({ isCheckedIn: false })
    .where(eq(participants.isCheckedIn, true));
}


  async getParticipantsByTeam(teamId: string) {
    return db.select().from(participants).where(eq(participants.teamId, teamId));
  }

  async getParticipantById(id: string) {
    const [p] = await db.select().from(participants).where(eq(participants.id, id));
    return p;
  }

async getParticipantByQrHash(
  qrHash: string
): Promise<ParticipantWithTeamAndLab | undefined> {
  const result = await db
    .select()
    .from(participants)
    .leftJoin(teams, eq(participants.teamId, teams.id))
    .leftJoin(labs, eq(participants.labId, labs.id))
    .where(eq(participants.qrCodeHash, qrHash));

  if (!result.length) return undefined;

  return {
    ...result[0].participants,
    team: result[0].teams!,
    lab: result[0].labs!,
  };
}


  async createParticipant(participant: InsertParticipant) {
    const [p] = await db.insert(participants).values(participant).returning();
    return p;
  }

  async updateParticipantCheckIn(id: string, isCheckedIn: boolean) {
    const [p] = await db.update(participants).set({ isCheckedIn }).where(eq(participants.id, id)).returning();
    return p;
  }

  async deleteParticipant(id: string) {
    await db.delete(scanLogs).where(eq(scanLogs.participantId, id));
    await db.delete(participants).where(eq(participants.id, id));
  }

  async updateParticipantLab(participantId: string, labId: string) {
    const [updated] = await db
      .update(participants)
      .set({ labId })
      .where(eq(participants.id, participantId))
      .returning();

    return updated;
  }

  async getLastScanByQr(qrHash: string) {
    const [row] = await db
      .select()
      .from(scanLogs)
      .innerJoin(participants, eq(scanLogs.participantId, participants.id))
      .where(eq(participants.qrCodeHash, qrHash))
      .orderBy(desc(scanLogs.createdAt))
      .limit(1);

    return row?.scan_logs;
  }

  async getParticipantByEmail(email: string) {
    const [p] = await db.select().from(participants).where(eq(participants.email, email));
    return p;
  }

  async updateParticipant(
  id: string,
  data: {
    name: string;
    email: string;
    teamId: string;
    labId: string;
  }
) {
  const [updated] = await db
    .update(participants)
    .set({
      name: data.name,
      email: data.email,
      teamId: data.teamId,
      labId: data.labId,
    })
    .where(eq(participants.id, id))
    .returning();

  return updated;
}





  /* ================= SCANS ================= */

  async getScanLogs() {
    return db.select().from(scanLogs).orderBy(desc(scanLogs.createdAt));
  }

  async getRecentScansWithParticipants(limit = 10): Promise<ScanLogWithParticipant[]> {
    const rows = await db
      .select()
      .from(scanLogs)
      .leftJoin(participants, eq(scanLogs.participantId, participants.id))
      .leftJoin(teams, eq(participants.teamId, teams.id))
      .leftJoin(labs, eq(participants.labId, labs.id))
      .orderBy(desc(scanLogs.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r.scan_logs,
      participant: {
        ...r.participants!,
        team: r.teams!,
        lab: r.labs!,
      },
    }));
  }

  async createScanLog(scanLog: InsertScanLog) {
    const [log] = await db.insert(scanLogs).values(scanLog).returning();
    return log;
  }


  /* ================= STATS ================= */

  async getStats() {
    const allParticipants = await db.select().from(participants);
    const allTeams = await db.select().from(teams);
    const total = allParticipants.length;
    const checkedIn = allParticipants.filter((p) => p.isCheckedIn).length;
    const percentage = total ? Math.round((checkedIn / total) * 100) : 0;
    return { total, checkedIn, percentage, teamCount: allTeams.length };
  }

  /* ================= SEED ================= */

  async seedAdminUser() {
    const email = "bhanureddym7@gmail.com";
    const exists = await this.getUserByEmail(email);
    try{

    if (!exists) {
      await this.createUser(email, "admin123", "Bhanu", "Reddy", "admin");
      console.log("Created admin user:", email);
    }
  }
  catch (e) {
    console.error("DB offline — skipping admin seed");
  }
  }
}

export const storage = new DatabaseStorage();
// Helper function to generate QR hash for participants
export function generateQrHash(participantId: string, email: string): string {
  return crypto
    .createHash("sha256")
    .update(`${participantId}-${email}-${Date.now()}`)
    .digest("hex");
}
