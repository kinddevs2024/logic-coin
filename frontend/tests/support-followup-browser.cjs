const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('fs');
const base=process.env.BASE_URL||'http://127.0.0.1:8120';const account='507f1f77bcf86cd799439011',peer='507f1f77bcf86cd799439012',roomId='6aec91155a459c3c9d8c6ad4';
const games=[['2048','2048'],['color-match','Цвет'],['space-find-number','Космические числа'],['one-second','Одна секунда'],['shadow','Тени'],['find-letter','Найди букву']].map(([key,title])=>({id:key,key,slug:key,title,description:'',icon:'flash',color:'#88bbff',engine:key,difficulty:'medium',family:'arcade',challengeEnabled:true,practiceEnabled:true,state:{status:'not_started',score:0,coinsAwarded:0,doubled:false,completedAt:null}}));
const players=['Умида','Диёра','Сабина','Мурод','Алишер'].map((name,i)=>({id:'player'+i,name,avatarUrl:null,coins:1951+i*4321,balanceUnits:i*3}));
const today={status:'published',available:true,dayKey:'2026-11-13',endsAt:new Date(Date.now()+43200000).toISOString(),totalCount:6,completedCount:0,totalCoinsToday:0,weeklyCompletedDays:1,monthlyCompletedDays:10,monthlyDaysInMonth:30,games,coins:{balance:1951,lifetimeEarned:1951,referralEarned:0},prizes:null};
async function setup(browser,width,lang='ru',touch=false,role='admin',introSeen=true){
 const page=await browser.newPage({viewport:{width,height:854},hasTouch:touch,isMobile:touch});let errors=[],writes=[],memberRequests=[],week='2026-11-09',month='2026-11-01',introWrites=0;
 const room={id:roomId,title:'Logic Coin Community',kind:'group',systemKey:'community',isOfficial:true,description:'Описание сообщества',username:'logiccommunity',visibility:'public',peer:null,unread:0,lastSeq:1,peerReadSeq:0,lastMessageAt:new Date().toISOString(),preview:'Проверка меню сообщения',hasAttachment:false,muted:false,pinned:false,canPost:true,canManage:true,canEditInfo:true,canPromote:true,isOwner:false,inviteCode:null};
 const item={id:'607f1f77bcf86cd799439011',seq:1,sender:{id:peer,name:'Собеседник',avatarUrl:null},text:'Проверка меню сообщения',createdAt:new Date().toISOString(),edited:false,deleted:false,pinned:false,forwardedFrom:null,reply:null,attachments:[],reactions:[],own:false};
 page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**/*',ws=>ws.close());
 await page.route('**/*',r=>{const url=new URL(r.request().url()),u=url.pathname;
 if(u.startsWith('/api/')){let data;
 if(r.request().method()!=='GET'){
  if(r.request().method()==='PATCH'&&u==='/api/v1/me/preferences'){introSeen=!!r.request().postDataJSON().homeIntroSeen;introWrites++;data={preferences:{homeIntroSeen:introSeen}};}
  else if(r.request().method()==='PATCH'&&u===`/api/v1/chat/${roomId}`){const body=r.request().postDataJSON();writes.push(body);Object.assign(room,body);data={ok:true};}
  else if(u.endsWith('/read'))data={ok:true};
  else return r.fulfill({status:503,json:{error:{message:'No production writes'}}});
 }else if(u==='/api/v1/me/preferences')data={preferences:{homeIntroSeen:introSeen}};
 else if(u.endsWith('/profile/roles'))data={roles:{[account]:role}};
 else if(u.endsWith('/activity/home')){const period={from:week,endsAt:new Date(Date.now()+2*86400000).toISOString(),totalDays:7,completedDays:1,missedDays:3,allowedMisses:2,eligible:false,percent:14,participants:players};data={serverNow:new Date().toISOString(),dayKey:today.dayKey,week:period,month:{...period,from:month,totalDays:30,completedDays:10,percent:33,eligible:true,missedDays:3,allowedMisses:4}};}
 else if(u.endsWith('/challenges/today'))data={today};
 else if(u.endsWith('/raffle/state'))data={event:null,serverNow:new Date().toISOString()};
 else if(u==='/api/v1/chat/'||u==='/api/v1/chat')data={chats:[room]};
 else if(u.endsWith('/messages'))data={items:[item],before:null,pinned:[]};
 else if(u.endsWith('/members')){memberRequests.push(url.search);const offset=Number(url.searchParams.get('after')||0);const all=Array.from({length:13},(_,i)=>({id:i===0?account:i===1?peer:'member'+i,name:'Участник '+i,role:'member',canEditInfo:false}));data={members:all.slice(offset,offset+6),count:13,nextCursor:offset+6<13?String(offset+6):null};}
 else if(u.endsWith('/friend-requests'))data={requests:[]};
 else if(u.endsWith('/unread-count'))data={count:0};
 else return r.fulfill({status:503,json:{error:{message:'Isolated fixture'}}});
 return r.fulfill({status:200,json:{data}});
 }
 if(url.hostname!==new URL(base).hostname)return r.abort();return r.continue();});
 await page.addInitScript(({lang,account,role})=>{if(!localStorage.getItem('logic-coin-state-v1'))localStorage.setItem('logic-coin-state-v1',JSON.stringify({version:3,state:{language:lang,onboardingDone:true,authMode:'authenticated',accessToken:'isolated-ui-fixture',user:{id:account,name:'Тест',username:'fixture',countryCode:'UZ',role},theme:'graphite',balanceUnits:640,goalUnits:1000}}));localStorage.setItem('logic-coin:home-tour:v1:'+account,'done');},{lang,account,role});
 return {page,errors,writes,memberRequests,room,item,getIntroWrites:()=>introWrites,nextWeek:()=>week='2026-11-16',nextMonth:()=>month='2026-12-01'};
}
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox'],...(base.startsWith('https:')?{proxy:{server:process.env.HTTPS_PROXY}}:{})});const checks=[];
for(const [width,lang] of (process.env.CHAT_ONLY?[]:process.env.QUICK?[[470,'ru']]:[[470,'ru'],[320,'uz'],[1440,'en']])){
 const {page:p,errors,nextWeek,nextMonth}=await setup(browser,width,lang,false,'user');await p.goto(base,{waitUntil:'networkidle'});await p.locator('.game-row').first().waitFor();
 assert.equal(await p.locator('.game-row').first().evaluate(e=>e.getBoundingClientRect().height),62);
 assert.equal(await p.locator('.games-viewport').evaluate(e=>e.clientHeight),178);
 const dialog=p.locator('dialog[open]'),week=p.getByTestId('home-week-card');
 if(width<600)assert.equal(await dialog.count(),0,'No tutorial before reaching weekly activity');
 await week.locator('.card-heading').evaluate(e=>e.scrollIntoView({block:'center'}));await dialog.waitFor();
 assert.equal(await dialog.locator('li').count(),5);await dialog.screenshot({path:`/workspace/shared/home-chat-rules-${width}.png`});
 await p.keyboard.press('Escape');await week.screenshot({path:`/workspace/shared/home-chat-week-${width}.png`});
 await p.reload({waitUntil:'networkidle'});await week.locator('.card-heading').evaluate(e=>e.scrollIntoView({block:'center'}));await p.waitForTimeout(700);assert.equal(await dialog.count(),0,'Same week not repeated after reload');
 await week.locator('.info-button').click();await dialog.waitFor();await p.keyboard.press('Escape');
 await p.locator('.expand-button').click();await p.waitForTimeout(450);assert((await p.locator('.games-viewport').evaluate(e=>e.clientHeight))>400);await p.locator('.expand-button').click();
 nextWeek();await p.reload({waitUntil:'networkidle'});await week.locator('.card-heading').evaluate(e=>e.scrollIntoView({block:'center'}));await dialog.waitFor();await p.keyboard.press('Escape');
 const monthCard=p.getByTestId('home-month-card');await monthCard.locator('.card-heading').evaluate(e=>e.scrollIntoView({block:'center'}));await dialog.waitFor();assert.equal(await dialog.locator('li').count(),4);await p.keyboard.press('Escape');
 await p.reload({waitUntil:'networkidle'});await monthCard.locator('.card-heading').evaluate(e=>e.scrollIntoView({block:'center'}));await p.waitForTimeout(800);assert.equal(await dialog.count(),0,'Same month suppressed');
 nextMonth();await p.reload({waitUntil:'networkidle'});await monthCard.locator('.card-heading').evaluate(e=>e.scrollIntoView({block:'center'}));await dialog.waitFor();await p.keyboard.press('Escape');
 assert.equal(await week.locator('[role=progressbar]').getAttribute('aria-valuenow'),'14');
 assert.equal(await week.locator('.self-score').innerText(),'14%');
 const water=await week.locator('.profile-water-base').evaluate(e=>({h:e.getBoundingClientRect().height,parent:e.parentElement.getBoundingClientRect().height}));assert(Math.abs(water.h/water.parent-.3)<.03,'Decorative base is 30%, actual completion remains 14%');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);console.log('Home passed',width);checks.push({home:width,lang,weeklyReminder:true,passed:true});await p.close();
}
for(const [width,touch] of (process.env.HOME_ONLY?[]:process.env.QUICK?[[470,true]]:[[1440,false],[470,true],[320,true]])){
 const {page:p,errors,writes,memberRequests}=await setup(browser,width,'ru',touch);await p.goto(base+'/messages?chat='+roomId,{waitUntil:'networkidle'});const bubble=p.locator('#chat-seq-1');await bubble.waitFor();await p.waitForTimeout(350);
 const initialBox=await bubble.boundingBox();await bubble.click({position:{x:initialBox.width/2,y:initialBox.height-12}});assert.equal(await p.getByTestId('message-actions-menu').count(),0,'Click must not open menu');
 const box=await bubble.boundingBox(),x=box.x+box.width/2,y=box.y+box.height-12;
 if(touch){
  await p.touchscreen.tap(x,y);assert.equal(await p.getByTestId('message-actions-menu').count(),0,'Touch tap must not open menu');
  const cdp=await p.context().newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-30}]});await p.waitForTimeout(550);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await p.getByTestId('message-actions-menu').count(),0,'Scroll gesture cancels menu');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await p.waitForTimeout(600);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }else{
  await p.mouse.move(x,y);await p.mouse.down();await p.waitForTimeout(550);await p.mouse.up();assert.equal(await p.getByTestId('message-actions-menu').count(),0,'Mouse hold should not open menu');await bubble.click({button:'right'});
 }
 const menu=p.getByTestId('message-actions-menu');await menu.waitFor();await p.waitForTimeout(300);
 for(const emoji of ['👍','❤️','😂','🔥','🎉','😢']){const el=menu.getByRole('button',{name:emoji,exact:true});assert((await el.boundingBox()).height>=48);assert.equal(await el.locator('div').last().evaluate(e=>getComputedStyle(e).lineHeight),'34px');}
 await p.screenshot({path:`/workspace/shared/home-chat-menu-${width}.png`});await p.mouse.click(width-8,150);await menu.waitFor({state:'detached'});
 await p.getByLabel(/^Настройки: /).click();await p.getByTestId('chat-info-settings').waitFor();assert.equal(await p.getByTestId('chat-info-settings').getByRole('textbox').count(),0,'No input on settings overview');
 await p.waitForTimeout(400);await p.screenshot({path:`/workspace/shared/home-chat-settings-${width}.png`});
 let chooserCount=0;p.on('filechooser',()=>chooserCount++);
 for(const name of [/^@имя группы или канала: /,/^Название: /]){
  await p.getByRole('button',{name}).click();await p.getByRole('button',{name:'Закрыть',exact:true}).click();await p.getByTestId('chat-info-settings').waitFor();await p.waitForTimeout(350);
  assert(await p.getByTestId('chat-info-settings').evaluate(e=>{for(let n=e;n;n=n.parentElement)if(Number(getComputedStyle(n).opacity)<.9)return false;return true;}),'Returned settings must be opaque and interactive');
 }
 assert.equal(chooserCount,0);assert.equal(writes.length,0,'Cancelling must not save');
 assert.equal(memberRequests.length,1,'Only first member page fetched on open');assert.equal(await p.getByRole('button',{name:/^Профиль: Участник /}).count(),6);
 await p.getByRole('button',{name:/Показать ещё/}).click();await p.getByRole('button',{name:'Профиль: Участник 11',exact:true}).waitFor();assert.equal(memberRequests.length,2);assert.equal(await p.getByRole('button',{name:/^Профиль: Участник /}).count(),12);
 await p.getByRole('button',{name:/Показать ещё/}).click();await p.getByRole('button',{name:'Профиль: Участник 12',exact:true}).waitFor();assert.equal(memberRequests.length,3);assert.equal(await p.getByRole('button',{name:/Показать ещё/}).count(),0);
 await p.getByRole('button',{name:/^Название: /,exact:true}).click();await p.getByLabel('Название',{exact:true}).fill('Новое имя');await p.getByRole('button',{name:/Сохранить/}).click();await p.getByRole('button',{name:'Название: Новое имя',exact:true}).waitFor();assert.equal(writes[0].title,'Новое имя');assert.equal(writes[0].description,'Описание сообщества');
 await p.getByRole('button',{name:'Тип чата: Открытый',exact:true}).click();await p.getByRole('radio',{name:/Закрытый/}).click();await p.getByRole('button',{name:/Сохранить/}).click();await p.getByRole('button',{name:'Тип чата: Закрытый',exact:true}).waitFor();assert.equal(writes[1].visibility,'invite');
 await p.getByRole('button',{name:/^Название: /}).click();await p.getByLabel('Название',{exact:true}).fill('Несохранённое имя');
 await p.keyboard.press('Escape');await p.getByTestId('chat-info-settings').waitFor({state:'detached'});await p.waitForTimeout(300);assert.equal(new URL(p.url()).searchParams.get('chat'),roomId,'Escape from settings stays in conversation');await bubble.waitFor();
 await p.keyboard.press('Escape');await p.waitForTimeout(700);assert(!new URL(p.url()).searchParams.get('chat'),'Next Escape returns to chat list');
 assert.deepEqual(errors,[]);console.log('Chat passed',width);checks.push({chat:width,touch,settings:true,passed:true});await p.close();
}
if(!process.env.CHAT_ONLY){
 const {page:p,errors,getIntroWrites}=await setup(browser,470,'ru',false,'user',false);
 await p.goto(base,{waitUntil:'networkidle'});await p.getByText('Играйте в Logic Coin',{exact:true}).waitFor();await p.getByRole('button',{name:'Пропустить',exact:true}).click();await p.waitForTimeout(300);assert.equal(getIntroWrites(),1);
 await p.evaluate(account=>localStorage.removeItem('logic-coin:home-tour:v2:'+account),account);await p.reload({waitUntil:'networkidle'});assert.equal(await p.getByText('Играйте в Logic Coin',{exact:true}).count(),0,'Account marker prevents repeat even without local marker');assert.deepEqual(errors,[]);checks.push({intro:'account-persisted',passed:true});await p.close();
}
await browser.close();fs.writeFileSync(process.env.CHECK_REPORT||'/workspace/shared/support-followup-browser-check.json',JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify(checks));})().catch(e=>{console.error(e);process.exit(1)});
