/* 속도 확인: 가짜 물품 520종·대여 250건·교실 예약 300건으로 화면이 얼마나 빨리 뜨는지 잽니다. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createEnv } = require('./harness');
const Core = require('../../../docs/inventory/core.js');

const env = createEnv({ now: new Date() });
env.ctx.setupSheets();
const T = Core.todayStr();
const LOREM = '▶게임을 통해 수열의 규칙성을 학습할 수 있는 교구 ▶밑판, 원판 9개, 설명서 ▶왼쪽 기둥에 놓인 크기가 다른 원판을 모두 오른쪽 기둥으로 옮기는 게임입니다. '.repeat(2);
let t0 = Date.now();
const cats = ['창의교구', 'SW교구', 'SW교재', '기본준비물'];
const ids = [];
for (let i = 0; i < 520; i++) {
  const r = env.call('itemSave', { item: { cat: cats[i % 4], name: '가짜 교구 ' + i, qty: 10 + (i % 30), loc: ['혜윰실', '라온실', '자료실'][i % 3], desc: LOREM, grade: ['저', '중', '고'][i % 3], area: '놀이', year: '2019\n2020', photo: 'X-' + i + '.jpg' } });
  ids.push(r.items[0].id);
}
console.log('물품 520종 만들기', Date.now() - t0, 'ms (가짜 서버 안에서)');
t0 = Date.now();
for (let i = 0; i < 250; i++) {
  const s = Core.addDays(T, (i % 40) - 20), d = Core.addDays(s, 7);
  const r = env.call('rentalCreate', { school: '가짜초등학교' + (i % 30), teacher: '교사' + i, phone: '010-0000-' + String(1000 + i), start: s, due: d, lines: [{ item: ids[(i * 7) % 390], qty: 1 }, { item: ids[(i * 11 + 1) % 390], qty: 2 }].filter((l) => !/기본준비물/.test(env.call('boot').items.find((x) => x.id === l.item).cat)) });
  if (!r.ok && i < 3) console.log('대여 건너뜀', r.error);
}
for (let i = 0; i < 300; i++) env.call('resSave', { kind: '센터 수업', date: Core.addDays(T, (i % 60) - 30), purpose: '가짜 수업 ' + i, rooms: [['', '혜윰실', '라온실'][i % 3]].filter(Boolean) });
console.log('대여·예약 만들기', Date.now() - t0, 'ms');

const WEB = path.join(__dirname, '..', '..', '..', 'docs', 'inventory');
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/config.js') { res.end("window.APP_CONFIG={API_URL:'https://api.test/exec',CLIENT_ID:'test-client'};"); return; }
  const f = path.join(WEB, p);
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' }[path.extname(f)] || 'text/plain');
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port + '/';
  const bootJson = JSON.stringify(env.call('boot'));
  console.log('처음 불러오는 자료 크기:', Math.round(bootJson.length / 1024) + 'KB');
  const zlib = require('zlib');
  console.log('압축하면:', Math.round(zlib.gzipSync(bootJson).length / 1024) + 'KB');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const payload = Buffer.from(JSON.stringify({ email: 'owner@example.com', exp: Math.floor(Date.now() / 1000) + 3000 })).toString('base64url');
  await page.addInitScript((tok) => sessionStorage.setItem('idtoken', tok), 'x.' + payload + '.y');
  await page.route('https://accounts.google.com/**', (r) => r.fulfill({ body: 'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){}}}};', contentType: 'text/javascript' }));
  await page.route('https://api.test/**', async (route) => {
    const body = JSON.parse(route.request().postData()); delete body.token;
    await route.fulfill({ body: JSON.stringify(env.call(body.action, body)), contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const time = async (label, fn) => { const s = Date.now(); await fn(); console.log(label, Date.now() - s, 'ms'); };
  await time('브리핑이 뜰 때까지(데이터 받기 포함, 서버 시간 제외)', async () => { await page.goto(base); await page.waitForSelector('.top h1'); });
  await time('물품 목록 열기', async () => { await page.click('#nav [data-to=items]'); await page.waitForSelector('#ilist .item'); });
  await time('물품 검색 한 글자 입력', async () => { await page.fill('#iq', 'ㄱ'); await page.waitForSelector('#ilist .item'); });
  await time('대여 목록 열기', async () => { await page.goto(base + '#/rentals'); await page.waitForSelector('.card'); });
  await time('교실 달력 열기', async () => { await page.goto(base + '#/rooms'); await page.waitForSelector('.cal .cell'); });
  await time('교구 추가 검색(대여 등록)', async () => { await page.goto(base + '#/rental/new'); await page.fill('#f-add', 'ㄱㅉ'); await page.waitForSelector('.sug button'); });
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
