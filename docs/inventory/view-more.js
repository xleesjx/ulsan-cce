/* 더보기: 메뉴 · 수리 대기 · 실적 · 점검 · 설정 */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;

  /* ───────── 더보기 메뉴 ───────── */

  App.views.more = function () {
    var waiting = S.data.repairs.filter(function (r) { return r.kind === '고장' && r.status === '대기'; }).length;
    function entry(icon, title, sub, act, to, badge) {
      return '<button class="item" data-act="' + act + '" data-to="' + to + '"><span style="color:var(--blue)">' + App.icon(icon, 24) + '</span><div class="grow col"><b>' + esc(title) + '</b><span class="xs muted">' + esc(sub) + '</span></div>' + (badge ? '<span class="chip red">' + badge + '</span>' : '') + '<span class="muted">' + App.icon('right', 18) + '</span></button>';
    }
    var h = '<div class="page"><div class="top"><h1>더보기</h1><span class="sub">' + esc(S.user.name) + ' 선생님 · ' + esc(S.user.email) + '</span></div><div class="body"><div class="list">' +
      entry('tool', '수리 대기·분실', '고장 난 교구를 처리하고 기록을 봐요', 'go', 'more/repairs', waiting ? waiting + '건' : '') +
      entry('check', '점검', '학기말 등에 물품·교실을 하나씩 확인해요', 'go', 'more/inspect', '') +
      entry('chart', '대여 실적', '교구·교실 이용 현황과 엑셀 내려받기', 'go', 'more/stats', '') +
      entry('gear', '설정·안내', '직원, 교실, 보관위치 확인', 'go', 'more/settings', '') + '</div>' +
      '<div class="row gap8"><button class="btn block" data-act="syncnow">' + App.icon('swap', 18) + ' 최신으로 새로고침</button><button class="btn block" data-act="logout">' + App.icon('out', 18) + ' 로그아웃</button></div></div></div>';
    return { html: h, tab: 'more' };
  };
  App.acts.syncnow = function (el) { App.run(el, function () { return App.reload(false).then(function () { App.toast('최신 내용으로 바꿨습니다.'); }); }); };
  App.acts.logout = function () { App.logout(); };

  /* ───────── 수리 대기 ───────── */

  App.views.repairs = function () {
    var u = S.ui.rp || (S.ui.rp = { tab: '대기' }), imap = App.imap(), rm = App.rmap();
    var list = S.data.repairs.filter(function (r) { return u.tab === '대기' ? (r.kind === '고장' && r.status === '대기') : !(r.kind === '고장' && r.status === '대기'); })
      .sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });
    var h = '<div class="page">' + App.appbar('수리 대기·분실', 'more') + '<div class="body"><div class="tabs" style="margin:0 -16px">' +
      [['대기', '수리 대기 ' + S.data.repairs.filter(function (r) { return r.kind === '고장' && r.status === '대기'; }).length], ['지난', '지난 기록']].map(function (t) {
        return '<button class="' + (u.tab === t[0] ? 'on' : '') + '" data-act="reptab" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>';
    if (!list.length) h += '<div class="card"><span class="muted">' + (u.tab === '대기' ? '수리 대기 중인 교구가 없습니다.' : '지난 기록이 없습니다.') + '</span></div>';
    list.slice(0, 80).forEach(function (r) {
      var it = imap[r.item], rt = rm[r.rid];
      h += '<div class="card"><div class="row between gap8"><button class="textbtn" style="padding:0;text-align:left;font-size:16px;color:var(--ink)" data-act="go" data-to="item/' + esc(r.item) + '">' + esc(it ? it.name : r.item) + ' ' + r.qty + '개</button><span class="chip ' + (r.status === '대기' ? 'red' : 'gray') + '">' + esc(r.kind === '분실' ? '분실' : r.status === '대기' ? '수리 대기' : r.status) + '</span></div>' +
        '<span class="small muted">' + esc(r.date) + (rt ? ' · ' + esc(rt.school + ' ' + rt.teacher) + ' 선생님' : '') + (r.note ? ' · ' + esc(r.note) : '') + (r.doneAt && r.kind === '고장' ? ' · 처리 ' + esc(r.doneAt) : '') + '</span>' +
        (r.photo ? '<div id="rph-' + esc(r.id) + '"><button class="btn sm" data-act="showfile" data-fid="' + esc(r.photo) + '" data-target="rph-' + esc(r.id) + '">사진 보기</button></div>' : '') +
        (r.kind === '고장' && r.status === '대기' ? '<div class="row gap8"><button class="btn green block" data-act="repdone" data-id="' + esc(r.id) + '" data-r="완료">수리 완료</button><button class="btn danger block" data-act="repdone" data-id="' + esc(r.id) + '" data-r="폐기">폐기</button></div>' : '') + '</div>';
    });
    return { html: h + '</div></div>', tab: 'more' };
  };
  App.acts.reptab = function (el) { S.ui.rp.tab = el.getAttribute('data-v'); App.render(); };
  App.acts.repdone = function (el) {
    var id = el.getAttribute('data-id'), result = el.getAttribute('data-r');
    var go = function () {
      return App.run(el, function () {
        return App.api('repairDone', { id: id, result: result }).then(function (res) { App.apply(res); App.toast(result === '완료' ? '다시 빌려줄 수 있어요.' : '폐기 처리했습니다. 보유수량에서 뺐어요.'); App.render(); });
      });
    };
    if (result === '폐기') App.confirm('폐기할까요?', '보유수량에서 빠지고 되돌릴 수 없어요.', '폐기하기', true).then(function (ok) { if (ok) go(); }); else go();
  };

  /* ───────── 실적 ───────── */

  function stRange() {
    var u = S.ui.st;
    if (!u) { var y = App.today().slice(0, 4); u = S.ui.st = { from: y + '-01-01', to: y + '-12-31' }; }
    return u;
  }

  App.views.stats = function () {
    var u = stRange(), s = Core.stats(S.data, u.from, u.to), y = +App.today().slice(0, 4), m = Core.monthOf(App.today());
    function preset(label, from, to) { return '<button class="pill' + (u.from === from && u.to === to ? ' on' : '') + '" data-act="stpre" data-f="' + from + '" data-t="' + to + '">' + label + '</button>'; }
    var prev = Core.addMonths(m, -1);
    function lastDay(ym) { return Core.addDays(Core.addMonths(ym, 1) + '-01', -1); }
    var h = '<div class="page">' + App.appbar('대여 실적', 'more') + '<div class="body">' +
      '<div class="pills">' + preset('올해', y + '-01-01', y + '-12-31') + preset('1학기', y + '-03-01', y + '-08-31') + preset('2학기', y + '-09-01', (y + 1) + '-02-28') + preset('이번 달', m + '-01', lastDay(m)) + preset('지난달', prev + '-01', lastDay(prev)) + '</div>' +
      '<div class="grid2"><label class="f">시작<input type="date" id="st-f" value="' + u.from + '" data-in="stdate"></label><label class="f">끝<input type="date" id="st-t" value="' + u.to + '" data-in="stdate"></label></div>' +
      '<div class="qgrid" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="card"><span class="muted">교구 대여</span><b>' + s.rentals + '건</b></div><div class="card"><span class="muted">나간 수량</span><b>' + s.qty + '개</b></div><div class="card"><span class="muted">교실 예약</span><b>' + s.reservations + '건</b></div></div>' +
      '<section class="card"><h2>교구별 대여 (많은 순)</h2>' + table(['교구', '횟수', '수량'], s.items.slice(0, 15).map(function (x) { return [x.name, x.count, x.qty]; })) + '</section>' +
      '<section class="card"><h2>학교별 대여</h2>' + table(['학교', '건수'], s.schools.slice(0, 12).map(function (x) { return [x.name, x.count]; })) + '</section>' +
      '<section class="card"><h2>교실별 사용</h2>' + table(['교실', '건수', '시간'], s.rooms.map(function (x) { return [x.name, x.count, (x.minutes ? (Math.round(x.minutes / 6) / 10) + '시간' : '-')]; })) + '</section>' +
      '<section class="card"><h2>종류별 교실 예약</h2>' + table(['종류', '건수', '시간'], s.kinds.map(function (x) { return [x.name, x.count, (x.minutes ? (Math.round(x.minutes / 6) / 10) + '시간' : '-')]; })) + '<span class="xs muted">시간은 시작·끝 시간을 적은 예약만 더했어요. 종일은 시간에 넣지 않았습니다.</span></section>' +
      '<section class="card"><h2>엑셀로 내려받기</h2><div class="col gap8"><button class="btn" data-act="stcsv" data-k="rent">' + App.icon('down', 16) + ' 교구 대여 기록</button><button class="btn" data-act="stcsv" data-k="room">' + App.icon('down', 16) + ' 교실 예약 기록</button><button class="btn" data-act="stcsv" data-k="item">' + App.icon('down', 16) + ' 물품 목록표 (전체)</button></div><span class="xs muted">위에서 고른 기간의 기록이 내려받아져요. 엑셀에서 바로 열립니다.</span></section></div></div>';
    return { html: h, tab: 'more' };
  };
  function table(head, rows) {
    if (!rows.length) return '<span class="muted small">기록이 없습니다.</span>';
    return '<table class="tb"><thead><tr>' + head.map(function (t, i) { return '<th class="' + (i ? 'n' : '') + '">' + t + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td class="' + (i ? 'n' : '') + '">' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  App.acts.stpre = function (el) { var u = stRange(); u.from = el.getAttribute('data-f'); u.to = el.getAttribute('data-t'); App.render(); };
  App.ins.stdate = function () {
    var f = document.getElementById('st-f').value, t = document.getElementById('st-t').value;
    if (Core.validDate(f) && Core.validDate(t) && f <= t) { var u = stRange(); u.from = f; u.to = t; App.render(); }
  };
  App.acts.stcsv = function (el) {
    var u = stRange(), k = el.getAttribute('data-k'), imap = App.imap(), rows;
    if (k === 'rent') {
      rows = [['대여번호', '학교', '선생님', '연락처', '대여일', '반납예정일', '반납완료일', '상태', '공문', '교구', '수량', '정상반납', '고장', '분실']];
      var rm = App.rmap();
      S.data.lines.forEach(function (l) {
        var r = rm[l.rid];
        if (!r || r.start < u.from || r.start > u.to) return;
        rows.push([r.id, r.school, r.teacher, r.phone, r.start, r.due, r.returnedAt, r.status, r.docOk ? (r.docNo || '확인') : '미확인', (imap[l.item] || {}).name || l.item, l.qty, l.ok, l.broken, l.lost]);
      });
      App.download('교구대여기록_' + u.from + '_' + u.to + '.csv', rows);
    } else if (k === 'room') {
      rows = [['예약번호', '날짜', '시간', '교실', '종류', '사용목적', '담당자', '소속', '휴대전화', '사무실전화', '공문', '비고', '상태']];
      S.data.reservations.filter(function (v) { return v.date >= u.from && v.date <= u.to; }).sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (v) {
        rows.push([v.id, v.date, Core.timeLabel(v), v.room, v.kind, v.purpose, v.person, v.org, v.mobile, v.office, v.kind === '외부 대여' ? (v.docOk ? (v.docNo || '확인') : '미확인') : '', v.note, v.status]);
      });
      App.download('교실예약기록_' + u.from + '_' + u.to + '.csv', rows);
    } else {
      rows = [['관리번호', '분류', '품명', '대상학년', '영역', '구입연도', '보유수량', '보관위치', '세부위치', '상태', '외부공개', '호응', '설명', '비고']];
      S.data.items.slice().sort(function (a, b) { return Core.CATS.indexOf(a.cat) - Core.CATS.indexOf(b.cat) || a.id.localeCompare(b.id); }).forEach(function (i) { rows.push([i.id, i.cat, i.name, i.grade, i.area, i.year, i.qty, i.loc, i.subloc, i.status, i.pub ? '공개' : '', i.like, i.desc, i.note]); });
      App.download('물품목록표_' + App.today() + '.csv', rows);
    }
  };

  /* ───────── 점검 ───────── */

  var IR = { round: '', rows: [], filter: 'all' };

  App.views.inspect = function (round) {
    if (!round) {
      return { html: '<div class="page">' + App.appbar('점검', 'more') + '<div class="body"><div id="irounds"><div class="loader"><div class="spin"></div>불러오는 중…</div></div>' +
        '<button class="btn primary lg" data-act="istart">+ 새 점검 회차 시작</button><div class="tip blue">회차를 시작하면 사용 중인 모든 물품과 교실이 점검 목록으로 만들어져요. 휴대폰으로 하나씩 [정상] 또는 [이상]을 누르세요.</div></div></div>', tab: 'more',
        after: function () {
          App.api('inspect', {}).then(function (r) {
            var box = document.getElementById('irounds');
            if (!box) return;
            box.innerHTML = r.rounds.length ? '<div class="list">' + r.rounds.map(function (x) {
              return '<button class="item" data-act="go" data-to="more/inspect/' + encodeURIComponent(x.round) + '"><div class="grow col"><b>' + esc(x.round) + '</b><span class="xs muted">' + esc(x.rdate) + ' · 확인 ' + x.done + ' / ' + x.total + '</span></div>' + (x.issues ? '<span class="chip red">이상 ' + x.issues + '</span>' : '') + '<span class="muted">' + App.icon('right', 18) + '</span></button>';
            }).join('') + '</div>' : '<div class="card"><span class="muted">아직 점검 기록이 없습니다.</span></div>';
          }).catch(function (e) { App.toast(e.message, true); });
        } };
    }
    IR = { round: round, rows: [], filter: 'all' };
    return { html: '<div class="page">' + App.appbar(round, 'more/inspect') + '<div class="body"><div id="ihead"></div><div id="irows"><div class="loader"><div class="spin"></div>불러오는 중…</div></div></div></div>', tab: 'more',
      after: function () {
        App.api('inspect', { round: round }).then(function (r) { IR.rows = r.rows || []; drawInspect(); }).catch(function (e) { App.toast(e.message, true); });
      } };
  };

  App.acts.istart = function () {
    var y = App.today().slice(0, 4);
    App.prompt('새 점검 회차', '회차 이름 (예: ' + y + ' 2학기말)', '', '시작').then(function (name) {
      if (!name) return;
      App.run(null, function () { return App.api('inspectStart', { name: name }).then(function (r) { App.apply(r); App.go('more/inspect/' + encodeURIComponent(r.round)); }); });
    });
  };

  function drawInspect() {
    var imap = App.imap(), rows = IR.rows, f = IR.filter;
    var done = rows.filter(function (r) { return r.result; }).length, issues = rows.filter(function (r) { return r.result === '이상'; }).length;
    var head = document.getElementById('ihead'), box = document.getElementById('irows');
    if (!head || !box) return;
    head.innerHTML = '<div class="card"><div class="row between"><b>확인 ' + done + ' / ' + rows.length + '</b>' + (issues ? '<span class="chip red">이상 ' + issues + '</span>' : '') + '</div><div class="qbar"><i style="flex:' + done + ';background:var(--green)"></i><i style="flex:' + (rows.length - done) + ';background:transparent"></i></div>' +
      '<div class="pills">' + [['all', '전체'], ['todo', '아직 안 함'], ['bad', '이상']].map(function (x) { return '<button class="pill' + (f === x[0] ? ' on dark' : '') + '" data-act="ifilt" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<button class="btn sm" data-act="icsv">' + App.icon('down', 16) + ' 이 회차 결과 내려받기</button></div>';
    var shown = rows.filter(function (r) { return f === 'all' || (f === 'todo' && !r.result) || (f === 'bad' && r.result === '이상'); });
    box.innerHTML = shown.length ? '<div class="list">' + shown.slice(0, 150).map(function (r) {
      var it = imap[r.target], name = r.kind === '물품' ? (it ? it.name : r.target) : r.target;
      var sub = r.kind === '물품' ? r.target + (it && it.loc ? ' · ' + it.loc : '') + ' · 보유 ' + (it ? it.qty : '-') : '교실';
      return '<div class="item" style="flex-wrap:wrap;align-items:flex-start" data-t="' + esc(r.target) + '"><div class="grow col"><b>' + esc(name) + '</b><span class="xs muted">' + esc(sub) + '</span></div>' +
        '<div class="row gap6"><button class="btn sm' + (r.result === '정상' ? ' green' : '') + '" data-act="imark" data-t="' + esc(r.target) + '" data-v="정상">정상</button><button class="btn sm' + (r.result === '이상' ? ' danger' : '') + '" style="' + (r.result === '이상' ? 'background:var(--red-soft)' : '') + '" data-act="imark" data-t="' + esc(r.target) + '" data-v="이상">이상</button></div>' +
        '<div class="row gap6" style="width:100%"><input aria-label="확인한 수량" inputmode="numeric" placeholder="수량" id="ic-' + esc(r.target) + '" value="' + esc(r.count) + '" style="width:80px;height:38px;border:1px solid #D0D6DE;border-radius:8px;padding:0 8px;display:' + (r.kind === '물품' ? 'block' : 'none') + '"><input aria-label="메모" placeholder="메모 (이상일 때)" id="in-' + esc(r.target) + '" value="' + esc(r.note) + '" style="flex:1;min-width:0;height:38px;border:1px solid #D0D6DE;border-radius:8px;padding:0 8px"></div></div>';
    }).join('') + '</div>' : '<div class="empty">해당하는 항목이 없습니다.</div>';
  }
  App.acts.ifilt = function (el) { IR.filter = el.getAttribute('data-v'); drawInspect(); };
  App.acts.imark = function (el) {
    var t = el.getAttribute('data-t'), v = el.getAttribute('data-v');
    var row = IR.rows.filter(function (r) { return r.target === t; })[0];
    var cnt = document.getElementById('ic-' + t), note = document.getElementById('in-' + t);
    var send = row.result === v ? '' : v; // 같은 버튼을 다시 누르면 취소
    App.run(el, function () {
      return App.api('inspectMark', { round: IR.round, target: t, result: send, count: cnt ? cnt.value : '', note: note ? note.value : '' }).then(function (r) {
        IR.rows = IR.rows.map(function (x) { return x.target === t ? r.row : x; });
        drawInspect();
      });
    });
  };
  App.acts.icsv = function () {
    var imap = App.imap(), rows = [['구분', '대상', '품명', '결과', '확인수량', '보유수량', '메모', '점검자', '시각']];
    IR.rows.forEach(function (r) { var it = imap[r.target]; rows.push([r.kind, r.target, r.kind === '물품' ? (it ? it.name : '') : r.target, r.result, r.count, it ? it.qty : '', r.note, r.by, r.at]); });
    App.download('점검_' + IR.round + '.csv', rows);
  };

  /* ───────── 설정·안내 ───────── */

  App.views.settings = function () {
    var st = S.settings;
    var h = '<div class="page">' + App.appbar('설정·안내', 'more') + '<div class="body">' +
      '<section class="card flush"><div class="kv"><span>반납 기본 일수</span><span>' + st.returnDays + '일</span></div><div class="kv"><span>연락처 보관 기간</span><span>' + st.maskDays + '일 (반납 완료 후)</span></div><div class="kv"><span>센터 이름</span><span>' + esc(st.centerName) + '</span></div></section>' +
      '<section class="card"><h2>직원 (' + S.staff.length + '명)</h2>' + S.staff.map(function (s) { return '<div class="row between small"><span><b>' + esc(s.name) + '</b> <span class="muted">' + esc(s.email) + '</span></span><span class="chip gray">' + esc(s.role || '직원') + '</span></div>'; }).join('') + '</section>' +
      '<section class="card"><h2>교실</h2>' + S.data.rooms.map(function (r) { return '<div class="row between small"><span>' + esc(r.short) + ' · ' + esc(r.name) + '</span><span class="muted">' + (r.priority ? '수업 우선 교실' : '') + '</span></div>'; }).join('') + '</section>' +
      '<section class="card"><h2>보관위치 목록</h2><div class="row wrap gap6">' + (st.locs || []).map(function (l) { return '<span class="chip gray">' + esc(l) + '</span>'; }).join('') + '</div></section>' +
      '<section class="card"><h2>바꾸고 싶을 때</h2><p class="small" style="margin:0;color:var(--soft);line-height:1.7">직원 추가·삭제, 교실 추가, 보관위치 목록, 반납 기본 일수, 연락처 보관 기간은 구글 시트의 <b>직원</b>, <b>교실</b>, <b>설정</b> 탭에서 직접 고치면 됩니다. 고친 뒤 이 앱에서 [최신으로 새로고침]을 누르세요.</p>' +
      (S.sheetUrl ? '<a class="btn" href="' + esc(S.sheetUrl) + '" target="_blank" rel="noopener">구글 시트 열기</a>' : '') + '</section></div></div>';
    return { html: h, tab: 'more' };
  };
})();
