/*
 * 창의센터 물품·시설 관리 — Apps Script (저장·검사 서버)
 * 구글 시트에 붙어 있는 스크립트입니다. 웹앱으로 배포하면 GitHub Pages 화면이 이 주소로 요청을 보냅니다.
 * 스크립트 속성: CLIENT_ID (구글 로그인 클라이언트 ID)
 * 규칙 계산은 Core.gs 와 공유합니다 (docs/core.js 를 그대로 복사한 파일).
 */

var TZ = 'Asia/Seoul';
var SHEET = {
  ITEMS: '물품', RENTALS: '대여', LINES: '대여품목', REPAIRS: '수리', ROOMS: '교실', RES: '교실예약',
  INSPECT: '점검', STAFF: '직원', SETTINGS: '설정', LOG: '변경기록', PROG: '센터사용'
};

/* 시트 칸 구성: [화면에서 쓰는 이름, 시트 맨 윗줄 제목] */
var SCHEMA = {};
SCHEMA['물품'] = [['id', '관리번호'], ['cat', '분류'], ['name', '품명'], ['photo', '사진'], ['desc', '설명'], ['grade', '대상학년'], ['area', '영역'],
  ['year', '구입연도'], ['qty', '보유수량'], ['loc', '보관위치'], ['subloc', '세부위치'], ['status', '상태'], ['pub', '외부공개'], ['like', '호응'],
  ['past', '과거활용기록'], ['note', '비고'], ['min', '부족기준']];
SCHEMA['대여'] = [['id', '대여번호'], ['school', '학교'], ['teacher', '선생님'], ['phone', '연락처'], ['start', '대여일'], ['due', '반납예정일'], ['status', '상태'],
  ['docOk', '공문확인'], ['docNo', '공문번호'], ['staff', '접수직원'], ['createdAt', '접수시각'], ['handedAt', '내준날'], ['handedBy', '내준직원'],
  ['sign', '서명파일'], ['returnedAt', '반납완료일'], ['memo', '메모']];
SCHEMA['대여품목'] = [['rid', '대여번호'], ['item', '관리번호'], ['qty', '수량'], ['ok', '정상반납'], ['broken', '고장'], ['lost', '분실'], ['note', '반납메모'], ['photo', '사진파일']];
SCHEMA['수리'] = [['id', '수리번호'], ['item', '관리번호'], ['qty', '수량'], ['kind', '구분'], ['date', '발생일'], ['rid', '대여번호'], ['note', '메모'],
  ['photo', '사진파일'], ['status', '상태'], ['doneAt', '처리일']];
SCHEMA['교실'] = [['name', '교실'], ['short', '약자'], ['order', '순서'], ['priority', '수업우선']];
SCHEMA['교실예약'] = [['id', '예약번호'], ['room', '교실'], ['kind', '종류'], ['date', '날짜'], ['start', '시작'], ['end', '끝'], ['purpose', '사용목적'],
  ['person', '담당자'], ['org', '소속'], ['mobile', '휴대전화'], ['office', '사무실전화'], ['docOk', '공문확인'], ['docNo', '공문번호'], ['note', '비고'],
  ['status', '상태'], ['staff', '등록자'], ['createdAt', '등록시각']];
SCHEMA['점검'] = [['round', '회차'], ['rdate', '회차날짜'], ['target', '대상'], ['kind', '구분'], ['result', '결과'], ['count', '확인수량'], ['note', '메모'], ['by', '점검자'], ['at', '점검시각']];
SCHEMA['직원'] = [['email', '이메일'], ['name', '이름'], ['role', '역할']];
SCHEMA['설정'] = [['key', '항목'], ['value', '값'], ['hint', '설명']];
SCHEMA['센터사용'] = [['id', '번호'], ['name', '프로그램'], ['start', '시작일'], ['end', '끝일'], ['item', '관리번호'], ['qty', '수량'], ['note', '비고'], ['status', '상태'], ['staff', '등록자'], ['createdAt', '등록시각']];
SCHEMA['변경기록'] = [['at', '시각'], ['who', '직원'], ['action', '작업'], ['target', '대상'], ['detail', '내용']];

var NUM_KEYS = { qty: 1, ok: 1, broken: 1, lost: 1, min: 1, order: 1, count: 1 };
var BOOL_KEYS = { pub: 1, docOk: 1, priority: 1 };
var MEMO = {};
var META = {};

/* ───────── 진입점 ───────── */

function doGet() {
  return ContentService.createTextOutput('창의센터 물품·시설 관리 서버가 동작 중입니다.');
}

