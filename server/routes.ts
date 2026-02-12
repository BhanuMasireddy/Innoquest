import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage, generateQrHash } from "./storage";
import { z } from "zod";
import { signupSchema, loginSchema, profileUpdateSchema } from "@shared/schema";
import QRCode from "qrcode";
import { parseParticipantExcel } from "./excel"; // Ensure you created this file
import multer from "multer";
import * as XLSX from "xlsx";
import PDFDocument from 'pdfkit';


// Define User type
type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: string;
  phone?: string;
  bio?: string;
  organization?: string;
  qrCodeHash?: string;
  isCheckedIn?: boolean | string;
  lastCheckIn?: string;
  createdAt?: string;
};
const upload = multer();
// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// seconds
  const SCAN_COOLDOWN_SECONDS = 10;
const ID_CARD_WIDTH = 3.5 * 72;
const ID_CARD_HEIGHT = 5.5 * 72;

function drawPremiumCard(
  doc: PDFKit.PDFDocument,
  params: {
    name: string;
    subtitle?: string;
    teamOrOrg: string;
    role: "Participant" | "Volunteer";
    location: string;
    qrBuffer: Buffer;
  }
) {
  const { name, subtitle, teamOrOrg, role, location, qrBuffer } = params;
  const w = ID_CARD_WIDTH;
  const h = ID_CARD_HEIGHT;

  doc.rect(0, 0, w, h).fill("#030712");
  doc.circle(w * 0.2, h * 0.1, 80).fillOpacity(0.18).fill("#1d4ed8").fillOpacity(1);
  doc.circle(w * 0.85, h * 0.92, 65).fillOpacity(0.14).fill("#0284c7").fillOpacity(1);

  doc.fillColor("#7dd3fc").font("Helvetica").fontSize(7).text("DEPT OF CSE", 0, 22, {
    align: "center",
    characterSpacing: 2,
  });
  doc.fillColor("#e2f3ff").font("Helvetica-BoldOblique").fontSize(26).text("INNOQUEST", 0, 35, { align: "center" });
  doc.fillColor("#94a3b8").font("Helvetica").fontSize(7).text("EDITION", 0, 65, { align: "center" });
  doc.fillColor("#7dd3fc").font("Helvetica-Bold").fontSize(8).text("#04", 0, 74, { align: "center" });

  const qrX = (w - 110) / 2;
  const qrY = 104;
  doc.roundedRect(qrX - 4, qrY - 4, 118, 118, 8).fill("#2a3f5f");
  doc.roundedRect(qrX, qrY, 110, 110, 8).fill("#ffffff");
  doc.image(qrBuffer, qrX + 8, qrY + 8, { fit: [94, 94] });
  doc.fillColor("#a5f3fc").font("Helvetica").fontSize(7).text("SCAN FOR ENTRY", 0, 222, {
    align: "center",
    characterSpacing: 2,
  });

  const infoX = 10;
  const infoY = 240;
  const infoW = w - 20;
  const infoH = 132;
  doc.roundedRect(infoX, infoY, infoW, infoH, 10).fillOpacity(0.15).fill("#1f2937").fillOpacity(1);
  doc.roundedRect(infoX, infoY, infoW, infoH, 10).lineWidth(1).strokeOpacity(0.35).stroke("#dbeafe").strokeOpacity(1);

  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(15).text(name.toUpperCase(), infoX + 8, infoY + 12, {
    align: "center",
    width: infoW - 16,
  });
  if (subtitle) {
    doc.fillColor("#cbd5e1").font("Helvetica").fontSize(8).text(subtitle, infoX + 8, infoY + 32, {
      align: "center",
      width: infoW - 16,
      ellipsis: true,
    });
  }

  doc.roundedRect(infoX + 16, infoY + 50, 94, 18, 9).fillOpacity(0.3).fill("#0369a1").fillOpacity(1);
  doc.fillColor("#e0f2fe").font("Helvetica-Bold").fontSize(7).text(teamOrOrg.toUpperCase(), infoX + 18, infoY + 56, {
    width: 90,
    align: "center",
    ellipsis: true,
  });
  doc.roundedRect(infoX + 116, infoY + 50, 68, 18, 9).fill("#334155");
  doc.fillColor("#e2e8f0").font("Helvetica-Bold").fontSize(7).text(role.toUpperCase(), infoX + 118, infoY + 56, {
    width: 64,
    align: "center",
  });

  doc.moveTo(infoX + 12, infoY + 82).lineTo(infoX + infoW - 12, infoY + 82).lineWidth(1).strokeOpacity(0.35).stroke("#e2e8f0").strokeOpacity(1);
  doc.fillColor("#cbd5e1").font("Helvetica").fontSize(7).text("27 FEB - 01 MAR", infoX + 14, infoY + 90);
  doc.fillColor("#cbd5e1").font("Helvetica").fontSize(7).text(location, infoX + 90, infoY + 90, {
    width: infoW - 104,
    align: "right",
    ellipsis: true,
  });

  doc.rect(0, h - 6, w, 6).fill("#0ea5e9");
}

