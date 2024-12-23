import { Database } from "bun:sqlite";
import { config } from "../config/config";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database;

  private constructor() {
    console.log("📁 Database path:", config.DB_PATH);

    // Ensure the directory exists
    const dbDir = dirname(config.DB_PATH);
    if (!existsSync(dbDir)) {
      console.log(`Creating database directory: ${dbDir}`);
      mkdirSync(dbDir, { recursive: true });
    }

    try {
      this.db = new Database(config.DB_PATH, { create: true });
      console.log("✅ Successfully connected to database");
    } catch (error) {
      console.error("❌ Failed to connect to database:", error);
      throw error;
    }

    this.initializeDB();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initializeDB() {
    console.log("🔄 Initializing database tables...");

    try {
      // Latency tests table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS latency_tests (
          timestamp INTEGER NOT NULL,
          endpoint TEXT NOT NULL,
          latency INTEGER NOT NULL,
          status INTEGER,
          success INTEGER NOT NULL,
          UNIQUE(timestamp, endpoint)
        )
      `);

      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_timestamp 
        ON latency_tests(timestamp DESC)
      `);

      // Alert thresholds table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS alert_thresholds (
          endpoint TEXT PRIMARY KEY,
          max_latency INTEGER,
          min_success_rate REAL,
          window_size INTEGER NOT NULL,
          notification_url TEXT
        )
      `);

      console.log("✅ Database tables initialized successfully");

      // Log table info
      const tables = this.db
        .query("SELECT name FROM sqlite_master WHERE type='table'")
        .all();
      console.log(
        "📊 Available tables:",
        tables.map((t: any) => t.name).join(", ")
      );
    } catch (error) {
      console.error("❌ Failed to initialize database tables:", error);
      throw error;
    }
  }

  public prepare(sql: string) {
    return this.db.prepare(sql);
  }

  public close() {
    try {
      this.db.close();
      console.log("✅ Database connection closed successfully");
    } catch (error) {
      console.error("❌ Error closing database connection:", error);
      throw error;
    }
  }
}
