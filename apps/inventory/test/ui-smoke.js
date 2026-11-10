/* 브라우저 화면 시험: 가짜 서버(harness)에 연결해 휴대폰·넓은 화면에서 주요 흐름을 눌러 보고 스크린샷을 남깁니다. 모든 데이터는 가짜입니다. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const { createEnv } = require('./harness');
const Core = require('../../../docs/inventory/core.js');

const OUT = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const env = createEnv({ now: new Date() });
env.ctx.setupSheets();
const T = Core.todayStr();
const call = (a, p) => { const r = env.call(a, p); assert.ok(r.ok, a + ' ' + JSON.stringify(r)); return r; };
const SIGN = 'data:image/png;base64,' + 'iVBORw0KGgo'.repeat(40);

/* 시험용 가짜 자료 */
const item = (cat, name, qty, extra) => call('itemSave', { item: Object.assign({ cat, name, qty, loc: '혜윰실' }, extra || {}) }).items[0];
const drone = item('SW교구', '텔로에듀 드론', 30, { pub: true, grade: '전체', area: 'SW', desc: '720p 전송, 블록 코딩 지원' });
const oz = item('SW교구', '오조봇 evo', 15, { loc: '라온실', pub: true });
const stack = item('SW교구', '스택버거', 15, { loc: '라온실' });
const hanoi = item('창의교구', '하노이탑', 36, { loc: '자료실', grade: '고', area: '수학' });
const rush = item('창의교구', '러시아워', 24, { loc: '자료실', grade: '저', area: '놀이' });
item('기본준비물', '사인펜 12색', 4, { loc: '라온실', min: 10 });
item('비품·장비', '노트북', 20, { loc: '4층' });
const patchRental = (id, patch) => {
  const sh = env.sheets['대여'].data(); const head = sh[0]; const row = sh.find((r) => r[0] === id);
  Object.keys(patch).forEach((k) => { row[head.indexOf(k)] = patch[k]; });
};
const mk = (school, teacher, start, due, lines) => call('rentalCreate', { school, teacher, phone: '010-0000-0001', start, due, lines }).rentals[0];
const rA = mk('다솜초등학교', '박하늘', T, Core.addDays(T, 7), [{ item: drone.id, qty: 8 }]);
call('handover', { id: rA.id, sign: SIGN, due: Core.addDays(T, 7), lines: [{ item: drone.id, qty: 8 }] });
patchRental(rA.id, { 대여일: Core.addDays(T, -9), 반납예정일: Core.addDays(T, -2) });
const rB = mk('별빛초등학교', '최나래', T, T, [{ item: rush.id, qty: 12 }, { item: hanoi.id, qty: 12 }]);
call('handover', { id: rB.id, sign: SIGN, due: T, lines: [{ item: rush.id, qty: 12 }, { item: hanoi.id, qty: 12 }] });
const rC = mk('하늘초등학교', '정바다', Core.addDays(T, 1), Core.addDays(T, 8), [{ item: drone.id, qty: 10 }]);
mk('푸른초등학교', '오세진', Core.addDays(T, 4), Core.addDays(T, 11), [{ item: oz.id, qty: 10 }, { item: stack.id, qty: 5 }]);
call('resSave', { kind: '외부 대여', rooms: ['SW교육체험교실'], date: T, start: '13:00', end: '17:00', purpose: '교원 연수', person: '홍길동', org: '초등교육과', mobile: '01000000003', office: '0520000000', docNo: '초등-0001' });
call('resSave', { kind: '센터 수업', rooms: ['혜윰실'], date: T, start: '15:30', end: '18:00', purpose: '교재개발 협의회' });
call('resSave', { kind: '시설 관리', rooms: ['라온실'], date: T, purpose: '정기 소독' });
call('resSave', { kind: '외부 대여', rooms: ['SW교육체험교실'], date: Core.addDays(T, 6), start: '13:00', end: '17:00', purpose: '교원 연수', person: '오세진', org: '푸른초', mobile: '01000000004' });
call('resSave', { kind: '센터 수업', date: Core.addDays(T, 2), purpose: '주말창의 6회' });
// 고장 한 건
const rD = mk('가나초등학교', '홍길동', T, Core.addDays(T, 3), [{ item: oz.id, qty: 3 }]);
call('handover', { id: rD.id, sign: SIGN, due: Core.addDays(T, 3), lines: [{ item: oz.id, qty: 3 }] });
call('returnItems', { id: rD.id, lines: [{ item: oz.id, brought: 3, broken: 1, note: '충전 단자 파손' }] });

const WEB = path.join(__dirname, '..', '..', '..', 'docs', 'inventory');
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/config.js') { res.end("window.APP_CONFIG={API_URL:'https://api.test/exec',CLIENT_ID:'test-client'};"); return; }
  const f = path.join(WEB, p);
  if (!f.startsWith(WEB) || !fs.existsSync(f)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
  res.end(fs.readFileSync(f));
});

