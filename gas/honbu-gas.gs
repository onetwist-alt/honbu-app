/**
 * 本部アプリ（本番）GAS  v1.4.2
 *
 * スプレッドシート「業務管理データ」に紐づけて使います。
 * はじめて貼り付けたとき・新しい版に貼り替えたときは、setup を1回実行してください。
 *
 * ・データ置き場のタブは、列の見出しの名前で列を探します。列を並べ替えても動きます。
 * ・足りない列は右に足すだけで、既存のデータは消しません。
 * ・削除は「削除」の印をつけるだけで、行は消しません（ログインの記録だけは片付けます）。
 */
const APP_VERSION = '1.4.2';
const TZ = 'Asia/Tokyo';
const SESSION_DAYS = 30;     // ログインしたままにする日数
const HASH_ROUNDS = 300;     // パスワードを変換する回数
const DAY_START_HOUR = 8;    // 朝8時で日付が切り替わる

/* ===== 表示用の言葉（シートには日本語で書き、アプリの中では短い記号で扱う） ===== */
const KIND = { basic: '基本', plus: '＋α' };
const REPORT_ST = { draft: '下書き', submitted: '提出' };
const ATT_ST = { in: '出勤', off: '欠勤' };
const REC = { daily: '毎日', weekly: '毎週', monthly: '毎月' };

/* ===== データ置き場の定義  [アプリでの名前, シートの見出し, 種類, 言葉の対応]
   種類：s=文字 n=数 b=はい/いいえ d=日付(2026-10-19) t=日時の文字 j=まとまったデータ ===== */
const SCHEMA = {
  employees: { sheet: '社員', cols: [
    ['id', '社員ID', 's'], ['name', '氏名', 's'], ['loginId', 'ログインID', 's'], ['title', '肩書き', 's'],
    ['shift', '勤務', 's'], ['admin', '管理者', 'b'], ['active', '在籍', 'b'], ['order', '表示順', 'n'],
    ['createdAt', '作成日時', 't'], ['updatedAt', '更新日時', 't'], ['version', '版', 'n']] },
  auth: { sheet: 'ログイン情報', cols: [
    ['empId', '社員ID', 's'], ['hash', 'パスワード（変換済み）', 's'], ['salt', '変換用の文字', 's'],
    ['mustChange', '仮パスワード', 'b'], ['updatedAt', '更新日時', 't']] },
  sessions: { sheet: 'セッション', cols: [
    ['tokenHash', 'ログインの鍵（変換済み）', 's'], ['empId', '社員ID', 's'], ['expires', '有効期限', 'n'], ['createdAt', '作成日時', 't']] },
  workTypes: { sheet: '業務マスター', cols: [
    ['id', '業務ID', 's'], ['kind', '区分', 's', KIND], ['name', '業務名', 's'], ['uses', '使用回数', 'n'],
    ['active', '有効', 'b'], ['updatedAt', '更新日時', 't'], ['version', '版', 'n']] },
  tasks: { sheet: 'タスク', cols: [
    ['id', 'タスクID', 's'], ['parent', '親タスクID', 's'], ['title', 'タスク名', 's'], ['detail', '詳細説明', 's'],
    ['owner', '主担当', 's'], ['co', '共同担当', 's'], ['priority', '優先度', 's'], ['weight', '比重', 'n'],
    ['progress', '進捗', 'n'], ['status', '状態', 's'], ['start', '開始日', 'd'], ['due', '期限', 'd'],
    ['recType', '定期の種類', 's', REC], ['recDow', '定期の曜日', 's'], ['recDom', '定期の日', 's'],
    ['recOrigin', '定期の元タスクID', 's'], ['memo', 'メモ', 's'], ['prevProgress', '前の進捗', 's'],
    ['doneAt', '完了日時', 't'], ['deleted', '削除', 'b'], ['deletedAt', '削除日時', 't'], ['createdBy', '作成者', 's'],
    ['createdAt', '作成日時', 't'], ['updatedAt', '更新日時', 't'], ['version', '版', 'n']] },
  reports: { sheet: '日報', cols: [
    ['id', '日報ID', 's'], ['empId', '社員ID', 's'], ['date', '日付', 'd'], ['status', '状態', 's', REPORT_ST],
    ['submittedAt', '提出日時', 't'], ['changedAfterClose', '確定後に変更', 'b'], ['updatedAt', '更新日時', 't'], ['version', '版', 'n']] },
  items: { sheet: '日報明細', cols: [
    ['id', '明細ID', 's'], ['reportId', '日報ID', 's'], ['empId', '社員ID', 's'], ['date', '日付', 'd'],
    ['kind', '区分', 's', KIND], ['name', '業務名', 's'], ['min', '時間（分）', 'n'], ['memo', 'メモ', 's'],
    ['taskId', 'タスクID', 's'], ['seq', '順番', 'n'], ['deleted', '削除', 'b'], ['updatedAt', '更新日時', 't']] },
  attendance: { sheet: '出勤', cols: [
    ['id', '出勤ID', 's'], ['empId', '社員ID', 's'], ['date', '日付', 'd'], ['status', '状態', 's', ATT_ST],
    ['updatedAt', '更新日時', 't'], ['version', '版', 'n']] },
  closings: { sheet: '月次確定', cols: [
    ['ym', '年月', 's'], ['closedAt', '確定日時', 't'], ['closedBy', '確定した人', 's'], ['data', '内容', 'j']] },
  audit: { sheet: '操作履歴', cols: [
    ['at', '日時', 't'], ['by', '操作した人', 's'], ['action', '操作', 's'], ['target', '対象', 's'],
    ['before', '変更前', 's'], ['after', '変更後', 's'], ['via', '経路', 's']] },
  settings: { sheet: '設定', cols: [
    ['key', 'キー', 's'], ['label', '項目', 's'], ['value', '値', 's'], ['note', '説明', 's']] }
};

const SETTING_DEFAULTS = [
  ['monthlyCost', '月の人件費（円）', '300000', '全員同じ金額です。アプリでは管理者だけが変更できます'],
  ['dayHours', '1日の勤務時間（時間）', '11', '基本業務時間 ＝ この時間 − ＋α業務時間'],
  ['dayStart', '日付の切り替え（時）', String(DAY_START_HOUR), 'この時刻で次の日になります（夜勤は始まった日の分）'],
  ['adminReset', 'パスワードのリセット（本部長用）', 'FALSE', '本部長がパスワードを忘れたら、値を TRUE にしてください。下の行に仮パスワードが出ます'],
  ['adminResetResult', 'リセット後の仮パスワード', '', '最初のログインで新しいパスワードに変えてください']
];

/* ===== 入口 ===== */
function doGet() {
  return json_({ ok: true, data: { app: '本部アプリ', version: APP_VERSION, time: nowStr_() } });
}

const HANDLERS = {
  ping:           { public: true, fn: function () { return { app: '本部アプリ', version: APP_VERSION, time: nowStr_() }; } },
  login:          { public: true, write: true, fn: hLogin_ },
  logout:         { write: true, fn: hLogout_ },
  me:             { fn: function (p, u) { return { me: empPub_(T_('employees').find(u.id)), mustChange: u.mustChange }; } },
  changePassword: { write: true, fn: hChangePassword_ },
  load:           { fn: hLoad_ },
  loadRange:      { fn: hLoadRange_ },
  saveReport:     { write: true, fn: hSaveReport_ },
  setAttendance:  { write: true, fn: hSetAttendance_ },
  setAttendanceMany: { write: true, fn: hSetAttendanceMany_ },
  saveTasks:      { write: true, fn: hSaveTasks_ },
  deleteTasks:    { write: true, fn: hDeleteTasks_ },
  restoreTasks:   { write: true, fn: hRestoreTasks_ },
  saveWorkType:   { write: true, fn: hSaveWorkType_ },
  addEmployee:    { write: true, admin: true, fn: hAddEmployee_ },
  updateEmployee: { write: true, admin: true, fn: hUpdateEmployee_ },
  retireEmployee: { write: true, admin: true, fn: hRetireEmployee_ },
  resetPassword:  { write: true, admin: true, fn: hResetPassword_ },
  saveSettings:   { write: true, admin: true, fn: hSaveSettings_ },
  monthReport:    { fn: hMonthReport_ },
  closeMonth:     { write: true, admin: true, fn: hCloseMonth_ }
};
// 仮パスワードのままでも使える操作
const ALLOWED_BEFORE_CHANGE = ['changePassword', 'logout', 'me'];

function doPost(e) {
  let req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, code: 'bad_request', error: '送られた内容を読めませんでした' }); }
  const action = String(req.action || '');
  const h = HANDLERS[action];
  if (!h) return json_({ ok: false, code: 'unknown', error: '知らない操作です' });
  try {
    let user = null;
    if (!h.public) {
      user = auth_(req.token);
      if (!user) return json_({ ok: false, code: 'auth', error: 'ログインの期限が切れました。もう一度ログインしてください' });
      if (user.mustChange && ALLOWED_BEFORE_CHANGE.indexOf(action) < 0) return json_({ ok: false, code: 'must_change', error: '先にパスワードを変更してください' });
      if (h.admin && !user.admin) return json_({ ok: false, code: 'forbidden', error: '管理者だけができる操作です' });
    }
    if (!h.write) return json_({ ok: true, data: h.fn(req.payload || {}, user) });

    // 同じ操作が2回届いても（通信のやり直しなど）、1回分しか処理しない
    const rid = String(req.requestId || '').slice(0, 80);
    const cache = CacheService.getScriptCache();
    if (rid) { const hit = cache.get('rq:' + rid); if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON); }
    // 書き込みは1件ずつ順番に
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) return json_({ ok: false, code: 'busy', error: '混み合っています。少し待ってからもう一度お試しください' });
    try {
      const text = JSON.stringify({ ok: true, data: h.fn(req.payload || {}, user) });
      if (rid) { try { cache.put('rq:' + rid, text, 21600); } catch (x) { /* 大きすぎるときは覚えない */ } }
      return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
    } finally {
      SpreadsheetApp.flush();
      lock.releaseLock();
    }
  } catch (err) {
    if (err && err.appCode) return json_({ ok: false, code: err.appCode, error: err.message, data: err.data || null });
    console.error(err && err.stack || err);
    return json_({ ok: false, code: 'error', error: 'エラーが起きました：' + (err && err.message || err) });
  }
}

/* ===== ログイン ===== */
function auth_(token) {
  token = String(token || '');
  if (token.length < 20) return null;
  const h = sha_(token);
  const cache = CacheService.getScriptCache();
  // 数分間はログインの確認結果を覚えておき、シートを読まずに済ませる（速くするため）
  const hit = cache.get('us:' + h);
  if (hit) { try { const u = JSON.parse(hit); u.tokenHash = h; return u; } catch (e) { /* 読めなければ確かめ直す */ } }
  const s = T_('sessions').find(h);
  if (!s || s.expires < Date.now()) return null;
  const e = T_('employees').find(s.empId);
  if (!e || !e.active) return null;
  const a = T_('auth').find(e.id, 'empId');
  const u = { id: e.id, name: e.name, admin: e.admin, mustChange: a ? a.mustChange : false };
  cache.put('us:' + h, JSON.stringify(u), 300);
  u.tokenHash = h;
  return u;
}
function forgetLogin_(empId) {
  const cache = CacheService.getScriptCache();
  T_('sessions').rows.forEach(function (s) { if (s.empId === empId) cache.remove('us:' + s.tokenHash); });
}

function hLogin_(p) {
  const loginId = String(p.loginId || '').trim().toLowerCase();
  const pw = String(p.password || '');
  const cache = CacheService.getScriptCache();
  const fk = 'lf:' + loginId;
  const fails = Number(cache.get(fk) || 0);
  if (fails >= 5) throw appErr_('locked', 'パスワードを5回まちがえたため、10分間はログインできません');
  const e = T_('employees').rows.filter(function (x) { return x.active && x.loginId.toLowerCase() === loginId; })[0];
  const a = e ? T_('auth').find(e.id, 'empId') : null;
  if (!e || !a || hashPw_(pw, a.salt) !== a.hash) {
    cache.put(fk, String(fails + 1), 600);
    throw appErr_('login', 'IDかパスワードが違います');
  }
  cache.remove(fk);
  const S = T_('sessions');
  const now = Date.now();
  // 期限切れのログインの記録を片付ける（業務のデータではないので消してよい）
  S.rows.filter(function (s) { return s.expires < now; })
    .sort(function (x, y) { return y._row - x._row; })
    .forEach(function (s) { S.removeRow(s); });
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const expires = now + SESSION_DAYS * 864e5;
  S.insert({ tokenHash: sha_(token), empId: e.id, expires: expires, createdAt: nowStr_() });
  audit_({ name: e.name }, 'ログイン', e.name, '', '', 'アプリ');
  return { token: token, expires: expires, mustChange: a.mustChange, me: empPub_(e) };
}

