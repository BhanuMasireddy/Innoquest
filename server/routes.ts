import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { z } from "zod";

// Validation schemas
const scanRequestSchema = z.object({
  qr_hash: z.string().min(1, "QR hash is required"),
  scan_type: z.enum(["ENTRY"]).default("ENTRY"),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Seed database with sample data
  await storage.seedData();

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

  // GET /api/scans/recent - Get recent scans with participant info
  app.get("/api/scans/recent", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
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
      const userId = req.user?.claims?.sub || "unknown";
      await storage.createScanLog({
        participantId: participant.id,
        scannedBy: userId,
        scanType: scan_type,
      });

      res.json({
        success: true,
        message: `Successfully checked in ${participant.name}`,
        participant: updatedParticipant,
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
