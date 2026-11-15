import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function runSmoke({ url, out, headed, createClient }) {
  const report = { ok: false, profiles: [], artifacts: out };
  await mkdir(out, { recursive: true });
  let server;
  try {
    if (!url) {
      const { preview } = await import('vite');
      server = await preview({ root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'silent', preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
      url = 'http://127.0.0.1:4173';
    }
    for (const [name, width, height] of [['desktop', 1440, 1000], ['narrow', 412, 915]]) {
      const profile = { name, ok: false, checks: [], screenshots: [] };
      report.profiles.push(profile);
      // Never take over or close an agent's interactive session.
      const client = await createClient(`apartment-test-${process.pid}-${name}`, headed);
      const check = async (name, action) => {
        try { await action(); profile.checks.push({ name, ok: true }); }
        catch (error) { profile.checks.push({ name, ok: false, error: error.message }); throw error; }
      };
      const capture = async label => {
        const { path } = await client.screenshot(resolve(out, `${name}-${label}.png`));
        profile.screenshots.push(path);
      };
      let opened = false;
      try {
        await check('launch and render real WebGL geometry', async () => {
          await client.browser('open');
          opened = true;
          await client.browser('set', 'viewport', String(width), String(height));
          // Stub only optional web fonts; app assets and browser errors stay visible.
          await client.browser('network', 'route', 'https://fonts.googleapis.com/*', '--body', '');
          await client.browser('open', url);
          await client.ready();
          const state = await client.inspect();
          assert.equal(state.view, '3d');
          assert.equal(state.rooms.length, 5);
          assert.equal(state.render.contextLost, false);
          assert(state.render.calls > 0 && state.render.triangles > 0);
          assert(state.render.meshes > state.rooms.length);
        });
        await capture('perspective');
        await check('room label and measurement UI toggles', async () => {
          assert.equal((await client.layer('labels', 'off')).labels, 0);
          assert.equal((await client.layer('labels', 'on')).labels, 5);
          assert.equal((await client.layer('measurements', 'on')).dimensions, 5);
        });
        await check('2D camera and rendered floor plan', async () => {
          const state = await client.view('2d');
          assert.equal(state.camera.type, 'OrthographicCamera');
          assert(state.render.triangles > 0);
        });
        await capture('floor-plan');
        await check('3D camera and ceiling geometry', async () => {
          assert.equal((await client.view('3d')).camera.type, 'PerspectiveCamera');
          assert.equal((await client.layer('ceiling', 'on')).render.ceilingMeshes, 4);
        });
        await capture('ceiling');
        await check('ceiling and measurements removal', async () => {
          assert.equal((await client.layer('ceiling', 'off')).render.ceilingMeshes, 0);
          assert.equal((await client.layer('measurements', 'off')).dimensions, 0);
        });
        await check('agent camera positioning', async () => {
          const state = await client.camera([10, 8, 10]);
          assert(state.camera.position.every((v, i) => Math.abs(v - [10, 8, 10][i]) < 0.05));
        });
        await client.browser('scrollintoview', 'canvas');
        const bounds = await client.evaluate('(() => { const r = document.querySelector("canvas").getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()');
        const x = bounds.x + bounds.width * 0.65, y = bounds.y + bounds.height * 0.55;
        await client.browser('mouse', 'move', String(x), String(y));
        await check('pointer orbit changes the camera', async () => {
          const before = (await client.inspect()).camera.position;
          await client.browser('mouse', 'down', 'left');
          try { await client.browser('mouse', 'move', String(x - bounds.width * 0.2), String(y + 30), '--steps', '12'); }
          finally { await client.browser('mouse', 'up', 'left'); }
          await client.wait(`window.apartment.getState().camera.position.some((v,i)=>Math.abs(v-${JSON.stringify(before)}[i])>0.1)`);
        });
        await check('wheel zoom changes camera distance', async () => {
          const { position, target } = (await client.inspect()).camera;
          const distance = Math.hypot(...position.map((v, i) => v - target[i]));
          await client.browser('mouse', 'wheel', '-200');
          // Orbit damping can still move the camera; only zoom changes its radius.
          await client.wait(`Math.abs(Math.hypot(...window.apartment.getState().camera.position.map((v,i)=>v-${JSON.stringify(target)}[i]))-${distance})>0.1`);
        });
        await capture('camera');
        await check('source trace, responsive layout and healthy renderer', async () => {
          assert.equal(await client.evaluate('(async()=>{const r=await fetch("/source-plan.svg");return r.ok && (await r.text()).includes("<svg");})()'), true);
          const state = await client.inspect();
          assert.equal(state.horizontalOverflow, false, 'Page overflows horizontally');
          assert.equal(state.render.contextLost, false);
          assert(state.render.triangles > 0);
          profile.state = state;
        });
        await check('no browser errors', async () => {
          const errors = await client.browser('errors');
          const consoleLog = await client.browser('console');
          profile.errors = errors;
          profile.console = consoleLog;
          assert.deepEqual(errors.errors, []);
          assert.deepEqual(consoleLog.messages.filter(m => m.type === 'error'), []);
        });
        profile.ok = true;
      } catch (error) {
        profile.error = error.message;
        if (opened) {
          try { await capture('failure'); } catch { /* Keep the original failure. */ }
          try { profile.errors = await client.browser('errors'); } catch { /* Browser may have exited. */ }
        }
      } finally {
        try { await client.browser('close'); }
        catch (error) { profile.cleanupError = error.message; profile.ok = false; }
      }
    }
    report.ok = report.profiles.every(profile => profile.ok);
  } catch (error) {
    report.error = error.message;
  } finally {
    if (server) await new Promise(resolve => server.httpServer.close(resolve));
    await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
  }
  return report;
}
