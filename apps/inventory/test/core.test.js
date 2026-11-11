/* 공통 규칙(docs/core.js) 단위 테스트. 모든 데이터는 가짜입니다. */
'use strict';
const assert = require('assert');
const Core = require('../../../docs/inventory/core.js');

let passed = 0;
function ok(cond, msg) { assert.ok(cond, msg); passed++; }
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); passed++; }

const TODAY = '2026-11-06'; // 금요일

/* 날짜 */
eq(Core.addDays('2026-11-30', 1), '2026-12-01', '달 넘기기');
eq(Core.diffDays('2026-11-06', '2026-11-13'), 7, '날짜 차이');
eq(Core.shortDate('2026-11-06'), '11/6 (금)', '짧은 날짜');
eq(Core.longDate('2026-11-06'), '11월 6일 금요일', '긴 날짜');
ok(Core.validDate('2026-02-28') && !Core.validDate('2026-02-30') && !Core.validDate('11/6'), '날짜 형식 검사');
eq(Core.todayStr(Date.parse('2026-11-05T16:00:00Z')), '2026-11-06', '한국 시각 기준 날짜(UTC 16시는 다음 날)');
eq(Core.nowStr(Date.parse('2026-11-05T15:30:05Z')), '2026-11-06 00:30:05', '한국 시각 기준 시각');
ok(Core.validTime('09:30') && !Core.validTime('9:30') && !Core.validTime('24:00'), '시간 형식');

/* 검색 */
ok(Core.matchKo('드론', '텔로에듀 드론') && Core.matchKo('ㄷㄹ', '텔로에듀 드론'), '글자·초성 검색');
ok(Core.matchKo('ㄱㄴ', '가나초등학교') && Core.matchKo('가ㄴ', '가나초등학교') && !Core.matchKo('ㄴㄱ', '가나초등학교'), '초성 섞어 검색');
ok(Core.matchKo('c-001', 'C-001 하노이탑') && Core.matchKo(' 하노이 탑', '하노이탑'), '영문·공백 무시');

/* 번호 */
eq(Core.nextItemId([{ id: 'S-001' }, { id: 'S-009' }, { id: 'C-004' }], 'SW교구'), 'S-010', '다음 관리번호');
eq(Core.nextItemId([], '기본준비물'), 'P-001', '첫 관리번호');
eq(Core.nextYearId('R', 2026, ['R-2026-001', 'R-2025-050', 'R-2026-012']), 'R-2026-013', '대여 번호는 해마다 새로');

