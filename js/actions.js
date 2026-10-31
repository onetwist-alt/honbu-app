'use strict';
/* ===== 日報の操作 ===== */
function guard(){
  if (!ui.wc) return true;
  const eid = ui.wc.key.split('|')[0];
  if (eid !== ui.user || !wcDirty()) return true;
  if (confirm('日報に保存していない変更があります。変更を捨てて移動しますか？')) { ui.wc = null; return true; }
  return false;
}
function addEntry(){
  const wc = wcFor(ui.empId, ui.selDate);
  const name = (ui.entry.name || '').trim();
  if (!name) { toast('業務名を選ぶか、入力してください'); const i = document.getElementById('en-name'); if (i) i.focus(); return; }
  wc.items.push({ id: uid(), kind: ui.entry.kind, name, memo: (ui.entry.memo || '').trim(), min: ui.entry.min, taskId: ui.entry.taskId || '' });
  ui.entry.name = ''; ui.entry.memo = ''; ui.entry.taskId = '';
  renderEmpParts(false); toast('追加しました。最後に「下書き保存」か「日報を提出」を押してください');
}
async function saveReport(status){
  if (ui.saving) return;
  const wc = wcFor(ui.empId, ui.selDate), key = wc.key, prev = data.reports[key];
  if (status === 'submitted' && !wc.items.length) { toast('業務を1件以上入れてから提出してください'); return; }
  ui.saving = true;
  try {
    const r = await api('saveReport', { empId: key.split('|')[0], date: key.split('|')[1], status, items: wc.items, version: prev ? prev.version : null });
    data.reports[key] = r.report;
    let msg = status === 'submitted' ? (prev && prev.status === 'submitted' ? '変更を提出しました' : '日報を提出しました') : '下書きを保存しました';
    if (status === 'submitted') {
      wc.items.forEach(x => { const w = data.workTypes.find(y => y.kind === x.kind && y.name === x.name); if (w) w.uses++; });
      if (r.autoAttend) { data.attendance[key] = 'in'; msg += '。出勤を' + CK() + 'に自動で変えました'; }
    }
    ui.wc = null;
    toast(msg);
  } catch (err) { handleError(err); }
  finally { ui.saving = false; render(); }
}

