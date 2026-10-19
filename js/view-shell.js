'use strict';
/* ===== ログイン・パスワード変更の画面 ===== */
function loginHtml(){
  return `<div class="login-wrap"><div class="card login">
    <h1><span class="brand-mark">本</span>本部アプリ</h1>
    <label class="fl">ログインID<input class="inp" id="lg-id" autocomplete="username" autocapitalize="off"></label>
    <label class="fl">パスワード<input class="inp" id="lg-pw" type="password" autocomplete="current-password"></label>
    <label class="check"><input type="checkbox" checked disabled> 30日間ログインしたままにする</label>
    <button class="btn btn-primary btn-block" data-act="login">ログイン</button>
    <div class="err" id="lg-err"></div>
    <p class="muted small" style="margin:0">ログインIDとパスワードは、管理者（本部長）から受け取ってください。パスワードを忘れたときも管理者に伝えてください。</p>
  </div></div>
  <button class="login-gear" data-act="settings" aria-label="設定">${ICON.gear}設定</button>`;
}
function pwForm(first){
  return `<label class="fl">${first ? '仮パスワード' : '今のパスワード'}<input class="inp" id="pw-old" type="password" autocomplete="current-password"></label>
    <label class="fl">新しいパスワード（6文字以上）<input class="inp" id="pw-new" type="password" autocomplete="new-password"></label>
    <label class="fl">新しいパスワード（確認のためもう一度）<input class="inp" id="pw-new2" type="password" autocomplete="new-password"></label>
    <div class="err" id="pw-err"></div>`;
}
function firstPwHtml(){
  const e = me();
  return `<div class="login-wrap"><div class="card login">
    <h1><span class="brand-mark">本</span>パスワードの変更</h1>
    <p class="muted" style="margin:0">${e ? esc(e.name) + 'さん、' : ''}はじめに、仮パスワードを自分だけのパスワードに変えてください。</p>
    ${pwForm(true)}
    <button class="btn btn-primary btn-block" data-act="pw-save">変更して始める</button>
    <button class="btn btn-block" data-act="logout-now">ログイン画面に戻る</button>
  </div></div>`;
}
function bootHtml(){ return `<div class="login-wrap"><div class="muted" style="display:flex;align-items:center;gap:10px"><span class="spin"></span>読み込み中…</div></div>`; }

/* ===== 外枠 ===== */
const NAV = [
  {v:'dash',label:'全体',full:'全体ページ',icon:ICON.grid},
  {v:'emp',label:'社員',full:'社員ページ',icon:ICON.user},
  {v:'att',label:'出勤',full:'出勤カレンダー',icon:ICON.cal}
];
const TITLES = {dash:'全体ページ',emp:'社員ページ',att:'出勤カレンダー',admin:'システム管理'};
function shell(){
  const u=me();
  let body='';
  if(ui.view==='emp') body=renderEmp();
  else if(ui.view==='att') body=renderAtt();
  else if(ui.view==='admin') body=renderAdmin();
  else body=renderDash();
  return `<div class="app">
  <aside class="sidebar"><div class="brand"><button class="side-toggle" data-act="nav-mini" aria-label="${prefs.navMini?'メニューを開く':'メニューをたたむ'}" aria-expanded="${!prefs.navMini}">${ICON.menu}</button><span class="brand-mark">本</span><span class="brand-t">本部アプリ</span></div>
    ${NAV.map(n=>`<button class="nav-btn ${ui.view===n.v?'on':''}" data-act="nav" data-v="${n.v}" title="${n.full}">${n.icon}<span class="nl-f">${n.full}</span><span class="nl-s">${n.label}</span></button>`).join('')}
    <button class="nav-btn" disabled>${ICON.chart}<span>月次レポート</span><span class="soon">次の段階</span></button>
    <button class="nav-btn ${ui.view==='admin'?'on':''}" data-act="nav" data-v="admin" title="システム管理">${ICON.sliders}<span class="nl-f">システム管理</span><span class="nl-s">管理</span></button>
    <div class="side-foot"><div class="side-user"><span class="avatar">${esc(u.name.slice(0,1))}</span><span>${esc(u.name)}</span>${u.admin?'<span class="chip acc">管理者</span>':''}</div>
      <button class="nav-btn" data-act="settings">${ICON.gear}<span>設定</span></button></div>
  </aside>
  <div class="main-col">
    <header class="topbar"><div class="tb-brand show-sm"><span class="brand-mark">本</span>本部アプリ</div><h1 class="hide-sm">${TITLES[ui.view]||''}</h1>
      <div class="top-right">
        <span class="pill" title="朝8時で日付が切り替わります">業務日 ${fmtMD(bizToday())}</span>
        <button class="userchip show-sm" data-act="settings" aria-label="設定とログイン（${esc(u.name)}）"><span class="avatar">${esc(u.name.slice(0,1))}</span></button></div>
    </header>
    <main class="content">${body}</main>
  </div>
  <nav class="bottom-nav"><button data-act="settings">${ICON.gear}<span>設定</span></button>${NAV.map(n=>`<button class="${ui.view===n.v?'on':''}" data-act="nav" data-v="${n.v}">${n.icon}<span>${n.label}</span></button>`).join('')}</nav>
  </div>`;
}

/* ===== 表示 ===== */
const app=document.getElementById('app');
function render(){
  const keep={};
  ['att-wrap'].forEach(id=>{ const el=document.getElementById(id); if(el) keep[id]=el.scrollLeft; });
  if(!session.token || !ui.user) app.innerHTML = loginHtml();
  else if(ui.mustChange) app.innerHTML = firstPwHtml();
  else if(ui.booting || !me()) app.innerHTML = bootHtml();
  else app.innerHTML = shell();
  const aw=document.getElementById('att-wrap');
  if(aw){
    if(ui.attScrolled && keep['att-wrap']!=null) aw.scrollLeft=keep['att-wrap'];
    else { const th=document.getElementById('att-today'); if(th) aw.scrollLeft=Math.max(0,th.offsetLeft-140); ui.attScrolled=true; }
  }
  renderModal();
}
function refreshTasks(){ const el=document.getElementById('tasklist'); if(el) el.innerHTML=taskListHtml(ui.empId); }
let toastTimer=null;
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.className='show'; clearTimeout(toastTimer); undoSnap=null; toastTimer=setTimeout(()=>{ t.className=''; },3200); }
// 指が当たってしまったときのために、しばらく「元に戻す」を出す
let undoSnap=null;
function toastUndo(msg,snap){
  const t=document.getElementById('toast');
  t.innerHTML=`<span>${esc(msg)}</span><button data-act="undo">元に戻す</button>`;
  t.className='show act'; clearTimeout(toastTimer); undoSnap=snap;
  toastTimer=setTimeout(()=>{ t.className=''; undoSnap=null; },6000);
}
