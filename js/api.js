'use strict';
/* ===== GASとのやり取り ===== */
const SESSION_KEY = 'honbu-session-v1';
let session = (() => { try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); if (s && s.token && s.expires > Date.now()) return s; } catch (e) {} return { token: '', expires: 0 }; })();
function saveSession(){ try { if (session.token) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); } catch (e) {} }

let busyN = 0;
function setBusy(d){ busyN = Math.max(0, busyN + d); const b = document.getElementById('busy'); if (b) b.className = busyN ? 'on' : ''; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function appError(code, msg, data){ const e = new Error(msg); e.code = code; e.data = data; return e; }

// 1つの操作に1つの番号をつけて送る。通信が途切れて送り直しても、GAS側で1回分しか処理しない
async function api(action, payload){
  const url = String((window.HONBU_CONFIG || {}).GAS_URL || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) throw appError('config', 'GASのURLが設定されていません。js/config.js を確認してください');
  const body = JSON.stringify({ action, payload: payload || {}, token: session.token || '', requestId: uid() });
  setBusy(1);
  try {
    for (let attempt = 0; ; attempt++) {
      let j;
      try {
        const ctrl = window.AbortController ? new AbortController() : null;
        const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 30000);
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, signal: ctrl ? ctrl.signal : undefined });
        clearTimeout(timer);
        j = await r.json();
      } catch (err) {
        if (attempt >= 2) throw appError('network', '通信できませんでした。電波の良い場所で、もう一度お試しください');
        await sleep(attempt ? 3000 : 1000);
        continue;
      }
      if (!j.ok) throw appError(j.code || 'error', j.error || 'エラーが起きました', j.data);
      return j.data;
    }
  } finally { setBusy(-1); }
}

/* ===== 読み込んだデータを画面用に取り込む ===== */
function monthsBetween(from, to){ const out = []; let m = ymOf(from); const end = ymOf(to); while (m <= end) { out.push(m); m = addMonths(m, 1); } return out; }
function applySettings(s){
  if (s) data.settings = s;
  DAY_MIN = Math.round((Number(data.settings.dayHours) || 11) * 60);
  MONTHLY_COST = Number(data.settings.monthlyCost) || 300000;
}
function applyLoad(r){
  data.employees = r.employees || [];
  data.workTypes = r.workTypes || [];
  data.tasks = r.tasks || []; invalidate();
  data.closings = r.closings || [];
  applySettings(r.settings);
  data.reports = r.reports || {};
  data.attendance = r.attendance || {};
  data.months = {};
  monthsBetween(r.from, r.to).forEach(m => { data.months[m] = true; });
  data.from = r.from; data.to = r.to;
  data.loadedAt = Date.now();
  ui.user = r.me.id;
  ui.mustChange = !!r.mustChange;
  const e = emp(ui.empId);
  if (!e || !e.active) ui.empId = ui.user;
}
function mergeRange(r){
  monthsBetween(r.from, r.to).forEach(m => { data.months[m] = true; });
  const inRange = k => { const d = k.split('|')[1]; return d >= r.from && d <= r.to; };
  Object.keys(data.reports).forEach(k => { if (inRange(k)) delete data.reports[k]; });
  Object.keys(data.attendance).forEach(k => { if (inRange(k)) delete data.attendance[k]; });
  Object.assign(data.reports, r.reports || {});
  Object.assign(data.attendance, r.attendance || {});
  if (!data.from || r.from < data.from) data.from = r.from;
  if (!data.to || r.to > data.to) data.to = r.to;
}
function mergeTasks(list){
  invalidate();
  (list || []).forEach(t => {
    const i = data.tasks.findIndex(x => x.id === t.id);
    if (t.deleted) { if (i >= 0) data.tasks.splice(i, 1); return; }
    if (i >= 0) data.tasks[i] = t; else data.tasks.push(t);
  });
}
// まだ読み込んでいない月を見ようとしたときに、その月の日報と出勤を取りに行く
async function ensureMonths(list){
  const need = [...new Set(list)].filter(m => m && !data.months[m]).sort();
  if (!need.length) return;
  const last = need[need.length - 1];
  try {
    const r = await api('loadRange', { from: need[0] + '-01', to: last + '-' + pad(dim(last)) });
    mergeRange(r);
    render();
  } catch (err) { handleError(err); }
}
let lastSig = '';
async function refreshAll(quiet){
  if (!session.token || !ui.user) return;
  try {
    const r = await api('load', { from: data.from, to: data.to });
    const sig = JSON.stringify([r.employees, r.workTypes, r.tasks, r.reports, r.attendance, r.settings, r.closings]);
    if (sig === lastSig) { data.loadedAt = Date.now(); return; }
    lastSig = sig; applyLoad(r); render(); if (ui.view === 'report') loadReport(ui.repMonth);
  }
  catch (err) { if (!quiet || err.code === 'auth') handleError(err); }
}

