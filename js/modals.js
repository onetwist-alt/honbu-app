'use strict';
/* ===== タスクの小窓 ===== */
function openTask(id,preset){ ui.modal={id:id||null,preset:preset||{}}; renderModal(); setTimeout(()=>{ const i=document.getElementById('tf-title'); if(i && !id) i.focus(); },30); }
function closeModal(){ ui.modal=null; renderModal(); }
function renderModal(){
  const root=document.getElementById('modal-root');
  if(!ui.modal){ root.innerHTML=''; root.dataset.for=''; document.body.classList.remove('noscroll'); return; }
  if(ui.modal.type==='settings'){ root.dataset.for='settings'; root.innerHTML=settingsHtml(); document.body.classList.add('noscroll'); return; }
  if(ui.modal.type==='item'){ root.dataset.for='item'; root.innerHTML=itemHtml(); document.body.classList.add('noscroll'); return; }
  if(ui.modal.type==='bulk'){ if(root.firstChild && root.dataset.for==='bulk') return; root.dataset.for='bulk'; root.innerHTML=bulkHtml(); document.body.classList.add('noscroll'); setTimeout(()=>{ const x=document.getElementById('bk-text'); if(x) x.focus(); },30); return; }
  if(ui.modal.type==='pw'||ui.modal.type==='temp'||ui.modal.type==='empEdit'){
    if(root.firstChild && root.dataset.for===ui.modal.type) return;
    root.dataset.for=ui.modal.type; root.innerHTML=ui.modal.type==='pw'?pwModalHtml():ui.modal.type==='temp'?tempHtml():empEditHtml(); document.body.classList.add('noscroll'); return;
  }
  if(root.firstChild && root.dataset.for===String(ui.modal.id)+'|'+String(ui.modal.preset.parent||'')) return;
  const t=ui.modal.id?taskById(ui.modal.id):null, p=ui.modal.preset, today=bizToday();
  const v=t||{title:'',detail:'',owner:p.owner||ui.user,co:[],priority:'中',weight:1,progress:0,status:'未着手',start:today,due:'',parent:p.parent||null,rec:null,memo:''};
  const nk=t?kidsOf(t.id).length:0;
  const excl=new Set(t?[t.id].concat(descIds(t.id)):[]);
  const ro = !!t && !canEdit(t);
  const parents=live().filter(x=>!excl.has(x.id) && (canEdit(x) || x.id===v.parent)).sort(cmpTask);
  const rec=v.rec||{type:'weekly',dow:dowOf(today),dom:parseYmd(today).getDate()};
  ui.modal.pri=v.priority;
  root.dataset.for=String(ui.modal.id)+'|'+String(p.parent||'');
  root.innerHTML=`<div class="mb" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-title">
    <div class="m-h"><h3 id="m-title">${t?'タスクを編集':(v.parent?'子タスクを追加':'タスクを追加')}</h3><button class="ib" data-act="modal-close" aria-label="閉じる">${ICON.x}</button></div>
    <div class="m-b">${ro?`<div class="banner info full">${ICON.info}<div>${esc(empName(t.owner))}さんのタスクなので、見るだけです。直せるのは、担当者・共同担当・作った人・管理者です。</div></div>`:''}
      <label class="fl full">タスク名<input class="inp" id="tf-title" value="${esc(v.title)}" placeholder="例：今月分の会計締め"></label>
      <label class="fl full">詳細説明<textarea class="inp" id="tf-detail" rows="2">${esc(v.detail)}</textarea></label>
      <label class="fl">担当（主担当）<select class="inp" id="tf-owner">${staff().map(e=>`<option value="${e.id}" ${v.owner===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select></label>
      <label class="fl">ステータス<select class="inp" id="tf-status">${STATUSES.map(s=>`<option ${v.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
      <div class="fl full">共同担当<div class="cogrp">${staff().map(e=>`<label><input type="checkbox" class="tf-co" value="${e.id}" ${(v.co||[]).includes(e.id)?'checked':''}>${esc(e.name)}</label>`).join('')}</div></div>
      <div class="fl">優先度<div class="seg pri-seg" id="tf-pri">${['高','中','低'].map(x=>`<button type="button" class="${v.priority===x?'on':''}" data-act="tf-pri" data-v="${x}">${x}</button>`).join('')}</div></div>
      <label class="fl">比重（大きいほど進捗メーターへの影響が大きい）<select class="inp" id="tf-weight">${[1,2,3,4,5].map(n=>`<option ${+v.weight===n?'selected':''}>${n}</option>`).join('')}</select></label>
      <div class="fl full">進捗率 <output id="tf-prog-o">${Math.round(t?prog(t):v.progress)}%</output>${nk?`<div class="muted small" style="font-weight:400">子タスク ${nk}件の比重と進捗から自動で計算します</div>`:`<input type="range" id="tf-prog" min="0" max="100" step="10" value="${+v.progress||0}" aria-label="進捗率">`}</div>
      <label class="fl">開始日<input type="date" class="inp" id="tf-start" value="${v.start||''}"></label>
      <label class="fl">期限（任意）<input type="date" class="inp" id="tf-due" value="${v.due||''}"></label>
      <label class="fl full">親タスク<select class="inp" id="tf-parent"><option value="">なし（いちばん上のタスク）</option>${parents.map(x=>`<option value="${x.id}" ${v.parent===x.id?'selected':''}>${esc(x.title)}（${esc(empName(x.owner))}）</option>`).join('')}</select></label>
      <div class="fl full"><label style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="tf-rec-on" ${v.rec?'checked':''}>定期タスクにする</label>
        <div class="rec-row" id="tf-rec" ${v.rec?'':'hidden'}>
          <select class="inp" id="tf-rec-type" aria-label="繰り返し"><option value="daily" ${rec.type==='daily'?'selected':''}>毎日</option><option value="weekly" ${rec.type==='weekly'?'selected':''}>毎週</option><option value="monthly" ${rec.type==='monthly'?'selected':''}>毎月</option></select>
          <select class="inp" id="tf-rec-dow" aria-label="曜日" ${rec.type==='weekly'?'':'hidden'}>${DOW.map((w,i)=>`<option value="${i}" ${+rec.dow===i?'selected':''}>${w}曜日</option>`).join('')}</select>
          <select class="inp" id="tf-rec-dom" aria-label="日付" ${rec.type==='monthly'?'':'hidden'}>${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${+rec.dom===i+1?'selected':''}>${i+1}日</option>`).join('')}</select>
        </div>
        <div class="muted small" style="margin-top:4px;font-weight:400">決まった日の朝8時に、次の分を自動で作ります（試作では作られません）。</div></div>
      <label class="fl full">メモ<textarea class="inp" id="tf-memo" rows="2">${esc(v.memo)}</textarea></label>
    </div>
    <div class="m-f">${t&&!ro?`<button class="btn btn-danger" data-act="tf-delete">削除</button><button class="btn" data-act="tf-child">${ICON.plus}子タスクを追加</button><button class="btn" data-act="tf-bulk">${ICON.plus}まとめて追加</button>`:''}<span class="sp"></span>${ro?'<button class="btn btn-primary" data-act="modal-close">閉じる</button>':'<button class="btn" data-act="modal-close">キャンセル</button><button class="btn btn-primary" data-act="tf-save">保存</button>'}</div>
  </div></div>`;
  if(ro) root.querySelectorAll('.m-b input, .m-b select, .m-b textarea, .m-b .seg button').forEach(el=>{ el.disabled=true; });
  document.body.classList.add('noscroll');
}
function itemHtml(){
  const x=ui.modal.draft, myTasks=visibleTasks(ui.empId).filter(t=>!done(t)||t.id===x.taskId).sort(cmpTask);
  return `<div class="mb" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="it-title" style="max-width:480px">
    <div class="m-h"><h3 id="it-title">業務を直す</h3><button class="ib" data-act="modal-close" aria-label="閉じる">${ICON.x}</button></div>
    <div class="m-b single"><div class="rep-form" style="background:none;border:0;padding:0">
      <div class="seg" style="align-self:flex-start" role="group" aria-label="業務の区分"><button class="${x.kind==='basic'?'on':''}" data-act="it-kind" data-k="basic">基本業務</button><button class="${x.kind==='plus'?'on':''}" data-act="it-kind" data-k="plus">＋α業務</button></div>
      <label class="fl">業務名<input class="inp" id="it-name" data-field="it-name" value="${esc(x.name)}" autocomplete="off"></label>
      <div class="sugg" id="it-sugg">${suggList(x.kind,x.name,'it-sugg','保存')}</div>
      <label class="fl">詳細メモ（任意）<input class="inp" id="it-memo" data-field="it-memo" value="${esc(x.memo)}" placeholder="例：田中さん 10月分" autocomplete="off"></label>
      ${x.kind==='plus'?`<label class="fl">紐づけるタスク（任意）<select class="inp" data-field="it-task"><option value="">なし</option>${myTasks.map(t=>`<option value="${t.id}" ${x.taskId===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select></label>`:''}
      <div class="time-row"><span class="fl">所要時間</span><div class="stepper"><button data-act="it-min-step" data-n="-30" aria-label="30分へらす">−</button><output>${fmtH(x.min)}</output><button data-act="it-min-step" data-n="30" aria-label="30分ふやす">＋</button></div>${[60,120,180,240].map(v=>`<button class="qt ${x.min===v?'on':''}" data-act="it-min-set" data-m="${v}">${fmtH(v)}</button>`).join('')}</div>
    </div></div>
    <div class="m-f"><button class="btn btn-danger" data-act="it-del">この業務を消す</button><span class="sp"></span><button class="btn" data-act="modal-close">キャンセル</button><button class="btn btn-primary" data-act="it-save">直す</button></div>
  </div></div>`;
}
function settingsHtml(){
  const u=ui.user?me():null;
  const seg=(opts,cur,act,label)=>`<div class="seg wide" role="radiogroup" aria-label="${label}">${opts.map(([k,l])=>`<button role="radio" aria-checked="${cur===k}" class="${cur===k?'on':''}" data-act="${act}" data-v="${k}">${l}</button>`).join('')}</div>`;
  return `<div class="mb" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="set-title" style="max-width:480px">
    <div class="m-h"><h3 id="set-title">${ICON.gear}設定</h3><button class="ib" data-act="modal-close" aria-label="閉じる">${ICON.x}</button></div>
    <div class="m-b single">
      <div class="set-sec"><h4>アプリの色</h4><p>「端末に合わせる」にすると、スマホやPCのダークモードの設定に自動で合わせます。</p>
        ${seg([['system','端末に合わせる'],['light','ライト'],['dark','ダーク']],prefs.theme==='ura'?'light':prefs.theme,'set-theme','アプリの色')}
        ${prefs.theme==='system'?`<p style="margin:8px 0 0">いまの端末の設定：${mq.matches?'ダーク':'ライト'}</p>`:''}</div>
      <div class="set-sec"><h4>文字の大きさ</h4><p>3段階から選べます。この端末だけに反映されます。</p>
        ${seg([['s','小'],['m','標準'],['l','大']],prefs.fs,'set-fs','文字の大きさ')}
        <div class="fs-prev">見本：基本業務 データ取り 2h、＋α業務 会計 3h</div></div>
      <div class="set-sec"><h4>ホーム画面に追加</h4>${installHtml()}</div>
      <div class="set-sec"><h4>ログイン</h4>${u
        ? `<div class="acct"><span class="avatar">${esc(u.name.slice(0,1))}</span><div style="min-width:0"><div style="font-weight:700">${esc(u.name)} ${u.admin?'<span class="chip acc">管理者</span>':''}</div><div class="muted small">ID：${esc(u.loginId)}・30日間ログインしたままになります</div></div></div><button class="btn btn-block" data-act="logout">${ICON.out}ログアウト</button>`
        : `<p>ログインしていません。</p><button class="btn btn-primary btn-block" data-act="goto-login">ログイン画面へ</button>`}</div>
      ${u?`<div class="set-sec"><h4>パスワード</h4><button class="btn btn-block" data-act="pw-open">パスワードを変える</button></div>
      <div class="set-sec show-sm"><h4>月次レポート</h4><button class="btn btn-block" data-act="open-report">${ICON.chart}月次レポートを開く</button></div>
      <div class="set-sec show-sm"><h4>システム管理</h4><p>業務マスター${u.admin?'、社員、人件費の設定':''}はここから開きます。</p><button class="btn btn-block" data-act="open-admin">${ICON.sliders}システム管理を開く</button></div>`:''}
      <p class="muted small" style="margin:6px 0 0;text-align:center">本部アプリ v${APP_VERSION}</p>
    </div></div></div>`;
}

function modalFrame(id,title,body,foot,width){
  return `<div class="mb" data-act="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="${id}" style="max-width:${width||480}px">
    <div class="m-h"><h3 id="${id}">${title}</h3><button class="ib" data-act="modal-close" aria-label="閉じる">${ICON.x}</button></div>
    <div class="m-b single">${body}</div><div class="m-f"><span class="sp"></span>${foot}</div></div></div>`;
}
function pwModalHtml(){
  return modalFrame('pw-title','パスワードを変える',`<div style="display:grid;gap:12px">${pwForm(false)}</div>`,
    `<button class="btn" data-act="modal-close">キャンセル</button><button class="btn btn-primary" data-act="pw-save">変更する</button>`);
}
function tempHtml(){
  const m=ui.modal;
  return modalFrame('temp-title',esc(m.head),`<p style="margin:0 0 12px">${esc(m.emp.name)}さんに、次のログインIDと仮パスワードを伝えてください。最初のログインで、本人が新しいパスワードに変えます。</p>
    <div class="temp-box"><div><span class="muted small">ログインID</span><b>${esc(m.emp.loginId)}</b></div><div><span class="muted small">仮パスワード</span><b class="temp-pw">${esc(m.temp)}</b></div></div>
    <p class="muted small" style="margin:12px 0 0">この画面を閉じると、仮パスワードはもう表示できません。忘れたときは、もう一度リセットしてください。</p>`,
    `<button class="btn btn-primary" data-act="modal-close">メモしたので閉じる</button>`);
}
function empEditHtml(){
  const e=emp(ui.modal.id); if(!e) return '';
  return modalFrame('ee-head','社員の情報を直す',`<div style="display:grid;gap:12px">
    <label class="fl">氏名<input class="inp" id="ee-name" value="${esc(e.name)}" autocomplete="off"></label>
    <label class="fl">肩書き（任意）<input class="inp" id="ee-title" value="${esc(e.title||'')}" autocomplete="off"></label>
    <label class="fl">勤務<select class="inp" id="ee-shift"><option ${e.shift==='夜勤'?'selected':''}>夜勤</option><option ${e.shift==='日勤'?'selected':''}>日勤</option></select></label>
    <label class="check"><input type="checkbox" id="ee-admin" ${e.admin?'checked':''}> 管理者にする</label>
    <p class="muted small" style="margin:0">ログインID（${esc(e.loginId)}）は変えられません。</p></div>`,
    `<button class="btn" data-act="modal-close">キャンセル</button><button class="btn btn-primary" data-act="ee-save">保存</button>`);
}

function installHtml(){
  if (isStandalone()) return '<p style="margin:0">ホーム画面のアイコンから開いています。</p>';
  if (installEvt) return '<p>アイコンを押すと、アプリのように全画面で開けます。</p><button class="btn btn-primary btn-block" data-act="install">ホーム画面に追加する</button>';
  if (isIOS()) return `<p>iPhoneでは、<b>Safari</b>で開いているときに追加できます。</p>
    <ol class="steps"><li>画面下（iPadは右上）の共有ボタン（四角から上向きの矢印）を押す</li><li>メニューの中の「<b>ホーム画面に追加</b>」を押す</li><li>右上の「<b>追加</b>」を押す</li></ol>
    <p style="margin:8px 0 0">追加したアイコンから開くと、最初の1回だけもう一度ログインが必要です。</p>`;
  return `<p>ブラウザのメニュー（︙ や ≡）から「<b>ホーム画面に追加</b>」または「<b>アプリをインストール</b>」を選ぶと、アイコンから開けるようになります。</p>`;
}
