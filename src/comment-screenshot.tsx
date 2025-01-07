import { List, ActionPanel, Action, showToast, Toast } from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import { FileService, CONFIG, WindowService } from "./utils";
import type { CapturedData } from "./utils";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { Stats } from "node:fs";
import * as os from "node:os";
import { CaptureDetail } from "./components/CaptureDetail";
import { CommentForm } from "./components/CommentForm";

const SCREENSHOTS_DIR = path.join(os.homedir(), "Desktop", "Screenshots");

interface CaptureFile {
  path: string;
  metadataPath: string;
  data: CapturedData;
  timestamp: Date;
}

export default function Command() {
  const [captures, setCaptures] = useState<CaptureFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCaptures = useCallback(async () => {
    try {
      // Ensure screenshots directory exists
      await FileService.ensureDirectory(SCREENSHOTS_DIR);

      // Ensure metadata directory exists
      const metadataDir = path.join(SCREENSHOTS_DIR, ".metadata");
      await FileService.ensureDirectory(metadataDir);

      // Get all image files
      const files = await fs.readdir(SCREENSHOTS_DIR);
      console.log("All files in directory:", files);

      // Filter out hidden files and directories, match any image extension
      const imageFiles = files.filter(
        (f) =>
          !f.startsWith(".") && // Exclude hidden files/dirs
          /\.(png|gif|mp4|jpg|jpeg|webp|heic)$/i.test(f), // Match any common image format
      );
      console.log("Filtered image files:", imageFiles);

      if (imageFiles.length === 0) {
        console.log("No images found in", SCREENSHOTS_DIR);
      }

      const captureFiles: CaptureFile[] = [];
      for (const file of imageFiles) {
        console.log("Processing file:", file);
        const filePath = path.join(SCREENSHOTS_DIR, file);
        const metadataPath = path.join(metadataDir, `${file}.json`);

        let stats: fs.Stats;
        try {
          stats = await fs.stat(filePath);
          console.log("File stats:", { size: stats.size, mtime: stats.mtime });
        } catch (error) {
          console.error("Failed to stat file:", file, error);
          continue;
        }

        let data: CapturedData;
        try {
          const content = await fs.readFile(metadataPath, "utf-8");
          data = JSON.parse(content);
        } catch {
          // If no metadata exists, create new metadata
          const { appName, bundleId } = await WindowService.getActiveAppInfo();
          data = {
            timestamp: stats.birthtime.toISOString(),
            screenshotPath: `file://${filePath}`,
            activeAppName: appName,
            activeAppBundleId: bundleId,
            activeURL: null,
            clipboardText: null,
            frontAppName: appName,
            browserTabHTML: null,
          };
          await FileService.saveJSON(metadataPath, data);
        }

        captureFiles.push({
          path: filePath,
          metadataPath,
          data,
          timestamp: new Date(data.timestamp),
        });
      }

      // Sort by timestamp, newest first
      captureFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setCaptures(captureFiles);
    } catch (error) {
      console.error("Failed to load screenshots:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to Load Screenshots",
        message: `Make sure ${SCREENSHOTS_DIR} exists and is accessible`,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  if (captures.length === 0 && !isLoading) {
    return (
      <List>
        <List.EmptyView
          title="No screenshots found"
          description={`Make sure your screenshots are saved to ${SCREENSHOTS_DIR}`}
        />
      </List>
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search screenshots..." isShowingDetail>
      {captures.map((capture) => {
        const date = new Date(capture.data.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateString = date.toLocaleDateString([], { month: "short", day: "numeric" });

        return (
          <List.Item
            key={capture.path}
            icon="🖼️"
            title={path.basename(capture.path)}
            subtitle={capture.data.comment?.slice(0, 50)}
            accessories={[{ text: dateString }, ...(capture.data.comment ? [{ icon: "💭" }] : [])]}
            detail={<CaptureDetail data={capture.data} />}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Add/Edit Comment"
                  target={
                    <CommentForm data={capture.data} filePath={capture.metadataPath} onCommentSaved={loadCaptures} />
                  }
                  shortcut={{ modifiers: ["cmd"], key: "e" }}
                />
                <Action.Open
                  title="Open Screenshot"
                  target={capture.path}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}
