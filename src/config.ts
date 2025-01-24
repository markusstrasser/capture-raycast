export const CLIConfig = {
  root: "/Users/alien/Documents/MIND/EM/",
  bunExecutable: "/opt/homebrew/bin/bun",
  mediaFolder: "/Users/alien/Documents/MIND/EM/media/",
  cli: {
    path: "/Users/alien/Documents/MIND/EM/cli.ts",
  },
} as const;

// Helper to construct CLI commands
export const constructCLICommand = (type: string, source: string, data: Record<string, unknown>) => {
  // Convert the data object into key=value pairs format
  const dataStr = Object.entries(data)
    .map(([key, value]) => {
      // Handle different value types
      const formattedValue = typeof value === "string" ? value : JSON.stringify(value);
      return `${key}=${formattedValue}`;
    })
    .join(" ");

  return `${CLIConfig.bunExecutable} ${CLIConfig.cli.path} s ${type} ${source} ${dataStr}`;
};