function doPost(e) {
  var out;
  MEMO = {}; META = {};
  try {
    var req = JSON.parse(e.postData.contents);
    var user = authenticate_(req.token);
    var fn = API[req.action];
    if (!fn) throw apiError_('BAD_ACTION', '알 수 없는 요청입니다.');
    out = fn(req, user);
    out.ok = true;
  } catch (err) {
    out = { ok: false, code: err.code || 'ERROR', error: err.code ? err.message : '서버 오류: ' + err.message };
    if (err.extra) out.extra = err.extra;
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function apiError_(code, msg, extra) { var e = new Error(msg); e.code = code; if (extra) e.extra = extra; return e; }
function bad_(msg, extra) { return apiError_('INVALID', msg, extra); }

/* ───────── 로그인 확인 ───────── */

function authenticate_(token) {
  if (!token) throw apiError_('AUTH', '로그인이 필요합니다.');
  var cache = CacheService.getScriptCache();
  var ck = 'tk_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var email = cache.get(ck);
  if (!email) {
    var clientId = PropertiesService.getScriptProperties().getProperty('CLIENT_ID');
    if (!clientId) throw apiError_('SETUP', '스크립트 속성 CLIENT_ID가 없습니다. 설치 안내서를 확인하세요.');
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw apiError_('AUTH', '로그인이 만료되었습니다. 다시 로그인해 주세요.');
    var info = JSON.parse(res.getContentText());
    var exp = +info.exp * 1000;
    var okIss = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
    var verified = info.email_verified === true || info.email_verified === 'true';
    if (info.aud !== clientId || !okIss || !verified || exp < Date.now()) throw apiError_('AUTH', '로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');
    email = String(info.email).toLowerCase();
    var ttl = Math.min(3600, Math.floor((exp - Date.now()) / 1000) - 30);
    if (ttl > 30) cache.put(ck, email, ttl);
  }
  var staff = null;
  table_(SHEET.STAFF).rows.forEach(function (r) { if (Core.str(r.email).toLowerCase() === email) staff = r; });
  if (!staff) throw apiError_('FORBIDDEN', email + ' 계정은 직원으로 등록되어 있지 않습니다. 시트의 [직원] 탭에 추가해 주세요.');
  return { email: email, name: Core.str(staff.name) || email.split('@')[0], role: Core.str(staff.role) };
}

/* ───────── 시트 읽기·쓰기 ───────── */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    var h = SCHEMA[name].map(function (p) { return p[1]; });
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function cellText_(v) {
  if (v instanceof Date) {
    if (v.getFullYear() < 1950) return Utilities.formatDate(v, TZ, 'HH:mm'); // 시간만 적은 칸
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  return v === null || v === undefined ? '' : String(v).trim();
}

function conv_(key, v) {
  if (BOOL_KEYS[key]) return v === true || String(v).trim().toUpperCase() === 'Y';
  if (NUM_KEYS[key]) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
  return cellText_(v);
}

/** 수식으로 해석될 수 있는 값은 글자로 저장 (수식 삽입 방지) */
function safeCell_(v) {
  var s = v === null || v === undefined ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function out_(key, v) {
  if (BOOL_KEYS[key]) return v ? 'Y' : '';
  if (NUM_KEYS[key]) return v === '' || v === null || v === undefined ? '' : String(parseInt(v, 10) || 0);
  return safeCell_(v);
}

/** 시트 한 장을 읽어 객체 목록으로. 요청 하나 안에서는 한 번만 읽습니다 */
function table_(name) {
  if (MEMO[name]) return MEMO[name];
  var sh = sheet_(name);
  var vals = sh.getDataRange().getValues();
  var header = (vals[0] || []).map(cellText_);
  var cols = {};
  header.forEach(function (h, i) { cols[h] = i; });
  var rows = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    var o = { _row: r + 1 };
    SCHEMA[name].forEach(function (p) { var i = cols[p[1]]; o[p[0]] = conv_(p[0], i === undefined ? '' : row[i]); });
    rows.push(o);
  }
  MEMO[name] = { rows: rows, header: header, cols: cols };
  return MEMO[name];
}

/** 머리글 한 줄만 읽기: 맨 아래에 줄을 추가할 때 시트 전체를 읽지 않으려고 씁니다 */
function meta_(name) {
  if (MEMO[name]) return MEMO[name];
  if (META[name]) return META[name];
  var sh = sheet_(name);
  var header = sh.getRange(1, 1, 1, Math.max(sh.getMaxColumns(), 1)).getValues()[0].map(cellText_);
  while (header.length && header[header.length - 1] === '') header.pop();
  var cols = {};
  header.forEach(function (h, i) { cols[h] = i; });
  return (META[name] = { header: header, cols: cols });
}

/** 한 줄 저장 (새 줄이면 맨 아래에 추가) */
function put_(name, o) {
  var t = o._row ? table_(name) : meta_(name), sh = sheet_(name), n = Math.max(t.header.length, 1);
  var row;
  if (o._row) row = sh.getRange(o._row, 1, 1, n).getValues()[0];
  else { row = []; for (var i = 0; i < n; i++) row.push(''); }
  SCHEMA[name].forEach(function (p) { var ci = t.cols[p[1]]; if (ci !== undefined) row[ci] = out_(p[0], o[p[0]]); });
  var target = o._row || (Math.max(sh.getLastRow(), 1) + 1);
  var rg = sh.getRange(target, 1, 1, n);
  rg.setNumberFormat('@');
  rg.setValues([row]);
  if (!o._row) { o._row = target; if (t.rows) t.rows.push(o); else if (MEMO[name]) MEMO[name].rows.push(o); }
  return o;
}

function removeRows_(name, objs) {
  if (!objs.length) return;
  var sh = sheet_(name);
  objs.map(function (o) { return o._row; }).sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  delete MEMO[name]; // 줄 번호가 바뀌었으니 다시 읽게 합니다
}

function plain_(o) { var c = {}; for (var k in o) if (k !== '_row') c[k] = o[k]; return c; }
function plainAll_(rows) { return rows.map(plain_); }

function rows_(name, keyField) { return table_(name).rows.filter(function (r) { return r[keyField || 'id'] !== ''; }); }

function load_() {
  return {
    items: rows_(SHEET.ITEMS), rentals: rows_(SHEET.RENTALS), lines: rows_(SHEET.LINES, 'rid'), repairs: rows_(SHEET.REPAIRS),
    rooms: rows_(SHEET.ROOMS, 'name'), reservations: rows_(SHEET.RES), programs: rows_(SHEET.PROG)
  };
}

function settings_() {
  var m = {};
  table_(SHEET.SETTINGS).rows.forEach(function (r) { if (r.key) m[r.key] = r.value; });
  var locs = (m['보관위치'] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  return {
    returnDays: parseInt(m['반납기본일수'], 10) || 7,
    maskDays: parseInt(m['연락처보관일수'], 10) || 365,
    locs: locs, centerName: m['센터이름'] || '울산창의융합교육센터', centerPhone: m['센터전화'] || '',
    programBuffer: isNaN(parseInt(m['센터사용여유일수'], 10)) ? 7 : Math.max(0, parseInt(m['센터사용여유일수'], 10)),
    programQty: parseInt(m['센터사용기본수량'], 10) > 0 ? parseInt(m['센터사용기본수량'], 10) : 18
  };
}

function today_() { return Core.todayStr(); }

function bumpRev_() {
  var p = PropertiesService.getScriptProperties();
  var rev = String((+p.getProperty('REV') || 0) + 1);
  p.setProperty('REV', rev);
  return rev;
}

/** 쓰기 작업은 한 번에 한 사람씩. 끝나면 변경 번호를 올립니다 */
function write_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('BUSY', '다른 선생님의 작업을 처리하는 중입니다. 잠시 후 다시 시도해 주세요.');
  try {
    var out = fn();
    out.rev = bumpRev_();
    return out;
  } finally { lock.releaseLock(); }
}

function log_(user, action, target, detail) {
  put_(SHEET.LOG, { at: Core.nowStr(), who: user.name, action: action, target: target, detail: detail || '' });
}

/* ───────── 입력 정리 ───────── */

function s_(v, max) { var t = Core.str(v); return max && t.length > max ? t.slice(0, max) : t; }
function date_(v, label) { var t = Core.str(v); if (!Core.validDate(t)) throw bad_(label + ' 날짜를 확인해 주세요.'); return t; }
function time_(v, label) {
  var t = Core.str(v);
  if (t && !Core.validTime(t)) throw bad_(label + ' 시간은 13:30 처럼 적어 주세요.');
  return t;
}
function pickEnum_(v, list, label) { if (list.indexOf(v) < 0) throw bad_(label + ' 값을 확인해 주세요.'); return v; }

function normLines_(arr) {
  if (!arr || !arr.length) throw bad_('빌려줄 교구를 한 가지 이상 골라 주세요.');
  return arr.map(function (l) {
    var q = Number(l.qty);
    if (!isFinite(q) || q !== Math.floor(q)) throw bad_('수량은 정수로 입력해 주세요.');
    return { item: s_(l.item, 20), qty: q };
  });
}

/* ───────── 이미지 (서명·사진) ───────── */

function folder_(key, name) {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* 아래에서 새로 만듭니다 */ } }
  var f = DriveApp.createFolder(name);
  p.setProperty(key, f.getId());
  return f;
}

function saveImage_(dataUrl, kind, label) {
  if (!dataUrl) return '';
  var m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+\/=]+)$/.exec(String(dataUrl));
  if (!m) throw bad_('이미지 형식을 확인해 주세요.');
  if (m[2].length > 2500000) throw bad_('이미지가 너무 큽니다.');
  var ext = m[1] === 'image/png' ? '.png' : '.jpg';
  var f = kind === 'sign' ? folder_('FOLDER_SIGN', '창의센터앱_서명(비공개)') : folder_('FOLDER_PHOTO', '창의센터앱_반납사진(비공개)');
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], label.replace(/[\\\/:*?"<>|]/g, '_') + ext);
  return f.createFile(blob).getId();
}

/* ───────── API ───────── */

var API = {};

API.rev = function () {
  return { rev: PropertiesService.getScriptProperties().getProperty('REV') || '0' };
};

API.boot = function (req, user) {
  ensureSettings_();
  housekeeping_();
  var d = load_();
  return {
    user: user, today: today_(), settings: settings_(), sheetUrl: ss_().getUrl(),
    rev: PropertiesService.getScriptProperties().getProperty('REV') || '0',
    staff: plainAll_(rows_(SHEET.STAFF, 'email')),
    items: plainAll_(d.items), rentals: plainAll_(d.rentals), lines: plainAll_(d.lines), repairs: plainAll_(d.repairs), programs: plainAll_(d.programs),
    rooms: plainAll_(d.rooms).sort(function (a, b) { return a.order - b.order; }), reservations: plainAll_(d.reservations)
  };
};

/** 새 설정 항목이 시트에 없으면 한 번만 추가합니다 (이전 버전에서 올린 시트를 위해) */
function ensureSettings_() {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('SETTINGS_VER') === '2') return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var have = {};
    rows_(SHEET.SETTINGS, 'key').forEach(function (r) { have[r.key] = 1; });
    [['센터사용기본수량', '18', '센터 프로그램에서 교구마다 기본으로 잡아 둘 수량 (정원 16명 + 여유 2)'],
      ['센터사용여유일수', '7', '센터 프로그램 앞뒤로 대여를 막는 날 수 (준비·점검 기간)']].forEach(function (r) {
      if (!have[r[0]]) put_(SHEET.SETTINGS, { key: r[0], value: r[1], hint: r[2] });
    });
    p.setProperty('SETTINGS_VER', '2');
    delete MEMO[SHEET.SETTINGS];
  } finally { lock.releaseLock(); }
}