/* ===== タスクの操作 ===== */
const TASK_WIRE = ['id','parent','title','detail','owner','co','priority','weight','progress','status','start','due','rec','recOrigin','memo','prevProgress','version'];
const wire = t => { const o = {}; TASK_WIRE.forEach(k => { o[k] = t[k] === undefined ? null : t[k]; }); return o; };
const sameTask = (a, b) => JSON.stringify(wire(a)) === JSON.stringify(wire(b));
// 画面を先に変えて、GASに保存する。失敗したら元に戻す
async function commitTasks(mutate, msg, undoable){
  const snap = clone(data.tasks);
  mutate();
  invalidate();
  const changed = data.tasks.filter(t => { const o = snap.find(x => x.id === t.id); return !o || !sameTask(o, t); });
  render();
  if (!changed.length) return true;
  try {
    const r = await api('saveTasks', { tasks: changed.map(wire) });
    mergeTasks(r.tasks); render();
    if (undoable) toastUndo(msg, { tasks: changed.map(t => snap.find(x => x.id === t.id)).filter(Boolean) });
    else if (msg) toast(msg);
    return true;
  } catch (err) {
    data.tasks = snap; invalidate(); render(); handleError(err);
    return false;
  }
}
function leaves(t){ const k = kidsOf(t.id); return k.length ? k.reduce((a, x) => a.concat(leaves(x)), []) : [t]; }
function completeLeaves(t){ leaves(t).forEach(l => { if (l.status !== '完了') { l.prevProgress = l.progress; l.status = '完了'; l.progress = 100; l.autoDone = true; } }); }
function denyIfOthers(t){ if (canEdit(t)) return false; toast('他の人のタスクは操作できません'); return true; }
function toggleDone(id){
  const t = taskById(id); if (!t || denyIfOthers(t)) return;
  const wasDone = done(t);
  commitTasks(() => {
    const ls = leaves(t), isLeaf = ls.length === 1 && ls[0] === t;
    if (!wasDone) {
      if (isLeaf) { t.prevProgress = t.progress; t.status = '完了'; t.progress = 100; t.autoDone = false; }
      else { completeLeaves(t); t.status = '完了'; }
    } else {
      const targets = isLeaf ? [t] : (ls.some(l => l.autoDone) ? ls.filter(l => l.autoDone) : ls);
      targets.forEach(l => { l.status = '進行中'; const pp = l.prevProgress; l.progress = (pp != null && pp < 100) ? pp : 90; l.autoDone = false; });
      if (!isLeaf) t.status = '進行中';
    }
  }, wasDone ? '完了を取り消しました' : '完了にしました（100%）', true);
}
function togglePause(id){
  const t = taskById(id); if (!t || denyIfOthers(t)) return;
  const toPause = t.status !== '一時停止';
  commitTasks(() => { t.status = toPause ? '一時停止' : '進行中'; }, toPause ? '一時停止にしました。進捗はそのまま残ります' : '再開しました', true);
}
function setProgress(id, v){
  const t = taskById(id); if (!t || denyIfOthers(t)) { render(); return; }
  if (v >= 100 && !done(t) && !confirm('「' + t.title + '」を100%にすると完了になります。完了にしてよいですか？')) { render(); return; }
  commitTasks(() => {
    if (v >= 100) { if (t.status !== '完了') t.prevProgress = t.progress; t.progress = 100; t.status = '完了'; t.autoDone = false; }
    else { t.progress = v; if (t.status === '完了' || (t.status === '未着手' && v > 0)) t.status = '進行中'; }
  }, '「' + t.title + '」を ' + v + '% にしました' + (v >= 100 ? '（完了）' : ''), true);
}
async function undoLast(){
  if (!undoSnap) return;
  const snap = undoSnap; undoSnap = null;
  const t = document.getElementById('toast'); t.className = '';
  try {
    if (snap.remove) {
      const r = await api('deleteTasks', { ids: snap.remove });
      data.tasks = data.tasks.filter(x => r.deleted.indexOf(x.id) < 0); invalidate();
    } else if (snap.restore) {
      const r = await api('restoreTasks', { ids: snap.restore });
      mergeTasks(r.tasks);
    } else {
      const list = snap.tasks.map(o => { const cur = taskById(o.id); return Object.assign(wire(o), { version: cur ? cur.version : o.version }); });
      const r = await api('saveTasks', { tasks: list });
      mergeTasks(r.tasks);
    }
    render(); toast('元に戻しました');
  } catch (err) { handleError(err); }
}
async function saveTaskForm(){
  const g = id => document.getElementById(id);
  const title = g('tf-title').value.trim();
  if (!title) { toast('タスク名を入れてください'); g('tf-title').focus(); return; }
  const isNew = !ui.modal.id;
  const cur = isNew ? null : taskById(ui.modal.id);
  if (!isNew && !cur) { closeModal(); toast('このタスクは見つかりませんでした'); return; }
  const prevOwner = cur ? cur.owner : null, prevStatus = cur ? cur.status : '未着手', owner = g('tf-owner').value;
  const f = {
    title, detail: g('tf-detail').value.trim(), owner,
    co: [...document.querySelectorAll('.tf-co:checked')].map(x => x.value).filter(x => x !== owner),
    priority: ui.modal.pri || '中', weight: +g('tf-weight').value, status: g('tf-status').value,
    start: g('tf-start').value, due: g('tf-due').value, parent: g('tf-parent').value || null,
    memo: g('tf-memo').value.trim()
  };
  if (g('tf-rec-on').checked) {
    const ty = g('tf-rec-type').value;
    const dv = ty === 'daily' ? g('tf-rec-due-d').value : ty === 'weekly' ? g('tf-rec-due-w').value : g('tf-rec-due-m').value;
    const due = dv === '' || (ty === 'daily' && dv === '0') ? null : +dv;
    f.rec = ty === 'weekly' ? { type: ty, dow: +g('tf-rec-dow').value, due } : ty === 'monthly' ? { type: ty, dom: +g('tf-rec-dom').value, due } : { type: ty, due };
  }
  else f.rec = null;
  const pr = g('tf-prog');
  if (pr && +pr.value >= 100 && prevStatus !== '完了' && f.status !== '完了' && !confirm('進捗を100%にすると完了になります。完了にしてよいですか？')) return;
  const btn = $('[data-act="tf-save"]'); if (btn) btn.disabled = true;
  const moved = !isNew && prevOwner !== owner;
  const ok = await commitTasks(() => {
    const t = isNew ? { id: uid(), progress: 0, status: '未着手', recOrigin: '', prevProgress: null } : cur;
    Object.assign(t, f);
    if (pr) {
      t.progress = +pr.value;
      if (t.status === '完了') t.progress = 100;
      else if (prevStatus === '完了' && t.progress >= 100) t.progress = 90;
      else if (t.progress >= 100) t.status = '完了';
    } else if (t.status === '完了' && !done(t)) { completeLeaves(t); }
    if (isNew) data.tasks.push(t);
    if (t.parent) ui.expanded[t.parent] = true;
  }, isNew ? 'タスクを追加しました' : (moved ? empName(owner) + 'さんに移しました' : '保存しました'), false);
  if (ok) closeModal(); else if (btn) btn.disabled = false;
}
async function deleteTaskForm(){
  const t = taskById(ui.modal.id); if (!t) return;
  const ds = descIds(t.id).filter(id => taskById(id));
  if (!confirm(`「${t.title}」を削除しますか？${ds.length ? `子タスク${ds.length}件も一緒に削除します。` : ''}データ置き場には「削除」の印をつけて残します。`)) return;
  try {
    const r = await api('deleteTasks', { ids: [t.id] });
    data.tasks = data.tasks.filter(x => r.deleted.indexOf(x.id) < 0);
    closeModal(); render();
    toastUndo('削除しました', { restore: r.deleted });
  } catch (err) { handleError(err); }
}

