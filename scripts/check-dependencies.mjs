import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const json = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const manifest = json("package.json");
const lock = json("package-lock.json");
const snapshot = json(".specs/features/dependency-refresh/versions.json");
const direct = { ...manifest.dependencies, ...manifest.devDependencies };
assert.deepEqual(Object.keys(direct).sort(), Object.keys(snapshot.packages).sort());
assert.equal(Object.keys(direct).length, 22);
for (const [name, expected] of Object.entries(snapshot.packages)) {
  assert.match(expected.version, /^\d+\.\d+\.\d+$/);
  assert.equal(direct[name], `^${expected.version}`, `${name}: manifest differs from registry snapshot`);
  assert.equal(lock.packages[`node_modules/${name}`]?.version, expected.version, `${name}: installed version differs`);
}
for (const name of Object.keys(snapshot.removed)) assert.equal(direct[name], undefined, `${name} should be removed`);
assert.ok(readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8").includes('from "@tailwindcss/vite"'));
assert.equal(manifest.scripts["test:e2e"], "playwright test --config playwright.e2e.config.ts");
console.log(`PASS: all 22 maintained direct dependencies match the registry snapshot (${snapshot.checkedOn}); no prerelease or incompatible pool`);
