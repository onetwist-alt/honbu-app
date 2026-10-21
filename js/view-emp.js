'use strict';
/* ===== 社員ページ ===== */
function renderEmp(){
  if(!ui.empId || !emp(ui.empId)) ui.empId=ui.user;
  const e=emp(ui.empId), p=empProg(e.id), own=e.id===ui.user;
  return `<div class="emp-sel" role="tablist" data-drag-scroll>${staff().map(x=>`<button class="${x.id===e.id?'on':''}" data-act="emp-sel" data-e="${x.id}">${esc(x.name)}${x.id===ui.user?'（自分）':''}</button>`).join('')}</div>
  <div class="card profile">${ring(p.pct,74,7)}
    <div class="pinfo"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><h2 style="font-size:calc(19px * var(--fs))">${esc(e.name)}</h2>${e.title?`<span class="chip acc">${esc(e.title)}</span>`:''}<span class="chip">${e.shift}</span>${own?'':'<span class="chip warn">閲覧中</span>'}</div>
      <div class="pstats"><span><b>${p.roots}</b>件のタスク</span><span><b>${p.done}</b>件 完了</span><span style="color:${p.over?'var(--bad)':'inherit'}"><b style="color:inherit">${p.over}</b>件 期限超過</span></div>
      <div class="muted small" style="margin-top:2px">進捗メーター：主担当のタスクすべてを比重で計算（一時停止中も含む）</div></div></div>
  <div class="subtabs"><div class="seg"><button class="${ui.sub==='cal'?'on':''}" data-act="sub" data-s="cal">カレンダー・日報</button><button class="${ui.sub==='task'?'on':''}" data-act="sub" data-s="task">タスク</button></div></div>
  <div class="emp-layout" data-sub="${ui.sub}">
    <div class="panel p-cal"><div id="calcard">${calCard(e.id)}</div><div id="repcard">${reportCard(e.id,ui.selDate)}</div></div>
    <div class="panel p-task">${tasksCard(e.id)}</div>
  </div>`;
}
// 追加テーマ用：その日に残っている、自分が主担当の親タスクの数（期限を過ぎたものも含む）
function remainOn(eid,d){ return rootTasks(eid).filter(t=>!done(t) && (t.start||'')<=d).length; }
function dueMap(eid){ const m={}; visibleTasks(eid).forEach(t=>{ if(t.due && !done(t)) m[t.due]=(m[t.due]||0)+1; }); return m; }
function calCard(eid){
  const isM=ui.calMode==='month', ura=prefs.theme==='ura'; let title, grid;
  // 追加テーマでは、出勤の印の代わりにその日の残りのタスク数を出す
  const tkPill = d => { const n=remainOn(eid,d); return n?`<span class="tk" title="残りのタスク ${n}件"><span class="tl">タ</span>${n}</span>`:''; };
  if(isM){
    title=fmtYM(ui.calMonth);
    const m=ui.calMonth, n=dim(m), first=dowOf(m+'-01'), today=bizToday(), dm=dueMap(eid);
    let cells='';
    for(let i=0;i<first;i++) cells+='<div class="cc empty" aria-hidden="true"></div>';
    for(let i=1;i<=n;i++){
      const d=m+'-'+pad(i), w=dowOf(d);
      const cls=['cc', d===ui.selDate?'sel':'', d===today?'today':'', w===0?'sun':'', w===6?'sat':'', holName(d)?'hol':''].join(' ');
      cells+=`<button class="${cls}" data-act="sel-date" data-d="${d}" aria-label="${fmtMD(d)}${holName(d)?' '+holName(d):''}"><span class="dn">${i}</span>${holName(d)?`<span class="hn">${holName(d)}</span>`:''}<span class="cm">${ura?'':attMark(att(eid,d))}${repDot(eid,d)}${ura?tkPill(d):''}</span>${dm[d]?`<span class="duec">期限${dm[d]}</span>`:''}</button>`;
    }
    grid=`<div class="cal">${DOW.map((x,i)=>`<div class="dw ${i===0?'sun':i===6?'sat':''}">${x}</div>`).join('')}${cells}</div>`;
  } else {
    const ws=addDays(ui.selDate,-dowOf(ui.selDate)), today=bizToday();
    title=`${fmtMD(ws)}〜${fmtMD(addDays(ws,6))}`;
    const open=visibleTasks(eid).filter(t=>t.due && !done(t));
    let cells='';
    for(let i=0;i<7;i++){
      const d=addDays(ws,i), r=rep(eid,d), due=open.filter(t=>t.due===d);
      const cls=['cc', d===ui.selDate?'sel':'', d===today?'today':'', i===0?'sun':'', i===6?'sat':'', holName(d)?'hol':''].join(' ');
      cells+=`<button class="${cls}" data-act="sel-date" data-d="${d}"><span class="dn">${parseYmd(d).getDate()}日（${DOW[i]}）</span><span class="cm">${ura?'':attMark(att(eid,d))}${repDot(eid,d)}${ura?tkPill(d):''}${r&&r.items.length?`<span class="muted">＋α ${fmtH(calc(r.items).plus)}</span>`:''}</span>${due.length?`<ul>${due.slice(0,3).map(t=>`<li>期限：${esc(t.title)}</li>`).join('')}${due.length>3?`<li class="muted">ほか${due.length-3}件</li>`:''}</ul>`:''}</button>`;
    }
    grid=`<div class="week">${cells}</div>`;
  }
  return `<div class="card"><div class="cal-h"><button class="ib bd" data-act="cal-step" data-n="-1" aria-label="前へ">${ICON.chevL}</button><h3>${title}</h3><button class="ib bd" data-act="cal-step" data-n="1" aria-label="次へ">${ICON.chevR}</button>
    <div class="seg seg-sm"><button class="${isM?'on':''}" data-act="cal-mode" data-m="month">月</button><button class="${!isM?'on':''}" data-act="cal-mode" data-m="week">週</button></div></div>${grid}
    <div class="cal-leg">${ura?'<span><span class="tk"><span class="tl">タ</span>2</span>残りのタスク数</span>':'<span><b class="am in">✓</b>出勤</span><span><b class="am off">×</b>欠勤</span>'}<span><i class="dot good"></i>日報 提出</span><span><i class="dot warn"></i>下書き</span><span><i class="dot bad"></i>未提出</span><span><span class="duec" style="margin:0">期限</span>タスクの期限</span></div></div>`;
}
function wcFor(eid,d){
  const key=eid+'|'+d;
  if(!ui.wc || ui.wc.key!==key){ const r=rep(eid,d); ui.wc={key,items:clone(r?r.items:[])}; }
  return ui.wc;
}
function wcDirty(){ if(!ui.wc) return false; const r=data.reports[ui.wc.key]; return JSON.stringify(ui.wc.items)!==JSON.stringify(r?r.items:[]); }
function suggHtml(){ return suggList(ui.entry.kind, ui.entry.name, 'sugg', '追加'); }
function suggList(k, name, act, verb){
  const q=(name||'').trim();
  const list=data.workTypes.filter(w=>w.kind===k&&w.active!==false).sort((a,b)=>b.uses-a.uses).filter(w=>!q||w.name.includes(q)).slice(0,8);
  if(!list.length) return q?`<span class="sugg-new">候補にない業務名です。「${esc(q)}」のまま${verb}できます</span>`:'';
  return list.map(w=>`<button class="sg ${w.name===q?'on':''}" data-act="${act}" data-n="${esc(w.name)}">${esc(w.name)}</button>`).join('');
}
function reportCard(eid,d){
  const today=bizToday(), own=eid===ui.user, future=d>today, editable=own&&!future;
  const r=rep(eid,d);
  const items = editable ? wcFor(eid,d).items : (r?r.items:[]);
  const dirty = editable && wcDirty();
  const c=calc(items), a=att(eid,d);
  const stChip = r&&r.status==='submitted'?'<span class="chip good">提出済み</span>':(r&&r.status==='draft'?'<span class="chip warn">下書き</span>':'<span class="chip">未提出</span>');
  let form='';
  if(editable){
    const k=ui.entry.kind, myTasks=visibleTasks(eid).filter(t=>!done(t)).sort(cmpTask);
    form=`<div class="rep-form">
      <div class="seg" style="align-self:flex-start" role="group" aria-label="業務の区分"><button class="${k==='basic'?'on':''}" data-act="entry-kind" data-k="basic">基本業務</button><button class="${k==='plus'?'on':''}" data-act="entry-kind" data-k="plus">＋α業務</button></div>
      <label class="fl">業務名<input class="inp" id="en-name" data-field="entry-name" value="${esc(ui.entry.name)}" placeholder="候補から選ぶか、入力する" autocomplete="off"></label>
      <div class="sugg" id="sugg">${suggHtml()}</div>
      <label class="fl">詳細メモ（任意）<input class="inp" id="en-memo" data-field="entry-memo" value="${esc(ui.entry.memo)}" placeholder="例：田中さん 10月分" autocomplete="off"></label>
      ${k==='plus'?`<label class="fl">紐づけるタスク（任意）<select class="inp" data-field="entry-task"><option value="">なし</option>${myTasks.map(t=>`<option value="${t.id}" ${ui.entry.taskId===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select></label>`:''}
      <div class="time-row"><span class="fl">所要時間</span><div class="stepper"><button data-act="min-step" data-n="-30" aria-label="30分へらす">−</button><output>${fmtH(ui.entry.min)}</output><button data-act="min-step" data-n="30" aria-label="30分ふやす">＋</button></div>
        ${[60,120,180,240].map(m=>`<button class="qt ${ui.entry.min===m?'on':''}" data-act="min-set" data-m="${m}">${fmtH(m)}</button>`).join('')}</div>
      <button class="btn btn-primary btn-block" data-act="entry-add">${ICON.plus}業務を追加</button></div>`;
  } else if(!own){
    form=`<div class="banner info" style="margin:12px 16px 4px">${ICON.info}<div>日報は本人だけが入力できます。ここでは見るだけです。</div></div>`;
  } else {
    form=`<div class="banner info" style="margin:12px 16px 4px">${ICON.info}<div>まだ来ていない日なので、日報は入力できません。</div></div>`;
  }
  const list = items.length
    ? `<ul class="rep-items">${items.map((x,i)=>{ const tk=x.taskId?taskById(x.taskId):null; return `<li><span class="k ${x.kind}">${x.kind==='plus'?'＋α':'基本'}</span><div style="flex:1;min-width:0${editable?';cursor:pointer':''}" ${editable?`data-act="item-edit" data-i="${i}"`:''}><div style="font-weight:700">${esc(x.name)}</div>${x.memo||tk?`<div class="muted small">${esc(x.memo)}${tk?` <span class="tag">${ICON.link}${esc(tk.title)}</span>`:''}</div>`:''}</div><span class="h">${fmtH(x.min)}</span>${editable?`<button class="ib" data-act="item-edit" data-i="${i}" aria-label="${esc(x.name)}を直す">${ICON.edit}</button><button class="ib" data-act="item-del" data-i="${i}" aria-label="${esc(x.name)}を消す">${ICON.x}</button>`:''}</li>`; }).join('')}</ul>`
    : `<div class="empty">まだ業務がありません。${editable?'上で業務を選んで追加してください。':''}</div>`;
  const sum = `<div class="rep-sum">${day11(items)}${c.over?`<div class="banner warn">${ICON.warn}<div>入力の合計が <b>${fmtH(c.total)}</b> で、11時間を超えています。保存はできます。人件費はこの日を11時間分に縮めて計算します。</div></div>`:''}</div>`;
  let foot='';
  if(editable){
    if(r && r.status==='submitted'){
      foot = dirty
        ? `<div class="rep-foot"><button class="btn" data-act="rep-revert">変更を取り消す</button><button class="btn btn-primary" data-act="rep-submit" ${ui.saving?'disabled':''}>${ui.saving?'送信中…':'変更を提出'}</button></div>`
        : `<div class="rep-foot"><span class="muted small">提出済みです。同じ日なら何度でも直して再提出できます。</span></div>`;
    } else {
      foot = `<div class="rep-foot"><button class="btn" data-act="rep-draft" ${dirty&&!ui.saving?'':'disabled'}>下書き保存</button><button class="btn btn-primary" data-act="rep-submit" ${ui.saving?'disabled':''}>${ui.saving?'送信中…':'日報を提出'}</button></div>`;
    }
  }
  return `<div class="card"><div class="card-h"><h3>${fmtMD(d)} の日報</h3>${stChip}${dirty?'<span class="chip warn">保存していない変更</span>':''}<span style="margin-left:auto">${attChip(a)}</span></div>${form}${list}${sum}${foot}</div>`;
}
function tasksCard(eid){
  return `<div class="card"><div class="card-h"><h3>タスク</h3><span style="flex:1"></span><button class="btn btn-primary btn-sm" data-act="task-new">${ICON.plus}タスクを追加</button></div>
    <div class="tools"><input type="search" class="inp" id="task-search" placeholder="タスクを探す" value="${esc(ui.search)}" data-field="search" aria-label="タスクを探す">
      <div class="seg seg-sm">${[['open','未完了'],['all','すべて'],['done','完了']].map(([k,l])=>`<button class="${ui.filter===k?'on':''}" data-act="filter" data-f="${k}">${l}</button>`).join('')}</div></div>
    <div id="tasklist">${taskListHtml(eid)}</div></div>`;
}
function taskListHtml(eid){
  const vis=visibleTasks(eid), ids=new Set(vis.map(t=>t.id)), q=ui.search.trim();
  const passF = t => ui.filter==='all' || (ui.filter==='done'?done(t):!done(t));
  if(q){
    const hit=vis.filter(t=>(t.title+' '+t.detail+' '+t.memo).includes(q) && passF(t)).sort(cmpTask);
    return hit.length ? hit.map(t=>taskRow(t,0,eid,true)).join('') : `<div class="empty">「${esc(q)}」に合うタスクはありません</div>`;
  }
  const roots=vis.filter(t=>!t.parent || !ids.has(t.parent)).filter(passF).sort(cmpTask);
  if(!roots.length) return `<div class="empty">${ui.filter==='done'?'完了したタスクはありません':'タスクはありません。「タスクを追加」から登録できます'}</div>`;
  const tree = (t,depth) => { const kids=kidsOf(t.id).filter(k=>ids.has(k.id)).sort(cmpTask); let h=taskRow(t,depth,eid,false,kids.length); if(kids.length && ui.expanded[t.id]) h+=kids.map(k=>tree(k,depth+1)).join(''); return h; };
  return roots.map(t=>tree(t,0)).join('');
}
function taskRow(t,depth,eid,flat,nk){
  if(nk==null) nk=kidsOf(t.id).length;
  const p=prog(t), dn=p>=100, od=overdue(t), st=statusOf(t), today=bizToday();
  const soon = !od && !dn && t.due && t.due<=addDays(today,2);
  const par = flat && t.parent && taskById(t.parent) ? `<span class="muted">${esc(taskById(t.parent).title)} の子</span>` : '';
  return `<div class="trow ${dn?'is-done':''} ${depth?'sub':''}" style="--d:${depth}">
    <button class="tchk ${dn?'on':''}" data-act="task-toggle" data-id="${t.id}" aria-label="${dn?'完了を取り消す':'完了にする'}">${dn?(prefs.theme==='ura'?ICON.circ:ICON.check):''}</button>
    <div class="tbody" data-act="task-open" data-id="${t.id}">
      <div class="ttl"><i class="pri pri-${PRI_CLS[t.priority]}" title="優先度 ${t.priority}"></i><span class="tt">${esc(t.title)}</span>${t.owner!==eid?'<span class="tag tag-co">共同</span>':''}${t.rec?`<span class="tag tag-rec">${ICON.rec}${recLabel(t.rec)}</span>`:''}</div>
      <div class="tmeta"><span class="st st-${ST_CLS[st]}">${st}</span>${t.due?`<span class="due ${od?'od':soon?'soon':''}">${od?'期限超過':'期限'} ${fmtMD(t.due)}</span>`:''}<span>比重 ${t.weight}</span>${t.owner!==eid?`<span>主担当 ${esc(empName(t.owner))}</span>`:''}${nk?`<span>子タスク ${nk}件から計算</span>`:''}${par}</div>
      ${nk ? `<div class="tprog"><div class="pbar"><i style="width:${p}%"></i></div><span>${Math.round(p)}%</span></div>`
           : `<div class="tprog"><div class="pslide" data-act="noop"><div class="pbar"><i style="width:${p}%"></i></div><button class="pthumb" role="slider" data-id="${t.id}" style="left:${p}%" aria-label="「${esc(t.title)}」の進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}"></button></div><span class="pval">${Math.round(p)}%</span></div>`}
    </div>
    <div class="tact">
      ${!dn?`<button class="ib" data-act="task-pause" data-id="${t.id}" title="${t.status==='一時停止'?'再開する':'一時停止する'}" aria-label="${t.status==='一時停止'?'再開する':'一時停止する'}">${t.status==='一時停止'?ICON.play:ICON.pause}</button>`:''}
      ${nk&&!flat?`<button class="ib" data-act="task-expand" data-id="${t.id}" aria-label="${ui.expanded[t.id]?'子タスクを閉じる':'子タスクを開く'}" aria-expanded="${!!ui.expanded[t.id]}">${ui.expanded[t.id]?ICON.chevDs:ICON.chevRs}</button>`:''}
    </div></div>`;
}
