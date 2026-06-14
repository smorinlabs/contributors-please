# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases are managed by [release-please](https://github.com/googleapis/release-please) from conventional commits on `main`.

## [1.3.0](https://github.com/smorinlabs/contributors-please/compare/v1.2.0...v1.3.0) (2026-06-14)


### Features

* **ci:** notify contributors-please-action on release via repository dispatch ([#21](https://github.com/smorinlabs/contributors-please/issues/21)) ([dc01070](https://github.com/smorinlabs/contributors-please/commit/dc01070d2564a881551e87d0bee4a33fa449f4cc))


### CI/CD

* **release:** add workflow_dispatch trigger for manual re-runs ([#19](https://github.com/smorinlabs/contributors-please/issues/19)) ([4dd9ab1](https://github.com/smorinlabs/contributors-please/commit/4dd9ab14531fb0b42c44e7faf6a2e80eac067952))

## [1.2.0](https://github.com/smorinlabs/contributors-please/compare/v1.1.1...v1.2.0) (2026-06-12)


### Features

* mode-aware [skip ci] defaults and explicit skipCi option ([#17](https://github.com/smorinlabs/contributors-please/issues/17)) ([bafb6ed](https://github.com/smorinlabs/contributors-please/commit/bafb6ed3770df748719771ede83dc660766d603f))

## [1.1.1](https://github.com/smorinlabs/contributors-please/compare/v1.1.0...v1.1.1) (2026-06-08)


### Bug Fixes

* **test:** cover parseMailmap comment, blank, malformed, and CRLF lines ([#14](https://github.com/smorinlabs/contributors-please/issues/14)) ([3f58d9e](https://github.com/smorinlabs/contributors-please/commit/3f58d9e6f32b946fe7f9a7de286ac56ec412ce10))


### Refactoring

* **version:** derive VERSION from package.json (single source of truth) ([#12](https://github.com/smorinlabs/contributors-please/issues/12)) ([6457823](https://github.com/smorinlabs/contributors-please/commit/645782362e8111aa4c4bb9212bc8efb4a3d82269))


### CI/CD

* add sync-dist job to release-please workflow ([#10](https://github.com/smorinlabs/contributors-please/issues/10)) ([d3e0906](https://github.com/smorinlabs/contributors-please/commit/d3e09068ed6df130518dfa72eb9788291b9f00c1))

## [1.1.0](https://github.com/smorinlabs/contributors-please/compare/v1.0.2...v1.1.0) (2026-06-08)


### Features

* **ci:** add release-please for automated version bumps + GitHub Releases ([#8](https://github.com/smorinlabs/contributors-please/issues/8)) ([85041b2](https://github.com/smorinlabs/contributors-please/commit/85041b20838d958944b44d9ed537edcf8973e2d4))

## 1.0.2

- Baseline entry: v1.0.2 is the last manually-cut release and is the version release-please takes over from. Prior releases (v0.0.1, v1.0.0, v1.0.1) were cut manually via `chore(release): X.Y.Z` commits; see git tags and the npm registry for history. Future entries are managed by release-please from conventional commits on `main`.
