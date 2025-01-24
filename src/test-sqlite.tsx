import { showToast, Toast } from "@raycast/api";
import { initDatabase, insertCapture, getAllCaptures, closeDatabase } from "./sqlite-backup";
import type { CapturedData } from "./utils";

export default async function Command() {
  try {
    // Initialize database
    await initDatabase();

    // Create a test capture
    const testCapture: CapturedData = {
      id: `test-${Date.now()}`,
      type: "clipboard",
      timestamp: new Date().toISOString(),
      content: "Test content",
      screenshotUrl: null,
      pageContent: null,
      app: "Test App",
      bundleId: "test.bundle",
      url: null,
      windowTitle: "Test Window",
      pageTitle: null,
      comment: "Test comment",
    };

    // Insert test capture
    await insertCapture(testCapture);

    // Get all captures
    const captures = await getAllCaptures();
    console.log("Retrieved captures:", captures);

    await showToast({
      style: Toast.Style.Success,
      title: "SQLite test successful",
      message: `Found ${captures.length} captures`,
    });

    // Close database connection
    closeDatabase();
  } catch (error) {
    console.error("SQLite test failed:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "SQLite test failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
