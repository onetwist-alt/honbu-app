/**
 * 本部アプリ（本番）GAS  v1.0.0
 *
 * スプレッドシート「業務管理データ」に紐づけて使います。
 * はじめて貼り付けたとき・新しい版に貼り替えたときは、setup を1回実行してください。
 *
 * ・データ置き場のタブは、列の見出しの名前で列を探します。列を並べ替えても動きます。
 * ・足りない列は右に足すだけで、既存のデータは消しません。
 * ・削除は「削除」の印をつけるだけで、行は消しません（ログインの記録だけは片付けます）。
 */
const APP_VERSION = '1.0.0';
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
    ['doneAt', '完了日時', 't'], ['deleted', '削除', 'b'], ['deletedAt', '削除日時', 't'],
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
  me:             { fn: function (p, u) { return { me: empPub_(u.emp), mustChange: u.mustChange }; } },
  changePassword: { write: true, fn: hChangePassword_ },
  load:           { fn: hLoad_ },
  loadRange:      { fn: hLoadRange_ },
  saveReport:     { write: true, fn: hSaveReport_ },
  setAttendance:  { write: true, fn: hSetAttendance_ },
  saveTasks:      { write: true, fn: hSaveTasks_ },
  deleteTasks:    { write: true, fn: hDeleteTasks_ },
  restoreTasks:   { write: true, fn: hRestoreTasks_ },
  saveWorkType:   { write: true, fn: hSaveWorkType_ },
  addEmployee:    { write: true, admin: true, fn: hAddEmployee_ },
  updateEmployee: { write: true, admin: true, fn: hUpdateEmployee_ },
  retireEmployee: { write: true, admin: true, fn: hRetireEmployee_ },
  resetPassword:  { write: true, admin: true, fn: hResetPassword_ },
  saveSettings:   { write: true, admin: true, fn: hSaveSettings_ }
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
  let empId = cache.get('ss:' + h);
  if (!empId) {
    const s = T_('sessions').find(h);
    if (!s || s.expires < Date.now()) return null;
    empId = s.empId;
    cache.put('ss:' + h, empId, 600);
  }
  const e = T_('employees').find(empId);
  if (!e || !e.active) return null;
  const a = T_('auth').find(empId, 'empId');
  return { id: e.id, name: e.name, admin: e.admin, emp: e, mustChange: a ? a.mustChange : false, tokenHash: h };
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
  CacheService.getScriptCache().remove('ss:' + user.tokenHash);
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
    .forEach(function (s) { cache.remove('ss:' + s.tokenHash); S.removeRow(s); });
}

/* ===== 読み込み ===== */
function hLoad_(p, user) {
  const today = bizToday_();
  const from = isDate_(p.from) ? p.from : monthEdge_(today, -1, true);
  const to = isDate_(p.to) ? p.to : monthEdge_(today, 1, false);
  const out = {
    me: empPub_(user.emp), mustChange: user.mustChange, serverToday: today, version: APP_VERSION,
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
  list.forEach(function (x) {
    const e = existing.filter(function (y) { return y.id === x.id; })[0];
    const row = { id: x.id, reportId: key, empId: user.id, date: date, kind: x.kind, name: x.name, min: x.min,
      memo: x.memo, taskId: x.taskId, seq: x.seq, deleted: false, updatedAt: now };
    if (!e) I.insert(row);
    else if (e.kind !== row.kind || e.name !== row.name || e.min !== row.min || e.memo !== row.memo || e.taskId !== row.taskId || e.seq !== row.seq) I.update(e, row);
  });
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
      const n = Tt.insert(Object.assign(v, { deleted: false, deletedAt: '', createdAt: now, version: 1 }));
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

function hDeleteTasks_(p, user) {
  const ids = (Array.isArray(p.ids) ? p.ids : []).map(String);
  const Tt = T_('tasks');
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
      recType: last.recType, recDow: last.recDow, recDom: last.recDom, recOrigin: g, memo: '', prevProgress: '',
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

  if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailyJob'; })) {
    ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(DAY_START_HOUR).inTimezone(TZ).create();
  }
  SpreadsheetApp.flush();
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
    doneAt: t.doneAt, deleted: !!t.deleted, version: t.version
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
  const hdr = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
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
