// Visual audit: screenshot the live website as an admin at desktop size.
// Run: node scripts/audit-web.js
const { chromium } = require('playwright');
const path = require('path');

const OUT = path.join(__dirname, 'shots');
const URL = 'https://noor-dentofacial.expo.app';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000); // fonts + splash
  await page.screenshot({ path: path.join(OUT, '01-login.png') });

  // Sign in as admin.
  await page.locator('input').first().fill('admin@noor.clinic');
  await page.locator('input').nth(1).fill('NoorAdmin#2026');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(8000); // auth + dashboard data
  await page.screenshot({ path: path.join(OUT, '02-home.png') });

  // Walk the sidebar tabs by their labels.
  const tabs = ['Patients', 'Inventory', 'Reports', 'Settings'];
  for (let i = 0; i < tabs.length; i++) {
    try {
      await page.getByText(tabs[i], { exact: true }).first().click();
      await page.waitForTimeout(3500);
      await page.screenshot({ path: path.join(OUT, `0${i + 3}-${tabs[i].toLowerCase()}.png`) });
    } catch (e) {
      console.log('skip', tabs[i], e.message.split('\n')[0]);
    }
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