function hLogout_(p, user) {
  const S = T_('sessions');
  const s = S.find(user.tokenHash);
  if (s) S.removeRow(s);
  CacheService.getScriptCache().remove('us:' + user.tokenHash);
  return { done: true };
}

function hChangePassword_(p, user) {
  const A = T_('auth');
  const a = A.find(user.id, 'empId');
  if (!a) throw appErr_('bad', 'ログインの情報が見つかりません');
  const oldPw = String(p.oldPassword || ''), newPw = String(p.newPassword || '');
  if (hashPw_(oldPw, a.salt) !== a.hash) throw appErr_('login', '今のパスワードが違います');
  if (newPw.length < 6) throw appErr_('bad', '新しいパスワードは6文字以上にしてください');
  if (newPw === oldPw) throw appErr_('bad', '今とは違うパスワードにしてください');
  const salt = Utilities.getUuid();
  A.update(a, { hash: hashPw_(newPw, salt), salt: salt, mustChange: false, updatedAt: nowStr_() });
  forgetLogin_(user.id);
  audit_(user, 'パスワードを変更', user.name, '', '', 'アプリ');
  return { done: true };
}

// 仮パスワードを作って、その人のログインをすべて解除する
function setTemp_(empId) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const hex = Utilities.getUuid().replace(/-/g, '');
  let temp = '';
  for (let i = 0; i < 8; i++) temp += chars[parseInt(hex.substr(i * 2, 2), 16) % chars.length];
  const salt = Utilities.getUuid();
  const A = T_('auth');
  const a = A.find(empId, 'empId');
  const row = { empId: empId, hash: hashPw_(temp, salt), salt: salt, mustChange: true, updatedAt: nowStr_() };
  if (a) A.update(a, row); else A.insert(row);
  revokeSessions_(empId);
  return temp;
}

function revokeSessions_(empId) {
  const S = T_('sessions');
  const cache = CacheService.getScriptCache();
  S.rows.filter(function (s) { return s.empId === empId; })
    .sort(function (x, y) { return y._row - x._row; })
    .forEach(function (s) { cache.remove('us:' + s.tokenHash); S.removeRow(s); });
}

/* ===== 読み込み ===== */
function hLoad_(p, user) {
  const today = bizToday_();
  const from = isDate_(p.from) ? p.from : monthEdge_(today, -1, true);
  const to = isDate_(p.to) ? p.to : monthEdge_(today, 1, false);
  const out = {
    me: empPub_(T_('employees').find(user.id)), mustChange: user.mustChange, serverToday: today, version: APP_VERSION,
    settings: settingsMap_(),
    employees: T_('employees').rows.map(empPub_),
    workTypes: T_('workTypes').rows.map(wtPub_),
    tasks: T_('tasks').rows.filter(function (t) { return !t.deleted; }).map(taskPub_),
    closings: T_('closings').rows.map(function (c) { return c.ym; }),
    from: from, to: to
  };
  const r = rangeData_(from, to);
  out.reports = r.reports;
  out.attendance = r.attendance;
  return out;
}

function hLoadRange_(p) {
  if (!isDate_(p.from) || !isDate_(p.to) || p.from > p.to) throw appErr_('bad', '期間が正しくありません');
  const r = rangeData_(p.from, p.to);
  r.from = p.from; r.to = p.to;
  return r;
}

function rangeData_(from, to) {
  const reps = T_('reports').rows.filter(function (r) { return r.date >= from && r.date <= to; });
  const ids = {};
  reps.forEach(function (r) { ids[r.id] = []; });
  T_('items').rows.forEach(function (i) { if (!i.deleted && ids[i.reportId]) ids[i.reportId].push(i); });
  const reports = {};
  reps.forEach(function (r) { reports[r.id] = reportPub_(r, ids[r.id]); });
  const attendance = {};
  T_('attendance').rows.forEach(function (a) {
    if (a.date >= from && a.date <= to && a.status) attendance[a.empId + '|' + a.date] = a.status;
  });
  return { reports: reports, attendance: attendance };
}

/* ===== 日報 ===== */
function hSaveReport_(p, user) {
  const date = String(p.date || '');
  if (!isDate_(date)) throw appErr_('bad', '日付が正しくありません');
  if (p.empId && p.empId !== user.id) throw appErr_('forbidden', '日報は本人だけが入力できます');
  if (date > bizToday_()) throw appErr_('bad', 'まだ来ていない日の日報は入力できません');
  const status = p.status === 'submitted' ? 'submitted' : 'draft';
  const list = (Array.isArray(p.items) ? p.items : []).slice(0, 60).map(function (x, i) {
    const kind = x.kind === 'plus' ? 'plus' : 'basic';
    const name = String(x.name || '').trim().slice(0, 60);
    if (!name) throw appErr_('bad', '業務名が空の行があります');
    const min = Math.min(660, Math.max(30, Math.round((Number(x.min) || 0) / 30) * 30));
    return { id: String(x.id || uid_('i')).slice(0, 40), kind: kind, name: name, min: min,
      memo: String(x.memo || '').slice(0, 200), taskId: kind === 'plus' ? String(x.taskId || '') : '', seq: i };
  });
  const key = user.id + '|' + date;
  const R = T_('reports'), I = T_('items');
  let rep = R.find(key);
  const itemsOf = function () { return I.rows.filter(function (i) { return i.reportId === key && !i.deleted; }); };
  if (rep && p.version != null && Number(p.version) !== rep.version) {
    throw appErr_('conflict', 'ほかの画面で先にこの日報が更新されています。最新の内容に読み直しました', { report: reportPub_(rep, itemsOf()) });
  }
  const closed = T_('closings').rows.some(function (c) { return c.ym === date.slice(0, 7); });
  const now = nowStr_();
  const before = rep ? reportSummary_(rep, itemsOf()) : '';
  if (rep) {
    rep = R.update(rep, { status: status, submittedAt: status === 'submitted' ? now : rep.submittedAt,
      changedAfterClose: rep.changedAfterClose || closed, updatedAt: now, version: rep.version + 1 });
  } else {
    rep = R.insert({ id: key, empId: user.id, date: date, status: status, submittedAt: status === 'submitted' ? now : '',
      changedAfterClose: closed, updatedAt: now, version: 1 });
  }
  const existing = itemsOf();
  const keep = {};
  list.forEach(function (x) { keep[x.id] = true; });
  existing.forEach(function (e) { if (!keep[e.id]) I.update(e, { deleted: true, updatedAt: now }); });
  const adds = [];
  list.forEach(function (x) {
    const e = existing.filter(function (y) { return y.id === x.id; })[0];
    const row = { id: x.id, reportId: key, empId: user.id, date: date, kind: x.kind, name: x.name, min: x.min,
      memo: x.memo, taskId: x.taskId, seq: x.seq, deleted: false, updatedAt: now };
    if (!e) adds.push(row);
    else if (e.kind !== row.kind || e.name !== row.name || e.min !== row.min || e.memo !== row.memo || e.taskId !== row.taskId || e.seq !== row.seq) I.update(e, row);
  });
  I.insertMany(adds);
  let autoAttend = false;
  if (status === 'submitted') {
    // 日報を出した日は自動で出勤にする
    const A = T_('attendance');
    const a = A.find(key);
    if (!a) { A.insert({ id: key, empId: user.id, date: date, status: 'in', updatedAt: now, version: 1 }); autoAttend = true; }
    else if (a.status !== 'in') { A.update(a, { status: 'in', updatedAt: now, version: a.version + 1 }); autoAttend = true; }
    // よく使う業務ほど候補の上に出すための回数
    const W = T_('workTypes');
    list.forEach(function (x) {
      const w = W.rows.filter(function (y) { return y.kind === x.kind && y.name === x.name; })[0];
      if (w) W.update(w, { uses: w.uses + 1, updatedAt: now, version: w.version + 1 });
    });
  }
  const fresh = itemsOf();
  audit_(user, status === 'submitted' ? '日報を提出' : '日報を下書き保存', user.name + ' ' + date, before, reportSummary_(rep, fresh), 'アプリ');
  return { report: reportPub_(rep, fresh), autoAttend: autoAttend };
}

/* ===== 出勤 ===== */
function hSetAttendance_(p, user) {
  const empId = String(p.empId || ''), date = String(p.date || '');
  const st = (p.status === 'in' || p.status === 'off') ? p.status : '';
  if (!isDate_(date) || !T_('employees').find(empId)) throw appErr_('bad', '社員か日付が正しくありません');
  // 出勤を変えられるのは、本人と管理者だけ
  if (empId !== user.id && !user.admin) throw appErr_('forbidden', '出勤を変えられるのは、本人と管理者だけです');
  const key = empId + '|' + date;
  const A = T_('attendance');
  const now = nowStr_();
  const a = A.find(key);
  const before = a ? a.status : '';
  if (a) A.update(a, { status: st, updatedAt: now, version: a.version + 1 });
  else A.insert({ id: key, empId: empId, date: date, status: st, updatedAt: now, version: 1 });
  audit_(user, '出勤を変更', empName_(empId) + ' ' + date, ATT_ST[before] || '未登録', ATT_ST[st] || '未登録', 'アプリ');
  return { key: key, status: st };
}

// 出勤をまとめて変える（出勤カレンダーで続けて押したとき、1回の通信で保存する）
function hSetAttendanceMany_(p, user) {
  const list = (Array.isArray(p.items) ? p.items : []).slice(0, 400);
  if (!list.length) return { count: 0 };
  const E = T_('employees'), A = T_('attendance');
  const now = nowStr_();
  const clean = list.map(function (x) {
    const empId = String(x.empId || ''), date = String(x.date || '');
    const st = (x.status === 'in' || x.status === 'off') ? x.status : '';
    if (!isDate_(date) || !E.find(empId)) throw appErr_('bad', '社員か日付が正しくありません');
    if (empId !== user.id && !user.admin) throw appErr_('forbidden', '出勤を変えられるのは、本人と管理者だけです');
    return { key: empId + '|' + date, empId: empId, date: date, status: st };
  });
  // 同じマスが2回入っていたら、最後のものだけを使う
  const last = {};
  clean.forEach(function (x) { last[x.key] = x; });
  const adds = [], notes = [];
  Object.keys(last).forEach(function (k) {
    const x = last[k], a = A.find(k), before = a ? a.status : '';
    if (a) { if (a.status !== x.status) A.update(a, { status: x.status, updatedAt: now, version: a.version + 1 }); else return; }
    else { if (!x.status) return; adds.push({ id: k, empId: x.empId, date: x.date, status: x.status, updatedAt: now, version: 1 }); }
    notes.push(empName_(x.empId) + ' ' + x.date.slice(5) + '：' + (ATT_ST[before] || '未登録') + '→' + (ATT_ST[x.status] || '未登録'));
  });
  A.insertMany(adds);
  if (notes.length) audit_(user, '出勤を変更（' + notes.length + '件）', notes.slice(0, 20).join('、') + (notes.length > 20 ? ' ほか' : ''), '', '', 'アプリ');
  return { count: notes.length };
}

