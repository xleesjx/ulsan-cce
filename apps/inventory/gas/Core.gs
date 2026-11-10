/*
 * 창의센터 물품·시설 관리 — 공통 규칙 계산
 * 브라우저(docs/core.js)와 Apps Script(gas/Core.gs)에서 같은 내용으로 사용합니다.
 * gas/Core.gs 는 이 파일을 그대로 복사한 것입니다 (npm run build).
 *
 * 날짜는 모두 'yyyy-MM-dd' 글자, 시간은 'HH:MM' 글자로 다룹니다.
 */
var Core = (function () {
  'use strict';

  var CATS = ['창의교구', 'SW교구', 'SW교재', '기본준비물', '비품·장비'];
  var PREFIX = { '창의교구': 'C', 'SW교구': 'S', 'SW교재': 'T', '기본준비물': 'P', '비품·장비': 'E' };
  var RENTABLE = { '창의교구': 1, 'SW교구': 1, 'SW교재': 1 };
  var KINDS = ['외부 대여', '내부 대여', '센터 수업', '시설 관리'];
  var RENTAL_STATUS = ['예약됨', '대여중', '반납완료', '취소', '미수령'];
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /* ───────── 기본 도구 ───────── */

  function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function int(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* ───────── 날짜 ───────── */

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function fmt(d) { return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); }
  function validDate(s) { var d = parse(s); return !!d && fmt(d) === s; }
  function addDays(s, n) { var d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function dow(s) { return parse(s).getUTCDay(); }
  function shortDate(s) { var d = parse(s); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' (' + DOW[d.getUTCDay()] + ')'; }
  function longDate(s) { var d = parse(s); return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일 ' + DOW[d.getUTCDay()] + '요일'; }
  function mdDate(s) { var d = parse(s); return (d.getUTCMonth() + 1) + '월 ' + d.getUTCDate() + '일 (' + DOW[d.getUTCDay()] + ')'; }
  /** 한국 시각 기준 오늘 (ms 를 주면 그 시각 기준) */
  function todayStr(ms) { return fmt(new Date((ms === undefined ? Date.now() : ms) + 9 * 3600000)); }
  function nowStr(ms) {
    var d = new Date((ms === undefined ? Date.now() : ms) + 9 * 3600000);
    return fmt(d) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds());
  }
  function validTime(t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(t || ''); }
  function toMin(t) { return validTime(t) ? int(t.slice(0, 2)) * 60 + int(t.slice(3)) : null; }
  function monthOf(s) { return s.slice(0, 7); }

  /* ───────── 검색 (초성 지원) ───────── */

  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function initial(ch) {
    var c = ch.charCodeAt(0);
    if (c >= 0xAC00 && c <= 0xD7A3) return CHO.charAt(Math.floor((c - 0xAC00) / 588));
    return ch.toLowerCase();
  }
  function normQ(s) { return str(s).replace(/\s+/g, '').toLowerCase(); }
  /** 글자가 들어 있거나, 초성(ㄱㄴ…)이 맞으면 true */
  function matchKo(q, text) {
    q = normQ(q);
    if (!q) return true;
    var t = normQ(text);
    if (t.indexOf(q) >= 0) return true;
    var qa = Array.from(q), ta = Array.from(t);
    for (var i = 0; i + qa.length <= ta.length; i++) {
      var ok = true;
      for (var j = 0; j < qa.length; j++) {
        var qc = qa[j], tc = ta[i + j];
        if (CHO.indexOf(qc) >= 0) { if (initial(tc) !== qc) { ok = false; break; } } else if (qc !== tc) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  /* ───────── 물품·수량 ───────── */

  function isRentable(item) { return !!RENTABLE[item.cat] && item.status !== '폐기'; }

  function nextId(prefix, existing, width) {
    var max = 0, re = new RegExp('^' + prefix + '(\\d+)$');
    existing.forEach(function (id) { var m = re.exec(id); if (m && +m[1] > max) max = +m[1]; });
    var s = String(max + 1);
    while (s.length < width) s = '0' + s;
    return prefix + s;
  }
  function nextItemId(items, cat) {
    var pre = PREFIX[cat] + '-';
    return nextId(pre, items.map(function (i) { return i.id; }), 3);
  }
  /** 대여·수리·예약 번호: R-2026-001 처럼 해마다 새로 시작 */
  function nextYearId(letter, year, existing) {
    return nextId(letter + '-' + year + '-', existing, 3);
  }

  function outstanding(l) { return Math.max(0, int(l.qty) - int(l.ok) - int(l.broken) - int(l.lost)); }

  /** 수량 계산용 색인: 대여 건을 한 번만 훑어서 만듭니다 */
  function makeIndex(data) {
    var rmap = {}, byItem = {}, repair = {};
    data.rentals.forEach(function (r) { rmap[r.id] = r; });
    data.lines.forEach(function (l) {
      var r = rmap[l.rid];
      if (!r || (r.status !== '예약됨' && r.status !== '대여중')) return;
      var o = outstanding(l);
      if (o <= 0) return;
      (byItem[l.item] = byItem[l.item] || []).push({ r: r, qty: o });
    });
    data.repairs.forEach(function (x) {
      if (x.kind === '고장' && x.status === '대기') repair[x.item] = (repair[x.item] || 0) + int(x.qty);
    });
    return { rmap: rmap, byItem: byItem, repair: repair };
  }

  /** 이 대여 건이 물품을 쓰고 있는(또는 쓸) 기간. 연체 중이면 오늘까지로 봅니다 */
  function holdWindow(r, today) {
    var e = r.due;
    if (r.status === '대여중' && e < today) e = today;
    return [r.start, e];
  }

  function held(idx, itemId, from, to, excludeRid, today) {
    var sum = 0;
    (idx.byItem[itemId] || []).forEach(function (e) {
      if (e.r.id === excludeRid) return;
      var w = holdWindow(e.r, today);
      if (w[0] <= to && from <= w[1]) sum += e.qty;
    });
    return sum;
  }

  /** from~to 기간에 빌려줄 수 있는 수량 */
  function available(idx, item, from, to, excludeRid, today) {
    return int(item.qty) - (idx.repair[item.id] || 0) - held(idx, item.id, from, to, excludeRid, today);
  }

  function itemStats(idx, item, today) {
    var out = 0, res = 0;
    (idx.byItem[item.id] || []).forEach(function (e) {
      if (e.r.status === '대여중') out += e.qty;
      else if (e.r.due >= today) res += e.qty;
    });
    return { total: int(item.qty), out: out, reserved: res, repair: idx.repair[item.id] || 0, avail: available(idx, item, today, today, '', today) };
  }

  /** 대여할 품목 검사. 문제가 있으면 errors 에 한국어 문장을 담아 돌려줍니다 */
  function checkLines(data, idx, lines, start, due, excludeRid, today) {
    var errors = [], short = [], seen = {};
    var imap = {};
    data.items.forEach(function (i) { imap[i.id] = i; });
    if (!lines || !lines.length) errors.push('빌려줄 교구를 한 가지 이상 골라 주세요.');
    (lines || []).forEach(function (l) {
      var it = imap[l.item], q = int(l.qty);
      if (!it) { errors.push('없는 물품입니다: ' + l.item); return; }
      if (seen[l.item]) { errors.push(it.name + '이(가) 두 번 들어 있습니다.'); return; }
      seen[l.item] = 1;
      if (!isRentable(it)) { errors.push(it.name + '은(는) 대여할 수 없는 물품입니다.'); return; }
      if (q <= 0) { errors.push(it.name + ' 수량을 1개 이상으로 해 주세요.'); return; }
      var av = available(idx, it, start, due, excludeRid, today);
      if (q > av) {
        short.push({ item: it.id, name: it.name, want: q, avail: Math.max(0, av) });
        errors.push(it.name + ': 이 기간에 ' + Math.max(0, av) + '개만 빌려줄 수 있습니다. (요청 ' + q + '개)');
      }
    });
    return { errors: errors, short: short };
  }

  /* ───────── 대여 건 ───────── */

  function dueInfo(r, today) {
    if (r.status !== '대여중') return { overdue: 0, days: null };
    var d = diffDays(today, r.due);
    return { overdue: d < 0 ? -d : 0, days: d };
  }

  function linesSummary(lines, imap, max) {
    max = max || 2;
    var parts = lines.map(function (l) { var it = imap[l.item]; return (it ? it.name : l.item) + ' ' + int(l.qty) + (it && it.cat === 'SW교재' ? '권' : '개'); });
    if (parts.length <= max) return parts.join(', ');
    return parts.slice(0, max).join(', ') + ' 외 ' + (parts.length - max);
  }

  function dayLabel(date, today) {
    var d = diffDays(today, date);
    if (d === 0) return '오늘';
    if (d === 1) return '내일';
    return shortDate(date);
  }

  /* ───────── 교실 예약 ───────── */

  function resRange(res) {
    var s = toMin(res.start), e = toMin(res.end);
    if (s === null) return [0, 1440];
    if (e === null || e <= s) return [s, 1440];
    return [s, e];
  }

  /** 같은 교실·같은 날짜에 시간이 겹치는 다른 예약 */
  function roomConflicts(res, all) {
    if (!res.room || res.status === '취소') return [];
    var a = resRange(res);
    return all.filter(function (o) {
      if (o.id === res.id || o.status === '취소' || o.room !== res.room || o.date !== res.date) return false;
      var b = resRange(o);
      return a[0] < b[1] && b[0] < a[1];
    });
  }

  function timeLabel(res) {
    if (!res.start) return '종일';
    return res.start + (res.end ? '~' + res.end : '~');
  }

  var KIND_CLASS = { '외부 대여': 'blue', '내부 대여': 'orange', '센터 수업': 'green', '시설 관리': 'gray' };

  /** 달력 한 달 (일요일 시작). 각 칸은 { date, inMonth } */
  function monthGrid(ym) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    var first = y + '-' + p2(m) + '-01';
    var start = addDays(first, -dow(first));
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var d = addDays(start, i);
      cells.push({ date: d, inMonth: monthOf(d) === ym });
    }
    // 마지막 줄이 전부 다음 달이면 뺍니다
    while (cells.length > 35 && !cells.slice(-7).some(function (c) { return c.inMonth; })) cells.splice(-7, 7);
    return cells;
  }
  function addMonths(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + p2(m + 1);
  }

  /** 하루치 달력 표시: 교실 약자(또는 교실 없는 일정의 제목)와 종류 색 */
  function dayMarks(reservations, rooms, date) {
    var order = {}, shortOf = {};
    rooms.forEach(function (r, i) { order[r.name] = r.order || i + 1; shortOf[r.name] = r.short || r.name.charAt(0); });
    var marks = [], seen = {};
    reservations.filter(function (r) { return r.status !== '취소' && r.date === date; })
      .sort(function (a, b) { return (order[a.room] || 99) - (order[b.room] || 99); })
      .forEach(function (r) {
        var label = r.room ? shortOf[r.room] || r.room.charAt(0) : (str(r.purpose).slice(0, 4) || '일정');
        var key = label + '|' + r.kind;
        if (seen[key]) return;
        seen[key] = 1;
        marks.push({ label: label, cls: KIND_CLASS[r.kind] || 'gray', kind: r.kind, wide: !r.room });
      });
    return marks;
  }

  /* ───────── 브리핑 ───────── */

  /**
   * 오늘의 브리핑. filter: 'all' | '교구' | '교실'
   * docs: 공문 접수 확인이 필요한 건, today: 오늘 할 일, next: 다음 대여(가까운 날부터)
   */
  function briefing(data, today, filter, nextLimit) {
    filter = filter || 'all';
    var imap = {}, linesBy = {};
    data.items.forEach(function (i) { imap[i.id] = i; });
    data.lines.forEach(function (l) { (linesBy[l.rid] = linesBy[l.rid] || []).push(l); });
    var want = function (t) { return filter === 'all' || filter === t; };
    var docs = [], todayEv = [], next = [];

    data.rentals.forEach(function (r) {
      if (!want('교구')) return;
      var active = r.status === '예약됨' || r.status === '대여중';
      if (!active) return;
      var sum = linesSummary(linesBy[r.id] || [], imap, 2);
      var who = r.school + ' · ' + r.teacher;
      if (!r.docOk) docs.push({ type: '교구', id: r.id, title: who, sub: shortDate(r.start) + ' ' + sum, days: diffDays(today, r.start), status: r.status });
      if (r.status === '대여중') {
        var di = dueInfo(r, today);
        if (di.overdue > 0) todayEv.push({ type: '교구', kind: 'overdue', id: r.id, title: who, sub: sum + ' · 반납 예정이 ' + shortDate(r.due) + ' (' + di.overdue + '일 지남)', phone: r.phone, order: 0, date: today });
        else if (r.due === today) todayEv.push({ type: '교구', kind: 'return', id: r.id, title: who, sub: sum, order: 2, date: today });
        else if (r.due > today) next.push({ type: '교구', kind: 'return', id: r.id, title: who, sub: sum, date: r.due, order: 2 });
      } else {
        if (r.start <= today) todayEv.push({ type: '교구', kind: 'handout', id: r.id, title: who, sub: sum + (r.start < today ? ' · ' + shortDate(r.start) + ' 예약 (아직 안 가져감)' : ''), order: 1, date: today });
        else next.push({ type: '교구', kind: 'handout', id: r.id, title: who, sub: sum, date: r.start, order: 1 });
      }
    });

    data.reservations.forEach(function (v) {
      if (!want('교실') || v.status === '취소') return;
      if (v.kind === '외부 대여' && !v.docOk && v.date >= today) docs.push({ type: '교실', id: v.id, title: (v.org ? v.org + ' · ' : '') + v.person, sub: shortDate(v.date) + ' ' + (v.room || '') + ' ' + timeLabel(v), days: diffDays(today, v.date) });
      var ev = { type: '교실', kind: 'room', id: v.id, rkind: v.kind, title: (v.room || '일정') + ' · ' + timeLabel(v), sub: v.kind + ' · ' + v.purpose + (v.person ? ' · ' + v.person : ''), time: v.start || '00:00', order: 3, date: v.date };
      if (v.date === today) todayEv.push(ev);
      else if (v.date > today) next.push(ev);
    });

    docs.sort(function (a, b) { return a.days - b.days; });
    todayEv.sort(function (a, b) { return a.order - b.order || (a.time || '').localeCompare(b.time || ''); });
    next.sort(function (a, b) { return a.date.localeCompare(b.date) || a.order - b.order || (a.time || '').localeCompare(b.time || ''); });
    var total = next.length;
    if (nextLimit) next = next.slice(0, nextLimit);
    return { docs: docs, today: todayEv, next: next, nextTotal: total };
  }

  /* ───────── 개인정보 가리기 ───────── */

  function needsMaskRental(r, today, days) {
    return !!r.phone && r.status === '반납완료' && !!r.returnedAt && diffDays(r.returnedAt, today) > days;
  }
  function needsMaskRes(v, today, days) {
    return !!(v.mobile || v.office) && validDate(v.date) && diffDays(v.date, today) > days;
  }

  function fmtPhone(s) {
    var d = str(s).replace(/\D/g, '');
    if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    if (d.length === 10 && d.slice(0, 2) === '02') return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6);
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    if (d.length === 9 && d.slice(0, 2) === '02') return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
    if (d.length === 8) return d.slice(0, 4) + '-' + d.slice(4);
    return str(s);
  }

  /* ───────── 실적 ───────── */

  function inRange(d, from, to) { return d >= from && d <= to; }

  function stats(data, from, to) {
    var imap = {}, rmap = {};
    data.items.forEach(function (i) { imap[i.id] = i; });
    var byItem = {}, bySchool = {}, rentals = 0, qtySum = 0;
    data.rentals.forEach(function (r) {
      if ((r.status !== '대여중' && r.status !== '반납완료') || !inRange(r.start, from, to)) return;
      rentals++;
      rmap[r.id] = r;
      bySchool[r.school] = (bySchool[r.school] || 0) + 1;
    });
    data.lines.forEach(function (l) {
      if (!rmap[l.rid]) return;
      var o = byItem[l.item] || (byItem[l.item] = { id: l.item, name: imap[l.item] ? imap[l.item].name : l.item, count: 0, qty: 0 });
      o.count++; o.qty += int(l.qty); qtySum += int(l.qty);
    });
    var byRoom = {}, byKind = {}, resCount = 0;
    data.reservations.forEach(function (v) {
      if (v.status === '취소' || !inRange(v.date, from, to)) return;
      resCount++;
      var r = toMin(v.start) === null ? null : resRange(v);
      var mins = r ? r[1] === 1440 && toMin(v.end) === null ? 0 : r[1] - r[0] : 0;
      var rk = v.room || '(교실 없음)';
      var ro = byRoom[rk] || (byRoom[rk] = { name: rk, count: 0, minutes: 0 });
      ro.count++; ro.minutes += mins;
      var ko = byKind[v.kind] || (byKind[v.kind] = { name: v.kind, count: 0, minutes: 0 });
      ko.count++; ko.minutes += mins;
    });
    function arr(o) { return Object.keys(o).map(function (k) { return o[k]; }); }
    return {
      rentals: rentals, qty: qtySum, reservations: resCount,
      items: arr(byItem).sort(function (a, b) { return b.count - a.count || b.qty - a.qty; }),
      schools: Object.keys(bySchool).map(function (k) { return { name: k, count: bySchool[k] }; }).sort(function (a, b) { return b.count - a.count; }),
      rooms: arr(byRoom).sort(function (a, b) { return b.count - a.count; }),
      kinds: arr(byKind)
    };
  }

  /* ───────── 내려받기 ───────── */

  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = c === null || c === undefined ? '' : String(c);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }

  return {
    CATS: CATS, PREFIX: PREFIX, RENTABLE: RENTABLE, KINDS: KINDS, RENTAL_STATUS: RENTAL_STATUS, KIND_CLASS: KIND_CLASS, DOW: DOW,
    str: str, int: int, parse: parse, fmt: fmt, validDate: validDate, addDays: addDays, diffDays: diffDays, dow: dow,
    shortDate: shortDate, longDate: longDate, mdDate: mdDate, todayStr: todayStr, nowStr: nowStr, validTime: validTime, toMin: toMin, monthOf: monthOf,
    chosung: function (s) { return Array.from(s).map(initial).join(''); }, matchKo: matchKo,
    isRentable: isRentable, nextItemId: nextItemId, nextYearId: nextYearId, outstanding: outstanding,
    makeIndex: makeIndex, holdWindow: holdWindow, available: available, itemStats: itemStats, checkLines: checkLines,
    dueInfo: dueInfo, linesSummary: linesSummary, dayLabel: dayLabel,
    resRange: resRange, roomConflicts: roomConflicts, timeLabel: timeLabel, monthGrid: monthGrid, addMonths: addMonths, dayMarks: dayMarks,
    briefing: briefing, needsMaskRental: needsMaskRental, needsMaskRes: needsMaskRes, fmtPhone: fmtPhone, stats: stats, toCsv: toCsv
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Core; }
