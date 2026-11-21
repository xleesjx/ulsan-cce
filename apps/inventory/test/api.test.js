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

/* 13. 센터 프로그램(교구 미리 잡기) — 새 시트로 처음부터 */
(function programs() {
  const e = createEnv({ now: new Date('2026-11-06T10:00:00+09:00') });
  e.ctx.setupSheets();
  const c = (a, p) => e.call(a, p);
  const g = (a, p) => { const r = c(a, p); assert.ok(r.ok, a + ' 실패: ' + JSON.stringify(r)); return r; };
  const no = (a, p, code) => { const r = c(a, p); assert.ok(!r.ok, a + ' 이(가) 성공하면 안 됨'); if (code) assert.strictEqual(r.code, code, JSON.stringify(r)); passed++; return r; };
  const drone = g('itemSave', { item: { cat: 'SW교구', name: '텔로에듀 드론', qty: 30 } }).items[0];
  const oz = g('itemSave', { item: { cat: 'SW교구', name: '오조봇 evo', qty: 15 } }).items[0];
  const pen = g('itemSave', { item: { cat: '기본준비물', name: '색연필', qty: 100 } }).items[0];
  const b0 = g('boot');
  eq([b0.settings.programBuffer, b0.settings.programQty], [7, 18], '센터 프로그램 기본 설정: 앞뒤 7일, 기본 18개');
  eq(b0.programs, [], '처음에는 프로그램 없음');

  const P = { name: '주말창의', start: '2026-11-21', end: '2026-12-05', note: '하반기 10회', lines: [{ item: drone.id, qty: 18 }, { item: oz.id, qty: 15 }] };
  const s1 = g('progSave', P);
  eq([s1.programId, s1.programsFor['G-2026-001'].length, s1.programsFor['G-2026-001'][0].status], ['G-2026-001', 2, '확정'], '프로그램 등록 (교구마다 한 줄)');
  eq(g('boot').programs.length, 2, '불러오기에 포함');

  // 프로그램 기간(앞뒤 1주일)에는 외부 대여 불가
  const mkR = (start, due, qty, item) => ({ school: '가나초등학교', teacher: '홍길동', phone: '', start, due, lines: [{ item: item || drone.id, qty }] });
  eq(no('rentalCreate', mkR('2026-11-25', '2026-11-26', 15), 'SHORT').extra.short[0].avail, 12, '11/25: 드론 30 - 센터 18 = 12대만 가능');
  g('rentalCreate', mkR('2026-11-25', '2026-11-26', 12));
  eq(no('rentalCreate', mkR('2026-11-14', '2026-11-14', 13), 'SHORT').extra.short[0].avail, 12, '시작 1주 전(11/14)부터 막힘');
  g('rentalCreate', mkR('2026-11-13', '2026-11-13', 30));
  eq(no('rentalCreate', mkR('2026-12-12', '2026-12-12', 13), 'SHORT').extra.short[0].avail, 12, '끝난 뒤 1주일(12/12)까지 막힘');
  g('rentalCreate', mkR('2026-12-13', '2026-12-13', 30));

  // 다른 프로그램과 겹쳐 모자라면 확인을 받고, 확인하면 저장
  const P2 = { name: '방학 프로그램', start: '2026-12-01', end: '2026-12-02', lines: [{ item: drone.id, qty: 18 }] };
  const sh = no('progSave', P2, 'SHORT');
  ok(sh.extra.short[0].avail < 18, '겹쳐서 모자람을 알려 줌: ' + sh.error);
  const f2 = g('progSave', Object.assign({}, P2, { force: true }));
  eq(f2.programId, 'G-2026-002', '확인하고 저장하면 다음 번호');

  // 수정: 같은 번호, 줄이 바뀜
  no('progSave', { id: 'G-2026-001', name: '주말창의(수정)', start: '2026-11-21', end: '2026-12-05', lines: [{ item: drone.id, qty: 18 }] }, 'SHORT'); // 다른 프로그램과 겹쳐 확인 필요
  const ed = g('progSave', { id: 'G-2026-001', name: '주말창의(수정)', start: '2026-11-21', end: '2026-12-05', lines: [{ item: drone.id, qty: 18 }], force: true });
  eq([ed.programsFor['G-2026-001'].length, ed.programsFor['G-2026-001'][0].name], [1, '주말창의(수정)'], '수정하면 교구 줄이 새로 바뀜');
  eq(g('boot').programs.filter((r) => r.id === 'G-2026-001').length, 1, '시트에서도 중복 없이 한 줄');
  eq(g('boot').programs.find((r) => r.id === 'G-2026-001').createdAt.length > 0, true, '등록 정보 유지');

  // 입력 검사
  no('progSave', Object.assign({}, P, { name: '' }), 'INVALID');
  no('progSave', Object.assign({}, P, { end: '2026-11-01' }), 'INVALID');
  no('progSave', Object.assign({}, P, { start: '2026-02-30' }), 'INVALID');
  no('progSave', Object.assign({}, P, { lines: [{ item: oz.id, qty: 16 }] }), 'INVALID'); // 보유 15 보다 많음
  no('progSave', Object.assign({}, P, { lines: [{ item: pen.id, qty: 1 }] }), 'INVALID');
  no('progSave', Object.assign({}, P, { lines: [] }), 'INVALID');
  no('progSave', Object.assign({}, P, { id: 'G-9999-001' }), 'INVALID');

  // 취소하면 수량이 풀림
  const cn = g('progCancel', { id: 'G-2026-002' });
  eq(cn.programsFor['G-2026-002'][0].status, '취소', '프로그램 취소');
  no('progCancel', { id: 'G-9999-001' }, 'INVALID');
  no('progSave', Object.assign({}, P2, { id: 'G-2026-002', force: true }), 'INVALID'); // 취소된 것은 못 고침

  // 설정의 여유일을 0으로 바꾸면 준비·점검 기간이 사라짐
  const sheet = e.sheets['설정'].data();
  sheet.find((r) => r[0] === '센터사용여유일수')[1] = '0';
  eq(g('boot').settings.programBuffer, 0, '설정 탭에서 여유일 변경');
  g('rentalCreate', mkR('2026-11-14', '2026-11-14', 13)); // 이제 11/14 는 막히지 않음
  ok(e.table('변경기록').length >= 8, '프로그램 작업도 변경 기록에 남음');
})();

