import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const MESSAGE =
  "Public API declaration drift detected. Update test/fixtures/public-api.d.ts only with an intentional semver decision.";

export async function checkPublicApiSnapshot(actualPath, expectedPath) {
  if (!actualPath || !expectedPath) {
    throw new Error(
      "Usage: node scripts/check-public-api.mjs <actual.d.ts> <expected.d.ts>"
    );
  }

  const actual = normalize(await readFile(actualPath, "utf8"));
  const expected = normalize(await readFile(expectedPath, "utf8"));
  if (actual !== expected) {
    throw new Error(MESSAGE);
  }
}

function normalize(value) {
  return value.replace(/\r\n/g, "\n").trimEnd() + "\n";
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await checkPublicApiSnapshot(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
