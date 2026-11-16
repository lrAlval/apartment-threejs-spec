import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSmoke } from './browser-smoke.mjs';

test('browser startup failure fails CI, writes evidence and attempts session cleanup', async () => {
  const out = await mkdtemp(join(tmpdir(), 'apartment-smoke-'));
  const closed = [];
  try {
    const report = await runSmoke({ url: 'http://unused.invalid', out, createClient: async session => ({
      browser: async command => {
        if (command === 'close') { closed.push(session); return {}; }
        throw new Error('Chrome failed to launch');
      },
    }) });
    assert.equal(report.ok, false);
    assert.equal(report.profiles.length, 2);
    assert(report.profiles.every(profile => !profile.ok && profile.checks[0].ok === false && profile.error.includes('Chrome failed to launch')));
    assert.equal(new Set(closed).size, 2);
    assert.deepEqual(JSON.parse(await readFile(join(out, 'report.json'), 'utf8')), report);
  } finally { await rm(out, { recursive: true, force: true }); }
});

test('invalid camera coordinates and unknown options exit nonzero before launching a browser', () => {
  for (const args of [['camera', '-5', 'NaN', '10'], ['view', '2d', '--typo']]) {
    assert.throws(() => execFileSync(process.execPath, ['scripts/apartment.mjs', ...args], { stdio: 'pipe' }), error => {
      assert.equal(error.status, 1);
      const result = JSON.parse(error.stderr.toString());
      assert.equal(result.ok, false);
      assert.match(result.error, /finite numbers|Unknown option/);
      return true;
    });
  }
});