/* ===== タスク ===== */
function hSaveTasks_(p, user) {
  const list = Array.isArray(p.tasks) ? p.tasks.slice(0, 100) : [];
  if (!list.length) throw appErr_('bad', '保存するタスクがありません');
  const Tt = T_('tasks'), E = T_('employees');
  // 先に全部の版を確かめる（1件でも食い違えば何も保存しない）
  const conflicts = [];
  list.forEach(function (x) {
    const cur = Tt.find(String(x.id || ''));
    if (cur && x.version != null && Number(x.version) !== cur.version) conflicts.push(taskPub_(cur));
  });
  if (conflicts.length) throw appErr_('conflict', 'ほかの人が先にタスクを更新しました。最新の内容に読み直しました', { tasks: conflicts });
  // 他の人のタスクは、管理者・主担当・共同担当・作った人だけが直せる（新しく作って他の人に投げるのは誰でもできる）
  list.forEach(function (x) {
    const cur = Tt.find(String(x.id || ''));
    if (cur && !canEditTask_(user, cur)) throw appErr_('forbidden', '「' + cur.title + '」は他の人のタスクなので、直せません');
    if (!cur && x.parent) {
      const par = Tt.find(String(x.parent));
      if (par && !par.deleted && !canEditTask_(user, par)) throw appErr_('forbidden', '他の人のタスクの下には、子タスクを作れません');
    }
  });
  const now = nowStr_();
  const saved = [];
  list.forEach(function (x) {
    const v = normTask_(x, E);
    if (!v.id) v.id = uid_('t');
    // 親タスクの確認（自分自身や子孫を親にできない）
    if (v.parent) {
      let cur = Tt.find(v.parent), guard = 0;
      if (!cur || cur.deleted) v.parent = '';
      while (cur && guard++ < 50) {
        if (cur.id === v.id) throw appErr_('bad', '親タスクの指定が正しくありません（自分の子を親にはできません）');
        cur = cur.parent ? Tt.find(cur.parent) : null;
      }
    }
    const old = Tt.find(v.id);
    v.doneAt = v.status === '完了' ? (old && old.doneAt ? old.doneAt : now) : '';
    v.updatedAt = now;
    if (old) {
      const n = Tt.update(old, Object.assign(v, { version: old.version + 1 }));
      audit_(user, old.owner !== n.owner ? 'タスクを移動' : 'タスクを更新', n.title, taskSummary_(old), taskSummary_(n), 'アプリ');
      saved.push(taskPub_(n));
    } else {
      const n = Tt.insert(Object.assign(v, { deleted: false, deletedAt: '', createdBy: user.id, createdAt: now, version: 1 }));
      audit_(user, 'タスクを追加', n.title, '', taskSummary_(n), 'アプリ');
      saved.push(taskPub_(n));
    }
  });
  return { tasks: saved };
}

function normTask_(x, E) {
  const title = String(x.title || '').trim().slice(0, 100);
  if (!title) throw appErr_('bad', 'タスク名を入れてください');
  const owner = String(x.owner || '');
  if (!E.find(owner)) throw appErr_('bad', '担当の社員が見つかりません');
  const co = (Array.isArray(x.co) ? x.co : []).map(String).filter(function (id) { return id !== owner && E.find(id); });
  const priority = ['高', '中', '低'].indexOf(x.priority) >= 0 ? x.priority : '中';
  const status = ['未着手', '進行中', '一時停止', '完了'].indexOf(x.status) >= 0 ? x.status : '未着手';
  const weight = Math.min(5, Math.max(1, Math.round(Number(x.weight) || 1)));
  let progress = Math.min(100, Math.max(0, Math.round(Number(x.progress) || 0)));
  if (status === '完了') progress = 100;
  const rec = x.rec && REC[x.rec.type] ? x.rec : null;
  return {
    id: String(x.id || '').slice(0, 40), parent: String(x.parent || ''), title: title,
    detail: String(x.detail || '').slice(0, 2000), owner: owner, co: co.join(','),
    priority: priority, weight: weight, progress: progress, status: status,
    start: isDate_(x.start) ? x.start : '', due: isDate_(x.due) ? x.due : '',
    recType: rec ? rec.type : '',
    recDow: rec && rec.type === 'weekly' ? String(Math.min(6, Math.max(0, Number(rec.dow) || 0))) : '',
    recDom: rec && rec.type === 'monthly' ? String(Math.min(31, Math.max(1, Number(rec.dom) || 1))) : '',
    recOrigin: String(x.recOrigin || ''), memo: String(x.memo || '').slice(0, 2000),
    prevProgress: x.prevProgress == null || x.prevProgress === '' ? '' : String(Number(x.prevProgress) || 0)
  };
}

function canEditTask_(user, t) {
  return !!user.admin || t.owner === user.id || String(t.co || '').split(',').indexOf(user.id) >= 0 || t.createdBy === user.id;
}
function hDeleteTasks_(p, user) {
  const ids = (Array.isArray(p.ids) ? p.ids : []).map(String);
  const Tt = T_('tasks');
  ids.forEach(function (id) { const t = Tt.find(id); if (t && !canEditTask_(user, t)) throw appErr_('forbidden', '「' + t.title + '」は他の人のタスクなので、削除できません'); });
  const all = {};
  const add = function (id) {
    if (all[id]) return;
    all[id] = true;
    Tt.rows.filter(function (t) { return t.parent === id && !t.deleted; }).forEach(function (c) { add(c.id); });
  };
  ids.forEach(add);
  const now = nowStr_();
  const done = [];
  Object.keys(all).forEach(function (id) {
    const t = Tt.find(id);
    if (t && !t.deleted) { Tt.update(t, { deleted: true, deletedAt: now, updatedAt: now, version: t.version + 1 }); done.push(t); }
  });
  if (done.length) audit_(user, 'タスクを削除', done.map(function (t) { return t.title; }).join('、'), '', '削除の印をつけました（行は残っています）', 'アプリ');
  return { deleted: done.map(function (t) { return t.id; }) };
}

function hRestoreTasks_(p, user) {
  const ids = (Array.isArray(p.ids) ? p.ids : []).map(String);
  const Tt = T_('tasks');
  ids.forEach(function (id) { const t = Tt.find(id); if (t && !canEditTask_(user, t)) throw appErr_('forbidden', '他の人のタスクは元に戻せません'); });
  const now = nowStr_();
  const out = [];
  ids.forEach(function (id) {
    const t = Tt.find(id);
    if (t && t.deleted) out.push(taskPub_(Tt.update(t, { deleted: false, deletedAt: '', updatedAt: now, version: t.version + 1 })));
  });
  if (out.length) audit_(user, 'タスクを元に戻す', out.map(function (t) { return t.title; }).join('、'), '削除', '元に戻しました', 'アプリ');
  return { tasks: out };
}

/* ===== 業務マスター ===== */
function hSaveWorkType_(p, user) {
  const W = T_('workTypes');
  const kind = p.kind === 'plus' ? 'plus' : 'basic';
  const name = String(p.name || '').trim().slice(0, 60);
  if (!name) throw appErr_('bad', '業務名を入れてください');
  const now = nowStr_();
  const cur = p.id ? W.find(String(p.id)) : null;
  const dup = W.rows.filter(function (w) { return w.kind === kind && w.name === name && (!cur || w.id !== cur.id); })[0];
  if (dup) throw appErr_('bad', '同じ区分に同じ名前の業務があります');
  let w;
  if (cur) w = W.update(cur, { kind: kind, name: name, active: p.active !== false, updatedAt: now, version: cur.version + 1 });
  else w = W.insert({ id: uid_('w'), kind: kind, name: name, uses: 0, active: true, updatedAt: now, version: 1 });
  audit_(user, cur ? '業務マスターを更新' : '業務マスターに追加', KIND[kind] + '：' + name, '', '', 'アプリ');
  return { workType: wtPub_(w) };
}

/* ===== 社員（管理者だけ） ===== */
function hAddEmployee_(p, user) {
  const E = T_('employees');
  const name = String(p.name || '').trim().slice(0, 30);
  if (!name) throw appErr_('bad', '氏名を入れてください');
  const loginId = String(p.loginId || '').trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,20}$/.test(loginId)) throw appErr_('bad', 'ログインIDは半角の英数字3〜20文字にしてください');
  if (E.rows.some(function (x) { return x.loginId.toLowerCase() === loginId; })) throw appErr_('bad', 'そのログインIDはすでに使われています');
  const now = nowStr_();
  const order = E.rows.reduce(function (m, x) { return Math.max(m, x.order); }, 0) + 1;
  const e = E.insert({ id: uid_('e'), name: name, loginId: loginId, title: String(p.title || '').slice(0, 20),
    shift: p.shift === '日勤' ? '日勤' : '夜勤', admin: !!p.admin, active: true, order: order,
    createdAt: now, updatedAt: now, version: 1 });
  const temp = setTemp_(e.id);
  audit_(user, '社員を追加', name, '', 'ログインID：' + loginId, 'アプリ');
  return { employee: empPub_(e), tempPassword: temp };
}

function hUpdateEmployee_(p, user) {
  const E = T_('employees');
  const e = E.find(String(p.id || ''));
  if (!e) throw appErr_('bad', '社員が見つかりません');
  if (p.version != null && Number(p.version) !== e.version) throw appErr_('conflict', 'ほかの人が先に更新しました', { employee: empPub_(e) });
  const admin = p.admin == null ? e.admin : !!p.admin;
  if (e.admin && !admin && E.rows.filter(function (x) { return x.admin && x.active; }).length <= 1) {
    throw appErr_('bad', '管理者が1人もいなくなるため、管理者を外せません');
  }
  const n = E.update(e, {
    name: p.name != null ? String(p.name).trim().slice(0, 30) || e.name : e.name,
    title: p.title != null ? String(p.title).slice(0, 20) : e.title,
    shift: p.shift === '日勤' || p.shift === '夜勤' ? p.shift : e.shift,
    admin: admin, order: p.order != null ? Number(p.order) || e.order : e.order,
    updatedAt: nowStr_(), version: e.version + 1
  });
  forgetLogin_(n.id);
  audit_(user, '社員を更新', n.name, '', '', 'アプリ');
  return { employee: empPub_(n) };
}

function hRetireEmployee_(p, user) {
  const E = T_('employees');
  const e = E.find(String(p.id || ''));
  if (!e) throw appErr_('bad', '社員が見つかりません');
  if (e.id === user.id) throw appErr_('bad', '自分自身は退職にできません');
  if (e.admin && E.rows.filter(function (x) { return x.admin && x.active; }).length <= 1) throw appErr_('bad', '最後の管理者は退職にできません');
  const n = E.update(e, { active: false, updatedAt: nowStr_(), version: e.version + 1 });
  revokeSessions_(e.id);
  audit_(user, '社員を退職にした', e.name, '在籍', '退職（データは残っています）', 'アプリ');
  return { employee: empPub_(n) };
}

function hResetPassword_(p, user) {
  const e = T_('employees').find(String(p.id || ''));
  if (!e) throw appErr_('bad', '社員が見つかりません');
  const temp = setTemp_(e.id);
  audit_(user, 'パスワードをリセット', e.name, '', '', 'アプリ');
  return { tempPassword: temp };
}

function hSaveSettings_(p, user) {
  const S = T_('settings');
  const out = {};
  if (p.monthlyCost != null) {
    const v = Math.round(Number(p.monthlyCost));
    if (!(v >= 0)) throw appErr_('bad', '月の人件費は0以上の数にしてください');
    const r = S.find('monthlyCost');
    const before = r ? r.value : '';
    if (r) S.update(r, { value: String(v) }); else S.insert({ key: 'monthlyCost', label: '月の人件費（円）', value: String(v), note: '' });
    audit_(user, '人件費の設定を変更', '月の人件費', before, String(v), 'アプリ');
    out.monthlyCost = v;
  }
  return { settings: settingsMap_() };
}

