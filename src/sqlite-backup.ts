import sqlite3 from "sqlite3";
import { promisify } from "node:util";
import path from "node:path";
import { CLIConfig } from "./config";
import type { CapturedData } from "./utils";

// SQLite database setup
const dbPath = path.join(CLIConfig.dataFolder, "captures.db");

// Create a new database connection
const db = new sqlite3.Database(dbPath);

// Promisify database operations
const runAsync = promisify(db.run.bind(db));
const allAsync = promisify(db.all.bind(db));
const getAsync = promisify(db.get.bind(db));

// Database schema
const schema = `
CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  content TEXT,
  screenshot_url TEXT,
  page_content TEXT,
  app TEXT,
  bundle_id TEXT,
  url TEXT,
  window_title TEXT,
  page_title TEXT,
  comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_captures_timestamp ON captures(timestamp);
CREATE INDEX IF NOT EXISTS idx_captures_type ON captures(type);
`;

// Initialize database
export async function initDatabase() {
  try {
    await runAsync(schema);
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

// Insert a new capture
export async function insertCapture(data: CapturedData) {
  const sql = `
    INSERT INTO captures (
      id, type, timestamp, content, screenshot_url, page_content,
      app, bundle_id, url, window_title, page_title, comment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    data.id,
    data.type,
    data.timestamp,
    data.content,
    data.screenshotUrl,
    data.pageContent,
    data.app,
    data.bundleId,
    data.url,
    data.windowTitle,
    data.pageTitle,
    data.comment,
  ];

  try {
    await runAsync(sql, params);
    console.log("Capture inserted successfully");
  } catch (error) {
    console.error("Failed to insert capture:", error);
    throw error;
  }
}

// Get all captures
export async function getAllCaptures(): Promise<CapturedData[]> {
  const sql = "SELECT * FROM captures ORDER BY timestamp DESC";
  try {
    return await allAsync(sql);
  } catch (error) {
    console.error("Failed to get captures:", error);
    throw error;
  }
}

// Get capture by ID
export async function getCaptureById(id: string): Promise<CapturedData | undefined> {
  const sql = "SELECT * FROM captures WHERE id = ?";
  try {
    return await getAsync(sql, [id]);
  } catch (error) {
    console.error("Failed to get capture:", error);
    throw error;
  }
}

// Update capture comment
export async function updateCaptureComment(id: string, comment: string) {
  const sql = "UPDATE captures SET comment = ? WHERE id = ?";
  try {
    await runAsync(sql, [comment, id]);
    console.log("Comment updated successfully");
  } catch (error) {
    console.error("Failed to update comment:", error);
    throw error;
  }
}

// Close database connection
export function closeDatabase() {
  db.close((err: Error | null) => {
    if (err) {
      console.error("Error closing database:", err);
    } else {
      console.log("Database connection closed");
    }
  });
}
