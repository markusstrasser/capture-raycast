import { useState, useEffect, useCallback } from "react";
import { FileService, CONFIG, WindowService } from "./utils";
import type { CapturedData } from "./utils";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { watch } from "node:fs";
import { CaptureList, type CaptureFile } from "./components/CaptureList";

export default function Command() {
  const [captures, setCaptures] = useState<CaptureFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCaptures = useCallback(async () => {
    setIsLoading(true);
    try {
      // Ensure screenshots directory exists
      await FileService.ensureDirectory(CONFIG.directories.screenshots);

      // Get all image files
      const files = await fs.readdir(CONFIG.directories.screenshots);
      console.debug("All files in directory:", files);

      // Filter out hidden files and directories, match any image extension
      const imageFiles = files.filter(
        (f) =>
          !f.startsWith(".") && // Exclude hidden files/dirs
          /\.(png|gif|mp4|jpg|jpeg|webp|heic)$/i.test(f), // Match any common image format
      );
      console.debug("Filtered image files:", imageFiles);

      if (imageFiles.length === 0) {
        console.debug("No images found in", CONFIG.directories.screenshots);
      }

      const captureFiles: CaptureFile[] = [];
      for (const file of imageFiles) {
        console.debug("Processing file:", file);
        const filePath = path.join(CONFIG.directories.screenshots, file);

        let stats: { mtime: Date };
        try {
          stats = await fs.stat(filePath);
          console.debug("File stats:", { mtime: stats.mtime });
        } catch (error) {
          console.error("Failed to stat file:", file, error);
          continue;
        }

        // Create basic capture data for display
        const context = await WindowService.getActiveAppInfo();
        captureFiles.push({
          path: filePath,
          data: {
            id: file, // Use filename as ID for screenshots
            type: "screenshot",
            timestamp: stats.mtime.toISOString(),
            screenshotPath: `file://${filePath}`,
            selectedText: null,
            activeViewContent: null,
            ...context,
          },
          timestamp: stats.mtime,
        });
      }

      // Sort by timestamp, newest first
      captureFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      console.debug("Sorted captures:", captureFiles);
      setCaptures(captureFiles);
    } catch (error) {
      console.error("Failed to load screenshots:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Watch for file changes in the screenshots directory
  useEffect(() => {
    const watcher = watch(CONFIG.directories.screenshots, (eventType, filename) => {
      if (filename && !filename.startsWith(".")) {
        console.debug("File change detected:", eventType, filename);
        loadCaptures();
      }
    });

    return () => {
      watcher.close();
    };
  }, [loadCaptures]);

  // Initial load
  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  return (
    <CaptureList
      captures={captures}
      isLoading={isLoading}
      onRefresh={loadCaptures}
      onCommentSaved={loadCaptures}
      emptyTitle="No screenshots found"
      emptyDescription={`Make sure your screenshots are saved to ${CONFIG.directories.screenshots}`}
    />
  );
}
