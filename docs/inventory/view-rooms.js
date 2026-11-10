/* 교실 예약: 월간 달력 · 날짜별 목록 · 예약 추가/수정 */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;
  var R = null; // 예약 입력 상태

  function ui() { return S.ui.rm || (S.ui.rm = { m: '', d: '' }); }

  /* ───────── 달력 ───────── */

  App.views.rooms = function (route) {
    var u = ui(), today = App.today(), q = (route && route.q) || {};
    if (q.m) u.m = q.m;
    if (q.d) u.d = q.d;
    if (!u.m) u.m = Core.monthOf(today);
    if (!u.d || Core.monthOf(u.d) !== u.m) u.d = Core.monthOf(today) === u.m ? today : u.m + '-01';
    var rooms = S.data.rooms, res = S.data.reservations;
    var cells = Core.monthGrid(u.m);
    var ym = u.m.split('-');

    var h = '<div class="page wide"><div class="split">' +
      '<div class="top"><div class="row between"><h1>대여</h1></div><div class="seg" role="group" aria-label="종류"><button data-act="go" data-to="rentals" aria-pressed="false">교구</button><button class="on" aria-pressed="true">교실</button></div></div>' +
      '<div class="left"><div class="col gap8" style="padding:0 12px">' +
      '<div class="row between"><button class="iconbtn" data-act="rmonth" data-d="-1" aria-label="이전 달">' + App.icon('left') + '</button><b style="font-size:17px">' + ym[0] + '년 ' + (+ym[1]) + '월</b><button class="iconbtn" data-act="rmonth" data-d="1" aria-label="다음 달">' + App.icon('right') + '</button></div>' +
      '<div class="row wrap gap8 xs" style="color:var(--soft)">' + rooms.map(function (r) { return '<span><b>' + esc(r.short) + '</b> ' + esc(r.name) + '</span>'; }).join('') + '</div>' +
      '<div class="row wrap gap12 xs" style="color:var(--soft)">' + Core.KINDS.map(function (k) { return '<span class="row gap4"><i class="lg-dot ' + App.kindCls(k) + '"></i>' + k + '</span>'; }).join('') + '</div>' +
      '<div class="cal" role="grid" aria-label="교실 예약 달력">' + Core.DOW.map(function (d, i) { return '<div class="dow" style="' + (i === 0 ? 'color:#B3261E' : i === 6 ? 'color:var(--blue-ink)' : '') + '">' + d + '</div>'; }).join('') +
      cells.map(function (c) {
        var marks = Core.dayMarks(res, rooms, c.date), dd = +c.date.slice(8), w = Core.dow(c.date);
        var shown = marks.slice(0, 4), more = marks.length - shown.length;
        return '<button class="cell' + (c.inMonth ? '' : ' out') + (c.date === u.d ? ' sel' : '') + (c.date === today ? ' today' : '') + '" data-act="rday" data-d="' + c.date + '" aria-label="' + Core.mdDate(c.date) + (marks.length ? ', 예약 ' + marks.length + '건' : '') + '"><span class="d' + (w === 0 ? ' sun' : w === 6 ? ' sat' : '') + '">' + dd + '</span>' +
          '<div class="bs">' + shown.map(function (m) { return '<i class="mk ' + m.cls + (m.wide ? ' wide' : '') + '">' + esc(m.label) + '</i>'; }).join('') + (more > 0 ? '<i class="mk gray">+' + more + '</i>' : '') + '</div></button>';
      }).join('') + '</div></div></div>' +
      '<div class="paneR"><div class="body" id="rdaylist"></div></div></div></div>' +
      '<button class="fab" data-act="go" data-to="res/new?date=' + u.d + '">+ 교실 예약</button>';
    return { html: h, tab: 'rentals', after: drawDay };
  };

  function drawDay() {
    var box = document.getElementById('rdaylist');
    if (!box) return;
    var u = ui(), order = {};
    S.data.rooms.forEach(function (r, i) { order[r.name] = r.order || i + 1; });
    var list = S.data.reservations.filter(function (v) { return v.date === u.d && v.status !== '취소'; })
      .sort(function (a, b) { return (Core.toMin(a.start) === null ? -1 : Core.toMin(a.start)) - (Core.toMin(b.start) === null ? -1 : Core.toMin(b.start)) || (order[a.room] || 99) - (order[b.room] || 99); });
    var h = '<h2 style="font-size:16px;margin:4px 2px">' + esc(Core.longDate(u.d)) + '</h2>';
    if (!list.length) h += '<div class="card"><span class="muted">이 날은 예약이 없습니다.</span></div>';
    list.forEach(function (v) {
      var cls = App.kindCls(v.kind), docChip = '';
      if (v.kind === '외부 대여') docChip = v.docOk ? '<span class="chip green">공문 접수 완료</span>' : '<span class="chip amber">공문 확인 전</span>';
      var who = [v.person, v.org].filter(Boolean).join(' · '), tel = [v.mobile && '휴대 ' + v.mobile, v.office && '사무실 ' + v.office].filter(Boolean).join(' · ');
      h += '<button class="ev res" data-act="go" data-to="res/' + esc(v.id) + '"><div class="stripe ' + cls + '"></div><div class="main"><div class="row between gap8"><span class="t">' + esc(Core.timeLabel(v)) + '</span>' + docChip + '</div>' +
        '<span class="s" style="font-size:14px;color:var(--ink)">' + esc((v.room || '교실 지정 없음') + ' · ' + v.purpose) + '</span>' +
        (who ? '<span class="s">' + esc(who) + '</span>' : '') + (tel ? '<span class="s xs">' + esc(tel) + '</span>' : '') + '<span class="xs"><span class="chip ' + cls + '">' + esc(v.kind) + '</span></span></div></button>';
    });
    box.innerHTML = h;
  }

  App.acts.rday = function (el) {
    var u = ui(); u.d = el.getAttribute('data-d'); u.m = Core.monthOf(u.d);
    var fab = document.querySelector('.fab'); if (fab) fab.setAttribute('data-to', 'res/new?date=' + u.d);
    App.render();
  };
  App.acts.rmonth = function (el) { var u = ui(); u.m = Core.addMonths(u.m, +el.getAttribute('data-d')); u.d = ''; App.render(); };

  /* ───────── 예약 추가·수정 ───────── */

  var TIMES = [['종일', '', ''], ['오전', '09:00', '12:00'], ['오후', '13:00', '17:00'], ['저녁', '17:00', '21:00']];

  App.views.resForm = function (id, route) {
    var v = id ? S.data.reservations.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !v) return { html: App.appbar('교실 예약', 'rooms') + '<div class="empty">없는 예약입니다.</div>', tab: 'rentals' };
    var today = App.today(), q = (route && route.q) || {};
    if (v) R = { id: v.id, kind: v.kind, rooms: v.room ? [v.room] : [], date: v.date, start: v.start, end: v.end, purpose: v.purpose, person: v.person, org: v.org, mobile: v.mobile, office: v.office, docNo: v.docNo, note: v.note, docOk: v.docOk, status: v.status };
    else R = { id: '', kind: '외부 대여', rooms: [], date: Core.validDate(q.date) ? q.date : today, start: '', end: '', purpose: '', person: '', org: '', mobile: '', office: '', docNo: '', note: '', docOk: false, status: '확정' };
    var h = '<div class="page">' + App.appbar(v ? '교실 예약 수정' : '교실 예약 추가', 'rooms', v && v.status !== '취소' ? '<button class="textbtn" style="color:var(--red)" data-act="rescancel" data-id="' + esc(v.id) + '">예약 취소</button>' : '') + '<form class="body" onsubmit="return false" autocomplete="off">';
    if (v && v.status === '취소') h += '<div class="tip">취소된 예약입니다. 기록만 남아 있어요.</div>';
    if (v && v.kind === '외부 대여' && !v.docOk && v.status !== '취소') {
      h += '<div class="card warn"><b style="color:var(--amber)">공문 접수 확인 전</b><div class="row gap8"><input id="doc-' + esc(v.id) + '" class="grow" aria-label="공문번호" placeholder="공문번호 (없으면 비워 두세요)" style="height:40px;border:1px solid #D0D6DE;border-radius:10px;padding:0 10px;min-width:0"><button type="button" class="btn sm" style="background:var(--amber);border-color:var(--amber);color:#fff" data-act="docok" data-type="교실" data-id="' + esc(v.id) + '">공문 왔어요</button></div></div>';
    }
    h += '<section class="card"><div class="col gap6"><span class="small b" style="color:var(--soft)">종류</span><div class="opt4" id="rkinds"></div></div><div class="col gap6" id="rroomsbox"></div></section>' +
      '<section class="card">' + App.dateInput('r-date', '날짜', R.date, App.quickStart(), 'rdate') + '<div style="height:1px;background:var(--line2)"></div>' +
      '<div class="col gap6"><span class="small b" style="color:var(--soft)">시간 <span class="xs muted" id="rtimehint"></span></span><div class="pills">' + TIMES.map(function (t) { return '<button type="button" class="pill" data-act="rtime" data-s="' + t[1] + '" data-e="' + t[2] + '">' + t[0] + '</button>'; }).join('') + '</div>' +
      '<div class="grid2"><label class="f">시작<input id="r-start" type="time" value="' + esc(R.start) + '" data-in="rt"></label><label class="f">끝<input id="r-end" type="time" value="' + esc(R.end) + '" data-in="rt"></label></div></div></section>' +
      '<section class="card" id="rfields"></section></form></div>' +
      '<div class="bar-bottom"><div class="in"><button class="btn primary block lg" data-act="ressave">저장</button></div></div>';
    return { html: h, tab: 'rentals', after: function () { drawKinds(); drawRooms(); drawFields(); } };
  };

  function drawKinds() {
    document.getElementById('rkinds').innerHTML = Core.KINDS.map(function (k) { return '<button type="button" data-act="rkind" data-v="' + k + '" class="' + (R.kind === k ? 'on' : '') + '" aria-pressed="' + (R.kind === k) + '">' + k + '</button>'; }).join('');
    var hint = document.getElementById('rtimehint');
    if (hint) hint.textContent = R.kind === '센터 수업' || R.kind === '시설 관리' ? '(안 적어도 돼요)' : '(안 적으면 종일)';
  }

  function drawRooms() {
    var need = R.kind === '외부 대여' || R.kind === '내부 대여', rooms = S.data.rooms, edit = !!R.id;
    var first = rooms.filter(function (r) { return !r.priority; }), rest = rooms.filter(function (r) { return r.priority; });
    function chip(r) { return '<button type="button" class="pill' + (R.rooms.indexOf(r.name) >= 0 ? ' on' : '') + '" data-act="rroom" data-n="' + esc(r.name) + '" aria-pressed="' + (R.rooms.indexOf(r.name) >= 0) + '">' + esc(r.name) + '</button>'; }
    document.getElementById('rroomsbox').innerHTML = '<span class="small b" style="color:var(--soft)">빌리는 교실 <span class="xs muted">' + (edit ? '' : '(여러 곳 선택 가능)') + (need ? '' : ' · 교실 없이 일정만 적어도 돼요') + '</span></span>' +
      '<div class="pills" style="flex-wrap:wrap">' + first.map(chip).join('') + '</div>' + (rest.length ? '<div class="row wrap gap6"><span class="xs muted">수업 우선</span>' + rest.map(chip).join('') + '</div>' : '');
  }

  function collect() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : null; };
    ['purpose', 'person', 'org', 'mobile', 'office', 'docNo', 'note'].forEach(function (k) { var v = g('r-' + k); if (v !== null) R[k] = v; });
    var d = g('r-date'); if (d) R.date = d;
    var s = g('r-start'), e = g('r-end'); if (s !== null) R.start = s; if (e !== null) R.end = e;
  }

  function drawFields() {
    var k = R.kind, ext = k === '외부 대여', inn = k === '내부 대여';
    function f(id, label, val, extra) { return '<label class="f">' + label + '<input id="r-' + id + '" value="' + esc(val) + '" ' + (extra || '') + '></label>'; }
    var h = f('purpose', '사용 목적', R.purpose, 'placeholder="예: 교원 연수"');
    if (ext || inn) h += (ext ? '<div class="grid2">' + f('person', '담당자', R.person) + f('org', '소속', R.org, 'placeholder="예: 초등교육과"') + '</div>' : f('person', '담당자', R.person));
    if (ext) h += '<div class="grid2">' + f('mobile', '휴대전화', R.mobile, 'inputmode="tel" placeholder="010-0000-0000"') + f('office', '사무실 전화', R.office, 'inputmode="tel" placeholder="052-000-0000"') + '</div>' +
      (R.id ? '' : f('docNo', '공문번호 (공문이 오면 입력해도 돼요)', R.docNo)) +
      (R.id ? '' : '<div class="tip">공문번호가 없으면 저장 후 브리핑에 <b>공문 접수 확인</b> 알림이 생깁니다.</div>');
    h += f('note', '비고', R.note, 'placeholder="예: 의자 배치 변경, 마이크 필요"');
    h += '<div class="tip blue">' + (ext ? '외부 대여는 담당자·소속·연락처가 필요하고 공문 확인 알림이 생겨요.' : inn ? '내부 대여(센터 직원)는 날짜·시간·사용 목적·담당자만 적으면 돼요.' : '날짜와 사용 목적만 적으면 돼요. 시간은 적어도, 안 적어도 됩니다.') + ' 같은 시간에 이미 예약이 있으면 저장 전에 알려 드려요.</div>';
    document.getElementById('rfields').innerHTML = h;
  }

  App.acts.rkind = function (el) { collect(); R.kind = el.getAttribute('data-v'); drawKinds(); drawRooms(); drawFields(); };
  App.acts.rroom = function (el) {
    var n = el.getAttribute('data-n'), i = R.rooms.indexOf(n);
    if (R.id) R.rooms = i >= 0 ? [] : [n]; else if (i >= 0) R.rooms.splice(i, 1); else R.rooms.push(n);
    drawRooms();
  };
  App.ins.rdate = function () { App.syncDate('r-date'); };
  App.acts.rtime = function (el) { document.getElementById('r-start').value = el.getAttribute('data-s'); document.getElementById('r-end').value = el.getAttribute('data-e'); };
  App.ins.rt = function () { /* 입력 중에는 따로 할 일 없음 */ };

  function payload(force) {
    collect();
    var p = { kind: R.kind, date: R.date, start: R.start, end: R.end, purpose: R.purpose, person: R.person, org: R.org, mobile: R.mobile, office: R.office, docNo: R.docNo, note: R.note };
    if (R.id) { p.id = R.id; p.room = R.rooms[0] || ''; } else p.rooms = R.rooms;
    if (force) p.force = true;
    return p;
  }

  App.acts.ressave = function (el) {
    var send = function (force) {
      return App.api('resSave', payload(force)).then(function (res) {
        App.apply(res); App.toast(R.id ? '수정했습니다.' : '예약을 저장했습니다.');
        var d = res.reservations[0].date; App.go('rooms', { m: Core.monthOf(d), d: d });
      }, function (e) {
        if (e.code !== 'CONFLICT') throw e;
        var list = (e.extra.conflicts || []).map(function (c) { return '· ' + (c.room || '일정') + ' ' + Core.shortDate(c.date) + ' ' + Core.timeLabel(c) + ' ' + c.kind + ' (' + c.purpose + ')'; }).join('\n');
        return App.confirm('시간이 겹치는 예약이 있어요', list + '\n\n그래도 저장할까요?', '그래도 저장', true).then(function (ok) { if (ok) return send(true); });
      });
    };
    App.run(el, function () { return send(false); });
  };

  App.acts.rescancel = function (el) {
    var id = el.getAttribute('data-id');
    App.confirm('이 예약을 취소할까요?', '기록은 남지만 달력과 실적에서는 빠집니다.', '취소하기', true).then(function (ok) {
      if (!ok) return;
      App.run(null, function () {
        return App.api('resCancel', { id: id }).then(function (res) { App.apply(res); App.toast('예약을 취소했습니다.'); App.go('rooms', { m: Core.monthOf(res.reservations[0].date), d: res.reservations[0].date }); });
      });
    });
  };
})();