/* ===== 月次レポート・月の締め ===== */
// その月の数字をまとめる（締めのときは、これをそのまま保存する）
function reportData_(x, ym) {
  const ag = monthAgg_(x, ym);
  const ymSlash = ym.replace('-', '/');
  const titleOf = function (id) { const t = T_('tasks').find(id); return t ? t.title + (t.deleted ? '（削除済み）' : '') : '（不明なタスク）'; };
  return {
    ym: ym, monthlyCost: x.COST, dayHours: x.DAYMIN / 60, total: ag.total,
    employees: ag.rows.map(function (rw) {
      const p = empProg_(x, rw.e.id);
      return { id: rw.e.id, name: rw.e.name, days: rw.s.days, rate: Math.round(rw.s.rate), cost: rw.cost,
        basicMin: Math.round(rw.s.basicMin), plusMin: Math.round(rw.s.plusMin),
        progress: Math.round(p.pct), roots: p.roots, doneRoots: p.done,
        doneInMonth: x.tasks.filter(function (t) { return t.owner === rw.e.id && t.doneAt && t.doneAt.slice(0, 7) === ymSlash; }).length };
    }),
    work: ag.work.map(function (w) { const i = w[0].indexOf('|'); return { kind: w[0].slice(0, i), name: w[0].slice(i + 1), min: Math.round(w[1].min), cost: Math.round(w[1].cost) }; }),
    task: ag.task.map(function (w) { return { id: w[0], title: titleOf(w[0]), min: Math.round(w[1].min), cost: Math.round(w[1].cost) }; })
  };
}
function hMonthReport_(p) {
  const ym = /^\d{4}-\d{2}$/.test(String(p.ym || '')) ? p.ym : bizToday_().slice(0, 7);
  const x = viewCtx_();
  const closings = {};
  T_('closings').rows.forEach(function (c) { closings[c.ym] = c; });
  const c = closings[ym];
  let rep;
  if (c && c.data) { rep = c.data; rep.closed = true; rep.closedAt = c.closedAt; rep.closedBy = c.closedBy; }
  else { rep = reportData_(x, ym); rep.closed = false; }
  rep.changedAfterClose = !!(c && c.data) && T_('reports').rows.some(function (r) { return r.date.slice(0, 7) === ym && r.changedAfterClose; });
  rep.canClose = ym < bizToday_().slice(0, 7);
  rep.current = ym === bizToday_().slice(0, 7);
  rep.trend = [];
  for (let i = 5; i >= 0; i--) {
    const m = shiftYm_(ym, -i), cc = closings[m];
    const d = cc && cc.data ? cc.data : reportData_(x, m);
    const sum = function (k) { return (d.employees || []).reduce(function (s, e) { return s + (e[k] || 0); }, 0); };
    rep.trend.push({ ym: m, basicMin: sum('basicMin'), plusMin: sum('plusMin'), days: sum('days'), cost: d.total || 0, closed: !!(cc && cc.data) });
  }
  return rep;
}
function hCloseMonth_(p, user) {
  const ym = String(p.ym || '');
  if (!/^\d{4}-\d{2}$/.test(ym)) throw appErr_('bad', '年月が正しくありません');
  if (!(ym < bizToday_().slice(0, 7))) throw appErr_('bad', 'この月はまだ終わっていません。翌月1日の朝8時以降に締めてください');
  const x = viewCtx_();
  const data = reportData_(x, ym);
  const C = T_('closings');
  const now = nowStr_();
  const cur = C.find(ym);
  if (cur) C.update(cur, { closedAt: now, closedBy: user.name, data: data });
  else C.insert({ ym: ym, closedAt: now, closedBy: user.name, data: data });
  // 締め直したので、その月の「確定後に変更あり」の印を消す
  const R = T_('reports');
  R.rows.filter(function (r) { return r.date.slice(0, 7) === ym && r.changedAfterClose; })
    .forEach(function (r) { R.update(r, { changedAfterClose: false }); });
  audit_(user, cur ? '月の締めを確定し直した' : '月を締めた', fmtYM_(ym), '', '人件費の合計 ' + yen_(data.total), 'アプリ');
  return { ym: ym, closedAt: now, closedBy: user.name };
}

/* ===== 毎朝の自動処理（定期タスクを作る） ===== */
function dailyJob() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try { makeRecurring_(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}

function makeRecurring_() {
  const today = bizToday_();
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7)), dom = Number(today.slice(8, 10));
  const dow = new Date(y, m - 1, dom).getDay();
  const lastDay = new Date(y, m, 0).getDate();
  const Tt = T_('tasks');
  const now = nowStr_();
  const groups = {};
  Tt.rows.filter(function (t) { return !t.deleted; }).forEach(function (t) {
    const g = t.recOrigin || t.id;
    (groups[g] = groups[g] || []).push(t);
  });
  let made = 0;
  Object.keys(groups).forEach(function (g) {
    const list = groups[g].sort(function (a, b) { return (a.start || '') < (b.start || '') ? -1 : 1; });
    const last = list[list.length - 1];
    if (!last.recType) return;
    const want = Number(last.recDom) || 1;
    const hit = last.recType === 'daily' ||
      (last.recType === 'weekly' && Number(last.recDow) === dow) ||
      (last.recType === 'monthly' && (want === dom || (want > lastDay && dom === lastDay)));
    if (!hit) return;
    if (list.some(function (t) { return t.start === today || t.due === today; })) return;
    Tt.insert({ id: uid_('t'), parent: last.parent, title: last.title, detail: last.detail, owner: last.owner, co: last.co,
      priority: last.priority, weight: last.weight, progress: 0, status: '未着手', start: today, due: today,
      recType: last.recType, recDow: last.recDow, recDom: last.recDom, recOrigin: g, memo: '', prevProgress: '', createdBy: last.createdBy || '',
      doneAt: '', deleted: false, deletedAt: '', createdAt: now, updatedAt: now, version: 1 });
    made++;
  });
  if (made) audit_({ name: '自動処理' }, '定期タスクを作成', made + '件', '', '', '自動');
  return made;
}

/* ===== スプレッドシートを直接さわったとき ===== */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    const name = sh.getName();
    if (name === SCHEMA.settings.sheet) { settingEdited_(e); return; }
    const key = Object.keys(SCHEMA).filter(function (k) { return SCHEMA[k].sheet === name; })[0];
    if (!key || ['audit', 'sessions', 'auth', 'closings'].indexOf(key) >= 0) return;
    if (e.range.getRow() < 2) return;
    const hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    const cU = hdr.indexOf('更新日時') + 1, cV = hdr.indexOf('版') + 1;
    const single = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;
    const colName = hdr[e.range.getColumn() - 1] || '';
    const n = Math.min(e.range.getNumRows(), 50);
    for (let i = 0; i < n; i++) {
      const r = e.range.getRow() + i;
      if (cU) sh.getRange(r, cU).setValue(nowStr_());
      if (cV) { const v = Number(sh.getRange(r, cV).getValue()) || 0; sh.getRange(r, cV).setValue(v + 1); }
      appendAudit_('（シートを直接操作）', 'スプレッドシートから直接変更',
        name + '／' + sh.getRange(r, 1).getDisplayValue() + '／' + (single ? colName : '複数のマス'),
        single ? String(e.oldValue == null ? '' : e.oldValue) : '', single ? String(e.value == null ? '' : e.value) : '', 'スプレッドシート');
    }
  } catch (err) {
    console.error(err);
  }
}

// 設定タブで「パスワードのリセット（本部長用）」を TRUE にしたとき
function settingEdited_(e) {
  const S = T_('settings');
  const flag = S.find('adminReset');
  if (!flag || String(flag.value).trim().toUpperCase() !== 'TRUE') return;
  const admins = T_('employees').rows.filter(function (x) { return x.admin && x.active; })
    .sort(function (a, b) { return a.order - b.order; });
  const out = S.find('adminResetResult');
  if (!admins.length) {
    if (out) S.update(out, { value: '管理者が見つかりません' });
  } else {
    const a = admins[0];
    const temp = setTemp_(a.id);
    if (out) S.update(out, { value: 'ログインID：' + a.loginId + '　仮パスワード：' + temp });
    appendAudit_('（シートを直接操作）', '本部長のパスワードをリセット', a.name, '', '', 'スプレッドシート');
  }
  S.update(flag, { value: 'FALSE' });
}

/* ===== はじめに1回だけ実行する準備 ===== */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(SCHEMA).forEach(ensureTable_);
  for (const k in TBL_) delete TBL_[k];

  const S = T_('settings');
  SETTING_DEFAULTS.forEach(function (d) {
    if (!S.find(d[0])) S.insert({ key: d[0], label: d[1], value: d[2], note: d[3] });
  });

  // データ置き場は非表示にする（設定タブだけは見えるまま）
  Object.keys(SCHEMA).forEach(function (k) {
    if (k === 'settings') return;
    const sh = ss.getSheetByName(SCHEMA[k].sheet);
    if (!sh.isSheetHidden()) sh.hideSheet();
  });

  let msg = '';
  const E = T_('employees');
  if (!E.rows.length) {
    const now = nowStr_();
    const e = E.insert({ id: uid_('e'), name: '本部長', loginId: 'honbu', title: '本部長', shift: '夜勤',
      admin: true, active: true, order: 1, createdAt: now, updatedAt: now, version: 1 });
    const temp = setTemp_(e.id);
    msg = '\n最初の管理者を作りました。\nログインID：honbu\n仮パスワード：' + temp + '\n（最初のログインで新しいパスワードに変えます）';
  }

  const trig = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  if (trig.indexOf('dailyJob') < 0) ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(DAY_START_HOUR).inTimezone(TZ).create();
  // 全体把握画面と社員タブを10分ごとに作り直す
  if (trig.indexOf('refreshViews') < 0) ScriptApp.newTrigger('refreshViews').timeBased().everyMinutes(10).create();
  SpreadsheetApp.flush();
  for (const k in TBL_) delete TBL_[k];
  refreshViews();
  ss.setActiveSheet(ss.getSheetByName(VIEW_SHEET));
  ss.moveActiveSheet(1);
  Logger.log('準備できました（本部アプリ v' + APP_VERSION + '）。' + msg);
}

function ensureTable_(name) {
  const def = SCHEMA[name];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(def.sheet);
  if (!sh) sh = ss.insertSheet(def.sheet);
  const header = sh.getLastRow() > 0
    ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (x) { return String(x).trim(); })
    : [];
  while (header.length && header[header.length - 1] === '') header.pop();
  def.cols.forEach(function (c) { if (header.indexOf(c[1]) < 0) header.push(c[1]); });  // 足りない列は右に足すだけ
  if (sh.getMaxColumns() < header.length) sh.insertColumnsAfter(sh.getMaxColumns(), header.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#eef3fd');
  sh.setFrozenRows(1);
  const rows = Math.max(sh.getMaxRows() - 1, 1);
  def.cols.forEach(function (c) {
    // 文字や日付の列は「書式なしテキスト」にして、日付などに勝手に変わらないようにする
    if (c[2] !== 'n' && c[2] !== 'b') sh.getRange(2, header.indexOf(c[1]) + 1, rows, 1).setNumberFormat('@');
  });
  return sh;
}

/* ===== データ置き場の読み書き ===== */
const TBL_ = {};
function T_(name) { if (!TBL_[name]) TBL_[name] = new Table_(name); return TBL_[name]; }

function Table_(name) {
  this.name = name;
  this.def = SCHEMA[name];
  this.sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.def.sheet);
  if (!this.sh) throw appErr_('setup', '「' + this.def.sheet + '」タブが見つかりません。GASの画面で setup を実行してください');
  const lastRow = this.sh.getLastRow(), lastCol = Math.max(this.sh.getLastColumn(), 1);
  const v = lastRow > 0 ? this.sh.getRange(1, 1, lastRow, lastCol).getValues() : [[]];
  this.header = v[0].map(function (x) { return String(x).trim(); });
  this.width = this.header.length;
  this.idx = {};
  const self = this;
  this.def.cols.forEach(function (c) {
    const i = self.header.indexOf(c[1]);
    if (i < 0) throw appErr_('setup', '「' + self.def.sheet + '」タブに「' + c[1] + '」の列がありません。setup を実行してください');
    self.idx[c[0]] = i;
  });
  this.rows = [];
  for (let r = 1; r < v.length; r++) {
    const raw = v[r];
    if (raw.every(function (x) { return x === '' || x === null; })) continue;
    const o = this.toObj_(raw);
    o._row = r + 1; o._raw = raw;
    this.rows.push(o);
  }
}
Table_.prototype.toObj_ = function (raw) {
  const o = {}, self = this;
  this.def.cols.forEach(function (c) { o[c[0]] = fromCell_(raw[self.idx[c[0]]], c); });
  return o;
};
Table_.prototype.toRow_ = function (o, base) {
  const row = base ? base.slice() : [];
  while (row.length < this.width) row.push('');
  const self = this;
  this.def.cols.forEach(function (c) { if (o[c[0]] !== undefined) row[self.idx[c[0]]] = toCell_(o[c[0]], c); });
  return row;
};
Table_.prototype.find = function (val, key) {
  key = key || this.def.cols[0][0];
  for (let i = 0; i < this.rows.length; i++) if (this.rows[i][key] === val) return this.rows[i];
  return null;
};
Table_.prototype.insert = function (o) {
  const row = this.toRow_(o, null);
  const r = this.sh.getLastRow() + 1;
  if (r > this.sh.getMaxRows()) this.sh.insertRowsAfter(this.sh.getMaxRows(), 200);
  this.sh.getRange(r, 1, 1, this.width).setValues([row]);
  const n = this.toObj_(row);
  n._row = r; n._raw = row;
  this.rows.push(n);
  return n;
};
Table_.prototype.insertMany = function (list) {
  if (!list.length) return [];
  const self = this;
  const rows = list.map(function (o) { return self.toRow_(o, null); });
  const r = this.sh.getLastRow() + 1;
  if (r + rows.length - 1 > this.sh.getMaxRows()) this.sh.insertRowsAfter(this.sh.getMaxRows(), rows.length + 200);
  this.sh.getRange(r, 1, rows.length, this.width).setValues(rows);
  return rows.map(function (row, i) { const n = self.toObj_(row); n._row = r + i; n._raw = row; self.rows.push(n); return n; });
};
Table_.prototype.update = function (cur, changes) {
  const merged = {};
  for (const k in cur) merged[k] = cur[k];
  for (const k in changes) merged[k] = changes[k];
  const row = this.toRow_(merged, cur._raw);
  this.sh.getRange(cur._row, 1, 1, this.width).setValues([row]);
  const n = this.toObj_(row);
  n._row = cur._row; n._raw = row;
  const i = this.rows.indexOf(cur);
  if (i >= 0) this.rows[i] = n;
  return n;
};
Table_.prototype.removeRow = function (cur) {
  this.sh.deleteRow(cur._row);
  const gone = cur._row;
  this.rows = this.rows.filter(function (x) { return x !== cur; });
  this.rows.forEach(function (x) { if (x._row > gone) x._row--; });
};

