import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": new URL("./src", import.meta.url).pathname };
const setupFiles = ["./src/test/setup.ts"];

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "node", environment: "node", setupFiles, include: ["src/**/*.test.ts"] },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: { name: "jsdom", environment: "jsdom", setupFiles, include: ["src/**/*.test.tsx"] },
      },
    ],
  },
});
