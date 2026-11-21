/* 더보기: 메뉴 · 수리 대기 · 실적 · 점검 · 설정 · 관리자 메뉴(구글 로그인) */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;

  /* ───────── 더보기 메뉴 ───────── */

  /** 구글 시트·Apps Script 바로가기와 코드 업데이트 방법 (관리자 메뉴 안) */
  function adminHtml() {
    var r = App.repo(), raw = 'https://raw.githubusercontent.com/' + r.owner + '/' + r.name + '/main/apps/inventory/gas/';
    function link(href, text) { return '<a class="btn" href="' + esc(href) + '" target="_blank" rel="noopener">' + text + '</a>'; }
    return '<section class="card"><h2>바로가기 · 직접 업데이트</h2>' +
      (App.outdated() ? '' : '<span class="small" style="color:var(--green-ink);font-weight:700">서버 코드가 최신입니다 (Code ' + S.codeVersion + ' · Core ' + S.coreVersion + ')</span>') +
      (S.scriptUrl ? '' : '<span class="xs muted">서버 코드를 한 번 업데이트하면 [Apps Script 열기] 버튼이 나타나요. 이번 한 번은 구글 시트의 <b>확장 프로그램 → Apps Script</b>로 들어가 주세요.</span>') +
      '<div class="col gap8">' + (S.sheetUrl ? link(S.sheetUrl, '구글 시트 열기') : '') + (S.scriptUrl ? link(S.scriptUrl, 'Apps Script 열기 (코드 붙여넣는 곳)') : '') +
      link(raw + 'Code.gs', '새 Code.gs 열기 (전체 복사용)') + link(raw + 'Core.gs', '새 Core.gs 열기 (전체 복사용)') + link('https://github.com/' + r.owner + '/' + r.name, 'GitHub 저장소 열기') + '</div>' +
      '<details><summary class="small b" style="cursor:pointer;min-height:36px;display:flex;align-items:center">직접 붙여넣어 업데이트하는 방법 (자동 업데이트가 안 될 때)</summary><ol class="small" style="margin:6px 0 0;padding-left:20px;line-height:1.8;color:var(--soft)">' +
      '<li><b>새 Code.gs 열기</b>를 누르고, 새 탭에서 <b>Ctrl+A → Ctrl+C</b>로 전체를 복사합니다.</li>' +
      '<li><b>Apps Script 열기</b>에서 왼쪽 <b>Code.gs</b>를 누르고 <b>Ctrl+A → Ctrl+V</b>로 바꿉니다.</li>' +
      '<li><b>Core</b> 파일도 같은 방법으로 바꾸고 💾 저장합니다.</li>' +
      '<li>오른쪽 위 <b>배포 → 배포 관리 → ✏️ → 버전: 새 버전 → 배포</b></li>' +
      '<li>이 앱에서 <b>Ctrl+Shift+R</b> 새로고침</li></ol></details></section>';
  }

  /* 서버 코드 자동 업데이트: GitHub 최신 코드로 Apps Script를 바꾸고 배포까지 (관리자만) */
  var UPD = { state: 'idle', r: null, err: null, code: '' };
  function updHtml() {
    var h = '<section class="card" id="ad-upd"><h2>서버 코드 자동 업데이트</h2>';
    if (UPD.state === 'checking') h += '<span class="small muted">GitHub의 최신 서버 코드를 확인하는 중…</span>';
    else if (UPD.state === 'running') h += '<div class="row gap8"><div class="spin" style="width:20px;height:20px;margin:0"></div><span class="small b">업데이트하고 배포하는 중… (30초쯤 걸려요. 창을 닫지 마세요)</span></div>';
    else if (UPD.state === 'done') h += '<span class="small" style="color:var(--green-ink);font-weight:700">서버 코드를 ' + esc(UPD.r.latest) + '(으)로 바꾸고 배포했습니다.</span><span class="xs muted">1분쯤 뒤 [최신으로 새로고침]을 누르면 반영돼요.</span><button class="btn" data-act="updreload">최신으로 새로고침</button>';
    else if (UPD.state === 'ready') {
      var r = UPD.r, newer = !r.same;
      h += '<span class="small">지금 서버 코드 <b>' + esc(r.current) + '</b> · GitHub 최신 <b>' + esc(r.latest) + '</b></span>' +
        (newer ? '<button class="btn primary" data-act="updrun">지금 업데이트</button><span class="xs muted">GitHub에 올라간 최신 코드로 Apps Script를 바꾸고 새 버전으로 배포합니다. 붙여넣기는 필요 없어요.</span>' :
          '<span class="small" style="color:var(--green-ink);font-weight:700">최신입니다. 할 일이 없어요.</span><button class="btn sm" data-act="updrun">그래도 다시 배포</button>');
    } else if (UPD.state === 'error') {
      h += '<span class="small" style="color:var(--red);font-weight:700">' + esc(UPD.err) + '</span>';
      if (UPD.code === 'UPDATE_SETUP' || UPD.code === 'BAD_ACTION') h += setupHtml();
      h += '<button class="btn sm" data-act="updcheck">다시 확인</button>';
    } else h += '<button class="btn" data-act="updcheck">최신 버전 확인</button>';
    return h + '</section>';
  }
  function setupHtml() {
    var r = App.repo(), raw = 'https://raw.githubusercontent.com/' + r.owner + '/' + r.name + '/main/apps/inventory/gas/';
    return '<div class="tip blue" style="line-height:1.8"><b>처음 한 번만 준비해 주세요</b><ol class="small" style="margin:6px 0 0;padding-left:20px">' +
      '<li><a href="https://script.google.com/home/usersettings" target="_blank" rel="noopener">Apps Script 설정</a>에서 <b>Google Apps Script API</b>를 <b>사용</b>으로 켭니다.</li>' +
      '<li>Apps Script 편집기에서 <b>appsscript.json</b>을 <a href="' + esc(raw + 'appsscript.json') + '" target="_blank" rel="noopener">새 내용</a>으로 바꿉니다 (Ctrl+A → Ctrl+V). <b>Code.gs</b>, <b>Core</b>도 아래 [새 Code.gs 열기]·[새 Core.gs 열기]로 한 번 바꾸고 💾 저장합니다.</li>' +
      '<li>위쪽 함수 칸에서 <b>prepareUpdate</b>를 고르고 <b>▶ 실행</b> → 권한 창에서 <b>허용</b>합니다.</li>' +
      '<li><b>배포 → 배포 관리 → ✏️ → 새 버전 → 배포</b>를 한 번 합니다. 다음부터는 이 버튼으로 끝납니다.</li></ol></div>';
  }
  function drawUpd() { var el = document.getElementById('ad-upd'); if (el) el.outerHTML = updHtml(); }
  function updCheck() {
    UPD.state = 'checking'; drawUpd();
    return App.adminApi('serverUpdate', { check: true }).then(function (r) { UPD.state = 'ready'; UPD.r = r; drawUpd(); }, updFail);
  }
  function updFail(e) {
    if (e.code === 'ADMIN') { App.toast(e.message, true); App.render(); return; }
    UPD.state = 'error'; UPD.code = e.code || '';
    UPD.err = e.code === 'BAD_ACTION' ? '지금 서버 코드에는 자동 업데이트 기능이 없어요. 아래 준비를 한 번 해 주세요.' : e.message;
    drawUpd();
  }
  App.acts.updcheck = function () { updCheck(); };
  App.acts.updrun = function () {
    App.confirm('서버 코드를 업데이트할까요?', 'GitHub의 최신 코드로 바꾸고 새 버전으로 배포합니다.', '업데이트').then(function (ok) {
      if (!ok) return;
      UPD.state = 'running'; drawUpd();
      App.adminApi('serverUpdate', {}).then(function (r) {
        UPD.r = r; UPD.state = r.same ? 'ready' : 'done'; drawUpd();
        App.toast(r.same ? '이미 최신입니다.' : '서버 코드를 업데이트했습니다.');
      }, updFail);
    });
  };
  App.acts.updreload = function (el) {
    App.run(el, function () { return App.reload(false).then(function () { UPD.state = 'idle'; App.toast('최신 내용으로 바꿨습니다.'); }); });
  };

  App.views.more = function () {
    var waiting = S.data.repairs.filter(function (r) { return r.kind === '고장' && r.status === '대기'; }).length;
    function entry(icon, title, sub, act, to, badge) {
      return '<button class="item" data-act="' + act + '" data-to="' + to + '"><span style="color:var(--blue)">' + App.icon(icon, 24) + '</span><div class="grow col"><b>' + esc(title) + '</b><span class="xs muted">' + esc(sub) + '</span></div>' + (badge ? '<span class="chip red">' + badge + '</span>' : '') + '<span class="muted">' + App.icon('right', 18) + '</span></button>';
    }
    var h = '<div class="page"><div class="top"><h1>더보기</h1><span class="sub">' + (S.actor ? '이 기기 처리 직원: ' + esc(S.actor) : '처리 직원은 내주기·반납·예약 화면에서 고릅니다') + '</span></div><div class="body">' + App.versionNotice() + '<div class="list">' +
      entry('tool', '수리 대기·분실', '고장 난 교구를 처리하고 기록을 봐요', 'go', 'more/repairs', waiting ? waiting + '건' : '') +
      entry('check', '점검', '학기말 등에 물품·교실을 하나씩 확인해요', 'go', 'more/inspect', '') +
      entry('chart', '대여 실적', '교구·교실 이용 현황과 엑셀 내려받기', 'go', 'more/stats', '') +
      entry('gear', '설정·안내', '교실, 보관위치, 반납 기본 일수 확인', 'go', 'more/settings', '') +
      entry('gear', '관리자 메뉴', '구글 로그인 필요 · 접속 코드, 직원, 엑셀 내려받기, 코드 업데이트', 'go', 'more/admin', App.adminValid() ? '확인됨' : '') + '</div>' +
      '<div class="row gap8"><button class="btn block" data-act="syncnow">' + App.icon('swap', 18) + ' 최신으로 새로고침</button><button class="btn block" data-act="logout">' + App.icon('out', 18) + ' 지금 잠그기</button></div></div></div>';
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
      '<section class="card"><h2>엑셀로 내려받기</h2>' + (App.adminValid() ? csvButtons() + '<span class="xs muted">위에서 고른 기간의 기록이 내려받아져요. 엑셀에서 바로 열립니다.</span>' :
        '<span class="small muted">연락처가 들어 있어서 관리자 확인(구글 로그인) 뒤에 내려받을 수 있어요.</span><button class="btn" data-act="go" data-to="more/admin">관리자 메뉴로 가기</button>') + '</section></div></div>';
    return { html: h, tab: 'more' };
  };
  function csvButtons() {
    return '<div class="col gap8"><button class="btn" data-act="stcsv" data-k="rent">' + App.icon('down', 16) + ' 교구 대여 기록</button><button class="btn" data-act="stcsv" data-k="room">' + App.icon('down', 16) + ' 교실 예약 기록</button><button class="btn" data-act="stcsv" data-k="item">' + App.icon('down', 16) + ' 물품 목록표 (전체)</button></div>';
  }
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
    if (!App.adminValid()) { App.toast('관리자 확인(구글 로그인)이 필요합니다.', true); App.go('more/admin'); return; }
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
      '<section class="card flush"><div class="kv"><span>앱 잠금</span><span>열 때마다 4자리 코드 · 5분 넘게 나가 있거나 15분 동안 안 쓰면 다시 잠김</span></div><div class="kv"><span>반납 기본 일수</span><span>' + st.returnDays + '일</span></div><div class="kv"><span>연락처 보관 기간</span><span>' + st.maskDays + '일 (반납 완료 후)</span></div><div class="kv"><span>센터 이름</span><span>' + esc(st.centerName) + '</span></div></section>' +
      '<section class="card"><h2>직원 (' + S.staffNames.length + '명)</h2><div class="row wrap gap6">' + S.staffNames.map(function (n) { return '<span class="chip gray">' + esc(n) + '</span>'; }).join('') + '</div><span class="xs muted">이메일과 직원 추가·삭제는 관리자 메뉴에서 봅니다.</span></section>' +
      '<section class="card"><h2>교실</h2>' + S.data.rooms.map(function (r) { return '<div class="row between small"><span>' + esc(r.short) + ' · ' + esc(r.name) + '</span><span class="muted">' + (r.priority ? '수업 우선 교실' : '') + '</span></div>'; }).join('') + '</section>' +
      '<section class="card"><h2>보관위치 목록</h2><div class="row wrap gap6">' + (st.locs || []).map(function (l) { return '<span class="chip gray">' + esc(l) + '</span>'; }).join('') + '</div></section>' +
      '<section class="card"><h2>바꾸고 싶을 때</h2><p class="small" style="margin:0;color:var(--soft);line-height:1.7">직원 추가·삭제, 교실 추가, 보관위치 목록, 반납 기본 일수, 연락처 보관 기간은 구글 시트의 <b>직원</b>, <b>교실</b>, <b>설정</b> 탭에서 직접 고치면 됩니다. 시트는 <b>관리자 메뉴</b>에서 열 수 있어요. 고친 뒤 이 앱에서 [최신으로 새로고침]을 누르세요.</p>' +
      '<button class="btn" data-act="go" data-to="more/admin">관리자 메뉴로 가기</button></section></div></div>';
    return { html: h, tab: 'more' };
  };

  /* ───────── 관리자 메뉴: 들어올 때 구글 로그인으로 한 번 더 확인 (30분 유지) ───────── */

  var AD = { info: null };
  App.views.admin = function () {
    var top = '<div class="page">' + App.appbar('관리자 메뉴', 'more') + '<div class="body">';
    if (!App.adminValid()) {
      AD.info = null;
      return { html: top + '<section class="card"><h2>관리자 확인</h2><p class="small" style="margin:0;color:var(--soft);line-height:1.7">접속 코드, 직원 이메일, 연락처가 담긴 엑셀 내려받기, 서버 코드 업데이트는 <b>직원 탭에 등록된 구글 계정</b>으로 한 번 더 확인합니다. 확인은 30분 동안 유지되고, 앱을 닫으면 끝납니다.</p><div id="gbtn-admin" class="gbtn"></div></section></div></div>', tab: 'more',
        after: function () { App.googleButton('gbtn-admin', function () { App.toast('관리자로 확인했습니다.'); App.render(); }); } };
    }
    var left = Math.max(1, Math.round((S.admin.until - Date.now()) / 60000));
    var h = top + '<div class="card"><div class="row between gap8"><span class="small"><b>' + esc(S.admin.name || '관리자') + '</b> <span class="muted">' + esc(S.admin.email) + ' · ' + left + '분 남음</span></span><button class="btn sm" data-act="adend">확인 끝내기</button></div></div>' + App.versionNotice() +
      '<div id="adbody" class="col gap12"></div></div></div>';
    // 서버에서 직원 이메일·시트 주소를 받기 전에도 화면을 먼저 그립니다 (못 받아도 접속 코드는 바꿀 수 있게)
    if (!AD.info) AD.info = { staff: S.staff, sheetUrl: S.sheetUrl, scriptUrl: S.scriptUrl, hasCode: null, loading: true };
    return { html: h, tab: 'more', after: function () {
      drawAdmin();
      if (UPD.state === 'idle' || UPD.state === 'error') updCheck();
      var fill = function (info) { AD.info = info; S.sheetUrl = info.sheetUrl || S.sheetUrl; S.scriptUrl = info.scriptUrl || S.scriptUrl; drawAdmin(); };
      App.adminApi('adminInfo').then(fill, function (e) {
        if (e.code === 'BAD_ACTION') { fill({ staff: S.staff, sheetUrl: S.sheetUrl, scriptUrl: S.scriptUrl, hasCode: false, old: true }); return; }
        if (e.code === 'ADMIN') { App.toast(e.message, true); App.render(); return; }
        AD.info.loading = false; AD.info.error = e.message; drawAdmin();
      });
    } };
  };
  function drawAdmin() {
    var box = document.getElementById('adbody'), info = AD.info;
    if (!box || !info) return;
    try { box.innerHTML = adminBody(info); } catch (e) {
      box.innerHTML = '<div class="card"><b style="color:var(--red)">관리자 화면을 그리지 못했습니다</b><span class="small muted">' + esc(e.message) + '</span></div>';
    }
  }
  function adminBody(info) {
    return (info.error ? '<div class="tip" style="background:var(--red-soft);border-color:var(--red-line);color:var(--red)"><b>서버에서 관리 정보를 받지 못했습니다.</b> ' + esc(info.error) + ' <button class="textbtn" style="padding:0;min-height:0;color:var(--red);text-decoration:underline" data-act="adretry">다시 시도</button></div>' : '') +
      updHtml() + '<section class="card"><h2>앱 접속 코드 (4자리)</h2>' +
      (info.old ? '<span class="small" style="color:var(--red)">서버 코드를 먼저 업데이트해야 접속 코드를 쓸 수 있어요. 아래 [코드 업데이트 방법]을 따라 해 주세요.</span>' :
        (info.hasCode === null ? '<span class="small muted">코드 상태를 확인하는 중…</span>' :
          '<span class="small ' + (info.hasCode ? 'muted' : '') + '" style="' + (info.hasCode ? '' : 'color:var(--red);font-weight:700') + '">' + (info.hasCode ? '접속 코드가 정해져 있어요. 보안을 위해 지금 코드는 보여 주지 않습니다.' : '아직 접속 코드가 없어요. 직원들이 앱을 열려면 코드를 먼저 정해 주세요.') + '</span>') +
        '<div class="grid2"><label class="f">새 코드<input id="ad-c1" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="숫자 4자리"></label><label class="f">한 번 더<input id="ad-c2" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="숫자 4자리"></label></div>' +
        '<button class="btn primary" data-act="adcode">' + (info.hasCode ? '접속 코드 바꾸기' : '접속 코드 정하기') + '</button>' +
        '<span class="xs muted">바꾸면 코드로 들어와 있던 모든 기기가 바로 잠깁니다. 직원들에게 새 코드를 알려 주세요. 0000·1234처럼 쉬운 코드는 쓸 수 없어요. 코드를 10번 틀리면 10분 동안 모든 기기에서 입력이 막히고 변경기록에 남습니다.</span>') + '</section>' +
      '<section class="card"><h2>직원 (' + (info.staff || []).length + '명)</h2>' + (info.staff || []).map(function (s) { return '<div class="row between small"><span><b>' + esc(s.name) + '</b> <span class="muted">' + esc(s.email) + '</span></span><span class="chip gray">' + esc(s.role || '직원') + '</span></div>'; }).join('') +
      '<span class="xs muted">직원 탭의 사람은 관리자 메뉴에 들어올 수 있고, [처리 직원] 목록에 이름이 나옵니다. 추가·삭제는 구글 시트의 <b>직원</b> 탭에서 합니다.</span></section>' +
      '<section class="card"><h2>엑셀로 내려받기</h2>' + csvButtons() + '<span class="xs muted">기간은 [대여 실적] 화면에서 고른 기간(처음에는 올해)입니다.</span></section>' +
      adminHtml();
  }
  App.acts.adretry = function () { AD.info = null; App.render(); };
  App.acts.adend = function () { S.admin = null; AD.info = null; UPD.state = 'idle'; App.toast('관리자 확인을 끝냈습니다.'); App.render(); };
  App.acts.adcode = function (el) {
    var c1 = document.getElementById('ad-c1').value.trim(), c2 = document.getElementById('ad-c2').value.trim();
    if (!/^\d{4}$/.test(c1)) { App.toast('숫자 4자리로 적어 주세요.', true); return; }
    if (c1 !== c2) { App.toast('두 칸의 코드가 다릅니다.', true); return; }
    App.run(el, function () {
      return App.adminApi('setAccessCode', { code: c1 }).then(function () {
        AD.info.hasCode = true; AD.info.old = false; drawAdmin();
        App.toast('접속 코드를 정했습니다. 다른 기기는 새 코드로 다시 들어와야 해요.');
      }, function (e) { if (e.code === 'ADMIN') App.render(); throw e; });
    });
  };
})();
