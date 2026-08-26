const { chromium } = require('playwright');

(async () => {
  console.log("Starting playwright...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('response', res => { if (res.status() === 404) console.log("404:", res.url()) });
  
  console.log("Navigating to https://portfolio-alyzr-83921.web.app/advanced...");
  await page.goto('https://portfolio-alyzr-83921.web.app/advanced');
  
  // Wait a bit to let client-side JS run
  await page.waitForTimeout(3000);
  
  await browser.close();
  console.log("Done.");
})();
