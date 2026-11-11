import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repository = 'todoist/eslint-plugin-doist';
export const archiveFilename = 'source-artifact.zip';
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function githubApi(endpoint) {
    return execFileSync('gh', ['api', '--hostname', 'github.com', endpoint], { maxBuffer: 32 * 1024 * 1024 });
}

function unpackArchive(archive, filenames) {
    const directory = mkdtempSync(join(tmpdir(), 'eslint-plugin-source-'));
    try {
        const path = join(directory, archiveFilename);
        writeFileSync(path, archive);
        const entries = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).trim().split('\n');
        assert.deepEqual(entries.sort(), [...filenames].sort(), 'Unexpected or duplicate entries in original archive');
        // Read only the three allowed entries; never extract arbitrary paths/symlinks.
        return Object.fromEntries(filenames.map((filename) => [filename,
            execFileSync('unzip', ['-p', path, filename], { maxBuffer: 32 * 1024 * 1024 })]));
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

// The producer permits attempt 1 only. Never consult mutable /actions/runs/ID latest state.
export function retainedArtifact(selection, { api = githubApi, archive, unpack = unpackArchive } = {}) {
    const { runId, artifactId, sourceSha, version, filename } = selection;
    assert.match(runId || '', /^[1-9]\d*$/, 'Original ARTIFACT_RUN_ID is required');
    assert.match(artifactId || '', /^[1-9]\d*$/, 'Original ARTIFACT_ID is required');
    assert.match(sourceSha, /^[a-f0-9]{40}$/);
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.equal(filename, `todoist-eslint-plugin-doist-${version}.tgz`);
    const base = `repos/${repository}`;
    const json = (endpoint) => JSON.parse(api(`${base}/${endpoint}`));
    const run = json(`actions/runs/${runId}/attempts/1`);
    assert.equal(String(run.id), runId);
    assert.equal(run.run_attempt, 1, 'Only the original attempt is supported');
    assert.equal(run.repository.full_name, repository);
    assert.equal(run.head_repository.full_name, repository);
    assert.equal(run.path, '.github/workflows/publish.yml');
    assert.equal(run.head_sha, sourceSha, 'Original run must match the release checkout');
    assert.equal(run.status, 'completed');
    assert.equal(run.conclusion, 'success', 'Original pack attempt must have succeeded');
    assert(['push', 'workflow_dispatch'].includes(run.event), 'PR artifacts are not release sources');
    assert(['main', `v${version}`].includes(run.head_branch) || (run.event === 'push' && run.head_branch === null));
    const ancestry = json(`compare/${sourceSha}...main`);
    assert(['ahead', 'identical'].includes(ancestry.status), 'Original commit must belong to reviewed main history');

    const jobs = json(`actions/runs/${runId}/attempts/1/jobs?per_page=100`);
    assert.equal(jobs.total_count, jobs.jobs.length, 'Incomplete original-attempt jobs response');
    const packs = jobs.jobs.filter((job) => job.name === 'pack');
    assert.equal(packs.length, 1, 'Original successful pack job is required');
    const pack = packs[0];
    assert.equal(String(pack.run_id), runId);
    assert.equal(pack.head_sha, sourceSha);
    assert.equal(pack.status, 'completed');
    assert.equal(pack.conclusion, 'success');

    const artifact = json(`actions/artifacts/${artifactId}`);
    assert.equal(String(artifact.id), artifactId);
    assert.equal(artifact.name, 'eslint-plugin-doist-release');
    assert.equal(String(artifact.workflow_run.id), runId);
    assert.equal(artifact.workflow_run.head_sha, sourceSha);
    assert.equal(artifact.workflow_run.repository_id, run.repository.id);
    assert.equal(artifact.workflow_run.head_repository_id, run.head_repository.id);
    const created = Date.parse(artifact.created_at);
    assert(created >= Date.parse(pack.started_at) && created <= Date.parse(pack.completed_at),
        'Archive must have been created by the original pack attempt, not a later rerun');
    assert.match(artifact.digest || '', /^sha256:[a-f0-9]{64}$/, 'Authoritative archive digest is required; recover original evidence, never repack');
    const zip = archive || api(`${base}/actions/artifacts/${artifactId}/zip`);
    assert.equal(sha256(zip), artifact.digest, 'Archive differs from the authoritative original GitHub artifact');
    const entries = unpack(zip, [filename, 'release.json', 'SHA256SUMS']);
    const metadata = JSON.parse(entries['release.json']);
    assert.equal(metadata.schemaVersion, 1, 'Unsupported release schema; recover with the original reviewed tooling, never repack');
    assert.equal(metadata.sourceSha, sourceSha);
    assert.equal(metadata.name, '@todoist/eslint-plugin-doist');
    assert.equal(metadata.version, version);
    assert.equal(metadata.filename, filename);
    return { zip, entries, binding: { sourceRunId: runId, sourceArtifactId: artifactId, sourceArchiveDigest: artifact.digest } };
}

export function withOriginalArtifact(selection, directory, operation, options = {}) {
    const path = join(directory, archiveFilename);
    const { entries, binding } = retainedArtifact(selection, {
        ...options, archive: existsSync(path) ? readFileSync(path) : options.archive,
    });
    for (const [filename, bytes] of Object.entries(entries)) {
        assert.deepEqual(readFileSync(join(directory, filename)), bytes,
            `Local ${filename} differs from the original archive; publication stopped`);
    }
    return operation(binding);
}
