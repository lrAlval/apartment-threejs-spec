// Stop hook: once per distinct change to src/ or scripts/, block the turn's end until a CUPID check has run.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
if (input.stop_hook_active) process.exit(0); // already blocked once this turn; avoid loops

const root = path.resolve(import.meta.dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const paths = ['src', 'scripts'];
const diff = git('diff', 'HEAD', '--', ...paths) + git('ls-files', '--others', '--exclude-standard', '--', ...paths);
if (!diff.trim()) process.exit(0);

const marker = path.resolve(root, git('rev-parse', '--git-dir').trim(), 'cupid-checked');
const hash = createHash('sha256').update(diff).digest('hex');
if (existsSync(marker) && readFileSync(marker, 'utf8') === hash) process.exit(0);
writeFileSync(marker, hash);
console.log(JSON.stringify({
  decision: 'block',
  reason: 'src/ or scripts/ changed since the last CUPID check. Run the cupid skill on this diff, fix or report each property, rerun the AGENTS.md gates, then finish.',
}));
