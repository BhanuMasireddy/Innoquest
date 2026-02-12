import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  try {
    // 1. Initialize Auth
    await setupAuth(app);
    
    // 2. Register Routes (This is where your DB connection is verified)
    // Wrap in a timeout or specific try-catch if seedAdminUser is slow
    await registerRoutes(httpServer, app);
    
    console.log("Successfully connected to database and registered routes.");

    // 3. Error Handling Middleware
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      console.error("Server Error:", err);
      if (res.headersSent) return next(err);
      res.status(status).json({ message });
    });

    // 4. Development vs Production Setup
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // 5. Start Server
    const PORT = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server listening on port ${PORT}`);
    });

  } catch (error: any) {
    console.error("FATAL: Server failed to start!");
    
    if (error.code === 'ENOTFOUND') {
      console.error("NETWORK ERROR: Could not resolve database hostname.");
      console.error("TIP: Use the IPv4 Connection Pooler string from Supabase (Port 6543).");
    } else {
      console.error(error);
    }
    
    process.exit(1); // Exit with failure
  }
})();