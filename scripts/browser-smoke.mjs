import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTouch } from './browser-touch.mjs';

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
        try {
          await action();
          const { errors } = await client.browser('errors');
          assert.deepEqual(errors, [], `Page errors after: ${name}`);
          profile.checks.push({ name, ok: true });
        }
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
          assert.deepEqual(state.render.soffitUndersides, []);
          assert(state.render.triangles > 0);
        });
        await capture('floor-plan');
        await check('3D camera and ceiling geometry', async () => {
          assert.equal((await client.view('3d')).camera.type, 'PerspectiveCamera');
          const { render } = await client.layer('ceiling', 'on');
          assert.equal(render.ceilingMeshes, 5);
          assert.deepEqual(render.ceilingHeights, [2.44, 2.4, 2.42, 2.43, 2.1]);
          assert.equal(render.soffitUndersides.length, 3);
          assert(render.soffitUndersides.every(y => Math.abs(y - 2.12) < 1e-6));
        });
        await capture('ceiling');
        await check('ceiling and measurements removal', async () => {
          const { render } = await client.layer('ceiling', 'off');
          assert.equal(render.ceilingMeshes, 0);
          assert.equal(render.soffitUndersides.length, 3);
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
        await check('full-span sliding bedroom window and bathroom approach return', async () => {
          const state = await client.inspect();
          assert.equal(state.bedroomWindow.operation, 'sliding');
          assert.equal(state.bedroomWindow.panels, 2);
          assert(Math.abs(state.bedroomWindow.width - 2.83) < 1e-6);
          assert.equal(state.bathroomReturn.a, 'U'); assert.equal(state.bathroomReturn.b, 'T');
        });
        await check('eye-level walkthrough, keyboard movement, reset and overview restoration', async () => {
          const before = await client.inspect();
          const state = await client.view('walk');
          assert.equal(state.view, 'walk'); assert.equal(state.render.ceilingMeshes, 5);
          assert.equal(state.camera.position[1], 1.6); assert.equal(state.labels, 0);
          await client.browser('keydown', 'w');
          try { await client.wait('window.apartment.getState().camera.position[0] < 6.1'); }
          finally { await client.browser('keyup', 'w'); }
          const moved = (await client.inspect()).camera.position;
          assert(moved[0] < 6.1); assert.equal(moved[1], 1.6);
          await client.browser('find', 'role', 'button', 'click', '--name', 'Reset position');
          await client.wait('Math.abs(window.apartment.getState().camera.position[0]-6.35)<0.01');
          await client.browser('keydown', 'd');
          try { await client.wait('window.apartment.getState().camera.position[2]<2.15'); }
          finally { await client.browser('keyup', 'd'); }
          await client.browser('find', 'role', 'button', 'click', '--name', 'Reset position');
          await client.wait('Math.abs(window.apartment.getState().camera.position[2]-2.35)<0.01');
          await capture('walkthrough');
          await client.browser('find', 'role', 'button', 'click', '--name', 'Exit walkthrough');
          await client.wait("window.apartment.getState().view === '3d'");
          const restored = await client.inspect();
          assert.equal(restored.layers.ceiling, before.layers.ceiling);
          assert.equal(restored.labels, before.labels);
          assert(restored.camera.position.every((v,i)=>Math.abs(v-before.camera.position[i])<.08));
        });
        await check('walkthrough drag-look and held movement pad', async () => {
          await client.view('walk');
          const bounds = await client.evaluate('(() => {const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()');
          const rotation = (await client.inspect()).camera.rotation;
          const x=bounds.x+bounds.width*.5, y=bounds.y+bounds.height*.35;
          await client.browser('mouse','move',String(x),String(y));
          await client.browser('mouse','down','left');
          try { await client.browser('mouse','move',String(x+50),String(y+20),'--steps','6'); }
          finally { await client.browser('mouse','up','left'); }
          assert((await client.inspect()).camera.rotation.some((v,i)=>typeof v==='number' && Math.abs(v-rotation[i])>.01));
          await client.browser('find','role','button','click','--name','Reset position');
          const pad=await client.evaluate('(() => {const r=document.querySelector("[aria-label=\\"Walk forward\\"]").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
          await client.browser('mouse','move',String(pad.x),String(pad.y));
          await client.browser('mouse','down','left');
          try { await client.wait('window.apartment.getState().camera.position[0]<6.1'); }
          finally { await client.browser('mouse','up','left'); }
          await client.browser('find','role','button','click','--name','Exit walkthrough');
          await client.wait("window.apartment.getState().view === '3d'");
        });
        if (name === 'narrow') await check('native multi-touch movement and look release cleanly', async () => {
          await client.view('walk');
          const points = await client.evaluate('(() => {const p=document.querySelector(".walk-pad button").getBoundingClientRect();return {pad:{x:p.x+p.width/2,y:p.y+p.height/2},look:{x:180,y:200}};})()');
          await withTouch(client, async touch => {
            const pad={id:1,...points.pad},look={id:2,...points.look};
            await touch('touchStart',[pad]);
            await client.wait('window.apartment.getState().camera.position[0]<6.1');
            const rotation=(await client.inspect()).camera.rotation;
            await touch('touchStart',[pad,look]);
            await touch('touchMove',[pad,{...look,x:look.x+60,y:look.y+15}]);
            await client.wait(`Math.abs(window.apartment.getState().camera.rotation[1]-${rotation[1]})>.05`);
            await touch('touchEnd',[]);
            const stopped=await client.inspect();
            await client.wait(`window.apartment.getState().render.frames>${stopped.render.frames+8}`);
            const after=await client.inspect();
            assert(after.camera.position.every((v,i)=>Math.abs(v-stopped.camera.position[i])<.01));
            assert.equal(after.horizontalOverflow,false);
          });
          await capture('touch-walkthrough');
          await client.browser('find','role','button','click','--name','Exit walkthrough');
          await client.wait("window.apartment.getState().view === '3d'");
        });
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
          try { profile.state = await client.inspect(); } catch { /* App may not have loaded. */ }
          try { profile.console = await client.browser('console'); } catch { /* Browser may have exited. */ }
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
