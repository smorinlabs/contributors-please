import { readFile, writeFile } from "node:fs/promises";
import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import stateSchema from "../../schemas/state.schema.json" with { type: "json" };

export type ContributorSource = "commit" | "declared";

export interface Contributor {
  login: string;
  name: string;
  profile: string;
  avatar: string;
  source: ContributorSource;
  pinned: boolean;
  categories: string[];
  title: string;
  emoji?: string;
  commits: number;
  first_seen: string;
  last_updated: string;
}

export type StateFile = Contributor[];

export type DiscoveredContributor = Omit<
  Contributor,
  "first_seen" | "last_updated" | "pinned"
> &
  Partial<Pick<Contributor, "first_seen" | "last_updated" | "pinned">>;

export interface MergeStateOptions {
  today?: string;
}

export class StateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StateValidationError";
  }
}

export async function readStateFile(path: string): Promise<Contributor[]> {
  const text = await readFile(path, "utf8");
  return parseState(text);
}

export async function writeStateFile(
  path: string,
  records: readonly Contributor[]
): Promise<void> {
  await writeFile(path, serializeState(records), "utf8");
}

export function parseState(text: string): Contributor[] {
  const records: Contributor[] = [];
  const validate = stateRecordValidator();
  let lineNumber = 0;

  for (const line of text.split(/\r?\n/)) {
    lineNumber += 1;
    if (line.trim().length === 0) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new StateValidationError(
        `Invalid state file line ${lineNumber}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const record = normalizeParsedRecord(parsed);
    if (!validate(record)) {
      throw new StateValidationError(
        `Invalid state file line ${lineNumber}: ${formatValidationErrors(
          validate.errors
        )}`
      );
    }
    records.push(record as Contributor);
  }

  return records;
}

export function serializeState(records: readonly Contributor[]): string {
  if (records.length === 0) {
    return "";
  }
  return `${records.map(record => JSON.stringify(record)).join("\n")}\n`;
}

export function mergeState(
  existing: readonly Contributor[],
  discovered: readonly DiscoveredContributor[],
  options: MergeStateOptions = {}
): Contributor[] {
  const today = options.today ?? isoToday();
  const discoveredByLogin = new Map(
    discovered.map(record => [record.login, record])
  );
  const seen = new Set<string>();
  const merged: Contributor[] = [];

  for (const existingRecord of existing) {
    const normalizedExisting = normalizeExistingRecord(existingRecord, today);
    const update = discoveredByLogin.get(existingRecord.login);
    seen.add(existingRecord.login);
    merged.push(
      update
        ? mergeExisting(normalizedExisting, update, today)
        : normalizedExisting
    );
  }

  for (const update of discovered) {
    if (!seen.has(update.login)) {
      merged.push(createNewRecord(update, today));
    }
  }

  return merged.sort((left, right) => left.login.localeCompare(right.login));
}

function normalizeExistingRecord(
  existing: Contributor,
  today: string
): Contributor {
  const next = clone(existing);
  if (next.source === "declared" && !next.first_seen) {
    next.first_seen = today;
    next.last_updated = today;
  }
  return next;
}

function mergeExisting(
  existing: Contributor,
  update: DiscoveredContributor,
  today: string
): Contributor {
  const next = clone(existing);

  setIfChanged(next, "name", update.name);
  setIfChanged(next, "profile", update.profile);
  setIfChanged(next, "avatar", update.avatar);
  setIfChanged(next, "commits", update.commits);

  if (!existing.pinned) {
    setIfChanged(next, "categories", [...update.categories]);
    setIfChanged(next, "title", update.title);
    setIfChanged(next, "emoji", update.emoji);
  }

  if (!sameContributor(existing, next)) {
    next.last_updated = today;
  }

  next.source = existing.source;
  next.pinned = existing.pinned;
  next.first_seen = existing.first_seen;
  return next;
}

function createNewRecord(update: DiscoveredContributor, today: string): Contributor {
  const source = update.source;
  const pinned = update.pinned ?? source === "declared";
  const firstSeen = update.first_seen ?? today;

  return {
    login: update.login,
    name: update.name,
    profile: update.profile,
    avatar: update.avatar,
    source,
    pinned,
    categories: [...update.categories],
    title: update.title,
    emoji: update.emoji,
    commits: update.commits,
    first_seen: firstSeen,
    last_updated: today,
  };
}

function setIfChanged<K extends keyof Contributor>(
  target: Contributor,
  key: K,
  value: Contributor[K]
): void {
  if (!deepEqual(target[key], value)) {
    target[key] = value;
  }
}

function sameContributor(left: Contributor, right: Contributor): boolean {
  return deepEqual(left, right);
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(record: Contributor): Contributor {
  return {
    ...record,
    categories: [...record.categories],
  };
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeParsedRecord(record: unknown): unknown {
  if (
    record &&
    typeof record === "object" &&
    !Array.isArray(record) &&
    (record as Record<string, unknown>).source === "declared" &&
    (record as Record<string, unknown>).commits === undefined
  ) {
    return {
      ...record,
      commits: 0,
    };
  }
  return record;
}

let cachedStateRecordValidator: ValidateFunction | undefined;

function stateRecordValidator(): ValidateFunction {
  cachedStateRecordValidator ??= createStateRecordValidator();
  return cachedStateRecordValidator;
}

function createStateRecordValidator(): ValidateFunction {
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/);
  return ajv.compile(stateSchema as object);
}

function formatValidationErrors(
  errors: ErrorObject[] | null | undefined
): string {
  return (errors ?? [])
    .map(error => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
}
