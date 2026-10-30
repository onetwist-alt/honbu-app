'use strict';
/* ===== クリック ===== */
const ACT={
  login(){ doLogin(); },
  logout(){ doLogout(); },
  'logout-now'(){ clearLogin(); render(); },
  'pw-open'(){ ui.modal={type:'pw'}; renderModal(); setTimeout(()=>{ const i=document.getElementById('pw-old'); if(i) i.focus(); },30); },
  'pw-save'(){ savePassword(); },
  'open-admin'(){ if(!guard()) return; ui.modal=null; ui.view='admin'; render(); window.scrollTo(0,0); },
  'wt-add'(){ addWorkType(); },
  'wt-toggle'(el){ toggleWorkType(el.dataset.id); },
  'emp-add'(){ addEmployee(); },
  'emp-edit'(el){ ui.modal={type:'empEdit',id:el.dataset.id}; renderModal(); },
  'ee-save'(){ saveEmpEdit(); },
  'emp-reset'(el){ resetPw(el.dataset.id); },
  'emp-retire'(el){ retireEmp(el.dataset.id); },
  'cost-save'(){ saveCost(); },
  install(){ doInstall(); },
  'open-report'(el){ if(!guard()) return; ui.modal=null; if(el.dataset.ym) ui.repMonth=el.dataset.ym; ui.view='report'; render(); window.scrollTo(0,0); loadReport(ui.repMonth); },
  'rep-month'(el){ ui.repMonth=addMonths(ui.repMonth,+el.dataset.n); render(); loadReport(ui.repMonth); },
  'rep-close'(){ closeMonth(); },
  settings(){ ui.modal={type:'settings'}; renderModal(); },
  'set-theme'(el){
    const v=el.dataset.v, now=Date.now();
    if(v==='light'){ tapN = (now-tapAt<1200) ? tapN+1 : 1; tapAt=now; } else tapN=0;
    prefs.theme = (v==='light' && tapN>=3) ? 'ura' : v;
    savePrefs(); applyPrefs(); render(); },
  'set-fs'(el){ prefs.fs=el.dataset.v; savePrefs(); applyPrefs(); renderModal(); },
  'goto-login'(){ closeModal(); const i=document.getElementById('lg-id'); if(i) i.focus(); },
  nav(el){ if(el.dataset.v===ui.view) return; if(!guard()) return; ui.view=el.dataset.v; if(ui.view==='emp'&&!ui.empId) ui.empId=ui.user; render(); window.scrollTo(0,0);
    if(ui.view==='dash') ensureMonths([ui.dashMonth]); else if(ui.view==='att') ensureMonths([ui.attMonth]); else if(ui.view==='emp') ensureCal(); else if(ui.view==='report') loadReport(ui.repMonth); },
  'dash-month'(el){ ui.dashMonth=addMonths(ui.dashMonth,+el.dataset.n); render(); ensureMonths([ui.dashMonth]); },
  'dash-date'(el){ ui.dashDate=el.dataset.d; ui.dashMonth=ymOf(el.dataset.d); render(); },
  'dash-today'(){ ui.dashDate=bizToday(); ui.dashMonth=ymOf(ui.dashDate); render(); ensureMonths([ui.dashMonth]); },
  'open-emp'(el){ if(!guard()) return; ui.view='emp'; ui.empId=el.dataset.e; ui.selDate=ui.dashDate; ui.calMonth=ymOf(ui.dashDate); ui.wc=null; ui.sub='cal'; render(); window.scrollTo(0,0); },
  'emp-sel'(el){ if(el.dataset.e===ui.empId) return; if(!guard()) return; ui.empId=el.dataset.e; ui.wc=null; ui.progEdit=null; render(); },
  noop(){},
  'nav-mini'(){ prefs.navMini=!prefs.navMini; savePrefs(); applyPrefs(); render(); },
  undo(){ undoLast(); },
  sub(el){ ui.sub=el.dataset.s; render(); },
  'cal-step'(el){ const n=+el.dataset.n; if(ui.calMode==='month'){ ui.calMonth=addMonths(ui.calMonth,n); } else { if(!guard()) return; ui.selDate=addDays(ui.selDate,7*n); ui.calMonth=ymOf(ui.selDate); } render(); ensureCal(); },
  'cal-mode'(el){ ui.calMode=el.dataset.m; ui.calMonth=ymOf(ui.selDate); render(); ensureCal(); },
  'sel-date'(el){ const d=el.dataset.d; if(d===ui.selDate) return; if(!guard()) return; ui.selDate=d; ui.calMonth=ymOf(d); renderEmpParts(true); },
  'entry-kind'(el){ if(ui.entry.kind===el.dataset.k) return; ui.entry.kind=el.dataset.k; ui.entry.name=''; ui.entry.taskId=''; renderEmpParts(false); },
  sugg(el){ ui.entry.name=el.dataset.n; const i=document.getElementById('en-name'); if(i) i.value=ui.entry.name; document.getElementById('sugg').innerHTML=suggHtml(); },
  'min-step'(el){ ui.entry.min=Math.min(DAY_MIN,Math.max(30,ui.entry.min+(+el.dataset.n))); renderEmpParts(false); },
  'min-set'(el){ ui.entry.min=+el.dataset.m; renderEmpParts(false); },
  'entry-add'(){ addEntry(); },
  'item-del'(el){ const wc=wcFor(ui.empId,ui.selDate); wc.items.splice(+el.dataset.i,1); renderEmpParts(false); },
  'item-edit'(el){ const wc=wcFor(ui.empId,ui.selDate), i=+el.dataset.i; if(!wc.items[i]) return; ui.modal={type:'item',i,draft:clone(wc.items[i])}; renderModal(); setTimeout(()=>{ const m=document.getElementById('it-memo'); if(m) m.focus(); },30); },
  'it-kind'(el){ const x=ui.modal.draft; if(x.kind===el.dataset.k) return; x.kind=el.dataset.k; x.taskId=''; renderModal(); },
  'it-sugg'(el){ const x=ui.modal.draft; x.name=el.dataset.n; const i=document.getElementById('it-name'); if(i) i.value=x.name; document.getElementById('it-sugg').innerHTML=suggList(x.kind,x.name,'it-sugg','保存'); },
  'it-min-step'(el){ const x=ui.modal.draft; x.min=Math.min(DAY_MIN,Math.max(30,x.min+(+el.dataset.n))); renderModal(); },
  'it-min-set'(el){ ui.modal.draft.min=+el.dataset.m; renderModal(); },
  'it-save'(){ const x=ui.modal.draft; x.name=(x.name||'').trim(); x.memo=(x.memo||'').trim(); if(!x.name){ toast('業務名を選ぶか、入力してください'); return; } if(x.kind!=='plus') x.taskId=''; const wc=wcFor(ui.empId,ui.selDate); wc.items[ui.modal.i]=x; closeModal(); render(); toast('直しました。最後に「下書き保存」か「変更を提出」を押してください'); },
  'it-del'(){ const wc=wcFor(ui.empId,ui.selDate); wc.items.splice(ui.modal.i,1); closeModal(); render(); toast('消しました。最後に「下書き保存」か「変更を提出」を押してください'); },
  'rep-draft'(){ saveReport('draft'); },
  'rep-submit'(){ saveReport('submitted'); },
  'rep-revert'(){ ui.wc=null; render(); },
  'task-new'(){ openTask(null,{owner:ui.empId||ui.user}); },
  'task-open'(el){ openTask(el.dataset.id); },
  'task-toggle'(el){ toggleDone(el.dataset.id); },
  'task-pause'(el){ togglePause(el.dataset.id); },
  'task-expand'(el){ const id=el.dataset.id; ui.expanded[id]=!ui.expanded[id]; refreshTasks(); },
  filter(el){ ui.filter=el.dataset.f; refreshTasks(); document.querySelectorAll('[data-act="filter"]').forEach(b=>b.classList.toggle('on',b.dataset.f===ui.filter)); },
  'modal-close'(){ closeModal(); },
  'tf-pri'(el){ ui.modal.pri=el.dataset.v; document.querySelectorAll('#tf-pri button').forEach(b=>b.classList.toggle('on',b===el)); },
  'tf-save'(){ saveTaskForm(); },
  'tf-delete'(){ deleteTaskForm(); },
  'bulk-new'(){ ui.modal={type:'bulk',owner:ui.empId||ui.user}; renderModal(); },
  'tf-bulk'(){ const t=taskById(ui.modal.id); ui.modal={type:'bulk',parent:t.id,owner:t.owner}; renderModal(); },
  'bk-ins'(el){ const x=document.getElementById('bk-text'); if(!x) return; const s=x.selectionStart||0, line=x.value.slice(0,s).split('\n').pop(); const ind=(line.match(/^[ \t　]*/)||[''])[0]; const atStart=!line.trim(); x.setRangeText((atStart?'':'\n'+ind)+el.dataset.t, s, x.selectionEnd||s, 'end'); x.focus(); updBulkPreview(); },
  'bk-save'(){ saveBulk(); },
  'tf-child'(){ const t=taskById(ui.modal.id); ui.modal=null; openTask(null,{owner:t.owner,parent:t.id}); },
  'att-step'(el){ ui.attMonth=addMonths(ui.attMonth,+el.dataset.n); ui.attScrolled=false; render(); ensureMonths([ui.attMonth]); },
  'att-cycle'(el){ cycleAtt(el.dataset.e,el.dataset.d); }
};
// 社員ページのカレンダーで見ている月（週表示は月をまたぐことがある）を読み込む
function ensureCal(){ const ws=addDays(ui.selDate,-dowOf(ui.selDate)); ensureMonths(ui.calMode==='month'?[ui.calMonth]:[ymOf(ws),ymOf(addDays(ws,6))]); }
document.addEventListener('click',ev=>{
  const el=ev.target.closest('[data-act]'); if(!el) return;
  const a=el.dataset.act;
  if(a==='modal-bg'){ if(ev.target===el) closeModal(); return; }
  if(el.disabled) return;
  const fn=ACT[a]; if(fn){ ev.preventDefault(); fn(el,ev); }
});
document.addEventListener('input',ev=>{
  const t=ev.target;
  if(t.id==='tf-prog'){ document.getElementById('tf-prog-o').textContent=t.value+'%'; return; }
  const f=t.dataset&&t.dataset.field; if(!f) return;
  if(f==='search'){ ui.search=t.value; refreshTasks(); }
  else if(f==='entry-name'){ ui.entry.name=t.value; const s=document.getElementById('sugg'); if(s) s.innerHTML=suggHtml(); }
  else if(f==='entry-memo'){ ui.entry.memo=t.value; }
  else if(f==='bk-text'){ updBulkPreview(); }
  else if(f==='it-name' && ui.modal && ui.modal.draft){ ui.modal.draft.name=t.value; const s=document.getElementById('it-sugg'); if(s) s.innerHTML=suggList(ui.modal.draft.kind,t.value,'it-sugg','保存'); }
  else if(f==='it-memo' && ui.modal && ui.modal.draft){ ui.modal.draft.memo=t.value; }
});
document.addEventListener('change',ev=>{
  const t=ev.target, f=t.dataset&&t.dataset.field;
  if(f==='entry-task'){ ui.entry.taskId=t.value; }
  else if(f==='it-task' && ui.modal && ui.modal.draft){ ui.modal.draft.taskId=t.value; }
  else if(f==='dash-date'){ if(t.value){ ui.dashDate=t.value; render(); } }
  else if(t.id==='bk-owner'||t.id==='bk-start'||t.id==='bk-month'){ updBulkPreview(); }
  else if(t.id==='tf-rec-on'){ document.getElementById('tf-rec').hidden=!t.checked; }
  else if(t.id==='tf-rec-type'){ const g=id=>document.getElementById(id); g('tf-rec-dow').hidden=t.value!=='weekly'; g('tf-rec-dom').hidden=t.value!=='monthly'; g('tf-rec-due-d').hidden=t.value!=='daily'; g('tf-rec-due-w').hidden=t.value!=='weekly'; g('tf-rec-due-m').hidden=t.value!=='monthly'; }
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Tab' && ev.target.id==='bk-text'){ ev.preventDefault(); const x=ev.target, s=x.selectionStart; if(ev.shiftKey){ const ls=x.value.lastIndexOf('\n',s-1)+1; if(x.value.slice(ls,ls+2)==='  '){ x.setRangeText('',ls,ls+2,'preserve'); } } else x.setRangeText('  ',s,x.selectionEnd,'end'); updBulkPreview(); return; }
  if(ev.key==='Escape' && ui.modal){ closeModal(); return; }
  if(ev.key==='Enter'){
    const id=ev.target.id;
    if(id==='lg-id'||id==='lg-pw'){ ev.preventDefault(); doLogin(); }
    else if(id==='en-name'||id==='en-memo'){ ev.preventDefault(); addEntry(); }
    else if(id==='it-name'||id==='it-memo'){ ev.preventDefault(); ACT['it-save'](); }
    else if(id==='pw-old'||id==='pw-new'||id==='pw-new2'){ ev.preventDefault(); savePassword(); }
    else if(id==='wt-name'){ ev.preventDefault(); addWorkType(); }
  }
});

