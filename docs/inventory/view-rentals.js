/* 교구 대여: 목록 · 예약 등록/수정 · 내주기(서명) · 반납 받기 · 상세 */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;
  var sig = null;      // 서명 칸
  var photos = {};     // 반납 사진 { 줄번호: dataURL }
  var F = null;        // 예약 등록 화면의 입력 상태

  function ui() { return S.ui.rt || (S.ui.rt = { tab: '예약됨', n: 30, v: 'cal', m: '', d: '' }); }
  function wideLg() { return App.wide(); }

  /* ───────── 대여 메뉴 (목록) ───────── */

  function header(counts) {
    var u = ui();
    return '<div class="top"><div class="row between"><h1>교구 대여</h1><div class="row gap6"><button class="btn sm" data-act="go" data-to="prog/new">+ 센터 프로그램</button><button class="btn primary sm" data-act="go" data-to="rental/new">+ 새 대여</button></div></div>' +
      '<div class="seg" role="group" aria-label="보기">' + [['cal', '달력'], ['list', '목록 · 반납 확인']].map(function (t) {
        return '<button data-act="rview" data-v="' + t[0] + '" class="' + (u.v === t[0] ? 'on' : '') + '" aria-pressed="' + (u.v === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      (u.v === 'list' ? '<div class="tabs" role="tablist">' + [['예약됨', '예약됨 ' + counts.res], ['대여중', '대여 중 ' + counts.out], ['지난', '지난 건']].map(function (t) {
        return '<button role="tab" class="' + (u.tab === t[0] ? 'on' : '') + '" aria-selected="' + (u.tab === t[0]) + '" data-act="rtab" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' : '') + '</div>';
  }

  function card(r, sel) {
    var today = App.today(), di = Core.dueInfo(r, today);
    var chips = App.rentalChip(r);
    if (di.overdue) chips = '<span class="chip red">연체 ' + di.overdue + '일</span>';
    else if (r.status === '대여중' && di.days === 0) chips = '<span class="chip green">오늘 반납</span>';
    else if (r.status === '대여중' && di.days <= 3) chips = '<span class="chip gray">D-' + di.days + '</span>';
    if (r.status !== '반납완료' && r.status !== '취소' && r.status !== '미수령' && !r.docOk) chips += ' <span class="chip amber">공문 확인 전</span>';
    var dates = r.status === '예약됨' ? '대여 ' + Core.shortDate(r.start) + ' · 반납 ' + Core.shortDate(r.due) : r.status === '반납완료' ? Core.shortDate(r.start) + ' ~ ' + Core.shortDate(r.returnedAt || r.due) : '반납 예정 ' + Core.shortDate(r.due);
    var act = '';
    if (r.status === '예약됨') act = '<button class="btn dark sm" data-act="go" data-to="rental/' + esc(r.id) + '/handover">내주기</button>';
    if (r.status === '대여중') act = '<button class="btn dark sm" data-act="go" data-to="rental/' + esc(r.id) + '/return">반납 받기</button>';
    return '<div class="card' + (di.overdue ? ' alert' : '') + '" style="' + (sel ? 'border:2px solid var(--blue)' : '') + '"><button class="ev" style="padding:0;border:0" data-act="go" data-to="rental/' + esc(r.id) + '"><div class="main"><div class="row between gap8"><span class="t">' + App.who(r) + '</span><span>' + chips + '</span></div><span class="s">' + App.sum(r.id, 3) + '</span></div></button>' +
      '<div class="row between"><span class="xs muted">' + esc(dates) + '</span>' + act + '</div></div>';
  }

  function listHtml(rid) {
    var u = ui(), rs = S.data.rentals.slice();
    var list;
    if (u.tab === '예약됨') list = rs.filter(function (r) { return r.status === '예약됨'; }).sort(function (a, b) { return a.start.localeCompare(b.start); });
    else if (u.tab === '대여중') list = rs.filter(function (r) { return r.status === '대여중'; }).sort(function (a, b) { return a.due.localeCompare(b.due); });
    else list = rs.filter(function (r) { return r.status === '반납완료' || r.status === '취소' || r.status === '미수령'; }).sort(function (a, b) { return (b.returnedAt || b.start).localeCompare(a.returnedAt || a.start); });
    var shown = list.slice(0, u.n);
    var h = '<div class="col gap8">';
    if (u.tab === '대여중') h += '<span class="small muted">반납해야 할 건 · 반납 예정일이 빠른 순서</span>';
    if (!shown.length) h += '<div class="card"><span class="muted">' + (u.tab === '예약됨' ? '예약된 대여가 없습니다.' : u.tab === '대여중' ? '대여 중인 건이 없습니다.' : '지난 건이 없습니다.') + '</span></div>';
    shown.forEach(function (r) { h += card(r, r.id === rid); });
    if (list.length > shown.length) h += '<button class="btn" data-act="morert">더 보기 (' + (list.length - shown.length) + '건 더 있어요)</button>';
    return h + '</div>';
  }

  /* ───────── 달력 ───────── */

  function calInit(route) {
    var u = ui(), q = (route && route.q) || {}, today = App.today();
    if (Core.validDate((q.d || '')) ) { u.d = q.d; u.m = Core.monthOf(q.d); }
    else if (q.m) u.m = q.m;
    if (!u.m) u.m = Core.monthOf(today);
    if (!u.d || Core.monthOf(u.d) !== u.m) u.d = Core.monthOf(today) === u.m ? today : u.m + '-01';
  }

  function calHtml() {
    var u = ui(), today = App.today(), marks = Core.rentalMonthMarks(S.data), cells = Core.monthGrid(u.m), ym = u.m.split('-');
    return '<div class="col gap8" style="padding:0 12px">' +
      '<div class="row between"><button class="iconbtn" data-act="cmonth" data-d="-1" aria-label="이전 달">' + App.icon('left') + '</button><b style="font-size:17px">' + ym[0] + '년 ' + (+ym[1]) + '월</b><button class="iconbtn" data-act="cmonth" data-d="1" aria-label="다음 달">' + App.icon('right') + '</button></div>' +
      '<div class="row wrap gap12 xs" style="color:var(--soft)"><span class="row gap4"><i class="mk blue">↗</i>내주기</span><span class="row gap4"><i class="mk green">↙</i>반납 예정</span><span class="row gap4"><i class="mk orange">센터</i>프로그램 시작·끝</span></div>' +
      '<div class="cal" role="grid" aria-label="교구 대여 달력">' + Core.DOW.map(function (d, i) { return '<div class="dow" style="' + (i === 0 ? 'color:#B3261E' : i === 6 ? 'color:var(--blue-ink)' : '') + '">' + d + '</div>'; }).join('') +
      cells.map(function (c) {
        var m = marks[c.date] || { out: 0, ret: 0, prog: [] }, dd = +c.date.slice(8), w = Core.dow(c.date);
        var total = m.out + m.ret + m.prog.length;
        return '<button class="cell' + (c.inMonth ? '' : ' out') + (c.date === u.d ? ' sel' : '') + (c.date === today ? ' today' : '') + '" data-act="cday" data-d="' + c.date + '" aria-label="' + Core.mdDate(c.date) + (total ? ', 내주기 ' + m.out + '건, 반납 ' + m.ret + '건' + (m.prog.length ? ', 센터 프로그램 ' + m.prog.length + '건' : '') : '') + '"><span class="d' + (w === 0 ? ' sun' : w === 6 ? ' sat' : '') + '">' + dd + '</span><div class="bs">' +
          (m.out ? '<i class="mk blue">↗' + m.out + '</i>' : '') + (m.ret ? '<i class="mk green">↙' + m.ret + '</i>' : '') + (m.prog.length ? '<i class="mk orange">센터</i>' : '') + '</div></button>';
      }).join('') + '</div></div>';
  }

  function dayListHtml() {
    var u = ui(), items = Core.dayItems(S.data, u.d), imap = App.imap(), today = App.today();
    var order = { out: 0, ret: 1, prog: 2 };
    items.sort(function (a, b) { return order[a.kind] - order[b.kind]; });
    var h = '<h2 style="font-size:16px;margin:4px 2px">' + esc(Core.longDate(u.d)) + '</h2>';
    if (!items.length) h += '<div class="card"><span class="muted">이 날은 내주기·반납·센터 프로그램이 없습니다.</span></div>';
    items.forEach(function (it) {
      if (it.kind === 'prog') {
        var g = it.g, edge = it.edge === 'start' ? '시작' : it.edge === 'end' ? '끝' : '진행 중';
        h += '<div class="ev res"><div class="stripe orange"></div><button class="mainbtn" data-act="go" data-to="prog/' + esc(g.id) + '"><div class="main"><div class="row between gap8"><span class="t">센터 프로그램 · ' + edge + '</span><span class="chip orange">' + esc(Core.shortDate(g.start) + ' ~ ' + Core.shortDate(g.end)) + '</span></div>' +
          '<span class="s" style="font-size:14px;color:var(--ink)">' + esc(g.name) + '</span><span class="s">' + esc(g.items.map(function (x) { return (imap[x.item] ? imap[x.item].name : x.item) + ' ' + x.qty; }).join(', ')) + '</span></div></button>' +
          '<button class="btn sm side" data-act="go" data-to="prog/' + esc(g.id) + '">수정</button></div>';
        return;
      }
      var r = it.r, di = Core.dueInfo(r, today), out = it.kind === 'out';
      var chip = App.rentalChip(r) + (di.overdue ? ' <span class="chip red">연체 ' + di.overdue + '일</span>' : '') + (!r.docOk && (r.status === '예약됨' || r.status === '대여중') ? ' <span class="chip amber">공문 확인 전</span>' : '');
      var act = '';
      if (r.status === '예약됨' && out) act = '<button class="btn dark sm side" data-act="go" data-to="rental/' + esc(r.id) + '/handover">내주기</button>';
      else if (r.status === '대여중' && !out) act = '<button class="btn dark sm side" data-act="go" data-to="rental/' + esc(r.id) + '/return">반납 받기</button>';
      h += '<div class="ev res"><div class="stripe ' + (out ? 'blue' : 'green') + '"></div><button class="mainbtn" data-act="go" data-to="rental/' + esc(r.id) + '"><div class="main"><div class="row between gap8"><span class="t">' + (out ? '내주기' : '반납 예정') + '</span><span>' + chip + '</span></div>' +
        '<span class="s" style="font-size:14px;color:var(--ink)">' + App.who(r) + '</span><span class="s">' + App.sum(r.id, 3) + '</span></div></button>' + act + '</div>';
    });
    return h;
  }

  App.acts.cday = function (el) { var u = ui(); u.d = el.getAttribute('data-d'); u.m = Core.monthOf(u.d); if (App.parseHash().path.length > 1) App.go('rentals'); else App.render(); };
  App.acts.cmonth = function (el) { var u = ui(); u.m = Core.addMonths(u.m, +el.getAttribute('data-d')); u.d = ''; App.render(); };
  App.acts.rview = function (el) { ui().v = el.getAttribute('data-v'); if (App.parseHash().path.length > 1) App.go('rentals'); else App.render(); };

  /* ───────── 교구 가능 여부 조회 (문의 전화 받을 때) ───────── */

  var LK = { item: '', s: '', e: '', open: false };

  function lookupHtml() {
    var today = App.today();
    if (!LK.s) { LK.s = today; LK.e = Core.addDays(today, 7); }
    var it = LK.item ? App.imap()[LK.item] : null;
    return '<details class="card lk" id="lk"' + (LK.open ? ' open' : '') + ' style="margin:0 12px"><summary>교구 가능 여부 조회 <span class="xs muted" style="font-weight:400;margin-left:6px">문의 전화가 왔을 때</span></summary><div class="col gap8 mt8">' +
      '<label class="f">교구<input id="lk-q" data-in="lkq" value="' + esc(it ? it.name : '') + '" placeholder="교구 이름이나 초성으로 검색" autocomplete="off"></label>' +
      '<div class="grid2"><label class="f">시작<input id="lk-s" type="date" data-in="lkd" value="' + esc(LK.s) + '"></label><label class="f">끝<input id="lk-e" type="date" data-in="lkd" value="' + esc(LK.e) + '"></label></div>' +
      '<div class="row gap6 wrap"><button type="button" class="pill" data-act="lkset" data-n="0">오늘 하루</button><button type="button" class="pill" data-act="lkset" data-n="7">+1주</button><button type="button" class="pill" data-act="lkset" data-n="14">+2주</button></div><div id="lk-res"></div></div></details>';
  }

  function drawLookup() {
    var res = document.getElementById('lk-res');
    if (!res) return;
    var it = LK.item ? App.imap()[LK.item] : null;
    if (!it) { res.innerHTML = ''; return; }
    if (!Core.validDate(LK.s) || !Core.validDate(LK.e) || LK.e < LK.s) { res.innerHTML = '<span class="small" style="color:var(--red)">날짜를 확인해 주세요.</span>'; return; }
    var idx = App.idx(), today = App.today();
    var av = Core.available(idx, it, LK.s, LK.e, '', today), bl = Core.blockers(S.data, idx, it.id, LK.s, LK.e, today);
    var kindCls = { '대여': 'blue', '센터': 'orange', '수리': 'red' };
    res.innerHTML = '<div class="lkres ' + (av > 0 ? 'ok' : 'no') + '"><span class="small">' + esc(it.name) + ' · ' + esc(Core.shortDate(LK.s)) + ' ~ ' + esc(Core.shortDate(LK.e)) + '</span>' +
      '<b class="big">' + (av > 0 ? '가능 ' + av + '개' : '대여 불가') + ' <span class="small muted" style="font-weight:400">/ 보유 ' + it.qty + '</span></b>' +
      (bl.length ? '<div class="col gap4 small">' + bl.map(function (b) {
        return '<div class="row gap6 wrap"><span class="chip ' + kindCls[b.kind] + '">' + b.kind + '</span><span>' + esc(b.title) + ' · ' + b.qty + '개' + (b.from ? ' · ' + esc(Core.shortDate(b.from) + ' ~ ' + Core.shortDate(b.to)) + (b.kind === '센터' ? ' (준비·점검 포함)' : '') : '') + '</span></div>';
      }).join('') + '</div>' : '<span class="small muted">이 기간에 막고 있는 일정이 없습니다.</span>') +
      (av > 0 && Core.isRentable(it) ? '<button class="btn primary sm" data-act="go" data-to="rental/new?item=' + esc(it.id) + '&start=' + LK.s + '&due=' + LK.e + '">이 기간으로 대여 등록</button>' : '') + '</div>';
  }

  App.ins.lkq = function (el) {
    var q = el.value.trim();
    if (!q) { App.hideSug(); LK.item = ''; drawLookup(); return; }
    var idx = App.idx(), today = App.today(), from = Core.validDate(LK.s) ? LK.s : today, to = Core.validDate(LK.e) ? LK.e : from;
    var hits = S.data.items.filter(function (it) { return Core.isRentable(it) && Core.matchKo(q, it.name + ' ' + it.id); }).slice(0, 8).map(function (it) {
      return { label: it.name, sub: it.id + ' · 가능 ' + Math.max(0, Core.available(idx, it, from, to, '', today)) + '개', value: it.id };
    });
    App.showSug(el, hits, function (it) { LK.item = it.value; el.value = it.label; drawLookup(); });
  };
  App.ins.lkd = function () { LK.s = document.getElementById('lk-s').value; LK.e = document.getElementById('lk-e').value; drawLookup(); };
  App.acts.lkset = function (el) {
    var n = +el.getAttribute('data-n'), s = document.getElementById('lk-s').value;
    if (!Core.validDate(s)) s = App.today();
    LK.s = s; LK.e = Core.addDays(s, n);
    document.getElementById('lk-e').value = LK.e; drawLookup();
  };
  function bindLookup() {
    var d = document.getElementById('lk');
    if (d) d.addEventListener('toggle', function () { LK.open = d.open; });
    drawLookup();
  }

  /* ───────── 화면 ───────── */

  App.views.rentals = function (rid, mode, route) {
    var wide = App.wide(), u = ui();
    calInit(route);
    var counts = { res: 0, out: 0 };
    S.data.rentals.forEach(function (r) { if (r.status === '예약됨') counts.res++; else if (r.status === '대여중') counts.out++; });
    var pane = rid ? panes(rid, mode) : null;
    if (rid && !wide) {
      return { html: '<div class="page">' + App.appbar(pane.title, 'rentals', pane.right || '') + '<div class="body">' + pane.html + '</div></div>' + (pane.bar ? '<div class="bar-bottom"><div class="in">' + pane.bar + '</div></div>' : ''), tab: 'rentals', after: pane.after };
    }
    var cal = u.v === 'cal', h;
    var after = function () { if (cal) bindLookup(); if (pane && pane.after) pane.after(); };
    if (wide) {
      h = '<div class="page wide"><div class="split">' + header(counts) + '<div class="left">' + (cal ? '<div class="col gap12">' + lookupHtml() + calHtml() + '</div>' : '<div class="body" style="padding:0">' + listHtml(rid) + '</div>') + '</div><div class="paneR">' +
        (pane ? '<div class="card" style="gap:14px"><div class="row between"><h2 style="font-size:19px">' + esc(pane.title) + '</h2>' + (pane.right || '') + '</div>' + pane.html + (pane.bar ? '<div class="row gap8">' + pane.bar + '</div>' : '') + '</div>' :
          cal ? '<div class="col gap8">' + dayListHtml() + '</div>' : '<div class="card empty">왼쪽에서 건을 고르면 여기에 나옵니다.</div>') + '</div></div></div>';
    } else {
      h = '<div class="page">' + header(counts) + '<div class="body" style="' + (cal ? 'padding:12px 0' : '') + '">' + (cal ? lookupHtml() + calHtml() + '<div class="col gap8" style="padding:0 16px">' + dayListHtml() + '</div>' : listHtml(rid)) + '</div></div><button class="fab" data-act="go" data-to="rental/new">+ 새 대여</button>';
    }
    return { html: h, tab: 'rentals', after: after };
  };

  App.acts.rtab = function (el) { ui().tab = el.getAttribute('data-v'); ui().n = 30; if (App.parseHash().path.length > 1) App.go('rentals'); else App.render(); };
  App.acts.morert = function () { ui().n += 30; App.render(); };

  /* ───────── 처리 화면(상세·내주기·반납) ───────── */

  function panes(rid, mode) {
    var r = App.rmap()[rid];
    if (!r) return { title: '대여', html: '<div class="empty">없는 대여 건입니다.</div>' };
    if (mode === 'handover') return r.status === '예약됨' ? handover(r) : notNow(r, '이미 내주었거나 취소된 건입니다.');
    if (mode === 'return') return r.status === '대여중' ? returnPane(r) : notNow(r, '대여 중인 건이 아닙니다.');
    return detail(r);
  }
  function notNow(r, msg) {
    return { title: r.school, html: '<div class="empty">' + esc(msg) + '<br><button class="btn mt12" data-act="go" data-to="rental/' + esc(r.id) + '">상세 보기</button></div>' };
  }

  function whoBlock(r) {
    return '<div class="col gap4"><b style="font-size:17px">' + App.who(r) + ' 선생님</b><div class="row gap8 wrap small">' + App.telLink(r.phone) + (r.phone ? '<a class="btn sm" href="tel:' + esc(r.phone.replace(/[^\d+]/g, '')) + '">전화하기</a>' : '') + '</div></div>';
  }

  /* 상세 */
  function detail(r) {
    var lines = App.linesOf(r.id), imap = App.imap(), di = Core.dueInfo(r, App.today());
    var h = '<div class="col gap12">' + whoBlock(r);
    h += '<div class="row gap6 wrap">' + App.rentalChip(r) + (di.overdue ? '<span class="chip red">연체 ' + di.overdue + '일</span>' : '') + '</div>';
    if (!r.docOk && (r.status === '예약됨' || r.status === '대여중')) {
      h += '<div class="card warn"><b style="color:var(--amber)">공문 접수 확인 전</b><div class="row gap8"><input id="doc-' + esc(r.id) + '" class="grow" aria-label="공문번호" placeholder="공문번호 (없으면 비워 두세요)" style="height:40px;border:1px solid #D0D6DE;border-radius:10px;padding:0 10px;min-width:0"><button class="btn sm" style="background:var(--amber);border-color:var(--amber);color:#fff" data-act="docok" data-type="교구" data-id="' + esc(r.id) + '">공문 왔어요</button></div></div>';
    }
    h += '<div class="card flush">' + [
      ['대여일', Core.mdDate(r.start)], ['반납 예정일', Core.mdDate(r.due)], r.returnedAt ? ['반납 완료일', Core.mdDate(r.returnedAt)] : null,
      ['공문', r.docOk ? (r.docNo || '확인함') : '아직 안 왔어요'], ['접수', r.staff + (r.createdAt ? ' · ' + r.createdAt.slice(0, 10) : '')], r.handedBy ? ['내준 직원', r.handedBy + ' · ' + r.handedAt] : null, r.memo ? ['메모', r.memo] : null
    ].filter(Boolean).map(function (x) { return '<div class="kv"><span>' + esc(x[0]) + '</span><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>';
    h += '<div class="card"><h2>교구</h2>' + lines.map(function (l) {
      var it = imap[l.item], bits = [];
      if (l.ok) bits.push('정상 반납 ' + l.ok); if (l.broken) bits.push('고장 ' + l.broken); if (l.lost) bits.push('분실 ' + l.lost);
      var left = Core.outstanding(l);
      return '<div class="row between small" style="padding:4px 0"><button class="textbtn" style="padding:0;text-align:left" data-act="go" data-to="item/' + esc(l.item) + '">' + esc(it ? it.name : l.item) + '</button><span>' + l.qty + '개' + (bits.length ? ' <span class="muted">(' + bits.join(', ') + ')</span>' : '') + (left && r.status === '대여중' ? ' <span class="chip blue">남은 ' + left + '</span>' : '') + '</span></div>' +
        (l.note ? '<div class="xs muted" style="padding-left:2px">' + esc(l.note) + '</div>' : '') + (l.photo ? '<div id="ph-' + esc(l.item) + '"><button class="btn sm" data-act="showfile" data-fid="' + esc(l.photo) + '" data-target="ph-' + esc(l.item) + '">반납 사진 보기</button></div>' : '');
    }).join('') + '</div>';
    if (r.sign) h += '<div class="card"><h2>받은 분 서명</h2><div id="signimg"><button class="btn sm" data-act="showfile" data-fid="' + esc(r.sign) + '" data-target="signimg">서명 보기</button></div></div>';
    h += '</div>';
    var bar = '';
    if (r.status === '예약됨') bar = '<button class="btn primary block lg" data-act="go" data-to="rental/' + esc(r.id) + '/handover">내주기</button>';
    if (r.status === '대여중') bar = '<button class="btn dark block lg" data-act="go" data-to="rental/' + esc(r.id) + '/return">반납 받기</button>';
    var right = r.status === '예약됨' ? '<button class="textbtn" data-act="go" data-to="rental/' + esc(r.id) + '/edit">수정</button>' : '';
    return { title: r.school, html: h, bar: bar, right: right };
  }

  /* 내주기 + 서명 */
  function handover(r) {
    var lines = App.linesOf(r.id), imap = App.imap(), today = App.today(), lg = wideLg();
    var due = r.due < today ? Core.addDays(today, S.settings.returnDays || 7) : r.due;
    var h = '<div class="col gap12">' + whoBlock(r) +
      '<div class="card" style="background:#F5F8FF;border-color:#B9CAF0;gap:4px"><span class="small muted">반납 예정일</span><div class="row between"><b id="hdue-lab" style="font-size:' + (lg ? 30 : 26) + 'px">' + esc(Core.mdDate(due)) + '</b><button class="textbtn" data-act="hduechg">바꾸기</button></div>' +
      '<div id="hdue-box" hidden>' + App.dateInput('hdue', '새 반납 예정일', due, App.quickDue(today), 'hdue') + '</div>' +
      (r.due < today ? '<span class="xs" style="color:var(--red)">예약한 반납 예정일(' + esc(Core.shortDate(r.due)) + ')이 지나서 새로 정했어요. 바꿀 수 있어요.</span>' : '') + '<input type="hidden" id="hdue-val" value="' + esc(due) + '"></div>' +
      '<div class="card"><h2>내줄 교구 <span class="small muted" style="font-weight:400">확인하고 체크하세요</span></h2>' + lines.map(function (l, i) {
        var it = imap[l.item];
        return '<div class="qline"><span class="chk" id="hc-' + i + '" role="img" aria-label="확인됨">' + App.icon('check', 18).replace('stroke="currentColor"', 'stroke="#fff"') + '</span><b class="grow" style="font-size:' + (lg ? 18 : 16) + 'px">' + esc(it ? it.name : l.item) + '</b>' +
          App.stepper('hq-' + i, l.qty, { min: 0, max: l.qty, large: lg, inName: 'hq', attrs: ' data-i="' + i + '"' }) + '</div>';
      }).join('') + '<span class="xs muted">실제로 가져가는 수량이 다르면 숫자를 바꾸세요. 0이면 이 교구는 빠집니다.</span></div>' +
      '<div class="card"><div class="row between"><h2>받는 분 서명</h2><button class="btn sm" data-act="sigclear">다시 쓰기</button></div>' + App.sigHtml(lg ? 240 : 190) + '<span class="xs muted">손가락(또는 마우스)으로 이 칸에 서명해 주세요.</span></div></div>';
    var bar = '<button class="btn block" data-act="rcancel" data-id="' + esc(r.id) + '" data-kind="미수령">취소</button><button class="btn primary block lg" data-act="dohand" data-id="' + esc(r.id) + '">내주기 완료</button>';
    return { title: '교구 내주기', html: h, bar: bar, after: function () { sig = App.sigPad(document.getElementById('sigbox')); } };
  }

  App.acts.hduechg = function () { var b = document.getElementById('hdue-box'); b.hidden = !b.hidden; };
  App.ins.hdue = function (el) { App.syncDate('hdue'); document.getElementById('hdue-val').value = el.value; var lab = document.getElementById('hdue-lab'); if (lab && Core.validDate(el.value)) lab.textContent = Core.mdDate(el.value); };
  App.ins.hq = function (el) {
    var i = el.getAttribute('data-i'), c = document.getElementById('hc-' + i);
    if (!c) return;
    var on = (parseInt(el.value, 10) || 0) > 0;
    c.className = 'chk' + (on ? '' : ' off');
    c.setAttribute('aria-label', on ? '확인됨' : '빠짐');
  };
  App.acts.sigclear = function () { if (sig) sig.clear(); };

  App.acts.dohand = function (el) {
    var id = el.getAttribute('data-id'), r = App.rmap()[id], lines = App.linesOf(id);
    var out = lines.map(function (l, i) { return { item: l.item, qty: parseInt(document.getElementById('hq-' + i).value, 10) || 0 }; });
    if (!out.some(function (l) { return l.qty > 0; })) { App.toast('내줄 교구가 하나도 없어요.', true); return; }
    if (!sig || sig.isEmpty()) { App.toast('서명을 받아 주세요.', true); return; }
    var due = document.getElementById('hdue-val').value;
    App.run(el, function () {
      return App.api('handover', { id: id, lines: out, due: due, sign: sig.dataUrl() }).then(function (res) {
        App.apply(res); App.toast(r.school + ' 선생님께 내주었습니다.');
        ui().tab = '대여중'; ui().v = 'list'; App.go('rentals');
      });
    });
  };

  /* 반납 받기 */
  function returnPane(r) {
    var lines = App.linesOf(r.id).filter(function (l) { return Core.outstanding(l) > 0; }), imap = App.imap(), lg = wideLg();
    photos = {};
    var h = '<div class="col gap12">' + whoBlock(r) +
      '<div class="small muted">반납 예정 <b style="color:var(--ink);font-size:' + (lg ? 20 : 15) + 'px">' + esc(Core.mdDate(r.due)) + '</b></div>' +
      lines.map(function (l, i) {
        var it = imap[l.item], left = Core.outstanding(l);
        return '<div class="card" id="rl-' + i + '" data-i="' + i + '" data-item="' + esc(l.item) + '" data-left="' + left + '" data-st="ok"><div class="row between gap8"><div class="col"><b style="font-size:' + (lg ? 19 : 16) + 'px">' + esc(it ? it.name : l.item) + '</b><span class="xs muted">빌려간 ' + l.qty + '개' + (left !== l.qty ? ' · 남은 ' + left + '개' : '') + '</span></div>' +
          '<div class="col" style="align-items:flex-end"><span class="xs muted">가져온 수량</span>' + App.stepper('rb-' + i, left, { min: 0, max: left, large: lg }) + '</div></div>' +
          '<div class="opt3" role="group" aria-label="상태"><button class="on good" data-act="rstat" data-i="' + i + '" data-v="ok">이상 없음</button><button data-act="rstat" data-i="' + i + '" data-v="lost">일부 분실</button><button data-act="rstat" data-i="' + i + '" data-v="broken">고장</button></div>' +
          '<div id="rx-' + i + '" hidden class="col gap8" style="background:var(--red-soft);border-radius:10px;padding:12px">' +
          '<div class="row between"><span id="rxl-' + i + '" class="b">문제 있는 수량</span>' + App.stepper('rp-' + i, 1, { min: 0, max: left, inName: 'rprob', attrs: ' data-i="' + i + '"' }) + '</div>' +
          '<label class="f">메모<input id="rn-' + i + '" placeholder="예: 원판 일부 분실"></label>' +
          '<div class="row gap8"><label class="btn sm" style="cursor:pointer">' + App.icon('camera', 18) + ' 사진 찍기<input type="file" accept="image/*" capture="environment" hidden data-ch="rphoto" data-i="' + i + '"></label><span id="rph-' + i + '" class="xs muted"></span></div>' +
          '<span id="rxn-' + i + '" class="xs" style="color:var(--red)"></span></div></div>';
      }).join('') +
      '<div class="tip blue">일부만 가져왔으면 숫자를 줄이세요. 나머지는 \'대여 중\'으로 남아요. 반납할 때는 서명을 받지 않습니다.</div></div>';
    var bar = '<button class="btn green block lg" data-act="doreturn" data-id="' + esc(r.id) + '">반납 완료</button>';
    return { title: '반납 받기', html: h, bar: bar };
  }

  App.acts.rstat = function (el) {
    var i = el.getAttribute('data-i'), v = el.getAttribute('data-v'), c = document.getElementById('rl-' + i);
    var left = +c.getAttribute('data-left');
    c.setAttribute('data-st', v);
    Array.prototype.forEach.call(c.querySelectorAll('.opt3 button'), function (b) {
      var on = b.getAttribute('data-v') === v;
      b.className = on ? 'on ' + (v === 'ok' ? 'good' : 'warnx') : '';
    });
    var box = document.getElementById('rx-' + i), prob = document.getElementById('rp-' + i), br = document.getElementById('rb-' + i);
    box.hidden = v === 'ok';
    document.getElementById('rxl-' + i).textContent = v === 'lost' ? '분실 수량' : '고장 수량';
    if (v === 'lost') { prob.max = left; prob.value = 1; br.value = Math.max(0, left - 1); } else if (v === 'broken') { prob.max = left; prob.value = 1; br.value = left; } else { br.value = left; }
    App.ins.rprob(prob);
  };
  App.ins.rprob = function (el) {
    var i = el.getAttribute('data-i'), c = document.getElementById('rl-' + i), st = c.getAttribute('data-st'), left = +c.getAttribute('data-left');
    var p = parseInt(el.value, 10) || 0, note = document.getElementById('rxn-' + i), br = document.getElementById('rb-' + i);
    if (st === 'lost') { br.value = Math.max(0, left - p); note.textContent = '분실 ' + p + '개는 보유수량에서 빠집니다.'; }
    else if (st === 'broken') { note.textContent = '고장 ' + p + '개는 수리 대기 목록으로 가고, 수리가 끝나기 전까지 빌려줄 수 없어요.'; }
  };
  App.chs.rphoto = function (el) {
    var i = el.getAttribute('data-i'), f = el.files && el.files[0], lab = document.getElementById('rph-' + i);
    if (!f) return;
    lab.textContent = '사진 줄이는 중…';
    App.readPhoto(f, 800).then(function (url) { photos[i] = url; lab.textContent = '사진 1장 첨부됨'; }).catch(function (e) { lab.textContent = ''; App.toast(e.message, true); });
  };

  App.acts.doreturn = function (el) {
    var id = el.getAttribute('data-id'), cards = document.querySelectorAll('[id^="rl-"][data-item]'), lines = [], bad = '';
    Array.prototype.forEach.call(cards, function (c) {
      var i = c.getAttribute('data-i'), st = c.getAttribute('data-st'), left = +c.getAttribute('data-left');
      var brought = parseInt(document.getElementById('rb-' + i).value, 10) || 0;
      var prob = st === 'ok' ? 0 : (parseInt(document.getElementById('rp-' + i).value, 10) || 0);
      var lost = st === 'lost' ? prob : 0, broken = st === 'broken' ? prob : 0;
      if (broken > brought) bad = '고장 수량이 가져온 수량보다 많아요.';
      if (brought + lost > left) bad = '남은 수량(' + left + '개)보다 많이 반납할 수 없어요.';
      if (brought + lost > 0) lines.push({ item: c.getAttribute('data-item'), brought: brought, broken: broken, lost: lost, note: st === 'ok' ? '' : document.getElementById('rn-' + i).value, photo: st === 'ok' ? '' : photos[i] || '' });
    });
    if (bad) { App.toast(bad, true); return; }
    if (!lines.length) { App.toast('반납할 수량을 입력해 주세요.', true); return; }
    App.run(el, function () {
      return App.api('returnItems', { id: id, lines: lines }).then(function (res) {
        App.apply(res);
        var done = App.rmap()[id].status === '반납완료';
        App.toast(done ? '반납이 완료되었습니다.' : '일부만 반납 처리했습니다. 나머지는 대여 중으로 남아요.');
        ui().tab = done ? '지난' : '대여중'; ui().v = 'list'; App.go('rentals');
      });
    });
  };

  App.acts.rcancel = function (el) {
    var id = el.getAttribute('data-id'), kind = el.getAttribute('data-kind') || '취소', r = App.rmap()[id];
    App.confirm('이 예약을 ' + kind + '할까요?', r.school + ' · ' + r.teacher + '\n기록은 남지만 대여 실적에서는 빠집니다.', kind + '하기', true).then(function (ok) {
      if (!ok) return;
      App.run(null, function () {
        return App.api('rentalCancel', { id: id, kind: kind }).then(function (res) { App.apply(res); App.toast(kind + ' 처리했습니다.'); App.go('rentals'); });
      });
    });
  };

  /* ───────── 예약 등록·수정 ───────── */

  App.views.rentalForm = function (rid, route) {
    var r = rid ? App.rmap()[rid] : null;
    if (rid && (!r || r.status !== '예약됨')) return { html: App.appbar('대여', 'rentals') + '<div class="empty">예약 상태인 건만 고칠 수 있습니다.</div>', tab: 'rentals' };
    var today = App.today(), days = S.settings.returnDays || 7;
    if (r) {
      F = { id: r.id, school: r.school, teacher: r.teacher, phone: r.phone, start: r.start, due: r.due, memo: r.memo, dueTouched: true, lines: App.linesOf(r.id).map(function (l) { return { item: l.item, qty: l.qty }; }) };
    } else {
      F = { id: '', school: '', teacher: '', phone: '', start: today, due: Core.addDays(today, days), memo: '', dueTouched: false, lines: [] };
      var qq = (route && route.q) || {};
      if (Core.validDate(qq.start)) { F.start = qq.start; F.due = Core.validDate(qq.due) && qq.due >= qq.start ? qq.due : Core.addDays(qq.start, days); F.dueTouched = !!qq.due; }
      var pre = route && route.q && route.q.item;
      if (pre && App.imap()[pre] && Core.isRentable(App.imap()[pre])) F.lines.push({ item: pre, qty: 1 });
    }
    var h = '<div class="page">' + App.appbar(r ? '대여 예약 수정' : '새 교구 대여', 'rentals') + '<form class="body" onsubmit="return false" autocomplete="off">' +
      '<section class="card"><div class="row between"><span class="small muted">접수 직원 ' + esc(S.user.name) + ' (자동)</span><span class="chip amber">공문 확인 알림이 생겨요</span></div>' +
      '<label class="f">학교명<input id="f-school" data-in="rschool" value="' + esc(F.school) + '" placeholder="글자나 초성(ㄱㄴ)으로 찾기" autocomplete="off"></label>' +
      '<div class="grid2"><label class="f">선생님 이름<input id="f-teacher" data-in="rtext" data-k="teacher" value="' + esc(F.teacher) + '"></label><label class="f">연락처<input id="f-phone" data-in="rtext" data-k="phone" inputmode="tel" value="' + esc(F.phone) + '" placeholder="010-0000-0000"></label></div></section>' +
      '<section class="card">' + App.dateInput('f-start', '대여일', F.start, App.quickStart(), 'rstart') + '<div style="height:1px;background:var(--line2)"></div><div id="duebox">' + App.dateInput('f-due', '반납 예정일', F.due, App.quickDue(F.start), 'rdue') + '</div></section>' +
      '<section class="card"><div class="row between"><h2>빌려줄 교구</h2><span class="xs muted" id="f-period"></span></div><div id="rlines"></div>' +
      '<label class="f" style="margin-top:4px"><span class="xs muted">교구 추가</span><input id="f-add" data-in="raddsearch" placeholder="+ 교구 이름이나 초성으로 검색해서 고르기" autocomplete="off"></label></section>' +
      '<label class="f" style="padding:0 4px">메모<input id="f-memo" data-in="rtext" data-k="memo" value="' + esc(F.memo) + '" placeholder="예: 11일 수업용, 배터리 여분 함께"></label>' +
      '<div class="tip" id="f-tip"></div></form></div>' +
      '<div class="bar-bottom"><div class="in" id="f-btns"></div></div>';
    return { html: h, tab: 'rentals', after: function () { drawLines(); drawBtns(); } };
  };

  function period() { return F.start + '~' + F.due; }
  function availOf(item) { return Core.available(App.idx(), App.imap()[item], F.start, F.due, F.id, App.today()); }

  function drawLines() {
    var box = document.getElementById('rlines'), imap = App.imap();
    if (!box) return;
    box.innerHTML = F.lines.length ? F.lines.map(function (l, i) {
      var it = imap[l.item];
      return '<div class="qline" data-item="' + esc(l.item) + '"><div class="grow col"><b style="font-size:15px">' + esc(it ? it.name : l.item) + '</b><span class="xs" id="ln-' + i + '"></span></div>' +
        App.stepper('lq-' + i, l.qty, { min: 1, inName: 'lqty', attrs: ' data-i="' + i + '"' }) + '<button type="button" class="iconbtn" data-act="lrm" data-i="' + i + '" aria-label="빼기">' + App.icon('close', 18) + '</button></div>';
    }).join('') : '<span class="muted small">아래에서 교구를 검색해서 골라 주세요.</span>';
    updateNotes();
  }

  function updateNotes() {
    var short = false;
    F.lines.forEach(function (l, i) {
      var n = document.getElementById('ln-' + i);
      if (!n) return;
      var av = Math.max(0, availOf(l.item)), bad = l.qty > av;
      if (bad) short = true;
      n.textContent = bad ? '이 기간에 ' + av + '개만 빌려줄 수 있어요' : '이 기간에 빌려줄 수 있음 ' + av + '개';
      n.style.color = bad ? 'var(--red)' : 'var(--muted)';
      n.style.fontWeight = bad ? '700' : '400';
    });
    var p = document.getElementById('f-period');
    if (p && Core.validDate(F.start) && Core.validDate(F.due)) p.textContent = Core.shortDate(F.start) + ' ~ ' + Core.shortDate(F.due) + ' 기준';
    var tip = document.getElementById('f-tip');
    if (tip) {
      var today = App.today();
      tip.innerHTML = F.id ? '저장하면 예약 내용이 바뀝니다.' : F.start === today ? '대여일이 오늘이면 [지금 대여]로 바로 서명 화면으로 넘어갑니다.' : '대여일이 오늘이 아니면 [대여 예약 저장]만 눌립니다. 그날 브리핑에서 내주기를 합니다.';
      if (short) tip.innerHTML += '<br><b style="color:var(--red)">수량이 모자라는 교구가 있어요.</b>';
    }
    drawBtns();
  }

  function drawBtns() {
    var b = document.getElementById('f-btns');
    if (!b) return;
    var today = App.today();
    if (F.id) b.innerHTML = '<button class="btn primary block lg" data-act="rsave" data-mode="reserve">저장</button>';
    else b.innerHTML = '<button class="btn block lg" data-act="rsave" data-mode="now"' + (F.start === today ? '' : ' disabled') + '>지금 대여' + (F.start === today ? '' : '<span class="xs" style="font-weight:400"> · 오늘만</span>') + '</button><button class="btn primary block lg" style="flex:1.4" data-act="rsave" data-mode="reserve">대여 예약 저장</button>';
  }

  App.ins.rtext = function (el) { F[el.getAttribute('data-k')] = el.value; };
  App.ins.rschool = function (el) {
    F.school = el.value;
    var q = el.value.trim();
    if (!q) { App.hideSug(); return; }
    App.showSug(el, App.schoolHits(q), function (it) { F.school = it.value; el.value = it.value; document.getElementById('f-teacher').focus(); });
  };
  App.ins.rstart = function (el) {
    App.syncDate('f-start');
    if (!Core.validDate(el.value)) return;
    F.start = el.value;
    if (!F.dueTouched) {
      F.due = Core.addDays(F.start, S.settings.returnDays || 7);
      document.getElementById('f-due').value = F.due;
    } else if (F.due < F.start) { F.due = F.start; document.getElementById('f-due').value = F.due; }
    document.getElementById('duebox').innerHTML = App.dateInput('f-due', '반납 예정일', F.due, App.quickDue(F.start), 'rdue');
    updateNotes();
  };
  App.ins.rdue = function (el) {
    App.syncDate('f-due');
    if (!Core.validDate(el.value)) return;
    F.due = el.value; F.dueTouched = true;
    updateNotes();
  };
  App.ins.lqty = function (el) { F.lines[+el.getAttribute('data-i')].qty = parseInt(el.value, 10) || 0; updateNotes(); };
  App.acts.lrm = function (el) { F.lines.splice(+el.getAttribute('data-i'), 1); drawLines(); };
  App.ins.raddsearch = function (el) {
    var q = el.value.trim();
    if (!q) { App.hideSug(); return; }
    var have = {}; F.lines.forEach(function (l) { have[l.item] = 1; });
    var hits = S.data.items.filter(function (it) { return Core.isRentable(it) && !have[it.id] && Core.matchKo(q, it.name + ' ' + it.id); }).slice(0, 8).map(function (it) {
      return { label: it.name, sub: it.id + ' · 이 기간 ' + Math.max(0, availOf(it.id)) + '개', value: it.id };
    });
    App.showSug(el, hits, function (it) { F.lines.push({ item: it.value, qty: 1 }); el.value = ''; drawLines(); });
  };

  App.acts.rsave = function (el) {
    var mode = el.getAttribute('data-mode');
    ['f-school', 'f-teacher', 'f-phone', 'f-memo'].forEach(function (id) { var e = document.getElementById(id); if (e) F[{ 'f-school': 'school', 'f-teacher': 'teacher', 'f-phone': 'phone', 'f-memo': 'memo' }[id]] = e.value; });
    if (!F.school.trim()) { App.toast('학교를 입력해 주세요.', true); return; }
    if (!F.teacher.trim()) { App.toast('선생님 이름을 입력해 주세요.', true); return; }
    if (!Core.validDate(F.start) || !Core.validDate(F.due)) { App.toast('날짜를 확인해 주세요.', true); return; }
    if (F.due < F.start) { App.toast('반납 예정일이 대여일보다 빠릅니다.', true); return; }
    var payload = { school: F.school, teacher: F.teacher, phone: F.phone, start: F.start, due: F.due, memo: F.memo, lines: F.lines.map(function (l) { return { item: l.item, qty: l.qty }; }) };
    var chk = Core.checkLines(S.data, App.idx(), payload.lines, F.start, F.due, F.id, App.today());
    if (chk.errors.length) { App.toast(chk.errors.join('\n'), true); return; }
    App.run(el, function () {
      return App.api(F.id ? 'rentalEdit' : 'rentalCreate', Object.assign({ id: F.id || undefined }, payload)).then(function (res) {
        App.apply(res);
        var nid = res.rentals[0].id;
        if (mode === 'now') { App.toast('예약을 저장했습니다. 서명을 받아 주세요.'); App.go('rental/' + nid + '/handover'); } else {
          App.toast(F.id ? '수정했습니다.' : '대여 예약을 저장했습니다. 공문이 오면 브리핑에서 확인해 주세요.'); ui().tab = '예약됨'; App.go('rentals', { m: Core.monthOf(F.start), d: F.start });
        }
      });
    });
  };
})();
