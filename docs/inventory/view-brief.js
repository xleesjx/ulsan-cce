/* 첫 화면: 오늘의 브리핑 (공문 접수 확인 → 오늘 → 다음 대여) */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;

  var RK = { '외부 대여': 'blue', '내부 대여': 'orange', '센터 수업': 'green', '시설 관리': 'gray' };

  function chipFor(e) {
    if (e.kind === 'handout') return '<span class="chip blue">교구 내주기</span>';
    if (e.kind === 'return') return '<span class="chip green">교구 반납</span>';
    if (e.kind === 'overdue') return '<span class="chip red">연체</span>';
    return '<span class="chip ' + (RK[e.rkind] || 'gray') + '">' + esc(e.rkind || '교실') + '</span>';
  }

  function target(e, isToday) {
    if (e.type === '교실') return 'res/' + e.id;
    if (!isToday) return 'rental/' + e.id;
    if (e.kind === 'handout') return 'rental/' + e.id + '/handover';
    return 'rental/' + e.id + '/return';
  }

  function eventRow(e, isToday, today) {
    var when = isToday ? (e.kind === 'room' ? (e.time === '00:00' && /종일/.test(e.title) ? '종일' : esc(e.time)) : '') : (Core.diffDays(today, e.date) === 1 ? '<b>내일</b>' : esc(Core.shortDate(e.date)).replace(' ', '<br>'));
    var title = e.type === '교실' ? esc(e.title) : esc(e.title);
    return '<button class="ev" data-act="go" data-to="' + target(e, isToday) + '"><div class="when">' + when + '</div><div class="main"><div class="row gap6 wrap">' + chipFor(e) + '<span class="t">' + title + '</span></div><span class="s">' + esc(e.sub) + '</span></div></button>';
  }

  App.views.brief = function () {
    var today = App.today(), f = S.ui.bf || 'all', lim = S.ui.bn || 10;
    var b = Core.briefing(S.data, today, f, lim);
    var h = '<div class="page"><div class="top"><div class="row between"><div class="col"><span class="sub">' + esc(Core.longDate(today)) + '</span><h1>오늘의 브리핑</h1></div><span class="sub">' + esc(S.user.name) + ' 선생님</span></div>' +
      '<div class="seg" role="group" aria-label="보기">' + [['all', '전체'], ['교구', '교구'], ['교실', '교실']].map(function (x) {
        return '<button data-act="bf" data-v="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div></div><div class="body">';

    if (b.docs.length) {
      h += '<section class="card warn" aria-label="공문 접수 확인"><div class="row between"><b style="color:var(--amber)">공문 접수 확인</b><span class="chip amber">' + b.docs.length + '건</span></div>';
      b.docs.forEach(function (d, i) {
        var lab = d.days < 0 ? '날짜 지남' : (d.days === 0 ? '오늘' : (d.type === '교구' ? '대여 ' : '사용 ') + 'D-' + d.days);
        var hot = d.days <= 1;
        h += '<div class="col gap6" style="' + (i < b.docs.length - 1 ? 'padding-bottom:10px;border-bottom:1px solid var(--amber-line)' : '') + '">' +
          '<div class="row between gap8"><b style="font-size:14px">' + (d.type === '교실' ? '<span class="chip blue" style="margin-right:6px">교실</span>' : '') + esc(d.title) + '</b><span class="xs b" style="color:' + (hot ? 'var(--red)' : 'var(--amber)') + ';white-space:nowrap">' + lab + '</span></div>' +
          '<span class="small" style="color:var(--soft)">' + esc(d.sub) + '</span>' +
          '<div class="row gap8"><input class="grow" id="doc-' + esc(d.id) + '" aria-label="공문번호" placeholder="공문번호 (없으면 비워 두세요)" style="height:40px;border:1px solid #D0D6DE;border-radius:10px;padding:0 10px;font-size:14px;min-width:0">' +
          '<button class="btn dark sm" style="background:var(--amber);border-color:var(--amber)" data-act="docok" data-type="' + d.type + '" data-id="' + esc(d.id) + '">공문 왔어요</button></div></div>';
      });
      h += '</section>';
    }

    h += '<div class="sec"><h2>오늘</h2><span>' + esc(Core.shortDate(today)) + '</span></div>';
    var over = b.today.filter(function (e) { return e.kind === 'overdue'; });
    var rest = b.today.filter(function (e) { return e.kind !== 'overdue'; });
    over.forEach(function (e) {
      h += '<section class="card alert"><div class="row between"><b>' + esc(e.title) + '</b><span class="chip red">연체</span></div><span class="small" style="color:var(--soft)">' + esc(e.sub) + '</span><div class="row gap8">' +
        (e.phone ? '<a class="btn block" href="tel:' + esc(e.phone.replace(/[^\d+]/g, '')) + '">전화하기 ' + esc(e.phone) + '</a>' : '') +
        '<button class="btn dark block" data-act="go" data-to="rental/' + esc(e.id) + '/return">반납 처리</button></div></section>';
    });
    if (rest.length) h += '<section class="card flush">' + rest.map(function (e) { return eventRow(e, true, today); }).join('') + '</section>';
    else if (!over.length) h += '<div class="card"><span class="muted">오늘 할 일이 없습니다.</span></div>';

    h += '<div class="sec" style="margin-top:8px"><h2>다음 대여</h2><span>가까운 날부터 · 내일 건은 미리 준비하세요</span></div>';
    if (b.next.length) {
      h += '<section class="card flush">' + b.next.map(function (e) { return eventRow(e, false, today); }).join('') + '</section>';
      if (b.nextTotal > b.next.length) h += '<button class="btn" data-act="morenext">더 보기 (' + (b.nextTotal - b.next.length) + '건 더 있어요)</button>';
    } else h += '<div class="card"><span class="muted">예정된 대여가 없습니다.</span></div>';

    h += '</div></div>';
    return { html: h, tab: 'brief' };
  };

  App.acts.bf = function (el) { S.ui.bf = el.getAttribute('data-v'); S.ui.bn = 10; App.render(); };
  App.acts.morenext = function () { S.ui.bn = (S.ui.bn || 10) + 20; App.render(); };
  App.acts.docok = function (el) {
    var id = el.getAttribute('data-id'), type = el.getAttribute('data-type');
    var inp = document.getElementById('doc-' + id);
    App.run(el, function () {
      return App.api(type === '교실' ? 'resDoc' : 'rentalDoc', { id: id, docNo: inp ? inp.value : '' }).then(function (r) {
        App.apply(r); App.toast('공문 접수를 확인했습니다.'); App.render();
      });
    });
  };
})();
