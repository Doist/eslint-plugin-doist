# Releasing the scoped plugin

The forward migration release is `@todoist/eslint-plugin-doist@2.0.2` from the
2.0.1 line. Keep the repository/package basename. Versions are maintained in
`package.json` and the lockfile root, with a matching `v<version>` tag; there is
no semantic-release calculation. Recheck both registries for a version collision
before a maintainer creates the next tag. Do not bump again to repair a missing
mirror. Existing packages, releases and tags remain untouched.

This is an M02 leaf producer: `requireindex` is the only runtime dependency,
`eslint >=9` is a peer, and there are no scoped build dependencies or compilation
steps. The same tarball must reach npmjs (public) and GitHub Packages (currently
public; preserve visibility separately from npm's access flag).

## Preparation and merge gates

Migration preparation does not publish, dispatch workflows, create tags, change
settings, or rehearse the cutover. Branch pushes, draft PRs and a main-branch merge
do not invoke this repository's release workflow. After this change, a **new
version tag only packs**; publication requires an explicit dispatch.

Before release, resolve the existing verification debt on the current line:

- The base manifest requires ESLint 9 / eslint-plugin-eslint-plugin 6, but its
  lockfile contains ESLint 8.25.0 / eslint-plugin-eslint-plugin 5.0.6. The migration
  changes only root name/version metadata, so `npm ci --ignore-scripts` is still
  blocked. Repair the development lockfile through a reviewed forward change.
- `npm run lint` uses a legacy `.eslintrc.js`; ESLint 9 defaults to flat config.
- The rule tests use legacy `parserOptions`. Resolve the test harness compatibility
  with ESLint 9 and run the rule tests before approving publication. Direct flat-config
  probes of all three rules (including invalid literal-helper inputs) pass with ESLint
  9.9.0; the older positional `context.report` call still works in that version.

The pack-only route deliberately needs no development install; obtaining an
artifact does **not** prove that the checks or consumer compatibility passed.

## Artifact production (future authorized operator)

The workflow and caller are both `.github/workflows/publish.yml`; no reusable
workflow or environment is involved. Jobs use GitHub-hosted `ubuntu-latest`,
Node 24, and the publishing job pins npm 11.19.0. No shared Doist Actions are used,
so M01 shared-action pins are not a build prerequisite here.

After rename/access and human review, use the normal version-tag process on the
reviewed release commit. The `v2.0.2` push runs `pack`. Alternatively, dispatch
`operation=pack` on the reviewed ref. Neither route publishes. Record the run ID
and full commit SHA. This package has no build; the job executes exactly once:

```sh
node .github/scripts/release.mjs pack "$RUNNER_TEMP/release-artifacts"
```

The `eslint-plugin-doist-release` artifact contains
`todoist-eslint-plugin-doist-2.0.2.tgz`, `release.json` (commit and SHA-256/SHA-512/
SHA-1), and `SHA256SUMS`. It is retained for 90 days, subject to organization
retention limits. Archive these exact files in the approved release store before
expiry. Never rerun the pack job to complete a partial publication. The pack
script refuses an existing output directory.

Download the original successful pack run into a fresh directory, using the real
run ID for `RUN_ID`; keep the repository checked out at that reviewed commit:

```sh
RELEASE_DIR=$(mktemp -d)
gh run download "$RUN_ID" --repo todoist/eslint-plugin-doist \
  --name eslint-plugin-doist-release --dir "$RELEASE_DIR"
node .github/scripts/release.mjs verify "$RELEASE_DIR"
(cd "$RELEASE_DIR" && shasum -a 256 -c SHA256SUMS)
tar -xOf "$RELEASE_DIR/todoist-eslint-plugin-doist-2.0.2.tgz" package/package.json
```

Review the packed identity, dependencies and public classification. The verifier
rejects a private marker or any `publishConfig`, and compares metadata to the
checked-out source. Publication uses a dedicated temporary directory with an
explicit `@todoist` mapping and independent user/global npm config for each
registry. No repository/global routing is inherited.

## First real npm publication

A new npm package must exist before trust can be configured. An authorized
`todoist` npm maintainer bootstraps the **real reviewed tarball**, interactively
with 2FA; no placeholder version. From the downloaded artifact directory, use
isolated config (these are future operator commands, not preparation checks):

```sh
cd "$RELEASE_DIR"
export NPM_CONFIG_USERCONFIG="$RELEASE_DIR/operator-npmrc"
export NPM_CONFIG_GLOBALCONFIG="$RELEASE_DIR/empty-global-npmrc"
printf '' > "$NPM_CONFIG_GLOBALCONFIG"
printf 'registry=https://registry.npmjs.org/\n@todoist:registry=https://registry.npmjs.org/\n' > .npmrc
npm login --registry=https://registry.npmjs.org/
npm publish ./todoist-eslint-plugin-doist-2.0.2.tgz \
  --registry=https://registry.npmjs.org/ --access=public --tag=latest --ignore-scripts
npm view @todoist/eslint-plugin-doist@2.0.2 dist --json --registry=https://registry.npmjs.org/
```

Inspect the shell for pre-existing `npm_config_*` routing overrides before these
commands; the local `.npmrc` must resolve `@todoist` to npmjs. Do not share/archive
the login config; retain only the three artifact files. Local first publication
does not claim CI provenance or validate future OIDC trust.

Then complete the GitHub mirror using that **same original run** (the version tag
must point to the artifact's commit):

```sh
gh workflow run publish.yml --repo todoist/eslint-plugin-doist --ref v2.0.2 \
  -f operation=github -f artifact_run_id="$RUN_ID"
```

GitHub publication uses `GITHUB_TOKEN` with `packages:write`. Check repository
linkage, preserved public visibility, publisher Write access, and specific
consumer Read grants in **Manage Actions access**. Local GitHub npm installs
require appropriate authentication even when the package is public.

## Later trusted releases and retries

Near the next real automated release, configure npm Settings → Trusted publishing:
owner `todoist`, repository `eslint-plugin-doist`, filename `publish.yml`,
environment **blank**. Enable direct `npm publish`. The job grants `id-token:write`
and uses a hosted runner; it adds public npm provenance. No `npm dist-tag` commands
are used, so a separate dist-tag-management grant is not required. A manual first
release does not validate this connection. Record it as configured/unverified
until the next real publish succeeds; new connections expire after two days
without a successful publication.

For a later stable release, update the manifest/root lock versions through review,
create its matching tag, retain the pack result, then dispatch `operation=both`
on that tag with the original `artifact_run_id`. For a partial release, choose
`npm` or `github` for the missing destination. The script verifies the source run,
commit, package identity and digest before publishing. If the exact version
already exists it must have matching integrity (or matching SHA-1 where the
registry does not return integrity); a mismatch stops the job. Authentication or
other read errors stop the job; only E404 permits a publication attempt. A skipped
existing version does not move its dist-tags. Before a missing-version publish,
the job refuses to move an existing newer `latest` backwards; a non-stable `latest`
also requires a maintainer decision. In those cases, retain the same artifact and
complete the mirror with a separately reviewed recovery dist-tag, preserving the
newer `latest`. Do not create a new version to bypass the guard. Workflow runs
are serialized for the whole package, across version tags. Coordinate external
maintainer publications with this queue so the latest check remains valid.

If an artifact expires, use the archived original tarball and checksum with an
authorized maintainer's registry-specific credentials in an isolated directory.
Do not rebuild, rerun version calculation, change versions, or overwrite releases.
If no exact retained artifact is available, stop and recover it before retrying.

Check both registry `dist` values against `release.json`, inspect `latest`, and
perform actual installs using the consumer's intended routing/credentials before
unblocking downstream workers. Public-only consumers may use npmjs; a consumer
with private `@todoist/*` dependencies must use the GitHub scope mapping for all
packages in that scope. There is no registry fallback.

## eslint-config consumer handoff

The current `@doist/eslint-config@13.1.1` pins plugin `1.0.0`; adopting 2.0.2 also
adopts the existing 2.x engine/peer contract. Its dev ESLint 8.57.0 and advertised
`^8.57.0 || ^9.0.0` support conflict with plugin `eslint >=9`. Resolve that policy
explicitly on the current config line; do not use `--force`/`--legacy-peer-deps`
as evidence of compatibility or rebuild a historical plugin line.

The plugin's CommonJS root entry/exports remains `./lib/index.js`; it exports
`rules` only (gettext-literal-arg, static-path-literal-arg, import-file-naming),
with no bundled configs or deep-import exports. Runtime source is unchanged by
this migration. `flat/recommended.js` in the config imports the root and registers
`@doist/doist`; migrate both that import and plugin/rule keys to `@todoist/doist`.
`eslintrc/recommended.js` uses the same scoped shorthand and all three rule names.
An old alias may be deliberately retained by a flat-config consumer, but legacy
plugin resolution needs the new package scope. Literal-helper invalid inputs need
real ESLint 9 behavior verification, not just an import smoke check.

## Setup references

- Repository Actions policy: <https://github.com/todoist/eslint-plugin-doist/settings/actions>
- Workflow: <https://github.com/todoist/eslint-plugin-doist/actions/workflows/publish.yml>
- npm package settings: <https://www.npmjs.com/package/@todoist/eslint-plugin-doist/access>
- GitHub package settings: <https://github.com/orgs/todoist/packages/npm/eslint-plugin-doist/settings>
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
- [GitHub npm registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

Henning routes setup to the existing npm/package administrators (D06 individual
assignment evidence is not present in this repository). First-publication access,
renamed repository identity, package ACLs and real registry installs remain human
execution gates; this document does not assert that they have been configured.
