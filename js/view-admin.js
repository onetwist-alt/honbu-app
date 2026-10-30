'use strict';
/* ===== システム管理 ===== */
function renderAdmin(){
  const u = me(), isA = u && u.admin;
  const list = k => data.workTypes.filter(w => w.kind === k).sort((a, b) => (Number(b.active) - Number(a.active)) || (b.uses - a.uses));
  const wtCol = k => `<div class="adm-col"><h3>${KFULL[k]}</h3><ul class="adm-list">${list(k).map(w => `<li class="${w.active ? '' : 'off'}"><span class="k ${k}">${KSHORT[k]}</span><span class="nm">${esc(w.name)}</span><span class="muted small">${w.uses}回</span><button class="btn btn-sm" data-act="wt-toggle" data-id="${w.id}">${w.active ? '候補から外す' : '候補に戻す'}</button></li>`).join('') || '<li class="muted small">まだありません</li>'}</ul></div>`;
  let html = `<div class="sec-h" style="margin-top:0"><h2>業務マスター</h2><span class="muted small">日報の業務名の候補です。よく使うものほど上に出ます。誰でも追加できます</span></div>
  <div class="card"><div class="tools"><select class="inp" id="wt-kind" style="flex:none;width:auto;min-width:120px" aria-label="区分"><option value="basic">基本業務</option><option value="plus">＋α業務</option><option value="recruit">採用業務</option></select><input class="inp" id="wt-name" placeholder="業務名を入力（例：データ取り）" autocomplete="off"><button class="btn btn-primary btn-sm" data-act="wt-add">${ICON.plus}追加</button></div>
    <div class="adm-cols three">${wtCol('basic')}${wtCol('plus')}${wtCol('recruit')}</div></div>`;
  if (!isA) return html + `<div class="banner info" style="margin-top:14px">${ICON.info}<div>社員の追加・退職、パスワードのリセット、人件費の設定は、管理者だけが使えます。</div></div>`;
  const emps = data.employees.slice().sort((a, b) => (Number(b.active) - Number(a.active)) || (a.order - b.order));
  html += `<div class="sec-h"><h2>社員</h2><span class="muted small">追加すると仮パスワードが出ます。本人に伝えてください</span></div>
  <div class="card"><div class="tw" data-drag-scroll><table class="mt"><thead><tr><th>氏名</th><th>ログインID</th><th>勤務</th><th>役割</th><th></th></tr></thead><tbody>
  ${emps.map(e => `<tr class="${e.active ? '' : 'retired'}"><td><b>${esc(e.name)}</b>${e.title ? ` <span class="muted small">${esc(e.title)}</span>` : ''}</td><td>${esc(e.loginId)}</td><td>${esc(e.shift)}</td><td>${e.admin ? '<span class="chip acc">管理者</span>' : ''}${e.active ? '' : '<span class="chip">退職</span>'}</td>
    <td class="adm-act">${e.active ? `<button class="btn btn-sm" data-act="emp-edit" data-id="${e.id}">編集</button><button class="btn btn-sm" data-act="emp-reset" data-id="${e.id}">パスワードをリセット</button>${e.id !== u.id ? `<button class="btn btn-sm btn-danger" data-act="emp-retire" data-id="${e.id}">退職</button>` : ''}` : ''}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="adm-add"><h3>社員を追加</h3><div class="adm-form">
    <label class="fl">氏名<input class="inp" id="ae-name" autocomplete="off" placeholder="例：田中"></label>
    <label class="fl">ログインID（半角英数字3〜20文字）<input class="inp" id="ae-login" autocomplete="off" autocapitalize="off" placeholder="例：tanaka"></label>
    <label class="fl">肩書き（任意）<input class="inp" id="ae-title" autocomplete="off"></label>
    <label class="fl">勤務<select class="inp" id="ae-shift"><option>夜勤</option><option>日勤</option></select></label>
    <label class="check" style="grid-column:1/-1"><input type="checkbox" id="ae-admin"> 管理者にする</label>
    <button class="btn btn-primary" data-act="emp-add" style="grid-column:1/-1">${ICON.plus}社員を追加</button></div></div></div>
  <div class="sec-h"><h2>人件費の設定</h2></div>
  <div class="card" style="padding:14px 16px"><div class="adm-form" style="align-items:end">
    <label class="fl">月の人件費（全員同じ金額・円）<input class="inp" id="cost-month" inputmode="numeric" value="${MONTHLY_COST}"></label>
    <button class="btn btn-primary" data-act="cost-save">保存</button></div>
    <p class="muted small" style="margin:10px 0 0">時給 ＝ 月の人件費 ÷（出勤した日数 × ${DAY_MIN / 60}時間）で計算します。</p></div>`;
  return html;
}
