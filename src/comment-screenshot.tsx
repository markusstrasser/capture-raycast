import { useState, useEffect, useCallback } from "react";
import { files, CONFIG } from "./utils";
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
      await files.ensureDirectory(CONFIG.directories.screenshots);

      // Get all image files
      const allFiles = await fs.readdir(CONFIG.directories.screenshots);
      console.debug("All files in directory:", allFiles);

      // Filter out hidden files and directories, match any image extension
      const imageFiles = allFiles.filter(
        (f) =>
          !f.startsWith(".") && // Exclude hidden files/dirs
          /\.(png|gif|mp4|jpg|jpeg|webp|heic)$/i.test(f), // Match any common image format
      );
      console.debug("Filtered image files:", imageFiles);

      if (imageFiles.length === 0) {
        console.debug("No images found in", CONFIG.directories.screenshots);
      }

      // Get stats for all files in parallel
      const captureFiles = await Promise.all(
        imageFiles.map(async (file) => {
          const filePath = path.join(CONFIG.directories.screenshots, file);
          try {
            const stats = await fs.stat(filePath);
            return {
              path: filePath,
              data: {
                id: file, // Use filename as ID for screenshots
                type: "screenshot" as const,
                timestamp: stats.mtime.toISOString(),
                screenshotPath: `file://${filePath}`,
                selectedText: null,
                activeViewContent: null,
                // Default context values - will be updated when capturing
                app: "Screenshot",
                bundleId: null,
                url: null,
                window: null,
                favicon: null,
                title: null,
              } as CapturedData,
              timestamp: stats.mtime,
            };
          } catch (error) {
            console.error("Failed to stat file:", file, error);
            return null;
          }
        }),
      );

      // Filter out failed loads and sort by timestamp
      const validCaptures = captureFiles
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      console.debug("Sorted captures:", validCaptures);
      setCaptures(validCaptures);
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
