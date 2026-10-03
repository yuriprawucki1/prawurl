import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";

describe("toolchain obligations", () => {
  it("production assets exist", () => {
    expect(existsSync("dist/index.html")).toBe(true);
    const html = readFileSync("dist/index.html", "utf8");
    const referenced = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map((match) => match[1]);
    expect(referenced.length).toBeGreaterThanOrEqual(2);
    for (const path of referenced) expect(existsSync(`dist${path}`)).toBe(true);
    expect(readdirSync("dist/assets").some((file) => file.endsWith(".css"))).toBe(true);
    expect(readdirSync("dist/assets").some((file) => file.endsWith(".js"))).toBe(true);
  });

  it.each(["deploy.yml", "deploy-staging.yml"])("CI gates precede deployment %s", (file) => {
    const workflow = readFileSync(`.github/workflows/${file}`, "utf8");
    const firstPublish = workflow.search(/run:.*(?:deploy:|migrations apply)/);
    expect(firstPublish).toBeGreaterThan(0);
    for (const command of ["npm ci", "npm run lint", "npm test", "npm run build", "npm run build:workers", "npm run test:visual", "npm run test:e2e"]) {
      const offset = workflow.indexOf(command);
      expect(offset, command).toBeGreaterThan(0);
      expect(offset, command).toBeLessThan(firstPublish);
    }
    expect(workflow).toContain("actions/checkout@v7.0.1");
    expect(workflow).toContain("actions/setup-node@v7.0.0");
    expect(workflow).toContain("playwright install --with-deps chromium");
    expect(workflow).toContain("xvfb-run -a npm run test:visual");
    expect(workflow).toContain("xvfb-run -a npm run test:e2e");
  });
});