/** 하루에 한 번: 보관 기간이 지난 연락처를 지웁니다 */
function housekeeping_() {
  var p = PropertiesService.getScriptProperties(), today = today_();
  if (p.getProperty('MASK_DAY') === today) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var days = settings_().maskDays;
    rows_(SHEET.RENTALS).forEach(function (r) { if (Core.needsMaskRental(r, today, days)) { r.phone = ''; put_(SHEET.RENTALS, r); } });
    rows_(SHEET.RES).forEach(function (v) { if (Core.needsMaskRes(v, today, days)) { v.mobile = ''; v.office = ''; put_(SHEET.RES, v); } });
    p.setProperty('MASK_DAY', today);
  } finally { lock.releaseLock(); }
}

/* ----- 물품 ----- */

API.itemSave = function (req, user) {
  return write_(function () {
    var d = load_(), inp = req.item || {};
    var cat = pickEnum_(inp.cat, Core.CATS, '분류');
    var name = s_(inp.name, 100);
    if (!name) throw bad_('품명을 입력해 주세요.');
    var qty = Number(inp.qty);
    if (!isFinite(qty) || qty < 0 || qty !== Math.floor(qty)) throw bad_('보유수량은 0 이상의 정수로 입력해 주세요.');
    var o = null;
    if (inp.id) {
      d.items.forEach(function (i) { if (i.id === inp.id) o = i; });
      if (!o) throw bad_('없는 물품입니다.');
    } else {
      o = { id: Core.nextItemId(d.items, cat) };
    }
    o.cat = cat; o.name = name; o.photo = s_(inp.photo, 500); o.desc = s_(inp.desc, 2000);
    o.grade = s_(inp.grade, 20); o.area = s_(inp.area, 30); o.year = s_(inp.year, 30); o.qty = qty;
    o.loc = s_(inp.loc, 50); o.subloc = s_(inp.subloc, 100);
    o.status = pickEnum_(inp.status || '사용', ['사용', '폐기'], '상태');
    o.pub = !!inp.pub; o.like = s_(inp.like, 20); o.past = s_(inp.past, 500); o.note = s_(inp.note, 500);
    o.min = Math.max(0, parseInt(inp.min, 10) || 0);
    var isNew = !o._row;
    put_(SHEET.ITEMS, o);
    log_(user, isNew ? '물품 등록' : '물품 수정', o.id, o.name);
    return { items: [plain_(o)] };
  });
};

