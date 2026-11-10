/* 서버(gas/Code.gs) 전체 흐름 테스트. 가짜 시트·드라이브 위에서 실행하며 모든 데이터는 가짜입니다. */
'use strict';
const assert = require('assert');
const { createEnv } = require('./harness');

let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; }
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); passed++; }

const env = createEnv({ now: new Date('2026-11-06T10:00:00+09:00') });
env.ctx.setupSheets();
const call = (a, p, e) => env.call(a, p, e);
const good = (a, p, e) => { const r = call(a, p, e); assert.ok(r.ok, a + ' 실패: ' + JSON.stringify(r)); return r; };
const bad = (a, p, code, e) => { const r = call(a, p, e); assert.ok(!r.ok, a + ' 이(가) 성공하면 안 됨'); if (code) assert.strictEqual(r.code, code, a + ' ' + JSON.stringify(r)); passed++; return r; };
const SIGN = 'data:image/png;base64,' + 'iVBORw0KGgo'.repeat(40);
const PHOTO = 'data:image/jpeg;base64,' + 'QUJD'.repeat(50);
const boot = () => good('boot');
const itemOf = (id) => boot().items.find((i) => i.id === id);
const rentalOf = (id) => boot().rentals.find((r) => r.id === id);

/* 1. 처음 설정과 로그인 */
(function setup() {
  const b = boot();
  eq(b.rooms.map((r) => r.name), ['SW교육체험교실', '라온실', '혜윰실', '창의실', '놀이실'], '교실 5곳이 순서대로');
  eq(b.settings.returnDays, 7, '반납 기본 일수 7');
  ok(b.settings.locs.indexOf('혜윰실') >= 0, '보관위치 목록');
  eq(b.staff[0].email, 'owner@example.com', '설정한 사람이 첫 직원으로 등록됨');
  bad('boot', {}, 'FORBIDDEN', 'stranger@example.com');
  const r = env.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'boot', token: 'bad-token' }) } });
  eq(JSON.parse(r.s).code, 'AUTH', '엉터리 로그인 정보는 거절');
  const r2 = env.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'boot' }) } });
  eq(JSON.parse(r2.s).code, 'AUTH', '로그인 정보가 없으면 거절');
  bad('nothing', {}, 'BAD_ACTION');
  env.table('직원').push(['teacher2@example.com', '둘째 선생님', '']);
  good('boot', {}, 'teacher2@example.com');
})();

/* 2. 물품 */
let drone, oz, hanoi, pencil, old;
(function items() {
  drone = good('itemSave', { item: { cat: 'SW교구', name: '텔로에듀 드론', qty: 30, loc: '혜윰실', pub: true, photo: 'S-001.jpg', year: '2019\n2020' } }).items[0];
  eq(drone.id, 'S-001', '첫 SW교구 번호');
  oz = good('itemSave', { item: { cat: 'SW교구', name: '오조봇 evo', qty: 15, loc: '라온실' } }).items[0];
  eq(oz.id, 'S-002', '다음 번호');
  hanoi = good('itemSave', { item: { cat: '창의교구', name: '하노이탑', qty: 36, loc: '자료실', grade: '고' } }).items[0];
  eq(hanoi.id, 'C-001', '창의교구는 C');
  pencil = good('itemSave', { item: { cat: '기본준비물', name: '색연필', qty: 100, min: 20 } }).items[0];
  eq(pencil.id, 'P-001', '기본준비물은 P');
  old = good('itemSave', { item: { cat: '창의교구', name: '카프라', qty: 9, status: '폐기' } }).items[0];
  eq(old.id, 'C-002', '폐기 물품도 번호는 이어짐');
  const e1 = good('itemSave', { item: { id: 'S-001', cat: 'SW교구', name: '텔로에듀 드론 (2세대)', qty: 30, loc: '4층', pub: false } }).items[0];
  eq([e1.id, e1.name, e1.pub, e1.loc], ['S-001', '텔로에듀 드론 (2세대)', false, '4층'], '수정은 번호를 그대로 둠');
  good('itemSave', { item: { id: 'S-001', cat: 'SW교구', name: '텔로에듀 드론', qty: 30, loc: '혜윰실', pub: true, photo: 'S-001.jpg', year: '2019\n2020' } });
  bad('itemSave', { item: { cat: '이상한분류', name: 'x', qty: 1 } }, 'INVALID');
  bad('itemSave', { item: { cat: 'SW교구', name: '', qty: 1 } }, 'INVALID');
  bad('itemSave', { item: { cat: 'SW교구', name: 'x', qty: -1 } }, 'INVALID');
  bad('itemSave', { item: { cat: 'SW교구', name: 'x', qty: 1.5 } }, 'INVALID');
  bad('itemSave', { item: { id: 'Z-999', cat: 'SW교구', name: 'x', qty: 1 } }, 'INVALID');
  const sneaky = good('itemSave', { item: { cat: 'SW교구', name: '=HYPERLINK("x")', qty: 1 } }).items[0];
  eq(sneaky.name, '=HYPERLINK("x")', '수식처럼 보이는 이름도 글자로 저장되고 그대로 읽힘');
  eq(boot().items.length, 6, '물품 6개');
  eq(boot().items.find((i) => i.id === 'S-001').year, '2019\n2020', '여러 줄 값 보존');
})();

