import { List } from "@raycast/api";
import type { CapturedData } from "../utils";

export function CaptureDetail({ data }: { data: CapturedData }) {
  const markdown = `
${data.clipboardText ? `${data.clipboardText}\n\n` : ""}
${data.screenshotPath ? `![Screenshot](${data.screenshotPath})\n` : ""}
`;

  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Timestamp" text={new Date(data.timestamp).toLocaleString()} />
          <List.Item.Detail.Metadata.Separator />

          <List.Item.Detail.Metadata.Label title="Source" text={data.activeAppName || "Unknown"} />
          <List.Item.Detail.Metadata.Label title="Bundle ID" text={data.activeAppBundleId || "None"} />

          {data.activeURL && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Link title="URL" target={data.activeURL} text={data.activeURL} />
            </>
          )}

          {data.comment && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="Comment" text={data.comment} />
            </>
          )}

          {data.browserTabHTML && (
            <>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label title="HTML Preview" text={`${data.browserTabHTML.slice(0, 200)}...`} />
            </>
          )}
        </List.Item.Detail.Metadata>
      }
    />
  );
}