/* ----- 교구 대여 ----- */

function rentalInput_(req, today) {
  var school = s_(req.school, 60), teacher = s_(req.teacher, 30);
  if (!school) throw bad_('학교를 입력해 주세요.');
  if (!teacher) throw bad_('선생님 이름을 입력해 주세요.');
  var start = date_(req.start, '대여일'), due = date_(req.due, '반납 예정일');
  if (due < start) throw bad_('반납 예정일이 대여일보다 빠릅니다.');
  return { school: school, teacher: teacher, phone: Core.fmtPhone(s_(req.phone, 30)), start: start, due: due, memo: s_(req.memo, 300), lines: normLines_(req.lines) };
}

function linesOf_(d, rid) { return d.lines.filter(function (l) { return l.rid === rid; }); }
function findBy_(rows, key, val) { var f = null; rows.forEach(function (r) { if (r[key] === val) f = r; }); return f; }

function checkOrThrow_(d, lines, start, due, excludeRid, today) {
  var chk = Core.checkLines(d, Core.makeIndex(d, { buffer: settings_().programBuffer }), lines, start, due, excludeRid, today);
  if (chk.errors.length) throw apiError_('SHORT', chk.errors.join('\n'), { short: chk.short });
}

function writeLines_(d, rid, lines) {
  removeRows_(SHEET.LINES, linesOf_(d, rid));
  d.lines = rows_(SHEET.LINES, 'rid');
  lines.forEach(function (l) {
    var o = { rid: rid, item: l.item, qty: l.qty, ok: l.ok || 0, broken: l.broken || 0, lost: l.lost || 0, note: l.note || '', photo: l.photo || '' };
    put_(SHEET.LINES, o);
  });
  d.lines = rows_(SHEET.LINES, 'rid');
  return linesOf_(d, rid);
}

API.rentalCreate = function (req, user) {
  return write_(function () {
    var today = today_(), d = load_(), inp = rentalInput_(req, today);
    checkOrThrow_(d, inp.lines, inp.start, inp.due, '', today);
    var year = inp.start.slice(0, 4);
    var r = {
      id: Core.nextYearId('R', year, d.rentals.map(function (x) { return x.id; })), school: inp.school, teacher: inp.teacher, phone: inp.phone,
      start: inp.start, due: inp.due, status: '예약됨', docOk: false, docNo: '', staff: user.name, createdAt: Core.nowStr(), handedAt: '', handedBy: '',
      sign: '', returnedAt: '', memo: inp.memo
    };
    put_(SHEET.RENTALS, r);
    d.rentals.push(r);
    var lines = writeLines_(d, r.id, inp.lines);
    log_(user, '대여 예약', r.id, r.school + ' ' + r.teacher);
    return { rentals: [plain_(r)], linesFor: (function () { var o = {}; o[r.id] = plainAll_(lines); return o; })() };
  });
};

