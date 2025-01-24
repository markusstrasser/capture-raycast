import { showToast, Toast } from "@raycast/api";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export default async function Command() {
  try {
    const { stdout, stderr } = await execAsync(
      '/opt/homebrew/bin/bun /Users/alien/Documents/MIND/EM/cli.ts s imageAnnotate raycast \'{"id":"test123","image":"/Users/alien/Downloads/test.png","comment":"test comment"}\'',
    );
    console.log("Command output:", stdout);

    if (stderr) {
      console.error("Command stderr:", stderr);
    }

    await showToast({
      style: Toast.Style.Success,
      title: "Successfully added event",
    });
  } catch (error) {
    console.error("Error executing command:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Error executing command",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
