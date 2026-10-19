'use strict';
/* ===== 出勤カレンダー ===== */
function renderAtt(){
  if(prefs.theme==='ura') return renderAttSplit();
  const m=ui.attMonth, n=dim(m), today=bizToday(), E=staff();
  let head='<th class="sticky">社員</th>';
  for(let i=1;i<=n;i++){ const d=m+'-'+pad(i), w=dowOf(d); head+=`<th class="${d===today?'today':''} ${w===0?'sun':w===6?'sat':''} ${holName(d)?'hol':''}" ${holName(d)?`title="${holName(d)}"`:''} ${d===today?'id="att-today"':''}><div style="color:${w===0?'var(--bad)':w===6?'var(--accent)':'inherit'}">${i}</div><div class="muted" style="font-size:calc(10px * var(--fs))">${DOW[w]}</div></th>`; }
  head+='<th>出勤日数</th>';
  const rows=E.map(e=>{
    let cnt=0, cells='';
    for(let i=1;i<=n;i++){
      const d=m+'-'+pad(i), a=att(e.id,d), r=rep(e.id,d);
      if(a==='in' && d<=today) cnt++;
      const warn = a==='in' && d<=today && !(r&&r.status==='submitted');
      cells+=`<td class="${d===today?'today':''} ${dowOf(d)===0?'sun':dowOf(d)===6?'sat':''} ${holName(d)?'hol':''}"><button class="ab ${a}" data-act="att-cycle" data-e="${e.id}" data-d="${d}" aria-label="${esc(e.name)} ${fmtMD(d)} ${a==='in'?'出勤':a==='off'?'欠勤':'未登録'}">${a==='in'?'✓':a==='off'?'×':''}${warn?'<i class="dot bad"></i>':''}</button></td>`;
    }
    return `<tr><td class="sticky">${esc(e.name)}<div class="muted" style="font-size:calc(10.5px * var(--fs));font-weight:400">${e.shift}</div></td>${cells}<td class="tot">${cnt}日</td></tr>`;
  }).join('');
  return `<div class="toolbar"><div class="date-ctl"><button class="ib bd" data-act="att-step" data-n="-1" aria-label="前の月">${ICON.chevL}</button><h2 style="font-size:calc(17px * var(--fs));min-width:120px;text-align:center">${fmtYM(m)}</h2><button class="ib bd" data-act="att-step" data-n="1" aria-label="次の月">${ICON.chevR}</button></div></div>
  <div class="banner info" style="margin-bottom:12px">${ICON.info}<div>マスを押すたびに「未登録 → ✓出勤 → ×欠勤」と切り替わります。日報を提出すると、その日は自動で✓になります。</div></div>
  <div class="card"><div class="att-wrap" id="att-wrap" data-drag-scroll><table class="att"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
  <div class="cal-leg" style="padding:10px 14px"><span><b class="am in">✓</b>出勤</span><span><b class="am off">×</b>欠勤</span><span><i class="dot bad"></i>出勤しているのに日報が未提出</span><span>出勤日数は時給の計算に使います（今日まで）</span></div></div>`;
}

// 追加テーマ用：名前の列を表の外に出して固定し、日付の部分だけを横に動かす
function renderAttSplit(){
  const m=ui.attMonth, n=dim(m), today=bizToday(), E=staff();
  let head='';
  for(let i=1;i<=n;i++){
    const d=m+'-'+pad(i), w=dowOf(d), hn=holName(d);
    head+=`<th class="${d===today?'today':''} ${w===0?'sun':w===6?'sat':''} ${hn?'hol':''}" ${hn?`title="${hn}"`:''} ${d===today?'id="att-today"':''}><div>${i}</div><div class="dw2">${DOW[w]}</div></th>`;
  }
  head+='<th class="totc">出勤日数</th>';
  let names='', rows='';
  E.forEach(e=>{
    let cnt=0, cells='';
    for(let i=1;i<=n;i++){
      const d=m+'-'+pad(i), a=att(e.id,d), r=rep(e.id,d), w=dowOf(d);
      if(a==='in' && d<=today) cnt++;
      const warn = a==='in' && d<=today && !(r&&r.status==='submitted');
      cells+=`<td class="${d===today?'today':''} ${w===0?'sun':w===6?'sat':''} ${holName(d)?'hol':''}"><button class="ab ${a}" data-act="att-cycle" data-e="${e.id}" data-d="${d}" aria-label="${esc(e.name)} ${fmtMD(d)} ${a==='in'?'出勤':a==='off'?'欠勤':'未登録'}">${a==='in'?'<span class="o-mark" aria-hidden="true"></span>':a==='off'?'×':''}${warn?'<i class="dot bad"></i>':''}</button></td>`;
    }
    names+=`<tr><td class="nmc">${esc(e.name)}<div class="sub">${e.shift}</div></td></tr>`;
    rows+=`<tr>${cells}<td class="tot">${cnt}日</td></tr>`;
  });
  return `<div class="toolbar"><div class="date-ctl"><button class="ib bd" data-act="att-step" data-n="-1" aria-label="前の月">${ICON.chevL}</button><h2 style="font-size:calc(17px * var(--fs));min-width:120px;text-align:center">${fmtYM(m)}</h2><button class="ib bd" data-act="att-step" data-n="1" aria-label="次の月">${ICON.chevR}</button></div></div>
  <div class="banner info" style="margin-bottom:12px">${ICON.info}<div>マスを押すたびに「未登録 → 〇出勤 → ×欠勤」と切り替わります。日報を提出すると、その日は自動で〇になります。</div></div>
  <div class="card"><div class="att-split"><table class="att att-names"><thead><tr><th class="nmc">社員</th></tr></thead><tbody>${names}</tbody></table><div class="att-wrap" id="att-wrap" data-drag-scroll><table class="att att-days"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="cal-leg" style="padding:10px 14px"><span><span class="o-mark sm"></span>出勤</span><span><b class="am off">×</b>欠勤</span><span><i class="dot bad"></i>出勤しているのに日報が未提出</span><span>出勤日数は時給の計算に使います（今日まで）</span></div></div>`;
}

