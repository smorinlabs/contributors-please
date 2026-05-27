import { minimatch } from "minimatch";

import type { CategoryConfig } from "../config.js";
import type {
  ClassificationResult,
  Classifier,
  ClassifierContext,
  ContributorInput,
} from "../classifier.js";

export class PathClassifier implements Classifier {
  readonly requiredData = ["commits", "files"] as const;

  classify(
    contributor: ContributorInput,
    context: ClassifierContext
  ): ClassificationResult {
    const classification = context.config.classification;
    const matched = new Set<string>();

    for (const file of contributor.files) {
      const category = firstMatchingCategory(file, classification.categories);
      matched.add(category?.id ?? classification.default.id);
    }

    const categoryIds = [...matched].sort();
    const combination = classification.combinations.find(rule =>
      rule.when.every(id => matched.has(id))
    );
    if (combination) {
      return {
        categories: categoryIds,
        title: combination.label,
        emoji: combination.emoji,
      };
    }

    if (matched.size === 1) {
      const id = categoryIds[0];
      const category =
        classification.categories.find(candidate => candidate.id === id) ??
        classification.default;
      return {
        categories: categoryIds,
        title: category.label,
        emoji: category.emoji,
      };
    }

    const orderedCategories = [
      ...classification.categories,
      classification.default,
    ].filter(category => matched.has(category.id));

    if (classification.multiCategoryResolution === "combine") {
      return {
        categories: categoryIds,
        title: orderedCategories.map(category => category.label).join(" / "),
        emoji: orderedCategories.find(category => category.emoji)?.emoji,
      };
    }

    const category = orderedCategories[0] ?? classification.default;
    return {
      categories: categoryIds,
      title: category.label,
      emoji: category.emoji,
    };
  }
}

function firstMatchingCategory(
  file: string,
  categories: readonly CategoryConfig[]
): CategoryConfig | undefined {
  return categories.find(category =>
    category.paths.some(pattern =>
      minimatch(file, pattern, { dot: true, matchBase: false })
    )
  );
}

