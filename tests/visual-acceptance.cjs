const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/a/node_modules/playwright-core');
const assert=require('node:assert/strict');const fs=require('node:fs');
const out='docs/qa/2026-10-03/acceptance';fs.mkdirSync(out,{recursive:true});
const url='http://127.0.0.1:5173/claude_game/';
(async()=>{
 const browser=await chromium.launch({headless:true});const errors=[],checks=[];
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const fixture={character:{level:3,exp:0,stats:{atk:10,def:5,crit:.05},skillPoints:2,skills:{},equippedItems:[]},currency:{gold:500},inventory:[{id:'bag',name:'일반 별빛 지팡이',grade:'normal',statBonus:{atk:1,def:1},slot:'weapon'}],scrapbook:[{id:'book',name:'희귀 별빛 지팡이',grade:'rare',statBonus:{atk:3,def:3},slot:'weapon'}],settings:{autoEquipMinGrade:'normal',sound:false,notifications:true,autoProgress:false}};
 await page.addInitScript(s=>{if(!sessionStorage.getItem('qa-seeded')){localStorage.setItem('claude_game_save_v1',JSON.stringify(s));sessionStorage.setItem('qa-seeded','1');}},fixture);
 await page.goto(url,{waitUntil:'networkidle'});
 const state=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__claudeGame.store.getState())));
 const shot=name=>page.screenshot({path:`${out}/${name}.png`});
 await page.getByRole('tab',{name:'스킬'}).click();await page.locator('[data-skill-id="power_strike"]').click();await page.waitForTimeout(150);
 assert.equal((await state()).character.skills.power_strike,1);checks.push('skill investment');await shot('skills');
 await page.getByRole('tab',{name:'장비'}).click();await page.locator('[data-action="equip-item"]').click();await page.waitForTimeout(150);assert.equal((await state()).character.equippedItems[0].id,'bag');
 await page.locator('[data-item-id="book"]').click();await page.waitForTimeout(150);assert.equal((await state()).character.equippedItems[0].id,'book');assert.equal((await state()).currency.gold,460);checks.push('inventory equip and scrapbook restore');await shot('equipment');
 await page.getByRole('tab',{name:'상점'}).click();await page.getByRole('button',{name:'뽑기 (20골드)'}).click();await page.waitForTimeout(200);assert.equal((await state()).currency.gold,440);assert.ok((await state()).lastPurchase);checks.push('gacha result');await shot('shop');
 await page.getByRole('tab',{name:'설정'}).click();await page.waitForTimeout(120);const gold=(await state()).currency.gold;await page.waitForTimeout(1100);assert.equal((await state()).currency.gold,gold);
 await page.getByRole('switch',{name:'사운드',exact:true}).click();await page.waitForTimeout(150);assert.equal((await state()).settings.sound,true);
 await page.getByRole('switch',{name:'알림',exact:true}).click();await page.waitForTimeout(150);assert.equal((await state()).settings.notifications,false);checks.push('sound, notifications, auto progress settings');await shot('settings');
 const cdp=await context.newCDPSession(page);let h=await page.locator('.panel-handle').boundingBox();let x=h.x+h.width/2,y=h.y+10;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+48}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);
 assert.ok(await page.locator('#bottom-panel').evaluate(e=>e.classList.contains('minimized')));await shot('touch-minimized');await page.locator('.panel-handle').click();checks.push('touch drag minimize and tap expand');
 for(const [width,height]of [[320,568],[360,640],[390,844],[430,932],[1440,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(160);
  const rect=await page.locator('#bottom-panel').boundingBox();assert.ok(rect.height>120&&rect.y+rect.height<=height+1);await shot(`viewport-${width}-${height}`);
 }checks.push('five responsive sizes');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 for(let i=0;i<3;i++){
  await page.locator('canvas').tap({position:{x:180,y:150}});await page.getByRole('button',{name:'나가기'}).waitFor();
  const rect=await page.locator('canvas').boundingBox();assert.equal(rect.height,844);await page.getByRole('button',{name:'나가기'}).click();await page.getByRole('button',{name:'탐험 계속'}).click();
 }checks.push('repeated fullscreen entry and exit');
 await page.locator('canvas').tap({position:{x:180,y:150}});await page.waitForFunction(()=>window.__claudeGame.store.getState().combatSession?.kills>=2);
 const before=await state();await page.reload({waitUntil:'networkidle'});await page.getByRole('heading',{name:'탐험 기록 복구'}).waitFor();
 const after=await state();assert.equal(after.currency.gold,before.currency.gold+before.combatSession.rewards.gold);assert.equal(after.combatSession,null);await shot('recovered');await page.getByRole('button',{name:'탐험 계속'}).click();
 await page.reload({waitUntil:'networkidle'});assert.equal((await state()).currency.gold,after.currency.gold);checks.push('interrupted combat settlement once');
 await page.locator('canvas').tap({position:{x:180,y:150}});
 await page.evaluate(()=>{const s=window.__claudeGame.game.scene.getScene('CombatScene');s.arena.player.hp=1;s.arena.attack=999;s.arena.enemies=[{id:999,x:s.arena.player.x,y:s.arena.player.y,hp:999,kind:0}];});
 await page.getByRole('heading',{name:'다시 도전해요'}).waitFor();await shot('failed-fixture');checks.push('failure settlement with collision fixture');
 await context.close();
 // Fresh level-1 save. Complete a real 180-second run using only touch movement.
 const battleContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const battle=await battleContext.newPage();battle.on('pageerror',e=>errors.push(e.message));
 await battle.goto(url,{waitUntil:'networkidle'});await battle.locator('canvas').tap({position:{x:180,y:150}});
 const touch=await battleContext.newCDPSession(battle);const anchor={x:195,y:730};await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[anchor]});
 const started=Date.now();let milestone=0;
 while(Date.now()-started<250000){
  const s=await battle.evaluate(()=>{const scene=window.__claudeGame.game.scene.getScene('CombatScene');return {active:scene.scene.isActive(),p:scene.arena?.player,elapsed:scene.session?.elapsedMs,result:window.__claudeGame.store.getState().lastResult};});
  if(!s.active){assert.equal(s.result.outcome,'cleared');checks.push('real-time 3 minute touch survival clear');break;}
  const t=s.elapsed/1000,tx=195+110*Math.cos(t*.22),ty=460+220*Math.sin(t*.22);let dx=(tx-s.p.x)/20,dy=(ty-s.p.y)/20;const length=Math.max(1,Math.hypot(dx,dy));dx/=length;dy/=length;
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:anchor.x+dx*38,y:anchor.y+dy*38}]});
  if(t>=milestone){console.log('survival',Math.floor(t),'sec','HP',Math.ceil(s.p.hp));await battle.screenshot({path:`${out}/survival-${milestone}.png`});milestone+=30;}
  await battle.waitForTimeout(180);
 }
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await battle.getByRole('heading',{name:'생존 성공!'}).waitFor({timeout:1000});await battle.screenshot({path:`out`.replace('out',out)+'/survival-cleared.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/results.json`,JSON.stringify({checks,errors},null,2));console.log('PASS',checks);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
