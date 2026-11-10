import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { lookup, publish, registries, withRegistry } from './registry.mjs';

const release = {
    name: '@todoist/eslint-plugin-doist', version: '2.0.2', tarball: '/reviewed/artifact.tgz',
    integrity: 'sha512-reviewed', shasum: 'reviewed-sha1',
};
const matching = { integrity: release.integrity, shasum: release.shasum };
const different = { integrity: 'sha512-different-pack-same-version' };
const success = (value) => ({ status: 0, stdout: JSON.stringify(value), stderr: '' });
const missing = () => ({ status: 1, stdout: JSON.stringify({ error: { code: 'E404' } }), stderr: '' });

function registryFixture(initial, { latest = '2.0.1', fail, onLogin, githubDocument } = {}) {
    const copies = { ...initial };
    const calls = [];
    const registry = (destination, callback) => callback((args, options = {}) => {
        calls.push({ destination, args, options });
        assert(args.includes(`--registry=${registries[destination]}`));
        if (args[0] === 'login') {
            onLogin?.(copies);
            return { status: 0 };
        }
        if (args[0] === 'publish') {
            copies[destination] = matching;
            return { status: 0 };
        }
        assert.equal(args[0], 'view');
        if (fail?.destination === destination) return fail.result;
        if (args[2] === 'name') return githubDocument || success({ name: release.name, 'dist-tags': { latest } });
        if (args[2] === 'dist-tags') return success({ latest });
        assert.equal(args[1], `${release.name}@${release.version}`);
        return copies[destination] ? success(copies[destination]) : missing();
    });
    return { registry, calls, writes: () => calls.filter((call) => call.args[0] === 'publish') };
}

for (const destination of ['npm', 'github']) {
    const opposite = destination === 'npm' ? 'github' : 'npm';
    for (const selected of [null, matching]) {
        test(`${destination}: opposite-copy mismatch stops before any write, selected=${selected ? 'matching' : 'missing'}`, () => {
            const fixture = registryFixture({ [destination]: selected, [opposite]: different });
            assert.throws(() => publish(release, destination, fixture), /artifact differs/);
            assert.equal(fixture.writes().length, 0);
        });
    }
    for (const other of [null, matching]) {
        test(`${destination}: missing selected copy with ${other ? 'matching' : 'missing'} opposite copy writes only selected registry`, () => {
            const fixture = registryFixture({ [destination]: null, [opposite]: other });
            assert.equal(publish(release, destination, fixture), 'published-and-verified');
            assert.equal(fixture.writes().length, 1);
            assert.equal(fixture.writes()[0].destination, destination);
            const beforeWrite = fixture.calls.slice(0, fixture.calls.indexOf(fixture.writes()[0]));
            assert.deepEqual(beforeWrite.slice(-3).map((call) => [call.destination, call.args[2]]),
                [['npm', 'dist'], ['github', 'name'], ['github', 'dist']]);
        });
    }
}

test('equal copies skip both destination choices without publishing or retagging', () => {
    const fixture = registryFixture({ npm: matching, github: { shasum: release.shasum } });
    assert.equal(publish(release, 'npm', fixture), 'already-matches');
    assert.equal(publish(release, 'github', fixture), 'already-matches');
    assert.equal(fixture.writes().length, 0);
});

for (const stream of ['stdout', 'stderr']) {
    test(`structured E404 on ${stream} is treated as absence`, () => {
        const result = { status: 1, stdout: '', stderr: '' };
        result[stream] = JSON.stringify({ error: { code: 'E404' } });
        assert.equal(lookup(() => result, 'npm', `${release.name}@${release.version}`), null);
    });
}

for (const code of ['E401', 'E403', 'ENOTFOUND', 'ETIMEDOUT']) {
    test(`opposite GitHub ${code} stops npm publication`, () => {
        const fixture = registryFixture({}, {
            fail: { destination: 'github', result: { status: 1, stdout: '', stderr: JSON.stringify({ error: { code } }) } },
        });
        assert.throws(() => publish(release, 'npm', fixture), /lookup failed/);
        assert.equal(fixture.writes().length, 0);
    });
}

test('npm CLI-formatted E404 on stderr is recognized without guessing from messages', () => {
    assert.equal(lookup(() => ({ status: 1, stdout: '', stderr: 'npm error code E404\nnpm error Not found' }), 'npm', release.name), null);
});

test('mixed absence/auth signals and malformed metadata fail closed', () => {
    const cases = [
        { status: 1, stdout: JSON.stringify({ error: { code: 'E404' } }), stderr: JSON.stringify({ error: { code: 'E401' } }) },
        { ...missing(), error: new Error('spawn failed') },
        { ...missing(), stderr: 'unclassified authentication/proxy failure' },
        { ...missing(), stderr: 'npm error code E401\nnpm error Unauthorized' },
        { status: 1, stdout: '', stderr: 'ambiguous proxy error' },
        success({}),
    ];
    for (const result of cases) {
        const fixture = registryFixture({}, { fail: { destination: 'github', result } });
        assert.throws(() => publish(release, 'npm', fixture));
        assert.equal(fixture.writes().length, 0);
    }
});

