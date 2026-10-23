import { compile, optimize } from "@tailwindcss/node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const APP_DIR = resolve(process.cwd(), "src/app");
const DARK_BACKGROUND = "--background: oklch(14.5% 0 0)";

let css: string;

beforeAll(async () => {
  const compiler = await compile(readFileSync(resolve(APP_DIR, "globals.css"), "utf8"), {
    base: APP_DIR,
    onDependency: () => {},
  });
  css = optimize(compiler.build(["dark:bg-input/30"])).code;
});

function ruleBody(selector: string, from = css): string {
  const start = from.indexOf(`${selector} {`);
  expect(start, `no rule for ${selector}`).toBeGreaterThanOrEqual(0);
  return from.slice(start, from.indexOf("}", start));
}

function darkMediaBlock(): string {
  const start = css.indexOf("@media (prefers-color-scheme: dark) {\n  :root");
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start);
}

describe("globals.css themes", () => {
  it("uses light tokens and color-scheme on :root by default", () => {
    const root = ruleBody(":root");
    expect(root).toContain("color-scheme: light");
    expect(root).toContain("--background: oklch(100% 0 0)");
  });

  it('applies dark tokens with data-theme="dark"', () => {
    const dark = ruleBody(':root:where([data-theme="dark"], [data-theme="dark"] *)');
    expect(dark).toContain("color-scheme: dark");
    expect(dark).toContain(DARK_BACKGROUND);
  });

  it('applies dark tokens with data-theme="system" only under a dark media query', () => {
    const systemSelector = ':root:where([data-theme="system"], [data-theme="system"] *)';
    expect(css.indexOf(systemSelector)).toBeGreaterThan(css.indexOf("@media (prefers-color-scheme: dark)"));

    const system = ruleBody(systemSelector, darkMediaBlock());
    expect(system).toContain("color-scheme: dark");
    expect(system).toContain(DARK_BACKGROUND);
  });

  it("drives dark: utilities from data-theme instead of a .dark class", () => {
    expect(css).toContain('.dark\\:bg-input\\/30:where([data-theme="dark"], [data-theme="dark"] *)');
    expect(css).toContain('.dark\\:bg-input\\/30:where([data-theme="system"], [data-theme="system"] *)');
    expect(css).not.toMatch(/\.dark[\s,{]/);
  });
});
