import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { archiveFilename, retainedArtifact, withOriginalArtifact } from './source.mjs';

const selection = { runId: '123', artifactId: '456', sourceSha: 'a'.repeat(40),
    version: '2.0.2', filename: 'todoist-eslint-plugin-doist-2.0.2.tgz' };
const archive = Buffer.from('Mocked original archive bytes (no real package or ZIP is produced)');

function fixture() {
    const run = { id: 123, run_attempt: 1, repository: { id: 10, full_name: 'todoist/eslint-plugin-doist' },
        head_repository: { id: 10, full_name: 'todoist/eslint-plugin-doist' },
        path: '.github/workflows/publish.yml', head_sha: selection.sourceSha,
        event: 'push', head_branch: null, status: 'completed', conclusion: 'success' };
    const jobs = { total_count: 1, jobs: [{ name: 'pack', run_id: 123, head_sha: selection.sourceSha,
        status: 'completed', conclusion: 'success', started_at: '2026-11-10T12:00:00Z', completed_at: '2026-11-10T12:01:00Z' }] };
    const artifact = { id: 456, name: 'eslint-plugin-doist-release', created_at: '2026-11-10T12:00:30Z',
        digest: `sha256:${createHash('sha256').update(archive).digest('hex')}`,
        workflow_run: { id: 123, head_sha: selection.sourceSha, repository_id: 10, head_repository_id: 10 } };
    const metadata = { schemaVersion: 1, sourceSha: selection.sourceSha, name: '@todoist/eslint-plugin-doist',
        version: selection.version, filename: selection.filename };
    const entries = { [selection.filename]: Buffer.from('mock retained tarball'),
        'release.json': Buffer.from(JSON.stringify(metadata)), SHA256SUMS: Buffer.from('mock checksum file') };
    const responses = {
        'actions/runs/123': { ...run, run_attempt: 3, conclusion: 'failure' },
        'actions/runs/123/attempts/1': run,
        [`compare/${selection.sourceSha}...main`]: { status: 'ahead' },
        'actions/runs/123/attempts/1/jobs?per_page=100': jobs,
        'actions/artifacts/456': artifact,
    };
    const calls = [];
    const api = (endpoint) => {
        calls.push(endpoint);
        const path = endpoint.replace('repos/todoist/eslint-plugin-doist/', '');
        if (path === 'actions/artifacts/456/zip') return archive;
        assert(Object.hasOwn(responses, path), `Unexpected API request ${endpoint}`);
        return Buffer.from(JSON.stringify(responses[path]));
    };
    const unpack = (bytes, filenames) => {
        assert.deepEqual(bytes, archive);
        assert.deepEqual(filenames.sort(), Object.keys(entries).sort());
        return entries;
    };
    return { run, jobs, artifact, entries, responses, calls, api, unpack };
}

test('original successful attempt and exact archive survive later failed/skipped reruns and main maintenance', () => {
    for (const conclusion of ['failure', 'skipped']) {
        const f = fixture();
        f.responses['actions/runs/123'].conclusion = conclusion;
        assert.deepEqual(retainedArtifact(selection, f).entries, f.entries);
        assert(!f.calls.some((path) => path.endsWith('/actions/runs/123')));
        assert(f.calls.some((path) => path.endsWith('/attempts/1')));
        assert(f.calls.some((path) => path.endsWith('/artifacts/456/zip')));
        // No equality comparison with evolving current-main workflow bytes.
        assert(!f.calls.some((path) => path.includes('/contents/')));
    }
});

