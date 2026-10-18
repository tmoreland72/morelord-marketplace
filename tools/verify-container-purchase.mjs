import { startBrowser } from '../../morelord-game-master/tests/browser-driver.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await startBrowser();
try {
  await browser.command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await browser.command('Page.navigate', { url: 'http://127.0.0.1:31400/join' });
  try {
    await browser.wait('!!document.querySelector("select[name=userId],select[name=username]")', 60000);
  } catch (error) {
    console.error(await browser.evaluate('JSON.stringify({title:document.title,url:location.href,text:document.body.innerText,fields:[...document.querySelectorAll("input,select,button")].map(el=>({tag:el.tagName,name:el.name,text:el.textContent}))})'));
    console.error(browser.errors);
    throw error;
  }
  if ((await browser.evaluate('document.title')).trim().toLowerCase() !== 'dev1') throw Error('Not Dev1; skipped without joining.');
  await browser.evaluate(`(() => {
    const select = document.querySelector('select[name=userId],select[name=username]');
    const option = [...select.options].find(option => option.textContent.trim() === 'Chuck');
    if (!option) throw Error('Regression GM account not found.');
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('button[name=join]').click();
  })()`);
  await browser.wait('globalThis.game?.ready && globalThis.MorelordCore?.socket?.ready', 60000);
  if ((await browser.evaluate('game.world.id')).toLowerCase() !== 'dev1') throw Error('Not Dev1; skipped.');
  const report = JSON.parse(await browser.evaluate(`JSON.stringify(await (async()=>{
    const {runInGameTests}=await import('/modules/morelord-core/scripts/testing/in-game.js');
    const {containerPurchaseCheck}=await import('/modules/morelord-marketplace/scripts/testing/container-purchase.mjs');
    return runInGameTests({checks:[containerPurchaseCheck]});
  })())`));
  const output = new URL('../test/in-game-reports/', import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(new URL('container-purchase.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (!report.ok) process.exitCode = 1;
} finally {
  await browser.close();
}
