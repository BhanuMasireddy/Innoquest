import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage, generateQrHash } from "./storage";
import { z } from "zod";
import { signupSchema, loginSchema } from "@shared/schema";
import QRCode from "qrcode";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string | null;
        role: string;
      };
    }
  }
}

// Auth middleware
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && (req.session as any).userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Admin middleware
const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && (req.session as any).role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Admin access required" });
};

// Load user middleware
const loadUser = async (req: Request, res: Response, next: NextFunction) => {
  if (req.session && (req.session as any).userId) {
    const user = await storage.getUserById((req.session as any).userId);
    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
    }
  }
  next();
};

// Validation schemas
const scanRequestSchema = z.object({
  qr_hash: z.string().min(1, "QR hash is required"),
  scan_type: z.enum(["ENTRY"]).default("ENTRY"),
});

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});

const createParticipantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  teamId: z.string().uuid("Invalid team ID"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Apply loadUser middleware to all routes
  app.use(loadUser);

  // Seed admin user
  await storage.seedAdminUser();

  // ================== AUTH ROUTES ==================

  // POST /api/auth/signup - Register new volunteer
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const parseResult = signupSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: parseResult.error.errors[0]?.message || "Invalid input",
        });
      }

      const { email, password, firstName, lastName } = parseResult.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          error: "Email already registered",
          message: "An account with this email already exists",
        });
      }

      // Create new user (volunteers only through signup)
      const user = await storage.createUser(email, password, firstName, lastName, "volunteer");

      // Set session
      (req.session as any).userId = user.id;
      (req.session as any).role = user.role;

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  // POST /api/auth/login - Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parseResult = loginSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: parseResult.error.errors[0]?.message || "Invalid input",
        });
      }

      const { email, password } = parseResult.data;

      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({
          error: "Invalid credentials",
          message: "Email or password is incorrect",
        });
      }

      // Validate password
      const isValid = await storage.validatePassword(user, password);
      if (!isValid) {
        return res.status(401).json({
          error: "Invalid credentials",
          message: "Email or password is incorrect",
        });
      }

      // Set session
      (req.session as any).userId = user.id;
      (req.session as any).role = user.role;

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  // POST /api/auth/logout - Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  // GET /api/auth/user - Get current user
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    const user = await storage.getUserById((req.session as any).userId);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    });
  });

  // ================== STATS ROUTES ==================

  // GET /api/stats - Returns count of total participants vs checked-in participants
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ================== TEAM ROUTES ==================

  // GET /api/teams - Get all teams
  app.get("/api/teams", isAuthenticated, async (req, res) => {
    try {
      const teams = await storage.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  // POST /api/teams - Create new team (admin only)
  app.post("/api/teams", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parseResult = createTeamSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: parseResult.error.errors[0]?.message || "Invalid input",
        });
      }

      const { name, description } = parseResult.data;
      const userId = (req.session as any).userId;

      const team = await storage.createTeam({
        name,
        description: description || null,
        createdBy: userId,
      });

      res.json(team);
    } catch (error: any) {
      console.error("Error creating team:", error);
      if (error.code === "23505") {
        return res.status(400).json({ error: "Team name already exists" });
      }
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  // DELETE /api/teams/:id - Delete team (admin only)
  app.delete("/api/teams/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      await storage.deleteTeam(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  // ================== PARTICIPANT ROUTES ==================

  // GET /api/participants - Get all participants
  app.get("/api/participants", isAuthenticated, async (req, res) => {
    try {
      const participants = await storage.getParticipants();
      res.json(participants);
    } catch (error) {
      console.error("Error fetching participants:", error);
      res.status(500).json({ error: "Failed to fetch participants" });
    }
  });

  // POST /api/participants - Create new participant (admin only)
  app.post("/api/participants", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parseResult = createParticipantSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: parseResult.error.errors[0]?.message || "Invalid input",
        });
      }

      const { name, email, teamId } = parseResult.data;

      // Verify team exists
      const team = await storage.getTeamById(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      // Generate QR code hash
      const qrCodeHash = generateQrHash(teamId, email);

      const participant = await storage.createParticipant({
        name,
        email,
        teamId,
        qrCodeHash,
      });

      res.json(participant);
    } catch (error: any) {
      console.error("Error creating participant:", error);
      if (error.code === "23505") {
        return res.status(400).json({ error: "Participant already exists" });
      }
      res.status(500).json({ error: "Failed to create participant" });
    }
  });

  // DELETE /api/participants/:id - Delete participant (admin only)
  app.delete("/api/participants/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      await storage.deleteParticipant(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting participant:", error);
      res.status(500).json({ error: "Failed to delete participant" });
    }
  });

  // GET /api/participants/:id/qrcode - Generate QR code for participant (admin only)
  app.get("/api/participants/:id/qrcode", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const participant = await storage.getParticipantById(id);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }

      // Generate QR code as PNG buffer
      const qrCodeBuffer = await QRCode.toBuffer(participant.qrCodeHash, {
        type: "png",
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="qr-${participant.name.replace(/\s+/g, "-")}.png"`);
      res.send(qrCodeBuffer);
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // GET /api/participants/:id/qrcode-data - Get QR code as base64 (for display)
  app.get("/api/participants/:id/qrcode-data", isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id as string;
      const participant = await storage.getParticipantById(id);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }

      const qrCodeDataUrl = await QRCode.toDataURL(participant.qrCodeHash, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      res.json({ qrCode: qrCodeDataUrl, hash: participant.qrCodeHash });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // ================== SCAN ROUTES ==================

  // GET /api/scans/recent - Get recent scans with participant info
  app.get("/api/scans/recent", isAuthenticated, async (req, res) => {
    try {
      const limitParam = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const limit = parseInt(limitParam as string) || 10;
      const scans = await storage.getRecentScansWithParticipants(limit);
      res.json(scans);
    } catch (error) {
      console.error("Error fetching recent scans:", error);
      res.status(500).json({ error: "Failed to fetch recent scans" });
    }
  });

  // POST /api/scan - Scan a QR code to check in a participant
  app.post("/api/scan", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body with Zod
      const parseResult = scanRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          message: parseResult.error.errors[0]?.message || "Invalid request body",
        });
      }

      const { qr_hash, scan_type } = parseResult.data;

      // Find participant by QR hash
      const participant = await storage.getParticipantByQrHash(qr_hash);

      if (!participant) {
        return res.status(404).json({
          success: false,
          error: "Participant not found",
          message: "No participant found with this QR code",
        });
      }

      // Check if already checked in for ENTRY scan type
      if (scan_type === "ENTRY" && participant.isCheckedIn) {
        return res.status(400).json({
          success: false,
          error: "Already checked in",
          message: `${participant.name} is already checked in`,
          participant,
        });
      }

      // Update participant check-in status
      const updatedParticipant = await storage.updateParticipantCheckIn(participant.id, true);

      // Create scan log
      const userId = (req.session as any).userId || "unknown";
      await storage.createScanLog({
        participantId: participant.id,
        scannedBy: userId,
        scanType: scan_type,
      });

      res.json({
        success: true,
        message: `Successfully checked in ${participant.name}`,
        participant: {
          ...updatedParticipant,
          team: participant.team,
        },
      });
    } catch (error) {
      console.error("Error processing scan:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process scan",
        message: "An error occurred while processing the scan",
      });
    }
  });

  return httpServer;
}