const updateParticipantLabSchema = z.object({
  labId: z.string().uuid(),
});

const scanPreviewRequestSchema = z.object({
  qr_hash: z.string().min(1),
});


// Auth middleware
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && (req.session as any).userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Admin middleware
const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.session as any)?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = await storage.getUserById(userId);

  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  next();
};

// Load user middleware
const loadUser = async (req: Request, res: Response, next: NextFunction) => {
  if (req.session && (req.session as any).userId) {
    const user = await storage.getUserById((req.session as any).userId);
    if (user) {
      req.user = user;
    }
  }
  next();
};

// Validation schemas
const scanRequestSchema = z.object({
  qr_hash: z.string().min(1, "QR hash is required"),
  scan_type: z.enum(["ENTRY", "EXIT"]),
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

const updateVolunteerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email"),
  organization: z.string().optional(),
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
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

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
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
      });

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
      phone: user.phone,
      bio: user.bio,
      organization: user.organization,
      qrCodeHash: user.qrCodeHash,
      isCheckedIn: user.isCheckedIn === "true",
    });
  });

  // PUT /api/auth/profile - Update user profile
  app.put("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const parseResult = profileUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: parseResult.error.errors[0]?.message || "Invalid input",
        });
      }

      const userId = (req.session as any).userId;
      const updatedUser = await storage.updateUserProfile(userId, parseResult.data);

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        phone: updatedUser.phone,
        bio: updatedUser.bio,
        organization: updatedUser.organization,
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ================== VOLUNTEER ROUTES ==================

  // GET /api/volunteers - Get all volunteers (admin gets full data, volunteers get limited view)
  app.get("/api/volunteers", isAuthenticated, async (req, res) => {
    try {
      const volunteers = await storage.getVolunteers();
      const isAdminUser = (req.session as any).role === "admin";
      
      // Return full data for admins, limited data for volunteers
      res.json(volunteers.map(v => {
        if (isAdminUser) {
          return {
            id: v.id,
            email: v.email,
            firstName: v.firstName,
            lastName: v.lastName,
            phone: v.phone,
            bio: v.bio,
            organization: v.organization,
            qrCodeHash: v.qrCodeHash,
            isCheckedIn: v.isCheckedIn === "true",
            lastCheckIn: v.lastCheckIn,
            createdAt: v.createdAt,
          };
        }
        // Limited view for non-admins (only show check-in status)
        return {
          id: v.id,
          firstName: v.firstName,
          lastName: v.lastName,
          organization: v.organization,
          isCheckedIn: v.isCheckedIn === "true",
        };
      }));
    } catch (error) {
      console.error("Error fetching volunteers:", error);
      res.status(500).json({ error: "Failed to fetch volunteers" });
    }
  });

  // POST /api/volunteers/:id/generate-qr - Generate QR code for volunteer (admin only)
  app.post("/api/volunteers/:id/generate-qr", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.role !== "volunteer") {
        return res.status(400).json({ error: "QR codes can only be generated for volunteers" });
      }
      const qrHash = await storage.generateVolunteerQrHash(id);
      res.json({ success: true, qrHash });
    } catch (error) {
      console.error("Error generating volunteer QR:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // GET /api/volunteers/:id/qrcode - Download QR code for volunteer (admin only)
  app.get("/api/volunteers/:id/qrcode", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const user = await storage.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user.role !== "volunteer") {
        return res.status(400).json({ error: "QR codes can only be generated for volunteers" });
      }

      // Generate QR hash if not exists
      let qrHash = user.qrCodeHash;
      if (!qrHash) {
        qrHash = await storage.generateVolunteerQrHash(id);
      }

      const qrCodeBuffer = await QRCode.toBuffer(qrHash, {
        type: "png",
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="volunteer-qr-${user.firstName}.png"`);
      res.send(qrCodeBuffer);
    } catch (error) {
      console.error("Error generating volunteer QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // POST /api/volunteers/:id/checkout - Checkout volunteer (admin only)
  app.post("/api/volunteers/:id/checkout", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const updated = await storage.updateVolunteerCheckIn(id, false);
      if (!updated) {
        return res.status(404).json({ error: "Volunteer not found" });
      }
      res.json({ success: true, volunteer: updated });
    } catch (error) {
      console.error("Error checking out volunteer:", error);
      res.status(500).json({ error: "Failed to checkout volunteer" });
    }
  });

  // PATCH /api/volunteers/:id - Update volunteer details (admin only)
  app.patch("/api/volunteers/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parseResult = updateVolunteerSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: parseResult.error.errors[0]?.message || "Invalid input",
        });
      }

      const id = req.params.id as string;
      const updated = await storage.updateVolunteer(id, parseResult.data);
      if (!updated) {
        return res.status(404).json({ error: "Volunteer not found" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating volunteer:", error);
      if (error.code === "23505") {
        return res.status(400).json({ error: "Email already in use" });
      }
      res.status(500).json({ error: "Failed to update volunteer" });
    }
  });

  // DELETE /api/volunteers/:id - Delete volunteer (admin only)
  app.delete("/api/volunteers/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      await storage.deleteVolunteer(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting volunteer:", error);
      if (error.message === "Volunteer not found") {
        return res.status(404).json({ error: "Volunteer not found" });
      }
      res.status(500).json({ error: "Failed to delete volunteer" });
    }
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
// ================== LAB ROUTES ==================

// GET /api/labs - list labs (authenticated)
app.get("/api/labs", isAuthenticated, async (req, res) => {
  const labs = await storage.getLabs();
  res.json(labs);
});

// POST /api/labs - create lab (admin only)
app.post("/api/labs", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Lab name is required" });
    }

    const lab = await storage.createLab({
      name,
      description,
    });

    res.json(lab);
  } catch (err: any) {
    console.error("Error creating lab:", err);

    if (err.code === "23505") {
      return res.status(400).json({ message: "Lab already exists" });
    }

    res.status(500).json({ message: "Failed to create lab" });
  }
});


// server/routes.ts
app.delete("/api/labs/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      await storage.deleteLab(id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Delete lab error:", error);
      res.status(500).json({ message: "Failed to delete lab" });
    }
  });

app.post("/api/participants/:id/checkout", isAuthenticated, isAdmin, async (req, res) => {
  try {    const id = req.params.id as string;
    const updated = await storage.updateParticipantCheckIn(id, false);
    if (!updated) {
      return res.status(404).json({ error: "Participant not found" });
    }
    res.json({ success: true, participant: updated });
  } catch (error) {
    console.error("Error checking out participant:", error);
    res.status(500).json({ error: "Failed to checkout participant" });
  }
});
  
  // Add this route inside your registerRoutes(app) function
app.get("/api/participants/export-qrs", async (req, res) => {
  // 1. Authenticate and Authorize
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    return res.status(403).send("Unauthorized");
  }

  try {
    const participants = await storage.getParticipants();
    
    if (!participants || participants.length === 0) {
      return res.status(404).send("No participants found to export.");
    }

    const doc = new PDFDocument({
      margin: 0,
      size: [ID_CARD_WIDTH, ID_CARD_HEIGHT],
    });

    // 3. Set Response Headers for browser download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Participant_QRs.pdf"');

    // Pipe the PDF directly to the response stream
    doc.pipe(res);

    let isFirstPage = true;

    for (const p of participants) {
      if (!isFirstPage) {
        doc.addPage({ size: [ID_CARD_WIDTH, ID_CARD_HEIGHT], margin: 0 });
      }
      isFirstPage = false;

      const qrBuffer = await QRCode.toBuffer(p.qrCodeHash || "no-hash-available", {
        type: "png",
        width: 300,
        margin: 1,
      });
      drawPremiumCard(doc, {
        name: p.name,
        subtitle: p.email,
        teamOrOrg: p.team?.name || "No Team",
        role: "Participant",
        location: p.lab?.name || "Main Lab",
        qrBuffer,
      });
    }

    doc.end();

  } catch (error) {
    console.error("PDF Export Error:", error);
    // If headers haven't been sent yet, send a JSON error
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  }
});

app.get("/api/volunteers/export-qrs", async (req, res) => {
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    return res.status(403).send("Unauthorized");
  }

  try {
    const volunteers = await storage.getVolunteers();
    if (!volunteers || volunteers.length === 0) {
      return res.status(404).send("No volunteers found to export.");
    }

    const doc = new PDFDocument({
      margin: 0,
      size: [ID_CARD_WIDTH, ID_CARD_HEIGHT],
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Volunteer_QRs.pdf"');
    doc.pipe(res);

    let isFirstPage = true;
    for (const v of volunteers) {
      if (!isFirstPage) {
        doc.addPage({ size: [ID_CARD_WIDTH, ID_CARD_HEIGHT], margin: 0 });
      }
      isFirstPage = false;

      const qrHash = v.qrCodeHash || (await storage.generateVolunteerQrHash(v.id));
      const qrBuffer = await QRCode.toBuffer(qrHash, {
        type: "png",
        width: 300,
        margin: 1,
      });

      drawPremiumCard(doc, {
        name: `${v.firstName} ${v.lastName || ""}`.trim(),
        subtitle: v.email,
        teamOrOrg: v.organization || "Volunteer",
        role: "Volunteer",
        location: v.organization || "Event Team",
        qrBuffer,
      });
    }

    doc.end();
  } catch (error) {
    console.error("Volunteer PDF Export Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate volunteer PDF" });
    }
  }
});

// POST /api/participants/checkout-all
app.post(
  "/api/participants/checkout-all",
  isAuthenticated,
  isAdmin,
  async (_req, res) => {
    try {
      const result = await storage.checkoutAllParticipants();
      res.json({
        success: true,
        message: "All participants checked out",
      });
    } catch (error) {
      console.error("Bulk checkout error:", error);
      res.status(500).json({
        error: "Failed to checkout all participants",
      });
    }
  }
);



  // ================== PARTICIPANT ROUTES ==================

// Validation schema
const createParticipantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  teamId: z.string().uuid(),
  labId: z.string().uuid(),
});

// GET /api/participants - Get all participants
app.get("/api/participants", isAuthenticated, async (_req, res) => {
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

    const { name, email, teamId, labId } = parseResult.data;

    // Verify team exists
    const team = await storage.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Verify lab exists
    const labs = await storage.getLabs();
    const lab = labs.find((l) => l.id === labId);
    if (!lab) {
      return res.status(404).json({ error: "Lab not found" });
    }

    // Generate QR hash
    const qrCodeHash = generateQrHash(teamId, email);

    const participant = await storage.createParticipant({
      name,
      email,
      teamId,
      labId,
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

// PATCH /api/participants/:id - Update participant details (admin only)
app.patch("/api/participants/:id",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const participantId = req.params.id as string;
        const { name, email, teamId, labId } = req.body;

        if (!name || !email || !teamId || !labId) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const updated = await storage.updateParticipant(participantId, {
          name,
          email,
          teamId,
          labId,
        });

        if (!updated) {
          return res.status(404).json({ message: "Participant not found" });
        }

        res.json(updated);
      } catch (error) {
        console.error("Update participant error:", error);
        res.status(500).json({ message: "Failed to update participant" });
      }
    }
  );


// GET /api/participants/:id/qrcode - Download QR code PNG (admin only)
app.get("/api/participants/:id/qrcode", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    const participant = await storage.getParticipantById(id);

    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    const qrCodeBuffer = await QRCode.toBuffer(participant.qrCodeHash, {
      type: "png",
      width: 300,
      margin: 2,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="qr-${participant.name.replace(/\s+/g, "-")}.png"`
    );

    res.send(qrCodeBuffer);
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// GET /api/participants/:id/qrcode-data - QR code as base64 (for UI)
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
    });

    res.json({
      qrCode: qrCodeDataUrl,
      hash: participant.qrCodeHash,
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

  app.get(
    "/api/teams/:teamId/participants",
    isAuthenticated,
    async (req, res) => {
      try {
        const teamId = Array.isArray(req.params.teamId)
            ? req.params.teamId[0]
            : req.params.teamId;


        const participants = await storage.getParticipantsByTeam(teamId);

        res.json(participants);
      } catch (error) {
        console.error("Fetch team participants error:", error);
        res.status(500).json({ message: "Failed to fetch participants" });
      }
    }
  );

  app.get(
      "/api/labs/:labId/teams",
      isAuthenticated,
      isAdmin,
      async (req, res) => {
        try {
          const labId = Array.isArray(req.params.labId)
            ? req.params.labId[0]
            : req.params.labId;


          const teams = await storage.getTeamsByLab(labId);

          res.json(teams);
        } catch (error) {
          console.error("Fetch lab teams error:", error);
          res.status(500).json({ message: "Failed to fetch teams" });
        }
      }
  );


// UPDATE participant lab (admin only)
app.put(
  "/api/participants/:id/lab",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const participantId = req.params.id as string;

      const parseResult = updateParticipantLabSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          message: parseResult.error.errors[0]?.message,
        });
      }

      const { labId } = parseResult.data;

      // check participant exists
      const participant = await storage.getParticipantById(participantId);
      if (!participant) {
        return res.status(404).json({ error: "Participant not found" });
      }

      // check lab exists
      const labs = await storage.getLabs();
      const labExists = labs.find((l) => l.id === labId);
      if (!labExists) {
        return res.status(404).json({ error: "Lab not found" });
      }

      // update lab
      const updated = await storage.updateParticipantLab(
        participantId,
        labId
      );

      res.json({ success: true, participant: updated });
    } catch (error) {
      console.error("Error updating participant lab:", error);
      res.status(500).json({ error: "Failed to update lab" });
    }
  }
);

 app.get("/api/participants/exportAttendace", async (req, res) => {
  // 1. Admin Authorization
  if (!req.isAuthenticated() || req.user?.role !== "admin") {
    return res.status(403).send("Unauthorized");
  }

  try {
    // 2. Fetch all necessary data
    const participants = await storage.getParticipants();
    const teams = await storage.getTeams();
    const labs = await storage.getLabs();

    // 3. Transform data into a readable format for Excel
    const reportData = participants.map(p => {
      const team = teams.find(t => t.id === p.teamId);
      const lab = labs.find(l => l.id === p.labId);
      
      return {
        "Participant Name": p.name,
        "Email Address": p.email,
        "Assigned Team": team?.name || "N/A",
        "Assigned Lab": lab?.name || "N/A",
        "Check-in Status": p.isCheckedIn ? "PRESENT" : "ABSENT",
        "Registration Date": p.createdAt ? new Date(p.createdAt).toLocaleString() : "N/A"
      };
    });

    // 4. Create Excel Workbook using XLSX
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

    // 5. Write to buffer and send
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Attendance_Report.xlsx"');
    
    res.send(excelBuffer);

  } catch (error) {
    console.error("Export Error:", error);
    res.status(500).json({ message: "Failed to generate Excel report" });
  }
});

  app.post(
  "/api/participants/bulk-upload",
  upload.single("file"),
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const rows = parseParticipantExcel(req.file.buffer);

      let created = 0;
      let skipped = 0;
      let failed = 0;

      // 🔹 IMPORTANT: Fetch ALL teams & labs (system + non-system)
      const allTeams = await storage.getAllTeams();
      const allLabs = await storage.getAllLabs();

      const teamMap = new Map<string, string>(); // teamName → teamId
      const labMap = new Map<string, string>();  // labName → labId

      allTeams.forEach(t =>
        teamMap.set(t.name.toLowerCase(), t.id)
      );
      allLabs.forEach(l =>
        labMap.set(l.name.toLowerCase(), l.id)
      );

      for (const row of rows) {
        try {
          const { name, email, team, lab } = row;

          if (!name || !email || !team || !lab) {
            failed++;
            continue;
          }

          // 1️⃣ Skip duplicate participants
          const existing = await storage.getParticipantByEmail(email);
          if (existing) {
            skipped++;
            continue;
          }

          // 2️⃣ Get or create TEAM (hidden from UI)
          let teamId = teamMap.get(team.toLowerCase());
          if (!teamId) {
            const newTeam = await storage.createTeam({
              name: team,
              description: "Bulk uploaded",
              createdBy: req.user!.id,
              isSystem: true, // 🔥 KEY FIX
            });

            teamId = newTeam.id;
            teamMap.set(team.toLowerCase(), teamId);
          }

          // 3️⃣ Get or create LAB
          let labId = labMap.get(lab.toLowerCase());
          if (!labId) {
            const newLab = await storage.createLab({
              name: lab,
              description: "Bulk uploaded",
              isSystem: true, // optional but recommended
            });

            labId = newLab.id;
            labMap.set(lab.toLowerCase(), labId);
          }

          // 4️⃣ Create participant
          await storage.createParticipant({
            name,
            email,
            teamId,
            labId,
            qrCodeHash: crypto.randomUUID(),
          });

          created++;
        } catch (rowError) {
          console.error("Row failed:", rowError);
          failed++;
        }
      }

      res.json({ created, skipped, failed });
    } catch (error) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ message: "Bulk upload failed" });
    }
  }
);

  // ================== SCAN ROUTES ==================

  // GET /api/scans/recent - Get recent scans with participant info
  app.get("/api/scans/recent", isAuthenticated, async (req, res) => {
    try {
      const rawLimit = req.query.limit;
      const limit =
      typeof rawLimit === "string"
        ? parseInt(rawLimit, 10)
        : 10;
      const scans = await storage.getRecentScansWithParticipants(limit);
      res.json(scans);
    } catch (error) {
      console.error("Error fetching recent scans:", error);
      res.status(500).json({ error: "Failed to fetch recent scans" });
    }
  });


 // ================== SCAN PREVIEW ==================