/* 데이터 */
function mk() {
  return {
    items: [
      { id: 'S-001', cat: 'SW교구', name: '텔로에듀 드론', qty: 30, status: '사용' },
      { id: 'S-002', cat: 'SW교구', name: '오조봇 evo', qty: 15, status: '사용' },
      { id: 'C-001', cat: '창의교구', name: '하노이탑', qty: 36, status: '사용' },
      { id: 'P-001', cat: '기본준비물', name: '색연필', qty: 100, status: '사용' },
      { id: 'C-002', cat: '창의교구', name: '카프라', qty: 9, status: '폐기' }
    ],
    rentals: [
      { id: 'R-2026-001', school: '다솜초등학교', teacher: '박하늘', phone: '010-0000-0001', start: '2026-10-28', due: '2026-11-04', status: '대여중', docOk: true },
      { id: 'R-2026-002', school: '별빛초등학교', teacher: '최나래', phone: '010-0000-0002', start: '2026-10-30', due: '2026-11-06', status: '대여중', docOk: true },
      { id: 'R-2026-003', school: '하늘초등학교', teacher: '정바다', phone: '010-0000-0003', start: '2026-11-07', due: '2026-11-14', status: '예약됨', docOk: false },
      { id: 'R-2026-004', school: '푸른초등학교', teacher: '오세진', phone: '010-0000-0004', start: '2026-11-10', due: '2026-11-17', status: '예약됨', docOk: true },
      { id: 'R-2026-005', school: '가나초등학교', teacher: '홍길동', phone: '010-0000-0005', start: '2026-09-01', due: '2026-09-08', status: '반납완료', returnedAt: '2026-09-08', docOk: true },
      { id: 'R-2026-006', school: '취소초등학교', teacher: '김취소', phone: '010-0000-0006', start: '2026-11-07', due: '2026-11-14', status: '취소', docOk: false }
    ],
    lines: [
      { rid: 'R-2026-001', item: 'S-001', qty: 8, ok: 0, broken: 0, lost: 0 },
      { rid: 'R-2026-002', item: 'C-001', qty: 12, ok: 0, broken: 0, lost: 0 },
      { rid: 'R-2026-002', item: 'S-002', qty: 6, ok: 2, broken: 0, lost: 0 },
      { rid: 'R-2026-003', item: 'S-001', qty: 10, ok: 0, broken: 0, lost: 0 },
      { rid: 'R-2026-004', item: 'S-001', qty: 12, ok: 0, broken: 0, lost: 0 },
      { rid: 'R-2026-005', item: 'S-001', qty: 30, ok: 30, broken: 0, lost: 0 },
      { rid: 'R-2026-006', item: 'S-001', qty: 30, ok: 0, broken: 0, lost: 0 }
    ],
    repairs: [
      { id: 'F-2026-001', item: 'S-001', qty: 2, kind: '고장', status: '대기' },
      { id: 'F-2026-002', item: 'S-001', qty: 1, kind: '고장', status: '완료' },
      { id: 'F-2026-003', item: 'C-001', qty: 3, kind: '분실', status: '분실처리' }
    ],
    rooms: [
      { name: 'SW교육체험교실', short: 'SW', order: 1 }, { name: '라온실', short: '라', order: 2 },
      { name: '혜윰실', short: '혜', order: 3 }
    ],
    reservations: [
      { id: 'V-2026-001', room: 'SW교육체험교실', kind: '외부 대여', date: '2026-11-06', start: '13:00', end: '17:00', purpose: '교원 연수', person: '홍길동', org: '초등교육과', docOk: true, status: '확정' },
      { id: 'V-2026-002', room: '혜윰실', kind: '센터 수업', date: '2026-11-06', start: '15:30', end: '18:00', purpose: '교재개발 협의회', status: '확정' },
      { id: 'V-2026-003', room: '라온실', kind: '시설 관리', date: '2026-11-06', start: '', end: '', purpose: '정기 소독', status: '확정' },
      { id: 'V-2026-004', room: 'SW교육체험교실', kind: '외부 대여', date: '2026-11-12', start: '13:00', end: '17:00', purpose: '교원 연수', person: '오세진', org: '푸른초', docOk: false, status: '확정' },
      { id: 'V-2026-005', room: '', kind: '센터 수업', date: '2026-11-07', start: '', end: '', purpose: '주말창의 6회', status: '확정' },
      { id: 'V-2026-006', room: 'SW교육체험교실', kind: '내부 대여', date: '2026-11-13', start: '10:00', end: '11:00', purpose: '회의', person: '김창의', status: '취소' }
    ]
  };
}

/* 수량 계산 */
(function qty() {
  const d = mk();
  const idx = Core.makeIndex(d);
  const drone = d.items[0];
  const st = Core.itemStats(idx, drone, TODAY);
  eq(st.out, 8, '드론 대여 중 8');
  eq(st.reserved, 22, '드론 예약 22 (하늘초 10 + 푸른초 12)');
  eq(st.repair, 2, '수리 대기 2 (완료된 수리는 제외)');
  eq(st.avail, 30 - 2 - 8, '오늘 빌려줄 수 있는 수량 20 (연체 중인 다솜초 8대는 아직 안 돌아옴)');
  eq(Core.available(idx, drone, '2026-11-07', '2026-11-14', '', TODAY), 30 - 2 - 10 - 12, '11/7~11/14: 하늘초 10 + 푸른초 12 겹침 (연체 8대는 오늘까지만 묶임)');
  eq(Core.available(idx, drone, '2026-11-18', '2026-11-25', '', TODAY), 28, '예약이 모두 끝난 뒤에는 수리 대기만 빠짐(연체는 오늘까지)');
  eq(Core.available(idx, drone, '2026-11-07', '2026-11-14', 'R-2026-003', TODAY), 30 - 2 - 12, '자기 자신은 빼고 계산(예약 수정 때)');
  eq(Core.itemStats(idx, d.items[2], TODAY).avail, 36 - 12, '하노이탑: 분실은 보유수량에서 이미 빠진 값으로 계산하므로 여기선 대여 중만 뺌');
  const oz = Core.itemStats(idx, d.items[1], TODAY);
  eq(oz.out, 4, '일부 반납한 오조봇은 남은 4개만 대여 중');
  eq(Core.outstanding({ qty: 10, ok: 6, broken: 1, lost: 1 }), 2, '남은 수량');
  eq(Core.outstanding({ qty: 2, ok: 2, broken: 1, lost: 0 }), 0, '남은 수량은 0 밑으로 안 내려감');
})();

