import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import configSchema from "../../schemas/config.schema.json" with { type: "json" };

export type ClassifierName = "path";
export type MultiCategoryResolution = "priority" | "combine";

export interface CategoryConfig {
  id: string;
  label: string;
  emoji?: string;
  paths: string[];
}

export interface DefaultCategoryConfig {
  id: string;
  label: string;
  emoji?: string;
}

export interface CombinationConfig {
  id?: string;
  label: string;
  emoji?: string;
  when: string[];
}

export interface ClassificationConfig {
  categories: CategoryConfig[];
  default: DefaultCategoryConfig;
  combinations: CombinationConfig[];
  multiCategoryResolution: MultiCategoryResolution;
}

export interface ContributorsConfig {
  classifier: ClassifierName;
  classification: ClassificationConfig;
  identityMap: IdentityMapEntry[];
  noReplyDomain?: string;
  outputFile: string;
  stateFile: string;
  configFile: string;
  templateFile?: string;
  templatePlaceholder: string;
  header?: string;
  footer?: string;
  inPlace: boolean;
  inPlaceMarkerStart: string;
  inPlaceMarkerEnd: string;
  entryTemplate: string;
  emptyText: string;
  columnsPerRow: number;
  sort: "contributions" | "alphabetical" | "first-seen";
  minContributions: number;
  ignore: string[];
  unignore: string[];
  pinWarnOnStale: boolean;
}

export interface IdentityMapEntry {
  login: string;
  emails: string[];
}

type RawRecord = Record<string, unknown>;

const DEFAULT_CLASSIFICATION: ClassificationConfig = {
  categories: [
    {
      id: "docs",
      label: "Documentation Super Star",
      emoji: "docs",
      paths: ["docs/**", "config/**"],
    },
    {
      id: "quality",
      label: "Quality Contributor",
      emoji: "test",
      paths: ["tests/**"],
    },
  ],
  default: {
    id: "code",
    label: "Code Contributor",
    emoji: "code",
  },
  combinations: [
    {
      id: "rockstar",
      label: "Rockstar",
      emoji: "star",
      when: ["docs", "quality", "code"],
    },
  ],
  multiCategoryResolution: "priority",
};

const DEFAULT_ENTRY_TEMPLATE =
  "- [{{name}}]({{profile}}) - {{emoji}} {{title}} ({{commits}} commits)";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

let cachedConfigValidator: ValidateFunction | undefined;

// Reject unknown / misplaced config keys at load time. Other shape issues
// (classifier enum, value types, wrapper-mode exclusivity) keep their curated
// messages from the checks below, so we surface only additionalProperties
// violations here.
function validateConfigSchema(record: unknown): void {
  cachedConfigValidator ??= new Ajv2020({ allErrors: true }).compile(
    configSchema as object
  );
  if (cachedConfigValidator(record)) {
    return;
  }
  const unknownKeys = (cachedConfigValidator.errors ?? [])
    .filter((error: ErrorObject) => error.keyword === "additionalProperties")
    .map((error: ErrorObject) => {
      const key = (error.params as { additionalProperty?: string })
        .additionalProperty;
      return `${error.instancePath || ""}/${String(key)}`;
    });
  if (unknownKeys.length > 0) {
    throw new ConfigError(
      `Unknown config key(s): ${unknownKeys.join(", ")}. ` +
        "Remove them or check placement against schemas/config.schema.json."
    );
  }
}

export function normalizeConfig(raw: unknown = {}): ContributorsConfig {
  const record = asRecord(raw);
  validateConfigSchema(record);
  const root = normalizeRootPackage(record);
  const classifier = normalizeClassifier(root.classifier);
  const classification = normalizeClassification(root.classification);

  const config: ContributorsConfig = {
    classifier,
    classification,
    identityMap: normalizeIdentityMap(root.identity_map),
    noReplyDomain: optionalString(root.no_reply_domain),
    outputFile: stringValue(root.output_file, "contributors.md"),
    stateFile: stringValue(root.state_file, ".contributors.jsonl"),
    configFile: stringValue(root.config_file, ".contributors.yml"),
    templateFile: optionalString(root.template_file),
    templatePlaceholder: stringValue(
      root.template_placeholder,
      "<!-- CONTRIBUTORS -->"
    ),
    header: optionalString(root.header),
    footer: optionalString(root.footer),
    inPlace: booleanValue(root.in_place, false),
    inPlaceMarkerStart: stringValue(
      root.in_place_marker_start,
      "<!-- contributors-please:start -->"
    ),
    inPlaceMarkerEnd: stringValue(
      root.in_place_marker_end,
      "<!-- contributors-please:end -->"
    ),
    entryTemplate: stringValue(root.entry_template, DEFAULT_ENTRY_TEMPLATE),
    emptyText: stringValue(root.empty_text, ""),
    columnsPerRow: numberValue(root.columns_per_row, 6),
    sort: normalizeSort(root.sort),
    minContributions: numberValue(root.min_contributions, 1),
    ignore: stringList(root.ignore),
    unignore: stringList(root.unignore),
    pinWarnOnStale: booleanValue(root.pin_warn_on_stale, true),
  };

  validateWrapperMode(config);
  return config;
}

