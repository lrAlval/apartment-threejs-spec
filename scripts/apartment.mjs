#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { runSmoke } from './browser-smoke.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const launcher = fileURLToPath(new URL('../node_modules/agent-browser/bin/agent-browser.js', import.meta.url));
const execute = promisify(execFile);
const layerNames = { ceiling: 'Ceiling', labels: 'Room labels', measurements: 'Measurements' };
const help = `Apartment CLI — agent-browser, JSON output, nonzero exit on failure

npm run apartment -- <command> [arguments] [options]

  open                         Open --url (default http://127.0.0.1:5173)
  inspect                      Read model, UI, camera and WebGL render status
  view 2d|3d                   Select the view through the UI
  layer ceiling|labels|measurements on|off
  camera <x> <y> <z>           Position the 3D camera in metres
  screenshot [path]            Save the current viewport
  browser <arguments...>       Pass commands to agent-browser (snapshot, mouse, ...)
  close                        Close this session's browser
  test                         Serve dist/ and run desktop/narrow-viewport smoke checks

Options (before 'browser' for raw commands):
  --url <http(s) URL>           Test/open an existing local or hosted app
  --session <name>             Interactive session; default apartment-<worktree hash>
  --out <directory>            Test artifacts; default test-results/browser
  --headed                     Show the browser
  --help                       Print this help

For test: run npm run build first, or pass --url. Tests use isolated sessions
and always close their browsers. Other commands keep the session for the next call.
Browser launch/provider options use AGENT_BROWSER_* environment variables.
`;

export async function createClient(session, headed = false) {
  const browser = async (...args) => {
    let stdout;
    try {
      ({ stdout } = await execute(process.execPath, [launcher, '--session', session, '--json',
        ...(headed ? ['--headed'] : []), ...args], {
        cwd: root, timeout: 45_000, maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, AGENT_BROWSER_DEFAULT_TIMEOUT: '20000' },
      }));
    } catch (error) {
      throw new Error(`agent-browser ${args[0]} failed: ${error.stdout || error.stderr || error.message}`);
    }
    const result = JSON.parse(stdout);
    if (!result.success) throw new Error(result.error || JSON.stringify(result));
    return result.data;
  };
  const evaluate = async expression => (await browser('eval', expression)).result;
  const wait = condition => browser('wait', '--fn', condition);
  const ready = () => wait('window.apartment?.version === 1 && window.apartment.getState().render.frames > 2 && window.apartment.getState().render.calls > 0 && window.apartment.getState().render.triangles > 0');
  const inspect = () => evaluate('window.apartment.getState()');
  const settled = async condition => {
    const frame = (await inspect()).render.frames;
    await wait(`window.apartment.getState().render.frames > ${frame + 2} && (${condition})`);
    return inspect();
  };
  return {
    browser, evaluate, wait, ready, inspect,
    async view(mode) {
      if (!['2d', '3d'].includes(mode)) throw new Error('view requires 2d or 3d');
      await browser('find', 'role', 'button', 'click', '--name', mode === '2d' ? '2D floor plan' : '3D perspective');
      return settled(`window.apartment.getState().view === ${JSON.stringify(mode)}`);
    },
    async layer(name, value) {
      if (!layerNames[name] || !['on', 'off'].includes(value)) throw new Error('layer requires ceiling|labels|measurements and on|off');
      if ((await inspect()).layers[name] !== (value === 'on')) {
        await browser('find', 'label', layerNames[name], 'click');
      }
      let condition = `window.apartment.getState().layers.${name} === ${value === 'on'}`;
      // Wait for actual overlay content as well as the view state flag.
      if (name !== 'ceiling') {
        const field = name === 'labels' ? 'labels' : 'dimensions';
        condition += ` && window.apartment.getState().${field} === ${value === 'on' ? 'window.apartment.getState().rooms.length' : '0'}`;
      }
      return settled(condition);
    },
    async camera(position) {
      if (position.length !== 3 || !position.every(Number.isFinite)) throw new Error('camera requires three finite numbers');
      await evaluate(`window.apartment.setCamera(${JSON.stringify(position)})`);
      return settled('true');
    },
    async screenshot(path) {
      path = resolve(path);
      await mkdir(resolve(path, '..'), { recursive: true });
      await browser('screenshot', path);
      return { path };
    },
  };
}

async function main() {
  // Keep raw agent-browser flags untouched after the 'browser' command.
  const raw = process.argv.indexOf('browser', 2);
  const args = raw === -1 ? process.argv.slice(2) : process.argv.slice(2, raw + 1);
  const values = {}, positionals = [];
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--' && !literal) { literal = true; continue; }
    if (!literal && ['--url', '--session', '--out'].includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${arg} requires a value`);
      values[arg.slice(2)] = args[++i];
    } else if (!literal && ['--help', '--headed'].includes(arg)) values[arg.slice(2)] = true;
    else {
      if (!literal && arg.startsWith('-') && !Number.isFinite(Number(arg))) throw new Error(`Unknown option: ${arg}`);
      positionals.push(arg);
    }
  }
  const [command, ...params] = positionals;
  if (values.help || !command) { console.log(help); return; }
  if (!['open', 'inspect', 'view', 'layer', 'camera', 'screenshot', 'browser', 'close', 'test'].includes(command)) throw new Error(`Unknown command: ${command}. Use --help.`);
  const counts = { open: 0, inspect: 0, view: 1, layer: 2, camera: 3, screenshot: params.length ? 1 : 0, close: 0, test: 0 };
  if (command !== 'browser' && params.length !== counts[command]) throw new Error(`Invalid arguments for ${command}. Use --help.`);
  if (values.url && !['http:', 'https:'].includes(new URL(values.url).protocol)) throw new Error('--url requires http or https');
  if (command === 'test') {
    const report = await runSmoke({ url: values.url, out: resolve(values.out || 'test-results/browser'), headed: values.headed, createClient });
    console.log(JSON.stringify(report));
    process.exitCode = report.ok ? 0 : 1;
    return;
  }
  const { createHash } = await import('node:crypto');
  const session = values.session || `apartment-${createHash('sha256').update(root).digest('hex').slice(0, 10)}`;
  const client = await createClient(session, values.headed);
  let data;
  switch (command) {
    case 'open': await client.browser('open', values.url || 'http://127.0.0.1:5173'); await client.ready(); data = await client.inspect(); break;
    case 'inspect': data = await client.inspect(); break;
    case 'view': data = await client.view(params[0]); break;
    case 'layer': data = await client.layer(...params); break;
    case 'camera': data = await client.camera(params.map(Number)); break;
    case 'screenshot': data = await client.screenshot(params[0] || 'test-results/apartment.png'); break;
    case 'browser': data = await client.browser(...process.argv.slice(raw + 1)); break;
    case 'close': data = await client.browser('close'); break;
  }
  console.log(JSON.stringify({ ok: true, session, data }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
}
