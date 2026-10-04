const {chromium}=require('C:/Users/a/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs');
const out='docs/qa/2026-10-04/production';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true}),errors=[],checks=[];
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.GAME_URL||'https://www.fungood.co.kr/claude_game/';
 await page.goto(base+'?verify=phase-two',{waitUntil:'networkidle'});
 await page.locator('.boss-gate').waitFor();
 const bundle=await page.locator('script[type="module"]').getAttribute('src');
 if(!process.env.GAME_URL)assert.equal(await page.evaluate(()=>typeof window.__claudeGame),'undefined');
 for(const[width,height]of [[320,568],[390,844],[1280,800]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  const layout=await page.evaluate(()=>({canvas:document.querySelector('canvas').getBoundingClientRect().toJSON(),parent:document.querySelector('#game-container').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.ok(Math.abs(layout.canvas.height-layout.parent.height)<1);assert.equal(layout.overflow,false);
  await page.screenshot({path:`${out}/idle-${width}.png`});
 }checks.push('fresh save and responsive layout 320 390 1280');
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-view="craft"]').click();await page.locator('.craft-banner').waitFor();await page.screenshot({path:`${out}/craft.png`});
 await page.getByRole('tab',{name:'상점'}).click();await page.locator('.odds .unique').waitFor();assert.match(await page.locator('.odds').innerText(),/고유 0.5%/);
 await page.locator('[data-view="auction"]').click();await page.getByText('1인용 NPC 경매',{exact:false}).first().waitFor();await page.screenshot({path:`${out}/auction.png`});checks.push('six grades craft and NPC auction deployed');
 await page.locator('.boss-gate').click();await page.locator('#boss-name').waitFor();await page.screenshot({path:`${out}/boss.png`});await page.locator('#leave-combat').click();await page.getByRole('heading',{name:'안전하게 귀환'}).waitFor();await page.getByRole('button',{name:'탐험 계속'}).click();checks.push('live boss entry escape settlement');
 if(!process.env.GAME_URL){
  await page.goto('https://www.fungood.co.kr/game_portal/',{waitUntil:'networkidle'});await page.getByText('Claude Game',{exact:true}).first().waitFor();await page.screenshot({path:`${out}/portal-card.png`});
  await page.goto('https://www.fungood.co.kr/game_portal/#/play/claude-game',{waitUntil:'networkidle'});await page.frameLocator('iframe').locator('.boss-gate').waitFor();await page.screenshot({path:`${out}/portal-iframe.png`});checks.push('portal card and expanded iframe');
 }
 await context.close();
 // An isolated seeded save exercises higher-tier presentation without changing any real user's storage.
 const fixtureContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const fixturePage=await fixtureContext.newPage();fixturePage.setDefaultTimeout(60000);fixturePage.on('pageerror',e=>errors.push(e.message));
 const item=(id,slot,grade)=>({id,slot,grade,name:(grade==='set'?'별빛 세트 ':'별의 심장 ')+slot,identified:true,statBonus:{atk:5,def:5},sockets:[],...(grade==='set'?{setId:'starlight'}:{uniqueEffect:'starheart'})});
 await fixturePage.addInitScript(s=>localStorage.setItem('claude_game_save_v1',JSON.stringify(s)),{character:{equippedItems:['weapon','armor','charm'].map(slot=>item(slot,slot,'set'))},inventory:[item('unique','weapon','unique')],currency:{gold:1000},settings:{autoProgress:false,sound:false}});
 await fixturePage.goto(base,{waitUntil:'networkidle'});await fixturePage.locator('[data-action="equip-item"]').waitFor();await fixturePage.screenshot({path:`${out}/set-equipment.png`});
 await fixturePage.getByRole('tab',{name:'스킬'}).click();await fixturePage.getByText(/별빛 세트 3\/3/).waitFor();await fixturePage.screenshot({path:`${out}/set-effects.png`});
 await fixturePage.getByRole('tab',{name:'장비'}).click();await fixturePage.locator('[data-action="equip-item"][data-item-id="unique"]').click();await fixturePage.getByRole('tab',{name:'스킬'}).click();await fixturePage.getByText(/별의 심장 활성/).waitFor();assert.match(await fixturePage.locator('.stats-grid').innerText(),/15%/);await fixturePage.screenshot({path:`${out}/unique-effects.png`});checks.push('seeded set and unique equipped effects UI');
 assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/results.json`,JSON.stringify({base,bundle,checks,errors},null,2));console.log({bundle,checks,errors});await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