for (const [name, mutate] of [
    ['wrong attempt', (f) => { f.run.run_attempt = 2; }],
    ['failed original attempt', (f) => { f.run.conclusion = 'failure'; }],
    ['wrong run SHA', (f) => { f.run.head_sha = 'b'.repeat(40); }],
    ['PR event', (f) => { f.run.event = 'pull_request'; }],
    ['fork source', (f) => { f.run.head_repository.full_name = 'fork/eslint-plugin-doist'; }],
    ['wrong workflow', (f) => { f.run.path = '.github/workflows/test.yml'; }],
    ['unreviewed source', (f) => { f.responses[`compare/${selection.sourceSha}...main`].status = 'diverged'; }],
    ['wrong archive ID', (f) => { f.artifact.id = 789; }],
    ['wrong archive run', (f) => { f.artifact.workflow_run.id = 999; }],
    ['wrong archive SHA', (f) => { f.artifact.workflow_run.head_sha = 'c'.repeat(40); }],
    ['archive from later attempt', (f) => { f.artifact.created_at = '2026-11-10T13:00:30Z'; }],
    ['absent authoritative digest', (f) => { delete f.artifact.digest; }],
    ['different archive bytes', (f) => { f.artifact.digest = `sha256:${'0'.repeat(64)}`; }],
    ['unsupported schema', (f) => { f.entries['release.json'] = Buffer.from(JSON.stringify({ schemaVersion: 2 })); }],
]) {
    test(`${name} aborts before publication callback`, () => {
        const f = fixture();
        const directory = mkdtempSync(join(tmpdir(), 'eslint-plugin-source-negative-'));
        try {
            for (const [entry, bytes] of Object.entries(f.entries)) writeFileSync(join(directory, entry), bytes);
            let writes = 0;
            const write = () => { writes++; };
            withOriginalArtifact(selection, directory, write, f);
            assert.equal(writes, 1, 'Valid fixture must reach the publication callback');
            mutate(f);
            // Keep the local entries consistent even for the unsupported-schema case.
            for (const [entry, bytes] of Object.entries(f.entries)) writeFileSync(join(directory, entry), bytes);
            assert.throws(() => withOriginalArtifact(selection, directory, write, f));
            assert.equal(writes, 1, 'Rejected evidence must cause zero additional writes');
        } finally { rmSync(directory, { recursive: true, force: true }); }
    });
}

test('local backup ZIP is independently authenticated against API; changed local files cannot self-certify', () => {
    const directory = mkdtempSync(join(tmpdir(), 'eslint-plugin-source-test-'));
    try {
        const f = fixture();
        for (const [name, bytes] of Object.entries(f.entries)) writeFileSync(join(directory, name), bytes);
        writeFileSync(join(directory, archiveFilename), archive);
        let writes = 0;
        const write = () => { writes++; };
        withOriginalArtifact(selection, directory, write, f);
        assert.equal(writes, 1);
        assert(f.calls.some((path) => path.endsWith('/actions/artifacts/456')));
        assert(!f.calls.some((path) => path.endsWith('/zip')), 'Backup uses API digest without redownloading');
        for (const name of Object.keys(f.entries)) {
            writeFileSync(join(directory, name), 'replacement with locally recomputed hashes');
            assert.throws(() => withOriginalArtifact(selection, directory, write, f), /differs from the original archive/);
            writeFileSync(join(directory, name), f.entries[name]);
        }
        writeFileSync(join(directory, archiveFilename), 'replacement archive');
        assert.throws(() => withOriginalArtifact(selection, directory, write, f), /authoritative original/);
        assert.equal(writes, 1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('missing authoritative API evidence stops backup recovery before publication', () => {
    let writes = 0;
    assert.throws(() => withOriginalArtifact(selection, '/nonexistent/mock-source', () => { writes++; }, {
        api: () => { throw new Error('404/auth/network ambiguity'); }, archive,
    }), /ambiguity/);
    assert.equal(writes, 0);
});

test('producer rejects rerun attempt before creating a directory or invoking npm pack', () => {
    const directory = mkdtempSync(join(tmpdir(), 'eslint-plugin-attempt-test-'));
    try {
        const output = join(directory, 'not-created');
        const result = spawnSync(process.execPath, ['.github/scripts/release.mjs', 'pack', output], {
            encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '2' },
        });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Pack only the first attempt/);
        assert(!existsSync(output));
    } finally { rmSync(directory, { recursive: true, force: true }); }
});