/* ===== 出勤の操作 ===== */
// 出勤カレンダーは続けて何回も押されるので、押し終わってから少し待って、まとめて1回で保存する
const attPending = {};
let attTimer = null, attInFlight = false;
function attWaiting(){ return Object.keys(attPending).length + (attInFlight ? 1 : 0); }
function cycleAtt(e, d){
  if (!canAtt(e)) { toast('出勤を変えられるのは、本人と管理者だけです'); return; }
  const k = e + '|' + d, cur = data.attendance[k] || '', nx = cur === '' ? 'in' : (cur === 'in' ? 'off' : '');
  if (nx) data.attendance[k] = nx; else delete data.attendance[k];
  attPending[k] = { empId: e, date: d, status: nx, prev: attPending[k] ? attPending[k].prev : cur };
  render();
  clearTimeout(attTimer);
  attTimer = setTimeout(flushAtt, 1200);
}
async function flushAtt(){
  clearTimeout(attTimer);
  if (attInFlight) { attTimer = setTimeout(flushAtt, 600); return; }
  const items = Object.keys(attPending).map(k => { const x = attPending[k]; delete attPending[k]; return x; });
  if (!items.length) return;
  attInFlight = true; updAttStatus();
  try {
    await api('setAttendanceMany', { items: items.map(x => ({ empId: x.empId, date: x.date, status: x.status })) });
  } catch (err) {
    // 保存できなかったマスは元に戻す（その後にまた押されたマスはそのまま）
    items.forEach(x => { const k = x.empId + '|' + x.date; if (!attPending[k]) { if (x.prev) data.attendance[k] = x.prev; else delete data.attendance[k]; } });
    render(); handleError(err);
  } finally {
    attInFlight = false;
    if (Object.keys(attPending).length) attTimer = setTimeout(flushAtt, 600);
    updAttStatus();
  }
}
// 「保存待ち」「保存中」の小さな表示だけを書き換える
function updAttStatus(){
  const el = document.getElementById('att-status'); if (!el) return;
  const n = Object.keys(attPending).length;
  el.textContent = attInFlight ? '保存中…' : (n ? '保存待ち ' + n + '件' : '');
  el.className = 'att-status' + ((attInFlight || n) ? ' on' : '');
}
// 画面を閉じる・別のアプリに切り替えるときは、待たずにすぐ保存する
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && Object.keys(attPending).length) flushAtt(); });
window.addEventListener('pagehide', () => { if (Object.keys(attPending).length) flushAtt(); });