/* 3. 대여 예약 */
let R1, R2;
(function create() {
  const base = { school: '다솜초등학교', teacher: '박하늘', phone: '01000000001', start: '2026-10-28', due: '2026-11-04', lines: [{ item: 'S-001', qty: 8 }] };
  R1 = good('rentalCreate', base).rentals[0];
  eq(R1.id, 'R-2026-001', '대여 번호');
  eq([R1.status, R1.docOk, R1.staff, R1.phone], ['예약됨', false, 'owner', '010-0000-0001'], '새 대여는 예약됨, 공문 미확인, 접수 직원 자동, 전화 모양');
  // 시트에는 한 줄 + 품목 한 줄
  eq(boot().lines.filter((l) => l.rid === R1.id).length, 1, '품목 한 줄');
  // 모자라면 거절하고 이유를 알려 준다
  const s = bad('rentalCreate', Object.assign({}, base, { start: '2026-10-30', due: '2026-11-05', lines: [{ item: 'S-001', qty: 25 }] }), 'SHORT');
  eq(s.extra.short[0].avail, 22, '겹치는 예약 8대를 뺀 22대만 가능');
  bad('rentalCreate', Object.assign({}, base, { school: '' }), 'INVALID');
  bad('rentalCreate', Object.assign({}, base, { teacher: '' }), 'INVALID');
  bad('rentalCreate', Object.assign({}, base, { start: '2026-11-31' }), 'INVALID');
  bad('rentalCreate', Object.assign({}, base, { due: '2026-10-01' }), 'INVALID');
  bad('rentalCreate', Object.assign({}, base, { lines: [] }), 'INVALID');
  bad('rentalCreate', Object.assign({}, base, { lines: [{ item: 'S-001', qty: 1.5 }] }), 'INVALID');
  bad('rentalCreate', Object.assign({}, base, { lines: [{ item: 'P-001', qty: 1 }] }), 'SHORT');
  bad('rentalCreate', Object.assign({}, base, { lines: [{ item: 'C-002', qty: 1 }] }), 'SHORT');
  R2 = good('rentalCreate', { school: '별빛초등학교', teacher: '최나래', phone: '', start: '2026-11-06', due: '2026-11-13', lines: [{ item: 'C-001', qty: 12 }, { item: 'S-002', qty: 6 }], memo: '배터리 여분' }).rentals[0];
  eq(R2.id, 'R-2026-002', '다음 번호');
  eq(boot().changeLog === undefined, true, '변경 기록은 화면에 안 보냄');
  ok(env.table('변경기록').length >= 8, '변경 기록 쌓임');
})();

