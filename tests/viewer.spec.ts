import { test, expect } from '@playwright/test';

test('renders the apartment and supports view, layer and camera controls', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  // Avoid an unrelated font service becoming a dependency of browser tests.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  await page.addInitScript(() => {
    const state = { draws: 0, contextLost: false };
    Object.assign(window, { apartmentRender: state });
    const original = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      state.draws++;
      return original.apply(this, args);
    };
    document.addEventListener('webglcontextlost', () => { state.contextLost = true; }, true);
  });
  const renderState = () => page.evaluate(() =>
    (window as unknown as { apartmentRender: { draws: number; contextLost: boolean } }).apartmentRender);
  const capture = async (name: string) => {
    await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
  };

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Apartment 09/ })).toBeVisible();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  // A canvas alone can be blank: require actual indexed geometry draw calls.
  await expect.poll(async () => (await renderState()).draws).toBeGreaterThan(20);
  await expect(page.locator('.room-label')).toHaveCount(5);
  await capture('01-perspective');

  await page.getByRole('checkbox', { name: 'Room labels' }).uncheck();
  await expect(page.locator('.room-label')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Room labels' }).check();
  await expect(page.locator('.room-label')).toHaveCount(5);
  await page.getByRole('checkbox', { name: 'Measurements' }).check();
  await expect(page.locator('.dimension')).toHaveCount(5);

  const beforePlan = (await renderState()).draws;
  await page.getByRole('button', { name: '2D floor plan' }).click();
  await expect(page.getByRole('button', { name: '2D floor plan' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.view-heading')).toContainText('PLAN / XZ');
  await expect.poll(async () => (await renderState()).draws).toBeGreaterThan(beforePlan + 20);
  await capture('02-floor-plan');

  await page.getByRole('button', { name: '3D perspective' }).click();
  await expect(page.getByRole('button', { name: '3D perspective' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('checkbox', { name: 'Measurements' }).uncheck();
  await page.getByRole('checkbox', { name: 'Ceiling' }).check();
  await expect(page.getByRole('checkbox', { name: 'Ceiling' })).toBeChecked();
  await capture('03-ceiling');
  await page.getByRole('checkbox', { name: 'Ceiling' }).uncheck();
  await canvas.scrollIntoViewIfNeeded();

  // Exercise real orbit and zoom input and require a visible canvas change.
  const beforeCamera = await canvas.screenshot();
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height * 0.65, { steps: 12 });
  await page.mouse.up();
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => beforeCamera.equals(await canvas.screenshot())).toBe(false);
  await capture('04-camera-moved');

  const source = await page.request.get('/source-plan.svg');
  expect(source.ok()).toBe(true);
  expect(await source.text()).toContain('<svg');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await renderState()).contextLost).toBe(false);
  expect(errors, 'Browser runtime and console errors').toEqual([]);
});
