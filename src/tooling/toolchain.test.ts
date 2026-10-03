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
    const validation = readFileSync(".github/workflows/validate.yml", "utf8");
    expect(workflow).toMatch(/validate:[\s\S]*uses: \.\/\.github\/workflows\/validate\.yml/);
    expect(workflow).toMatch(/deploy:[\s\S]*needs: validate/);
    expect(workflow).toContain("Baixar frontend aprovado na validação");
    const commands = ["npm ci", "npm run lint", "npm run build", "npm test", "npm run build:workers", "npm run test:visual", "npm run test:e2e"];
    let previous = -1;
    for (const command of commands) {
      const offset = validation.indexOf(command);
      expect(offset, command).toBeGreaterThan(previous);
      previous = offset;
    }
    expect(validation).toMatch(/actions\/checkout@[a-f0-9]{40} # v4/);
    expect(validation).toMatch(/actions\/setup-node@[a-f0-9]{40} # v4/);
    expect(validation).toContain("playwright install --with-deps chromium");
    expect(validation).toContain("run: xvfb-run -a npm run test:visual");
    expect(validation).toContain("run: xvfb-run -a npm run test:e2e");
    expect(validation.indexOf("Guardar frontend validado")).toBeGreaterThan(previous);
  });
});