test('bootstrap rechecks the opposite copy after login and stops if it changed', () => {
    const fixture = registryFixture({}, { onLogin: (copies) => { copies.github = different; } });
    assert.throws(() => publish(release, 'npm', { ...fixture, interactive: true }), /artifact differs/);
    assert.equal(fixture.writes().length, 0);
});

test('bootstrap gives login and actual npm publish inherited terminal IO for fresh 2FA', () => {
    const fixture = registryFixture({ github: matching });
    publish(release, 'npm', { ...fixture, interactive: true });
    for (const operation of ['login', 'publish']) {
        assert.equal(fixture.calls.find((call) => call.args[0] === operation).options.stdio, 'inherit');
    }
    assert(fixture.writes()[0].args.includes('--provenance=false'));
    assert(fixture.writes()[0].args.includes('--access=public'));
});

test('newer latest aborts but explicit recovery preserves independent retry', () => {
    const fixture = registryFixture({ npm: matching }, { latest: '2.0.3' });
    assert.throws(() => publish(release, 'github', fixture), /latest backwards/);
    assert.equal(fixture.writes().length, 0);
    publish(release, 'github', { ...fixture, tag: 'recovery' });
    assert(fixture.writes()[0].args.includes('--tag=recovery'));
    assert(!fixture.writes()[0].args.includes('--access=public'));
});

test('isolated npm reads/login/publish never inherit GitHub credentials or ambient routing', () => {
    const parentEnv = {
        PATH: process.env.PATH,
        NODE_AUTH_TOKEN: 'github-secret-fixture', GH_TOKEN: 'other-github-fixture', GITHUB_TOKEN: 'fixture',
        NPM_TOKEN: 'ambient-npm-fixture', NPM_CONFIG_REGISTRY: 'https://incorrect.invalid/',
    };
    const seen = [];
    const spawn = (command, args, options) => {
        const config = readFileSync(options.env.NPM_CONFIG_USERCONFIG, 'utf8');
        const globalConfig = readFileSync(options.env.NPM_CONFIG_GLOBALCONFIG, 'utf8');
        seen.push({ command, args, options, config });
        assert.equal(globalConfig, '');
        assert.equal(options.env.NPM_CONFIG_REGISTRY, undefined);
        assert.equal(options.env.GH_TOKEN, undefined);
        assert.equal(options.env.GITHUB_TOKEN, undefined);
        assert.equal(options.env.NPM_TOKEN, undefined);
        if (args.includes(`--registry=${registries.github}`)) {
            assert.equal(options.env.NODE_AUTH_TOKEN, parentEnv.NODE_AUTH_TOKEN);
            assert(config.includes('//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}'));
        } else {
            assert.equal(options.env.NODE_AUTH_TOKEN, undefined);
            assert(!config.includes('_authToken'));
            assert(config.includes(`@todoist:registry=${registries.npm}`));
        }
        return success(matching);
    };
    for (const destination of ['npm', 'github']) {
        withRegistry(destination, (run) => {
            run(['view', `${release.name}@${release.version}`, 'dist', '--json', `--registry=${registries[destination]}`]);
            if (destination === 'npm') {
                run(['login', `--registry=${registries.npm}`], { stdio: 'inherit' });
                run(['publish', release.tarball, `--registry=${registries.npm}`], { stdio: 'inherit' });
            }
        }, parentEnv, spawn);
    }
    assert.equal(seen[0].options.cwd, seen[1].options.cwd);
    assert.equal(seen[1].options.cwd, seen[2].options.cwd);
    for (const call of seen) assert(!existsSync(call.options.cwd));
});

test('no GitHub read credential aborts before even invoking npm', () => {
    assert.throws(() => withRegistry('github', () => assert.fail('must not run'), {}), /read access is required/);
});

test('C08: hidden or malformed GitHub registry root aborts before login/write despite absent versions', () => {
    // REST visibility and whoami can succeed with no registry package access; neither is evidence here.
    for (const githubDocument of [missing(), success({}), success({ name: release.name, 'dist-tags': {} }),
        success({ name: release.name, 'dist-tags': { latest: false } })]) {
        const fixture = registryFixture({}, { githubDocument });
        assert.throws(() => publish(release, 'npm', { ...fixture, interactive: true }));
        assert.equal(fixture.writes().length, 0);
        assert(!fixture.calls.some((call) => call.args[0] === 'login'));
    }
});