/* 4. 공문 확인, 수정, 취소 */
(function edit() {
  const d = good('rentalDoc', { id: R1.id, docNo: '' });
  eq([d.rentals[0].docOk, d.rentals[0].docNo], [true, ''], '번호 없이도 공문 확인 가능');
  const e = good('rentalEdit', Object.assign({ id: R2.id }, { school: '별빛초등학교', teacher: '최나래', phone: '010-0000-0002', start: '2026-11-06', due: '2026-11-14', lines: [{ item: 'C-001', qty: 12 }, { item: 'S-002', qty: 4 }] }));
  eq(e.rentals[0].due, '2026-11-14', '예약 수정');
  eq(e.linesFor[R2.id].map((l) => l.qty), [12, 4], '품목 다시 저장');
  eq(boot().lines.filter((l) => l.rid === R2.id).length, 2, '품목이 중복되지 않음');
  const X = good('rentalCreate', { school: '취소초등학교', teacher: '김취소', phone: '', start: '2026-11-20', due: '2026-11-27', lines: [{ item: 'S-001', qty: 5 }] }).rentals[0];
  eq(good('rentalCancel', { id: X.id, kind: '미수령' }).rentals[0].status, '미수령', '미수령 처리');
  bad('rentalCancel', { id: X.id }, 'INVALID');
  bad('rentalEdit', Object.assign({ id: X.id }, { school: 'a', teacher: 'b', start: '2026-11-20', due: '2026-11-27', lines: [{ item: 'S-001', qty: 5 }] }), 'INVALID');
  bad('rentalCancel', { id: 'R-9999-001' }, 'INVALID');
  eq(good('boot').rentals.filter((r) => r.status === '미수령').length, 1, '미수령 기록 남음');
})();

/* 5. 내주기 (서명) */
(function handover() {
  const D = '2026-11-06';
  const msgOf = (r) => r.error;
  ok(/서명/.test(msgOf(bad('handover', { id: R1.id, due: D, lines: [{ item: 'S-001', qty: 8 }] }, 'INVALID'))), '서명 없으면 거절'); // 서명 없음
  ok(/서명/.test(msgOf(bad('handover', { id: R1.id, due: D, sign: 'data:image/png;base64,AAAA', lines: [{ item: 'S-001', qty: 8 }] }, 'INVALID'))), '너무 짧은 서명은 거절');
  ok(/오늘보다 빠릅니다/.test(msgOf(bad('handover', { id: R1.id, sign: SIGN, lines: [{ item: 'S-001', qty: 8 }] }, 'INVALID'))), '지난 반납 예정일 그대로면 거절(새로 정해야 함)');
  ok(/없는 교구/.test(msgOf(bad('handover', { id: R1.id, due: D, sign: SIGN, lines: [{ item: 'S-002', qty: 1 }] }, 'INVALID'))), '이 건에 없는 교구');
  ok(/하나도 없/.test(msgOf(bad('handover', { id: R1.id, due: D, sign: SIGN, lines: [{ item: 'S-001', qty: 0 }] }, 'INVALID'))), '하나도 안 내주면 거절');
  bad('handover', { id: R1.id, due: D, sign: SIGN, lines: [{ item: 'S-001', qty: 99 }] }, 'SHORT');
  // R1 은 이미 지난 기간(10/28~11/4)으로 만든 예약 → 연체 시험을 위해 오늘 내줌, 반납 예정일은 그대로 두기 위해 due 를 유지
  const h = good('handover', { id: R1.id, sign: SIGN, due: '2026-11-06', lines: [{ item: 'S-001', qty: 8 }] });
  eq([h.rentals[0].status, h.rentals[0].start, h.rentals[0].handedAt, h.rentals[0].handedBy], ['대여중', '2026-11-06', '2026-11-06', 'owner'], '내주기 → 대여중, 수령일 = 오늘');
  ok(h.rentals[0].sign && env.files[h.rentals[0].sign], '서명 파일이 드라이브에 저장됨');
  ok(env.files[h.rentals[0].sign].parent.name.indexOf('서명') >= 0, '서명 전용 폴더');
  ok(/예약 상태인 건만/.test(bad('handover', { id: R1.id, due: D, sign: SIGN, lines: [{ item: 'S-001', qty: 8 }] }, 'INVALID').error), '이미 내준 건은 다시 못 내줌');
  // 수량 줄이기 + 한 품목 빼기
  const h2 = good('handover', { id: R2.id, sign: SIGN, lines: [{ item: 'C-001', qty: 10 }, { item: 'S-002', qty: 0 }] });
  eq(h2.linesFor[R2.id].map((l) => [l.item, l.qty]), [['C-001', 10]], '수량 0 품목은 빠짐');
  eq(h2.rentals[0].due, '2026-11-14', '반납 예정일 유지');
  // 수량 현황
  const b = boot();
  eq(b.lines.filter((l) => l.rid === R2.id).length, 1, '시트에서도 한 줄만 남음');
  ok(b.rentals.find((r) => r.id === R1.id).sign !== '', '서명 파일 번호 기록');
})();

