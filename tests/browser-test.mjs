import { chromium } from 'playwright';
import path from 'node:path';

async function run() {
  console.log('Launching browser via Playwright...');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.log('Default chromium launch failed, trying with channel chrome...');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/productions/new...');
  await page.goto('http://localhost:3000/productions/new', { waitUntil: 'networkidle' });

  // If there's an existing state, reset or check step
  console.log('Current URL:', page.url());
  const initialTitle = await page.title();
  console.log('Page Title:', initialTitle);

  const fixturePath = path.resolve('tests/fixtures/real-catalog-five-variants.png');
  console.log('Uploading fixture:', fixturePath);

  // Find file input
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(fixturePath);

  console.log('Waiting for analysis and Step 2 to render...');
  await page.waitForSelector('text=Revisión de escena', { timeout: 15000 });
  console.log('✓ Found "Revisión de escena"!');

  // Take screenshot of Step 2
  const screenshot1 = path.resolve('docs/screenshots/step2_scene_review.png');
  await page.screenshot({ path: screenshot1, fullPage: true });
  console.log('✓ Saved screenshot to:', screenshot1);

  // Check scene review text
  const sceneReviewText = await page.locator('text=Revisión de escena').locator('..').textContent();
  console.log('Scene review content:', sceneReviewText);

  // Check color cards
  const colorCards = await page.locator('[data-color-card], .cursor-pointer').allTextContents();
  console.log('Cards detected on page:', colorCards.slice(0, 10));

  // Verify 5 colors are present
  for (const col of ['Celeste', 'Crudo', 'Verde Agua', 'Negro', 'Beige']) {
    const hasColor = await page.locator(`text=${col}`).count();
    console.log(`- Color ${col} visible count: ${hasColor}`);
  }

  // Type commercial name
  const nameInput = page.locator('input[placeholder*="Ej: Remera"]');
  if (await nameInput.count() > 0) {
    await nameInput.fill('Remera de morley estampada');
    console.log('✓ Filled commercial name: Remera de morley estampada');
  }

  // Click Continuar
  const continueBtn = page.locator('button:has-text("Continuar")');
  await continueBtn.click();
  console.log('Clicked Continuar...');

  // Wait for Step 3
  await page.waitForSelector('text=Configuración de Producción', { timeout: 10000 });
  console.log('✓ Step 3 rendered!');

  // Take screenshot of Step 3
  const screenshot2 = path.resolve('docs/screenshots/step3_production_config.png');
  await page.screenshot({ path: screenshot2, fullPage: true });
  console.log('✓ Saved screenshot to:', screenshot2);

  // Check summary
  const bodyText = await page.textContent('body');
  const summaryMatches = bodyText.match(/Total.*?fotos/i) || bodyText.match(/\d+\s*fotos/i);
  console.log('Summary match:', summaryMatches ? summaryMatches[0] : 'None');

  await browser.close();
  console.log('🎉 Browser automation finished successfully!');
}

run().catch(err => {
  console.error('Browser automation error:', err);
  process.exit(1);
});
