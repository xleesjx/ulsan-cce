/* Apps Script 서비스(시트·드라이브·로그인)를 흉내 내서 gas/Code.gs 를 Node에서 실행합니다. 모든 데이터는 가짜입니다. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

function makeSheet(name) {
  let data = [];
  const sheet = {
    name,
    data: () => data,
    getDataRange: () => ({ getValues: () => (data.length ? data.map((r) => r.slice()) : [['']]) }),
    getRange: (r, c, nr, nc) => {
      nr = nr || 1; nc = nc || 1;
      const rg = {
        getValues: () => {
          const out = [];
          for (let i = 0; i < nr; i++) {
            const row = [];
            for (let j = 0; j < nc; j++) row.push(((data[r - 1 + i] || [])[c - 1 + j]) === undefined ? '' : data[r - 1 + i][c - 1 + j]);
            out.push(row);
          }
          return out;
        },
        setValues: (v) => {
          for (let i = 0; i < nr; i++) {
            while (data.length < r + i) data.push([]);
            const row = data[r - 1 + i];
            for (let j = 0; j < nc; j++) {
              while (row.length < c + j) row.push('');
              let val = v[i][j];
              if (typeof val === 'string' && /^=/.test(val)) throw new Error('수식이 그대로 저장됨: ' + val);
              if (typeof val === 'string' && val.startsWith("'")) val = val.slice(1);
              row[c - 1 + j] = val;
            }
          }
          return rg;
        },
        setNumberFormat: () => rg,
        setFontWeight: () => rg
      };
      return rg;
    },
    setFrozenRows: () => {},
    getMaxRows: () => Math.max(1000, data.length),
    getLastRow: () => {
      for (let i = data.length - 1; i >= 0; i--) if (data[i].some((c) => c !== '' && c !== null && c !== undefined)) return i + 1;
      return 0;
    },
    deleteRow: (r) => { data.splice(r - 1, 1); }
  };
  return sheet;
}

function createEnv(opts) {
  opts = opts || {};
  const sheets = {};
  const props = { CLIENT_ID: 'test-client' };
  const cache = {};
  let now = opts.now || new Date('2026-11-06T10:00:00+09:00');
  const pad = (n) => String(n).padStart(2, '0');
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = makeSheet(n)),
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST'
  };
  // 드라이브
  const files = {}, folders = {};
  let seq = 0;
  const makeFolder = (name) => {
    const id = 'folder' + (++seq);
    return (folders[id] = { id, name, getId: () => id });
  };
  const DriveApp = {
    createFolder: (name) => makeFolder(name),
    getFolderById: (id) => { if (!folders[id]) throw new Error('폴더 없음'); return folders[id]; },
    getFileById: (id) => {
      const f = files[id];
      if (!f) throw new Error('파일 없음');
      return { getParents: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return f.parent; } }; }, getBlob: () => ({ getContentType: () => f.blob.type, getBytes: () => f.blob.bytes }) };
    }
  };
  // 폴더에 파일 만들기
  Object.defineProperty(DriveApp, '_mk', { value: () => {} });
  const origCreateFolder = DriveApp.createFolder;
  DriveApp.createFolder = (name) => {
    const f = origCreateFolder(name);
    f.createFile = (blob) => { const id = 'file' + (++seq); files[id] = { id, name: blob.name, blob, parent: f }; return { getId: () => id }; };
    return f;
  };
  const origGetFolder = DriveApp.getFolderById;
  DriveApp.getFolderById = (id) => { const f = origGetFolder(id); return f; };

  const ctx = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      getUi: () => { throw new Error('no ui'); }
    },
    DriveApp,
    ContentService: { createTextOutput: (s) => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(s).digest()),
      base64EncodeWebSafe: (b) => Buffer.from(b).toString('base64url'),
      base64Encode: (b) => Buffer.from(b).toString('base64'),
      base64Decode: (s) => Array.from(Buffer.from(s, 'base64')),
      newBlob: (bytes, type, name) => ({ bytes, type, name }),
      formatDate: (d, tz, fmt) => {
        const k = new Date(d.getTime() + 9 * 3600000);
        const y = k.getUTCFullYear(), M = pad(k.getUTCMonth() + 1), D = pad(k.getUTCDate());
        if (fmt === 'yyyy-MM-dd') return `${y}-${M}-${D}`;
        if (fmt === 'HH:mm') return `${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
        return `${y}-${M}-${D} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}:${pad(k.getUTCSeconds())}`;
      }
    },
    UrlFetchApp: {
      fetch: (url) => {
        const m = /id_token=([^&]+)/.exec(url);
        const tok = m ? decodeURIComponent(m[1]) : '';
        if (!tok.startsWith('tok:')) return { getResponseCode: () => 400, getContentText: () => '{}' };
        const email = tok.slice(4);
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ aud: props.CLIENT_ID, iss: 'https://accounts.google.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3000), email }) };
      }
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) }
  };
  // 테스트용 시계
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(now.getTime()); }
    static now() { return now.getTime(); }
  }
  ctx.Date = FakeDate;
  vm.createContext(ctx);
  const root = path.join(__dirname, '..');
  // Apps Script 처럼 Code.gs 가 Core.gs 보다 먼저 실행되어도 동작해야 합니다
  vm.runInContext(fs.readFileSync(path.join(root, 'gas/Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'gas/Core.gs'), 'utf8'), ctx, { filename: 'Core.gs' });
  return {
    ctx, sheets, props, files, folders,
    setNow: (d) => { now = d; },
    call: (action, payload, email) => {
      const out = ctx.doPost({ postData: { contents: JSON.stringify(Object.assign({ action, token: 'tok:' + (email || 'owner@example.com') }, payload || {})) } });
      return JSON.parse(out.s);
    },
    table: (n) => (sheets[n] ? sheets[n].data() : [])
  };
}

module.exports = { createEnv };
