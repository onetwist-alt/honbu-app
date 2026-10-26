'use strict';
/* ===== ホーム画面に追加 ===== */
let installEvt = null;
const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (ui.modal && ui.modal.type === 'settings') renderModal(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('ホーム画面に追加しました'); if (ui.modal && ui.modal.type === 'settings') renderModal(); });
async function doInstall(){
  if (!installEvt) return;
  installEvt.prompt();
  try { await installEvt.userChoice; } catch (e) {}
  installEvt = null;
  if (ui.modal && ui.modal.type === 'settings') renderModal();
}
if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); }); }
/* ===== 起動 ===== */
(function boot(){
  if (session.token) { ui.user = '…'; startApp(); }
  else render();
  // ほかの人の変更を数分ごとに取り込む（入力中や小窓を開いているときは待つ）
  const canRefresh = () => {
    const a = document.activeElement;
    const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    return session.token && ui.user && !ui.mustChange && !ui.booting && !ui.modal && !drag && !ds && !typing && !wcDirty() && busyN === 0 && !attWaiting();
  };
  const min = Number((window.HONBU_CONFIG || {}).REFRESH_MINUTES) || 3;
  setInterval(() => { if (document.visibilityState === 'visible' && canRefresh()) refreshAll(true); }, min * 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && data.loadedAt && Date.now() - data.loadedAt > 60000 && canRefresh()) refreshAll(true);
  });
})();