/* ===== システム管理の操作 ===== */
async function addWorkType(){
  const kind = $('#wt-kind').value, name = ($('#wt-name').value || '').trim();
  if (!name) { toast('業務名を入れてください'); return; }
  try { const r = await api('saveWorkType', { kind, name }); data.workTypes.push(r.workType); render(); toast('「' + name + '」を追加しました'); }
  catch (err) { handleError(err); }
}
async function toggleWorkType(id){
  const w = data.workTypes.find(x => x.id === id); if (!w) return;
  try {
    const r = await api('saveWorkType', { id, kind: w.kind, name: w.name, active: !w.active });
    Object.assign(w, r.workType); render();
    toast(w.active ? '候補に戻しました' : '候補から外しました');
  } catch (err) { handleError(err); }
}
async function addEmployee(){
  const name = ($('#ae-name').value || '').trim(), loginId = ($('#ae-login').value || '').trim();
  if (!name || !loginId) { toast('氏名とログインIDを入れてください'); return; }
  const btn = $('[data-act="emp-add"]'); if (btn) btn.disabled = true;
  try {
    const r = await api('addEmployee', { name, loginId, title: ($('#ae-title').value || '').trim(), shift: $('#ae-shift').value, admin: $('#ae-admin').checked });
    data.employees.push(r.employee);
    ui.modal = { type: 'temp', head: '社員を追加しました', emp: r.employee, temp: r.tempPassword };
    render();
  } catch (err) { handleError(err); if (btn) btn.disabled = false; }
}
async function resetPw(id){
  const e = emp(id); if (!e) return;
  if (!confirm(e.name + 'さんのパスワードをリセットしますか？今のパスワードは使えなくなり、仮パスワードを発行します。')) return;
  try { const r = await api('resetPassword', { id }); ui.modal = { type: 'temp', head: 'パスワードをリセットしました', emp: e, temp: r.tempPassword }; renderModal(); }
  catch (err) { handleError(err); }
}
async function retireEmp(id){
  const e = emp(id); if (!e) return;
  if (!confirm(e.name + 'さんを退職にしますか？ログインできなくなります。これまでの日報やタスクのデータは残ります。')) return;
  try { const r = await api('retireEmployee', { id }); Object.assign(e, r.employee); render(); toast(e.name + 'さんを退職にしました'); }
  catch (err) { handleError(err); }
}
async function saveEmpEdit(){
  const e = emp(ui.modal.id); if (!e) return;
  const payload = { id: e.id, version: e.version, name: ($('#ee-name').value || '').trim(), title: ($('#ee-title').value || '').trim(), shift: $('#ee-shift').value, admin: $('#ee-admin').checked };
  if (!payload.name) { toast('氏名を入れてください'); return; }
  try { const r = await api('updateEmployee', payload); Object.assign(e, r.employee); closeModal(); render(); toast('保存しました'); }
  catch (err) { handleError(err); }
}
async function saveCost(){
  const v = Math.round(Number(($('#cost-month').value || '').replace(/[^\d]/g, '')));
  if (!(v > 0)) { toast('金額を数字で入れてください'); return; }
  if (!confirm('月の人件費を ' + yen(v) + ' にしますか？時給と人件費の計算がすべてこの金額で計算し直されます。')) return;
  try { const r = await api('saveSettings', { monthlyCost: v }); applySettings(r.settings); render(); toast('月の人件費を ' + yen(v) + ' にしました'); }
  catch (err) { handleError(err); }
}

/* ===== 月次レポート ===== */
async function loadReport(ym){
  try { const r = await api('monthReport', { ym }); ui.rep[ym] = r; if (ui.view === 'report' && ui.repMonth === ym) render(); }
  catch (err) { handleError(err); }
}
async function closeMonth(){
  const ym = ui.repMonth, r = ui.rep[ym]; if (!r) return;
  const msg = r.closed ? fmtYM(ym) + 'の数字を、今のデータで確定し直しますか？' : fmtYM(ym) + 'を締めますか？今の数字で確定して保存します。締めたあとも日報は直せますが、レポートに「確定後に変更あり」と出ます。';
  if (!confirm(msg)) return;
  ui.repBusy = true; render();
  try {
    await api('closeMonth', { ym });
    if (data.closings.indexOf(ym) < 0) data.closings.push(ym);
    Object.keys(data.reports).forEach(k => { if (k.split('|')[1].slice(0, 7) === ym && data.reports[k]) data.reports[k].changedAfterClose = false; });
    await loadReport(ym);
    toast(fmtYM(ym) + (r.closed ? 'を確定し直しました' : 'を締めました'));
  } catch (err) { handleError(err); }
  finally { ui.repBusy = false; render(); }
}

