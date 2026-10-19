'use strict';
/* ===== 全体ページ ===== */
function stat(l,v,u,sub,alert){ return `<div class="card stat ${alert?'alert':''}"><div class="lbl">${l}</div><div class="val">${v}<small>${u}</small></div>${sub?`<div class="muted small">${sub}</div>`:'<div class="small">&nbsp;</div>'}</div>`; }
// 共通の集計（アプリの全体ページとスプレッドシートで同じものを使う）
function dayStats(d){
  const E=staff(); let nIn=0,nOff=0,nSub=0; const warn=[];
  E.forEach(e=>{ const a=att(e.id,d), r=rep(e.id,d), s=r&&r.status==='submitted'; if(a==='in') nIn++; else if(a==='off') nOff++; if(s) nSub++; if(a==='in'&&!s) warn.push(e.name); });
  return {nIn,nOff,unreg:E.length-nIn-nOff,nSub,warn};
}
function monthAgg(m){
  const work={}, task={}; let total=0;
  const rows=data.employees.map(e=>{
    const s=monthStats(e.id,m), cost=s.days?MONTHLY_COST:0; total+=cost;
    Object.keys(s.byWork).forEach(k=>{ work[k]=work[k]||{min:0,cost:0}; work[k].min+=s.byWork[k]; work[k].cost+=s.byWork[k]/60*s.rate; });
    Object.keys(s.byTask).forEach(k=>{ task[k]=task[k]||{min:0,cost:0}; task[k].min+=s.byTask[k]; task[k].cost+=s.byTask[k]/60*s.rate; });
    return {e,s,cost};
  }).filter(r=>r.e.active||r.s.days>0);
  const sort=o=>Object.entries(o).sort((a,b)=>b[1].cost-a[1].cost);
  return {rows,total,work:sort(work),task:sort(task)};
}
const overdueList = () => live().filter(t=>overdue(t)&&!kidsOf(t.id).length).sort((a,b)=>a.due<b.due?-1:1);
const importantList = () => live().filter(t=>t.priority==='高'&&!done(t)).sort(cmpTask);
const workLabel = k => { const i=k.indexOf('|'); return {kind:k.slice(0,i)==='plus'?'＋α業務':'基本業務', name:k.slice(i+1)}; };