function fromCell_(v, c) {
  const t = c[2];
  if (v instanceof Date) {
    if (t === 'd') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
    if (t === 'n') return v.getTime();
    v = Utilities.formatDate(v, TZ, 'yyyy/MM/dd HH:mm:ss');
  }
  if (t === 'n') { if (v === '' || v === null || v === undefined) return 0; const n = Number(v); return isNaN(n) ? 0 : n; }
  if (t === 'b') return v === true || String(v).trim().toUpperCase() === 'TRUE';
  if (t === 'j') { if (v === '' || v == null) return null; try { return JSON.parse(v); } catch (e) { return null; } }
  const s = v == null ? '' : String(v).trim();
  if (t === 'd') {
    const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    return m ? m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]) : '';
  }
  if (c[3]) { for (const k in c[3]) if (c[3][k] === s) return k; }
  return s;
}
function toCell_(v, c) {
  const t = c[2];
  if (t === 'n') return (v === '' || v == null) ? '' : Number(v);
  if (t === 'b') return !!v;
  if (t === 'j') return v == null ? '' : JSON.stringify(v);
  if (c[3]) return v ? (c[3][v] || String(v)) : '';
  return v == null ? '' : String(v);
}

/* ===== アプリに返す形 ===== */
function empPub_(e) {
  return { id: e.id, name: e.name, loginId: e.loginId, title: e.title, shift: e.shift || '夜勤',
    admin: !!e.admin, active: !!e.active, order: e.order, version: e.version };
}
function wtPub_(w) { return { id: w.id, kind: w.kind, name: w.name, uses: w.uses, active: w.active !== false, version: w.version }; }
function taskPub_(t) {
  return {
    id: t.id, parent: t.parent || null, title: t.title, detail: t.detail, owner: t.owner,
    co: t.co ? t.co.split(',').filter(String) : [], priority: t.priority || '中', weight: t.weight || 1,
    progress: t.progress, status: t.status || '未着手', start: t.start, due: t.due,
    rec: t.recType ? { type: t.recType, dow: Number(t.recDow) || 0, dom: Number(t.recDom) || 1 } : null,
    recOrigin: t.recOrigin || '', memo: t.memo, prevProgress: t.prevProgress === '' ? null : Number(t.prevProgress),
    doneAt: t.doneAt, deleted: !!t.deleted, createdBy: t.createdBy || '', version: t.version
  };
}
function reportPub_(r, items) {
  return {
    key: r.id, empId: r.empId, date: r.date, status: r.status, submittedAt: r.submittedAt,
    changedAfterClose: !!r.changedAfterClose, version: r.version,
    items: (items || []).slice().sort(function (a, b) { return a.seq - b.seq; }).map(function (i) {
      return { id: i.id, kind: i.kind, name: i.name, min: i.min, memo: i.memo, taskId: i.taskId };
    })
  };
}
function settingsMap_() {
  const m = {};
  T_('settings').rows.forEach(function (r) { m[r.key] = r.value; });
  return { monthlyCost: Number(m.monthlyCost) || 300000, dayHours: Number(m.dayHours) || 11, dayStart: Number(m.dayStart) || DAY_START_HOUR };
}

/* ===== 操作履歴 ===== */
function audit_(user, action, target, before, after, via) {
  appendAudit_(user && user.name || '', action, target, before, after, via);
}
function appendAudit_(by, action, target, before, after, via) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SCHEMA.audit.sheet);
  if (!sh) return;
  const cache = CacheService.getScriptCache();
  let hdr = null;
  try { hdr = JSON.parse(cache.get('audHdr') || 'null'); } catch (e) { hdr = null; }
  if (!hdr) { hdr = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String); cache.put('audHdr', JSON.stringify(hdr), 21600); }
  const row = new Array(hdr.length).fill('');
  const put = function (label, val) { const i = hdr.indexOf(label); if (i >= 0) row[i] = String(val == null ? '' : val).slice(0, 500); };
  put('日時', nowStr_()); put('操作した人', by); put('操作', action); put('対象', target);
  put('変更前', before); put('変更後', after); put('経路', via);
  const r = sh.getLastRow() + 1;
  if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 500);
  sh.getRange(r, 1, 1, hdr.length).setValues([row]);
}
function taskSummary_(t) {
  return t.status + ' ' + t.progress + '%／担当 ' + empName_(t.owner) + (t.due ? '／期限 ' + t.due : '') + (t.deleted ? '／削除' : '');
}
function reportSummary_(r, items) {
  const total = (items || []).reduce(function (s, i) { return s + i.min; }, 0);
  return (REPORT_ST[r.status] || r.status) + '／' + (items || []).length + '件 ' + (total / 60) + '時間';
}