app.post("/api/scan-preview", isAuthenticated, async (req, res) => {
  try {
    const parseResult = scanPreviewRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid QR data",
      });
    }

    const { qr_hash } = parseResult.data;

    // -------- Participant --------
    const participant = await storage.getParticipantByQrHash(qr_hash);
    if (participant) {
      const scanType: "ENTRY" | "EXIT" =
        participant.isCheckedIn ? "EXIT" : "ENTRY";

      return res.json({
        success: true,
        type: "participant",
        name: participant.name,
        scanType,
        isCheckedIn: participant.isCheckedIn, // 🔥 ADD THIS
      });
    }

    // -------- Volunteer --------
    const volunteer = await storage.getVolunteerByQrHash(qr_hash);
    if (volunteer) {
      return res.json({
        success: true,
        type: "volunteer",
        name: volunteer.firstName,
        scanType: volunteer.isCheckedIn === "true" ? "EXIT" : "ENTRY",
        isCheckedIn: volunteer.isCheckedIn === "true",
      });
    }

    return res.status(404).json({
      success: false,
      message: "QR not linked to any user",
    });

  } catch (err) {
    console.error("SCAN PREVIEW ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Scan preview failed",
    });
  }
});



  // POST /api/scan - Scan a QR code to check in a participant or volunteer