/* 대여 검사 */
(function check() {
  const d = mk(), idx = Core.makeIndex(d);
  let r = Core.checkLines(d, idx, [{ item: 'S-001', qty: 21 }], '2026-11-06', '2026-11-06', '', TODAY);
  eq(r.errors.length, 1, '오늘 드론 21대: 20대만 가능(수리 2 + 연체 8 제외)');
  eq(r.short[0].avail, 20, '가능 수량 안내');
  r = Core.checkLines(d, idx, [{ item: 'S-001', qty: 20 }, { item: 'S-002', qty: 11 }], '2026-11-06', '2026-11-06', '', TODAY);
  eq(r.errors, [], '남은 수량 안이면 통과');
  eq(Core.checkLines(d, idx, [{ item: 'S-001', qty: 20 }], '2026-11-06', '2026-11-13', '', TODAY).short[0].avail, 0, '기간이 길어 예약과 겹치면 가능 수량 0 (음수로 안 보임)');
  r = Core.checkLines(d, idx, [{ item: 'S-001', qty: 22 }], '2026-11-20', '2026-11-27', '', TODAY);
  eq(r.errors, [], '예약이 끝난 뒤 기간은 22대도 가능');
  eq(Core.checkLines(d, idx, [{ item: 'P-001', qty: 1 }], '2026-11-06', '2026-11-13', '', TODAY).errors.length, 1, '기본준비물은 대여 불가');
  eq(Core.checkLines(d, idx, [{ item: 'C-002', qty: 1 }], '2026-11-06', '2026-11-13', '', TODAY).errors.length, 1, '폐기 물품은 대여 불가');
  eq(Core.checkLines(d, idx, [{ item: 'S-001', qty: 1 }, { item: 'S-001', qty: 1 }], '2026-11-06', '2026-11-06', '', TODAY).errors.length, 1, '같은 물품 중복');
  eq(Core.checkLines(d, idx, [], '2026-11-06', '2026-11-13', '', TODAY).errors.length, 1, '품목 없음');
  eq(Core.checkLines(d, idx, [{ item: 'S-001', qty: 0 }], '2026-11-06', '2026-11-06', '', TODAY).errors.length, 1, '수량 0');
})();

/* 교실 예약 */
(function rooms() {
  const d = mk();
  const base = { id: 'new', room: 'SW교육체험교실', kind: '외부 대여', date: '2026-11-06', start: '16:00', end: '18:00', status: '확정' };
  eq(Core.roomConflicts(base, d.reservations).map((x) => x.id), ['V-2026-001'], '16~18시는 13~17시와 겹침');
  eq(Core.roomConflicts(Object.assign({}, base, { start: '17:00', end: '18:00' }), d.reservations), [], '끝나는 시각과 시작 시각이 같으면 겹치지 않음');
  eq(Core.roomConflicts(Object.assign({}, base, { room: '라온실', start: '10:00', end: '11:00' }), d.reservations).map((x) => x.id), ['V-2026-003'], '시간 없는 시설 관리는 종일 사용으로 봄');
  eq(Core.roomConflicts(Object.assign({}, base, { room: '', start: '', end: '' }), d.reservations), [], '교실 없는 일정은 겹침 검사 안 함');
  eq(Core.roomConflicts(Object.assign({}, base, { date: '2026-11-13', start: '10:00', end: '11:00' }), d.reservations), [], '취소된 예약은 무시');
  eq(Core.roomConflicts(Object.assign({}, base, { id: 'V-2026-001', start: '13:00', end: '17:00' }), d.reservations), [], '자기 자신은 제외(수정할 때)');
  eq(Core.timeLabel({ start: '', end: '' }), '종일', '시간 없음 = 종일');
  eq(Core.timeLabel({ start: '13:00', end: '17:00' }), '13:00~17:00', '시간 표시');

  const grid = Core.monthGrid('2026-11');
  eq(grid.length, 35, '2026년 11월은 5주');
  eq(grid[0].date, '2026-11-01', '11월 1일은 일요일이라 첫 칸');
  ok(grid[34].date === '2026-12-05' && !grid[34].inMonth, '마지막 칸은 12/5');
  eq(Core.monthGrid('2026-08').length, 42, '2026년 8월은 6주');
  eq(Core.addMonths('2026-12', 1), '2027-01', '다음 달');
  eq(Core.addMonths('2026-01', -1), '2025-12', '이전 달');

  const marks = Core.dayMarks(d.reservations, d.rooms, '2026-11-06');
  eq(marks.map((m) => m.label), ['SW', '라', '혜'], '교실 순서대로 약자');
  eq(marks.map((m) => m.cls), ['blue', 'gray', 'green'], '종류별 색');
  const m7 = Core.dayMarks(d.reservations, d.rooms, '2026-11-07');
  eq([m7[0].label, m7[0].wide], ['주말창의', true], '교실 없는 일정은 제목으로 표시');
  eq(Core.dayMarks(d.reservations, d.rooms, '2026-11-13'), [], '취소된 예약은 달력에 안 나옴');
})();