function normalizeRootPackage(record: RawRecord): RawRecord {
  if (!("packages" in record)) {
    return record;
  }

  const packages = asRecord(record.packages);
  for (const key of Object.keys(packages)) {
    if (key !== ".") {
      throw new ConfigError(
        `Per-package configuration (packages."${key}") is reserved for v2 and is not yet supported. Use the flat config form, or packages: { ".": { ... } }, for v1.`
      );
    }
  }

  return asRecord(packages["."] ?? {});
}

function normalizeClassifier(raw: unknown): ClassifierName {
  const classifier = stringValue(raw, "path");
  if (classifier !== "path") {
    throw new ConfigError(
      `Unsupported classifier "${classifier}"; valid values for v1: path`
    );
  }
  return classifier;
}

function normalizeClassification(raw: unknown): ClassificationConfig {
  if (raw === undefined) {
    return cloneClassification(DEFAULT_CLASSIFICATION);
  }

  const record = asRecord(raw);
  return {
    categories: arrayValue(record.categories).map(category => {
      const categoryRecord = asRecord(category);
      return {
        id: requiredString(categoryRecord.id, "classification.categories[].id"),
        label: requiredString(
          categoryRecord.label,
          "classification.categories[].label"
        ),
        emoji: optionalString(categoryRecord.emoji),
        paths: arrayValue(categoryRecord.paths).map(path =>
          requiredString(path, "classification.categories[].paths[]")
        ),
      };
    }),
    default: normalizeDefaultCategory(record.default),
    combinations: arrayValue(record.combinations).map(combination => {
      const combinationRecord = asRecord(combination);
      return {
        id: optionalString(combinationRecord.id),
        label: requiredString(
          combinationRecord.label,
          "classification.combinations[].label"
        ),
        emoji: optionalString(combinationRecord.emoji),
        when: arrayValue(combinationRecord.when).map(id =>
          requiredString(id, "classification.combinations[].when[]")
        ),
      };
    }),
    multiCategoryResolution: normalizeResolution(
      record.multi_category_resolution
    ),
  };
}

function normalizeDefaultCategory(raw: unknown): DefaultCategoryConfig {
  const record = asRecord(raw);
  return {
    id: requiredString(record.id, "classification.default.id"),
    label: requiredString(record.label, "classification.default.label"),
    emoji: optionalString(record.emoji),
  };
}

function normalizeResolution(raw: unknown): MultiCategoryResolution {
  const value = stringValue(raw, "priority");
  if (value !== "priority" && value !== "combine") {
    throw new ConfigError(
      `Unsupported multi_category_resolution "${value}"; valid values: priority, combine`
    );
  }
  return value;
}

function normalizeSort(raw: unknown): ContributorsConfig["sort"] {
  const value = stringValue(raw, "contributions");
  if (
    value !== "contributions" &&
    value !== "alphabetical" &&
    value !== "first-seen"
  ) {
    throw new ConfigError(
      `Unsupported sort "${value}"; valid values: contributions, alphabetical, first-seen`
    );
  }
  return value;
}

function normalizeIdentityMap(raw: unknown): IdentityMapEntry[] {
  return arrayValue(raw).map(entry => {
    const record = asRecord(entry);
    return {
      login: requiredString(record.login, "identity_map[].login"),
      emails: arrayValue(record.emails).map(email =>
        requiredString(email, "identity_map[].emails[]")
      ),
    };
  });
}

function validateWrapperMode(config: ContributorsConfig): void {
  const modes = [
    config.templateFile ? "template-file" : undefined,
    config.header || config.footer ? "header/footer" : undefined,
    config.inPlace ? "in-place" : undefined,
  ].filter(Boolean);

  if (modes.length > 1) {
    throw new ConfigError(
      "Choose at most one contributors wrapper mode: template-file, header/footer, or in-place"
    );
  }
}

function asRecord(raw: unknown): RawRecord {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as RawRecord;
  }
  throw new ConfigError("Expected object configuration");
}

function stringValue(raw: unknown, fallback: string): string {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  return requiredString(raw, "value");
}

function optionalString(raw: unknown): string | undefined {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }
  return requiredString(raw, "value");
}

function requiredString(raw: unknown, name: string): string {
  if (typeof raw !== "string") {
    throw new ConfigError(`${name} must be a string`);
  }
  return raw;
}

function booleanValue(raw: unknown, fallback: boolean): boolean {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  if (typeof raw !== "boolean") {
    throw new ConfigError("Expected boolean value");
  }
  return raw;
}

function numberValue(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new ConfigError("Expected number value");
  }
  return raw;
}

function arrayValue(raw: unknown): unknown[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new ConfigError("Expected array value");
  }
  return raw;
}

function stringList(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === "") {
    return [];
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }
  return arrayValue(raw).map(item => requiredString(item, "list item"));
}

function cloneClassification(
  classification: ClassificationConfig
): ClassificationConfig {
  return {
    categories: classification.categories.map(category => ({
      ...category,
      paths: [...category.paths],
    })),
    default: {...classification.default},
    combinations: classification.combinations.map(combination => ({
      ...combination,
      when: [...combination.when],
    })),
    multiCategoryResolution: classification.multiCategoryResolution,
  };
}

