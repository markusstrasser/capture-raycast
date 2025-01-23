import { Form, ActionPanel, Action, Clipboard, useNavigation } from "@raycast/api";
import { createCapture, utils, CONFIG } from "./utils";
import { useState, useEffect } from "react";

interface FormValues {
  comment: string;
}

interface CaptureData {
  selectedText: string | null;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);
  const [captureData, setCaptureData] = useState<CaptureData | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    async function initialize() {
      try {
        const clipboardText = await Clipboard.readText();
        console.debug("Got clipboard text:", clipboardText);

        if (!clipboardText) {
          throw new Error("No text in clipboard");
        }

        setCaptureData({
          selectedText: clipboardText,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize capture");
      } finally {
        setIsLoading(false);
      }
    }

    initialize();
  }, []);

  if (error) {
    return (
      <Form>
        <Form.Description text={`Error: ${error}`} />
      </Form>
    );
  }

  if (isLoading || !captureData) {
    return <Form isLoading={true} />;
  }

  return <CommentForm captureData={captureData} />;
}

function CommentForm({ captureData }: { captureData: CaptureData }) {
  const { pop } = useNavigation();
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(values: FormValues) {
    try {
      await createCapture(
        "clipboard",
        async () => {
          const timestamp = new Date().toISOString();
          console.debug("Capturing with timestamp:", timestamp);

          const screenshotPath = await utils.captureScreenshot(
            CONFIG.directories.captures,
            utils.sanitizeTimestamp(timestamp),
          );
          console.debug("Got screenshot path:", screenshotPath);

          return {
            content: captureData.selectedText,
            screenshotUrl: screenshotPath ? utils.getFileUrl(screenshotPath) : null,
            comment: values.comment,
          };
        },
        (data) => (data.content ? true : "No text in clipboard"),
      );
      pop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save capture");
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Capture" onSubmit={handleSubmit} />
        </ActionPanel>
      }
      navigationTitle="Add Comment"
    >
      {error && <Form.Description text={error} />}
      <Form.TextArea
        id="comment"
        title="Comment"
        placeholder="Add a comment to your capture..."
        enableMarkdown
        autoFocus
      />
    </Form>
  );
}