/* 브리핑 */
(function brief() {
  const d = mk();
  let b = Core.briefing(d, TODAY, 'all');
  eq(b.docs.map((x) => x.id), ['R-2026-003', 'V-2026-004'], '공문 확인: 가까운 날 순서(취소된 건 제외, 공문 받은 건 제외)');
  eq(b.docs[0].days, 1, '하늘초는 D-1');
  eq(b.today.map((x) => x.kind), ['overdue', 'return', 'room', 'room', 'room'], '오늘: 연체 → 반납 → 교실 시간순');
  eq(b.today.slice(2).map((x) => x.id), ['V-2026-003', 'V-2026-001', 'V-2026-002'], '교실은 시작 시각 순서(종일이 먼저)');
  ok(/2일 지남/.test(b.today[0].sub), '연체 일수');
  eq(b.next.map((x) => x.id), ['R-2026-003', 'V-2026-005', 'R-2026-004', 'V-2026-004'], '다음 대여: 날짜순, 같은 날은 교구 먼저');
  eq(b.next.map((x) => x.date), b.next.map((x) => x.date).slice().sort(), '다음 대여는 날짜순');
  eq(b.next[0].date, '2026-11-07', '가장 가까운 날부터');
  b = Core.briefing(d, TODAY, '교구');
  ok(b.today.every((x) => x.type === '교구') && b.docs.every((x) => x.type === '교구'), '교구만 보기');
  b = Core.briefing(d, TODAY, '교실');
  ok(b.today.every((x) => x.type === '교실') && b.next.every((x) => x.type === '교실') && b.docs.length === 1, '교실만 보기');
  b = Core.briefing(d, TODAY, 'all', 2);
  eq([b.next.length, b.nextTotal > 2], [2, true], '다음 대여 개수 제한');

  // 수령 날짜가 지났는데 아직 안 가져간 예약은 오늘 할 일로
  const d2 = mk(); d2.rentals[2].start = '2026-11-04'; d2.rentals[2].due = '2026-11-11';
  const b2 = Core.briefing(d2, TODAY, '교구');
  ok(b2.today.some((x) => x.kind === 'handout' && /아직 안 가져감/.test(x.sub)), '수령 날짜가 지난 예약 표시');
})();

/* 개인정보·형식 */
(function misc() {
  const d = mk();
  ok(Core.needsMaskRental(d.rentals[4], '2027-09-10', 365) && !Core.needsMaskRental(d.rentals[4], '2027-09-08', 365), '반납 1년 뒤부터 연락처 가림');
  ok(!Core.needsMaskRental(d.rentals[0], '2030-01-01', 365), '아직 대여 중이면 가리지 않음');
  eq(Core.fmtPhone('01000001234'), '010-0000-1234', '휴대전화 모양');
  eq(Core.fmtPhone('0522341234'), '052-234-1234', '지역번호 3자리');
  eq(Core.fmtPhone('022341234'), '02-234-1234', '서울 번호');
  eq(Core.toCsv([['품명', '메모'], ['드론, 30대', '"큰따옴표"\n줄바꿈']]), '품명,메모\r\n"드론, 30대","""큰따옴표""\n줄바꿈"', 'CSV 따옴표 처리');
  const imap = {}; mk().items.forEach((i) => { imap[i.id] = i; });
  eq(Core.linesSummary([{ item: 'S-001', qty: 8 }, { item: 'S-002', qty: 4 }, { item: 'C-001', qty: 1 }], imap, 2), '텔로에듀 드론 8개, 오조봇 evo 4개 외 1', '품목 요약');
  eq(Core.dayLabel('2026-11-07', TODAY), '내일', '내일 표시');
  eq(Core.dayLabel('2026-11-10', TODAY), '11/10 (화)', '날짜 표시');
})();