/* 14. 이전 버전 시트 업그레이드: [센터사용] 탭과 새 설정 항목이 없어도 자동으로 만들어짐 */
(function upgrade() {
  const e = createEnv({ now: new Date('2026-11-06T10:00:00+09:00') });
  e.ctx.setupSheets();
  delete e.sheets['센터사용'];
  const st = e.sheets['설정'].data();
  e.sheets['설정'].data().splice(st.findIndex((r) => r[0] === '센터사용기본수량'), 2);
  delete e.props.SETTINGS_VER;
  const r = e.call('boot');
  ok(r.ok && r.settings.programQty === 18 && r.settings.programBuffer === 7, '새 설정은 기본값으로 동작: ' + JSON.stringify(r.error || ''));
  ok(e.sheets['센터사용'] && e.table('센터사용')[0][1] === '프로그램', '[센터사용] 탭이 자동으로 생김');
  ok(e.table('설정').some((x) => x[0] === '센터사용기본수량') && e.table('설정').some((x) => x[0] === '센터사용여유일수'), '설정 탭에 새 항목이 추가됨');
  const n = e.table('설정').length;
  e.call('boot');
  eq(e.table('설정').length, n, '다시 불러와도 중복으로 추가되지 않음');
})();

/* 15. 접속 코드(일반 업무)와 구글 로그인(관리) */
(function access() {
  const e = createEnv({ now: new Date('2026-11-06T10:00:00+09:00') });
  e.ctx.setupSheets();
  const raw = (action, token, extra) => JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action, token }, extra || {})) } }).s);
  // 코드가 아직 없을 때
  eq(raw('lockInfo').hasCode, false, '처음에는 접속 코드가 없음');
  eq(raw('unlock', null, { code: '2580' }).code, 'NO_CODE', '코드가 없으면 관리자가 먼저 정하라고 안내');
  // 관리자: 구글 로그인 → 30분짜리 표
  const A = raw('login', 'tok:owner@example.com');
  ok(A.ok && /^s1\./.test(A.session) && A.minutes === 30, '구글 로그인 뒤 30분짜리 관리자 표: ' + JSON.stringify(A).slice(0, 80));
  let calls = 0; const f0 = e.ctx.UrlFetchApp.fetch; e.ctx.UrlFetchApp.fetch = (...a) => { calls++; return f0(...a); };
  eq(raw('setAccessCode', A.session, { code: '1234' }).code, 'INVALID', '너무 쉬운 코드는 거절');
  eq(raw('setAccessCode', A.session, { code: '25a0' }).code, 'INVALID', '숫자 4자리가 아니면 거절');
  ok(raw('setAccessCode', A.session, { code: '2580' }).ok, '관리자가 접속 코드를 정함');
  eq(calls, 0, '관리자 표로 이용하고 구글 확인을 다시 하지 않음');
  eq(raw('lockInfo').hasCode, true, '코드가 생김');
  ok(e.table('변경기록').some((r) => r[2] === '접속 코드 변경'), '코드 변경이 변경기록에 남음');
  ok(!JSON.stringify(e.props).includes('2580'), '코드 자체는 저장하지 않음(암호화한 값만)');
  // 일반: 코드로 잠금 풀기 → 처음 화면 데이터까지 한 번에
  const U = raw('unlock', null, { code: '2580', actor: '정하늘' });
  ok(U.ok && /^s1\./.test(U.session) && U.items && U.rooms.length === 5, '코드가 맞으면 표와 처음 데이터를 한 번에 받음');
  eq([U.user.admin, U.staff.length, U.sheetUrl, U.scriptUrl], [false, 0, '', ''], '코드 접속에는 직원 이메일·시트 주소를 주지 않음');
  ok(U.staffNames.length >= 1, '[처리 직원] 목록용 이름은 받음');
  ok(raw('boot', U.session).ok, '코드 표로 이용');
  eq(raw('adminInfo', U.session).code, 'ADMIN', '코드 표로는 관리 화면 불가');
  eq(raw('setAccessCode', U.session, { code: '1357' }).code, 'ADMIN', '코드 표로는 코드 변경 불가');
  eq(raw('login', U.session).code, 'ADMIN', '코드 표로 관리자 표를 받을 수 없음');
  const ai = raw('adminInfo', A.session);
  ok(ai.ok && ai.staff[0].email === 'owner@example.com' && /script\.google\.com/.test(ai.scriptUrl), '관리 화면은 이메일·주소를 줌');
  // 처리 직원 이름이 기록에 남음
  const it = raw('itemSave', U.session, { actor: '정하늘', item: { cat: '창의교구', name: '시험 교구', qty: 3 } });
  ok(it.ok && e.table('변경기록').some((r) => r[1] === '정하늘' && r[2] === '물품 등록'), '[처리 직원]에 적은 이름이 변경기록에 남음');
  raw('itemSave', U.session, { item: { cat: '창의교구', name: '이름 없는 교구', qty: 1 } });
  ok(e.table('변경기록').some((r) => r[1] === '공용 기기' && r[3] !== ''), '이름을 안 적으면 공용 기기');
  raw('itemSave', A.session, { item: { cat: '창의교구', name: '관리자 교구', qty: 1 } });
  ok(e.table('변경기록').some((r) => r[1] === 'owner' && r[3] !== ''), '관리자는 직원 탭 이름으로 기록: ' + JSON.stringify(e.table('변경기록').slice(-1)));
  // 틀린 코드
  const w = raw('unlock', null, { code: '1111' });
  eq([w.code, w.extra.left], ['WRONG_CODE', 9], '틀리면 남은 횟수를 알려 줌');
  for (let k = 0; k < 9; k++) raw('unlock', null, { code: '0001' });
  eq(raw('unlock', null, { code: '2580' }).code, 'LOCKED', '10번 틀리면 맞는 코드도 잠시 막힘');
  ok(e.table('변경기록').some((r) => r[2] === '접속 코드 잠김'), '잠김이 변경기록에 남음');
  // 코드를 바꾸면 기존 코드 기기 모두 잠김
  ok(raw('setAccessCode', A.session, { code: '1357' }).ok, '코드 변경');
  eq(raw('boot', U.session).code, 'AUTH', '코드를 바꾸면 이전 코드로 들어온 기기는 잠김');
  eq(raw('unlock', null, { code: '2580' }).code, 'WRONG_CODE', '이전 코드는 안 됨(잠김도 풀림)');
  const U2 = raw('unlock', null, { code: '1357' });
  ok(U2.ok, '새 코드로 접속');
  // 만료: 코드 표 12시간, 관리자 표 30분
  e.setNow(new Date('2026-11-06T10:40:00+09:00'));
  eq(raw('adminInfo', A.session).code, 'AUTH', '관리자 표는 30분 뒤 만료');
  ok(raw('boot', U2.session).ok, '코드 표는 그대로');
  e.setNow(new Date('2026-11-06T22:30:00+09:00'));
  eq(raw('boot', U2.session).code, 'AUTH', '코드 표는 12시간 뒤 만료');
  e.setNow(new Date('2026-11-06T10:00:00+09:00'));
  // 고친 표·옛날 표
  eq(raw('boot', U2.session.slice(0, -3) + 'abc').code, 'AUTH', '조금이라도 고친 표는 거절');
  const sign = (o) => { const p = Buffer.from(JSON.stringify(o)).toString('base64url'); return 's1.' + p + '.' + require('crypto').createHmac('sha256', e.props.SESSION_SECRET).update(p).digest('base64url'); };
  eq(raw('boot', sign({ e: 'owner@example.com', x: Date.now() + 86400000, d: 14 })).code, 'AUTH', '이전 버전의 14일 표는 더 이상 쓰지 않음');
  // 관리자가 직원 탭에서 빠지면 바로 막힘
  e.table('직원').push(['temp@example.com', '임시', '']);
  const T2 = raw('login', 'tok:temp@example.com');
  ok(raw('adminInfo', T2.session).ok, '다른 직원도 관리자 확인 가능');
  e.table('직원').pop();
  eq(raw('adminInfo', T2.session).code, 'FORBIDDEN', '직원 탭에서 빼면 바로 막힘');
  eq(raw('login', 'tok:stranger@example.com').code, 'FORBIDDEN', '직원이 아닌 구글 계정은 관리자 불가');
  // 모든 기기 로그아웃
  e.ctx.resetSessions();
  eq(raw('boot', U2.session).code, 'AUTH', '모든 기기 로그아웃하면 이전 표가 모두 무효');
  ok(raw('unlock', null, { code: '1357' }).ok, '코드는 그대로 쓸 수 있음');
})();

