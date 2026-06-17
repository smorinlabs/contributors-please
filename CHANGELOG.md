# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases are managed by [release-please](https://github.com/googleapis/release-please) from conventional commits on `main`.

## [1.4.2](https://github.com/smorinlabs/contributors-please/compare/v1.4.1...v1.4.2) (2026-06-17)


### CI/CD

* **release:** remove ineffective bootstrap-sha ([#31](https://github.com/smorinlabs/contributors-please/issues/31)) ([fe58484](https://github.com/smorinlabs/contributors-please/commit/fe584842a52b2890e73e4983e2c2d08a54ac1937))

## [1.4.1](https://github.com/smorinlabs/contributors-please/compare/v1.4.0...v1.4.1) (2026-06-17)


### Bug Fixes

* **render:** default columns_per_row to 1 ([#28](https://github.com/smorinlabs/contributors-please/issues/28)) ([162a62e](https://github.com/smorinlabs/contributors-please/commit/162a62e8a7842e4bff6872233378b0cb2d3d211e))

## [1.4.0](https://github.com/smorinlabs/contributors-please/compare/v1.3.1...v1.4.0) (2026-06-17)


### Features

* **ci:** add release-please for automated version bumps + GitHub Releases ([#8](https://github.com/smorinlabs/contributors-please/issues/8)) ([85041b2](https://github.com/smorinlabs/contributors-please/commit/85041b20838d958944b44d9ed537edcf8973e2d4))
* **ci:** notify contributors-please-action on release via repository dispatch ([#21](https://github.com/smorinlabs/contributors-please/issues/21)) ([dc01070](https://github.com/smorinlabs/contributors-please/commit/dc01070d2564a881551e87d0bee4a33fa449f4cc))
* define rendering config fields and reject unknown keys in schema ([#5](https://github.com/smorinlabs/contributors-please/issues/5)) ([fafdc86](https://github.com/smorinlabs/contributors-please/commit/fafdc8673567723160027a68462115cd6441703e))
* implement contributors-please library ([9266961](https://github.com/smorinlabs/contributors-please/commit/9266961bd46e7093aaeb6f030c449e213a9e1ef5))
* mode-aware [skip ci] defaults and explicit skipCi option ([#17](https://github.com/smorinlabs/contributors-please/issues/17)) ([bafb6ed](https://github.com/smorinlabs/contributors-please/commit/bafb6ed3770df748719771ede83dc660766d603f))
* reject unknown/misplaced config keys at load time ([#6](https://github.com/smorinlabs/contributors-please/issues/6)) ([82b3d3d](https://github.com/smorinlabs/contributors-please/commit/82b3d3d567c19fd2e4238be1e4753a41318ea495))
* **render:** warn on unsafe entry_template at columns_per_row &gt; 1 ([#27](https://github.com/smorinlabs/contributors-please/issues/27)) ([cc08680](https://github.com/smorinlabs/contributors-please/commit/cc08680720f50d8d84d00ca565abc8ff6f0c0ad0))


### Bug Fixes

* **ci:** stop release-PR dist gate race-fail; bump setup-node@v4 ([#24](https://github.com/smorinlabs/contributors-please/issues/24)) ([c095cc4](https://github.com/smorinlabs/contributors-please/commit/c095cc43f8a90831a36156876f3e6b11fffc7773))
* preserve action overrides for root package config ([9d9ca7d](https://github.com/smorinlabs/contributors-please/commit/9d9ca7dc79fed51faf23c0eff1a172920ab7333d))
* **test:** cover parseMailmap comment, blank, malformed, and CRLF lines ([#14](https://github.com/smorinlabs/contributors-please/issues/14)) ([3f58d9e](https://github.com/smorinlabs/contributors-please/commit/3f58d9e6f32b946fe7f9a7de286ac56ec412ce10))


### Refactoring

* **version:** derive VERSION from package.json (single source of truth) ([#12](https://github.com/smorinlabs/contributors-please/issues/12)) ([6457823](https://github.com/smorinlabs/contributors-please/commit/645782362e8111aa4c4bb9212bc8efb4a3d82269))


### Documentation

* add README ([fc2dd13](https://github.com/smorinlabs/contributors-please/commit/fc2dd13059b76f83f26d4a115c2145fbec383910))
* document library release credentials ([e764991](https://github.com/smorinlabs/contributors-please/commit/e764991106546e50886885b262a161fae1b04d92))


### CI/CD

* add sync-dist job to release-please workflow ([#10](https://github.com/smorinlabs/contributors-please/issues/10)) ([d3e0906](https://github.com/smorinlabs/contributors-please/commit/d3e09068ed6df130518dfa72eb9788291b9f00c1))
* avoid private action checkout ([63e7c54](https://github.com/smorinlabs/contributors-please/commit/63e7c5475876f106bb66fd29c03a9efe182fd227))
* default release action checkout to main ([84ba2c9](https://github.com/smorinlabs/contributors-please/commit/84ba2c97d8207ff4141f5ec474298493e7593d72))
* harden release dispatch retries ([18ad7f3](https://github.com/smorinlabs/contributors-please/commit/18ad7f34a11f1e6c5f59431dae1c936d5aadf03d))
* probe RELEASE_PLEASE_CLIENT_ID auth path ([4529b8d](https://github.com/smorinlabs/contributors-please/commit/4529b8d1bb4766abe7f093d2b3e27228d932570c))
* publish unscoped package with npm oidc ([944375d](https://github.com/smorinlabs/contributors-please/commit/944375d1b0725dca4085497b3b30dbb829f1b2bf))
* **release:** add workflow_dispatch trigger for manual re-runs ([#19](https://github.com/smorinlabs/contributors-please/issues/19)) ([4dd9ab1](https://github.com/smorinlabs/contributors-please/commit/4dd9ab14531fb0b42c44e7faf6a2e80eac067952))
* **release:** set bootstrap-sha to re-anchor release-please after manual v1.3.1 ([#26](https://github.com/smorinlabs/contributors-please/issues/26)) ([85d4c37](https://github.com/smorinlabs/contributors-please/commit/85d4c373c5db0af75023db2e6bde082f68cddb4a))
* require action dispatch token before publish ([02eb826](https://github.com/smorinlabs/contributors-please/commit/02eb826eebc60bd01d8dde3f29786050ea3417af))
* target action implementation in publish check ([932fd43](https://github.com/smorinlabs/contributors-please/commit/932fd436fa30c6cdab1d597c1a81b733cb2093d1))
* use token for action repo publish checkout ([2c44b4e](https://github.com/smorinlabs/contributors-please/commit/2c44b4ef742c38fd334d9ccf6c1cf886c17c0797))


### Testing

* set committer identity in config-file fixture ([a7f0b63](https://github.com/smorinlabs/contributors-please/commit/a7f0b63168ef464135020264ad264f49e567ab15))
* split core contributors coverage ([801786a](https://github.com/smorinlabs/contributors-please/commit/801786a731f5c10b546271af78f7806417d9abc3))

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
