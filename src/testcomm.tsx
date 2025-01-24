import { showToast, Toast } from "@raycast/api";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { CLIConfig } from "./config";

const execAsync = promisify(exec);

export default async function Command() {
  try {
    // Example: Store a test event
    const eventData = {
      type: "imageAnnotate",
      source: "raycast",
      image: "test.png",
      comment: "test comment",
      timestamp: new Date().toISOString(),
      app: "Test App",
    };

    const cmd = `${CLIConfig.bunExecutable} ${CLIConfig.cli.path} store '${JSON.stringify(eventData)}'`;
    console.log("Executing command:", cmd);

    const { stdout, stderr } = await execAsync(cmd);
    console.log("Command output:", stdout);

    if (stderr) {
      console.error("Command stderr:", stderr);
    }

    await showToast({
      style: Toast.Style.Success,
      title: "Successfully stored test event",
    });
  } catch (error) {
    console.error("Error executing command:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Error storing test event",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
