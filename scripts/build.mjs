import { execFile } from "node:child_process";
import { cp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const ncc = require.resolve("@vercel/ncc/dist/ncc/cli.js");
const dist = join(root, "dist");
const cliDist = join(root, ".dist-cli");

await rm(dist, { recursive: true, force: true });
await rm(cliDist, { recursive: true, force: true });

await build("src/lib.ts", dist);
await rename(join(dist, "index.js"), join(dist, "lib.js"));
await stripSourceMapComments(join(dist, "lib.js"));

await build("src/cli.ts", cliDist);
await rename(join(cliDist, "index.js"), join(dist, "cli.js"));
await stripSourceMapComments(join(dist, "cli.js"));
await cp(join(cliDist, "cli.d.ts"), join(dist, "cli.d.ts"));
await rm(cliDist, { recursive: true, force: true });

async function build(entrypoint, outDir) {
  await execFileAsync(process.execPath, [ncc, "build", entrypoint, "-o", outDir], {
    cwd: root,
    stdio: "inherit",
  });
}

async function stripSourceMapComments(path) {
  const contents = await readFile(path, "utf8");
  await writeFile(
    path,
    contents.replace(/^\/\/# sourceMappingURL=.*(?:\r?\n|$)/gm, ""),
    "utf8"
  );
}