/* ===== まとめて作る ===== */
// 1行に1タスク。字下げした行は、上の行の子タスクになる。「1月〜12月」「第1〜4週」「月〜金」「1〜10」は1件ずつに広げる
const RANGE = '[〜~～\\-－]';
function parseOutline(text){
  const root = { children: [] }, stack = [{ w: -1, node: root }];
  String(text || '').replace(/\r/g, '').split('\n').forEach(raw => {
    if (!raw.trim()) return;
    let w = 0, i = 0;
    for (; i < raw.length; i++) { const c = raw[i]; if (c === ' ') w += 1; else if (c === '\t' || c === '　') w += 2; else break; }
    const name = raw.slice(i).trim().slice(0, 100);
    if (!name) return;
    while (stack.length > 1 && stack[stack.length - 1].w >= w) stack.pop();
    const node = { name, children: [] };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ w, node });
  });
  return root.children;
}
function expandName(name){
  let m = name.match(new RegExp('(\\d{1,2})月\\s*' + RANGE + '\\s*(\\d{1,2})月'));
  if (m) {
    const a = +m[1], b = +m[2];
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12) {
      const out = []; let x = a;
      for (let k = 0; k < 12; k++) { out.push({ name: name.replace(m[0], x + '月'), month: x, first: a }); if (x === b) break; x = x % 12 + 1; }
      return out;
    }
  }
  m = name.match(new RegExp('第\\s*(\\d{1,2})\\s*' + RANGE + '\\s*(\\d{1,2})\\s*週'));
  if (m && +m[2] >= +m[1] && +m[2] - +m[1] < 10) { const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push({ name: name.replace(m[0], '第' + i + '週') }); return out; }
  m = name.match(new RegExp('([月火水木金土日])(?:曜日?)?\\s*' + RANGE + '\\s*([月火水木金土日])(?:曜日?)?'));
  if (m) {
    const D = '月火水木金土日', i = D.indexOf(m[1]), j = D.indexOf(m[2]);
    if (j > i) { const out = []; for (let k = i; k <= j; k++) out.push({ name: name.replace(m[0], D[k] + '曜') }); return out; }
  }
  m = name.match(new RegExp('(\\d{1,3})\\s*' + RANGE + '\\s*(\\d{1,3})'));
  if (m && +m[2] > +m[1] && +m[2] - +m[1] < 100) { const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push({ name: name.replace(m[0], String(i)) }); return out; }
  return [{ name }];
}
function buildBulk(nodes, o){
  const out = [], y0 = +o.start.slice(0, 4);
  const walk = (list, parentId) => list.forEach(n => expandName(n.name).forEach(x => {
    const t = { id: uid(), parent: parentId || null, title: x.name, detail: '', owner: o.owner, co: [], priority: '中', weight: 1,
      progress: 0, status: '未着手', start: o.start, due: '', rec: null, recOrigin: '', memo: '', prevProgress: null };
    if (x.month && o.useMonth) {
      const y = x.month < x.first ? y0 + 1 : y0, ym = y + '-' + pad(x.month);
      t.start = ym + '-01'; t.due = ym + '-' + pad(dim(ym));
    }
    out.push(t);
    walk(n.children, t.id);
  }));
  walk(nodes, o.parent);
  return out;
}
function bulkHtml(){
  const m = ui.modal, par = m.parent ? taskById(m.parent) : null, today = bizToday();
  const owner = m.owner || (par ? par.owner : (ui.empId || ui.user));
  const pats = [['1月〜12月', '1月〜12月'], ['4月〜3月（年度）', '4月〜3月'], ['第1〜4週', '第1〜4週'], ['月〜金', '月〜金'], ['1〜10', '1〜10']];
  return modalFrame('bk-head', par ? '「' + esc(par.title) + '」の下にまとめて作る' : 'タスクをまとめて作る', `<div style="display:grid;gap:12px">
    <div class="adm-form" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <label class="fl">担当（主担当）<select class="inp" id="bk-owner">${staff().map(e => `<option value="${e.id}" ${e.id === owner ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="fl">開始日<input type="date" class="inp" id="bk-start" value="${today}"></label>
    </div>
    <div class="fl">タスク（1行に1つ。字下げした行は、上の行の子タスクになります）
      <div class="bk-pats">${pats.map(p => `<button type="button" class="qt" data-act="bk-ins" data-t="${p[1]}">${p[0]}</button>`).join('')}</div>
      <textarea class="inp bk-text" id="bk-text" rows="9" data-field="bk-text" placeholder="会計&#10;  仕分け&#10;    1月〜12月&#10;  入力&#10;    1月〜12月" spellcheck="false"></textarea></div>
    <label class="check"><input type="checkbox" id="bk-month" checked> 「1月」などの月のタスクは、その月の1日を開始日、月末を期限にする</label>
    <div class="bk-prev" id="bk-prev">${bulkPreview()}</div>
  </div>`, `<button class="btn" data-act="modal-close">キャンセル</button><button class="btn btn-primary" data-act="bk-save" id="bk-save">作る</button>`, 560);
}
function bulkOpts(){
  const g = id => document.getElementById(id);
  return { owner: g('bk-owner') ? g('bk-owner').value : ui.user, start: (g('bk-start') && g('bk-start').value) || bizToday(),
    useMonth: g('bk-month') ? g('bk-month').checked : true, parent: ui.modal && ui.modal.parent || null };
}
function bulkPreview(){
  const el = document.getElementById('bk-text');
  const nodes = parseOutline(el ? el.value : '');
  if (!nodes.length) return '<span class="muted small">入力すると、ここに作るタスクの一覧が出ます</span>';
  const list = buildBulk(nodes, bulkOpts());
  const depth = {}; list.forEach(t => { depth[t.id] = t.parent && depth[t.parent] != null ? depth[t.parent] + 1 : 0; });
  const rows = list.slice(0, 60).map(t => `<div style="padding-left:${depth[t.id] * 16}px">${depth[t.id] ? '└ ' : ''}${esc(t.title)}${t.due ? ` <span class="muted small">期限 ${fmtMD(t.due)}</span>` : ''}</div>`).join('');
  const b = document.getElementById('bk-save'); if (b) b.textContent = list.length + '件を作る';
  return `<div class="bk-count ${list.length > 300 ? 'over' : ''}">${list.length}件のタスクを作ります${list.length > 300 ? '（1回に作れるのは300件までです）' : ''}</div>${rows}${list.length > 60 ? `<div class="muted small">ほか ${list.length - 60}件</div>` : ''}`;
}
function updBulkPreview(){ const p = document.getElementById('bk-prev'); if (p) p.innerHTML = bulkPreview(); }
async function saveBulk(){
  const nodes = parseOutline(document.getElementById('bk-text').value);
  if (!nodes.length) { toast('タスクを1行以上入れてください'); return; }
  const list = buildBulk(nodes, bulkOpts());
  if (list.length > 300) { toast('1回に作れるのは300件までです。分けて作ってください'); return; }
  const b = document.getElementById('bk-save'); if (b) { b.disabled = true; b.textContent = '作っています…'; }
  try {
    const r = await api('saveTasks', { tasks: list.map(wire) });
    mergeTasks(r.tasks);
    const roots = list.filter(t => !t.parent || t.parent === bulkOpts().parent).map(t => t.id);
    list.forEach(t => { if (list.some(c => c.parent === t.id)) ui.expanded[t.id] = true; });
    if (ui.modal && ui.modal.parent) ui.expanded[ui.modal.parent] = true;
    closeModal(); render();
    toastUndo(list.length + '件のタスクを作りました', { remove: roots });
  } catch (err) {
    if (b) { b.disabled = false; b.textContent = list.length + '件を作る'; }
    handleError(err);
  }
}
