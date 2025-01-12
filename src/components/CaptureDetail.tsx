import { List } from "@raycast/api";
import type { CapturedData } from "../utils";

interface CaptureDetailProps {
  data: CapturedData;
}

export function CaptureDetail({ data }: CaptureDetailProps) {
  const metadata = [
    { label: "Type", value: data.type },
    { label: "Timestamp", value: new Date(data.timestamp).toLocaleString() },
    { label: "App", value: data.app },
    { label: "Bundle ID", value: data.bundleId },
    { label: "Window", value: data.window },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  const selectedText = data.selectedText?.trim();
  if (selectedText) {
    metadata.push({ label: "Selected Text", value: selectedText });
  }

  if (data.comment) {
    metadata.push({ label: "Comment", value: data.comment });
  }

  const markdown = [data.screenshotPath && `![Screenshot](${data.screenshotPath.replace(/^file:\/\//, "")})`]
    .filter(Boolean)
    .join("\n\n");

  return (
    <List.Item.Detail
      markdown={markdown || undefined}
      metadata={
        <List.Item.Detail.Metadata>
          {metadata.map((item) => (
            <List.Item.Detail.Metadata.Label key={item.label} title={item.label} text={item.value} />
          ))}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
