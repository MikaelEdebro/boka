import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import * as rootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter-variable" }),
  Geist_Mono: () => ({ variable: "font-geist-mono-variable" }),
}));

const appDir = new URL(".", import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("dynamic rendering", () => {
  it("keeps cacheComponents and partialPrefetching off", () => {
    expect(nextConfig).not.toHaveProperty("cacheComponents");
    expect(nextConfig).not.toHaveProperty("partialPrefetching");
  });

  it("renders every route per request from the root layout", () => {
    expect(rootLayout.dynamic).toBe("force-dynamic");
  });

  it.each(sourceFiles(appDir).map((path) => [path.slice(appDir.length), path]))(
    "%s has no use cache, connection() or instant export",
    (_name, path) => {
      const source = readFileSync(path, "utf8");
      expect(source).not.toMatch(/["']use cache["']/);
      expect(source).not.toMatch(/\bconnection\(\)/);
      expect(source).not.toMatch(/export const instant\b/);
    },
  );
});
