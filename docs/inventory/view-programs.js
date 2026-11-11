/* 센터 프로그램(주말창의·방학 프로그램 등)에서 쓸 교구를 미리 잡아 두는 화면 */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;
  var PF = null; // 입력 상태

  function buffer() { return S.settings.programBuffer === undefined ? Core.PROG_BUFFER : S.settings.programBuffer; }
  function defQty(item) { return Math.max(1, Math.min(S.settings.programQty || Core.PROG_QTY, item.qty)); }
  function win() { return Core.progWindow({ start: PF.start, end: PF.end }, buffer()); }

  App.views.progForm = function (id, route) {
    var g = id ? Core.groupPrograms(S.data.programs).filter(function (x) { return x.id === id; })[0] : null;
    if (id && !g) return { html: App.appbar('센터 프로그램', 'rentals') + '<div class="empty">없는 프로그램입니다.</div>', tab: 'rentals' };
    var today = App.today(), q = (route && route.q) || {};
    if (g) PF = { id: g.id, name: g.name, start: g.start, end: g.end, note: g.note, status: g.status, endTouched: true, lines: g.items.map(function (x) { return { item: x.item, qty: x.qty }; }) };
    else {
      var st = Core.validDate(q.start) ? q.start : today;
      PF = { id: '', name: '', start: st, end: st, note: '', status: '확정', endTouched: false, lines: [] };
    }
    var cancelled = g && g.status === '취소';
    var h = '<div class="page">' + App.appbar(g ? '센터 프로그램 수정' : '센터 프로그램 교구 잡기', 'rentals', g && !cancelled ? '<button class="textbtn" style="color:var(--red)" data-act="pcancel" data-id="' + esc(g.id) + '">프로그램 취소</button>' : '') +
      '<form class="body" onsubmit="return false" autocomplete="off">' +
      (cancelled ? '<div class="tip">취소된 프로그램입니다. 기록만 남아 있어요.</div>' : '<div class="tip blue">주말창의·방학 프로그램처럼 <b>센터에서 쓰는 교구를 미리 잡아 두는 곳</b>이에요. 서명이나 반납 확인은 필요 없고, 잡아 둔 기간에는 이 교구를 외부에 대여할 수 없습니다.</div>') +
      '<section class="card"><label class="f">프로그램 이름<input id="p-name" data-in="ptext" data-k="name" value="' + esc(PF.name) + '" placeholder="예: 하반기 주말창의"></label></section>' +
      '<section class="card">' + App.dateInput('p-start', '시작하는 날', PF.start, App.quickStart(), 'pstart') + '<div style="height:1px;background:var(--line2)"></div><div id="pendbox"></div>' +
      '<div class="tip" id="p-win"></div></section>' +
      '<section class="card"><div class="row between"><h2>잡아 둘 교구</h2><span class="xs muted">교구마다 기본 ' + (S.settings.programQty || Core.PROG_QTY) + '개 (정원 16명 + 여유 2)</span></div><div id="plines"></div>' +
      '<label class="f" style="margin-top:4px"><span class="xs muted">교구 추가</span><input id="p-add" data-in="paddsearch" placeholder="+ 교구 이름이나 초성으로 검색해서 고르기" autocomplete="off"></label></section>' +
      '<label class="f" style="padding:0 4px">메모<input id="p-note" data-in="ptext" data-k="note" value="' + esc(PF.note) + '" placeholder="예: 토요일 10회, 4층 교실"></label></form></div>' +
      (cancelled ? '' : '<div class="bar-bottom"><div class="in"><button class="btn primary block lg" data-act="psave">저장</button></div></div>');
    return { html: h, tab: 'rentals', after: function () { drawEnd(); drawLines(); } };
  };

  function drawEnd() {
    var box = document.getElementById('pendbox');
    if (!box) return;
    var quick = [['시작과 같은 날', PF.start], ['+5일', Core.addDays(PF.start, 5)], ['+4주', Core.addDays(PF.start, 28)], ['+9주 (주 1회 10회)', Core.addDays(PF.start, 63)]];
    box.innerHTML = App.dateInput('p-end', '끝나는 날', PF.end, quick, 'pend');
    drawWin();
  }

  function drawWin() {
    var el = document.getElementById('p-win');
    if (!el || !Core.validDate(PF.start) || !Core.validDate(PF.end)) return;
    var w = win();
    el.innerHTML = '<b>대여 불가 기간: ' + esc(Core.shortDate(w[0])) + ' ~ ' + esc(Core.shortDate(w[1])) + '</b><br>시작 ' + buffer() + '일 전부터 끝난 ' + buffer() + '일 뒤까지 (수업 준비와 끝난 뒤 점검 기간) 이 교구는 외부에 대여할 수 없어요.';
    updateNotes();
  }

  function availOf(item) {
    var w = win();
    return Core.available(App.idx(), App.imap()[item], w[0], w[1], '', App.today(), PF.id);
  }

  function drawLines() {
    var box = document.getElementById('plines'), imap = App.imap();
    if (!box) return;
    box.innerHTML = PF.lines.length ? PF.lines.map(function (l, i) {
      var it = imap[l.item];
      return '<div class="qline"><div class="grow col"><b style="font-size:15px">' + esc(it ? it.name : l.item) + '</b><span class="xs" id="pn-' + i + '"></span></div>' +
        App.stepper('pq-' + i, l.qty, { min: 1, inName: 'pqty', attrs: ' data-i="' + i + '"' }) + '<button type="button" class="iconbtn" data-act="prm" data-i="' + i + '" aria-label="빼기">' + App.icon('close', 18) + '</button></div>';
    }).join('') : '<span class="muted small">아래에서 교구를 검색해서 골라 주세요. 고르면 기본 수량이 자동으로 들어가요.</span>';
    updateNotes();
  }

  function updateNotes() {
    PF.lines.forEach(function (l, i) {
      var n = document.getElementById('pn-' + i), it = App.imap()[l.item];
      if (!n || !it) return;
      var av = Math.max(0, availOf(l.item)), bad = l.qty > av;
      n.textContent = bad ? '이 기간에 ' + av + '개만 잡을 수 있어요 (다른 일정과 겹침)' : '보유 ' + it.qty + '개 중 이 기간에 잡을 수 있음 ' + av + '개';
      n.style.color = bad ? 'var(--red)' : 'var(--muted)';
      n.style.fontWeight = bad ? '700' : '400';
    });
  }

  App.ins.ptext = function (el) { PF[el.getAttribute('data-k')] = el.value; };
  App.ins.pstart = function (el) {
    App.syncDate('p-start');
    if (!Core.validDate(el.value)) return;
    PF.start = el.value;
    if (!PF.endTouched || PF.end < PF.start) PF.end = PF.endTouched && PF.end >= PF.start ? PF.end : PF.start;
    drawEnd();
  };
  App.ins.pend = function (el) {
    App.syncDate('p-end');
    if (!Core.validDate(el.value)) return;
    PF.end = el.value; PF.endTouched = true;
    drawWin();
  };
  App.ins.pqty = function (el) { PF.lines[+el.getAttribute('data-i')].qty = parseInt(el.value, 10) || 0; updateNotes(); };
  App.acts.prm = function (el) { PF.lines.splice(+el.getAttribute('data-i'), 1); drawLines(); };
  App.ins.paddsearch = function (el) {
    var q = el.value.trim();
    if (!q) { App.hideSug(); return; }
    var have = {}; PF.lines.forEach(function (l) { have[l.item] = 1; });
    var hits = S.data.items.filter(function (it) { return Core.isRentable(it) && !have[it.id] && Core.matchKo(q, it.name + ' ' + it.id); }).slice(0, 8).map(function (it) {
      return { label: it.name, sub: it.id + ' · 이 기간 ' + Math.max(0, availOf(it.id)) + '개', value: it.id };
    });
    App.showSug(el, hits, function (it) {
      var item = App.imap()[it.value];
      // 기본 18개, 보유·수리·다른 일정으로 그만큼 못 잡으면 잡을 수 있는 수량까지만
      PF.lines.push({ item: it.value, qty: Math.max(1, Math.min(defQty(item), availOf(it.value))) });
      el.value = ''; drawLines();
    });
  };

  App.acts.psave = function (el) {
    ['p-name', 'p-note'].forEach(function (id) { var e = document.getElementById(id); if (e) PF[id === 'p-name' ? 'name' : 'note'] = e.value; });
    if (!PF.name.trim()) { App.toast('프로그램 이름을 입력해 주세요.', true); return; }
    if (!Core.validDate(PF.start) || !Core.validDate(PF.end)) { App.toast('날짜를 확인해 주세요.', true); return; }
    if (PF.end < PF.start) { App.toast('끝나는 날이 시작하는 날보다 빨라요.', true); return; }
    if (!PF.lines.length) { App.toast('잡아 둘 교구를 한 가지 이상 골라 주세요.', true); return; }
    var payload = { id: PF.id || undefined, name: PF.name, start: PF.start, end: PF.end, note: PF.note, lines: PF.lines.map(function (l) { return { item: l.item, qty: l.qty }; }) };
    var send = function (force) {
      return App.api('progSave', Object.assign({}, payload, force ? { force: true } : {})).then(function (res) {
        App.apply(res); App.toast(PF.id ? '수정했습니다.' : '센터 프로그램 교구를 잡아 두었습니다.');
        if (S.ui.rt) S.ui.rt.v = 'cal';
        App.go('rentals', { m: Core.monthOf(PF.start), d: PF.start });
      }, function (e) {
        if (e.code !== 'SHORT') throw e;
        return App.confirm('다른 일정과 겹쳐요', e.message + '\n\n그래도 저장할까요? (이미 잡힌 대여나 프로그램과 겹칠 수 있어요)', '그래도 저장', true).then(function (ok) { if (ok) return send(true); });
      });
    };
    App.run(el, function () { return send(false); });
  };

  App.acts.pcancel = function (el) {
    var id = el.getAttribute('data-id');
    App.confirm('이 프로그램을 취소할까요?', '잡아 둔 교구가 풀려서 다시 대여할 수 있어요.\n기록은 남습니다.', '취소하기', true).then(function (ok) {
      if (!ok) return;
      App.run(null, function () {
        return App.api('progCancel', { id: id }).then(function (res) { App.apply(res); App.toast('프로그램을 취소했습니다.'); App.go('rentals'); });
      });
    });
  };
})();