/* 16. 서버 코드 자동 업데이트 (가짜 GitHub·가짜 Apps Script API) */
(function selfUpdate() {
  const fs = require('fs'), path = require('path');
  const e = createEnv({ now: new Date('2026-11-06T10:00:00+09:00') });
  e.ctx.setupSheets();
  const raw = (action, token, extra) => JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action, token }, extra || {})) } }).s);
  const codeSrc = fs.readFileSync(path.join(__dirname, '../gas/Code.gs'), 'utf8');
  const coreSrc = fs.readFileSync(path.join(__dirname, '../gas/Core.gs'), 'utf8');
  const newCode = codeSrc.replace(/var CODE_VERSION = \d+;/, 'var CODE_VERSION = 99;');
  const project = { files: [{ name: 'appsscript', type: 'JSON', source: '{"timeZone":"Asia/Seoul"}' }, { name: 'Code', type: 'SERVER_JS', source: codeSrc, functionSet: {} }, { name: 'Core', type: 'SERVER_JS', source: coreSrc }] };
  const deployments = [{ deploymentId: 'HEAD1', deploymentConfig: { scriptId: 'SCRIPT123' }, entryPoints: [{ entryPointType: 'WEB_APP' }] },
    { deploymentId: 'DEP1', deploymentConfig: { scriptId: 'SCRIPT123', versionNumber: 3, manifestFileName: 'appsscript', description: '웹앱' }, entryPoints: [{ entryPointType: 'WEB_APP' }] }];
  let apiOn = true, gh = { code: newCode, core: coreSrc }, versions = 3, puts = [];
  e.ctx.ScriptApp.getOAuthToken = () => 'owner-oauth';
  const f0 = e.ctx.UrlFetchApp.fetch;
  e.ctx.UrlFetchApp.fetch = (url, opt) => {
    const res = (code, obj) => ({ getResponseCode: () => code, getContentText: () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) });
    if (url.startsWith('https://raw.githubusercontent.com/xleesjx/ulsan-cce/main/apps/inventory/gas/Code.gs?t=')) return res(200, gh.code);
    if (url.startsWith('https://raw.githubusercontent.com/xleesjx/ulsan-cce/main/apps/inventory/gas/Core.gs?t=')) return res(200, gh.core);
    if (url.startsWith('https://script.googleapis.com/v1/projects/SCRIPT123')) {
      assert.strictEqual(opt.headers.Authorization, 'Bearer owner-oauth');
      if (!apiOn) return res(403, { error: { message: 'User has not enabled the Apps Script API.' } });
      const p = url.slice('https://script.googleapis.com/v1/projects/SCRIPT123'.length), m = (opt.method || 'get').toLowerCase();
      if (p === '/content' && m === 'get') return res(200, project);
      if (p === '/content' && m === 'put') { project.files = JSON.parse(opt.payload).files; puts.push('content'); return res(200, project); }
      if (p === '/versions' && m === 'post') return res(200, { versionNumber: ++versions });
      if (p === '/deployments' && m === 'get') return res(200, { deployments });
      if (p.startsWith('/deployments/') && m === 'put') { puts.push(p.slice(13) + ':' + JSON.parse(opt.payload).deploymentConfig.versionNumber); return res(200, {}); }
      return res(404, 'no');
    }
    return f0(url, opt);
  };
  const A = raw('login', 'tok:owner@example.com').session;
  e.ctx.setCode_('2580');
  const U = raw('unlock', null, { code: '2580' }).session;
  eq(raw('serverUpdate', U).code, 'ADMIN', '코드 접속으로는 서버 업데이트 불가');
  const chk = raw('serverUpdate', A, { check: true });
  eq([chk.current >= 7, chk.latest, chk.same], [true, 99, false], '최신 버전 확인(바꾸지 않음)');
  eq(puts.length, 0, '확인만 할 때는 아무것도 바꾸지 않음');
  apiOn = false;
  eq(raw('serverUpdate', A).code, 'UPDATE_SETUP', 'Apps Script API가 꺼져 있으면 준비 안내');
  apiOn = true;
  gh.code = '<html>404</html>';
  eq(raw('serverUpdate', A).code, 'UPDATE', 'GitHub 내용이 이상하면 멈춤');
  eq(puts.length, 0, '이상하면 아무것도 바꾸지 않음');
  gh.code = newCode;
  const r = raw('serverUpdate', A);
  ok(r.ok && r.latest === 99 && r.version === 4 && r.deployments === 1, '업데이트: ' + JSON.stringify(r));
  eq(puts, ['content', 'DEP1:4'], '코드를 바꾸고 웹앱 배포만 새 버전으로 (HEAD 제외)');
  eq(project.files.find((f) => f.name === 'Code').source, newCode, 'Code 파일이 GitHub 내용으로 바뀜');
  eq(project.files.find((f) => f.name === 'appsscript').source, '{"timeZone":"Asia/Seoul"}', 'appsscript.json은 그대로');
  ok(!('functionSet' in project.files.find((f) => f.name === 'Code')), '보낼 때 이름·종류·내용만');
  ok(e.table('변경기록').some((x) => x[2] === '서버 코드 업데이트'), '변경기록에 남음');
  // Core 파일이 없던 프로젝트면 추가
  project.files = project.files.filter((f) => f.name !== 'Core');
  e.props.DEPLOYED_HASH = '';
  ok(raw('serverUpdate', A).ok && project.files.some((f) => f.name === 'Core' && f.source === coreSrc), 'Core 파일이 없으면 새로 만듦');
  e.ctx.SpreadsheetApp.getUi = () => ({ alert: (m) => { e.lastAlert = m; } });
  e.ctx.updateServerCode();
  ok(/업데이트|최신/.test(e.lastAlert), '시트 메뉴로도 업데이트: ' + e.lastAlert);
})();

console.log('api 테스트 통과: ' + passed + '개');
