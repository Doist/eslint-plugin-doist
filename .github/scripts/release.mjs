import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preflight, publish } from './registry.mjs';
import { archiveFilename, retainedArtifact, withOriginalArtifact } from './source.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = JSON.parse(readFileSync(join(root, 'package.json')));
const [mode, directory, destination] = process.argv.slice(2);
assert(['pack', 'fetch', 'verify', 'preflight', 'bootstrap', 'publish'].includes(mode),
    'Use pack|fetch|verify|preflight|bootstrap|publish DIRECTORY [npm|github]');
assert(directory, 'An artifact directory is required');
const output = resolve(directory);
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(source.name, '@todoist/eslint-plugin-doist');
assert.match(source.version, /^\d+\.\d+\.\d+$/); // Stable releases use latest; no implicit prerelease promotion.
const filename = `todoist-eslint-plugin-doist-${source.version}.tgz`;
const selection = { sourceSha, version: source.version, filename,
    runId: process.env.ARTIFACT_RUN_ID, artifactId: process.env.ARTIFACT_ID };
const tarball = join(output, filename);
const digest = (algorithm, encoding) => createHash(algorithm).update(readFileSync(tarball)).digest(encoding);

function verify() {
    const metadata = JSON.parse(readFileSync(join(output, 'release.json')));
    assert.equal(metadata.sourceSha, sourceSha, 'Artifact must come from the checked-out release commit');
    assert.equal(metadata.name, source.name);
    assert.equal(metadata.version, source.version);
    assert.equal(metadata.filename, filename);
    assert.equal(metadata.sha256, digest('sha256', 'hex'), 'Tarball checksum mismatch');
    assert.equal(metadata.integrity, `sha512-${digest('sha512', 'base64')}`);
    assert.equal(metadata.shasum, digest('sha1', 'hex'));
    const packed = JSON.parse(execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' }));
    assert(!packed.private && !packed.publishConfig, 'No private marker or registry-routing publishConfig is permitted');
    for (const field of ['name', 'version', 'repository', 'main', 'exports', 'dependencies', 'peerDependencies', 'engines']) {
        assert.deepEqual(packed[field], source[field], `Packed ${field} differs from the reviewed source`);
    }
    return metadata;
}

if (mode === 'pack') {
    if (process.env.GITHUB_ACTIONS) assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Pack only the first attempt; never repack on retry');
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), '',
        'Pack only a clean, committed release checkout');
    mkdirSync(output); // Refuse to overwrite/repack a retained release directory.
    const result = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output], {
        cwd: root, encoding: 'utf8',
    }));
    assert.equal(result.length, 1);
    assert.equal(result[0].filename, filename);
    const metadata = {
        schemaVersion: 1,
        name: source.name, version: source.version, sourceSha, filename,
        sha256: digest('sha256', 'hex'), integrity: `sha512-${digest('sha512', 'base64')}`,
        shasum: digest('sha1', 'hex'),
    };
    writeFileSync(join(output, 'release.json'), JSON.stringify(metadata, null, 2) + '\n');
    writeFileSync(join(output, 'SHA256SUMS'), `${metadata.sha256}  ${filename}\n`);
}
if (mode === 'fetch') {
    const { zip, entries } = retainedArtifact(selection);
    mkdirSync(output); // Fresh destination only; preserve any previously retained artifact.
    for (const [name, bytes] of Object.entries(entries)) writeFileSync(join(output, name), bytes);
    writeFileSync(join(output, archiveFilename), zip);
}
const metadata = verify();
console.log(JSON.stringify(metadata, null, 2));

const release = { ...metadata, tarball };
if (mode === 'preflight') {
    preflight(release);
    console.log('Both registry copies are absent or match the retained artifact');
}
if (mode === 'bootstrap' || mode === 'publish') {
    if (mode === 'publish') {
        assert.equal(process.env.GITHUB_REPOSITORY, 'todoist/eslint-plugin-doist', 'Publish only from the renamed repository');
        assert.equal(process.env.GITHUB_REF, `refs/tags/v${source.version}`, 'Publish only from the matching version tag');
    }
    console.log(withOriginalArtifact(selection, output, () => publish(release, mode === 'bootstrap' ? 'npm' : destination, {
        tag: process.env.RELEASE_DIST_TAG || 'latest',
        interactive: mode === 'bootstrap',
    })));
}
