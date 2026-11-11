/* 화면 공통 부품: 아이콘, 수량 버튼, 날짜 빠른 버튼, 자동완성, 서명 칸, 사진 줄이기, 내려받기 */
(function () {
  'use strict';
  var App = window.App, esc = App.esc;

  /* ───────── 아이콘 ───────── */
  var P = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    box: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/>',
    swap: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    out: '<path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9"/>',
    down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'
  };
  App.icon = function (name, size) {
    var s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
  };

  /* ───────── 빠른 반응 ───────── */
  /**
   * 서버 응답을 기다리지 않고 화면부터 바꿉니다. 저장에 실패하면 되돌리고 알려 줍니다.
   * mutate: 화면 데이터를 바꾸는 함수, call: 서버에 보내는 함수(Promise), undo: 실패했을 때 되돌리는 함수
   */
  App.optimistic = function (mutate, call, undo, okMsg) {
    mutate(); App.S.v++; App.render();
    return call().then(function (res) {
      App.apply(res); if (okMsg) App.toast(okMsg); App.render();
    }).catch(function (e) {
      undo(); App.S.v++; App.render(); App.toast(e.message || '저장하지 못했습니다.', true);
    });
  };

  /* ───────── 틀 ───────── */
  App.appbar = function (title, backTo, right) {
    return '<div class="appbar"><button class="iconbtn" data-act="back" data-to="' + esc(backTo || '') + '" aria-label="뒤로">' + App.icon('back') + '</button><span class="ttl ellip">' + esc(title) + '</span>' + (right || '') + '</div>';
  };
  App.photoSrc = function (it) {
    var p = (it && it.photo) || '';
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    return 'photos/' + encodeURI(p);
  };
  App.thumb = function (it, big) {
    var src = App.photoSrc(it);
    return '<div class="thumb' + (big ? ' big' : '') + '">' + (src ? '<img src="' + esc(src) + '" alt="' + esc(it.name) + '" loading="lazy" onerror="this.parentNode.textContent=\'사진 없음\'">' : '사진 없음') + '</div>';
  };
  App.kindCls = function (kind) { return Core.KIND_CLASS[kind] || 'gray'; };

  /* ───────── 수량 버튼 ───────── */
  App.stepper = function (id, value, opts) {
    opts = opts || {};
    return '<div class="step' + (opts.large ? ' lg' : '') + '"><button type="button" data-act="step" data-for="' + id + '" data-d="-1" aria-label="빼기">−</button>' +
      '<input id="' + id + '" type="number" inputmode="numeric" min="' + (opts.min || 0) + '"' + (opts.max !== undefined ? ' max="' + opts.max + '"' : '') + ' value="' + value + '"' + (opts.inName ? ' data-in="' + opts.inName + '"' : '') + (opts.attrs || '') + ' aria-label="수량">' +
      '<button type="button" data-act="step" data-for="' + id + '" data-d="1" aria-label="더하기">+</button></div>';
  };
  App.acts.step = function (el) {
    var inp = document.getElementById(el.getAttribute('data-for'));
    if (!inp) return;
    var min = inp.min === '' ? 0 : +inp.min, max = inp.max === '' ? 99999 : +inp.max;
    var v = Math.max(min, Math.min(max, (parseInt(inp.value, 10) || 0) + (+el.getAttribute('data-d'))));
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  };

  /* ───────── 날짜 빠른 버튼 ───────── */
  App.dateInput = function (id, label, value, quick, inName) {
    var chips = (quick || []).map(function (q) {
      return '<button type="button" class="pill' + (q[1] === value ? ' on' : '') + '" data-act="setval" data-for="' + id + '" data-val="' + q[1] + '">' + esc(q[0]) + '</button>';
    }).join('');
    return '<div class="col gap6"><div class="row between"><span class="small b" style="color:var(--soft)">' + esc(label) + '</span><b id="' + id + '-lab" style="font-size:16px">' + (Core.validDate(value) ? Core.mdDate(value) : '') + '</b></div>' +
      '<div class="pills">' + chips + '</div>' +
      '<label class="f"><span class="xs muted">달력에서 고르기</span><input id="' + id + '" type="date" value="' + esc(value) + '"' + (inName ? ' data-in="' + inName + '"' : '') + '></label></div>';
  };
  App.acts.setval = function (el) {
    var inp = document.getElementById(el.getAttribute('data-for'));
    if (!inp) return;
    inp.value = el.getAttribute('data-val');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  };
  /** 날짜 칸 옆의 큰 날짜 글자와 빠른 버튼 강조를 맞춥니다 */
  App.syncDate = function (id) {
    var inp = document.getElementById(id), lab = document.getElementById(id + '-lab');
    if (!inp) return;
    if (lab) lab.textContent = Core.validDate(inp.value) ? Core.mdDate(inp.value) : '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="setval"][data-for="' + id + '"]'), function (b) { b.classList.toggle('on', b.getAttribute('data-val') === inp.value); });
  };
  App.quickStart = function () {
    var t = App.today();
    return [['오늘', t], ['내일', Core.addDays(t, 1)], ['모레', Core.addDays(t, 2)], ['다음 주 ' + Core.DOW[1], nextDow(t, 1)]];
  };
  function nextDow(t, dow) { var d = Core.addDays(t, 1); while (Core.dow(d) !== dow) d = Core.addDays(d, 1); return d; }
  App.quickDue = function (start) {
    return [['+3일', Core.addDays(start, 3)], ['+1주', Core.addDays(start, 7)], ['+2주', Core.addDays(start, 14)], ['+1달', Core.addDays(start, 30)]];
  };

  /* ───────── 자동완성 ───────── */
  var sug = { box: null, input: null, onPick: null, hl: -1 };
  App.hideSug = function () { if (sug.box) { sug.box.remove(); sug.box = null; } sug.hl = -1; };
  /** input 바로 아래에 후보 목록을 보여 줍니다. items: [{label, sub, value}] */
  App.showSug = function (input, items, onPick) {
    App.hideSug();
    if (!items.length) return;
    sug.input = input; sug.onPick = onPick; sug.hl = -1;
    var box = document.createElement('div');
    box.className = 'sug'; box.setAttribute('role', 'listbox');
    box.innerHTML = items.map(function (it, i) {
      return '<button type="button" role="option" data-act="sugpick" data-i="' + i + '"><span>' + esc(it.label) + '</span>' + (it.sub ? '<span class="xs muted">' + esc(it.sub) + '</span>' : '') + '</button>';
    }).join('');
    box._items = items;
    input.parentNode.appendChild(box);
    sug.box = box;
  };
  App.acts.sugpick = function (el) {
    if (!sug.box) return;
    var it = sug.box._items[+el.getAttribute('data-i')];
    var cb = sug.onPick;
    App.hideSug();
    if (cb) cb(it);
  };
  document.addEventListener('keydown', function (e) {
    if (!sug.box || e.target !== sug.input) return;
    var btns = sug.box.querySelectorAll('button');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sug.hl = (sug.hl + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
      Array.prototype.forEach.call(btns, function (b, i) { b.classList.toggle('hl', i === sug.hl); });
    } else if (e.key === 'Enter' && sug.hl >= 0) { e.preventDefault(); btns[sug.hl].click(); } else if (e.key === 'Escape') App.hideSug();
  });
  document.addEventListener('click', function (e) { if (sug.box && !e.target.closest('.sug') && e.target !== sug.input) App.hideSug(); });

  /** 학교 이름 후보 (초성 가능). 센터 이름이 맨 위 */
  App.schoolHits = function (q) {
    var center = App.S.settings.centerName || '울산창의융합교육센터';
    var all = [center].concat(App.S.schools);
    var hits = [], seen = {};
    all.forEach(function (n) { if (hits.length < 8 && !seen[n] && Core.matchKo(q, n)) { seen[n] = 1; hits.push({ label: n, value: n }); } });
    return hits;
  };

  /* ───────── 서명 칸 ───────── */
  App.sigPad = function (box) {
    var cv = box.querySelector('canvas'), hint = box.querySelector('.hint'), ctx, drawing = false, has = false, last = null;
    function fit() {
      var r = box.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(300, Math.round(r.width * dpr)); cv.height = Math.max(160, Math.round(r.height * dpr));
      ctx = cv.getContext('2d');
      ctx.lineWidth = 3 * dpr; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1B2430';
      has = false; if (hint) hint.hidden = false;
    }
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; }
    cv.addEventListener('pointerdown', function (e) { drawing = true; last = pos(e); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; has = true; if (hint) hint.hidden = true;
      e.preventDefault();
    });
    function end(e) { if (drawing) { drawing = false; if (last && !has) { ctx.beginPath(); ctx.arc(last.x, last.y, 1.5, 0, 6.3); ctx.fill(); has = true; if (hint) hint.hidden = true; } } if (e && e.preventDefault) e.preventDefault(); }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
    fit();
    return {
      clear: fit,
      isEmpty: function () { return !has; },
      dataUrl: function () { return cv.toDataURL('image/png'); }
    };
  };
  App.sigHtml = function (height) {
    return '<div class="sig" id="sigbox" style="height:' + (height || 200) + 'px"><canvas aria-label="서명 칸"></canvas><div class="hint">여기에 손가락으로 서명해 주세요</div></div>';
  };

  /* ───────── 사진 ───────── */
  /** 사진 파일을 긴 변 800px 이하의 작은 JPEG 로 줄여서 글자(dataURL)로 돌려줍니다 */
  App.readPhoto = function (file, maxPx) {
    maxPx = maxPx || 800;
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onerror = function () { reject(new Error('사진을 읽지 못했습니다.')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('사진 형식을 확인해 주세요.')); };
        img.onload = function () {
          var k = Math.min(1, maxPx / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };

  /** 비공개 폴더의 서명·사진을 불러와서 보여 줍니다 */
  App.acts.showfile = function (el) {
    var id = el.getAttribute('data-fid'), box = document.getElementById(el.getAttribute('data-target'));
    if (!id || !box) return;
    el.disabled = true; el.textContent = '불러오는 중…';
    App.api('file', { id: id }).then(function (r) {
      box.innerHTML = '<img src="data:' + r.mime + ';base64,' + r.data + '" alt="" style="max-width:100%;border:1px solid var(--line);border-radius:10px;background:#fff">';
      el.remove();
    }).catch(function (e) { el.disabled = false; el.textContent = '다시 불러오기'; App.toast(e.message, true); });
  };

  /* ───────── 내려받기 (엑셀에서 바로 열리는 CSV) ───────── */
  App.download = function (name, rows) {
    var blob = new Blob(['﻿' + Core.toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  /* ───────── 자주 쓰는 글자 ───────── */
  App.rentalChip = function (r) {
    var map = { '예약됨': 'blue', '대여중': 'green', '반납완료': 'gray', '취소': 'gray', '미수령': 'gray' };
    return '<span class="chip ' + (map[r.status] || 'gray') + '">' + esc(r.status === '대여중' ? '대여 중' : r.status) + '</span>';
  };
  App.who = function (r) { return esc(r.school) + ' · ' + esc(r.teacher); };
  App.telLink = function (phone) {
    return phone ? '<a href="tel:' + esc(String(phone).replace(/[^\d+]/g, '')) + '" class="row gap4" style="display:inline-flex">' + esc(phone) + '</a>' : '<span class="muted">없음</span>';
  };
  App.sum = function (rid, max) { return esc(Core.linesSummary(App.linesOf(rid), App.imap(), max || 2)); };
})();
