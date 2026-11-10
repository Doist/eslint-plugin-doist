import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const source = JSON.parse(readFileSync(join(root, 'package.json')));
const [mode, directory, destination] = process.argv.slice(2);
assert(['pack', 'verify', 'publish'].includes(mode), 'Use pack|verify|publish DIRECTORY [npm|github]');
assert(directory, 'An artifact directory is required');
const output = resolve(directory);
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(source.name, '@todoist/eslint-plugin-doist');
assert.match(source.version, /^\d+\.\d+\.\d+$/); // Stable releases use latest; no implicit prerelease promotion.
const filename = `todoist-eslint-plugin-doist-${source.version}.tgz`;
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
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(), '',
        'Pack only a clean, committed release checkout');
    mkdirSync(output); // Refuse to overwrite/repack a retained release directory.
    const result = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output], {
        cwd: root, encoding: 'utf8',
    }));
    assert.equal(result.length, 1);
    assert.equal(result[0].filename, filename);
    const metadata = {
        name: source.name, version: source.version, sourceSha, filename,
        sha256: digest('sha256', 'hex'), integrity: `sha512-${digest('sha512', 'base64')}`,
        shasum: digest('sha1', 'hex'),
    };
    writeFileSync(join(output, 'release.json'), JSON.stringify(metadata, null, 2) + '\n');
    writeFileSync(join(output, 'SHA256SUMS'), `${metadata.sha256}  ${filename}\n`);
}
const metadata = verify();
console.log(JSON.stringify(metadata, null, 2));

if (mode === 'publish') {
    assert(['npm', 'github'].includes(destination), 'Choose npm or github explicitly');
    assert.equal(process.env.GITHUB_REPOSITORY, 'todoist/eslint-plugin-doist', 'Publish only from the renamed repository');
    assert.equal(process.env.GITHUB_REF, `refs/tags/v${source.version}`, 'Publish only from the matching version tag');
    const distTag = process.env.RELEASE_DIST_TAG || 'latest';
    assert(['latest', 'recovery'].includes(distTag), 'Use latest or the explicit recovery dist-tag');
    const registry = destination === 'npm' ? 'https://registry.npmjs.org/' : 'https://npm.pkg.github.com/';
    const staging = mkdtempSync(join(tmpdir(), 'eslint-plugin-publish-'));
    try {
        // Drop ambient npm routing/auth config; use an isolated working directory and scope mapping.
        const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)));
        delete env.NPM_TOKEN;
        delete env.NODE_AUTH_TOKEN;
        const config = join(staging, 'npmrc');
        const globalConfig = join(staging, 'global-npmrc');
        writeFileSync(globalConfig, '');
        let contents = `registry=${registry}\n@todoist:registry=${registry}\n`;
        if (destination === 'github') {
            assert(process.env.NODE_AUTH_TOKEN, 'GitHub Packages write token required');
            env.NODE_AUTH_TOKEN = process.env.NODE_AUTH_TOKEN;
            contents += '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n';
        }
        writeFileSync(config, contents, { mode: 0o600 });
        env.NPM_CONFIG_USERCONFIG = config;
        env.NPM_CONFIG_GLOBALCONFIG = globalConfig;
        const options = { cwd: staging, env, encoding: 'utf8' };
        const spec = `${source.name}@${source.version}`;
        const existing = () => {
            const result = spawnSync('npm', ['view', spec, 'dist', '--json', `--registry=${registry}`], options);
            if (result.status !== 0) {
                let error;
                try { error = JSON.parse(result.stdout).error; } catch { /* Fail closed below. */ }
                if (error?.code === 'E404') return false;
                throw new Error(`Registry inspection failed: ${result.stderr || result.error}`);
            }
            const dist = JSON.parse(result.stdout);
            if (dist.integrity) assert.equal(dist.integrity, metadata.integrity, 'Existing registry artifact differs');
            else assert.equal(dist.shasum, metadata.shasum, 'Existing registry artifact differs');
            return true;
        };
        const checkLatest = () => {
            const result = spawnSync('npm', ['view', source.name, 'dist-tags', '--json', `--registry=${registry}`], options);
            if (result.status !== 0) {
                let error;
                try { error = JSON.parse(result.stdout).error; } catch { /* Fail closed below. */ }
                if (error?.code === 'E404') return; // First real package publication.
                throw new Error(`Dist-tag inspection failed: ${result.stderr || result.error}`);
            }
            const latest = JSON.parse(result.stdout).latest;
            if (!latest) return;
            assert.match(latest, /^\d+\.\d+\.\d+$/, 'Non-stable latest needs an explicit maintainer recovery policy');
            const current = latest.split('.').map(BigInt);
            const target = source.version.split('.').map(BigInt);
            const differing = current.findIndex((value, index) => value !== target[index]);
            assert(differing === -1 || current[differing] < target[differing],
                `Refusing to move latest backwards from ${latest}; retain this artifact and use a reviewed recovery tag`);
        };
        if (existing()) {
            console.log(`${spec} already matches on ${destination}; no publication or dist-tag changes`);
        } else {
            if (distTag === 'latest') checkLatest();
            const args = ['publish', tarball, '--ignore-scripts', `--tag=${distTag}`, `--registry=${registry}`];
            if (destination === 'npm') args.push('--access=public', '--provenance=false');
            execFileSync('npm', args, { ...options, stdio: 'inherit' });
            assert(existing(), 'Published version was not returned by the registry; retry the retained artifact');
        }
    } finally {
        rmSync(staging, { recursive: true, force: true });
    }
}
