import { startBrowser } from '../../morelord-game-master/tests/browser-driver.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await startBrowser();
let playerBrowser, fixtures;
const output = new URL('../test/in-game-reports/', import.meta.url);
async function join(client, name) {
  await client.command('Page.navigate', { url: 'http://127.0.0.1:31400/join' });
  await client.wait('!!document.querySelector("[name=username]")');
  if ((await client.evaluate('document.title')).trim().toLowerCase() !== 'dev1') throw Error('Not Dev1; skipped.');
  await client.evaluate(`document.querySelector('[name=username]').value=${JSON.stringify(name)};document.querySelector('button[name=join]').click()`);
  await client.wait('globalThis.game?.ready && globalThis.MorelordCore?.socket?.ready', 60000);
  if ((await client.evaluate('game.world.id')).toLowerCase() !== 'dev1') throw Error('Not Dev1; skipped.');
}
try {
  await join(browser, 'Chuck');
  const report = JSON.parse(await browser.evaluate(`JSON.stringify(await (async()=>{
    const {runInGameTests}=await import('/modules/morelord-core/scripts/testing/in-game.js');
    const {transferCheck,marketplaceLayoutCheck,containerTransferCheck}=await import('/modules/morelord-marketplace/scripts/testing/transfer.mjs');
    const {horizontalScrollCheck}=await import('/modules/morelord-core/scripts/testing/horizontal-scroll.js');
    return runInGameTests({checks:[horizontalScrollCheck,transferCheck,marketplaceLayoutCheck,containerTransferCheck]});
  })())`));
  await mkdir(output, { recursive: true });
  await writeFile(new URL('transfer.json', output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ gm: report.summary, results: report.results }));
  if (!report.ok) throw Error('GM regression failed');
  fixtures = JSON.parse(await browser.evaluate(`JSON.stringify(await (async()=>{
    const player=game.users.find(user=>user.name==='Graypes'), other=game.users.find(user=>!user.isGM&&user.id!==player.id);
    const baseline=game.messages.map(message=>message.id), actors=[];
    for(const [name,type,owner] of [['Sender','character',player.id],['Recipient','character',other.id],['Group','group',other.id]]) actors.push(await Actor.create({name:'Transfer player test '+name,type,ownership:{[owner]:3}}));
    await actors[0].createEmbeddedDocuments('Item',[{name:'Transfer player test arrows',type:'loot',img:'icons/svg/item-bag.svg',system:{quantity:5}},{name:'Transfer player test sword',type:'weapon',img:'icons/svg/sword.svg',system:{quantity:1}}]);
    return {sourceId:actors[0].id,recipientId:actors[1].id,groupId:actors[2].id,gmId:game.user.id,baseline};
  })())`));
  playerBrowser = await startBrowser(); await join(playerBrowser, 'Graypes');
  const playerReport = JSON.parse(await playerBrowser.evaluate(`JSON.stringify(await (async()=>{
    const {runInGameTests}=await import('/modules/morelord-core/scripts/testing/in-game.js');
    const {playerTransferCheck}=await import('/modules/morelord-marketplace/scripts/testing/transfer.mjs');
    return runInGameTests({checks:[playerTransferCheck(${JSON.stringify(fixtures)})]});
  })())`));
  await writeFile(new URL('transfer-player.json', output), JSON.stringify(playerReport, null, 2));
  console.log(JSON.stringify({ player: playerReport.summary, results: playerReport.results }));
  if (!playerReport.ok) throw Error('Player regression failed');
  await playerBrowser.evaluate(`await (async()=>{
    const {MorelordMarketplaceApp}=await import('/modules/morelord-marketplace/scripts/apps/marketplace-app.js');
    globalThis.transferPreview=new MorelordMarketplaceApp();transferPreview.actorId='${fixtures.sourceId}';transferPreview.actor=game.actors.get(transferPreview.actorId);transferPreview.activeTab='transfer';transferPreview.transferTargetId='${fixtures.recipientId}';
    transferPreview.transferCart.set(game.actors.get('${fixtures.sourceId}').items.contents[0].id,1);await transferPreview.render(true);
  })()`);
  const visuals = [];
  for (const width of [1280, 520, 360]) for (const theme of ['dark', 'light']) {
    await playerBrowser.command('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
    await playerBrowser.evaluate(`document.body.classList.remove('theme-dark','theme-light');document.body.classList.add('theme-${theme}');transferPreview.setPosition({width:${width},height:950,left:0,top:0});`);
    await new Promise(resolve => setTimeout(resolve, 250));
    const visual = await playerBrowser.evaluate(`(()=>{
      const app=transferPreview.element, layout=app.querySelector('.ml-marketplace-transfer-layout'),row=app.querySelector('.ml-item-row'),content=app.querySelector('.ml-page-body');
      const right=content.getBoundingClientRect().right;
      const offenders=[...content.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>right+2&&el.scrollWidth>el.clientWidth).slice(0,10).map(el=>({class:el.className,width:el.clientWidth,scroll:el.scrollWidth}));
      return {offenders,width:${width},theme:'${theme}',coreLoaded:getComputedStyle(row).display==='flex',noOverflow:content.scrollWidth<=content.clientWidth+1,columns:getComputedStyle(layout).gridTemplateColumns,tabs:[...app.querySelectorAll('[role=tab]')].map(tab=>tab.textContent.trim()),headers:[...app.querySelectorAll('thead th')].map(th=>th.textContent)};
    })()`);
    visuals.push(visual);
    await playerBrowser.evaluate("transferPreview.element.querySelector('[role=tablist]').scrollIntoView({block:'start'})");
    await writeFile(new URL(`transfer-${theme}-${width}.png`, output), Buffer.from((await playerBrowser.command('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    if (!visual.noOverflow || !visual.coreLoaded) throw Error(JSON.stringify(visual));
  }
  await writeFile(new URL('transfer-visual.json', output), JSON.stringify(visuals, null, 2));
  console.log(JSON.stringify(visuals));
  await playerBrowser.evaluate(`await transferPreview.close();document.body.classList.remove('theme-light');document.body.classList.add('theme-dark');ui.sidebar.changeTab('chat','primary');ui.sidebar.toggleExpanded(true);globalThis.transferReceiptId=game.messages.filter(message=>message.content.includes('Transfer player test')).at(-1).id;`);
  await new Promise(resolve => setTimeout(resolve, 500));
  await playerBrowser.wait('!!ui.chat.element.querySelector(`.chat-log [data-message-id="${transferReceiptId}"] .ml-marketplace-cart-transaction-card`)');
  const receipt = await playerBrowser.evaluate(`(()=>{
    const card=ui.chat.element.querySelector('.chat-log [data-message-id="'+transferReceiptId+'"] .ml-marketplace-cart-transaction-card');card.scrollIntoView({block:'center'});
    const bounds=card.getBoundingClientRect();return {text:card.textContent,rows:card.querySelectorAll('.ml-marketplace-cart-chat-line').length,source:card.querySelector('.ml-marketplace-transaction-source').textContent,clip:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,scale:1}};
  })()`);
  if (!receipt.rows || receipt.source !== 'Morelord Marketplace' || !receipt.text.includes('transferred items to') || !receipt.text.includes('Items transferred:')) throw Error('Transfer receipt does not match Marketplace cards.');
  await writeFile(new URL('transfer-chat.png', output), Buffer.from((await playerBrowser.command('Page.captureScreenshot', { format: 'png', clip: receipt.clip })).data, 'base64'));
  await writeFile(new URL('transfer-chat.json', output), JSON.stringify(receipt, null, 2));
} finally {
  if (playerBrowser) { try { await playerBrowser.evaluate('await globalThis.transferPreview?.close()'); } catch {} await playerBrowser.close(); }
  if (fixtures) await browser.evaluate(`await (async()=>{
    if(game.world.id.toLowerCase()!=='dev1')throw Error('Not Dev1');
    const ids=game.messages.filter(m=>!${JSON.stringify(fixtures.baseline)}.includes(m.id)&&m.content.includes('Transfer player test')).map(m=>m.id);
    if(ids.length)await ChatMessage.deleteDocuments(ids);
    for(const id of ${JSON.stringify([fixtures.sourceId, fixtures.recipientId, fixtures.groupId])})await game.actors.get(id)?.delete();
  })()`);
  await browser.close();
}
