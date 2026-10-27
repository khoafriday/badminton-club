import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// "@/..." as in tsconfig.json, so server actions under app/ can be tested too.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
