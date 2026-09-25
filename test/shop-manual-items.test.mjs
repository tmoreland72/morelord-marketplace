import test from 'node:test';
import assert from 'node:assert/strict';
import { ShopService } from '../scripts/services/shop-service.js';
globalThis.foundry = { utils: { deepClone: structuredClone }, applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: Base => Base } } };
const { ActorService } = await import('../scripts/services/actor-service.js');
const row = {uuid:'Compendium.test.items.Item.sword', packId:'test.items', documentId:'sword', name:'Sword', type:'weapon', rarityKey:'common'};
const item = {id:'owned', name:'Renamed sword', type:'weapon', _stats:{compendiumSource:row.uuid}, system:{quantity:1,price:10}, getFlag:()=>undefined};
const policy = {allowSelling:true, purchaseItems:[row], itemOptions:['loot']};

test('purchase list exclusively matches origins, with name/type fallback only for sourceless items', () => {
 assert.equal(ShopService.acceptsPlayerItem(item, policy),true);
 assert.equal(ShopService.acceptsPlayerItem({...item,_stats:{compendiumSource:'Compendium.other.items.Item.sword'},name:'Sword'},policy),false);
 assert.equal(ShopService.acceptsPlayerItem({...item,_stats:{},name:' sword '},policy),true);
 assert.equal(ShopService.acceptsPlayerItem({...item,_stats:{},name:'Sword',type:'loot'},policy),false);
 assert.equal(ShopService.acceptsPlayerItem(item,{...policy,allowSelling:false}),false);
 assert.equal(ShopService.acceptsPlayerItem(item,{...policy,purchaseItems:[]}),false);
 assert.equal(ShopService.acceptsPlayerItem(item,null),true);
});

test('Sell tab filters and checkout reject a newly disallowed item before mutating currency', async t => {
 globalThis.game = {settings:{get:()=>1}};
 const actor = {items:[item,{...item,id:'other',_stats:{compendiumSource:'other'}}]};
 assert.deepEqual((await ActorService.getSellableItems(actor,{shop:policy})).map(row=>row.ownedItemId),['owned']);
 t.mock.method(ShopService,'getShop',()=>({...policy,purchaseItems:[{...row,uuid:'different'}]}));
 await assert.rejects(ActorService.sellCart({items:new Map([['owned',item]])},[{itemId:'owned',quantity:1}],{shop:{id:'test',...policy}}),/no longer available/);
});

test('manual-only catalog excludes random and prefab items; old shops default to automatic catalog', () => {
 const shop=ShopService.normalizeShop({manualInventoryOnly:true,inventoryOverrides:{included:[row.uuid]},prefabItemUuids:['other']});
 assert.equal(ShopService.entryPassesShop(row,shop,row.packId),true);
 assert.equal(ShopService.entryPassesShop({...row,uuid:'other'},shop,row.packId),false);
 assert.equal(ShopService.normalizeShop({}).manualInventoryOnly,false);
 assert.deepEqual(ShopService.normalizeShop({}).purchaseItems,[]);
});

test('manual-only restock restores configured quantities in every mode without random additions', async t => {
 const key=ShopService.stockKey(row);
 for(const inventoryMode of ['unlimited','hybrid','limited']) {
  const shop=ShopService.normalizeShop({id:'test',manualInventoryOnly:true,inventoryMode,inventoryOverrides:{included:[row.uuid],limited:[row.uuid]},manualStockTargets:{[key]:4},stock:{[key]:0,other:20},randomInventory:{enabled:true}});
  t.mock.method(ShopService,'getShop',()=>shop);
  t.mock.method(ShopService,'saveShop',async s=>s);
  t.mock.method(ShopService,'buildRandomStock',()=>{throw Error('Must not draw random stock');});
  const result=await ShopService.restock(shop.id,[row,{...row,uuid:'other',documentId:'other'}]);
  assert.deepEqual(result.stock,{[key]:4});
  assert.equal(ShopService.getStock(result,row),4);
 }
});

test('manual stock target survives purchases, updates with GM quantities, and is removed with listing', async t => {
 let shop=ShopService.normalizeShop({id:'test',inventoryMode:'hybrid',stock:{}});
 t.mock.method(ShopService,'getShop',()=>shop);
 t.mock.method(ShopService,'saveShop',async s=>(shop=s));
 const key=ShopService.stockKey(row);
 await ShopService.addInventoryItem('test',row,3);
 await ShopService.adjustStock('test',row,-3);
 assert.equal(shop.stock[key],0); assert.equal(shop.manualStockTargets[key],3);
 await ShopService.setStock('test',row,5);
 assert.equal(shop.manualStockTargets[key],5);
 await ShopService.removeInventoryItem('test',row);
 assert.equal(shop.manualStockTargets[key],undefined);
 assert.equal(shop.inventoryOverrides.included.length,0);
});

test('default restocking preserves manual quantities and continues generating stock', async t => {
 const key=ShopService.stockKey(row);
 const shop=ShopService.normalizeShop({id:'test',inventoryMode:'limited',inventoryOverrides:{included:[row.uuid],limited:[row.uuid]},manualStockTargets:{[key]:4},stock:{[key]:1},randomInventory:{enabled:true}});
 t.mock.method(ShopService,'getShop',()=>shop);
 t.mock.method(ShopService,'saveShop',async s=>s);
 t.mock.method(ShopService,'buildRandomStock',()=>({'test.items:random':2}));
 const result=await ShopService.restock(shop.id,[row]);
 assert.deepEqual(result.stock,{[key]:1,'test.items:random':2});
 const portable=ShopService.getPortableDefinition(result);
 assert.deepEqual(portable.shop.manualStockTargets,{[key]:4});
 assert.equal(portable.shop.manualInventoryOnly,false);
});

test('magical exclusion uses the property, not rarity, and overrides manual/prefab inclusion', () => {
 const shop=ShopService.normalizeShop({excludeMagical:true,manualInventoryOnly:true,inventoryOverrides:{included:[row.uuid]},prefabItemUuids:[row.uuid]});
 for(const properties of [new Set(['mgc']),['mgc'],{mgc:true}]) {
  assert.equal(ShopService.entryPassesShop({...row,system:{properties}},shop,row.packId),false);
 }
 assert.equal(ShopService.entryPassesShop({...row,properties:[{value:'mgc'}]},shop,row.packId),false);
 assert.equal(ShopService.entryPassesShop({...row,rarityKey:'rare',properties:[]},shop,row.packId),true);
 assert.equal(ShopService.entryPassesShop({...row,properties:[{value:'mgc'}]},{...shop,excludeMagical:false},row.packId),true);
 assert.equal(ShopService.normalizeShop({}).excludeMagical,false);
 assert.equal(ShopService.acceptsPlayerItem({...item,system:{properties:new Set(['mgc'])}},{...policy,excludeMagical:true}),true);
});

test('manual-only restock cannot reintroduce items with Magical property', async t => {
 const shop=ShopService.normalizeShop({id:'test',manualInventoryOnly:true,excludeMagical:true,inventoryOverrides:{included:[row.uuid],limited:[row.uuid]},manualStockTargets:{[ShopService.stockKey(row)]:3}});
 t.mock.method(ShopService,'getShop',()=>shop);
 t.mock.method(ShopService,'saveShop',async s=>s);
 assert.deepEqual((await ShopService.restock('test',[{...row,properties:[{value:'mgc'}]}])).stock,{});
});
