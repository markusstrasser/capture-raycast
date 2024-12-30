import { showToast, Toast, ActionPanel, Action, List } from "@raycast/api";
import { captureContext, FileService, CONFIG } from "./utils";
import type { CapturedData } from "./utils";
import * as path from "node:path";
import { useState, useLayoutEffect } from "react";

// Preview Component
function PreviewMetadata({ data }: { data: CapturedData }) {
  const markdown = `
# Captured Context

${data.clipboardText ? `**Clipboard Content:**\n${data.clipboardText}\n` : ""}
${data.activeAppName ? `**Active App:** ${data.activeAppName}\n` : ""}
${data.activeURL ? `**Active URL:** ${data.activeURL}\n` : ""}
**Timestamp:** ${new Date(data.timestamp).toLocaleString()}
${data.screenshotPath ? `\n![Screenshot](${data.screenshotPath})\n` : ""}
${data.browserTabHTML ? `\n**Browser Tab HTML Preview:**\n\`\`\`html\n${data.browserTabHTML.slice(0, 500)}...\n\`\`\`\n` : ""}
`;

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Application" text={data.activeAppName || "None"} />
          {data.activeURL && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Link title="URL" target={data.activeURL} text={data.activeURL} />
            </>
          )}
          {data.screenshotPath && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Screenshot" text="✓ Captured" />
            </>
          )}
          {data.browserTabHTML && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="HTML Content" text="✓ Captured" />
            </>
          )}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label title="Bundle ID" text={data.activeAppBundleId || "None"} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

// Main Component
export default function Command() {
  const [capturedData, setCapturedData] = useState<CapturedData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useLayoutEffect(() => {
    const handleCapture = async () => {
      try {
        const data = await captureContext();
        setCapturedData(data);
      } catch (error) {
        console.error("Capture failed:", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Capture Failed",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    };

    handleCapture();
  }, []);

  const handleSave = async () => {
    if (!capturedData) return;

    const jsonPath = FileService.getTimestampedPath(CONFIG.saveDir, "context-data", "json");
    await FileService.saveJSON(jsonPath, capturedData);
    await showToast({
      style: Toast.Style.Success,
      title: "Context Captured",
      message: `Saved to ${path.basename(jsonPath)}`,
    });
  };

  if (isLoading) {
    return <List isLoading={true} />;
  }

  return (
    <List
      isShowingDetail
      searchBarPlaceholder="Captured context will appear here..."
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Context" onSubmit={handleSave} shortcut={{ modifiers: ["cmd"], key: "s" }} />
          <Action
            title="Refresh Capture"
            onAction={async () => {
              setIsLoading(true);
              try {
                const data = await captureContext();
                setCapturedData(data);
              } catch (error) {
                console.error("Capture failed:", error);
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Capture Failed",
                  message: String(error),
                });
              } finally {
                setIsLoading(false);
              }
            }}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
        </ActionPanel>
      }
    >
      <List.Item
        title="Current Context"
        detail={capturedData ? <PreviewMetadata data={capturedData} /> : null}
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Save Context" onSubmit={handleSave} shortcut={{ modifiers: ["cmd"], key: "s" }} />
            <Action
              title="Refresh Capture"
              onAction={async () => {
                setIsLoading(true);
                try {
                  const data = await captureContext();
                  setCapturedData(data);
                } catch (error) {
                  console.error("Capture failed:", error);
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Capture Failed",
                    message: String(error),
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
