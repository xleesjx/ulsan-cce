/*
 * 교구 잔여 확인: 전화 문의("A교구 며칠부터 며칠까지 몇 대 빌릴 수 있나요?")에 바로 답하는 화면
 * 교구·날짜·수량을 넣으면 가능/불가가 나오고, 그 교구의 한 달 남은 수량 달력도 보여 줍니다.
 * 교구대여 화면의 [잔여 확인] 탭과 물품 상세 화면에서 같이 씁니다.
 */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;

  function st() {
    if (!S.ui.av) { var t = App.today(); S.ui.av = { item: '', s: t, e: t, n: 1, ym: Core.monthOf(t), cal: false }; }
    return S.ui.av;
  }

  /* ───────── 입력 칸 ───────── */

  function inputsHtml() {
    var u = st(), it = u.item ? App.imap()[u.item] : null, t = App.today();
    return '<section class="card"><h2>교구 가능 여부 확인</h2><span class="xs muted">전화로 문의가 왔을 때: 교구, 날짜, 수량을 넣으면 바로 답이 나와요.</span>' +
      '<label class="f">교구<input id="av-q" data-in="avq" value="' + esc(it ? it.name : '') + '" placeholder="교구 이름이나 초성으로 검색 (예: ㄷㄹ)" autocomplete="off"></label>' +
      '<div class="grid2"><label class="f">빌리는 날<input id="av-s" type="date" data-in="avd" value="' + esc(u.s) + '"></label><label class="f">반납하는 날<input id="av-e" type="date" data-in="avd" value="' + esc(u.e) + '"></label></div>' +
      '<div class="pills" style="flex-wrap:wrap;overflow:visible"><button type="button" class="pill" data-act="avstart" data-d="' + t + '">오늘부터</button><button type="button" class="pill" data-act="avstart" data-d="' + Core.addDays(t, 1) + '">내일부터</button>' +
      [['하루', 0], ['+3일', 3], ['+1주', 7], ['+2주', 14]].map(function (x) { return '<button type="button" class="pill" data-act="avend" data-n="' + x[1] + '">' + x[0] + '</button>'; }).join('') + '</div>' +
      '<div class="row between"><span class="small b" style="color:var(--soft)">빌리려는 수량</span>' + App.stepper('av-n', u.n, { min: 1, inName: 'avn' }) + '</div></section>';
  }

  /* ───────── 결과 ───────── */

  function resultHtml() {
    var u = st(), today = App.today();
    if (!Core.validDate(u.s) || !Core.validDate(u.e)) return '<div class="card"><span class="muted">날짜를 확인해 주세요.</span></div>';
    if (u.e < u.s) return '<div class="card"><span style="color:var(--red);font-weight:700">반납하는 날이 빌리는 날보다 빨라요.</span></div>';
    var idx = App.idx(), it = u.item ? App.imap()[u.item] : null;
    return it ? oneHtml(it, idx, today) : listHtml(idx, today);
  }

  function oneHtml(it, idx, today) {
    var u = st(), L = Core.lookup(S.data, idx, it.id, u.s, u.e, u.n, today);
    var period = Core.shortDate(u.s) + (u.e !== u.s ? ' ~ ' + Core.shortDate(u.e) : '');
    var unit = it.cat === 'SW교재' ? '권' : '대';
    var h = '<div class="col gap8"><section class="lkres ' + (L.ok ? 'ok' : 'no') + '" role="status"><b class="big">' + (L.ok ? '가능합니다' : L.canLend === 0 ? '빌려줄 수 없어요' : L.qty + unit + '는 어려워요') + '</b>' +
      '<span>' + esc(it.name) + ' ' + L.qty + unit + ' · ' + esc(period) + '</span>' +
      '<span class="small" style="font-weight:700">이 기간 최대 ' + L.canLend + unit + '까지 빌려줄 수 있어요 <span class="muted" style="font-weight:400">(보유 ' + L.total + unit + ')</span></span></section>';
    if (!Core.isRentable(it)) h += '<div class="tip">이 물품은 대여용이 아니에요.</div>';
    if (L.blockers.length) {
      var kindCls = { '대여': 'blue', '센터': 'orange', '수리': 'red' };
      h += '<section class="card"><b>이 기간에 나가 있거나 잡혀 있는 것</b>' + (L.peakDate ? '<span class="small muted">가장 빠듯한 날: ' + esc(Core.shortDate(L.peakDate)) + ' (그날 ' + L.peakHeld + unit + ' 나가 있음' + (L.repair ? ', 수리 대기 ' + L.repair + unit : '') + ')</span>' : '') +
        L.blockers.map(function (b) {
          var link = b.kind === '대여' ? 'rental/' + b.id : b.kind === '센터' ? 'prog/' + b.id : '';
          var inner = '<span class="chip ' + kindCls[b.kind] + '">' + b.kind + '</span><span>' + esc(b.title) + ' · ' + b.qty + unit + (b.from ? ' · ' + esc(Core.shortDate(b.from) + ' ~ ' + Core.shortDate(b.to)) + (b.kind === '센터' ? ' (준비·점검 포함)' : '') : '') + '</span>';
          return link ? '<button class="row gap6 wrap" style="background:none;border:0;padding:4px 0;text-align:left;font-size:14px" data-act="go" data-to="' + esc(link) + '">' + inner + '</button>' : '<div class="row gap6 wrap small">' + inner + '</div>';
        }).join('') + '</section>';
    } else h += '<div class="card"><span class="small muted">이 기간에 나가 있거나 잡혀 있는 일정이 없습니다.</span></div>';
    if (L.returnsOnStart > 0) h += '<div class="tip">빌리는 날(' + esc(Core.shortDate(u.s)) + ')에 <b>반납 예정인 ' + L.returnsOnStart + unit + '</b>는 아직 나가 있는 것으로 계산했어요. 그날 아침에 돌려받는다면 그만큼 더 빌려줄 수 있어요.</div>';
    if (L.overdue > 0 && u.e >= today) h += '<div class="tip" style="background:var(--red-soft);border-color:var(--red-line);color:var(--red)"><b>연체 중인 ' + L.overdue + unit + '</b>는 돌아온 것으로 계산했어요. 아직 안 돌아왔다면 그만큼 모자랄 수 있어요.</div>';
    if (L.avail < 0) h += '<div class="tip" style="background:var(--red-soft);border-color:var(--red-line);color:var(--red)">이 기간에는 이미 보유 수량보다 많이 잡혀 있어요 (' + (-L.avail) + unit + ' 초과).</div>';
    h += '<div class="row gap8 wrap">' + (L.ok && Core.isRentable(it) ? '<button class="btn primary block" data-act="avreserve">이 내용으로 대여 예약</button>' : '') +
      '<button class="btn block" data-act="avcal">' + (u.cal ? '한 달 달력 닫기' : '이 교구 한 달 달력 보기') + '</button></div>';
    if (u.cal) h += '<section class="card">' + itemCal(it, u.ym, 'aymonth', 'avday') + '</section>';
    return h + '</div>';
  }

  function listHtml(idx, today) {
    var u = st(), R = Core.reducedItems(S.data, idx, u.s, u.e, today), period = Core.shortDate(u.s) + (u.e !== u.s ? ' ~ ' + Core.shortDate(u.e) : '');
    var h = '<section class="card flush"><div class="row between" style="padding:12px 0 6px"><b>' + esc(period) + ' 에 수량이 줄어드는 교구</b><span class="chip gray">' + R.list.length + '종</span></div>';
    if (!R.list.length) h += '<div class="muted small" style="padding:6px 0 14px">이 기간에는 모든 교구를 전량 빌려줄 수 있어요.</div>';
    R.list.slice(0, 40).forEach(function (x) {
      var cls = x.avail <= 0 ? 'low' : x.avail < x.total / 3 ? 'low' : 'ok';
      h += '<button class="crow" style="padding:8px 0" data-act="avpick" data-id="' + esc(x.item.id) + '"><span class="nm ellip">' + esc(x.item.name) + '</span><span class="qt ' + cls + '">' + Math.max(0, x.avail) + ' / ' + x.total + '</span></button>';
    });
    if (R.list.length > 40) h += '<div class="muted small" style="padding:8px 0">(남은 수량이 적은 40종만 보여 줘요. 교구 이름으로 검색해 보세요.)</div>';
    h += '</section><div class="tip blue">위 목록에 없는 <b>' + R.fullCount + '종</b>은 이 기간에 전량 빌려줄 수 있어요. 교구 이름을 검색하면 원하는 수량이 가능한지 바로 알려 줘요.</div>';
    return '<div class="col gap8">' + h + '</div>';
  }

  /* ───────── 교구 한 달 달력 (남은 수량) ───────── */

  function itemCal(it, ym, monthAct, dayAct) {
    var idx = App.idx(), today = App.today(), m = Core.monthAvail(idx, it, ym, today), total = Core.int(it.qty), p = ym.split('-');
    return '<div class="col gap8"><div class="row between"><b>' + esc(it.name) + ' · 날짜별 남은 수량</b></div>' +
      '<div class="row between"><button class="iconbtn" data-act="' + monthAct + '" data-d="-1" data-item="' + esc(it.id) + '" aria-label="이전 달">' + App.icon('left') + '</button><b style="font-size:16px">' + p[0] + '년 ' + (+p[1]) + '월</b><button class="iconbtn" data-act="' + monthAct + '" data-d="1" data-item="' + esc(it.id) + '" aria-label="다음 달">' + App.icon('right') + '</button></div>' +
      '<div class="row wrap gap12 xs" style="color:var(--soft)"><span><b class="avn ok">20</b> 넉넉</span><span><b class="avn low">5</b> 적음</span><span><b class="avn zero">0</b> 없음</span><span class="muted">날짜를 누르면 그날로 확인해요 · 보유 ' + total + '</span></div>' +
      '<div class="cal" role="grid" aria-label="날짜별 남은 수량">' + Core.DOW.map(function (d, i) { return '<div class="dow" style="' + (i === 0 ? 'color:#B3261E' : i === 6 ? 'color:var(--blue-ink)' : '') + '">' + d + '</div>'; }).join('') +
      Core.monthGrid(ym).map(function (c) {
        if (!c.inMonth) return '<div class="cell out"><span class="d">' + (+c.date.slice(8)) + '</span></div>';
        var a = m[c.date], cls = a <= 0 ? 'zero' : a < total / 3 ? 'low' : 'ok', w = Core.dow(c.date);
        return '<button class="cell av ' + cls + (c.date === today ? ' today' : '') + '" data-act="' + dayAct + '" data-d="' + c.date + '" data-item="' + esc(it.id) + '" aria-label="' + Core.mdDate(c.date) + ' 남은 수량 ' + Math.max(0, a) + '개"><span class="d' + (w === 0 ? ' sun' : w === 6 ? ' sat' : '') + '">' + (+c.date.slice(8)) + '</span><span class="avn ' + cls + '">' + Math.max(0, a) + '</span></button>';
      }).join('') + '</div></div>';
  }

  /* ───────── 그리기와 입력 처리 ───────── */

  function draw() { var el = document.getElementById('av-res'); if (el) el.innerHTML = resultHtml(); }

  function syncInputs() {
    var u = st(), s = document.getElementById('av-s'), e = document.getElementById('av-e'), n = document.getElementById('av-n'), q = document.getElementById('av-q');
    if (s) s.value = u.s; if (e) e.value = u.e; if (n) n.value = u.n;
    if (q) q.value = u.item && App.imap()[u.item] ? App.imap()[u.item].name : '';
  }

  App.avail = {
    inputs: inputsHtml, result: resultHtml, itemCal: itemCal,
    after: function () { draw(); },
    /** 다른 화면에서 이 화면으로 넘어올 때: 교구·날짜·수량을 미리 채움 */
    open: function (item, s, e, n) {
      var u = st();
      if (item !== undefined) u.item = item;
      if (s) { u.s = s; u.e = e || s; u.ym = Core.monthOf(s); }
      if (n) u.n = n;
      if (!S.ui.rt) S.ui.rt = { tab: '예약됨', n: 30, v: 'av', m: '', d: '' };
      S.ui.rt.v = 'av';
      App.go('rentals');
    }
  };

  App.ins.avq = function (el) {
    var u = st(), q = el.value.trim();
    if (!q) { App.hideSug(); u.item = ''; draw(); return; }
    var idx = App.idx(), today = App.today();
    var hits = S.data.items.filter(function (it) { return Core.isRentable(it) && Core.matchKo(q, it.name + ' ' + it.id); }).slice(0, 8).map(function (it) {
      var a = Core.available(idx, it, Core.validDate(u.s) ? u.s : today, Core.validDate(u.e) ? u.e : today, '', today);
      return { label: it.name, sub: it.id + ' · 가능 ' + Math.max(0, a), value: it.id };
    });
    App.showSug(el, hits, function (it) { u.item = it.value; el.value = it.label; draw(); });
  };
  App.ins.avd = function () {
    var u = st(), s = document.getElementById('av-s').value, e = document.getElementById('av-e').value;
    if (Core.validDate(s)) { var moved = s !== u.s; u.s = s; if (moved && (!Core.validDate(e) || e < s)) { u.e = s; document.getElementById('av-e').value = s; } else if (Core.validDate(e)) u.e = e; }
    else if (Core.validDate(e)) u.e = e;
    if (Core.validDate(u.s)) u.ym = Core.monthOf(u.s);
    draw();
  };
  App.ins.avn = function (el) { st().n = Math.max(1, parseInt(el.value, 10) || 1); draw(); };
  App.acts.avstart = function (el) { var u = st(); u.s = el.getAttribute('data-d'); if (u.e < u.s) u.e = u.s; u.ym = Core.monthOf(u.s); syncInputs(); draw(); };
  App.acts.avend = function (el) { var u = st(); if (!Core.validDate(u.s)) return; u.e = Core.addDays(u.s, +el.getAttribute('data-n')); syncInputs(); draw(); };
  App.acts.avpick = function (el) { var u = st(); u.item = el.getAttribute('data-id'); syncInputs(); draw(); window.scrollTo(0, 0); };
  App.acts.avcal = function () { var u = st(); u.cal = !u.cal; draw(); };
  App.acts.aymonth = function (el) { var u = st(); u.ym = Core.addMonths(u.ym, +el.getAttribute('data-d')); draw(); };
  App.acts.avday = function (el) { var u = st(), d = el.getAttribute('data-d'); u.item = el.getAttribute('data-item') || u.item; u.s = d; u.e = d; syncInputs(); draw(); window.scrollTo(0, 0); };
  App.acts.avreserve = function () {
    var u = st();
    App.go('rental/new', { item: u.item, start: u.s, due: u.e, qty: u.n });
  };

  /* 물품 상세 화면에서: 날짜를 누르면 그 날짜로 잔여 확인 화면을 엽니다 */
  App.acts.icmonth = function (el) {
    var ic = S.ui.ic || (S.ui.ic = { ym: Core.monthOf(App.today()) });
    ic.ym = Core.addMonths(ic.ym, +el.getAttribute('data-d'));
    App.render();
  };
  App.acts.icday = function (el) { var d = el.getAttribute('data-d'); App.avail.open(el.getAttribute('data-item'), d, d, 1); };
  App.acts.avdate = function (el) { var d = el.getAttribute('data-d'); App.avail.open(undefined, d, d); };
})();