API.rentalEdit = function (req, user) {
  return write_(function () {
    var today = today_(), d = load_(), r = findBy_(d.rentals, 'id', req.id);
    if (!r) throw bad_('없는 대여 건입니다.');
    if (r.status !== '예약됨') throw bad_('예약 상태인 건만 고칠 수 있습니다.');
    var inp = rentalInput_(req, today);
    checkOrThrow_(d, inp.lines, inp.start, inp.due, r.id, today);
    r.school = inp.school; r.teacher = inp.teacher; r.phone = inp.phone; r.start = inp.start; r.due = inp.due; r.memo = inp.memo;
    put_(SHEET.RENTALS, r);
    var lines = writeLines_(d, r.id, inp.lines);
    log_(user, '대여 수정', r.id, r.school + ' ' + r.teacher);
    var fl = {}; fl[r.id] = plainAll_(lines);
    return { rentals: [plain_(r)], linesFor: fl };
  });
};

API.rentalCancel = function (req, user) {
  return write_(function () {
    var r = findBy_(rows_(SHEET.RENTALS), 'id', req.id);
    if (!r) throw bad_('없는 대여 건입니다.');
    if (r.status !== '예약됨') throw bad_('예약 상태인 건만 취소할 수 있습니다.');
    r.status = pickEnum_(req.kind || '취소', ['취소', '미수령'], '취소 종류');
    put_(SHEET.RENTALS, r);
    log_(user, '대여 ' + r.status, r.id, r.school + ' ' + r.teacher);
    return { rentals: [plain_(r)] };
  });
};

API.rentalDoc = function (req, user) {
  return write_(function () {
    var r = findBy_(rows_(SHEET.RENTALS), 'id', req.id);
    if (!r) throw bad_('없는 대여 건입니다.');
    r.docOk = true; r.docNo = s_(req.docNo, 60);
    put_(SHEET.RENTALS, r);
    log_(user, '공문 확인', r.id, r.docNo);
    return { rentals: [plain_(r)] };
  });
};

/** 내주기: 실제로 가져가는 수량을 확인하고 서명을 받으면 '대여중'이 됩니다 */
API.handover = function (req, user) {
  return write_(function () {
    var today = today_(), d = load_(), r = findBy_(d.rentals, 'id', req.id);
    if (!r) throw bad_('없는 대여 건입니다.');
    if (r.status !== '예약됨') throw bad_('예약 상태인 건만 내줄 수 있습니다.');
    var due = req.due ? date_(req.due, '반납 예정일') : r.due;
    if (due < today) throw bad_('반납 예정일이 오늘보다 빠릅니다.');
    if (!/^data:image\/png;base64,/.test(req.sign || '') || String(req.sign).length < 300) throw bad_('서명을 받아 주세요.');
    var mine = linesOf_(d, r.id), final = [];
    normLines_(req.lines).forEach(function (l) {
      var cur = findBy_(mine, 'item', l.item);
      if (!cur) throw bad_('이 대여 건에 없는 교구입니다: ' + l.item);
      if (l.qty > 0) final.push({ item: l.item, qty: l.qty });
    });
    if (!final.length) throw bad_('내줄 교구가 하나도 없습니다. 취소하려면 [취소]를 눌러 주세요.');
    checkOrThrow_(d, final, today, due, r.id, today);
    r.sign = saveImage_(req.sign, 'sign', r.id + '_' + r.school);
    r.status = '대여중'; r.start = today; r.due = due; r.handedAt = today; r.handedBy = user.name;
    put_(SHEET.RENTALS, r);
    var lines = writeLines_(d, r.id, final);
    log_(user, '내주기', r.id, r.school + ' ' + r.teacher);
    var fl = {}; fl[r.id] = plainAll_(lines);
    return { rentals: [plain_(r)], linesFor: fl };
  });
};

