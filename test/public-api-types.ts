import {
  Contributors,
  GitHubClient,
  PathClassifier,
  VERSION,
  mergeState,
  parseTemplate,
  readStateFile,
  render,
  writeStateFile,
} from "../dist/lib.js";
import type {
  CheckResult,
  ClassificationResult,
  Classifier,
  ClassifierContext,
  Contributor,
  ContributorInput,
  ContributorsConfig,
  ContributorsOptions,
  GitHubConfig,
  RenderConfig,
  RenderResult,
  RunResult,
  StateFile,
} from "../dist/lib.js";

const version: string = VERSION;
const githubConfig: GitHubConfig = {
  owner: "smorinlabs",
  repo: "example",
};
declare const githubClient: GitHubClient;
const contributorsOptions: ContributorsOptions = {
  repoPath: ".",
  bootstrap: true,
  dryRun: true,
};
const contributor: Contributor = {
  login: "ada",
  name: "Ada",
  profile: "https://github.com/ada",
  avatar: "https://avatars/ada",
  source: "commit",
  pinned: false,
  categories: ["code"],
  title: "Code Contributor",
  commits: 1,
  first_seen: "2020-01-02",
  last_updated: "2026-05-27",
};
const stateFile: StateFile = [contributor];
const renderConfig: RenderConfig = {
  records: stateFile,
  config: {
    classifier: "path",
    classification: {
      categories: [],
      default: { id: "code", label: "Code Contributor" },
      combinations: [],
      multiCategoryResolution: "priority",
    },
    identityMap: [],
    outputFile: "CONTRIBUTORS.md",
    stateFile: ".contributors.jsonl",
    configFile: ".contributors.yml",
    templatePlaceholder: "<!-- CONTRIBUTORS -->",
    inPlace: false,
    inPlaceMarkerStart: "<!-- contributors-please:start -->",
    inPlaceMarkerEnd: "<!-- contributors-please:end -->",
    entryTemplate: "{{login}}",
    emptyText: "",
    columnsPerRow: 1,
    sort: "contributions",
    minContributions: 1,
    ignore: [],
    unignore: [],
    pinWarnOnStale: true,
  } satisfies ContributorsConfig,
};

const classifier: Classifier = new PathClassifier();
const classification: ClassificationResult = classifier.classify(
  { login: "ada", commits: 1, files: ["src/index.ts"] } satisfies ContributorInput,
  { config: renderConfig.config } satisfies ClassifierContext
);
class ReviewClassifier implements Classifier {
  readonly requiredData = ["reviews"] as const;

  classify(
    _contributor: ContributorInput,
    _context: ClassifierContext
  ): ClassificationResult {
    return { categories: [], title: "Top Reviewer" };
  }
}
const rendered: RenderResult = render(renderConfig);
const runResult: RunResult = {
  changed: false,
  addedLogins: [],
  promotedLogins: [],
  contributorsCount: rendered.count,
  contributorsJson: stateFile,
  proposedStateFile: "",
  proposedOutputFile: rendered.content,
  warnings: [],
};
const checkResult: CheckResult = {
  ...runResult,
  diff: "",
};

void version;
void githubConfig;
void contributorsOptions;
void classification;
void checkResult;
void Contributors.fromConfigFile;
void Contributors.fromConfig(githubClient, {
  ...renderConfig.config,
  classifier: new ReviewClassifier(),
});
void GitHubClient.create;
void mergeState;
void parseTemplate;
void readStateFile;
void writeStateFile;