/* ===== 進捗バーのつまみ ===== */
// つまみをつかんだときだけ動く。バーの他の場所に触れても変わらない。離したら保存して「元に戻す」を出す
let drag=null;
function paintDrag(dg){
  dg.th.style.left=dg.val+'%';
  const bar=dg.sl.querySelector('.pbar i'); if(bar) bar.style.width=dg.val+'%';
  const pv=dg.sl.parentElement.querySelector('.pval'); if(pv) pv.textContent=dg.val+'%';
  dg.th.setAttribute('aria-valuenow',dg.val);
}
document.addEventListener('pointerdown',ev=>{
  const th=ev.target.closest&&ev.target.closest('.pthumb'); if(!th) return;
  ev.preventDefault();
  const t=taskById(th.dataset.id); if(!t) return;
  const sl=th.parentElement, v=Math.round(prog(t));
  drag={id:th.dataset.id, th, sl, rect:sl.getBoundingClientRect(), start:v, val:v};
  try{ th.setPointerCapture(ev.pointerId); }catch(e){}
  sl.classList.add('drag');
});
document.addEventListener('pointermove',ev=>{
  if(!drag) return;
  const r=drag.rect; if(!r.width) return;
  const v=Math.round(Math.min(100,Math.max(0,(ev.clientX-r.left)/r.width*100))/5)*5;
  if(v!==drag.val){ drag.val=v; paintDrag(drag); }
});
function endDrag(ev){
  if(!drag) return;
  const dg=drag; drag=null; dg.sl.classList.remove('drag');
  if(ev.type==='pointercancel' || dg.val===dg.start){ dg.val=dg.start; paintDrag(dg); return; }
  setProgress(dg.id, dg.val);
}
document.addEventListener('pointerup',endDrag);
document.addEventListener('pointercancel',endDrag);
document.addEventListener('keydown',ev=>{
  const th=ev.target; if(!th.classList || !th.classList.contains('pthumb')) return;
  const t=taskById(th.dataset.id); if(!t) return;
  const cur=Math.round(prog(t)); let v=null;
  if(ev.key==='ArrowRight'||ev.key==='ArrowUp') v=Math.min(100,cur+5);
  else if(ev.key==='ArrowLeft'||ev.key==='ArrowDown') v=Math.max(0,cur-5);
  else if(ev.key==='Home') v=0; else if(ev.key==='End') v=100;
  if(v===null || v===cur) return;
  ev.preventDefault(); const id=th.dataset.id; setProgress(id,v);
  const again=document.querySelector(`.pthumb[data-id="${id}"]`); if(again) again.focus();
});