/** 반납 받기: 품목마다 가져온 수량·고장·분실을 기록합니다 */
API.returnItems = function (req, user) {
  return write_(function () {
    var today = today_(), d = load_(), r = findBy_(d.rentals, 'id', req.id);
    if (!r) throw bad_('없는 대여 건입니다.');
    if (r.status !== '대여중') throw bad_('대여 중인 건만 반납받을 수 있습니다.');
    var mine = linesOf_(d, r.id), changedItems = [], newRepairs = [], did = 0;
    (req.lines || []).forEach(function (x) {
      var l = findBy_(mine, 'item', x.item);
      if (!l) throw bad_('이 대여 건에 없는 교구입니다: ' + x.item);
      var brought = Math.floor(Number(x.brought) || 0), broken = Math.floor(Number(x.broken) || 0), lost = Math.floor(Number(x.lost) || 0);
      if (brought < 0 || broken < 0 || lost < 0) throw bad_('수량은 0 이상이어야 합니다.');
      if (broken > brought) throw bad_('고장 수량이 가져온 수량보다 많습니다.');
      if (brought + lost === 0) return;
      var left = Core.outstanding(l);
      if (brought + lost > left) throw bad_('남은 수량(' + left + '개)보다 많이 반납할 수 없습니다.');
      did++;
      l.ok += brought - broken; l.broken += broken; l.lost += lost;
      var note = s_(x.note, 300);
      if (note) l.note = (l.note ? l.note + ' / ' : '') + note;
      var photoId = x.photo ? saveImage_(x.photo, 'photo', r.id + '_' + x.item) : '';
      if (photoId) l.photo = photoId;
      put_(SHEET.LINES, l);
      var it = findBy_(d.items, 'id', x.item);
      var year = today.slice(0, 4);
      if (broken > 0) {
        var f = { id: Core.nextYearId('F', year, d.repairs.map(function (z) { return z.id; })), item: x.item, qty: broken, kind: '고장', date: today, rid: r.id, note: note, photo: photoId, status: '대기', doneAt: '' };
        put_(SHEET.REPAIRS, f); d.repairs.push(f); newRepairs.push(plain_(f));
      }
      if (lost > 0) {
        var g = { id: Core.nextYearId('F', year, d.repairs.map(function (z) { return z.id; })), item: x.item, qty: lost, kind: '분실', date: today, rid: r.id, note: note, photo: photoId, status: '분실처리', doneAt: today };
        put_(SHEET.REPAIRS, g); d.repairs.push(g); newRepairs.push(plain_(g));
        if (it) { it.qty = Math.max(0, it.qty - lost); put_(SHEET.ITEMS, it); changedItems.push(plain_(it)); }
      }
    });
    if (!did) throw bad_('반납할 수량을 입력해 주세요.');
    var allDone = mine.every(function (l) { return Core.outstanding(l) === 0; });
    if (allDone) { r.status = '반납완료'; r.returnedAt = today; put_(SHEET.RENTALS, r); }
    log_(user, allDone ? '반납 완료' : '일부 반납', r.id, r.school + ' ' + r.teacher);
    var fl = {}; fl[r.id] = plainAll_(mine);
    return { rentals: [plain_(r)], linesFor: fl, repairs: newRepairs, items: changedItems };
  });
};

API.repairDone = function (req, user) {
  return write_(function () {
    var today = today_(), d = load_(), f = findBy_(d.repairs, 'id', req.id);
    if (!f) throw bad_('없는 수리 기록입니다.');
    if (f.kind !== '고장' || f.status !== '대기') throw bad_('수리 대기 중인 건만 처리할 수 있습니다.');
    f.status = pickEnum_(req.result, ['완료', '폐기'], '처리 결과'); f.doneAt = today;
    put_(SHEET.REPAIRS, f);
    var items = [];
    if (f.status === '폐기') {
      var it = findBy_(d.items, 'id', f.item);
      if (it) { it.qty = Math.max(0, it.qty - f.qty); put_(SHEET.ITEMS, it); items.push(plain_(it)); }
    }
    log_(user, '수리 ' + f.status, f.id, f.item + ' ' + f.qty + '개');
    return { repairs: [plain_(f)], items: items };
  });
};

/* ----- 교실 예약 ----- */

function resInput_(req, d) {
  var kind = pickEnum_(req.kind, Core.KINDS, '종류');
  var date = date_(req.date, '예약');
  var start = time_(req.start, '시작'), end = time_(req.end, '끝');
  if (start && end && end <= start) throw bad_('끝나는 시간이 시작 시간보다 빨라요.');
  if (end && !start) throw bad_('시작 시간을 먼저 적어 주세요.');
  var purpose = s_(req.purpose, 200);
  if (!purpose) throw bad_('사용 목적을 입력해 주세요.');
  var o = { kind: kind, date: date, start: start, end: end, purpose: purpose, note: s_(req.note, 300), person: '', org: '', mobile: '', office: '', docNo: '' };
  if (kind === '외부 대여' || kind === '내부 대여') {
    o.person = s_(req.person, 30);
    if (!o.person) throw bad_('담당자를 입력해 주세요.');
  }
  if (kind === '외부 대여') {
    o.org = s_(req.org, 60);
    if (!o.org) throw bad_('소속을 입력해 주세요.');
    o.mobile = Core.fmtPhone(s_(req.mobile, 30)); o.office = Core.fmtPhone(s_(req.office, 30));
    if (!o.mobile && !o.office) throw bad_('휴대전화나 사무실 전화 중 하나는 적어 주세요.');
    o.docNo = s_(req.docNo, 60);
  }
  return o;
}

