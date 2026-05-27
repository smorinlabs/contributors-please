import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

export async function checkActionOutputs(actionRepoPath) {
  if (!actionRepoPath) {
    throw new Error("Usage: node scripts/check-action-outputs.mjs <action-repo>");
  }

  const action = parseYaml(
    await readFile(join(actionRepoPath, "action.yml"), "utf8")
  );
  const declared = Object.keys(action?.outputs ?? {});
  const sources = await sourceFiles(join(actionRepoPath, "src"));
  const emitted = uniqueSorted(
    (
      await Promise.all(
        sources.map(async file =>
          outputCalls(await readFile(file, "utf8"))
        )
      )
    ).flat()
  );

  const declaredSorted = uniqueSorted(declared);
  const missing = emitted.filter(output => !declaredSorted.includes(output));
  const stale = declaredSorted.filter(output => !emitted.includes(output));
  if (missing.length || stale.length) {
    throw new Error(
      [
        "action.yml outputs do not match core.setOutput calls.",
        `Missing declarations: ${missing.join(", ") || "none"}.`,
        `Stale declarations: ${stale.join(", ") || "none"}.`,
      ].join(" ")
    );
  }

  return {
    declared,
    emitted,
  };
}

function outputCalls(source) {
  return [...source.matchAll(/setOutput\("([^"]+)"/g)].map(match => match[1]);
}

async function sourceFiles(root) {
  const entries = await readdir(root);
  const files = await Promise.all(
    entries.map(async entry => {
      const path = join(root, entry);
      const info = await stat(path);
      if (info.isDirectory()) {
        return sourceFiles(path);
      }
      return path.endsWith(".ts") ? [path] : [];
    })
  );
  return files.flat().sort();
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await checkActionOutputs(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
