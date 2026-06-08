// Single source of truth for the package version: package.json.
// release-please bumps package.json; ncc bundles the resolved literal
// into dist/lib.js + dist/cli.js at build time.
import pkg from "../package.json" with { type: "json" };

export const VERSION: string = pkg.version;
