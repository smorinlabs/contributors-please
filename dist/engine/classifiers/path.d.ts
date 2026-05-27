import type { ClassificationResult, Classifier, ClassifierContext, ContributorInput } from "../classifier.js";
export declare class PathClassifier implements Classifier {
    readonly requiredData: readonly ["commits", "files"];
    classify(contributor: ContributorInput, context: ClassifierContext): ClassificationResult;
}
