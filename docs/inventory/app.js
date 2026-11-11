/*
 * 창의센터 물품·시설 관리 — 앱 뼈대
 * 로그인, 서버 연결, 화면 이동(주소의 # 뒤), 자동 새로고침을 맡습니다.
 * 각 화면은 view-*.js 에서 App.views.이름 = function(...) 으로 등록합니다.
 */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var S = { token: null, user: null, data: null, settings: {}, staff: [], schools: [], rev: '0', sheetUrl: '', ui: {}, v: 0, syncedAt: 0 };
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

  /* ───────── 서버 연결 ───────── */

  function jwtPayload(tok) {
    try {
      var s = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(s))));
    } catch (e) { return null; }
  }
  function tokenValid(tok) { var p = tok && jwtPayload(tok); return !!(p && p.exp * 1000 > Date.now() + 60000); }

  App.api = function (action, payload) {
    if (!tokenValid(S.token)) { relogin('로그인 시간이 지났습니다. 다시 로그인해 주세요.'); return Promise.reject(new Error('로그인 필요')); }
    var body = Object.assign({ action: action, token: S.token }, payload || {});
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) {
          if (res.code === 'AUTH' || res.code === 'FORBIDDEN') relogin(res.error);
          var e = new Error(res.error || '오류'); e.code = res.code; e.extra = res.extra; throw e;
        }
        return res;
      }, function () { throw new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.'); });
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

  /* ───────── 로그인 ───────── */

  function relogin(msg) {
    S.token = null;
    try { sessionStorage.removeItem('idtoken'); } catch (e) { /* 무시 */ }
    showLogin(msg);
  }

  function showLogin(msg) {
    root.innerHTML = '<div class="login"><div class="brand">창의센터 물품·시설 관리</div>' +
      '<p class="muted">등록된 직원의 구글 계정으로 로그인해 주세요.</p>' +
      (msg ? '<p style="color:var(--red)">' + esc(msg) + '</p>' : '') + '<div id="gbtn"></div></div>';
    whenGsi(function () {
      google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ko' });
      google.accounts.id.prompt();
    });
  }

  function whenGsi(cb) {
    if (window.google && google.accounts && google.accounts.id) { initGsi(); cb(); return; }
    setTimeout(function () { whenGsi(cb); }, 150);
  }
  var gsiInit = false;
  function initGsi() {
    if (gsiInit) return;
    gsiInit = true;
    google.accounts.id.initialize({ client_id: CFG.CLIENT_ID, callback: onCredential, auto_select: true, cancel_on_tap_outside: false });
  }
  function onCredential(resp) {
    S.token = resp.credential;
    try { sessionStorage.setItem('idtoken', S.token); } catch (e) { /* 무시 */ }
    begin();
  }

  App.logout = function () {
    S.token = null; S.data = null;
    try { sessionStorage.removeItem('idtoken'); } catch (e) { /* 무시 */ }
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    showLogin();
  };

  App.start = function () {
    if (!CFG.API_URL || /여기에/.test(CFG.API_URL + CFG.CLIENT_ID)) {
      root.innerHTML = '<div class="login"><div class="brand">설정이 필요합니다</div><p class="muted">config.js 에 Apps Script 주소와 클라이언트 ID를 넣어 주세요.</p></div>';
      return;
    }
    var saved = null;
    try { saved = sessionStorage.getItem('idtoken'); } catch (e) { /* 무시 */ }
    if (tokenValid(saved)) { S.token = saved; begin(); } else showLogin();
  };

  /* ───────── 처음 불러오기 ───────── */

  function setBoot(b) {
    S.user = b.user; S.settings = b.settings; S.staff = b.staff; S.rev = b.rev; S.sheetUrl = b.sheetUrl;
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
      if (e.code === 'AUTH' || e.code === 'FORBIDDEN') return;
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
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') maybeSync(); });
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