/* ===== 横に長い表をつかんで動かす ===== */
// スマホは指でそのまま横に動かせる。マウスでも中身をつかんで横に動かせるようにする
let ds=null, dsMoved=false, dsEndAt=0;
document.addEventListener('pointerdown',ev=>{
  dsMoved=false;
  if(ev.pointerType!=='mouse' || ev.button!==0) return;
  const el=ev.target.closest && ev.target.closest('[data-drag-scroll]'); if(!el) return;
  if(ev.target.closest('.pthumb,input,select,textarea')) return;
  if(el.scrollWidth<=el.clientWidth) return;
  ds={el, x:ev.clientX, left:el.scrollLeft};
});
document.addEventListener('pointermove',ev=>{
  if(!ds) return;
  const dx=ev.clientX-ds.x;
  if(!dsMoved && Math.abs(dx)<6) return;
  if(!dsMoved){ dsMoved=true; ds.el.classList.add('dragging'); }
  ds.el.scrollLeft=ds.left-dx; ev.preventDefault();
});
const dsEnd=()=>{ if(!ds) return; ds.el.classList.remove('dragging'); ds=null; dsEndAt=Date.now(); };
document.addEventListener('pointerup',dsEnd);
document.addEventListener('pointercancel',dsEnd);
// 動かした直後のクリックで、出勤などが切り替わらないようにする
window.addEventListener('click',ev=>{ if(dsMoved && Date.now()-dsEndAt<400){ ev.stopPropagation(); ev.preventDefault(); } dsMoved=false; },true);