function dashCalendar(){
  const m=ui.dashMonth, n=dim(m), first=dowOf(m+'-01'), today=bizToday(), N=staff().length;
  let cells='';
  for(let i=0;i<first;i++) cells+='<div class="dc empty" aria-hidden="true"></div>';
  for(let i=1;i<=n;i++){
    const d=m+'-'+pad(i), fut=d>today, w=dowOf(d), st=fut?null:dayStats(d);
    const cls=['dc', d===ui.dashDate?'sel':'', d===today?'today':'', w===0?'sun':w===6?'sat':'', holName(d)?'hol':'', fut?'fut':''].join(' ');
    cells+=`<button class="${cls}" data-act="dash-date" data-d="${d}" aria-label="${fmtMD(d)}${st?` 出勤${st.nIn}人 日報${st.nSub}人${st.warn.length?' 未提出'+st.warn.length+'人':''}`:''}"><span class="dn">${i}</span>${holName(d)?`<span class="hn">${holName(d)}</span>`:''}${st?`<span class="dc-l r-in"><span class="lt-l">出勤 </span><span class="lt-s c-in">出</span><span class="nv"><b>${st.nIn}</b>/${N}</span></span><span class="dc-l r-rp"><span class="lt-l">日報 </span><span class="lt-s c-rp">報</span><span class="nv"><b>${st.nSub}</b></span></span>${st.warn.length?`<span class="dc-w"><span class="lt-l">未提出 </span><span class="lt-s c-nr">未</span><span class="nv">${st.warn.length}</span></span>`:''}`:''}</button>`;
  }
  const off = ui.dashDate!==today || ui.dashMonth!==ymOf(today);
  return `<div class="card dash-cal"><div class="cal-h"><button class="ib bd" data-act="dash-month" data-n="-1" aria-label="前の月">${ICON.chevL}</button><h3>${fmtYM(m)}</h3><button class="ib bd" data-act="dash-month" data-n="1" aria-label="次の月">${ICON.chevR}</button>${off?'<button class="btn btn-sm" data-act="dash-today">今日</button>':''}</div>
    <div class="dcal">${DOW.map((x,i)=>`<div class="dw" style="${i===0?'color:var(--bad)':i===6?'color:var(--accent)':''}">${x}</div>`).join('')}${cells}</div>
    <div class="cal-leg">日付を押すと、下の内容がその日に切り替わります。朝8時で日付が切り替わります。</div></div>`;
}
function renderDash(){
  const d=ui.dashDate, today=bizToday(), E=staff(), st=dayStats(d), od=overdueList(), imp=importantList();
  return `${dashCalendar()}
  <div class="sec-h"><h2>${fmtMD(d)} のまとめ</h2>${d===today?'<span class="chip acc">今日</span>':''}</div>
  <div class="stats">${stat('出勤',st.nIn,'人',st.unreg?`未登録 ${st.unreg}人`:'')}${stat('欠勤',st.nOff,'人','')}${stat('日報 提出',st.nSub,'人',`出勤 ${st.nIn}人のうち`)}${stat('日報 未提出',st.warn.length,'人',st.warn.length?'出勤しているのに未提出':'',st.warn.length>0)}</div>
  ${st.warn.length?`<div class="banner bad">${ICON.warn}<div>出勤しているのに日報が未提出です：<b>${st.warn.map(esc).join('、')}</b></div></div>`:''}
  <div class="sec-h"><h2>${fmtMD(d)} の一人ひとり</h2></div>
  <div class="emp-grid">${E.map(e=>dashCard(e,d)).join('')}</div>
  <div class="sec-h"><h2>一人ひとりの進み具合</h2><span class="muted small">主担当のタスクすべてを比重で計算</span></div>
  ${progressCard()}
  <div class="sec-h"><h2>期限超過・重要タスク</h2></div>
  <div class="two" style="margin-top:0">
    <div class="card"><div class="card-h"><h3>期限超過のタスク</h3><span class="chip ${od.length?'bad dl':''}">${od.length}件</span></div>${od.length?od.map(miniTask).join(''):'<div class="empty">期限超過のタスクはありません</div>'}</div>
    <div class="card"><div class="card-h"><h3>重要タスク（優先度 高）</h3><span class="chip">${imp.length}件</span></div>${imp.length?imp.map(miniTask).join(''):'<div class="empty">優先度「高」のタスクはありません</div>'}</div>
  </div>
  ${monthCards(ui.dashMonth)}`;
}
function dashCard(e,d){
  const a=att(e.id,d), r=rep(e.id,d), items=r?r.items:[], sub=r&&r.status==='submitted';
  const rc = sub?'<span class="chip good">日報 提出済み</span>':(r&&r.status==='draft'?'<span class="chip warn">日報 下書き</span>':(a==='in'?'<span class="chip bad nr">日報 未提出</span>':''));
  const showHours = a==='in' || items.length>0;
  const c=calc(items);
  const list = items.length
    ? `<ul class="items">${items.map(x=>`<li><span class="k ${x.kind}">${x.kind==='plus'?'＋α':'基本'}</span><span class="nm">${esc(x.name)}${x.memo?` <span class="memo">${esc(x.memo)}</span>`:''}</span><span class="h">${fmtH(x.min)}</span></li>`).join('')}</ul>`
    : (a==='in'?'<div class="items-empty">日報がまだありません。このままだと11時間すべてが「その他の基本業務」になります。</div>':'');
  return `<div class="card"><div class="ecard-h"><span class="avatar">${esc(e.name.slice(0,1))}</span>
    <div style="flex:1;min-width:0"><button class="nm" data-act="open-emp" data-e="${e.id}">${esc(e.name)}</button>${e.title?` <span class="muted small">${esc(e.title)}</span>`:''}<div class="muted small">${e.shift}</div></div></div>
    <div class="ecard-chips">${attChip(a)}${rc}</div>
    ${showHours?`<div class="ecard-hours">${day11(items)}${c.over?`<div class="small" style="color:var(--warn);margin-top:4px;font-weight:700">入力の合計 ${fmtH(c.total)}・11時間を超えています</div>`:''}</div>`:`<div class="ecard-hours muted small">${a==='off'?'欠勤の日です':'出勤が登録されていません'}</div>`}
    ${list}</div>`;
}
function progressCard(){
  return `<div class="card prog-list">${staff().map(e=>{
    const p=empProg(e.id), ts=rootTasks(e.id).sort(cmpTask);
    return `<div class="pr"><div class="pr-h"><button class="nm" data-act="open-emp" data-e="${e.id}">${esc(e.name)}</button>
      <div class="pr-bar"><div class="pbar big"><i style="width:${p.pct}%"></i></div><b>${Math.round(p.pct)}%</b></div>
      <span class="muted small">完了 ${p.done}/${p.roots}件</span>${p.over?`<span class="chip bad dl">期限超過 ${p.over}件</span>`:''}</div>
      ${ts.length?`<ul class="pr-tasks">${ts.map(t=>{ const q=prog(t), o=overdue(t); return `<li class="${done(t)?'is-done':''}"><button class="pr-t" data-act="task-open" data-id="${t.id}"><i class="pri pri-${PRI_CLS[t.priority]}" title="優先度 ${t.priority}"></i><span class="tt">${esc(t.title)}</span></button><span class="pbar"><i style="width:${q}%"></i></span><span class="pct">${Math.round(q)}%</span><span class="due ${o?'od':''}">${t.due?(o?'超過 ':'')+fmtMD(t.due):''}</span></li>`; }).join('')}</ul>`:'<div class="muted small" style="margin-top:6px">主担当のタスクはありません</div>'}</div>`;
  }).join('')}</div>`;
}
function monthCards(m){
  const ag=monthAgg(m);
  const prov = m===ymOf(bizToday()) ? '月の途中なので暫定の数字です' : '';
  const empRows=ag.rows.map(({e,s,cost})=>`<tr><td>${esc(e.name)}</td><td class="num">${s.days}日</td><td class="num">${s.days?yen(s.rate):'—'}</td><td class="num">${yen(cost)}</td><td class="num">${fmtH(s.basicMin)}</td><td class="num">${fmtH(s.plusMin)}</td></tr>`).join('');
  const workRows=ag.work.length?ag.work.map(([k,v])=>{ const w=workLabel(k); return `<tr><td>${esc(w.name)}</td><td>${w.kind}</td><td class="num">${fmtH(v.min)}</td><td class="num">${yen(v.cost)}</td></tr>`; }).join(''):'<tr><td colspan="4" class="muted">この月のデータはありません</td></tr>';
  const taskRows=ag.task.length?ag.task.map(([id,v])=>{ const t=taskById(id); return `<tr><td>${esc(t?t.title:id)}</td><td class="num">${fmtH(v.min)}</td><td class="num">${yen(v.cost)}</td></tr>`; }).join(''):'<tr><td colspan="3" class="muted">タスクに紐づいた＋α業務はまだありません</td></tr>';
  return `<div class="sec-h"><h2>${fmtYM(m)} のまとめ</h2><span class="muted small">${prov}</span></div>
  <div class="card"><div class="card-h"><h3>社員別</h3></div><div class="tw" data-drag-scroll><table class="mt"><thead><tr><th>社員</th><th class="num">出勤日数</th><th class="num">時給</th><th class="num">人件費</th><th class="num">基本業務</th><th class="num">＋α業務</th></tr></thead><tbody>${empRows}<tr class="total"><td>合計</td><td></td><td></td><td class="num">${yen(ag.total)}</td><td></td><td></td></tr></tbody></table></div></div>
  <div class="two">
    <div class="card"><div class="card-h"><h3>業務別の人件費</h3></div><div class="tw" data-drag-scroll><table class="mt"><thead><tr><th>業務名</th><th>区分</th><th class="num">時間</th><th class="num">人件費</th></tr></thead><tbody>${workRows}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h3>タスク別の累計人件費</h3></div><div class="tw" data-drag-scroll><table class="mt"><thead><tr><th>タスク</th><th class="num">時間</th><th class="num">人件費</th></tr></thead><tbody>${taskRows}</tbody></table></div></div>
  </div>`;
}
function miniTask(t){
  const p=prog(t), st=statusOf(t);
  return `<button class="mini" data-act="task-open" data-id="${t.id}"><i class="pri pri-${PRI_CLS[t.priority]}" title="優先度 ${t.priority}"></i>
    <div class="mini-b"><div class="mini-t">${esc(t.title)}</div><div class="tmeta"><span>${esc(empName(t.owner))}</span>${t.due?`<span class="due ${overdue(t)?'od':''}">期限 ${fmtMD(t.due)}</span>`:''}<span class="st st-${ST_CLS[st]}">${st}</span></div></div>
    <div class="mini-p"><div class="pbar"><i style="width:${p}%"></i></div><span>${Math.round(p)}%</span></div></button>`;
}

