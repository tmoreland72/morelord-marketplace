// Offline rendering with installed Foundry/Core CSS; never connects to a world.
import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { startBrowser } from '../../morelord-game-master/tests/browser-driver.mjs';
const modules = path.resolve(import.meta.dirname, '../..');
const publicRoot = 'E:/Foundry14/App/resources/app/public';
const hbs = createRequire('E:/Foundry14/App/resources/app/package.json')('handlebars');
for (const file of ['shopping-context', 'transfer-context', 'inventory-table', 'sell-tab', 'buy-tab', 'transfer-tab', 'wishlist-tab']) hbs.registerPartial(`modules/morelord-marketplace/templates/parts/${file}.hbs`, await readFile(path.join(modules, `morelord-marketplace/templates/parts/${file}.hbs`), 'utf8'));
hbs.registerPartial('modules/morelord-core/templates/components/quantity-controls.hbs', await readFile(path.join(modules, 'morelord-core/templates/components/quantity-controls.hbs'), 'utf8'));
const managerTemplate = hbs.compile(await readFile(path.join(modules, 'morelord-marketplace/templates/shop-manager.hbs'), 'utf8'));
const marketTemplate = hbs.compile(await readFile(path.join(modules, 'morelord-marketplace/templates/marketplace.hbs'), 'utf8'));
const item = { stockKey: 'test:sword', uuid: 'Item.sword', ownedItemId: 'sword', name: 'Longsword with a descriptive name', img: '/icons/svg/sword.svg', source: 'Test catalog', rarityLabel: 'Common', typeLabel: 'Weapon', finite: true, quantity: 3, cartQty: 2, sellPrice: '10 gp', buyPrice: '20 gp', lineTotal: '40 gp' };
const plans = [ ['manual', 'Manually added items only'], ['unlimited', 'Unlimited catalog'], ['limited', 'Random stock'], ['hybrid', 'Unlimited common + random rarer stock'] ].map(([key, label]) => ({ key, label, description: 'Restock Now applies this plan.', selected: key === 'limited' }));
const selected = { id: 'test', name: 'Example Shop', img: '/icons/svg/house.svg', type: 'general', allowBuying: true, allowSelling: true, buyModifier: 1, sellModifier: .5, stockPlans: plans, randomInventory: { counts: { common: 6, uncommon: 3, rare: 1, veryrare: 0, legendary: 0 } }, locations: [{ id: '', name: 'No shared Location' }], capabilityTiers: [{ key: '', label: 'Inherit from Location' }, { key: 'uncommon', label: 'Uncommon' }], purchaseItems: [item], inventory: [item], inventoryCount: 1 };
const choices = [{ id: 'actor', name: 'Example Adventurer', selected: true }, { id: 'group', name: 'Party Group' }];
const pages = new Map();
for (const isNewShop of [false, true]) pages.set(isNewShop ? 'new-shop' : 'manager', managerTemplate({ premiumAllowed: true, isNewShop, selected: { ...selected, isDraft: isNewShop }, shops: [selected], presets: [{ key: 'general', label: 'General Store', icon: 'fa-store' }], prefabs: [{ id: 'prefab', name: 'Example Prefab', matchedCount: 12 }] }));
for (const tab of ['sell', 'buy', 'transfer', 'wishlist', 'shop-buy']) {
  const activeTab = tab === 'shop-buy' ? 'buy' : tab;
  pages.set(tab, marketTemplate({ actor: { name: 'Example Adventurer' }, fundingActor: {}, isShop: tab === 'shop-buy', shopName: 'Example Shop', shopImg: '/icons/svg/house.svg', isGM: true, activeTab, isSellTab: activeTab === 'sell', isBuyTab: activeTab === 'buy', isTransferTab: activeTab === 'transfer', isWishlistTab: activeTab === 'wishlist', shopperOptions: choices, fundingOptions: choices, showShopperSelector: true, showFundingSelector: true, transferTargets: choices, transferCartItems: [item], transferCartCount: 2, sellItems: [item], sellCartItems: [item], sellCartCount: 3, cartItems: [item], cartCount: 3, buyItems: [item], currency: '100 gp', cartTotal: '40 gp', sellCartTotal: '30 gp', cartRemaining: '60 gp', filters: {} }));
}
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (pages.has(u.pathname.slice(1))) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(`<!doctype html><html><head><link rel="stylesheet" href="/fonts/fontawesome/css/all.min.css"><link rel="stylesheet" href="/css/foundry2.css"><link rel="stylesheet" href="/modules/morelord-core/styles/morelord-core.css"><link rel="stylesheet" href="/modules/morelord-marketplace/styles/marketplace.css"></head><body class="game vtt theme-dark"><div class="application ml-window ml-marketplace-module ${['manager', 'new-shop'].includes(u.pathname.slice(1)) ? 'ml-marketplace-shop-manager' : ''}" style="position:relative;width:100%;height:100vh"><div class="window-content">${pages.get(u.pathname.slice(1))}</div></div></body></html>`);
    }
    const module = u.pathname.startsWith('/modules/'), base = module ? modules : publicRoot;
    const file = path.resolve(base, '.' + (module ? u.pathname.slice(8) : u.pathname));
    if (!file.startsWith(path.resolve(base) + path.sep)) throw Error();
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await startBrowser();
const output = path.resolve(import.meta.dirname, '../test/ui-reports/editor'); await mkdir(output, { recursive: true });
const reports = [];
try {
  await browser.command('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  for (const page of pages.keys()) {
    await browser.command('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/${page}` });
    await browser.wait(`document.readyState==='complete' && location.pathname==='/${page}' && !!document.querySelector('.ml-app-shell')`);
    await browser.evaluate(`await (async()=>{
      const {decorateActorSelect}=await import('/modules/morelord-core/scripts/ui/actor-identity.js');
      globalThis.fromUuidSync=()=>({img:'/icons/svg/mystery-man.svg'});
      document.querySelectorAll('[data-ml-marketplace-shopper-select], [data-ml-marketplace-funding-select], [data-ml-marketplace-transfer-target]').forEach(select=>decorateActorSelect(select));
      const {applyPageLayout}=await import('/modules/morelord-core/scripts/ui/page-layout.js');
      applyPageLayout({element:document.querySelector('.application')},document.querySelector('.application'));
    })()`);
    for (const width of [1280, 520, 360]) for (const theme of ['dark', 'light']) {
      const report = await browser.evaluate(`(()=>{
        document.body.className='game vtt theme-${theme}';const root=document.querySelector('.application');root.style.width='${width}px';
        const body=root.querySelector('.ml-page-body'),cart=root.querySelector('.ml-marketplace-cart-panel');
        if(!body)throw Error(root.outerHTML.slice(0,1200));
        const selectors=[...root.querySelectorAll('.ml-actor-select-field')];
        const portraitsInside=selectors.every(label=>{const s=label.querySelector('select').getBoundingClientRect(),p=label.querySelector('[data-ml-actor-select-preview] img')?.getBoundingClientRect();return !p||p.left>=s.left&&p.right<=s.right&&p.top>=s.top&&p.bottom<=s.bottom;});
        return {page:'${page}',theme:'${theme}',width:${width},noOverflow:body.scrollWidth<=body.clientWidth+2,offenders:[...body.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>body.getBoundingClientRect().right+2).slice(0,8).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,80)})),portraitsInside,coreLoaded:getComputedStyle(root.querySelector('.ml-surface')).borderRadius!=='0px',cartCore:!cart||!!cart.querySelector('.ml-marketplace-cart-heading') && !!cart.querySelector('.ml-marketplace-cart-footer'),cartHasSelector:!!cart?.querySelector('select'),newShopButton:!!root.querySelector('[data-action=newShop]'),templates:!!root.querySelector('[data-action=createShop]'),shopTransfer:!!root.querySelector('[data-tab=transfer]')};
      })()`);
      reports.push(report);
      await writeFile(path.join(output, `${page}-${theme}-${width}.png`), Buffer.from((await browser.command('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
      assert(report.noOverflow && report.portraitsInside && report.coreLoaded && report.cartCore && !report.cartHasSelector, JSON.stringify(report));
      if (page === 'manager') assert(report.newShopButton && !report.templates);
      if (page === 'new-shop') assert(report.templates && !report.newShopButton);
      if (page === 'shop-buy') assert(!report.shopTransfer);
    }
  }
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ kind: 'offline-installed-foundry-core-styles', reports }, null, 2));
  await browser.close(); server.close();
}
console.log(`${reports.length} offline layout/theme checks passed.`);
