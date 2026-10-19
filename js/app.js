'use strict';
/* ===== 起動 ===== */
(function boot(){
  if (session.token) { ui.user = '…'; startApp(); }
  else render();
  // ほかの人の変更を数分ごとに取り込む（入力中や小窓を開いているときは待つ）
  const canRefresh = () => {
    const a = document.activeElement;
    const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    return session.token && ui.user && !ui.mustChange && !ui.booting && !ui.modal && !drag && !ds && !typing && !wcDirty() && busyN === 0;
  };
  const min = Number((window.HONBU_CONFIG || {}).REFRESH_MINUTES) || 3;
  setInterval(() => { if (document.visibilityState === 'visible' && canRefresh()) refreshAll(true); }, min * 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && data.loadedAt && Date.now() - data.loadedAt > 60000 && canRefresh()) refreshAll(true);
  });
})();