/* 6. 반납 */
(function ret() {
  bad('returnItems', { id: R1.id, lines: [{ item: 'S-001', brought: 9 }] }, 'INVALID'); // 빌린 것보다 많이
  bad('returnItems', { id: R1.id, lines: [{ item: 'S-001', brought: 2, broken: 3 }] }, 'INVALID');
  bad('returnItems', { id: R1.id, lines: [] }, 'INVALID');
  bad('returnItems', { id: R1.id, lines: [{ item: 'S-001', brought: 0, lost: 0 }] }, 'INVALID');
  bad('returnItems', { id: R1.id, lines: [{ item: 'C-001', brought: 1 }] }, 'INVALID');
  // 일부만 반납
  const p = good('returnItems', { id: R1.id, lines: [{ item: 'S-001', brought: 5 }] });
  eq(p.rentals[0].status, '대여중', '일부만 가져오면 계속 대여 중');
  eq(p.linesFor[R1.id][0].ok, 5, '정상 반납 5');
  // 나머지: 2대 고장(사진 포함), 1대 분실
  const q = good('returnItems', { id: R1.id, lines: [{ item: 'S-001', brought: 2, broken: 2, lost: 1, note: '프로펠러 파손', photo: PHOTO }] });
  eq(q.rentals[0].status, '반납완료', '다 정리되면 반납 완료');
  eq(q.rentals[0].returnedAt, '2026-11-06', '반납 완료일');
  const l = q.linesFor[R1.id][0];
  eq([l.ok, l.broken, l.lost], [5, 2, 1], '정상 5 + 고장 2 + 분실 1 = 8');
  ok(l.photo && env.files[l.photo].parent.name.indexOf('반납사진') >= 0, '반납 사진은 비공개 폴더에');
  eq(q.repairs.map((x) => [x.kind, x.qty, x.status]), [['고장', 2, '대기'], ['분실', 1, '분실처리']], '수리 대기와 분실 기록');
  eq(q.items[0].qty, 29, '분실 1대는 보유수량에서 빠짐');
  eq(itemOf('S-001').qty, 29, '시트에도 반영');
  bad('returnItems', { id: R1.id, lines: [{ item: 'S-001', brought: 1 }] }, 'INVALID'); // 이미 반납 완료
  // 수리 대기 2대 → 오늘 빌려줄 수 있는 수량은 29 - 2
  const s = bad('rentalCreate', { school: '가나초등학교', teacher: '홍길동', phone: '', start: '2026-11-06', due: '2026-11-06', lines: [{ item: 'S-001', qty: 28 }] }, 'SHORT');
  eq(s.extra.short[0].avail, 27, '수리 대기 2대를 뺀 27대');
})();

/* 7. 수리 처리 */
(function repair() {
  const rep = boot().repairs.find((x) => x.kind === '고장');
  bad('repairDone', { id: rep.id, result: '엉뚱' }, 'INVALID');
  const d = good('repairDone', { id: rep.id, result: '완료' });
  eq([d.repairs[0].status, d.repairs[0].doneAt], ['완료', '2026-11-06'], '수리 완료');
  bad('repairDone', { id: rep.id, result: '완료' }, 'INVALID');
  good('rentalCreate', { school: '가나초등학교', teacher: '홍길동', phone: '', start: '2026-11-06', due: '2026-11-06', lines: [{ item: 'S-001', qty: 29 }] });
  // 폐기하면 보유수량이 줄어듦
  const R3 = good('rentalCreate', { school: '하늘초등학교', teacher: '정바다', phone: '', start: '2026-11-07', due: '2026-11-14', lines: [{ item: 'C-001', qty: 2 }] }).rentals[0];
  good('handover', { id: R3.id, sign: SIGN, lines: [{ item: 'C-001', qty: 2 }] });
  good('returnItems', { id: R3.id, lines: [{ item: 'C-001', brought: 2, broken: 1 }] });
  const rep2 = boot().repairs.find((x) => x.kind === '고장' && x.status === '대기');
  const dd = good('repairDone', { id: rep2.id, result: '폐기' });
  eq(dd.items[0].qty, 35, '폐기하면 보유수량 36 → 35');
  bad('rentalCreate', { school: 'a', teacher: 'b', phone: '', start: '2026-11-06', due: '2026-11-13', lines: [{ item: 'S-001', qty: 1 }] }, 'SHORT'); // 가나초가 29대 모두 예약
})();

