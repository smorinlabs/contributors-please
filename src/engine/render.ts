import type { ContributorsConfig } from "./config.js";
import type { Contributor } from "./state.js";

export interface RenderConfig {
  records: readonly Contributor[];
  config: ContributorsConfig;
  templateContent?: string;
  existingContent?: string;
}

export interface RenderResult {
  content: string;
  count: number;
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

export function render(options: RenderConfig): RenderResult {
  const block = renderBlock(options.records, options.config);
  const content = wrapBlock(block, options);
  return {
    content,
    count: options.records.length,
  };
}

export function parseTemplate(template: string, record: Contributor): string {
  const values: Record<string, string> = {
    login: record.login,
    name: record.name,
    avatar: record.avatar,
    profile: record.profile,
    title: record.title,
    commits: String(record.commits),
    emoji: record.emoji ?? "",
  };

  return template.replace(/\{\{([a-z_]+)\}\}/g, (match, key: string) => {
    return values[key] ?? match;
  });
}

function renderBlock(
  records: readonly Contributor[],
  config: ContributorsConfig
): string {
  if (records.length === 0) {
    return config.emptyText ? `${config.emptyText}\n` : "";
  }

  const entries = records.map(record => parseTemplate(config.entryTemplate, record));
  const rows: string[] = [];
  for (let index = 0; index < entries.length; index += config.columnsPerRow) {
    rows.push(entries.slice(index, index + config.columnsPerRow).join(" "));
  }
  return `${rows.join("\n")}\n`;
}

function wrapBlock(block: string, options: RenderConfig): string {
  const config = options.config;
  if (config.templateFile) {
    if (options.templateContent === undefined) {
      throw new RenderError(`template-file ${config.templateFile} was not provided`);
    }
    return replaceSingle(
      options.templateContent,
      config.templatePlaceholder,
      block.trimEnd()
    );
  }

  if (config.inPlace) {
    if (options.existingContent === undefined) {
      throw new RenderError("in-place output content was not provided");
    }
    return replaceInPlace(
      options.existingContent,
      config.inPlaceMarkerStart,
      config.inPlaceMarkerEnd,
      block
    );
  }

  if (config.header || config.footer) {
    return [config.header, block.trimEnd(), config.footer]
      .filter(part => part !== undefined && part !== "")
      .join("\n\n")
      .concat("\n");
  }

  return block;
}

function replaceSingle(content: string, marker: string, replacement: string): string {
  const count = countOccurrences(content, marker);
  if (count !== 1) {
    throw new RenderError(
      `template-file must contain exactly one placeholder ${marker}`
    );
  }
  return content.replace(marker, replacement);
}

function replaceInPlace(
  content: string,
  startMarker: string,
  endMarker: string,
  block: string
): string {
  const startCount = countOccurrences(content, startMarker);
  const endCount = countOccurrences(content, endMarker);
  if (startCount !== 1 || endCount !== 1) {
    throw new RenderError("in-place output is missing marker or has duplicates");
  }

  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (end < start) {
    throw new RenderError("in-place output end marker appears before start marker");
  }

  const prefix = content.slice(0, start + startMarker.length);
  const suffix = content.slice(end);
  return `${prefix}\n${block}${suffix}`;
}

function countOccurrences(content: string, marker: string): number {
  return content.split(marker).length - 1;
}