// ================== SCAN CONFIRM ==================
app.post("/api/scan", isAuthenticated, async (req: any, res) => {
  try {
    const parseResult = scanRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid scan request",
      });
    }

    const { qr_hash, scan_type } = parseResult.data;

    // ================= PARTICIPANT =================
    const participant = await storage.getParticipantByQrHash(qr_hash);

    if (participant) {
      const isCheckIn = scan_type === "ENTRY";

      await storage.updateParticipantCheckIn(
        participant.id,
        isCheckIn
      );

      const userId = (req.session as any).userId ?? "scanner";

      await storage.createScanLog({
        participantId: participant.id,
        scannedBy: userId,
        scanType: scan_type,
      });

      return res.json({
        success: true,
        type: "participant",
        scanType: scan_type,
        message:
          scan_type === "ENTRY"
            ? `Checked in ${participant.name}`
            : `Checked out ${participant.name}`,
        participant: {
          id: participant.id,
          name: participant.name,
          team: participant.team,
          lab: participant.lab,
          isCheckedIn: isCheckIn,
        },
      });
    }

    // ================= VOLUNTEER =================
    const volunteer = await storage.getVolunteerByQrHash(qr_hash);

    if (volunteer) {
      const isCurrentlyCheckedIn = volunteer.isCheckedIn === "true";
      const isCheckIn = scan_type === "ENTRY";

      if (isCheckIn && isCurrentlyCheckedIn) {
        return res.status(400).json({
          success: false,
          message: "Volunteer already checked in",
        });
      }

      if (!isCheckIn && !isCurrentlyCheckedIn) {
        return res.status(400).json({
          success: false,
          message: "Volunteer already checked out",
        });
      }

      const updated = await storage.updateVolunteerCheckIn(
        volunteer.id,
        isCheckIn
      );

      return res.json({
        success: true,
        type: "volunteer",
        scanType: scan_type,
        message:
          scan_type === "ENTRY"
            ? `Checked in volunteer ${updated!.firstName}`
            : `Checked out volunteer ${updated!.firstName}`,
        volunteer: {
          id: updated!.id,
          firstName: updated!.firstName,
          lastName: updated!.lastName,
          isCheckedIn: isCheckIn,
        },
      });
    }

    // ================= NOT FOUND =================
    return res.status(404).json({
      success: false,
      message: "QR not recognized",
    });

  } catch (err) {
    console.error("SCAN CONFIRM ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Scan failed",
    });
  }
});



  return httpServer;
}
