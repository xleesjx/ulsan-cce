/* 물품 대장: 목록 · 상세 · 등록/수정 */
(function () {
  'use strict';
  var App = window.App, esc = App.esc, S = App.S;
  var PAGE = 80;

  /** 고른 정렬·보기 방식은 이 기기에 기억해 둡니다 */
  function pref(k, def, allowed) {
    try { var v = localStorage.getItem('ci-' + k); return allowed.indexOf(v) >= 0 ? v : def; } catch (e) { return def; }
  }
  function savePref(k, v) { try { localStorage.setItem('ci-' + k, v); } catch (e) { /* 무시 */ } }
  function ui() {
    return S.ui.it || (S.ui.it = { cat: 'all', q: '', loc: '', grade: '', status: '사용', n: PAGE, sort: pref('sort', 'ko', ['ko', 'id', 'loc']), view: pref('view', 'list', ['list', 'line', 'gal']) });
  }

  function filtered() {
    var u = ui();
    return S.data.items.filter(function (it) {
      return (u.cat === 'all' || it.cat === u.cat) && (!u.loc || it.loc === u.loc) && (!u.grade || it.grade === u.grade) &&
        (u.status === 'all' || it.status === u.status) && (!u.q || Core.matchKo(u.q, it.name + ' ' + it.id));
    });
  }

  /** 수량 표시 정보: 대여용은 '가능 수', 그 밖은 '보유 수' */
  function qtyInfo(it) {
    if (Core.isRentable(it)) {
      var st = Core.itemStats(App.idx(), it, App.today());
      return { rentable: true, st: st, n: Math.max(0, st.avail), total: st.total, cls: st.avail <= 0 ? 'zero' : st.avail < st.total / 3 ? 'low' : 'ok' };
    }
    var low = it.cat === '기본준비물' && it.min && it.qty < it.min;
    return { rentable: false, n: it.qty, total: it.qty, cls: low ? 'low' : 'muted', low: low };
  }

  function lineRow(it) {
    var q = qtyInfo(it);
    return '<button class="crow" data-act="go" data-to="item/' + esc(it.id) + '"><span class="id">' + esc(it.id) + '</span><span class="nm ellip">' + esc(it.name) + '</span>' +
      (it.status === '폐기' ? '<span class="chip gray">폐기</span>' : '') + '<span class="qt ' + (q.rentable ? (q.cls === 'ok' ? 'ok' : 'low') : (q.low ? 'low' : '')) + '">' + (q.rentable ? q.n + '/' + q.total : q.n) + '</span></button>';
  }

  function galCard(it) {
    var q = qtyInfo(it), src = App.photoSrc(it);
    var badge = it.status === '폐기' ? '<span class="gbadge muted">폐기</span>' : '<span class="gbadge ' + (q.cls === 'ok' ? '' : q.cls) + '" title="' + (q.rentable ? '가능 ' + q.n + ' / 보유 ' + q.total : '보유 ' + q.n) + '">' + q.n + '</span>';
    return '<button class="gcard" data-act="go" data-to="item/' + esc(it.id) + '"><div class="gph">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'사진 없음\'))">' : '사진 없음') + badge + '</div><div class="gname">' + esc(it.name) + '</div></button>';
  }

  function row(it) {
    var idx = App.idx(), today = App.today(), rentable = Core.isRentable(it);
    var chips = '';
    var qty;
    if (rentable) {
      var st = Core.itemStats(idx, it, today);
      if (st.out) chips += '<span class="chip blue">대여 중 ' + st.out + '</span>';
      if (st.reserved) chips += '<span class="chip blue">예약 ' + st.reserved + '</span>';
      if (st.repair) chips += '<span class="chip red">수리 ' + st.repair + '</span>';
      qty = '<div class="qtybox"><b class="' + (st.avail <= 0 ? 'low' : st.avail < st.total / 3 ? 'low' : 'ok') + '">' + Math.max(0, st.avail) + '</b><span class="xs muted">가능 / ' + st.total + '</span></div>';
    } else {
      var low = it.cat === '기본준비물' && it.min && it.qty < it.min;
      if (low) chips += '<span class="chip red">부족</span>';
      qty = '<div class="qtybox"><b class="' + (low ? 'low' : '') + '">' + it.qty + '</b><span class="xs muted">보유</span></div>';
    }
    if (it.pub) chips += '<span class="chip gray">공개</span>';
    if (it.status === '폐기') chips += '<span class="chip gray">폐기</span>';
    return '<button class="item" data-act="go" data-to="item/' + esc(it.id) + '">' + App.thumb(it) + '<div class="grow col gap4"><span class="xs muted ellip">' + esc(it.id) + (it.loc ? ' · ' + esc(it.loc) : '') + '</span><b class="ellip" style="font-size:15px">' + esc(it.name) + '</b>' +
      (chips ? '<div class="row gap4 wrap">' + chips + '</div>' : '') + '</div>' + qty + '</button>';
  }

  function drawList() {
    var box = document.getElementById('ilist'), cnt = document.getElementById('icount');
    if (!box) return;
    var u = ui(), all = Core.sortItems(filtered(), u.sort), shown = all.slice(0, u.n);
    var render = u.view === 'gal' ? galCard : u.view === 'line' ? lineRow : row;
    var html = '', last = null, counts = {};
    if (u.sort === 'loc') all.forEach(function (it) { var k = it.loc || '위치 없음'; counts[k] = (counts[k] || 0) + 1; });
    shown.forEach(function (it) {
      if (u.sort === 'loc') {
        var k = it.loc || '위치 없음';
        if (k !== last) { last = k; html += '<div class="grp">' + esc(k) + ' (' + counts[k] + ')</div>'; }
      }
      html += render(it);
    });
    if (!shown.length) html = '';
    box.innerHTML = shown.length ? '<div class="' + (u.view === 'gal' ? 'gal' : 'list') + '">' + html + '</div>' : '<div class="empty">조건에 맞는 물품이 없습니다.</div>';
    if (all.length > shown.length) box.innerHTML += '<button class="btn mt12" style="width:100%" data-act="moreitems">더 보기 (' + (all.length - shown.length) + '개 더 있어요)</button>';
    if (cnt) cnt.textContent = all.length + '개';
  }

  function options(list, cur, allLabel) {
    return '<option value="">' + allLabel + '</option>' + list.map(function (v) { return '<option' + (v === cur ? ' selected' : '') + ' value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
  }
  function uniq(arr) { var seen = {}; return arr.filter(function (v) { if (!v || seen[v]) return false; seen[v] = 1; return true; }).sort(); }

  App.views.items = function () {
    var u = ui();
    var counts = { all: 0 };
    S.data.items.forEach(function (i) { if (i.status !== '폐기') { counts.all++; counts[i.cat] = (counts[i.cat] || 0) + 1; } });
    var locs = uniq(S.data.items.map(function (i) { return i.loc; }).concat(S.settings.locs || []));
    var grades = uniq(S.data.items.map(function (i) { return i.grade; }));
    var h = '<div class="page"><div class="top"><div class="row between"><h1>물품 대장</h1><button class="btn primary sm" data-act="go" data-to="item/new">+ 물품 등록</button></div>' +
      '<label class="f" style="position:relative"><span style="position:absolute;left:-9999px">물품 검색</span><input id="iq" data-in="iq" type="search" value="' + esc(u.q) + '" placeholder="품명이나 관리번호로 검색 (초성도 돼요)" autocomplete="off" style="padding-left:12px"></label>' +
      '<div class="pills" role="group" aria-label="분류">' + [['all', '전체']].concat(Core.CATS.map(function (c) { return [c, c]; })).map(function (c) {
        return '<button class="pill' + (u.cat === c[0] ? ' on dark' : '') + '" data-act="icat" data-v="' + c[0] + '" aria-pressed="' + (u.cat === c[0]) + '">' + c[1] + ' ' + (counts[c[0]] || 0) + '</button>';
      }).join('') + '</div>' +
      '<div class="grid2" style="grid-template-columns:repeat(3,minmax(0,1fr))"><label class="f"><span class="xs">위치</span><select data-ch="ifilter" data-k="loc">' + options(locs, u.loc, '전체') + '</select></label>' +
      '<label class="f"><span class="xs">학년</span><select data-ch="ifilter" data-k="grade">' + options(grades, u.grade, '전체') + '</select></label>' +
      '<label class="f"><span class="xs">상태</span><select data-ch="ifilter" data-k="status"><option value="사용"' + (u.status === '사용' ? ' selected' : '') + '>사용 중</option><option value="폐기"' + (u.status === '폐기' ? ' selected' : '') + '>폐기</option><option value="all"' + (u.status === 'all' ? ' selected' : '') + '>전체</option></select></label></div>' +
      '<div class="viewbar"><select data-ch="isort" aria-label="정렬">' + [['ko', '가나다순'], ['id', '관리번호순'], ['loc', '위치별']].map(function (o) { return '<option value="' + o[0] + '"' + (u.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<div class="seg" role="group" aria-label="보기 방식">' + [['list', '목록'], ['line', '한 줄'], ['gal', '갤러리']].map(function (o) { return '<button data-act="iview" data-v="' + o[0] + '" class="' + (u.view === o[0] ? 'on' : '') + '" aria-pressed="' + (u.view === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="row between"><span class="small muted" id="icount"></span><button class="btn sm" data-act="itemcsv">' + App.icon('down', 16) + ' 목록표 내려받기</button></div></div>' +
      '<div class="body"><div id="ilist"></div></div></div>';
    return { html: h, tab: 'items', after: drawList };
  };

  App.acts.icat = function (el) { var u = ui(); u.cat = el.getAttribute('data-v'); u.n = PAGE; App.render(); };
  App.acts.moreitems = function () { ui().n += PAGE; drawList(); };
  App.acts.iview = function (el) { var u = ui(); u.view = el.getAttribute('data-v'); u.n = PAGE; savePref('view', u.view); App.render(); };
  App.chs.isort = function (el) { var u = ui(); u.sort = el.value; u.n = PAGE; savePref('sort', u.sort); drawList(); };
  App.ins.iq = function (el) { var u = ui(); u.q = el.value; u.n = PAGE; drawList(); };
  App.chs.ifilter = function (el) { var u = ui(); u[el.getAttribute('data-k')] = el.value; u.n = PAGE; drawList(); };
  App.acts.itemcsv = function () {
    var rows = [['관리번호', '분류', '품명', '대상학년', '영역', '구입연도', '보유수량', '보관위치', '세부위치', '상태', '외부공개', '호응', '설명', '비고']];
    Core.sortItems(filtered(), ui().sort).forEach(function (i) { rows.push([i.id, i.cat, i.name, i.grade, i.area, i.year, i.qty, i.loc, i.subloc, i.status, i.pub ? '공개' : '', i.like, i.desc, i.note]); });
    App.download('물품목록_' + App.today() + '.csv', rows);
  };

  /* ───────── 상세 ───────── */

  App.views.itemDetail = function (id) {
    var it = App.imap()[id];
    if (!it) return { html: App.appbar('물품', 'items') + '<div class="empty">없는 물품입니다.</div>', tab: 'items' };
    var idx = App.idx(), today = App.today(), rentable = Core.isRentable(it);
    var h = '<div class="page">' + App.appbar(it.id + ' ' + it.name, 'items', '<button class="textbtn" data-act="go" data-to="item/' + esc(it.id) + '/edit">수정</button>') + '<div class="body">' + App.thumb(it, true);

    if (rentable) {
      var st = Core.itemStats(idx, it, today);
      var tot = Math.max(1, st.total);
      h += '<section class="card"><div class="row between"><h2>수량</h2><span class="small muted">보유 ' + st.total + (it.cat === 'SW교재' ? '권' : '개') + '</span></div>' +
        '<div class="qbar" role="img" aria-label="가능 ' + st.avail + ', 대여 중 ' + st.out + ', 수리 ' + st.repair + '"><i style="flex:' + Math.max(0, st.avail) + ';background:var(--green)"></i><i style="flex:' + st.out + ';background:var(--blue)"></i><i style="flex:' + st.repair + ';background:#C2410C"></i></div>' +
        '<div class="qgrid"><div><span class="muted">오늘 가능</span><b style="color:var(--green)">' + Math.max(0, st.avail) + '</b></div><div><span class="muted">대여 중</span><b style="color:var(--blue-ink)">' + st.out + '</b></div><div><span class="muted">앞으로 예약</span><b>' + st.reserved + '</b></div><div><span class="muted">수리 대기</span><b style="color:var(--red)">' + st.repair + '</b></div></div></section>';
    } else {
      var low = it.cat === '기본준비물' && it.min && it.qty < it.min;
      h += '<section class="card"><div class="row between"><h2>수량</h2><b style="font-size:22px;color:' + (low ? 'var(--red)' : 'inherit') + '">' + it.qty + '</b></div>' +
        (it.cat === '기본준비물' ? '<span class="small ' + (low ? '' : 'muted') + '" style="' + (low ? 'color:var(--red);font-weight:700' : '') + '">부족 기준 ' + (it.min || '없음') + (low ? ' · 기준보다 적어요' : '') + '</span>' : '') + '</section>';
    }

    h += '<section class="card flush">' +
      kv('분류', it.cat) + kv('보관위치', [it.loc, it.subloc].filter(Boolean).join(' · ') || '-') + kv('대상 학년', it.grade || '-') + kv('영역', it.area || '-') + kv('구입연도', (it.year || '-').replace(/\n/g, ', ')) +
      (it.like ? kv('호응', it.like) : '') + kv('상태', it.status) +
      (rentable ? '<div class="kv" style="align-items:center"><span>외부 공개 목록에 표시</span><button class="switch' + (it.pub ? ' on' : '') + '" role="switch" aria-checked="' + !!it.pub + '" aria-label="외부 공개" data-act="pubtoggle" data-id="' + esc(it.id) + '"></button></div>' : '') + '</section>';
    if (it.desc) h += '<section class="card"><h2>설명</h2><p style="margin:0;white-space:pre-line;color:var(--soft);font-size:14px;line-height:1.6">' + esc(it.desc) + '</p></section>';

    if (rentable) {
      var rm = App.rmap(), rows = [];
      S.data.lines.forEach(function (l) { if (l.item === it.id && rm[l.rid]) rows.push({ r: rm[l.rid], l: l }); });
      rows = rows.filter(function (x) { return x.r.status !== '취소' && x.r.status !== '미수령'; }).sort(function (a, b) { return b.r.start.localeCompare(a.r.start); });
      var total = rows.filter(function (x) { return x.r.status === '반납완료' || x.r.status === '대여중'; }).length;
      h += '<section class="card"><div class="row between"><h2>대여 기록</h2><span class="small muted">' + total + '회</span></div>';
      if (!rows.length) h += '<span class="muted small">대여 기록이 없습니다.</span>';
      rows.slice(0, 8).forEach(function (x) {
        h += '<button class="ev" style="padding:8px 0" data-act="go" data-to="rental/' + esc(x.r.id) + '"><div class="main"><div class="row between"><span class="t" style="font-size:14px">' + App.who(x.r) + '</span>' + App.rentalChip(x.r) + '</div><span class="s">' + x.l.qty + '개 · ' + esc(Core.shortDate(x.r.start)) + ' ~ ' + esc(Core.shortDate(x.r.due)) + '</span></div></button>';
      });
      if (it.past) h += '<details><summary class="small muted" style="cursor:pointer">과거 활용기록 (엑셀에서 옮김)</summary><p class="small" style="white-space:pre-line;margin:6px 0 0">' + esc(it.past) + '</p></details>';
      h += '</section>';
      var reps = S.data.repairs.filter(function (r) { return r.item === it.id; }).sort(function (a, b) { return b.date.localeCompare(a.date); });
      if (reps.length) {
        h += '<section class="card"><h2>수리·분실 기록</h2>' + reps.slice(0, 6).map(function (r) {
          return '<div class="row between small"><span>' + esc(r.date) + ' · ' + esc(r.kind) + ' ' + r.qty + '개' + (r.note ? ' · ' + esc(r.note) : '') + '</span><span class="chip ' + (r.status === '대기' ? 'red' : 'gray') + '">' + esc(r.status) + '</span></div>';
        }).join('') + '</section>';
      }
    }
    h += '</div></div>';
    if (rentable) h += '<div class="bar-bottom"><div class="in"><button class="btn primary block lg" data-act="go" data-to="rental/new?item=' + esc(it.id) + '">이 교구로 대여 등록</button></div></div>';
    return { html: h, tab: 'items' };
  };
  function kv(k, v) { return '<div class="kv"><span>' + esc(k) + '</span><span>' + esc(v) + '</span></div>'; }

  App.acts.pubtoggle = function (el) {
    var it = App.imap()[el.getAttribute('data-id')];
    if (!it) return;
    var next = Object.assign({}, it, { pub: !it.pub });
    App.run(el, function () {
      return App.api('itemSave', { item: next }).then(function (r) { App.apply(r); App.toast(next.pub ? '외부 공개 목록에 표시합니다.' : '외부 공개에서 뺐습니다.'); App.render(); });
    });
  };

  /* ───────── 등록·수정 ───────── */

  App.views.itemForm = function (id, route) {
    var it = id ? App.imap()[id] : null;
    if (id && !it) return { html: App.appbar('물품', 'items') + '<div class="empty">없는 물품입니다.</div>', tab: 'items' };
    var v = it || { cat: ui().cat !== 'all' ? ui().cat : '창의교구', name: '', photo: '', desc: '', grade: '', area: '', year: '', qty: 1, loc: '', subloc: '', status: '사용', pub: false, like: '', past: '', note: '', min: 0 };
    var locs = uniq(S.data.items.map(function (i) { return i.loc; }).concat(S.settings.locs || []));
    function inp(name, label, val, extra) { return '<label class="f">' + label + '<input name="' + name + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (extra || '') + '></label>'; }
    var h = '<div class="page">' + App.appbar(it ? '물품 수정 · ' + it.id : '물품 등록', it ? 'item/' + it.id : 'items') + '<form id="iform" class="body" onsubmit="return false">' +
      '<section class="card">' +
      '<label class="f">분류<select name="cat"' + (it ? ' disabled' : '') + '>' + Core.CATS.map(function (c) { return '<option' + (c === v.cat ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>' +
      inp('name', '품명', v.name, 'required') +
      '<div class="grid2">' + inp('qty', '보유수량', v.qty, 'type="number" inputmode="numeric" min="0"') + inp('min', '부족 기준 (준비물)', v.min || '', 'type="number" inputmode="numeric" min="0" placeholder="없으면 비워 두세요"') + '</div>' +
      '<div class="grid2"><label class="f">보관위치<input name="loc" list="locs" value="' + esc(v.loc) + '"><datalist id="locs">' + locs.map(function (l) { return '<option value="' + esc(l) + '">'; }).join('') + '</datalist></label>' + inp('subloc', '세부위치 (선반·상자 등)', v.subloc) + '</div>' +
      '<div class="grid2">' + inp('grade', '대상 학년 (저·중·고·전체)', v.grade) + inp('area', '영역 (수학·놀이·SW…)', v.area) + '</div>' +
      '<div class="grid2">' + inp('year', '구입연도', (v.year || '').replace(/\n/g, ', ')) + inp('like', '호응 (상·중·하)', v.like) + '</div>' +
      '<label class="f">사진 <span class="xs muted">파일 이름(예: ' + esc(it ? it.id : 'S-001') + '.jpg) 또는 인터넷 이미지 주소</span><input name="photo" value="' + esc(v.photo) + '" placeholder="없으면 비워 두세요"></label>' +
      '<label class="f">설명<textarea name="desc">' + esc(v.desc) + '</textarea></label>' +
      '<label class="f">비고<input name="note" value="' + esc(v.note) + '"></label>' +
      '<label class="f">과거 활용기록<textarea name="past" style="min-height:60px">' + esc(v.past) + '</textarea></label>' +
      '<div class="grid2"><label class="f">상태<select name="status"><option' + (v.status === '사용' ? ' selected' : '') + '>사용</option><option' + (v.status === '폐기' ? ' selected' : '') + '>폐기</option></select></label>' +
      '<label class="f">외부 공개 목록에 표시<select name="pub"><option value="">표시 안 함</option><option value="Y"' + (v.pub ? ' selected' : '') + '>표시함</option></select></label></div>' +
      '</section></form></div>' +
      '<div class="bar-bottom"><div class="in"><button class="btn primary block lg" data-act="saveitem" data-id="' + esc(id || '') + '">저장</button></div></div>';
    return { html: h, tab: 'items' };
  };

  App.acts.saveitem = function (el) {
    var f = document.getElementById('iform'), id = el.getAttribute('data-id');
    var g = function (n) { var e = f.elements[n]; return e ? e.value : ''; };
    var item = { id: id || undefined, cat: id ? App.imap()[id].cat : g('cat'), name: g('name'), qty: g('qty') === '' ? 0 : +g('qty'), min: g('min'), loc: g('loc'), subloc: g('subloc'), grade: g('grade'), area: g('area'), year: g('year'), like: g('like'),
      photo: g('photo'), desc: g('desc'), note: g('note'), past: g('past'), status: g('status'), pub: g('pub') === 'Y' };
    App.run(el, function () {
      return App.api('itemSave', { item: item }).then(function (r) { App.apply(r); App.toast('저장했습니다.'); App.go('item/' + r.items[0].id, null, false); });
    });
  };
})();