/* 8. 교실 예약 */
let V1;
(function rooms() {
  const ext = { kind: '외부 대여', rooms: ['SW교육체험교실'], date: '2026-11-12', start: '13:00', end: '17:00', purpose: '교원 연수', person: '홍길동', org: '초등교육과', mobile: '01000000003', office: '0520000000' };
  V1 = good('resSave', ext).reservations[0];
  eq([V1.id, V1.docOk, V1.status, V1.mobile, V1.office], ['V-2026-001', false, '확정', '010-0000-0003', '052-000-0000'], '외부 대여는 공문 미확인으로 시작');
  const c = bad('resSave', Object.assign({}, ext, { start: '16:00', end: '18:00', person: '최나래' }), 'CONFLICT');
  eq(c.extra.conflicts[0].purpose, '교원 연수', '겹치는 예약을 알려 줌');
  eq(boot().reservations.length, 1, '겹치면 저장 안 됨');
  const f = good('resSave', Object.assign({}, ext, { start: '16:00', end: '18:00', person: '최나래', force: true }));
  eq(f.reservations.length, 1, '확인하고 다시 보내면 저장됨');
  good('resCancel', { id: f.reservations[0].id });
  // 여러 교실 → 교실마다 1건
  const multi = good('resSave', Object.assign({}, ext, { date: '2026-11-13', rooms: ['라온실', '혜윰실'], docNo: '초등-1234' }));
  eq(multi.reservations.map((v) => v.room), ['라온실', '혜윰실'], '교실마다 한 건');
  eq(multi.reservations.map((v) => v.docOk), [true, true], '공문번호를 적으면 공문 확인 완료');
  // 종류별 입력
  bad('resSave', Object.assign({}, ext, { person: '' }), 'INVALID');
  bad('resSave', Object.assign({}, ext, { org: '' }), 'INVALID');
  bad('resSave', Object.assign({}, ext, { mobile: '', office: '' }), 'INVALID');
  bad('resSave', Object.assign({}, ext, { purpose: '' }), 'INVALID');
  bad('resSave', Object.assign({}, ext, { rooms: [] }), 'INVALID');
  bad('resSave', Object.assign({}, ext, { rooms: ['없는교실'] }), 'INVALID');
  bad('resSave', Object.assign({}, ext, { start: '17:00', end: '13:00' }), 'INVALID');
  bad('resSave', Object.assign({}, ext, { start: '25:00' }), 'INVALID');
  bad('resSave', Object.assign({}, ext, { kind: '이상한' }), 'INVALID');
  const inn = good('resSave', { kind: '내부 대여', rooms: ['창의실'], date: '2026-11-14', start: '10:00', end: '11:00', purpose: '부서 회의', person: '김창의', org: '무시될 값', mobile: '01011112222' }).reservations[0];
  eq([inn.docOk, inn.org, inn.mobile, inn.docNo], [true, '', '', ''], '내부 대여는 담당자만, 공문 불필요');
  bad('resSave', { kind: '내부 대여', rooms: ['창의실'], date: '2026-11-14', start: '10:30', end: '11:30', purpose: '다른 회의', person: '김창의' }, 'CONFLICT');
  const cls = good('resSave', { kind: '센터 수업', date: '2026-11-07', purpose: '주말창의 6회' }).reservations[0];
  eq([cls.room, cls.start, cls.docOk], ['', '', true], '센터 수업은 날짜와 목적만, 교실·시간 없어도 됨');
  const fac = good('resSave', { kind: '시설 관리', rooms: ['라온실'], date: '2026-11-06', purpose: '정기 소독' }).reservations[0];
  eq(fac.kind, '시설 관리', '시설 관리');
  // 수정
  const up = good('resSave', Object.assign({}, ext, { id: V1.id, room: 'SW교육체험교실', purpose: '교원 연수(수정)' })).reservations[0];
  eq([up.id, up.purpose], [V1.id, '교원 연수(수정)'], '예약 수정은 번호 유지');
  eq(up.docOk, false, '수정해도 공문 확인 상태 유지');
  eq(good('resDoc', { id: V1.id, docNo: '초등-0001' }).reservations[0].docOk, true, '공문 확인');
  eq(good('resCancel', { id: cls.id }).reservations[0].status, '취소', '취소해도 기록은 남음');
  bad('resCancel', { id: 'V-0000-000' }, 'INVALID');
})();

