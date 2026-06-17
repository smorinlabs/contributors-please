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
    warnings: string[];
}
export declare class RenderError extends Error {
    constructor(message: string);
}
export declare function render(options: RenderConfig): RenderResult;
export declare function columnsPerRowWarnings(config: ContributorsConfig): string[];
export declare function parseTemplate(template: string, record: Contributor): string;
