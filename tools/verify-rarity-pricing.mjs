import {startBrowser} from '../../morelord-game-master/tests/browser-driver.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await startBrowser();
try {
 await browser.command('Page.navigate',{url:'http://127.0.0.1:31400/join'});
 await browser.wait('document.readyState === "complete"');
 if((await browser.evaluate('document.title')).trim().toLowerCase()!=='dev1') throw Error('Not Dev1; skipped.');
 await browser.evaluate(`document.querySelector('[name=username]').value='Chuck';document.querySelector('button[name=join]').click()`);
 await browser.wait('globalThis.game?.ready',60000);
 const report=await browser.evaluate(`if(game.world.id.toLowerCase()!=='dev1')throw Error('Not Dev1'); const {runInGameTests}=await import('/modules/morelord-core/scripts/testing/in-game.js'); const {rarityPricingCheck,fragmentationGrenadeCheck}=await import('/modules/morelord-marketplace/scripts/testing/rarity-pricing.mjs'); await runInGameTests({checks:[rarityPricingCheck,fragmentationGrenadeCheck]})`);
 await mkdir(new URL('../test/in-game-reports/',import.meta.url),{recursive:true});
 await writeFile(new URL('../test/in-game-reports/2026-09-24-rarity-pricing.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 if(!report.ok)process.exitCode=1;
} finally { await browser.close(); }
