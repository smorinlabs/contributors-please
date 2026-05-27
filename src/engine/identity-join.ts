import type { ContributorsConfig } from "./config.js";
import type { GitContribution } from "./git.js";

export interface ApiContributor {
  login: string;
  name?: string;
  avatar?: string;
  profile?: string;
  commits?: number;
}

export interface JoinedContributor extends ApiContributor {
  name: string;
  avatar: string;
  profile: string;
  commits: number;
  first_seen: string;
  files: string[];
}

export interface JoinIdentitiesOptions {
  apiContributors: readonly ApiContributor[];
  gitContributions: readonly GitContribution[];
  mailmap?: ReadonlyMap<string, string>;
  config: ContributorsConfig;
  serverUrl: string;
}

export interface JoinIdentitiesResult {
  records: JoinedContributor[];
  unjoined: { name: string; email: string }[];
}

export function joinIdentities(
  options: JoinIdentitiesOptions
): JoinIdentitiesResult {
  const apiByLogin = new Map(
    options.apiContributors.map(contributor => [contributor.login, contributor])
  );
  const configuredNoReplyDomain =
    options.config.noReplyDomain ?? deriveNoReplyDomain(options.serverUrl);
  const identityMap = buildIdentityMap(options.config);
  const recordsByLogin = new Map<string, JoinedContributor>();
  const unjoined: { name: string; email: string }[] = [];

  for (const contribution of options.gitContributions) {
    const mailmapEmail = options.mailmap?.get(contribution.email);
    const login =
      loginFromNoReply(contribution.email, configuredNoReplyDomain) ??
      (mailmapEmail
        ? loginFromNoReply(mailmapEmail, configuredNoReplyDomain)
        : undefined) ??
      identityMap.get(contribution.email) ??
      (mailmapEmail ? identityMap.get(mailmapEmail) : undefined);
    const api = login ? apiByLogin.get(login) : undefined;
    if (!login || !api) {
      unjoined.push({ name: contribution.name, email: contribution.email });
      continue;
    }

    const next: JoinedContributor = {
      login,
      name: api.name ?? contribution.name,
      avatar: api.avatar ?? "",
      profile: api.profile ?? `${options.serverUrl.replace(/\/$/, "")}/${login}`,
      commits: contribution.commits,
      first_seen: contribution.first_seen,
      files: contribution.files,
    };
    const existing = recordsByLogin.get(login);
    if (existing) {
      existing.commits += next.commits;
      existing.first_seen =
        next.first_seen < existing.first_seen ? next.first_seen : existing.first_seen;
      existing.files = [...new Set([...existing.files, ...next.files])].sort();
    } else {
      recordsByLogin.set(login, {
        ...next,
        files: [...next.files].sort(),
      });
    }
  }

  return {
    records: [...recordsByLogin.values()].sort((left, right) =>
      left.login.localeCompare(right.login)
    ),
    unjoined,
  };
}

function deriveNoReplyDomain(serverUrl: string): string {
  const host = new URL(serverUrl).host;
  return host === "github.com" ? "users.noreply.github.com" : `users.noreply.${host}`;
}

function loginFromNoReply(
  email: string,
  noReplyDomain: string
): string | undefined {
  const suffix = `@${noReplyDomain}`;
  if (!email.endsWith(suffix)) {
    return undefined;
  }
  const local = email.slice(0, -suffix.length);
  const plus = local.indexOf("+");
  return plus >= 0 ? local.slice(plus + 1) : local;
}

function buildIdentityMap(config: ContributorsConfig): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of config.identityMap) {
    for (const email of entry.emails) {
      map.set(email, entry.login);
    }
  }
  return map;
}

export function parseMailmap(text: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!text) {
    return map;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const emails = [...trimmed.matchAll(/<([^>]+)>/g)].map(match => match[1]);
    if (emails.length >= 2) {
      map.set(emails[emails.length - 1], emails[0]);
    }
  }

  return map;
}
