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
with 2FA; no placeholder version. Use the `bootstrap` helper instead of a raw
`npm publish`: it verifies the local artifact, inspects the exact version in
**both** required registries, and stops before any package write if either copy
has different bytes or a lookup is ambiguous. Matching copies are skipped.

The operator must have an existing **GitHub personal access token (classic)**
with `read:packages`, held by an account with Read access to the intended mirror
and authorized for the organization's SSO if required. A valid token without the
package's access grant is insufficient. Before interpreting a 404 as absence,
the package administrator must confirm those intended read permissions (or that
the package truly does not yet exist). Do not treat an inaccessible private
mirror as missing. Do not create tokens/change ACLs as a preparation check.

From the checkout at the selected artifact's exact reviewed source commit, with
`RELEASE_DIR` pointing to the downloaded original artifact, use this Bash block.
It reads the existing GitHub credential without echoing it or putting it into
shell history. These are **future authorized operator commands**, not checks run
during preparation:

```sh
export RELEASE_DIR
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
  -f operation=github -f artifact_run_id="$RUN_ID"
```

GitHub publication uses `GITHUB_TOKEN` with `packages:write` (including Read).
The npm-only workflow step also receives this token for the opposite-copy
preflight; the helper removes it from every npmjs subprocess. Check repository
linkage, preserved public visibility, publisher Write access, and specific
consumer Read grants in **Manage Actions access**. Local GitHub npm installs
require appropriate authentication even when the package is public.

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
on that tag with the original `artifact_run_id`. For a partial release, choose
`npm` or `github` for the missing destination. The workflow requires a successful
`publish.yml` pack run from this repository
(not a fork or PR event), on `main` or the matching version tag, with the exact
checked-out SHA. A GitHub comparison must confirm that commit belongs to reviewed
`main` history. The script then verifies package identity and digest before
publishing. Before **each** registry write, even a one-mirror retry, both exact
same-version copies must be absent or match the selected artifact. Choosing a
different valid pack run for the same version never permits divergence from an
already-published opposite copy. Existing copies must have matching integrity (or matching SHA-1 where the
registry does not return integrity); a mismatch stops the job. Authentication or
other read errors stop the job. Structured E404 from either output stream, or
npm's explicit E404 error code, permits absence only with the intended registry
read permissions; conflicting/unclassified errors fail closed. A skipped
existing version does not move its dist-tags. Before a missing-version publish,
the job refuses to move an existing newer `latest` backwards; a non-stable `latest`
also requires a maintainer decision. In those cases, retain the same artifact and
dispatch the same artifact with the explicit `dist_tag=recovery` choice, preserving
`latest`. For example:

```sh
gh workflow run publish.yml --repo todoist/eslint-plugin-doist --ref v2.0.2 \
  -f operation=github -f artifact_run_id="$RUN_ID" -f dist_tag=recovery
```

The recovery tag is an explicit operator choice; inspect it before reusing it.
Do not create a new version to bypass the guard. Workflow runs
are serialized for the whole package, across version tags. Coordinate external
maintainer publications with this queue so the latest check remains valid.

If an artifact expires, use the archived original tarball and checksum with an
authorized maintainer's registry-specific credentials and the same both-registry
preflight helper in an isolated directory; never bypass it with a raw publish.
Do not rebuild, rerun version calculation, change versions, or overwrite releases.
If no exact retained artifact is available, stop and recover it before retrying.

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
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm trust prerequisites](https://docs.npmjs.com/cli/v11/commands/npm-trust/)
- [GitHub npm registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)

Henning routes setup to the existing npm/package administrators (D06 individual
assignment evidence is not present in this repository). First-publication access,
renamed repository identity, package ACLs and real registry installs remain human
execution gates; this document does not assert that they have been configured.
