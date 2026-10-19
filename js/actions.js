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
  wc.items.push({ id: uid(), kind: ui.entry.kind, name, memo: (ui.entry.memo || '').trim(), min: ui.entry.min, taskId: ui.entry.kind === 'plus' ? ui.entry.taskId : '' });
  ui.entry.name = ''; ui.entry.memo = ''; ui.entry.taskId = '';
  render(); toast('追加しました。最後に「下書き保存」か「日報を提出」を押してください');
}
async function saveReport(status){
  if (ui.saving) return;
  const wc = wcFor(ui.empId, ui.selDate), key = wc.key, prev = data.reports[key];
  if (status === 'submitted' && !wc.items.length && !confirm('業務が1件もありません。11時間すべてを「その他の基本業務」として提出しますか？')) return;
  ui.saving = true;
  try {
    const r = await api('saveReport', { date: key.split('|')[1], status, items: wc.items, version: prev ? prev.version : null });
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
    data.tasks = snap; render(); handleError(err);
    return false;
  }
}
function leaves(t){ const k = kidsOf(t.id); return k.length ? k.reduce((a, x) => a.concat(leaves(x)), []) : [t]; }
function completeLeaves(t){ leaves(t).forEach(l => { if (l.status !== '完了') { l.prevProgress = l.progress; l.status = '完了'; l.progress = 100; l.autoDone = true; } }); }
function toggleDone(id){
  const t = taskById(id); if (!t) return;
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
  const t = taskById(id); if (!t) return;
  const toPause = t.status !== '一時停止';
  commitTasks(() => { t.status = toPause ? '一時停止' : '進行中'; }, toPause ? '一時停止にしました。進捗はそのまま残ります' : '再開しました', true);
}
function setProgress(id, v){
  const t = taskById(id); if (!t) return;
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
    if (snap.restore) {
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
  if (g('tf-rec-on').checked) { const ty = g('tf-rec-type').value; f.rec = ty === 'weekly' ? { type: ty, dow: +g('tf-rec-dow').value } : ty === 'monthly' ? { type: ty, dom: +g('tf-rec-dom').value } : { type: ty }; }
  else f.rec = null;
  const pr = g('tf-prog');
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
const attQueue = {};
function cycleAtt(e, d){
  const k = e + '|' + d, cur = data.attendance[k] || '', nx = cur === '' ? 'in' : (cur === 'in' ? 'off' : '');
  if (nx) data.attendance[k] = nx; else delete data.attendance[k];
  render();
  // 同じマスを続けて押したときも、押した順に保存する
  attQueue[k] = (attQueue[k] || Promise.resolve()).then(() => api('setAttendance', { empId: e, date: d, status: nx })).catch(err => {
    if (cur) data.attendance[k] = cur; else delete data.attendance[k];
    render(); handleError(err);
  });
}

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
