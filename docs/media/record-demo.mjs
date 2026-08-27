import fs from 'node:fs'
const OUT = '/tmp/demorec'
const W = 1280, H = 800

const t = await (await fetch('http://127.0.0.1:9222/json/new?http://localhost:3311', { method: 'PUT' })).json()
await new Promise(r => setTimeout(r, 1200))
const list = await (await fetch('http://127.0.0.1:9222/json')).json()
const ws = new WebSocket(list.find(p => p.id === t.id).webSocketDebuggerUrl)
let id = 0; const pend = new Map(); const frames = []; let n = 0
const send = (m, p) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { const q = pend.get(m.id); pend.delete(m.id); m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result) }
  if (m.method === 'Page.screencastFrame') {
    const f = `${OUT}/f${String(n++).padStart(5, '0')}.png`
    fs.writeFileSync(f, Buffer.from(m.params.data, 'base64'))
    frames.push({ file: f, ts: Date.now() })
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {})
  }
})
await new Promise(r => ws.addEventListener('open', r))
await send('Page.enable', {}); await send('Runtime.enable', {})
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false })
const ev = x => send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }).then(r => r.result.value)
const wait = ms => new Promise(r => setTimeout(r, ms))
await send('Page.navigate', { url: 'http://localhost:3311/' })
await wait(3500)

// Hide the Next dev-mode badge. It is a local artifact, not part of the product.
await ev(`(()=>{const s=document.createElement('style');s.textContent='nextjs-portal,#__next-build-watcher,[data-nextjs-toast]{display:none!important}';document.head.appendChild(s)})()`)

// A synthetic pointer: a screencast records the page, not the OS cursor.
// data-feedback-ui keeps the picker from ever targeting it.
await ev(`(()=>{const c=document.createElement('div');c.id='__cursor';c.setAttribute('data-feedback-ui','');
c.style.cssText='position:fixed;width:22px;height:22px;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform';
c.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 2l6 16 2.2-6.4L19.6 9z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
document.body.appendChild(c);window.__mv=(x,y)=>{c.style.transform='translate('+x+'px,'+y+'px)'};window.__mv(640,700);
const r=document.createElement('div');r.id='__ring';r.setAttribute('data-feedback-ui','');
r.style.cssText='position:fixed;width:34px;height:34px;border-radius:50%;border:2px solid rgba(99,102,241,.9);left:0;top:0;z-index:2147483646;pointer-events:none;opacity:0;transform:translate(-999px,-999px)';
document.body.appendChild(r);window.__click=(x,y)=>{r.style.transition='none';r.style.transform='translate('+(x-17)+'px,'+(y-17)+'px) scale(.5)';r.style.opacity='1';
requestAnimationFrame(()=>{r.style.transition='transform 320ms ease-out,opacity 320ms ease-out';r.style.transform='translate('+(x-17)+'px,'+(y-17)+'px) scale(1.5)';r.style.opacity='0'})};})()`)

let cx = 640, cy = 700
const beats = []
let t0 = Date.now()
const beat = (label) => { beats.push({ label, ms: Date.now() - t0 }) }
async function move(x, y, ms = 620) {
  const steps = Math.max(8, Math.round(ms / 26)); const sx = cx, sy = cy
  for (let i = 1; i <= steps; i++) {
    const p = i / steps, e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    const x2 = Math.round(sx + (x - sx) * e), y2 = Math.round(sy + (y - sy) * e)
    await ev(`window.__mv(${x2},${y2})`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x2, y: y2, buttons: 0 })
    await wait(26)
  }
  cx = x; cy = y
}
async function click() {
  await ev(`window.__click(${cx},${cy})`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 })
  await wait(340)
}
const centreOf = async (sel) => JSON.parse(await ev(`JSON.stringify((()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})())`))
const findBtn = async (re) => JSON.parse(await ev(`JSON.stringify((()=>{const b=[...document.querySelectorAll('button')].find(b=>${re}.test(b.textContent));if(!b)return null;const r=b.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})())`))

await send('Page.startScreencast', { format: 'png', quality: 92, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 })
t0 = Date.now()

beat('open on the page'); await wait(2000)
const trig = await findBtn('/^feedback$/'); await move(trig.x, trig.y, 900); beat('cursor reaches the trigger'); await wait(700)
await click(); beat('composer opens'); await wait(1300)
const pick = await findBtn('/Point at an element/'); await move(pick.x, pick.y, 520); await click(); beat('picking mode'); await wait(900)

const c1 = await centreOf('[data-feedback-label="MCP integration"]'); await move(c1.x, c1.y, 800); beat('hover preview, first card'); await wait(1400)
const c2 = await centreOf('[data-feedback-label="Element context"]'); await move(c2.x, c2.y, 700); beat('outline follows to the next'); await wait(1400)
const c3 = await centreOf('[data-feedback-label="Human-in-the-loop"]'); await move(c3.x, c3.y, 700); beat('and the next'); await wait(1300)
await move(c2.x, c2.y, 650); await wait(600); await click(); beat('click locks the selection'); await wait(1700)

const ta = await centreOf('[role="dialog"] textarea'); await move(ta.x, ta.y, 600); await click(); await wait(200)
beat('typing while the outline holds')
for (const ch of 'The wording here is ambiguous.') { await send('Input.insertText', { text: ch }); await wait(38) }
await wait(1200)

const re = await findBtn('/different/'); await move(re.x, re.y, 620); await click(); beat('pick a different one'); await wait(1000)
await move(c3.x, c3.y, 800); await wait(900); await click(); beat('new target, comment intact'); await wait(1800)

const sel = await centreOf('[role="dialog"] select'); if (sel) { await move(sel.x, sel.y, 520); await wait(400) }
await ev(`(()=>{const s=document.querySelector('[role="dialog"] select');if(s){s.value='confusing';s.dispatchEvent(new Event('change',{bubbles:true}))}})()`)
beat('choose a category'); await wait(1100)
const em = await centreOf('[role="dialog"] input[type="email"], [role="dialog"] input')
if (em) { await move(em.x, em.y, 520); await click(); for (const ch of 'eric@klaviyo.com') { await send('Input.insertText', { text: ch }); await wait(34) } }
beat('who to follow up with'); await wait(900)

const sendBtn = await findBtn('/Send feedback/'); await move(sendBtn.x, sendBtn.y, 620); await click(); beat('send'); await wait(2600)
beat('confirmed'); await wait(2200)

await send('Page.stopScreencast', {})
fs.writeFileSync(`${OUT}/beats.json`, JSON.stringify(beats, null, 2))
const lines = frames.map((f, i) => {
  const dur = ((i < frames.length - 1 ? frames[i + 1].ts : f.ts + 120) - f.ts) / 1000
  return `file '${f.file}'\nduration ${Math.max(0.016, dur).toFixed(3)}`
}).join('\n')
fs.writeFileSync(`${OUT}/frames.txt`, lines + `\nfile '${frames[frames.length - 1].file}'\n`)
console.log('frames:', frames.length, '| duration:', ((frames[frames.length - 1].ts - frames[0].ts) / 1000).toFixed(1) + 's')
console.log(beats.map(b => `  ${(b.ms / 1000).toFixed(1)}s  ${b.label}`).join('\n'))
ws.close()