/* 실적 */
(function stat() {
  const d = mk();
  const s = Core.stats(d, '2026-01-01', '2026-12-31');
  eq(s.rentals, 3, '실적: 대여 중 + 반납 완료만 (예약됨·취소 제외)');
  eq(s.items[0].id, 'S-001', '가장 많이 나간 교구');
  eq(s.reservations, 5, '교실 예약 5건(취소 제외)');
  const sw = s.rooms.find((r) => r.name === 'SW교육체험교실');
  eq([sw.count, sw.minutes], [2, 480], 'SW교육체험교실 2건, 4시간+4시간');
  ok(s.kinds.find((k) => k.name === '센터 수업').count === 2, '종류별 집계');
})();

/* 센터 프로그램(교구 미리 잡기) */
(function program() {
  const d = mk();
  d.programs = [
    { id: 'G-2026-001', name: '주말창의', start: '2026-11-21', end: '2026-12-05', item: 'S-001', qty: 18, note: '', status: '확정' },
    { id: 'G-2026-001', name: '주말창의', start: '2026-11-21', end: '2026-12-05', item: 'S-002', qty: 15, note: '', status: '확정' },
    { id: 'G-2026-002', name: '취소된 프로그램', start: '2026-11-21', end: '2026-12-05', item: 'C-001', qty: 20, note: '', status: '취소' }
  ];
  const idx = Core.makeIndex(d);
  const drone = d.items[0];
  eq(Core.progWindow(d.programs[0]), ['2026-11-14', '2026-12-12'], '앞뒤 1주일은 대여 불가 기간');
  // 11/14 부터 12/12 까지는 드론 18대가 잡혀 있음 (하늘초 10 + 푸른초 12 도 겹침)
  eq(Core.available(idx, drone, '2026-11-14', '2026-11-14', '', TODAY), 30 - 2 - 18 - 10 - 12, '11/14: 수리 2 + 센터 18 + 하늘초 10 + 푸른초 12 (음수 = 모자람)');
  eq(Core.available(idx, drone, '2026-11-13', '2026-11-13', '', TODAY), 30 - 2 - 10 - 12, '11/13 은 아직 센터 준비 기간 전(대여 건만 겹침)');
  eq(Core.available(idx, drone, '2026-12-12', '2026-12-12', '', TODAY), 30 - 2 - 18, '끝난 뒤 1주일(12/12)까지 대여 불가');
  eq(Core.available(idx, drone, '2026-12-13', '2026-12-13', '', TODAY), 30 - 2, '12/13 부터 다시 대여 가능');
  eq(Core.available(idx, drone, '2026-11-30', '2026-11-30', '', TODAY, 'G-2026-001'), 30 - 2, '프로그램 자신은 빼고 계산(수정할 때)');
  eq(Core.available(idx, d.items[2], '2026-11-25', '2026-11-25', '', TODAY), 36, '취소된 프로그램은 수량을 잡지 않음');
  eq(Core.itemStats(idx, drone, TODAY).prog, 18, '프로그램 수량 표시');
  // 버퍼 설정을 바꾸면 기간이 달라짐
  const idx0 = Core.makeIndex(d, { buffer: 0 });
  eq(Core.available(idx0, drone, '2026-11-14', '2026-11-14', '', TODAY), 30 - 2 - 10 - 12, '여유일 0 이면 센터 프로그램은 11/21 부터');
  // 외부 대여 검사에 반영
  const r = Core.checkLines(d, idx, [{ item: 'S-001', qty: 15 }], '2026-11-26', '2026-11-27', '', TODAY);
  eq(r.short[0].avail, 10 - 0, '센터 프로그램 기간에 외부 대여는 남은 10대만');
  // 프로그램 등록 검사
  const c1 = Core.checkProgram(d, idx, [{ item: 'S-002', qty: 15 }], '2026-12-20', '2026-12-26', '', TODAY);
  eq([c1.errors.length, c1.short.length], [0, 0], '겹침 없으면 통과');
  const c2 = Core.checkProgram(d, idx, [{ item: 'S-002', qty: 15 }], '2026-12-01', '2026-12-02', 'G-2026-001', TODAY);
  eq([c2.errors.length, c2.short.length], [0, 0], '자기 자신과는 겹침 아님');
  const c3 = Core.checkProgram(d, idx, [{ item: 'S-001', qty: 18 }], '2026-12-01', '2026-12-02', '', TODAY);
  eq(c3.short.length, 1, '이미 다른 프로그램이 잡고 있으면 모자람');
  ok(Core.checkProgram(d, idx, [{ item: 'S-002', qty: 99 }], '2026-12-20', '2026-12-22', '', TODAY).errors.length === 1, '보유수량보다 많이 못 잡음');
  ok(Core.checkProgram(d, idx, [{ item: 'P-001', qty: 1 }], '2026-12-20', '2026-12-22', '', TODAY).errors.length === 1, '준비물은 못 잡음');
  eq(Core.PROG_QTY, 18, '기본 수량 18');
  // 막고 있는 일정
  const bl = Core.blockers(d, idx, 'S-001', '2026-11-26', '2026-11-27', TODAY);
  eq(bl.map((x) => x.kind), ['센터', '수리'], '막고 있는 일정 종류(날짜순, 수리는 맨 뒤)');
  ok(bl.some((x) => x.kind === '센터' && x.qty === 18) && bl.some((x) => x.kind === '수리' && x.qty === 2), '센터 18 + 수리 2');
  // 묶기·달력·하루 목록
  const g = Core.groupPrograms(d.programs);
  eq([g.length, g[0].items.length], [2, 2], '교구 줄을 프로그램으로 묶음');
  const m = Core.rentalMonthMarks(d);
  eq([m['2026-11-07'].out, m['2026-11-14'].ret, m['2026-11-21'].prog[0].edge, m['2026-12-05'].prog[0].edge], [1, 1, 'start', 'end'], '달력 표시: 내주기·반납·프로그램 시작·끝');
  ok(!m['2026-11-07'].prog.length && !(m['2026-11-20'] || { out: 0 }).out, '취소된 대여는 표시 안 함');
  eq(Core.dayItems(d, '2026-11-28').map((x) => x.kind + ':' + (x.edge || '')), ['prog:during'], '진행 중인 프로그램은 그 날 목록에 나옴');
  const b = Core.briefing(d, '2026-11-18', 'all');
  ok(b.next.some((e) => e.kind === 'program' && e.date === '2026-11-21'), '브리핑 다음 대여에 센터 프로그램 시작');
})();