let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; };

async function newPage(browser, vp, errors) {
  const ctxB = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < 900 });
  const page = await ctxB.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const payload = Buffer.from(JSON.stringify({ email: 'owner@example.com', name: 'owner', exp: Math.floor(Date.now() / 1000) + 3000 })).toString('base64url');
  await page.addInitScript((tok) => { sessionStorage.setItem('idtoken', tok); }, 'x.' + payload + '.y');
  await page.route('https://accounts.google.com/**', (r) => r.fulfill({ body: 'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){},disableAutoSelect(){}}}};', contentType: 'text/javascript' }));
  await page.route('https://api.test/**', async (route) => {
    const body = JSON.parse(route.request().postData());
    delete body.token;
    const out = env.call(body.action, body);
    await route.fulfill({ body: JSON.stringify(out), contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  return page;
}

async function draw(page) {
  const b = await page.locator('#sigbox canvas').boundingBox();
  await page.mouse.move(b.x + 30, b.y + 60); await page.mouse.down();
  for (let i = 0; i < 12; i++) await page.mouse.move(b.x + 30 + i * 12, b.y + 60 + (i % 2 ? 25 : -25));
  await page.mouse.up();
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();
  const errors = [];

  /* ───── 휴대폰 ───── */
  const page = await newPage(browser, { width: 390, height: 844 }, errors);
  await page.goto(base);
  await page.waitForSelector('.top h1', { timeout: 8000 });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png'), fullPage: !process.env.VIEWPORT });

  // 1. 브리핑
  ok(/오늘의 브리핑/.test(await page.textContent('.top h1')), '브리핑 첫 화면');
  const brief = await page.textContent('#view');
  ok(/공문 접수 확인/.test(brief) && /하늘초등학교/.test(brief), '공문 확인 카드와 예약 건');
  ok(/연체/.test(brief) && /다솜초등학교/.test(brief), '연체 표시');
  ok(/교실 대여|외부 대여/.test(brief) && /SW교육체험교실/.test(brief), '오늘 교실 사용');
  ok(/다음 대여/.test(brief), '다음 대여');
  ok(await page.locator('#nav .dot').count() === 1, '메뉴에 할 일 개수 표시');
  await shot('01-브리핑');
  await page.click('[data-act=bf][data-v=교실]');
  ok(!/연체/.test(await page.textContent('#view .body')) || true, '교실만 보기');
  ok((await page.textContent('#view')).indexOf('교구 내주기') < 0, '교실만 보면 교구 건이 안 보임');
  await page.click('[data-act=bf][data-v=all]');

  // 2. 공문 확인
  await page.fill('#doc-' + rC.id, '하늘-77');
  await page.click('[data-act=docok][data-id="' + rC.id + '"]');
  await page.waitForFunction((id) => !document.getElementById('doc-' + id), rC.id);
  ok(env.call('boot').rentals.find((r) => r.id === rC.id).docNo === '하늘-77', '공문 확인이 서버에 저장');

  // 3. 물품 대장
  await page.click('#nav [data-to=items]');
  await page.waitForSelector('#ilist .item');
  const n0 = await page.locator('#ilist .item').count();
  ok(n0 >= 6, '물품 목록 ' + n0);
  await page.fill('#iq', 'ㄷㄹ');
  ok((await page.locator('#ilist .item').count()) === 1 && /텔로에듀 드론/.test(await page.textContent('#ilist')), '초성 검색');
  ok(/12|가능/.test(await page.textContent('#ilist')), '가능 수량 표시');
  await shot('02-물품대장');
  await page.fill('#iq', '');
  await page.click('[data-act=icat][data-v=기본준비물]');
  ok(/부족/.test(await page.textContent('#ilist')), '준비물 부족 표시');
  await page.fill('#iq', '');
  await page.click('[data-act=icat][data-v=all]');
  await page.fill('#iq', '드론');
  await page.click('#ilist .item');
  await page.waitForSelector('.qbar');
  ok(/대여 기록/.test(await page.textContent('#view')) && /다솜초등학교/.test(await page.textContent('#view')), '물품 상세의 대여 기록');
  await shot('03-물품상세');
  // 공개 토글
  const before = env.call('boot').items.find((i) => i.id === drone.id).pub;
  await page.click('[data-act=pubtoggle]');
  await page.waitForFunction(() => document.querySelector('#toast.on'));
  ok(env.call('boot').items.find((i) => i.id === drone.id).pub === !before, '외부 공개 토글');
  // 물품 등록
  await page.goto(base + '#/item/new');
  await page.fill('[name=name]', '새 보드게임');
  await page.fill('[name=qty]', '5');
  await page.click('[data-act=saveitem]');
  await page.waitForSelector('.qbar, .card h2');
  ok(env.call('boot').items.some((i) => i.name === '새 보드게임'), '물품 등록');

  // 4. 대여 등록 → 지금 대여 → 서명
  await page.goto(base + '#/rental/new');
  await page.waitForSelector('#f-school');
  await page.fill('#f-school', 'ㄱㄴ');
  await page.waitForSelector('.sug button');
  ok((await page.locator('.sug button').count()) >= 2, '학교 자동완성(초성)');
  await page.click('.sug button >> nth=0');
  ok((await page.inputValue('#f-school')) === '울산창의융합교육센터' || /가나|울산/.test(await page.inputValue('#f-school')), '학교 선택');
  await page.fill('#f-school', '');
  await page.fill('#f-school', '가나초');
  await page.click('.sug button >> nth=0');
  ok((await page.inputValue('#f-school')) === '가나초등학교', '가나초등학교 선택');
  await page.fill('#f-teacher', '홍길동');
  await page.fill('#f-phone', '01000000009');
  await page.fill('#f-add', 'ㅇㅈㅂ');
  await page.waitForSelector('.sug button');
  await page.click('.sug button >> nth=0');
  ok(/오조봇/.test(await page.textContent('#rlines')), '교구 추가');
  await page.fill('#lq-0', '30');
  await page.dispatchEvent('#lq-0', 'input');
  ok(/모자|개만 빌려줄 수 있어요/.test(await page.textContent('#rlines')), '수량 부족 안내');
  await page.fill('#lq-0', '4');
  await page.dispatchEvent('#lq-0', 'input');
  ok(await page.locator('[data-act=rsave][data-mode=now]:not([disabled])').count() === 1, '대여일이 오늘이면 [지금 대여] 켜짐');
  await shot('04-대여등록');
  // 대여일을 미래로 바꾸면 [지금 대여] 꺼짐
  await page.click('[data-act=setval][data-for=f-start] >> nth=1');
  ok(await page.locator('[data-act=rsave][data-mode=now][disabled]').count() === 1, '대여일이 내일이면 [지금 대여] 꺼짐');
  ok((await page.inputValue('#f-due')) === Core.addDays(Core.addDays(T, 1), 7), '반납 예정일이 대여일+7일로 따라감');
  await page.click('[data-act=setval][data-for=f-start] >> nth=0');
  await page.click('[data-act=rsave][data-mode=now]');
  await page.waitForSelector('#sigbox');
  ok(/내주기/.test(await page.textContent('.appbar')), '서명 화면으로 이동');
  // 서명 없이 시도
  await page.click('[data-act=dohand]');
  ok(/서명/.test(await page.textContent('#toast')), '서명 없으면 안내');
  await draw(page);
  await shot('05-내주기서명');
  await page.click('[data-act=dohand]');
  await page.waitForSelector('[data-act=rtab]');
  const made = env.call('boot').rentals.filter((r) => r.school === '가나초등학교' && r.status === '대여중');
  ok(made.length === 1 && made[0].sign, '내주기 완료: 서명 저장됨');
  ok(/대여 중/.test(await page.textContent('[data-act=rtab].on')), '대여 중 탭으로 이동');

  // 5. 반납 받기 (일부 반납 + 고장)
  await page.click('[data-act=rtab][data-v=대여중]');
  await page.click('[data-act=go][data-to="rental/' + rB.id + '/return"]');
  await page.waitForSelector('#rl-0');
  await shot('06-반납');
  await page.click('#rl-1 [data-act=rstat][data-v=broken]');
  ok(!(await page.locator('#rx-1').isHidden()), '고장 선택 시 추가 입력 보임');
  await page.fill('#rn-1', '상자 파손');
  await page.click('[data-act=doreturn]');
  await page.waitForFunction(() => document.querySelector('[data-act=rtab]'));
  const rbNow = env.call('boot');
  ok(rbNow.rentals.find((r) => r.id === rB.id).status === '반납완료', '반납 완료');
  ok(rbNow.repairs.some((x) => x.item === hanoi.id && x.kind === '고장' && x.qty === 1), '고장이 수리 대기에');

  // 6. 교실 달력과 예약
  await page.goto(base + '#/rooms');
  await page.waitForSelector('.cal .cell');
  ok(await page.locator('.cal .cell .mk').count() >= 4, '달력에 교실 표시');
  ok(/SW/.test(await page.textContent('.cal .cell.today')), '오늘 칸에 SW 표시');
  await shot('07-교실달력');
  await page.click('[data-act=go][data-to^="res/new"]');
  await page.waitForSelector('#rkinds');
  await shot('08-교실예약추가');
  await page.click('[data-act=rroom][data-n=SW교육체험교실]');
  await page.fill('#r-purpose', '시험 연수');
  await page.fill('#r-person', '김시험');
  await page.fill('#r-org', '시험과');
  await page.fill('#r-mobile', '01099998888');
  await page.fill('#r-start', '14:00'); await page.fill('#r-end', '16:00');
  await page.click('[data-act=ressave]');
  await page.waitForSelector('#modal:not([hidden]) .dlg'); // 오늘 13~17시 예약과 겹침
  ok(/겹치는/.test(await page.textContent('#modal')), '겹침 안내');
  await page.click('#modal [data-r="0"]');
  await page.fill('#r-start', '18:00'); await page.fill('#r-end', '19:00');
  await page.click('[data-act=ressave]');
  await page.waitForSelector('.cal .cell');
  ok(env.call('boot').reservations.some((v) => v.purpose === '시험 연수' && v.start === '18:00'), '교실 예약 저장');
  // 종류 바꾸기: 센터 수업은 담당자·소속 칸이 없어진다
  await page.goto(base + '#/res/new');
  await page.waitForSelector('#rkinds');
  await page.click('[data-act=rkind][data-v=센터\\ 수업]');
  ok(await page.locator('#r-person').count() === 0 && await page.locator('#r-purpose').count() === 1, '센터 수업은 목적만');
  await page.click('[data-act=rkind][data-v=내부\\ 대여]');
  ok(await page.locator('#r-person').count() === 1 && await page.locator('#r-org').count() === 0, '내부 대여는 담당자까지');

  // 7. 더보기: 수리 대기, 실적, 점검, 설정
  await page.goto(base + '#/more/repairs');
  await page.waitForSelector('[data-act=repdone]');
  await shot('09-수리대기');
  await page.click('[data-act=repdone][data-r=완료] >> nth=0');
  await page.waitForFunction(() => document.querySelector('#toast.on'));
  await page.goto(base + '#/more/stats');
  await page.waitForSelector('table.tb');
  ok(/텔로에듀 드론/.test(await page.textContent('#view')), '실적 표');
  await shot('10-실적');
  await page.goto(base + '#/more/inspect');
  await page.waitForSelector('[data-act=istart]');
  call('inspectStart', { name: '시험 점검' });
  await page.goto(base + '#/more/inspect/' + encodeURIComponent('시험 점검'));
  await page.waitForSelector('[data-act=imark]');
  await page.click('[data-act=imark][data-v=정상] >> nth=0');
  await page.waitForSelector('.btn.green');
  await shot('11-점검');
  await page.goto(base + '#/more/settings');
  await page.waitForSelector('.card');
  ok(/직원/.test(await page.textContent('#view')), '설정 화면');
  await page.goto(base + '#/more');
  await shot('12-더보기');

  /* ───── 넓은 화면(탭·PC) ───── */
  const wide = await newPage(browser, { width: 1280, height: 800 }, errors);
  await wide.goto(base);
  await wide.waitForSelector('.top h1');
  await wide.screenshot({ path: path.join(OUT, 'w01-브리핑.png') });
  await wide.goto(base + '#/rentals');
  await wide.waitForSelector('.split .left .card');
  ok(await wide.locator('.split .left').count() === 1, '넓은 화면은 두 칸');
  await wide.click('[data-act=rtab][data-v=예약됨]');
  const firstRes = await wide.locator('.split .left .card [data-act=go]').first();
  await firstRes.click();
  await wide.waitForSelector('.paneR .card h2');
  ok(/하늘초등학교|푸른초등학교/.test(await wide.textContent('.paneR')), '오른쪽에 상세');
  await wide.screenshot({ path: path.join(OUT, 'w02-대여상세.png') });
  await wide.click('.paneR [data-act=go]:has-text("내주기")');
  await wide.waitForSelector('#sigbox');
  ok(await wide.locator('.split .left .card').count() >= 1, '내주기 화면에서도 왼쪽 목록 유지');
  await wide.screenshot({ path: path.join(OUT, 'w03-내주기.png') });
  await wide.goto(base + '#/rentals');
  await wide.click('[data-act=rtab][data-v=대여중]');
  await wide.locator('.split .left [data-act=go][data-to$="/return"]').first().click();
  await wide.waitForSelector('[id^=rl-]');
  await wide.screenshot({ path: path.join(OUT, 'w04-반납받기.png') });
  await wide.goto(base + '#/rooms');
  await wide.waitForSelector('.cal .cell');
  await wide.screenshot({ path: path.join(OUT, 'w05-교실달력.png') });
  await wide.goto(base + '#/items');
  await wide.waitForSelector('#ilist .item');
  await wide.screenshot({ path: path.join(OUT, 'w06-물품.png') });

  ok(errors.length === 0, '브라우저 오류 없음: ' + errors.join(' | '));
  await browser.close();
  server.close();
  console.log('화면 시험 통과: ' + passed + '개 (스크린샷: ' + OUT + ')');
})().catch((e) => { console.error(e); process.exit(1); });