API.resSave = function (req, user) {
  return write_(function () {
    var d = load_(), inp = resInput_(req, d), year = inp.date.slice(0, 4);
    var needRoom = inp.kind === '외부 대여' || inp.kind === '내부 대여';
    var roomNames = d.rooms.map(function (r) { return r.name; });
    var targets = [];
    if (req.id) {
      var cur = findBy_(d.reservations, 'id', req.id);
      if (!cur) throw bad_('없는 예약입니다.');
      var room1 = s_(req.room, 50);
      targets.push({ obj: cur, room: room1 });
    } else {
      var rooms = (req.rooms && req.rooms.length ? req.rooms : [req.room || '']).map(function (x) { return s_(x, 50); });
      rooms = rooms.filter(function (x, i) { return rooms.indexOf(x) === i; });
      if (!needRoom && rooms.length > 1) rooms = rooms.slice(0, 5);
      rooms.forEach(function (rm) { targets.push({ obj: null, room: rm }); });
    }
    var conflicts = [], objs = [];
    targets.forEach(function (t) {
      if (needRoom && !t.room) throw bad_('빌리는 교실을 골라 주세요.');
      if (t.room && roomNames.indexOf(t.room) < 0) throw bad_('없는 교실입니다: ' + t.room);
      var o = t.obj || { id: Core.nextYearId('V', year, d.reservations.map(function (x) { return x.id; })), status: '확정', staff: user.name, createdAt: Core.nowStr() };
      o.room = t.room; o.kind = inp.kind; o.date = inp.date; o.start = inp.start; o.end = inp.end; o.purpose = inp.purpose; o.person = inp.person;
      o.org = inp.org; o.mobile = inp.mobile; o.office = inp.office; o.note = inp.note;
      if (inp.kind === '외부 대여') { if (inp.docNo) { o.docNo = inp.docNo; o.docOk = true; } else if (!t.obj) { o.docNo = ''; o.docOk = false; } } else { o.docNo = ''; o.docOk = true; }
      Core.roomConflicts(o, d.reservations).forEach(function (c) { conflicts.push({ room: c.room, date: c.date, start: c.start, end: c.end, purpose: c.purpose, kind: c.kind }); });
      objs.push(o);
      if (!t.obj) d.reservations.push(o);
    });
    if (conflicts.length && !req.force) throw apiError_('CONFLICT', '같은 교실에 시간이 겹치는 예약이 있습니다.', { conflicts: conflicts });
    objs.forEach(function (o) {
      var isNew = !o._row;
      put_(SHEET.RES, o);
      log_(user, isNew ? '교실 예약' : '교실 예약 수정', o.id, (o.room || '일정') + ' ' + o.date + ' ' + o.kind);
    });
    return { reservations: plainAll_(objs) };
  });
};

API.resCancel = function (req, user) {
  return write_(function () {
    var v = findBy_(rows_(SHEET.RES), 'id', req.id);
    if (!v) throw bad_('없는 예약입니다.');
    v.status = '취소';
    put_(SHEET.RES, v);
    log_(user, '교실 예약 취소', v.id, (v.room || '일정') + ' ' + v.date);
    return { reservations: [plain_(v)] };
  });
};

API.resDoc = function (req, user) {
  return write_(function () {
    var v = findBy_(rows_(SHEET.RES), 'id', req.id);
    if (!v) throw bad_('없는 예약입니다.');
    v.docOk = true; v.docNo = s_(req.docNo, 60);
    put_(SHEET.RES, v);
    log_(user, '공문 확인', v.id, v.docNo);
    return { reservations: [plain_(v)] };
  });
};

/* ----- 센터 프로그램(교구 미리 잡기) ----- */

function progRows_(id) { return rows_(SHEET.PROG).filter(function (r) { return r.id === id; }); }

API.progSave = function (req, user) {
  return write_(function () {
    var today = today_(), d = load_(), st = settings_();
    var name = s_(req.name, 100);
    if (!name) throw bad_('프로그램 이름을 입력해 주세요.');
    var start = date_(req.start, '시작'), end = date_(req.end, '끝');
    if (end < start) throw bad_('끝나는 날이 시작하는 날보다 빨라요.');
    var lines = normLines_(req.lines).map(function (l) { return { item: l.item, qty: l.qty }; });
    var pid = req.id ? s_(req.id, 20) : '', old = pid ? progRows_(pid) : [];
    if (pid && !old.length) throw bad_('없는 프로그램입니다.');
    if (old.length && old[0].status === '취소') throw bad_('취소된 프로그램은 고칠 수 없습니다.');
    var chk = Core.checkProgram(d, Core.makeIndex(d, { buffer: st.programBuffer }), lines, start, end, pid, today);
    if (chk.errors.length) throw bad_(chk.errors.join('\n'));
    if (chk.short.length && !req.force) {
      throw apiError_('SHORT', chk.short.map(function (x) { return x.name + ': 앞뒤 ' + st.programBuffer + '일을 포함한 기간에 ' + x.avail + '개만 잡을 수 있어요 (요청 ' + x.want + '개)'; }).join('\n'), { short: chk.short });
    }
    var staff = old.length ? old[0].staff : user.name, createdAt = old.length ? old[0].createdAt : Core.nowStr();
    removeRows_(SHEET.PROG, old);
    d.programs = rows_(SHEET.PROG);
    var id = pid || Core.nextYearId('G', start.slice(0, 4), d.programs.map(function (r) { return r.id; }));
    lines.forEach(function (l) {
      put_(SHEET.PROG, { id: id, name: name, start: start, end: end, item: l.item, qty: l.qty, note: s_(req.note, 300), status: '확정', staff: staff, createdAt: createdAt });
    });
    log_(user, pid ? '센터 프로그램 수정' : '센터 프로그램 등록', id, name + ' ' + start + '~' + end);
    var pf = {}; pf[id] = plainAll_(progRows_(id));
    return { programsFor: pf, programId: id };
  });
};

API.progCancel = function (req, user) {
  return write_(function () {
    var rows = progRows_(s_(req.id, 20));
    if (!rows.length) throw bad_('없는 프로그램입니다.');
    rows.forEach(function (r) { r.status = '취소'; put_(SHEET.PROG, r); });
    log_(user, '센터 프로그램 취소', rows[0].id, rows[0].name);
    var pf = {}; pf[rows[0].id] = plainAll_(rows);
    return { programsFor: pf };
  });
};

/* ----- 점검 ----- */

