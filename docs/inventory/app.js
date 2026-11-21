/*
 * 창의센터 물품·시설 관리 — 앱 뼈대
 * 잠금 화면(4자리 접속 코드), 관리자 확인(구글 로그인), 서버 연결, 화면 이동(주소의 # 뒤), 자동 새로고침을 맡습니다.
 * 각 화면은 view-*.js 에서 App.views.이름 = function(...) 으로 등록합니다.
 */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var S = { codeVersion: 0, coreVersion: 0, scriptUrl: '', token: null, admin: null, actor: '', user: null, data: null, settings: {}, staff: [], staffNames: [], schools: [], rev: '0', sheetUrl: '', ui: {}, v: 0, syncedAt: 0 };
  var App = window.App = { S: S, views: {}, acts: {}, ins: {}, chs: {}, cleanup: null };
  var root = document.getElementById('app');

  /* ───────── 도구 ───────── */

  App.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  var esc = App.esc;
  App.today = function () { return Core.todayStr(); };
  App.wide = function () { return window.innerWidth >= 900; };

  var toastTimer;
  App.toast = function (msg, isErr) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'on' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, isErr ? 6000 : 2600);
  };

  /** 확인 창. 누른 결과(true/false)를 돌려줍니다 */
  App.confirm = function (title, msg, okLabel, danger) {
    return new Promise(function (resolve) {
      var m = document.getElementById('modal');
      m.hidden = false;
      m.innerHTML = '<div class="dlg" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' + (msg ? '<p>' + esc(msg) + '</p>' : '') +
        '<div class="row gap8"><button class="btn block" data-r="0">아니요</button><button class="btn block ' + (danger ? 'danger' : 'primary') + '" data-r="1">' + esc(okLabel || '확인') + '</button></div></div>';
      m.onclick = function (e) {
        var b = e.target.closest('[data-r]');
        if (!b && e.target !== m) return;
        m.hidden = true; m.innerHTML = ''; m.onclick = null;
        resolve(!!b && b.getAttribute('data-r') === '1');
      };
      var first = m.querySelector('[data-r="1"]');
      if (first) first.focus();
    });
  };

  /** 입력 창 (한 줄 글자) */
  App.prompt = function (title, label, value, okLabel) {
    return new Promise(function (resolve) {
      var m = document.getElementById('modal');
      m.hidden = false;
      m.innerHTML = '<div class="dlg" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3><label class="f">' + esc(label) +
        '<input id="pm-in" value="' + esc(value || '') + '"></label><div class="row gap8"><button class="btn block" data-r="0">취소</button><button class="btn block primary" data-r="1">' + esc(okLabel || '확인') + '</button></div></div>';
      var inp = m.querySelector('#pm-in');
      inp.focus();
      m.onclick = function (e) {
        var b = e.target.closest('[data-r]');
        if (!b && e.target !== m) return;
        var ok = !!b && b.getAttribute('data-r') === '1';
        var val = inp.value;
        m.hidden = true; m.innerHTML = ''; m.onclick = null;
        resolve(ok ? val : null);
      };
    });
  };

  /** 버튼을 누르는 동안 '저장 중…' 으로 바꾸고, 오류는 알림으로 보여 줍니다 */
  App.run = function (btn, fn) {
    var label = '';
    if (btn) { btn.disabled = true; label = btn.textContent; btn.textContent = '처리 중…'; }
    return Promise.resolve().then(fn).catch(function (e) { App.toast(e.message || '오류가 났습니다.', true); return null; })
      .then(function (r) { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; } return r; });
  };

  /* ───────── 서버 코드가 오래됐는지 ───────── */

  App.REQUIRED_CODE = 7;
  /** 서버(Apps Script)의 코드가 이 화면보다 오래되면 true */
  App.outdated = function () { return !!S.data && (S.codeVersion < App.REQUIRED_CODE || S.coreVersion < Core.VERSION); };
  App.versionNotice = function () {
    return App.outdated() ? '<div class="tip" style="background:var(--red-soft);border-color:var(--red-line);color:var(--red)"><b>서버 코드를 새 버전으로 바꿔 주세요.</b> 화면과 서버의 버전이 달라서 일부 계산이 어긋날 수 있어요. <button class="textbtn" style="padding:0;min-height:0;color:var(--red);text-decoration:underline" data-act="go" data-to="more/admin">관리자 메뉴에서 방법 보기</button></div>' : '';
  };
  /** 이 앱이 올라가 있는 GitHub 저장소 (주소에서 알아냄: 소유자가 바뀌어도 그대로 동작) */
  App.repo = function () {
    var owner = /^([^.]+)\.github\.io$/.exec(location.hostname), name = location.pathname.split('/')[1];
    return { owner: owner ? owner[1] : 'xleesjx', name: owner && name ? name : 'ulsan-cce' };
  };

  /* ───────── 서버 연결 ───────── */

  function jwtPayload(tok) {
    try {
      var s = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(s))));
    } catch (e) { return null; }
  }
  /**
   * 로그인 표는 기기에 저장하지 않고 화면이 열려 있는 동안만 기억합니다.
   *  - 접속 코드로 받은 표(12시간): 앱을 새로 열면 다시 코드를 넣어야 합니다.
   *  - 관리자 표(30분): 구글 로그인 뒤 서버가 발급. 관리자 메뉴에서만 씁니다.
   */
  function tokenValid(tok) {
    var p = tok && jwtPayload(tok);
    if (!p) return false;
    return (p.x || p.exp * 1000) > Date.now() + 5000;
  }
  App.adminValid = function () { return !!S.admin && S.admin.until > Date.now() + 5000; };

  /** 이 기기에서 [처리 직원] 칸에 마지막으로 적은 이름 */
  var AKEY = 'ci-actor';
  try { S.actor = localStorage.getItem(AKEY) || ''; } catch (e) { S.actor = ''; }
  App.setActor = function (name) {
    S.actor = String(name || '').trim().slice(0, 20);
    try { localStorage.setItem(AKEY, S.actor); } catch (e) { /* 무시 */ }
  };

  function post(body) {
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }, function () { throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'); })
      .then(function (res) {
        if (!res.ok) { var e = new Error(res.error || '오류'); e.code = res.code; e.extra = res.extra; throw e; }
        return res;
      });
  }

  /** 일반 요청 (접속 코드 표). 표가 끝났으면 잠금 화면으로 */
  App.api = function (action, payload) {
    if (!tokenValid(S.token)) { App.lock('다시 잠금을 풀어 주세요.'); return Promise.reject(new Error('잠금 해제 필요')); }
    return post(Object.assign({ action: action, token: S.token, actor: S.actor }, payload || {})).catch(function (e) {
      if (e.code === 'AUTH' || e.code === 'FORBIDDEN') App.lock(e.message);
      throw e;
    });
  };
  /** 관리자 요청 (구글 로그인으로 받은 30분짜리 표) */
  App.adminApi = function (action, payload) {
    if (!App.adminValid()) { S.admin = null; var e0 = new Error('관리자 확인 시간이 지났습니다. 다시 구글 로그인을 해 주세요.'); e0.code = 'ADMIN'; return Promise.reject(e0); }
    return post(Object.assign({ action: action, token: S.admin.token, actor: S.actor }, payload || {})).catch(function (e) {
      if (e.code === 'AUTH' || e.code === 'FORBIDDEN' || e.code === 'ADMIN') { S.admin = null; e.code = 'ADMIN'; }
      throw e;
    });
  };

  /** 서버가 돌려준 바뀐 내용을 화면의 데이터에 반영합니다 */
  function upsert(arr, obj, key) {
    for (var i = 0; i < arr.length; i++) if (arr[i][key] === obj[key]) { arr[i] = obj; return; }
    arr.push(obj);
  }
  App.apply = function (res) {
    var d = S.data;
    (res.items || []).forEach(function (o) { upsert(d.items, o, 'id'); });
    (res.rentals || []).forEach(function (o) { upsert(d.rentals, o, 'id'); });
    (res.repairs || []).forEach(function (o) { upsert(d.repairs, o, 'id'); });
    (res.reservations || []).forEach(function (o) { upsert(d.reservations, o, 'id'); });
    if (res.programsFor) Object.keys(res.programsFor).forEach(function (id) { d.programs = d.programs.filter(function (r) { return r.id !== id; }).concat(res.programsFor[id]); });
    if (res.linesFor) Object.keys(res.linesFor).forEach(function (rid) { d.lines = d.lines.filter(function (l) { return l.rid !== rid; }).concat(res.linesFor[rid]); });
    if (res.rev) S.rev = res.rev;
    S.v++;
    drawNav();
  };

  var cache = { v: -1, idx: null, imap: null, linesBy: null, rmap: null };
  function fresh() {
    if (cache.v === S.v) return;
    cache.v = S.v;
    cache.idx = Core.makeIndex(S.data, { buffer: S.settings.programBuffer });
    cache.imap = {}; S.data.items.forEach(function (i) { cache.imap[i.id] = i; });
    cache.rmap = {}; S.data.rentals.forEach(function (r) { cache.rmap[r.id] = r; });
    cache.linesBy = {}; S.data.lines.forEach(function (l) { (cache.linesBy[l.rid] = cache.linesBy[l.rid] || []).push(l); });
  }
  App.idx = function () { fresh(); return cache.idx; };
  App.imap = function () { fresh(); return cache.imap; };
  App.rmap = function () { fresh(); return cache.rmap; };
  App.linesOf = function (rid) { fresh(); return cache.linesBy[rid] || []; };

  /* ───────── 잠금 화면 (4자리 접속 코드) ───────── */

  var AWAY_MS = 5 * 60000, IDLE_MS = 15 * 60000;
  var lk = { code: '', busy: false, info: null };

  /** 잠그기: 표와 데이터를 지우고 잠금 화면으로 (지금 보던 화면 주소는 그대로 → 풀면 그 화면으로) */
  App.lock = function (msg) {
    S.token = null; S.admin = null; S.data = null; S.v++;
    if (App.cleanup) { try { App.cleanup(); } catch (e) { /* 무시 */ } App.cleanup = null; }
    showLock(msg);
  };
  App.logout = App.lock;

  function dots() { var h = ''; for (var i = 0; i < 4; i++) h += '<i class="' + (i < lk.code.length ? 'on' : '') + '"></i>'; return h; }
  function showLock(msg) {
    lk.code = ''; lk.busy = false;
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    root.innerHTML = '<div class="lock" role="dialog" aria-label="잠금 화면"><div class="brand">창의센터 물품·시설 관리</div>' +
      '<p class="muted" id="lk-msg" aria-live="polite">' + esc(msg || '접속 코드 4자리를 입력해 주세요') + '</p>' +
      '<div class="lkdots" id="lk-dots" aria-label="입력한 자리 수">' + dots() + '</div>' +
      '<div class="keypad">' + keys.map(function (k) {
        if (!k) return '<span></span>';
        return '<button data-act="lkkey" data-k="' + k + '" aria-label="' + (k === 'del' ? '지우기' : k) + '">' + (k === 'del' ? '⌫' : k) + '</button>';
      }).join('') + '</div>' +
      '<button class="textbtn" data-act="lkadmin" style="margin-top:8px">관리자 로그인 (구글)</button><div id="gbtn" hidden></div></div>';
    if (msg && msg !== '접속 코드 4자리를 입력해 주세요') document.getElementById('lk-msg').style.color = 'var(--red)';
    // 코드를 누르는 동안 서버를 미리 깨워 둡니다 (Apps Script 첫 응답이 느린 것을 줄임)
    post({ action: 'lockInfo' }).then(function (r) {
      lk.info = r;
      if (!r.hasCode) { lockMsg('아직 접속 코드가 없습니다. 관리자가 아래 구글 로그인으로 들어가 코드를 정해 주세요.', true); openGoogle(); }
    }, function (e) {
      if (e.code === 'BAD_ACTION') { lockMsg('서버 코드가 옛 버전입니다. 관리자가 구글 로그인으로 들어가 서버 코드를 업데이트해 주세요.', true); openGoogle(); }
    });
    if (!S.schools.length) loadSchools();
  }
  function lockMsg(t, err) { var m = document.getElementById('lk-msg'); if (m) { m.textContent = t; m.style.color = err ? 'var(--red)' : ''; } }
  function lockShown() { return !!document.getElementById('lk-dots'); }

  function pressKey(k) {
    if (lk.busy || !lockShown()) return;
    if (k === 'del') lk.code = lk.code.slice(0, -1); else if (/^\d$/.test(k) && lk.code.length < 4) lk.code += k;
    document.getElementById('lk-dots').innerHTML = dots();
    if (lk.code.length === 4) unlock();
  }
  App.acts.lkkey = function (el) { pressKey(el.getAttribute('data-k')); };
  document.addEventListener('keydown', function (e) {
    if (!lockShown() || e.target.tagName === 'INPUT') return;
    if (/^\d$/.test(e.key)) { pressKey(e.key); e.preventDefault(); } else if (e.key === 'Backspace') { pressKey('del'); e.preventDefault(); }
  });

  function unlock() {
    lk.busy = true;
    lockMsg('확인 중…');
    post({ action: 'unlock', code: lk.code, actor: S.actor }).then(function (res) {
      S.token = res.session;
      lastActive = Date.now();
      setBoot(res);
      buildShell();
      render();
    }, function (e) {
      lk.busy = false; lk.code = '';
      var d = document.getElementById('lk-dots');
      if (d) { d.innerHTML = dots(); d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }
      if (e.code === 'WRONG_CODE') lockMsg('코드가 맞지 않습니다.' + (e.extra && e.extra.left <= 5 ? ' (' + e.extra.left + '번 더 틀리면 10분 동안 잠김)' : ''), true);
      else if (e.code === 'BAD_ACTION') lockMsg('서버 코드가 옛 버전입니다. 관리자가 구글 로그인으로 들어가 서버 코드를 업데이트해 주세요.', true);
      else lockMsg(e.message, true);
    });
  }

  /* 자리를 비우면 다시 잠금: 다른 앱으로 5분 이상 나가 있었거나, 15분 동안 아무것도 누르지 않았을 때 */
  var lastActive = Date.now(), hiddenAt = 0;
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { lastActive = Date.now(); }, { capture: true, passive: true }); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (S.token && hiddenAt && Date.now() - hiddenAt > AWAY_MS) { hiddenAt = 0; App.lock('자리를 비운 사이 잠겼습니다. 코드를 다시 입력해 주세요.'); return; }
    hiddenAt = 0;
    maybeSync();
  });
  setInterval(function () { if (S.token && Date.now() - lastActive > IDLE_MS) App.lock('한동안 쓰지 않아 잠겼습니다. 코드를 다시 입력해 주세요.'); }, 30000);

  /* ───────── 관리자 확인 (구글 로그인) ───────── */

  var gsiCb = null;
  function whenGsi(cb) {
    if (window.google && google.accounts && google.accounts.id) { initGsi(); cb(); return; }
    setTimeout(function () { whenGsi(cb); }, 150);
  }
  var gsiInit = false;
  function initGsi() {
    if (gsiInit) return;
    gsiInit = true;
    google.accounts.id.initialize({ client_id: CFG.CLIENT_ID, callback: function (resp) { if (gsiCb) gsiCb(resp.credential); }, auto_select: false, cancel_on_tap_outside: false });
  }
  /** 구글 로그인 버튼을 그 자리(id)에 그리고, 로그인하면 30분짜리 관리자 표를 받아 done()을 부릅니다 */
  App.googleButton = function (id, done, fail) {
    gsiCb = function (credential) {
      post({ action: 'login', token: credential }).then(function (res) {
        S.admin = { token: res.session, until: Date.now() + (res.minutes || 30) * 60000, name: res.name || '', email: res.email || '' };
        if (!res.minutes) S.admin.until = Date.now() + 30 * 60000; // 옛 서버 코드
        done();
      }, function (e) { if (fail) fail(e); else App.toast(e.message, true); });
    };
    whenGsi(function () {
      var box = document.getElementById(id);
      if (!box) return;
      box.hidden = false;
      google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ko' });
    });
  };
  function openGoogle() {
    // 잠금 화면에서 관리자로 들어가기: 관리자 표로 바로 앱을 엽니다 (30분 뒤 잠김)
    App.googleButton('gbtn', function () { S.token = S.admin.token; begin(); }, function (e) { lockMsg(e.message, true); });
  }
  App.acts.lkadmin = function () { openGoogle(); };

  App.start = function () {
    if (!CFG.API_URL || /여기에/.test(CFG.API_URL + CFG.CLIENT_ID)) {
      root.innerHTML = '<div class="login"><div class="brand">설정이 필요합니다</div><p class="muted">config.js 에 Apps Script 주소와 클라이언트 ID를 넣어 주세요.</p></div>';
      return;
    }
    // 이전 버전이 기기에 남긴 로그인 표는 지웁니다 (이제는 기기에 저장하지 않음)
    try { localStorage.removeItem('ci-session'); sessionStorage.removeItem('idtoken'); } catch (e) { /* 무시 */ }
    showLock();
  };

  /* ───────── 처음 불러오기 ───────── */

  function setBoot(b) {
    S.codeVersion = b.codeVersion || 0; S.coreVersion = b.coreVersion || 0; S.scriptUrl = b.scriptUrl || '';
    S.user = b.user; S.settings = b.settings; S.staff = b.staff || []; S.rev = b.rev; S.sheetUrl = b.sheetUrl || '';
    S.staffNames = b.staffNames || (b.staff || []).map(function (x) { return x.name; }).filter(Boolean);
    S.data = { items: b.items, rentals: b.rentals, lines: b.lines, repairs: b.repairs, rooms: b.rooms, reservations: b.reservations, programs: b.programs || [] };
    S.v++; S.syncedAt = Date.now();
  }

  function loadSchools() {
    return fetch('schools.json', { cache: 'default' }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) { S.schools = (Array.isArray(j) ? j : j.schools || []).map(function (s) { return typeof s === 'string' ? s : s.n; }); })
      .catch(function () { S.schools = []; });
  }

  function begin() {
    root.innerHTML = '<div class="loader" role="status"><div class="spin" aria-hidden="true"></div><div class="ld-msg">불러오는 중…</div></div>';
    Promise.all([App.api('boot'), loadSchools()]).then(function (r) {
      setBoot(r[0]);
      buildShell();
      render();
    }).catch(function (e) {
      if (e.code === 'AUTH' || e.code === 'FORBIDDEN' || !S.token) return;
      root.innerHTML = '<div class="login"><div class="brand">불러오지 못했습니다</div><p class="muted">' + esc(e.message) + '</p><button class="btn primary" onclick="location.reload()">다시 시도</button></div>';
    });
  }

  /** 다른 사람이 바꾼 내용이 있으면 다시 불러옵니다 */
  App.reload = function (quiet) {
    return App.api('boot').then(function (b) {
      setBoot(b);
      drawNav();
      if (!isEditing()) render(); else if (!quiet) render();
    });
  };
  /** 입력 중인 화면에서는 자동 새로고침으로 입력 내용이 사라지지 않게 합니다 */
  function isEditing() { return /\/(new|edit|handover|return)(\?|$)/.test(location.hash) || /^#\/res\//.test(location.hash); }
  function maybeSync() {
    if (!S.data || !tokenValid(S.token) || Date.now() - S.syncedAt < 20000) return;
    App.api('rev').then(function (r) {
      S.syncedAt = Date.now();
      if (r.rev !== S.rev) return App.reload(true);
    }).catch(function () { /* 다음에 다시 */ });
  }
  setInterval(function () { if (document.visibilityState === 'visible') maybeSync(); }, 45000);

  /* ───────── 화면 틀과 이동 ───────── */

  var TABS = [['brief', '', '브리핑', 'home'], ['items', 'items', '물품대장', 'box'], ['rentals', 'rentals', '교구대여', 'swap'], ['rooms', 'rooms', '교실대여', 'cal'], ['more', 'more', '더보기', 'more']];

  function buildShell() {
    root.innerHTML = '<div class="shell"><nav id="nav" aria-label="메뉴"></nav><main id="view"></main></div>';
    drawNav();
  }

  function drawNav() {
    var nav = document.getElementById('nav');
    if (!nav || !S.data) return;
    var b = Core.briefing(S.data, App.today(), 'all');
    var n = b.docs.length + b.today.filter(function (e) { return e.kind === 'overdue'; }).length;
    var cur = S.ui.tab || 'brief';
    nav.innerHTML = TABS.map(function (t) {
      return '<button data-act="nav" data-to="' + t[1] + '" class="' + (cur === t[0] ? 'on' : '') + '" aria-label="' + t[2] + '"' + (cur === t[0] ? ' aria-current="page"' : '') + '>' +
        App.icon(t[3]) + t[2] + (t[0] === 'brief' && n ? '<span class="dot" aria-label="할 일 ' + n + '건">' + n + '</span>' : '') + '</button>';
    }).join('');
  }

  App.parseHash = function () {
    var h = location.hash.replace(/^#\/?/, ''), q = {};
    var i = h.indexOf('?');
    if (i >= 0) {
      h.slice(i + 1).split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
      h = h.slice(0, i);
    }
    return { path: h.split('/').filter(Boolean).map(decodeURIComponent), q: q };
  };

  App.go = function (path, q, replace) {
    var qs = q ? Object.keys(q).filter(function (k) { return q[k] !== '' && q[k] !== undefined && q[k] !== null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&') : '';
    var h = '#/' + path + (qs ? '?' + qs : '');
    if (replace) { history.replaceState(null, '', h); render(); } else if (location.hash === h) render(); else location.hash = h;
  };
  App.back = function (fallback) {
    if (window.__navCount > 0) history.back(); else App.go(fallback || '', null, true);
  };
  window.__navCount = 0;
  window.addEventListener('hashchange', function () { window.__navCount++; render(); });

  function resolve(p) {
    var a = p[0];
    if (!a) return ['brief'];
    if (a === 'items') return ['items'];
    if (a === 'item') {
      if (p[1] === 'new') return ['itemForm', null];
      if (p[2] === 'edit') return ['itemForm', p[1]];
      return ['itemDetail', p[1]];
    }
    if (a === 'rentals') return ['rentals', null, null];
    if (a === 'rental') {
      if (p[1] === 'new') return ['rentalForm', null];
      if (p[2] === 'edit') return ['rentalForm', p[1]];
      return ['rentals', p[1], p[2] || 'view'];
    }
    if (a === 'rooms') return ['rooms'];
    if (a === 'prog') return ['progForm', p[1] === 'new' ? null : p[1]];
    if (a === 'res') return ['resForm', p[1] === 'new' ? null : p[1]];
    if (a === 'more') {
      if (p[1] === 'repairs') return ['repairs'];
      if (p[1] === 'stats') return ['stats'];
      if (p[1] === 'inspect') return ['inspect', p[2] || null];
      if (p[1] === 'settings') return ['settings'];
      if (p[1] === 'admin') return ['admin'];
      return ['more'];
    }
    return ['brief'];
  }

  var lastPath = null;
  function render() {
    if (!S.data) return;
    var view = document.getElementById('view');
    if (!view) return;
    if (App.cleanup) { try { App.cleanup(); } catch (e) { /* 무시 */ } App.cleanup = null; }
    var route = App.parseHash();
    var r = resolve(route.path);
    var fn = App.views[r[0]];
    if (!fn) { view.innerHTML = '<div class="empty">화면을 찾을 수 없습니다.</div>'; return; }
    var out;
    try { out = fn.apply(null, r.slice(1).concat([route])); } catch (e) {
      console.error(e);
      view.innerHTML = '<div class="empty">화면을 그리는 중 문제가 생겼습니다.<br>' + esc(e.message) + '</div>';
      return;
    }
    S.ui.tab = out.tab || 'brief';
    view.innerHTML = out.html;
    drawNav();
    var key = route.path.join('/');
    if (key !== lastPath) { window.scrollTo(0, 0); lastPath = key; }
    if (out.after) out.after(view);
  }
  App.render = render;

  /* ───────── 눌림·입력 처리 (화면 어디서든 data- 속성으로) ───────── */

  App.acts.nav = function (el) { App.go(el.getAttribute('data-to')); };
  App.acts.go = function (el) { App.go(el.getAttribute('data-to')); };
  App.acts.back = function (el) { App.back(el.getAttribute('data-to')); };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = App.acts[el.getAttribute('data-act')];
    if (fn) { fn(el, e); }
  });
  document.addEventListener('input', function (e) {
    var el = e.target.closest('[data-in]');
    if (!el) return;
    var fn = App.ins[el.getAttribute('data-in')];
    if (fn) fn(el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-ch]');
    if (!el) return;
    var fn = App.chs[el.getAttribute('data-ch')];
    if (fn) fn(el, e);
  });
})();
