'use strict';
/* ===== 月次レポート ===== */
function renderReport(){
  const ym = ui.repMonth, r = ui.rep[ym], u = me();
  let status = '';
  if (r) {
    status = r.closed
      ? `<span class="chip good">確定済み（${esc(String(r.closedAt || '').slice(5, 16))}・${esc(r.closedBy || '')}）</span>`
      : `<span class="chip warn">${r.current ? '月の途中・暫定' : '暫定（まだ締めていません）'}</span>`;
    if (r.changedAfterClose) status += '<span class="chip bad">確定後に変更あり</span>';
    if (u.admin) {
      if (r.canClose) status += r.closed
        ? `<button class="btn btn-sm" data-act="rep-close" ${ui.repBusy ? 'disabled' : ''}>確定し直す</button>`
        : `<button class="btn btn-primary btn-sm" data-act="rep-close" ${ui.repBusy ? 'disabled' : ''}>この月を締める</button>`;
      else if (!r.closed) status += '<span class="muted small">月が終わると締められます</span>';
    }
  }
  const head = `<div class="toolbar"><div class="date-ctl"><button class="ib bd" data-act="rep-month" data-n="-1" aria-label="前の月">${ICON.chevL}</button><h2 style="font-size:calc(17px * var(--fs));min-width:120px;text-align:center">${fmtYM(ym)}</h2><button class="ib bd" data-act="rep-month" data-n="1" aria-label="次の月">${ICON.chevR}</button></div>${status}</div>`;
  if (!r) return head + `<div class="card empty" style="display:flex;align-items:center;justify-content:center;gap:10px"><span class="spin"></span>読み込み中…</div>`;
  const E = r.employees || [];
  const sum = k => E.reduce((s, e) => s + (e[k] || 0), 0);
  const note = r.closed
    ? (r.changedAfterClose ? '確定したあとに日報が直されています。最新の数字にするには、管理者が「確定し直す」を押してください。' : 'この月は確定済みです。確定したときの数字を表示しています。')
    : (r.current ? '月の途中なので、今日までの数字で計算した暫定の値です。' : 'まだ締めていない月です。今のデータで計算した値を表示しています。');
  let html = head + `<div class="banner ${r.changedAfterClose ? 'warn' : 'info'}" style="margin-bottom:14px">${ICON.info}<div>${note}</div></div>`;

  // 合計
  html += `<div class="stats">${stat('人件費の合計', yen(r.total || 0).replace('¥', ''), '円', `月額 ${yen(r.monthlyCost || 0)} × ${E.filter(e => e.days).length}人`)}${stat('基本業務', fmtH(sum('basicMin')).replace('h', ''), '時間', '')}${stat('＋α業務', fmtH(sum('plusMin')).replace('h', ''), '時間', '')}${stat('出勤（のべ）', sum('days'), '日', '')}</div>`;

  // 社員別
  const maxH = Math.max(1, ...E.map(e => e.basicMin + e.plusMin));
  html += `<div class="sec-h"><h2>社員別</h2></div><div class="card">
    <div class="tw" data-drag-scroll><table class="mt"><thead><tr><th>社員</th><th class="num">出勤日数</th><th class="num">時給</th><th class="num">人件費</th><th class="num">基本業務</th><th class="num">＋α業務</th></tr></thead><tbody>
    ${E.length ? E.map(e => `<tr><td><b>${esc(e.name)}</b></td><td class="num">${e.days}日</td><td class="num">${e.days ? yen(e.rate) : '—'}</td><td class="num">${yen(e.cost)}</td><td class="num">${fmtH(e.basicMin)}</td><td class="num">${fmtH(e.plusMin)}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">この月のデータはありません</td></tr>'}
    <tr class="total"><td>合計</td><td class="num">${sum('days')}日</td><td></td><td class="num">${yen(r.total || 0)}</td><td class="num">${fmtH(sum('basicMin'))}</td><td class="num">${fmtH(sum('plusMin'))}</td></tr></tbody></table></div>
    <div class="rp-chart"><div class="rp-leg"><span><i class="sw" style="background:var(--basic)"></i>基本業務</span><span><i class="sw" style="background:var(--plus)"></i>＋α業務</span></div>
    ${E.map(e => `<div class="hb-row"><span class="hb-l">${esc(e.name)}</span><div class="hb-track"><i style="width:${e.basicMin / maxH * 100}%;background:var(--basic)"></i><i style="width:${e.plusMin / maxH * 100}%;background:var(--plus)"></i></div><span class="hb-v">${fmtH(e.basicMin + e.plusMin)}</span></div>`).join('')}</div></div>`;

  // 業務別・タスク別
  const W = r.work || [], maxC = Math.max(1, ...W.map(w => w.cost));
  html += `<div class="sec-h"><h2>業務別の人件費</h2></div><div class="card"><div class="rp-chart">
    ${W.length ? W.map(w => `<div class="hb-row wide"><span class="hb-l"><span class="k ${w.kind}">${w.kind === 'plus' ? '＋α' : '基本'}</span> ${esc(w.name)}</span><div class="hb-track"><i style="width:${w.cost / maxC * 100}%;background:${w.kind === 'plus' ? 'var(--plus)' : 'var(--basic)'}"></i></div><span class="hb-v">${yen(w.cost)}<small>${fmtH(w.min)}</small></span></div>`).join('') : '<div class="empty">この月のデータはありません</div>'}</div></div>`;
  const K = r.task || [], maxK = Math.max(1, ...K.map(w => w.cost));
  html += `<div class="sec-h"><h2>タスク別の累計人件費</h2><span class="muted small">＋α業務をタスクに紐づけた分</span></div><div class="card"><div class="rp-chart">
    ${K.length ? K.map(w => `<div class="hb-row wide"><span class="hb-l">${esc(w.title)}</span><div class="hb-track"><i style="width:${w.cost / maxK * 100}%;background:var(--plus)"></i></div><span class="hb-v">${yen(w.cost)}<small>${fmtH(w.min)}</small></span></div>`).join('') : '<div class="empty">タスクに紐づいた＋α業務はありません</div>'}</div></div>`;

  // タスクの進み具合
  html += `<div class="sec-h"><h2>月間のタスク進捗</h2><span class="muted small">${r.closed ? '締めたときの進み具合' : '今の進み具合'}と、この月に完了したタスクの数</span></div><div class="card"><div class="rp-chart">
    ${E.length ? E.map(e => `<div class="hb-row wide"><span class="hb-l">${esc(e.name)}</span><div class="hb-track"><i style="width:${e.progress}%;background:var(--accent)"></i></div><span class="hb-v">${e.progress}%<small>完了 ${e.doneRoots}/${e.roots}・この月 ${e.doneInMonth}件</small></span></div>`).join('') : '<div class="empty">データはありません</div>'}</div></div>`;

  // 月ごとの推移
  const T = r.trend || [], maxT = Math.max(1, ...T.map(t => t.basicMin + t.plusMin));
  html += `<div class="sec-h"><h2>月ごとの推移</h2><span class="muted small">直近6か月の業務時間</span></div><div class="card"><div class="rp-chart">
    <div class="rp-leg"><span><i class="sw" style="background:var(--basic)"></i>基本業務</span><span><i class="sw" style="background:var(--plus)"></i>＋α業務</span></div>
    <div class="trend">${T.map(t => `<div class="tr-col ${t.ym === ym ? 'cur' : ''}"><span class="tr-v">${fmtH(t.basicMin + t.plusMin)}</span><div class="tr-bar"><i style="height:${t.plusMin / maxT * 100}%;background:var(--plus)"></i><i style="height:${t.basicMin / maxT * 100}%;background:var(--basic)"></i></div><span class="tr-l">${Number(t.ym.slice(5))}月${t.closed ? '<small>確定</small>' : ''}</span></div>`).join('')}</div></div></div>`;
  return html;
}