API.inspect = function (req) {
  var rows = rows_(SHEET.INSPECT, 'round');
  var rounds = {}, order = [];
  rows.forEach(function (r) {
    var o = rounds[r.round];
    if (!o) { o = rounds[r.round] = { round: r.round, rdate: r.rdate, total: 0, done: 0, issues: 0 }; order.push(r.round); }
    o.total++; if (r.result) o.done++; if (r.result === '이상') o.issues++;
  });
  var out = { rounds: order.map(function (k) { return rounds[k]; }).reverse() };
  if (req.round) out.rows = plainAll_(rows.filter(function (r) { return r.round === req.round; }));
  return out;
};

API.inspectStart = function (req, user) {
  return write_(function () {
    var name = s_(req.name, 60);
    if (!name) throw bad_('점검 회차 이름을 입력해 주세요. (예: 2026 2학기말)');
    if (rows_(SHEET.INSPECT, 'round').some(function (r) { return r.round === name; })) throw bad_('같은 이름의 회차가 이미 있습니다.');
    var d = load_(), today = today_();
    d.items.filter(function (i) { return i.status !== '폐기'; }).forEach(function (i) { put_(SHEET.INSPECT, { round: name, rdate: today, target: i.id, kind: '물품', result: '', count: '', note: '', by: '', at: '' }); });
    d.rooms.forEach(function (r) { put_(SHEET.INSPECT, { round: name, rdate: today, target: r.name, kind: '교실', result: '', count: '', note: '', by: '', at: '' }); });
    log_(user, '점검 시작', name, '');
    return { round: name };
  });
};

API.inspectMark = function (req, user) {
  return write_(function () {
    var row = null;
    rows_(SHEET.INSPECT, 'round').forEach(function (r) { if (r.round === req.round && r.target === req.target) row = r; });
    if (!row) throw bad_('점검 대상을 찾을 수 없습니다.');
    row.result = pickEnum_(req.result || '', ['', '정상', '이상'], '점검 결과');
    row.count = req.count === '' || req.count === null || req.count === undefined ? '' : Math.max(0, parseInt(req.count, 10) || 0);
    row.note = s_(req.note, 300); row.by = user.name; row.at = Core.nowStr();
    put_(SHEET.INSPECT, row);
    return { row: plain_(row) };
  });
};

/* ----- 서명·사진 보기 ----- */

API.file = function (req) {
  var id = s_(req.id, 100), p = PropertiesService.getScriptProperties();
  var f = DriveApp.getFileById(id);
  var okParents = [p.getProperty('FOLDER_SIGN'), p.getProperty('FOLDER_PHOTO')];
  var parents = f.getParents(), allowed = false;
  while (parents.hasNext()) { if (okParents.indexOf(parents.next().getId()) >= 0) allowed = true; }
  if (!allowed) throw apiError_('FORBIDDEN', '볼 수 없는 파일입니다.');
  var blob = f.getBlob();
  return { mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
};

/* ───────── 시트 메뉴·처음 설정 ───────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('창의센터 앱')
    .addItem('초기 설정 (처음 한 번)', 'setupSheets')
    .addItem('오래된 연락처 지금 가리기', 'maskNow')
    .addToUi();
}

function maskNow() {
  PropertiesService.getScriptProperties().deleteProperty('MASK_DAY');
  MEMO = {};
  housekeeping_();
  SpreadsheetApp.getUi().alert('보관 기간이 지난 연락처를 가렸습니다.');
}

/** 탭 만들기 + 처음 값 넣기. 여러 번 눌러도 이미 있는 내용은 지우지 않습니다 */
function setupSheets() {
  MEMO = {};
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = sheet_(name);
    var n = SCHEMA[name].length;
    sh.getRange(1, 1, Math.max(sh.getMaxRows(), 2), n).setNumberFormat('@');
  });
  if (!rows_(SHEET.ROOMS, 'name').length) {
    [['SW교육체험교실', 'SW', 1, ''], ['라온실', '라', 2, 'Y'], ['혜윰실', '혜', 3, 'Y'], ['창의실', '창', 4, 'Y'], ['놀이실', '놀', 5, 'Y']]
      .forEach(function (r) { put_(SHEET.ROOMS, { name: r[0], short: r[1], order: r[2], priority: r[3] === 'Y' }); });
  }
  if (!rows_(SHEET.SETTINGS, 'key').length) {
    [['반납기본일수', '7', '대여할 때 반납 예정일을 며칠 뒤로 채울지'],
      ['연락처보관일수', '365', '반납 완료(또는 교실 사용일) 뒤 이 기간이 지나면 연락처를 지웁니다'],
      ['보관위치', '혜윰실,라온실,놀이실,창의실,자료실,4층,창고', '물품의 보관위치 목록 (쉼표로 구분)'],
      ['센터이름', '울산창의융합교육센터', ''],
      ['센터전화', '', '공개 목록 아래에 보여 줄 전화번호']]
      .forEach(function (r) { put_(SHEET.SETTINGS, { key: r[0], value: r[1], hint: r[2] }); });
  }
  PropertiesService.getScriptProperties().deleteProperty('SETTINGS_VER');
  ensureSettings_();
  if (!rows_(SHEET.STAFF, 'email').length) {
    var me = '';
    try { me = Session.getEffectiveUser().getEmail(); } catch (e) { me = ''; }
    if (me) put_(SHEET.STAFF, { email: me, name: me.split('@')[0], role: '관리자' });
  }
  try { SpreadsheetApp.getUi().alert('초기 설정을 마쳤습니다. [직원] 탭에서 이름을 고치고, 함께 쓸 선생님의 구글 이메일을 추가해 주세요.'); } catch (e) { /* 메뉴 밖에서 실행한 경우 */ }
}