/* ===== 小道具 ===== */
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function appErr_(code, message, data) { const e = new Error(message); e.appCode = code; e.data = data; return e; }
function nowStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss'); }
function bizToday_() { return Utilities.formatDate(new Date(Date.now() - DAY_START_HOUR * 3600 * 1000), TZ, 'yyyy-MM-dd'); }
function isDate_(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function pad2_(n) { return ('0' + n).slice(-2); }
function uid_(prefix) { return prefix + Date.now().toString(36) + Utilities.getUuid().replace(/-/g, '').slice(0, 6); }
function empName_(id) { const e = T_('employees').find(id); return e ? e.name : (id || ''); }
function monthEdge_(ymd, offset, first) {
  const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(5, 7)) - 1 + offset;
  const d = first ? new Date(y, m, 1) : new Date(y, m + 1, 0);
  return d.getFullYear() + '-' + pad2_(d.getMonth() + 1) + '-' + pad2_(d.getDate());
}
function hex_(bytes) { return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function hashPw_(pw, salt) {
  let h = sha_(salt + ':' + pw);
  for (let i = 0; i < HASH_ROUNDS; i++) h = sha_(h + ':' + salt);
  return h;
}

/* =====================================================================
 * スプレッドシートの表示（全体把握画面・社員タブ）  v1.2.0
 * ・見た目：紺を基調にした業務用レポートの形
 * ・速さ：日付のマスを押したときは「選んだ日付」を1か所書き換えるだけ。
 *   その日の内容は、10分ごとに用意しておいた「表示用データ」から数式で表示する
 * ===================================================================== */
const VIEW_SHEET = '全体把握画面';
const VIEW_DATA = '表示用データ';
const VIEW_COLS = 8;        // A〜H列を使う
const STATE_COL = 10;       // J列（非表示）に、表示中の年月・日付などを覚えておく
const C_ = {
  navy: '#1b2a41', navy2: '#2f4b6e', btn: '#3a6ea5', btnText: '#ffffff', sub: '#6b7585', title: '#1b2a41', text: '#273142',
  line: '#d9dee7', zebra: '#f6f8fb', card: '#f4f7fb', red: '#c62828', redBg: '#fdf1f1', blue: '#1f6fd1', blueBg: '#f3f7fd',
  sel: '#d7e6f8', today: '#fff3e0', orange: '#e37400', blank: '#fafbfc', white: '#ffffff', bar: '#3a6ea5'
};

// 10分ごと（と setup のとき）に動く
function refreshViews() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    for (const k in TBL_) delete TBL_[k];
    buildOverview_();
    buildEmpTabs_();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

// 全体把握画面のマスを押したとき
function onSelectionChange(e) {
  try {
    const rg = e && e.range;
    if (!rg || rg.getNumRows() !== 1 || rg.getNumColumns() !== 1) return;
    const sh = rg.getSheet();
    if (sh.getName() !== VIEW_SHEET) return;
    const r = rg.getRow(), c = rg.getColumn();
    const st = viewState_(sh);
    // 日付のマス：選んだ日付を1か所書き換えるだけ（下の表は数式ですぐ切り替わる）
    if (st.calStart && r >= st.calStart && r < st.calStart + st.weeks && c <= 7) {
      const n = (r - st.calStart) * 7 + (c - 1) - st.first + 1;
      if (n < 1 || n > daysIn_(st.ym)) return;
      const day = st.ym + '-' + pad2_(n);
      if (day !== st.d) sh.getRange(2, STATE_COL).setValue(day);
      return;
    }
    // 前の月・次の月・最新にする：表を作り直す
    let ym = st.ym;
    if (r === 2 && c === 1) ym = shiftYm_(st.ym, -1);
    else if (r === 2 && c === 7) ym = shiftYm_(st.ym, 1);
    else if (!(r === 1 && c === 8)) return;
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) return;
    try {
      const now = viewState_(sh);
      if (!(r === 1 && c === 8) && now.ym === ym) return;
      sh.getRange(3, 1).setValue('読み込み中…（数秒かかります）');
      SpreadsheetApp.flush();
      for (const k in TBL_) delete TBL_[k];
      buildOverview_(ym, ym === now.ym ? now.d : defaultDay_(ym));
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(err);
  }
}

/* ---------- 全体把握画面 ---------- */
function buildOverview_(ymArg, dayArg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureViewSheet_();
  const st = viewState_(sh);
  const ym = ymArg || st.ym;
  const sel = dayArg || (st.d.slice(0, 7) === ym ? st.d : defaultDay_(ym));
  const x = viewCtx_();
  const N = x.emps.length;
  writeViewData_(ss, x, ym);   // その月の毎日の内容を用意しておく

  const o = new Out_();
  const D = "'" + VIEW_DATA + "'!";
  const btn = function (v) { return { v: v, b: true, fc: C_.btnText, bg: C_.btn, al: 'center' }; };
  const band = function (cells, h) { return o.row(cells.map(function (c) { c = typeof c === 'object' ? c : { v: c }; if (!c.bg) c.bg = C_.navy; if (!c.fc) c.fc = C_.white; return c; }), { h: h }); };

  // 見出しの帯
  band([{ v: '本部アプリ　全体把握画面', b: true, fs: 15 }, '', '', '', '', '', { v: '更新 ' + nowStr_().slice(5, 16), fs: 9, fc: '#b9c4d6', al: 'right' }, btn('↻ 最新にする')], 36);
  band([btn('◀ 前の月'), { v: fmtYM_(ym), b: true, fs: 16, al: 'center' }, '', '', '', '', btn('次の月 ▶'), ''], 34);
  o.merge(2, 2, 1, 5);
  o.row([{ v: '日付のマスを押すと、下の「その日の内容」がすぐ切り替わります。表は10分ごとに自動で最新になります（直接書き換えても元に戻ります）。', fs: 9, fc: C_.sub }], { h: 24 });

  // カレンダー
  const dows = ['日', '月', '火', '水', '木', '金', '土'];
  const hr = o.row(dows.map(function (w, i) { return { v: w, b: true, al: 'center', bg: '#e9eef5', fc: i === 0 ? C_.red : i === 6 ? C_.blue : C_.title }; }).concat(['']), { h: 26 });
  const first = dowOfDay_(ym + '-01'), n = daysIn_(ym);
  const weeks = Math.ceil((first + n) / 7);
  const calStart = o.rows.length + 1;
  const rich = [];
  for (let w = 0; w < weeks; w++) {
    const cells = [], rrow = [];
    for (let i = 0; i < 7; i++) {
      const num = w * 7 + i - first + 1;
      if (num < 1 || num > n) { cells.push({ v: '', bg: C_.blank }); rrow.push(null); continue; }
      const d = ym + '-' + pad2_(num), hol = holName_(d), fut = d > x.today, isToday = d === x.today;
      const dayColor = fut ? '#9aa3af' : (i === 0 || hol) ? C_.red : i === 6 ? C_.blue : C_.title;
      const parts = [{ t: String(num), s: { b: true, fs: 12, fc: dayColor } }];
      if (isToday) parts.push({ t: '  今日', s: { b: true, fs: 9, fc: C_.orange } });
      if (hol) parts.push({ t: '  ' + hol, s: { fs: 9, fc: C_.red } });
      if (!fut) {
        const s = dayStats_(x, d);
        parts.push({ t: '\n出勤 ' + s.nIn + '/' + N, s: { fs: 9, fc: '#4a5568' } });
        parts.push({ t: '\n日報 ' + s.nSub, s: { fs: 9, fc: '#4a5568' } });
        if (s.warn.length) parts.push({ t: '\n未提出 ' + s.warn.length, s: { fs: 9, b: true, fc: C_.red } });
      }
      cells.push({ v: parts.map(function (p) { return p.t; }).join(''), wrap: true, va: 'top',
        bg: isToday ? C_.today : (i === 0 || hol) ? C_.redBg : i === 6 ? C_.blueBg : C_.white });
      rrow.push(parts);
    }
    o.row(cells, { h: 78 });
    rich.push(rrow);
  }
  o.rich(calStart, 1, rich);
  o.border(hr, 1, weeks + 1, 7, 'all');
  o.row([], { h: 14 });

  // その日のまとめ（数式で「表示用データ」から引く）
  const sumTitle = o.row([{ f: '=IFERROR(VLOOKUP($J$2,' + D + '$A:$B,2,FALSE),"")&"　その日のまとめ"', b: true, fs: 13, fc: C_.title }], { h: 30 });
  o.section(sumTitle);
  const kl = o.row(['出勤', '欠勤', '未登録', '日報 提出', '日報 未提出'].map(function (v) { return { v: v, fs: 9, fc: C_.sub, bg: C_.card, al: 'center' }; }), { h: 22 });
  const kv = o.row([3, 4, 5, 6, 7].map(function (k) { return { f: '=IFERROR(VLOOKUP($J$2,' + D + '$A:$G,' + k + ',FALSE),"")', b: true, fs: 15, fc: C_.title, bg: C_.card, al: 'center' }; }), { h: 36 });
  o.border(kl, 1, 2, 5, 'cards');
  o.cond('=LEFT($E$' + kv + ',2)<>"0人"', 'E' + kv + ':E' + kv, { fc: C_.red });
  o.row([], { h: 14 });

  // その日の一人ひとり（数式で人数分の行に広がる）
  const ppTitle = o.row([{ f: '=IFERROR(VLOOKUP($J$2,' + D + '$A:$B,2,FALSE),"")&"　一人ひとり"', b: true, fs: 13, fc: C_.title }], { h: 30 });
  o.section(ppTitle);
  const ph = o.head(['社員', '出勤', '日報', '基本業務', '＋α業務', '業務内容', '', '']);
  const p0 = o.row([{ f: '=IFERROR(FILTER(' + D + '$J:$O,' + D + '$I:$I=$J$2),"")' }], { h: 24 });
  for (let i = 1; i < Math.max(N, 1); i++) o.row([], { h: 24 });
  const pRange = 'A' + p0 + ':H' + (p0 + Math.max(N, 1) - 1);
  o.cond('=$C' + p0 + '="未提出"', pRange, { fc: C_.red, b: true });
  o.cond('=ISEVEN(ROW())', pRange, { bg: C_.zebra });
  o.align(p0, 2, Math.max(N, 1), 1, 'center');
  o.align(p0, 4, Math.max(N, 1), 2, 'right');
  o.border(ph, 1, Math.max(N, 1) + 1, 8, 'table');
  o.row([], { h: 14 });

  // 一人ひとりの進み具合
  const prTitle = o.row([{ v: '一人ひとりの進み具合', b: true, fs: 13, fc: C_.title }, '', '', { v: '主担当のタスクすべてを比重で計算（一時停止中も含む）', fs: 9, fc: C_.sub }], { h: 30 });
  o.section(prTitle);
  const prh = o.head(['社員', '全体の進捗', '', '完了', '期限超過', 'タスク', '進捗', '期限']);
  let zebra = false;
  x.emps.forEach(function (e) {
    zebra = !zebra;
    const bg = zebra ? C_.white : C_.zebra;
    const p = empProg_(x, e.id), ts = rootTasks_(x, e.id).sort(function (a, b) { return cmpTask_(x, a, b); });
    const head = [{ v: e.name, b: true, bg: bg }, { f: spark_(p.pct), bg: bg }, { v: Math.round(p.pct) + '%', b: true, al: 'right', bg: bg, fc: C_.bar },
      { v: p.done + ' / ' + p.roots, al: 'center', bg: bg }, { v: p.over ? p.over + '件' : '—', al: 'center', fc: p.over ? C_.red : C_.sub, b: p.over > 0, bg: bg }];
    if (!ts.length) { o.row(head.concat([{ v: '主担当のタスクはありません', fc: C_.sub, bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }]), { h: 26 }); return; }
    ts.forEach(function (t, i) {
      const q = x.prog(t), od = overdue_(x, t);
      const left = i === 0 ? head : [{ v: '', bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }];
      o.row(left.concat([{ v: t.title + (q >= 100 ? '（完了）' : ''), fc: q >= 100 ? C_.sub : C_.text, bg: bg, wrap: true },
        { v: Math.round(q) + '%', al: 'right', bg: bg }, { v: t.due ? fmtMD_(t.due) + (od ? '　超過' : '') : '', fc: od ? C_.red : C_.text, b: od, bg: bg }]), { h: 26 });
    });
  });
  o.border(prh, 1, o.rows.length - prh + 1, 8, 'table');
  o.row([], { h: 14 });

  // 期限超過・重要タスク
  const taskTable = function (title, list) {
    const tt = o.row([{ v: title, b: true, fs: 13, fc: C_.title }, '', '', { v: list.length + '件', b: true, fc: list.length && title.indexOf('超過') >= 0 ? C_.red : C_.sub }], { h: 30 });
    o.section(tt);
    const h = o.head(['タスク', '', '', '担当', '期限', '進捗', '', '']);
    if (!list.length) o.row([{ v: 'ありません', fc: C_.sub }], { h: 26 });
    list.forEach(function (t, i) {
      const od = overdue_(x, t), bg = i % 2 ? C_.zebra : C_.white;
      o.row([{ v: t.title, bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }, { v: empNameIn_(x, t.owner), bg: bg },
        { v: t.due ? fmtMD_(t.due) : '', fc: od ? C_.red : C_.text, b: od, bg: bg }, { v: Math.round(x.prog(t)) + '%', al: 'right', bg: bg }], { h: 26 });
    });
    o.border(h, 1, o.rows.length - h + 1, 6, 'table');
    o.row([], { h: 14 });
  };
  taskTable('期限超過のタスク', x.tasks.filter(function (t) { return overdue_(x, t) && !(x.kids[t.id] || []).length; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; }));
  taskTable('重要タスク（優先度 高）', x.tasks.filter(function (t) { return t.priority === '高' && x.prog(t) < 100; }).sort(function (a, b) { return cmpTask_(x, a, b); }));

  // 今月のまとめ
  const ag = monthAgg_(x, ym);
  const mt = o.row([{ v: fmtYM_(ym) + 'のまとめ', b: true, fs: 13, fc: C_.title }, '', '', { v: ym === x.today.slice(0, 7) ? '月の途中なので暫定の数字です' : '', fs: 9, fc: C_.sub }], { h: 30 });
  o.section(mt);
  const mh = o.head(['社員', '出勤日数', '時給', '人件費', '基本業務', '＋α業務', '', '']);
  ag.rows.forEach(function (rw, i) {
    const bg = i % 2 ? C_.zebra : C_.white;
    o.row([{ v: rw.e.name, b: true, bg: bg }, { v: rw.s.days + '日', al: 'right', bg: bg }, { v: rw.s.days ? yen_(rw.s.rate) : '—', al: 'right', bg: bg },
      { v: yen_(rw.cost), al: 'right', bg: bg }, { v: fmtH_(rw.s.basicMin), al: 'right', bg: bg }, { v: fmtH_(rw.s.plusMin), al: 'right', bg: bg }], { h: 26 });
  });
  const tot = o.row([{ v: '合計', b: true, bg: '#e9eef5' }, { v: '', bg: '#e9eef5' }, { v: '', bg: '#e9eef5' }, { v: yen_(ag.total), b: true, al: 'right', bg: '#e9eef5' }, { v: '', bg: '#e9eef5' }, { v: '', bg: '#e9eef5' }], { h: 28 });
  o.border(mh, 1, tot - mh + 1, 6, 'table');
  o.row([], { h: 14 });

  const wt = o.row([{ v: '業務別の人件費', b: true, fs: 13, fc: C_.title }], { h: 30 });
  o.section(wt);
  const wh = o.head(['業務名', '', '区分', '時間', '人件費', '', '', '']);
  if (!ag.work.length) o.row([{ v: 'この月のデータはありません', fc: C_.sub }], { h: 26 });
  ag.work.forEach(function (w, i) {
    const k = w[0].indexOf('|'), bg = i % 2 ? C_.zebra : C_.white;
    o.row([{ v: w[0].slice(k + 1), bg: bg }, { v: '', bg: bg }, { v: w[0].slice(0, k) === 'plus' ? '＋α業務' : '基本業務', bg: bg }, { v: fmtH_(w[1].min), al: 'right', bg: bg }, { v: yen_(w[1].cost), al: 'right', bg: bg }], { h: 26 });
  });
  o.border(wh, 1, o.rows.length - wh + 1, 5, 'table');
  o.row([], { h: 14 });

  const kt = o.row([{ v: 'タスク別の累計人件費', b: true, fs: 13, fc: C_.title }], { h: 30 });
  o.section(kt);
  const kh = o.head(['タスク', '', '', '時間', '人件費', '', '', '']);
  if (!ag.task.length) o.row([{ v: 'タスクに紐づいた＋α業務はまだありません', fc: C_.sub }], { h: 26 });
  ag.task.forEach(function (w, i) {
    const t = x.byId[w[0]], bg = i % 2 ? C_.zebra : C_.white;
    o.row([{ v: t ? t.title : w[0], bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }, { v: fmtH_(w[1].min), al: 'right', bg: bg }, { v: yen_(w[1].cost), al: 'right', bg: bg }], { h: 26 });
  });
  o.border(kh, 1, o.rows.length - kh + 1, 5, 'table');

  // 選んだ日のマスを青くする（日付を押したときは数式だけで色が変わる）
  o.cond('=AND(A' + calStart + '<>"",IFERROR(VALUE(REGEXEXTRACT(A' + calStart + ',"^\\d+")),0)=VALUE(RIGHT($J$2,2)))',
    'A' + calStart + ':G' + (calStart + weeks - 1), { bg: C_.sel });

  o.write(sh);
  if (st.layout !== 'L3') { sh.setHiddenGridlines(true); for (let c = 1; c <= VIEW_COLS; c++) sh.setColumnWidth(c, c === 1 ? 128 : 116); }
  sh.getRange(1, STATE_COL, 6, 1).setNumberFormat('@').setValues([[ym], [sel], [String(calStart)], [String(first)], ['L3'], [String(weeks)]]);
}

// その月の毎日の「まとめ」と「一人ひとり」を、非表示の「表示用データ」タブに書いておく
function writeViewData_(ss, x, ym) {
  let sh = ss.getSheetByName(VIEW_DATA);
  if (!sh) sh = ss.insertSheet(VIEW_DATA);
  if (!sh.isSheetHidden()) { try { sh.hideSheet(); } catch (err) { /* 隠せないときはそのまま */ } }
  const days = [], people = [];
  for (let i = 1; i <= daysIn_(ym); i++) {
    const d = ym + '-' + pad2_(i), s = dayStats_(x, d);
    days.push([d, fmtMD_(d), s.nIn + '人', s.nOff + '人', s.unreg + '人', s.nSub + '人', s.warn.length ? s.warn.length + '人（' + s.warn.join('、') + '）' : '0人']);
    x.emps.forEach(function (e) {
      const key = e.id + '|' + d, a = x.att[key] || '', r = x.reports[key], sub = r && r.status === 'submitted';
      const items = sub ? (x.items[key] || []).slice().sort(function (p, q) { return p.seq - q.seq; }) : [];
      const c = calc_(x, items), f = c.over ? x.DAYMIN / c.total : 1;
      let work = '';
      if (a === 'in') {
        work = sub ? items.map(function (it) { return it.name + ' ' + fmtH_(it.min) + (it.memo ? '（' + it.memo + '）' : ''); }).join('、') + (c.other ? (items.length ? '、' : '') + 'その他の基本業務 ' + fmtH_(c.other) : '')
          : '日報 未提出（その他の基本業務 ' + fmtH_(x.DAYMIN) + ' として計算）';
      }
      people.push([d, e.name, a === 'in' ? '〇' : a === 'off' ? '×' : '',
        sub ? '提出済み' : (r && r.status === 'draft' ? '下書き' : (a === 'in' && d <= x.today ? '未提出' : '')),
        a === 'in' ? fmtH_(sub ? x.DAYMIN - c.plus * f : x.DAYMIN) : '', a === 'in' && sub ? fmtH_(c.plus * f) : '', work]);
    });
  }
  sh.clearContents();
  const txt = function (rows) { return rows.map(function (r) { return r.map(function (v) { return v === '' ? '' : "'" + v; }); }); };
  if (sh.getMaxColumns() < 15) sh.insertColumnsAfter(sh.getMaxColumns(), 15 - sh.getMaxColumns());
  const need = Math.max(days.length, people.length) + 2;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  if (days.length) sh.getRange(1, 1, days.length, 7).setValues(txt(days));
  if (people.length) sh.getRange(1, 9, people.length, 7).setValues(txt(people));
}

/* ---------- 社員ごとのタブ（非表示） ---------- */
function buildEmpTabs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const view = ss.getSheetByName(VIEW_SHEET);
  const ym = view ? viewState_(view).ym : bizToday_().slice(0, 7);
  const x = viewCtx_();
  x.allEmps.forEach(function (e) {
    let sh = empSheet_(ss, e.id);
    if (!sh) {
      if (!e.active) return;
      sh = ss.insertSheet(freeName_(ss, e.name, e.loginId));
      sh.addDeveloperMetadata('honbu-emp', e.id);
    } else {
      const want = e.name;
      if (sh.getName() !== want && !ss.getSheetByName(want) && !isReservedName_(want)) sh.setName(want);
    }
    if (!sh.isSheetHidden()) { try { sh.hideSheet(); } catch (err) { /* 見えるタブが1つだけのときは隠せない */ } }
    if (!e.active) return;
    const o = new Out_();
    o.row([{ v: e.name + (e.title ? '（' + e.title + '）' : ''), b: true, fs: 15 }, { v: '' }, { v: e.shift, fc: '#b9c4d6' }, '', '', '', '', { v: '更新 ' + nowStr_().slice(5, 16), fs: 9, fc: '#b9c4d6', al: 'right' }]
      .map(function (c) { c = typeof c === 'object' ? c : { v: c }; c.bg = C_.navy; if (!c.fc) c.fc = C_.white; return c; }), { h: 36 });
    o.row([{ v: 'データ置き場から自動で作る表です。直接書き換えても、次の更新で元に戻ります。', fs: 9, fc: C_.sub }], { h: 24 });
    const t1 = o.row([{ v: fmtYM_(ym) + 'の日報', b: true, fs: 13, fc: C_.title }], { h: 30 });
    o.section(t1);
    const h = o.head(['日付', '出勤', '日報', '区分', '業務名', '時間', 'メモ', '']);
    let k = 0;
    for (let i = daysIn_(ym); i >= 1; i--) {
      const d = ym + '-' + pad2_(i), key = e.id + '|' + d, a = x.att[key] || '', r = x.reports[key];
      if (!a && !r) continue;
      const bg = (k++ % 2) ? C_.zebra : C_.white;
      const items = r ? (x.items[key] || []).slice().sort(function (p, q) { return p.seq - q.seq; }) : [];
      const stTxt = r ? (r.status === 'submitted' ? '提出済み' : '下書き') : (a === 'in' && d <= x.today ? '未提出' : '');
      const base = [{ v: fmtMD_(d), b: true, bg: bg }, { v: a === 'in' ? '〇' : a === 'off' ? '×' : '', al: 'center', bg: bg, fc: a === 'in' ? C_.blue : C_.sub },
        { v: stTxt, fc: stTxt === '未提出' ? C_.red : C_.text, b: stTxt === '未提出', bg: bg }];
      const blank3 = [{ v: '', bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }];
      if (!items.length) { o.row(base.concat([{ v: '', bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }]), { h: 24 }); continue; }
      items.forEach(function (it, j) {
        o.row((j ? blank3 : base).concat([{ v: it.kind === 'plus' ? '＋α' : '基本', bg: bg, fc: it.kind === 'plus' ? C_.blue : C_.text }, { v: it.name, bg: bg },
          { v: fmtH_(it.min), al: 'right', bg: bg }, { v: it.memo, bg: bg }]), { h: 24 });
      });
    }
    o.border(h, 1, o.rows.length - h + 1, 7, 'table');
    o.row([], { h: 14 });
    const t2 = o.row([{ v: 'タスク', b: true, fs: 13, fc: C_.title }], { h: 30 });
    o.section(t2);
    const h2 = o.head(['タスク', '', '', '担当', '進捗', '状態', '期限', '']);
    const mine = x.tasks.filter(function (t) { return t.owner === e.id || String(t.co || '').split(',').indexOf(e.id) >= 0; })
      .sort(function (a, b) { return cmpTask_(x, a, b); });
    if (!mine.length) o.row([{ v: 'タスクはありません', fc: C_.sub }], { h: 24 });
    mine.forEach(function (t, i) {
      const q = x.prog(t), od = overdue_(x, t), bg = i % 2 ? C_.zebra : C_.white;
      o.row([{ v: (t.parent ? '　└ ' : '') + t.title, bg: bg }, { v: '', bg: bg }, { v: '', bg: bg }, { v: t.owner === e.id ? '主担当' : '共同', bg: bg },
        { v: Math.round(q) + '%', al: 'right', bg: bg }, { v: q >= 100 ? '完了' : t.status, bg: bg }, { v: t.due ? fmtMD_(t.due) : '', fc: od ? C_.red : C_.text, b: od, bg: bg }], { h: 24 });
    });
    o.border(h2, 1, o.rows.length - h2 + 1, 7, 'table');
    o.write(sh);
    const flag = sh.getRange(1, STATE_COL).getDisplayValue();
    if (flag !== 'L3') {
      sh.setHiddenGridlines(true);
      for (let c = 1; c <= VIEW_COLS; c++) sh.setColumnWidth(c, c === 5 || c === 7 ? 170 : 104);
      sh.getRange(1, STATE_COL).setNumberFormat('@').setValue('L3');
    }
  });
}
function empSheet_(ss, empId) {
  const found = ss.createDeveloperMetadataFinder().withKey('honbu-emp').withValue(empId).find();
  for (let i = 0; i < found.length; i++) {
    const loc = found[i].getLocation();
    if (loc && loc.getSheet && loc.getSheet()) return loc.getSheet();
  }
  return null;
}
function isReservedName_(name) {
  return name === VIEW_SHEET || name === VIEW_DATA || name === '通信テスト' || Object.keys(SCHEMA).some(function (k) { return SCHEMA[k].sheet === name; });
}
function freeName_(ss, name, loginId) {
  let n = isReservedName_(name) ? name + '（' + loginId + '）' : name;
  if (ss.getSheetByName(n)) n = name + '（' + loginId + '）';
  return n;
}