/* 9. 점검 */
(function inspect() {
  const s = good('inspectStart', { name: '2026 2학기말' });
  eq(s.round, '2026 2학기말', '점검 회차 시작');
  bad('inspectStart', { name: '2026 2학기말' }, 'INVALID');
  bad('inspectStart', { name: '' }, 'INVALID');
  const list = good('inspect', { round: '2026 2학기말' });
  eq(list.rounds[0].total, 5 + 5, '사용 중인 물품 5개 + 교실 5곳 (폐기 물품 제외)');
  const m = good('inspectMark', { round: '2026 2학기말', target: 'S-001', result: '이상', count: 28, note: '2대 안 보임' });
  eq([m.row.result, m.row.count, m.row.by], ['이상', 28, 'owner'], '점검 결과 기록');
  bad('inspectMark', { round: '2026 2학기말', target: '없는대상', result: '정상' }, 'INVALID');
  bad('inspectMark', { round: '2026 2학기말', target: 'S-001', result: '엉뚱' }, 'INVALID');
  const l2 = good('inspect', {});
  eq([l2.rounds[0].done, l2.rounds[0].issues], [1, 1], '진행 상황');
})();

/* 10. 서명·사진 보기 */
(function files() {
  const r = boot().rentals.find((x) => x.id === R1.id);
  const f = good('file', { id: r.sign });
  eq(f.mime, 'image/png', '서명 파일 보기');
  ok(f.data.length > 100, '내용 있음');
  // 우리 폴더가 아닌 파일은 안 보여 줌
  const stray = env.ctx.DriveApp.createFolder('남의 폴더');
  const sf = stray.createFile({ type: 'image/png', bytes: [1, 2, 3], name: 'x.png' });
  bad('file', { id: sf.getId() }, 'FORBIDDEN');
})();

/* 11. 연락처 가리기 */
(function mask() {
  const before = boot().rentals.find((r) => r.id === R1.id);
  ok(before.phone, '아직은 연락처가 있음');
  env.setNow(new Date('2027-11-20T10:00:00+09:00'));
  const after = boot();
  eq(after.rentals.find((r) => r.id === R1.id).phone, '', '반납 1년 뒤 연락처 삭제');
  ok(after.rentals.find((r) => r.id === R1.id).teacher, '선생님 이름은 남음');
  eq(after.reservations.find((v) => v.id === V1.id).mobile, '', '교실 예약 연락처도 삭제');
  env.setNow(new Date('2026-11-06T10:00:00+09:00'));
})();

/* 12. 변경 번호와 동시 작업 */
(function rev() {
  const a = good('rev').rev;
  good('itemSave', { item: { cat: 'SW교구', name: '변경번호 시험', qty: 1 } });
  ok(+good('rev').rev > +a, '쓰기마다 변경 번호가 올라감');
  const t = boot().items.length;
  good('itemSave', { item: { cat: 'SW교구', name: '변경번호 시험2', qty: 1 } });
  eq(boot().items.length, t + 1, '추가 확인');
})();

console.log('api 테스트 통과: ' + passed + '개');
