// @lovable.dev/vite-tanstack-config already includes the core plugins.
// Lovable MCP is disabled on Windows because its routesDir validation
// compares forward-slash and backslash paths incorrectly.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

const isWindows = process.platform === "win32";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: isWindows ? [] : [mcpPlugin()],
  },
});