/* ---------- 表を書き出す道具 ---------- */
function Out_() { this.rows = []; this.opts = []; this.borders = []; this.merges = []; this.riches = []; this.conds = []; this.aligns = []; }
Out_.prototype.row = function (cells, opt) {
  const r = [];
  for (let i = 0; i < VIEW_COLS; i++) {
    const c = cells[i];
    r.push(c == null ? { v: '' } : (typeof c === 'object' ? c : { v: c }));
  }
  this.rows.push(r);
  this.opts.push(opt || {});
  return this.rows.length;
};
// 表の見出し行（紺の帯に白い文字）
Out_.prototype.head = function (labels) {
  return this.row(labels.map(function (v) { return v === '' ? { v: '', bg: C_.navy2 } : { v: v, b: true, fc: C_.white, bg: C_.navy2, fs: 9 }; }).slice(0, VIEW_COLS), { h: 26 });
};
// 見出しの下に紺の線を引く
Out_.prototype.section = function (r) { this.borders.push([r, 1, 1, VIEW_COLS, 'section']); };
Out_.prototype.border = function (r, c, nr, nc, kind) { if (nr > 0) this.borders.push([r, c, nr, nc, kind]); };
Out_.prototype.merge = function (r, c, nr, nc) { this.merges.push([r, c, nr, nc]); };
Out_.prototype.rich = function (r, c, grid) { this.riches.push([r, c, grid]); };
Out_.prototype.cond = function (formula, a1, style) { this.conds.push([formula, a1, style]); };
Out_.prototype.align = function (r, c, nr, nc, al) { this.aligns.push([r, c, nr, nc, al]); };
Out_.prototype.write = function (sh) {
  const n = Math.max(this.rows.length, 1);
  if (sh.getMaxRows() < n + 5) sh.insertRowsAfter(sh.getMaxRows(), n + 5 - sh.getMaxRows());
  if (sh.getMaxColumns() < STATE_COL) sh.insertColumnsAfter(sh.getMaxColumns(), STATE_COL - sh.getMaxColumns());
  const clearN = Math.min(Math.max(sh.getLastRow(), n) + 2, sh.getMaxRows());
  const all = sh.getRange(1, 1, clearN, VIEW_COLS);
  all.breakApart();
  all.clearContent();
  all.clearFormat();
  sh.setConditionalFormatRules([]);
  sh.setRowHeights(1, clearN, 21);
  const rows = this.rows, opts = this.opts;
  const pick = function (f) { return rows.map(function (r, i) { return r.map(function (c) { return f(c, opts[i]); }); }); };
  const rg = sh.getRange(1, 1, n, VIEW_COLS);
  // 文字は先頭に ' をつけて、「4/5」などが日付に変わらないようにする（' は表示されない）
  rg.setValues(pick(function (c) { return c.f ? c.f : (c.v == null || c.v === '' ? '' : "'" + String(c.v)); }));
  rg.setBackgrounds(pick(function (c) { return c.bg || C_.white; }));
  rg.setFontColors(pick(function (c) { return c.fc || C_.text; }));
  rg.setFontWeights(pick(function (c) { return c.b ? 'bold' : 'normal'; }));
  rg.setFontSizes(pick(function (c) { return c.fs || 10; }));
  rg.setHorizontalAlignments(pick(function (c) { return c.al || 'left'; }));
  rg.setVerticalAlignments(pick(function (c) { return c.va || 'middle'; }));
  rg.setWraps(pick(function (c) { return !!c.wrap; }));
  // 行の高さ（同じ高さが続く行はまとめて1回で）
  let i = 0;
  while (i < n) {
    const h = (opts[i] && opts[i].h) || 21;
    let j = i;
    while (j + 1 < n && ((opts[j + 1] && opts[j + 1].h) || 21) === h) j++;
    if (h !== 21) sh.setRowHeights(i + 1, j - i + 1, h);
    i = j + 1;
  }
  this.aligns.forEach(function (a) { sh.getRange(a[0], a[1], a[2], a[3]).setHorizontalAlignment(a[4]); });
  this.merges.forEach(function (m) { sh.getRange(m[0], m[1], m[2], m[3]).merge(); });
  // カレンダーの文字（日付を太く、未提出を赤く）
  this.riches.forEach(function (rc) {
    const grid = rc[2].map(function (row) {
      return row.map(function (parts) {
        if (!parts) return SpreadsheetApp.newRichTextValue().setText('').build();
        const text = parts.map(function (p) { return p.t; }).join('');
        const b = SpreadsheetApp.newRichTextValue().setText(text);
        let pos = 0;
        parts.forEach(function (p) {
          const ts = SpreadsheetApp.newTextStyle().setBold(!!p.s.b).setFontSize(p.s.fs || 10).setForegroundColor(p.s.fc || C_.text).build();
          if (p.t.length) b.setTextStyle(pos, pos + p.t.length, ts);
          pos += p.t.length;
        });
        return b.build();
      });
    });
    sh.getRange(rc[0], rc[1], grid.length, grid[0].length).setRichTextValues(grid);
  });
  const SOLID = SpreadsheetApp.BorderStyle.SOLID, MED = SpreadsheetApp.BorderStyle.SOLID_MEDIUM;
  this.borders.forEach(function (b) {
    const g = sh.getRange(b[0], b[1], b[2], b[3]);
    if (b[4] === 'section') g.setBorder(null, null, true, null, null, null, C_.navy, MED);
    else if (b[4] === 'table') g.setBorder(true, null, true, null, null, true, C_.line, SOLID);
    else if (b[4] === 'cards') g.setBorder(true, true, true, true, true, null, '#ffffff', MED);
    else g.setBorder(true, true, true, true, true, true, C_.line, SOLID);
  });
  if (this.conds.length) {
    sh.setConditionalFormatRules(this.conds.map(function (cd) {
      const rb = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(cd[0]).setRanges([sh.getRange(cd[1])]);
      if (cd[2].bg) rb.setBackground(cd[2].bg);
      if (cd[2].fc) rb.setFontColor(cd[2].fc);
      if (cd[2].b) rb.setBold(true);
      return rb.build();
    }));
  }
};
// 進捗のバー（スプレッドシートの棒グラフ関数）
function spark_(pct) {
  const v = Math.max(0, Math.min(100, Math.round(pct))) / 100;
  return '=SPARKLINE(' + v + ',{"charttype","bar";"max",1;"color1","' + C_.bar + '"})';
}

function ensureViewSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(VIEW_SHEET);
  if (!sh) {
    sh = ss.insertSheet(VIEW_SHEET, 0);
    try {
      if (sh.getMaxColumns() < STATE_COL) sh.insertColumnsAfter(sh.getMaxColumns(), STATE_COL - sh.getMaxColumns());
      sh.hideColumns(STATE_COL);
      // うっかり書き換えないように、編集しようとすると確認が出るようにする
      sh.protect().setDescription('本部アプリが自動で作る表です').setWarningOnly(true);
    } catch (err) { console.error(err); }
  }
  return sh;
}
function viewState_(sh) {
  const v = sh.getRange(1, STATE_COL, 6, 1).getDisplayValues().map(function (r) { return String(r[0] || '').trim(); });
  const today = bizToday_();
  const ym = /^\d{4}-\d{2}$/.test(v[0]) ? v[0] : today.slice(0, 7);
  return { ym: ym, d: isDate_(v[1]) ? v[1] : today, calStart: Number(v[2]) || 0, first: Number(v[3]) || 0, layout: v[4], weeks: Number(v[5]) || 6 };
}

/* ---------- 表を作るための計算（アプリと同じ計算） ---------- */
function viewCtx_() {
  const settings = settingsMap_();
  const allEmps = T_('employees').rows.slice().sort(function (a, b) { return a.order - b.order; });
  const tasks = T_('tasks').rows.filter(function (t) { return !t.deleted; });
  const kids = {}, byId = {};
  tasks.forEach(function (t) { byId[t.id] = t; if (t.parent) (kids[t.parent] = kids[t.parent] || []).push(t); });
  const memo = {};
  const prog = function (t) {
    if (memo[t.id] != null) return memo[t.id];
    const k = kids[t.id] || [];
    let v;
    if (k.length) { const w = k.reduce(function (s, y) { return s + (y.weight || 1); }, 0); v = k.reduce(function (s, y) { return s + (y.weight || 1) * prog(y); }, 0) / w; }
    else v = t.status === '完了' ? 100 : (t.progress || 0);
    memo[t.id] = v;
    return v;
  };
  const reports = {}, items = {}, att = {};
  T_('reports').rows.forEach(function (r) { reports[r.id] = r; });
  T_('items').rows.forEach(function (i) { if (!i.deleted) (items[i.reportId] = items[i.reportId] || []).push(i); });
  T_('attendance').rows.forEach(function (a) { if (a.status) att[a.id] = a.status; });
  return { settings: settings, DAYMIN: Math.round(settings.dayHours * 60), COST: settings.monthlyCost,
    allEmps: allEmps, emps: allEmps.filter(function (e) { return e.active; }),
    tasks: tasks, kids: kids, byId: byId, prog: prog, reports: reports, items: items, att: att, today: bizToday_() };
}
function calc_(x, items) {
  let plus = 0, basicIn = 0;
  items.forEach(function (i) { if (i.kind === 'plus') plus += i.min; else basicIn += i.min; });
  const total = plus + basicIn;
  return { plus: plus, basicIn: basicIn, total: total, other: Math.max(0, x.DAYMIN - total), over: total > x.DAYMIN };
}
function dayStats_(x, d) {
  let nIn = 0, nOff = 0, nSub = 0;
  const warn = [];
  x.emps.forEach(function (e) {
    const key = e.id + '|' + d, a = x.att[key] || '', r = x.reports[key], s = r && r.status === 'submitted';
    if (a === 'in') nIn++; else if (a === 'off') nOff++;
    if (s) nSub++;
    if (a === 'in' && !s) warn.push(e.name);
  });
  return { nIn: nIn, nOff: nOff, unreg: x.emps.length - nIn - nOff, nSub: nSub, warn: warn };
}
function overdue_(x, t) { return !!t.due && t.due < x.today && x.prog(t) < 100; }
function rootTasks_(x, eid) {
  return x.tasks.filter(function (t) {
    if (t.owner !== eid) return false;
    if (!t.parent) return true;
    const p = x.byId[t.parent];
    return !p || p.owner !== eid;
  });
}
function empProg_(x, eid) {
  const roots = rootTasks_(x, eid);
  let w = 0, s = 0;
  roots.forEach(function (t) { const ww = t.weight || 1; w += ww; s += ww * x.prog(t); });
  return { pct: w ? s / w : 0, roots: roots.length, done: roots.filter(function (t) { return x.prog(t) >= 100; }).length,
    over: x.tasks.filter(function (t) { return t.owner === eid && overdue_(x, t) && !(x.kids[t.id] || []).length; }).length };
}
function cmpTask_(x, a, b) {
  const da = x.prog(a) >= 100, db = x.prog(b) >= 100;
  if (da !== db) return da ? 1 : -1;
  const P = { '高': 0, '中': 1, '低': 2 };
  const p = (P[a.priority] || 1) - (P[b.priority] || 1);
  if (p) return p;
  const u = a.due || '9999', v = b.due || '9999';
  return u < v ? -1 : u > v ? 1 : 0;
}
function monthStats_(x, eid, ym) {
  let days = 0, basicMin = 0, plusMin = 0;
  const byWork = {}, byTask = {};
  for (let i = 1; i <= daysIn_(ym); i++) {
    const d = ym + '-' + pad2_(i);
    if (d > x.today) break;
    const key = eid + '|' + d;
    if (x.att[key] !== 'in') continue;
    days++;
    const r = x.reports[key];
    const items = r && r.status === 'submitted' ? (x.items[key] || []) : [];
    const c = calc_(x, items), f = c.over ? x.DAYMIN / c.total : 1;
    items.forEach(function (it) {
      const k = it.kind + '|' + it.name;
      byWork[k] = (byWork[k] || 0) + it.min * f;
      if (it.taskId) byTask[it.taskId] = (byTask[it.taskId] || 0) + it.min * f;
    });
    if (c.other > 0) { const k = 'basic|その他の基本業務'; byWork[k] = (byWork[k] || 0) + c.other; }
    plusMin += c.plus * f;
    basicMin += x.DAYMIN - c.plus * f;
  }
  return { days: days, rate: days ? x.COST / (days * x.DAYMIN / 60) : 0, basicMin: basicMin, plusMin: plusMin, byWork: byWork, byTask: byTask };
}
function monthAgg_(x, ym) {
  const work = {}, task = {};
  let total = 0;
  const rows = x.allEmps.map(function (e) {
    const s = monthStats_(x, e.id, ym), cost = s.days ? x.COST : 0;
    total += cost;
    Object.keys(s.byWork).forEach(function (k) { work[k] = work[k] || { min: 0, cost: 0 }; work[k].min += s.byWork[k]; work[k].cost += s.byWork[k] / 60 * s.rate; });
    Object.keys(s.byTask).forEach(function (k) { task[k] = task[k] || { min: 0, cost: 0 }; task[k].min += s.byTask[k]; task[k].cost += s.byTask[k] / 60 * s.rate; });
    return { e: e, s: s, cost: cost };
  }).filter(function (r) { return r.e.active || r.s.days > 0; });
  const sort = function (o) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1].cost - a[1].cost; }); };
  return { rows: rows, total: total, work: sort(work), task: sort(task) };
}
function empNameIn_(x, id) { const e = x.allEmps.filter(function (y) { return y.id === id; })[0]; return e ? e.name : ''; }

/* ---------- 日付などの小道具 ---------- */
function daysIn_(ym) { return new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate(); }
function dowOfDay_(d) { return new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))).getDay(); }
function ymOfDay_(d) { return d.slice(0, 7); }
function shiftYm_(ym, n) { const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1); return d.getFullYear() + '-' + pad2_(d.getMonth() + 1); }
function defaultDay_(ym) { const t = bizToday_(); return t.slice(0, 7) === ym ? t : ym + '-01'; }
function fmtYM_(ym) { return Number(ym.slice(0, 4)) + '年' + Number(ym.slice(5, 7)) + '月'; }
function fmtMD_(d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) + '（' + '日月火水木金土'[dowOfDay_(d)] + '）'; }
function fmtH_(min) { const h = Math.round(min / 6) / 10; return (Math.round(h) === h ? String(h) : h.toFixed(1)) + 'h'; }
function yen_(n) { return '¥' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function bar_(pct) { const k = Math.max(0, Math.min(10, Math.round(pct / 10))); return '■'.repeat(k) + '□'.repeat(10 - k) + ' ' + Math.round(pct) + '%'; }
const HOL_ = {};
function holName_(d) {
  const y = Number(d.slice(0, 4));
  if (!HOL_[y]) {
    const h = {};
    const add = function (m, dd, n) { h[y + '-' + pad2_(m) + '-' + pad2_(dd)] = n; };
    const nthMon = function (m, n) { const f = new Date(y, m - 1, 1).getDay(); return 1 + ((8 - f) % 7) + (n - 1) * 7; };
    const k = y - 1980, q = Math.floor(k / 4);
    add(1, 1, '元日'); add(1, nthMon(1, 2), '成人の日'); add(2, 11, '建国記念の日'); add(2, 23, '天皇誕生日');
    add(3, Math.floor(20.8431 + 0.242194 * k - q), '春分の日'); add(4, 29, '昭和の日'); add(5, 3, '憲法記念日'); add(5, 4, 'みどりの日'); add(5, 5, 'こどもの日');
    add(7, nthMon(7, 3), '海の日'); add(8, 11, '山の日'); add(9, nthMon(9, 3), '敬老の日'); add(9, Math.floor(23.2488 + 0.242194 * k - q), '秋分の日');
    add(10, nthMon(10, 2), 'スポーツの日'); add(11, 3, '文化の日'); add(11, 23, '勤労感謝の日');
    const nx = function (s) { const t = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)) + 1); return t.getFullYear() + '-' + pad2_(t.getMonth() + 1) + '-' + pad2_(t.getDate()); };
    Object.keys(h).forEach(function (s) { const mid = nx(s); if (h[nx(mid)] && !h[mid] && dowOfDay_(mid) !== 0) h[mid] = '国民の休日'; });
    Object.keys(h).sort().forEach(function (s) { if (dowOfDay_(s) === 0) { let t = nx(s); while (h[t]) t = nx(t); h[t] = '振替休日'; } });
    HOL_[y] = h;
  }
  return HOL_[y][d] || '';
}
