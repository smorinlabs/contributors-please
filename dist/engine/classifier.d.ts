import type { ContributorsConfig } from "./config.js";
export interface ContributorInput {
    login: string;
    commits: number;
    files: string[];
}
export interface ClassifierContext {
    config: ContributorsConfig;
    allContributors?: ContributorInput[];
}
export interface ClassificationResult {
    categories: string[];
    title: string;
    emoji?: string;
}
export interface Classifier {
    readonly requiredData?: readonly ("commits" | "files" | "reviews" | "issues")[];
    classify(contributor: ContributorInput, context: ClassifierContext): ClassificationResult;
}