/* ===== エラーの扱い ===== */
function handleError(err){
  const code = err && err.code;
  if (code === 'auth') { clearLogin(); render(); toast(err.message); return; }
  if (code === 'must_change') { ui.mustChange = true; ui.modal = null; render(); return; }
  if (code === 'conflict' && err.data) {
    if (err.data.tasks) mergeTasks(err.data.tasks);
    if (err.data.report) { data.reports[err.data.report.key] = err.data.report; ui.wc = null; }
    if (err.data.employee) { const i = data.employees.findIndex(x => x.id === err.data.employee.id); if (i >= 0) data.employees[i] = err.data.employee; }
    render();
  }
  toast(err && err.message || 'エラーが起きました');
}
function clearLogin(){
  session = { token: '', expires: 0 }; saveSession();
  ui.user = null; ui.modal = null; ui.wc = null; ui.mustChange = false; ui.booting = false;
  data = blankData();
}

/* ===== ログイン・パスワード ===== */
async function doLogin(){
  const idEl = $('#lg-id'), pwEl = $('#lg-pw'), errEl = $('#lg-err'), btn = $('[data-act="login"]');
  const id = (idEl.value || '').trim(), pw = pwEl.value || '';
  if (!id || !pw) { errEl.textContent = 'IDとパスワードを入れてください'; return; }
  errEl.textContent = ''; if (btn) { btn.disabled = true; btn.textContent = 'ログイン中…'; }
  try {
    const r = await api('login', { loginId: id, password: pw });
    session = { token: r.token, expires: r.expires }; saveSession();
    ui.user = r.me.id; ui.empId = r.me.id; ui.view = 'dash'; ui.mustChange = !!r.mustChange;
    if (ui.mustChange) { data.employees = [r.me]; render(); return; }
    await startApp();
    toast(r.me.name + 'さん、ログインしました');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'ログイン'; }
    errEl.textContent = e.message;
  }
}
async function startApp(){
  ui.booting = true; render();
  try { const r = await api('load', {}); applyLoad(r); }
  catch (e) { ui.booting = false; handleError(e); if (ui.user && !ui.mustChange) render(); return; }
  ui.booting = false; render();
}
async function savePassword(){
  const o = $('#pw-old'), n = $('#pw-new'), n2 = $('#pw-new2'), errEl = $('#pw-err'), btn = $('[data-act="pw-save"]');
  const oldPw = o.value, newPw = n.value;
  if (!oldPw || !newPw) { errEl.textContent = 'すべての欄を入れてください'; return; }
  if (newPw.length < 6) { errEl.textContent = '新しいパスワードは6文字以上にしてください'; return; }
  if (newPw !== n2.value) { errEl.textContent = '新しいパスワードが2回とも同じになっていません'; return; }
  errEl.textContent = ''; if (btn) btn.disabled = true;
  try {
    await api('changePassword', { oldPassword: oldPw, newPassword: newPw });
    const wasFirst = ui.mustChange;
    ui.mustChange = false;
    if (ui.modal && ui.modal.type === 'pw') closeModal();
    toast('パスワードを変えました');
    if (wasFirst) await startApp();
  } catch (e) {
    if (btn) btn.disabled = false;
    if (e.code === 'auth') { handleError(e); return; }
    errEl.textContent = e.message;
  }
}
async function doLogout(){
  if (!guard()) return;
  if (!confirm('ログアウトしますか？')) return;
  try { await api('logout', {}); } catch (e) { /* 期限切れでもそのままログアウトする */ }
  clearLogin(); ui.view = 'dash'; render(); window.scrollTo(0, 0); toast('ログアウトしました');
}