/* 정렬 */
(function sorting() {
  const items = [
    { id: 'C-003', cat: '창의교구', name: '하노이탑', loc: '자료실' }, { id: 'S-002', cat: 'SW교구', name: 'Beep Beep', loc: '라온실' },
    { id: 'C-001', cat: '창의교구', name: '가블리트', loc: '창의실' }, { id: 'S-001', cat: 'SW교구', name: '3D 블로커스', loc: '' },
    { id: 'C-002', cat: '창의교구', name: ' [신] 나비', loc: '자료실' }, { id: 'T-001', cat: 'SW교재', name: '오조봇 교재', loc: '혜윰실' }
  ];
  eq(Core.sortItems(items, 'ko').map((i) => i.name), ['3D 블로커스', 'Beep Beep', '가블리트', ' [신] 나비', '오조봇 교재', '하노이탑'], '가나다순: 숫자·영문 먼저, 앞의 기호·공백은 무시');
  eq(Core.sortItems(items, 'id').map((i) => i.id), ['C-001', 'C-002', 'C-003', 'S-001', 'S-002', 'T-001'], '관리번호순(분류 순서 → 번호)');
  eq(Core.sortItems(items, 'loc').map((i) => i.name), ['Beep Beep', ' [신] 나비', '하노이탑', '가블리트', '오조봇 교재', '3D 블로커스'], '위치별: 위치 가나다순, 같은 위치는 이름순, 위치 없음은 맨 뒤');
})();

console.log('core 테스트 통과: ' + passed + '개');
