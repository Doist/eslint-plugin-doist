# Releasing the scoped plugin

The forward migration release is `@todoist/eslint-plugin-doist@2.0.2` from the
2.0.1 line. Keep the repository/package basename. Versions are maintained in
`package.json` and the lockfile root, with a matching `v<version>` tag; there is
no semantic-release calculation. Recheck both registries for a version collision
before a maintainer creates the next tag. Do not bump again to repair a missing
mirror. Existing packages, releases and tags remain untouched.

This is an M02 leaf producer: `requireindex` is the only runtime dependency,
`eslint ^8.57.0 || ^9.0.0` is a peer, and there are no Doist/Todoist build
dependencies or compilation steps. The `@eslint/*` adapters are public development
tools used only for repository lint verification. The same tarball must reach
npmjs (public) and GitHub Packages (currently public; preserve visibility separately from npm's access flag).

## Preparation and merge gates

Migration preparation does not publish, dispatch workflows, create tags, change
settings, or rehearse the cutover. Branch pushes, draft PRs and a main-branch merge
do not invoke this repository's release workflow. PRs and main pushes run only
the read-only test/lint matrix (dependency installs disable lifecycle scripts).
After this change, a **new version tag only packs**; publication requires an explicit dispatch.

The migration repairs the current-line lockfile drift and test/lint harness so
ESLint 8.57 and 9 can be verified without changing runtime rule implementation.
`eslint.config.cjs` adapts the existing lint policy, including the legacy Node
lint plugin, using ESLint's official compatibility helpers. `RuleTester` uses the
matching configuration shape for each major. The behavior suite additionally runs
all three rules, plural/context gettext arguments and both static-path arguments
through flat and eslintrc APIs with the new scope.

Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm run lint` and `npm test`.
The CI matrix in `.github/workflows/test.yml` covers ESLint 8.57.0, 9.0.0 and latest
9 on Node 22.14.0 and 24.10.0. Each job installs the tested ESLint without saving a
manifest/lockfile change. The release pack step needs no development install;
publication approval still requires the matrix and the normal code review.

## Artifact production (future authorized operator)

The workflow and caller are both `.github/workflows/publish.yml`; no reusable
workflow or environment is involved. Jobs use GitHub-hosted `ubuntu-latest`,
Node 24, and the publishing job pins npm 11.19.0. No shared Doist Actions are used,
so M01 shared-action pins are not a build prerequisite here.

After rename/access and human review, use the normal version-tag process on the
reviewed release commit. The `v2.0.2` push runs `pack`. Alternatively, dispatch
`operation=pack` on the reviewed ref. Neither route publishes. Record the run ID
and full commit SHA, plus the immutable artifact ID shown by `upload-artifact`.
Only attempt **1** may pack (workflow and script enforce this); a failed original
attempt cannot be replaced by rerunning it. This package has no build:

```sh
node .github/scripts/release.mjs pack "$RUNNER_TEMP/release-artifacts"
```

The `eslint-plugin-doist-release` artifact contains
`todoist-eslint-plugin-doist-2.0.2.tgz`, `release.json` (schema 1, commit and
SHA-256/SHA-512/SHA-1), and `SHA256SUMS`. It is retained for 90 days, subject to
organization retention limits. Archive the **original ZIP**, all three files,
run ID, attempt 1, artifact ID, API archive digest and source SHA before expiry.
Never rerun the pack job to complete a partial publication. The pack script
refuses an existing output directory.

Use an existing GitHub CLI login with repository **Actions: read** and
**Contents: read** access (fine-grained token or app), or a classic token with
`repo` for private repository access. Required SSO authorization still applies.
This source API credential is distinct from the classic Packages read token
below. The workflow provides `GH_TOKEN=github.token` with the equivalent read
permissions. No credentials/settings are created during preparation.

From the checkout at the exact reviewed source commit, set the real original
IDs (obtain the artifact ID from its upload output; never guess it). `fetch`
validates the original successful attempt, pack job and reviewed main ancestry,
then downloads the exact artifact ID and verifies its API SHA-256 ZIP digest:

```sh
export ARTIFACT_RUN_ID="$RUN_ID" ARTIFACT_ID="$ORIGINAL_ARTIFACT_ID"
RELEASE_DIR="$(mktemp -d)/release"
export RELEASE_DIR
node .github/scripts/release.mjs fetch "$RELEASE_DIR"
node .github/scripts/release.mjs verify "$RELEASE_DIR"
(cd "$RELEASE_DIR" && shasum -a 256 -c SHA256SUMS)
tar -xOf "$RELEASE_DIR/todoist-eslint-plugin-doist-2.0.2.tgz" package/package.json
```

The fetch destination must not already exist. It retains `source-artifact.zip`
alongside the three release files. `verify` alone is a local consistency check;
it does **not** authorize publication. Both `bootstrap` and `publish` independently
read the authoritative original-attempt/artifact APIs and compare every selected
local entry with that archive before reaching any registry write.

Review the packed identity, dependencies and public classification. The verifier
rejects a private marker or any `publishConfig`, and compares metadata to the
checked-out source. Publication uses a dedicated temporary directory with an
explicit `@todoist` mapping and independent user/global npm config for each
registry. No repository/global routing is inherited.

## First real npm publication

A new npm package must exist before trust can be configured. An authorized
`todoist` npm maintainer bootstraps the **real reviewed tarball**, interactively
with 2FA; no placeholder version. Use the `bootstrap` helper instead of a raw
`npm publish`: it verifies the local artifact, inspects the exact version in
**both** required registries, and stops before any package write if either copy
has different bytes or a lookup is ambiguous. Matching copies are skipped.

The operator must have an existing **GitHub personal access token (classic)**
with `read:packages`, held by an account with Read access to the intended mirror
and authorized for the organization's SSO if required. A valid token without the
package's access grant is insufficient. Before interpreting a 404 as absence,
the helper requires the known transferred mirror's actual GitHub npm registry
package document and nonempty, valid dist-tags to be readable. Root 404, malformed
metadata or auth/network ambiguity stops even an npm-only bootstrap/retry before
login/write. REST visibility, `npm whoami` and an administrator statement do not
bypass this executable gate. If the transferred mirror is not readable, its
existing owner must restore the intended package access/routing before retrying.
Ordinary workflow retries have no absence override. The only exception is the
local, artifact-bound first-namespace operation below. Do not create tokens/change
ACLs as a preparation check.

From the checkout at the selected artifact's exact reviewed source commit, with
`RELEASE_DIR` pointing to the authenticated original artifact and
`ARTIFACT_RUN_ID`/`ARTIFACT_ID` exported, use this Bash block. An existing GitHub
CLI login must already have the Actions/Contents read access described above;
if using `GH_TOKEN` instead, supply that existing source-read credential through
your approved secret environment (not shell history).
It reads the existing GitHub credential without echoing it or putting it into
shell history. These are **future authorized operator commands**, not checks run
during preparation:

```sh
export RELEASE_DIR ARTIFACT_RUN_ID ARTIFACT_ID
bash <<'BASH'
read -r -s -p 'Existing GitHub Packages read token: ' NODE_AUTH_TOKEN </dev/tty
printf '\n'
export NODE_AUTH_TOKEN
node .github/scripts/release.mjs bootstrap "$RELEASE_DIR" </dev/tty
BASH
```

The helper creates independent temporary npm user/global configs with explicit
`@todoist` scope mappings. Public npm preflight reads are unauthenticated; only
GitHub reads receive `NODE_AUTH_TOKEN`. npm login and publication run in the same
isolated npmjs directory, with inherited terminal IO for **both** operations so
publish can request a fresh 2FA challenge. The GitHub Packages/CLI token variables and ambient
npm routing/auth are stripped from npm subprocesses. Both registries are checked
again after login, immediately before the write. Temporary login configs are
removed even after failure; retain only the original artifact/checksum files.

The npm write uses `--access=public --tag=latest --ignore-scripts --provenance=false`.
The existing newer-latest guard still applies; for an approved older-version
recovery use `RELEASE_DIST_TAG=recovery` with the helper. Local publication does
not validate future OIDC trust. A separate read-only check is available as
`node .github/scripts/release.mjs preflight "$RELEASE_DIR"` with the same intended
GitHub credential, but publication always repeats the check rather than trusting
an earlier preflight result.

Then complete the GitHub mirror using that **same original run** (the version tag
must point to the artifact's commit):

```sh
gh workflow run publish.yml --repo todoist/eslint-plugin-doist --ref v2.0.2 \
  -f operation=github -f artifact_run_id="$ARTIFACT_RUN_ID" -f artifact_id="$ARTIFACT_ID"
```

GitHub publication uses `GITHUB_TOKEN` with `packages:write` (including Read).
The npm-only workflow step also receives this token for the opposite-copy
preflight; the helper removes it from every npmjs subprocess. Check repository
linkage, preserved public visibility, publisher Write access, and specific
consumer Read grants in **Manage Actions access**. Local GitHub npm installs
require appropriate authentication even when the package is public.

## Local first-namespace operation after owner confirmation

A rename can leave the old `@doist` registry root readable while the new
`@todoist` root returns 404. That 404, REST visibility, inventory and `whoami`
are not proof of absence. An organization/package owner must explicitly confirm
that the **new** package is absent, rather than hidden by ACLs, for the exact
package/version, destination, original run ID, artifact ID and API ZIP digest.
Record the owner and fact with the release evidence. If the owner cannot establish
absence/access, stop for GitHub support; do not override an inaccessible package.

Only that local operation may set `CONFIRMED_ABSENT_GITHUB_PACKAGE`. The helper
rejects it in Actions, rejects any binding mismatch, requires successful GitHub
registry authentication, and still reads **both exact-version copies before each
write**, including after npm login. Root404 combined with any existing version is
contradictory and stops. Auth/network/malformed responses and different bytes stop;
readable roots always use the normal checks. Normal retries require a readable new
root. The old scope and its releases are preserved.

A reviewed recovery helper may be newer than the artifact. Locally set
`RELEASE_SOURCE_SHA` to the original reviewed commit; the helper reads its original
manifest from Git and independently binds the archive through the source API.
This override cannot be used for packing or in Actions. Do not rebuild the artifact.

For the owner-confirmed first npm operation, use the same existing source/package
credentials and terminal setup as above, with these bindings:

```sh
export RELEASE_SOURCE_SHA="$ORIGINAL_SOURCE_SHA"
export CONFIRMED_ABSENT_GITHUB_PACKAGE="@todoist/eslint-plugin-doist@2.0.2:npm:$ARTIFACT_RUN_ID:$ARTIFACT_ID:$API_ARCHIVE_DIGEST"
node .github/scripts/release.mjs bootstrap "$RELEASE_DIR" </dev/tty
```

For the separately bound first GitHub mirror operation, use a classic token with
actual `read:packages` and `write:packages` access as `NODE_AUTH_TOKEN`, preserve
the source API credentials and original IDs, and select `github` in the binding:

```sh
export CONFIRMED_ABSENT_GITHUB_PACKAGE="@todoist/eslint-plugin-doist@2.0.2:github:$ARTIFACT_RUN_ID:$ARTIFACT_ID:$API_ARCHIVE_DIGEST"
node .github/scripts/release.mjs publish "$RELEASE_DIR" github </dev/tty
unset CONFIRMED_ABSENT_GITHUB_PACKAGE RELEASE_SOURCE_SHA
```

`API_ARCHIVE_DIGEST` includes the `sha256:` prefix and comes from authenticated
GitHub artifact metadata, not a self-declared local file. Verify both registry
copies and fresh installs afterward. If npm accepts the write but reports
processing and metadata still returns404, retain that receipt and perform only
read checks until it becomes visible; do not issue a duplicate write.

New GitHub packages can inherit INTERNAL visibility even when npm is public.
Verify the **new package's ID, scope, version and repository** before correcting
only that package to PUBLIC under the release authorization; re-read the API and
verify a fresh authenticated consumer install. Preserve the old package's
visibility and access. Future OIDC/environment settings are separate operations.

Metadata reads use explicit `@>=0` to avoid npm resolving a missing default tag;
multiple version projections must agree. The focused regression uses the actual
npm client against a loopback mock with the plugin's beta/latest and beta-only
tag shapes. No live package write occurs in these tests.

## Later trusted releases and retries

Near the next real automated release, configure npm Settings → Trusted publishing:
owner `todoist`, repository `eslint-plugin-doist`, filename `publish.yml`,
environment **blank**. Enable direct `npm publish`. The job grants `id-token:write`
and uses a hosted runner. Publication passes `--provenance=false`, including for
OIDC, because this is a retained artifact from an earlier run; it does not claim
that the publication job built that tarball. No `npm dist-tag` commands
are used, so a separate dist-tag-management grant is not required. A manual first
release does not validate this connection. Record it as configured/unverified
until the next real publish succeeds; new connections expire after two days
without a successful publication.

For a later stable release, update the manifest/root lock versions through review,
create its matching tag, retain the pack result, then dispatch `operation=both`
on that tag with the original `artifact_run_id` and `artifact_id`. For a partial release, choose
`npm` or `github` for the missing destination. The workflow and local bootstrap require a successful
original **attempt 1** of a `publish.yml` pack run from this repository
(not a fork or PR event), on `main` or the matching version tag, with the exact
checked-out SHA. A GitHub comparison must confirm that commit belongs to reviewed
`main` history. The attempt API, not the mutable latest run state, is used; a
later failed/skipped rerun does not invalidate the original artifact. The artifact
must have the exact selected ID, run/repository/source SHA and a creation time
within the successful original pack job. Its API SHA-256 must match the retained
ZIP, and every local file must equal its ZIP entry. No comparison with evolving
current-main workflow bytes is required. Schema 1 is supported; unsupported
schema or unavailable authoritative evidence stops with original-artifact
recovery required, never a request to repack an immutable published version.
The script also verifies package identity and tarball digests before publishing. Before **each** registry write, even a one-mirror retry, both exact
same-version copies must be absent or match the selected artifact. Choosing a
different valid pack run for the same version never permits divergence from an
already-published opposite copy. Existing copies must have matching integrity (or matching SHA-1 where the
registry does not return integrity); a mismatch stops the job. Authentication or
other read errors stop the job. Structured E404 from either output stream, or
npm's explicit E404 error code, permits exact-version absence only after the
GitHub registry package document/dist-tags read succeeds; root 404 and
conflicting/unclassified errors fail closed. A skipped
existing version does not move its dist-tags. Before a missing-version publish,
the job refuses to move an existing newer `latest` backwards; a non-stable `latest`
also requires a maintainer decision. In those cases, retain the same artifact and
dispatch the same artifact with the explicit `dist_tag=recovery` choice, preserving
`latest`. For example:

```sh
gh workflow run publish.yml --repo todoist/eslint-plugin-doist --ref v2.0.2 \
  -f operation=github -f artifact_run_id="$ARTIFACT_RUN_ID" -f artifact_id="$ARTIFACT_ID" -f dist_tag=recovery
```

The recovery tag is an explicit operator choice; inspect it before reusing it.
Do not create a new version to bypass the guard. Workflow runs
are serialized for the whole package, across version tags. Coordinate external
maintainer publications with this queue so the latest check remains valid.

For recovery, keep the original `source-artifact.zip` beside its unmodified
entries and reuse the exact run/artifact IDs with the same guarded helper and
credentials. A local ZIP backup avoids redownloading an expired archive **only
while GitHub still provides the original attempt/jobs/artifact metadata and
API digest**. If that authoritative evidence has also disappeared, stop for
owner-assisted recovery of the original evidence; local self-declared hashes
cannot authorize publication. Never manufacture an archive or bypass the guard
with raw `npm publish`. Do not rebuild, rerun version calculation, change versions,
or overwrite releases.

Check both registry `dist` values against `release.json`, inspect `latest`, and
perform actual installs using the consumer's intended routing/credentials before
unblocking downstream workers. Public-only consumers may use npmjs; a consumer
with private `@todoist/*` dependencies must use the GitHub scope mapping for all
packages in that scope. There is no registry fallback.

## eslint-config consumer handoff

The current `@doist/eslint-config@13.1.1` pins plugin `1.0.0`. Its existing
ESLint `^8.57.0 || ^9.0.0` support is now also the forward plugin 2.0.2 peer policy,
verified against both engines with no historical rebuild or runtime rule changes.
The old producer 2.0.1's `eslint >=9` restriction is broadened only after this
compatibility validation. The config worker can adopt the intended exact 2.0.2
once real publication permits normal lockfile regeneration and registry checks.

Keep the producer's existing engines: Node `^22.14.0 || >=24.10.0` and npm
`^10.9.2 || >=11.5.1`. The config's Node `>=24` contract intersects this at 24.10.0;
its worker must document/enforce that inherited floor rather than lower it silently.

The plugin's CommonJS root entry/exports remains `./lib/index.js`; it exports
`rules` only (gettext-literal-arg, static-path-literal-arg, import-file-naming),
with no bundled configs or deep-import exports. Runtime source is unchanged by
this migration. `flat/recommended.js` in the config imports the root and registers
`@doist/doist`; migrate both that import and plugin/rule keys to `@todoist/doist`.
`eslintrc/recommended.js` uses the same scoped shorthand and all three rule names.
An old alias may be deliberately retained by a flat-config consumer, but legacy
plugin resolution needs the new package scope. The matrix verifies invalid
literal-helper inputs and file-naming diagnostics
through both configuration formats, rather than only testing import resolution.

## Setup references

- Repository Actions policy: <https://github.com/todoist/eslint-plugin-doist/settings/actions>
- Workflow: <https://github.com/todoist/eslint-plugin-doist/actions/workflows/publish.yml>
- npm package settings: <https://www.npmjs.com/package/@todoist/eslint-plugin-doist/access>
- GitHub package settings: <https://github.com/orgs/todoist/packages/npm/eslint-plugin-doist/settings>
- [GitHub original run attempt API](https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run-attempt)
- [GitHub artifact identity/digest API](https://docs.github.com/en/rest/actions/artifacts#get-an-artifact)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
- [GitHub npm registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

Henning routes setup to the existing npm/package administrators (D06 individual
assignment evidence is not present in this repository). First-publication access,
renamed repository identity, package ACLs and real registry installs remain human
execution gates; this document does not assert that they have been configured.
