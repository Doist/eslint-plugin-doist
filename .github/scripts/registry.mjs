import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const registries = {
    npm: 'https://registry.npmjs.org/',
    github: 'https://npm.pkg.github.com/',
};

// Each read/write gets independent routing. Only GitHub subprocesses receive its token.
export function withRegistry(destination, callback, parentEnv = process.env, spawn = spawnSync) {
    assert(Object.hasOwn(registries, destination), 'Choose npm or github explicitly');
    if (destination === 'github') assert(parentEnv.NODE_AUTH_TOKEN, 'GitHub Packages read access is required even for npm-only publication');
    const registry = registries[destination];
    const directory = mkdtempSync(join(tmpdir(), 'eslint-plugin-registry-'));
    try {
        const env = Object.fromEntries(Object.entries(parentEnv).filter(([key]) =>
            !/^(npm_config_|npm_token$|node_auth_token$|github_token$|gh_token$|gh_packages_token$|github_packages_token$|confirmed_absent_github_package$)/i.test(key)));
        env.NPM_CONFIG_USERCONFIG = join(directory, 'npmrc');
        env.NPM_CONFIG_GLOBALCONFIG = join(directory, 'global-npmrc');
        writeFileSync(env.NPM_CONFIG_GLOBALCONFIG, '');
        let config = `registry=${registry}\n@todoist:registry=${registry}\n`;
        if (destination === 'github') {
            env.NODE_AUTH_TOKEN = parentEnv.NODE_AUTH_TOKEN;
            config += '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n';
        }
        writeFileSync(env.NPM_CONFIG_USERCONFIG, config, { mode: 0o600 });
        return callback((args, options = {}) => spawn('npm', args, {
            cwd: directory, env, encoding: 'utf8', ...options,
        }));
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

export function lookup(run, destination, spec, field = 'dist') {
    const fields = Array.isArray(field) ? field : [field];
    const metadata = fields.includes('dist-tags');
    // Bare names and @* resolve the default tag; an explicit range also works without latest.
    const result = run(['view', metadata ? `${spec}@>=0` : spec, ...fields, '--json', `--registry=${registries[destination]}`]);
    if (result.status === 0) {
        let value = JSON.parse(result.stdout);
        if (metadata && Array.isArray(value)) {
            assert(value.length, 'Empty registry metadata');
            for (const entry of value) assert.deepEqual(entry, value[0], 'Inconsistent registry metadata');
            value = value[0];
        }
        assert(value && typeof value === 'object' && !Array.isArray(value) && !value.error,
            `Invalid ${destination} metadata; publication stopped`);
        return value;
    }
    const codes = [];
    let ambiguous = false;
    for (const output of [result.stdout, result.stderr]) {
        if (!output?.trim()) continue;
        let code;
        try { code = JSON.parse(output).error?.code; } catch { /* Try npm's CLI error format. */ }
        const cliCodes = [...output.matchAll(/(?:^|\n)npm (?:ERR!|error) code ([A-Z0-9_]+)/g)]
            .map((match) => match[1]);
        if (code) codes.push(code);
        codes.push(...cliCodes);
        if (!code && !cliCodes.length) ambiguous = true;
    }
    if (!ambiguous && !result.error && !result.signal && codes.length && codes.every((code) => code === 'E404')) return null;
    // Do not print raw npm output: it can include credential/config details.
    throw new Error(`${destination} registry lookup failed (${codes.join(', ') || 'unclassified error'}); publication stopped`);
}

export function assertSameArtifact(dist, release) {
    assert(dist, 'Published version is missing');
    if (dist.integrity) assert.equal(dist.integrity, release.integrity, 'Existing registry artifact differs');
    else assert.equal(dist.shasum, release.shasum, 'Existing registry artifact differs');
}

export function ownerConfirmedAbsence(release, destination, env = process.env) {
    const confirmation = env.CONFIRMED_ABSENT_GITHUB_PACKAGE;
    if (!confirmation) return false;
    assert(!env.GITHUB_ACTIONS && !env.GITHUB_RUN_ID, 'First namespace confirmation is local only');
    assert(['npm', 'github'].includes(destination));
    assert.match(release.sourceRunId || '', /^[1-9]\d*$/);
    assert.match(release.sourceArtifactId || '', /^[1-9]\d*$/);
    assert.match(release.sourceArchiveDigest || '', /^sha256:[a-f0-9]{64}$/);
    assert.equal(confirmation,
        `${release.name}@${release.version}:${destination}:${release.sourceRunId}:${release.sourceArtifactId}:${release.sourceArchiveDigest}`,
        'Owner absence confirmation must bind this destination and authoritative original archive');
    return true;
}

export function preflight(release, registry = withRegistry, confirmedAbsent = false) {
    const copies = {};
    for (const destination of ['npm', 'github']) {
        copies[destination] = registry(destination, (run) => {
            if (destination === 'github') {
                // This is an existing transferred mirror. Root 404 may hide an ACL failure.
                const document = lookup(run, destination, release.name, ['name', 'dist-tags']);
                if (document === null && confirmedAbsent) {
                    const identity = run(['whoami', '--json', `--registry=${registries.github}`]);
                    assert(identity.status === 0 && !identity.error && !identity.signal, 'GitHub package credentials must authenticate');
                    const username = JSON.parse(identity.stdout);
                    assert(typeof username === 'string' && username.trim().length, 'Invalid GitHub registry identity');
                    const existing = lookup(run, destination, `${release.name}@${release.version}`);
                    assert.equal(existing, null, 'Contradictory GitHub root/version absence evidence');
                    return null;
                }
                assert.equal(document?.name, release.name, 'Existing GitHub registry package must be readable before version absence is accepted');
                const tags = document['dist-tags'];
                assert(tags && typeof tags === 'object' && !Array.isArray(tags) && Object.keys(tags).length &&
                    Object.values(tags).every((version) => typeof version === 'string' &&
                        /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)),
                'GitHub registry dist-tags must be well-formed; publication stopped');
            }
            return lookup(run, destination, `${release.name}@${release.version}`);
        });
        if (copies[destination]) assertSameArtifact(copies[destination], release);
    }
    return copies;
}

function checkLatest(run, destination, release) {
    const latest = lookup(run, destination, release.name, 'dist-tags')?.latest;
    if (!latest) return;
    assert.match(latest, /^\d+\.\d+\.\d+$/, 'Non-stable latest needs an explicit maintainer recovery policy');
    const current = latest.split('.').map(BigInt);
    const target = release.version.split('.').map(BigInt);
    const differing = current.findIndex((value, index) => value !== target[index]);
    assert(differing === -1 || current[differing] < target[differing],
        `Refusing to move latest backwards from ${latest}; retain this artifact and use the recovery tag`);
}

export function publish(release, destination, { registry = withRegistry, tag = 'latest', interactive = false, env = process.env } = {}) {
    assert(Object.hasOwn(registries, destination), 'Choose npm or github explicitly');
    assert(['latest', 'recovery'].includes(tag), 'Use latest or the explicit recovery dist-tag');
    assert(!interactive || destination === 'npm', 'Interactive bootstrap is only for this public npm package');
    const confirmedAbsent = ownerConfirmedAbsence(release, destination, env);
    if (preflight(release, registry, confirmedAbsent)[destination]) return 'already-matches';
    return registry(destination, (run) => {
        if (interactive) {
            const login = run(['login', `--registry=${registries.npm}`], { stdio: 'inherit' });
            assert.equal(login.status, 0, 'Interactive npm login failed; publication was not attempted');
        }
        if (tag === 'latest') checkLatest(run, destination, release);
        // Recheck BOTH copies immediately before every write, including after interactive login.
        if (preflight(release, registry, confirmedAbsent)[destination]) return 'already-matches';
        const args = ['publish', release.tarball, '--ignore-scripts', `--tag=${tag}`, `--registry=${registries[destination]}`];
        if (destination === 'npm') args.push('--access=public', '--provenance=false');
        // npm publish itself may require a fresh 2FA challenge after login.
        const result = run(args, { stdio: 'inherit' });
        assert.equal(result.status, 0, 'Publication failed; retain the artifact and retry without a version bump');
        assertSameArtifact(lookup(run, destination, `${release.name}@${release.version}`), release);
        return 'published-and-verified';
    });
}
