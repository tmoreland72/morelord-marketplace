// Offline template/CSS verification; does not connect to or mutate a Foundry world.
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {startBrowser} from '../../morelord-game-master/tests/browser-driver.mjs';
const modules=path.resolve(import.meta.dirname,'../..');
const publicRoot='E:/Foundry14/App/resources/app/public';
const handlebars=createRequire('E:/Foundry14/App/resources/app/package.json')('handlebars');
const template=handlebars.compile(await readFile(path.resolve(import.meta.dirname,'../templates/shop-manager.hbs'),'utf8'));
const item={uuid:'Compendium.test.items.Item.sword',name:'Longsword',img:'/icons/svg/sword.svg',source:'Test catalog',rarityLabel:'Common',typeLabel:'Weapon',packId:'test.items',documentId:'sword',finite:true,quantity:3};
const body=template({premiumAllowed:true,shops:[{id:'test',name:'Test Shop',img:'/icons/svg/house.svg',selected:true}],selected:{id:'test',name:'Test Shop',allowBuying:true,allowSelling:true,manualInventoryOnly:true,excludeMagical:true,img:'/icons/svg/house.svg',buyModifier:1,sellModifier:.5,purchaseItems:[item],randomInventory:{counts:{}},inventory:[item],inventoryCount:1},inventoryLookupOpen:true,purchaseLookup:true,inventorySearchResults:[item],inventorySearchQuery:'sword'});
const html=`<!doctype html><html><head><link rel="stylesheet" href="/fonts/fontawesome/css/all.min.css"><link rel="stylesheet" href="/css/foundry2.css"><link rel="stylesheet" href="/modules/morelord-core/styles/morelord-core.css"><link rel="stylesheet" href="/modules/morelord-marketplace/styles/marketplace.css"></head><body class="game vtt theme-dark"><div class="application ml-window ml-marketplace-module ml-marketplace-shop-manager" style="position:relative;width:100%;height:100vh"><div class="window-content">${body}</div></div></body></html>`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}const module=u.pathname.startsWith('/modules/');const base=module?modules:publicRoot;const file=path.resolve(base,'.'+(module?u.pathname.slice(8):u.pathname));if(!file.startsWith(path.resolve(base)+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await startBrowser();
const output=path.resolve(import.meta.dirname,'../test/ui-reports');await mkdir(output,{recursive:true});
try{
 await browser.command('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 await browser.wait('!!document.querySelector("[name=manualInventoryOnly]")');
 const results=[];
 for(const width of [1240,700]){
  await browser.command('Emulation.setDeviceMetricsOverride',{width:1400,height:1000,deviceScaleFactor:1,mobile:false});
  for(const theme of ['dark','light']){
   const result=await browser.evaluate(`(()=>{document.body.className='game vtt theme-${theme}';document.querySelector('[name=inventorySearch]').closest('section').hidden=false;document.querySelector('.application').style.width='${width}px';const purchase=document.querySelector('[data-action=removePurchaseItem]');purchase.scrollIntoView({block:'center'});const inventory=document.querySelector('[data-action=removeInventoryItem]').closest('.ml-item-row');const row=purchase.closest('.ml-item-row');const search=document.querySelector('[name=inventorySearch]');search.focus();const toggle=document.querySelector('[name=manualInventoryOnly]');const before=toggle.checked;toggle.click();const toggled=toggle.checked!==before;toggle.click();const magic=document.querySelector('[name=excludeMagical]');const magicBefore=magic.checked;magic.click();const magicToggled=magic.checked!==magicBefore;magic.click();return {theme:'${theme}',width:${width},magicToggled,matchingRows:row.className===inventory.className&&getComputedStyle(row).padding===getComputedStyle(inventory).padding,matchingHeaders:document.querySelectorAll('.ml-section-heading[data-actions] > .ml-actions > button').length===2,purchaseRowFits:row.scrollWidth<=row.clientWidth+1,editorFits:document.querySelector('.ml-marketplace-shop-editor-scroll').scrollWidth<=document.querySelector('.ml-marketplace-shop-editor-scroll').clientWidth+1,searchHasLabel:!!search.closest('label'),toggled,coreLoaded:getComputedStyle(row).display==='flex',lookupResults:document.querySelectorAll('[data-action=addInventoryItem]').length};})()`);
   assert(result.magicToggled&&result.matchingRows&&result.matchingHeaders&&result.purchaseRowFits&&result.editorFits&&result.searchHasLabel&&result.toggled&&result.coreLoaded&&result.lookupResults===1,JSON.stringify(result));results.push(result);
   await browser.evaluate(`document.querySelector('[name=inventorySearch]').closest('section').hidden=true;document.querySelector('[data-action=removePurchaseItem]').closest('section').scrollIntoView({block:'start'});`);
   await writeFile(path.join(output,`shop-manual-${theme}-${width}.png`),Buffer.from((await browser.command('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
 }
 await writeFile(path.join(output,'shop-manual.json'),JSON.stringify({kind:'offline-template-css',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();server.close();}
