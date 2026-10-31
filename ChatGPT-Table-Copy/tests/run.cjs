const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
const suite = process.argv[2] || 'all';
const channel = process.env.TEST_BROWSER_CHANNEL || 'msedge';
const results = [];
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log(`PASS ${name}`);
}
async function route(page) {
  await page.route('https://chatgpt.com/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://chatgpt.com/c/local-extension-test');
}
(async () => {
  const browser = await chromium.launch({headless:true,channel});
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    await route(page);
    if (suite !== 'integration') {
      const file = path.join(root, 'table-export.js');
      if (fs.existsSync(file)) await page.addScriptTag({content:fs.readFileSync(file,'utf8')});
      await check('提供表格导出接口', async () => {
        assert.equal(await page.evaluate(() => typeof globalThis.ChatGPTTableCopy?.serializeTable), 'function');
      });
      await check('保留表格、中文、换行、粗体和链接，且不改变原表', async () => {
        const r = await page.evaluate(() => {
          const table=document.querySelector('#basic'); const before=table.outerHTML;
          const data=ChatGPTTableCopy.serializeTable(table); const d=new DOMParser().parseFromString(data.html,'text/html');
          return {...data, unchanged:before===table.outerHTML, rows:d.querySelectorAll('tr').length,
            strong:d.querySelector('strong')?.textContent, link:d.querySelector('a')?.getAttribute('href'), cells:d.querySelectorAll('th,td').length, color:d.querySelector('td').style.color};
        });
        assert.equal(r.rows,3); assert.equal(r.cells,9); assert.equal(r.unchanged,true);
        assert.equal(r.strong,'基础版'); assert.equal(r.link,'https://example.com/plan');
        assert.match(r.text,/方案\t内容\t备注/); assert.match(r.text,/第一行 \/ 第二行/);
        assert.match(r.html,/border-collapse/); assert.equal(r.color,'rgb(0, 0, 0)');
        fs.writeFileSync(path.join(root,'tests','clipboard-sample.html'),r.html);
      });
      await check('保留合并单元格并从输出中清除危险标记和网页按钮', async () => {
        const r=await page.evaluate(() => {
          const box=document.createElement('div');
          box.innerHTML='<table><tr><th colspan="2">标题</th></tr><tr><td rowspan="2" style="color:red" onclick="alert(1)">甲<script>bad()<\/script><button>复制</button><img src="https://tracking.invalid/pixel"></td><td><a href="javascript:alert(1)">危险</a><a href="https://example.com" data-track="1">安全</a></td></tr><tr><td><ul><li>一</li><li>二</li></ul></td></tr></table>';
          const result=ChatGPTTableCopy.serializeTable(box.firstChild);
          const d=new DOMParser().parseFromString(result.html,'text/html');
          return {...result,colspan:d.querySelector('th').colSpan,rowspan:d.querySelector('td').rowSpan,links:d.querySelectorAll('a[href]').length};
        });
        assert.equal(r.colspan,2); assert.equal(r.rowspan,2); assert.equal(r.links,1);
        assert.doesNotMatch(r.html,/<script|<img|<button|onclick|javascript:|data-track|color:red|bad\(\)/i);
        assert.doesNotMatch(r.text,/bad\(\)|复制/); assert.match(r.text,/一 \/ 二/);
      });
      await check('真实剪贴板同时包含 HTML 与纯文本，且能粘贴为表格', async () => {
        await page.evaluate(() => ChatGPTTableCopy.copyTable(document.querySelector('#basic')));
        const clip=await page.evaluate(async () => {const [item]=await navigator.clipboard.read(); return {types:item.types,html:await(await item.getType('text/html')).text(),text:await(await item.getType('text/plain')).text()};});
        assert.ok(clip.types.includes('text/html')); assert.ok(clip.types.includes('text/plain'));
        assert.match(clip.html,/<table/); assert.match(clip.text,/基础版/);
        await page.locator('#paste-target').focus(); await page.keyboard.press('Control+V');
        await page.waitForSelector('#paste-target table');
        assert.equal(await page.locator('#paste-target table tr').count(),3);
      });
      await check('现代剪贴板失败时通过原生 copy 事件保留表格', async () => {
        await page.evaluate(() => {Object.defineProperty(navigator.clipboard,'write',{configurable:true,value:async()=>{throw new DOMException('blocked','NotAllowedError')}});});
        await page.evaluate(() => ChatGPTTableCopy.copyTable(document.querySelector('#basic')));
        const html=await page.evaluate(async()=> {const [i]=await navigator.clipboard.read();return (await i.getType('text/html')).text()});
        assert.match(html,/<table/); assert.match(html,/基础版/);
      });
      await check('复制失败不会报告成功，且清理临时选区', async () => {
        const r=await page.evaluate(async()=> {Object.defineProperty(document,'execCommand',{configurable:true,value:()=>false});try{await ChatGPTTableCopy.copyTable(document.querySelector('#basic'));return {rejected:false}}catch{return {rejected:true,temporary:document.querySelectorAll('[data-cgtc-clipboard]').length}}});
        assert.equal(r.rejected,true); assert.equal(r.temporary,0);
      });
    }
    await context.close();
  } finally {await browser.close();}
  if (suite !== 'exporter') {
    const profile=path.join(root,'..','browser-test-profile');
    // A normal offscreen window is required for Word: headless Chrome uses an isolated clipboard.
    const nativeClipboard = process.env.VERIFY_WORD === '1';
    const extensionArgs=channel==='chrome'?['--enable-unsafe-extension-debugging']:[`--disable-extensions-except=${root}`,`--load-extension=${root}`];
    if (nativeClipboard) extensionArgs.push('--window-position=-32000,-32000');
    const context=await chromium.launchPersistentContext(profile,{headless:!nativeClipboard,channel,ignoreDefaultArgs:['--disable-extensions'],viewport:{width:1100,height:950},permissions:['clipboard-read','clipboard-write'],args:extensionArgs});
    try {
      let extensionId;
      if (channel==='chrome') {
        const cdp=await context.browser().newBrowserCDPSession();
        const loaded=await cdp.send('Extensions.loadUnpacked',{path:root});
        extensionId=loaded.id;
        await cdp.detach();
      }
      const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await route(page);
      await check('真实扩展为助手表格添加按钮，不处理用户表格',async()=> {
        await page.waitForSelector('[data-cgtc-toolbar]',{timeout:5000});
        assert.equal(await page.locator('[data-cgtc-toolbar]').count(),2);
        assert.equal(await page.locator('[data-message-author-role="user"] [data-cgtc-toolbar]').count(),0);
      });
      await check('按钮复制当前最新表格，且支持键盘操作',async()=> {
        await page.evaluate(()=>document.querySelector('#basic tbody').insertAdjacentHTML('beforeend','<tr><td>动态新增</td><td>最新内容</td><td>已生成</td></tr>'));
        const button=page.locator('[data-cgtc-toolbar] button').first();
        await button.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-cgtc-toolbar] button').textContent.includes('已复制'));
        const r=await page.evaluate(async()=> {const [i]=await navigator.clipboard.read();return {html:await(await i.getType('text/html')).text(),text:await(await i.getType('text/plain')).text()}});
        assert.match(r.html,/动态新增/);assert.match(r.text,/最新内容/);assert.doesNotMatch(r.html,/复制表格/);
      });
      if (process.env.VERIFY_WORD === '1') await check('Microsoft Word 实际粘贴为 4 行 3 列可编辑表格并保留粗体和链接',async()=> {
        const {execFileSync}=require('node:child_process');
        const script=Buffer.from(fs.readFileSync(path.join(__dirname,'word-test.ps1'),'utf8'),'utf16le').toString('base64');
        const output=execFileSync('powershell.exe',['-NoProfile','-EncodedCommand',script],{timeout:45000,encoding:'utf8',windowsHide:true});
        fs.writeFileSync(path.join(root,'tests','word-result.json'),output.trim());
        console.log(output.trim());
      });
      await check('表格位于倒序弹性布局时，复制按钮仍在表格上方',async()=> {
        await page.evaluate(()=>document.querySelector('#dynamic').innerHTML='<article data-message-author-role="assistant" id="reverse"><div class="markdown"><div style="display:flex;flex-direction:column-reverse"><table id="reverse-table"><tr><td>倒序布局</td></tr></table><button>网页原有操作</button></div></div></article>');
        await page.waitForFunction(()=>document.querySelectorAll('[data-cgtc-toolbar]').length===3);
        const toolbar=await page.locator('#reverse [data-cgtc-toolbar]').boundingBox();
        const table=await page.locator('#reverse-table').boundingBox();
        assert.ok(toolbar.y+toolbar.height<=table.y,'复制工具条应位于表格上方');
        await page.evaluate(()=>document.querySelector('#dynamic').innerHTML='');
        await page.waitForFunction(()=>document.querySelectorAll('[data-cgtc-toolbar]').length===2);
      });
      await check('动态生成、工具条丢失及会话替换均自动恢复且无重复按钮',async()=> {
        await page.evaluate(()=>document.querySelector('#dynamic').innerHTML='<article data-message-author-role="assistant"><div class="markdown"><table id="new"><tr><td>新会话</td></tr></table></div></article>');
        await page.waitForFunction(()=>document.querySelectorAll('[data-cgtc-toolbar]').length===3);
        await page.evaluate(()=>document.querySelector('[data-cgtc-toolbar]').remove());
        await page.waitForFunction(()=>document.querySelectorAll('[data-cgtc-toolbar]').length===3);
        await page.evaluate(()=>document.querySelector('#dynamic').innerHTML='');
        await page.waitForFunction(()=>document.querySelectorAll('[data-cgtc-toolbar]').length===2);
      });
      await check('宽表横向滚动时按钮保持可见，深浅色布局正常',async()=> {
        const before=await page.locator('[data-cgtc-toolbar] button').nth(1).boundingBox();
        await page.evaluate(()=>document.querySelector('#wide').parentElement.scrollLeft=900);
        const after=await page.locator('[data-cgtc-toolbar] button').nth(1).boundingBox();
        assert.ok(Math.abs(before.x-after.x)<1);assert.ok(after.x+after.width<=1100);
        await page.screenshot({path:path.join(root,'tests','preview-light.png'),fullPage:true});
        await page.evaluate(()=>document.documentElement.classList.add('dark'));
        await page.waitForFunction(()=>getComputedStyle(document.querySelectorAll('[data-cgtc-toolbar] button')[1]).backgroundColor==='rgb(43, 43, 43)');
        const darkStyle=await page.locator('[data-cgtc-toolbar] button').nth(1).evaluate(button=>({background:getComputedStyle(button).backgroundColor,color:getComputedStyle(button).color}));
        assert.equal(darkStyle.background,'rgb(43, 43, 43)');
        assert.equal(darkStyle.color,'rgb(222, 222, 222)');
        await page.screenshot({path:path.join(root,'tests','preview-dark.png'),fullPage:true});
        await page.setViewportSize({width:420,height:900});
        const small=await page.locator('[data-cgtc-toolbar] button').first().boundingBox();
        assert.ok(small.x>=0 && small.x+small.width<=420);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      });
      if (extensionId) await check('扩展说明面板和图标正常加载',async()=> {
        const popup=await context.newPage();
        try {
          await popup.goto(`chrome-extension://${extensionId}/popup.html`);
          assert.equal(await popup.locator('h1').textContent(),'ChatGPT 表格复制助手');
          assert.equal(await popup.locator('li').count(),3);
          assert.ok(await popup.locator('header img').evaluate(img=>img.complete && img.naturalWidth>0));
          await popup.locator('body').screenshot({path:path.join(root,'tests','preview-popup.png')});
        } finally {await popup.close();}
      });
      assert.deepEqual(errors,[]);
    } finally {await context.close();}
  }
  fs.writeFileSync(path.join(root,'tests','results.json'),JSON.stringify({time:new Date().toISOString(),passed:results.length,tests:results},null,2));
  console.log(`\n${results.length} checks passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
