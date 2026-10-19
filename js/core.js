'use strict';
const APP_VERSION = '1.1.0';
/* ===== 定数 ===== */
let DAY_MIN = 660;              // 1日の勤務時間（分）。設定タブの値で上書きする
let MONTHLY_COST = 300000;      // 月の人件費。設定タブの値で上書きする
const PREF_KEY = 'honbu-prefs-v1';
const FS = {s:0.9, m:1, l:1.18};
const DOW = ['日','月','火','水','木','金','土'];
const PRI_ORDER = {'高':0,'中':1,'低':2};
const PRI_CLS = {'高':'h','中':'m','低':'l'};
const STATUSES = ['未着手','進行中','一時停止','完了'];
const ST_CLS = {'未着手':'todo','進行中':'doing','一時停止':'pause','完了':'done'};

/* ===== 小道具 ===== */
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseYmd = s => { const a=s.split('-').map(Number); return new Date(a[0],a[1]-1,a[2]); };
const addDays = (s,n) => { const d=parseYmd(s); d.setDate(d.getDate()+n); return ymd(d); };
const ymOf = s => s.slice(0,7);
const addMonths = (m,n) => { const a=m.split('-').map(Number); const d=new Date(a[0],a[1]-1+n,1); return d.getFullYear()+'-'+pad(d.getMonth()+1); };
const dim = m => { const a=m.split('-').map(Number); return new Date(a[0],a[1],0).getDate(); };
// 朝8時で日付が切り替わる「業務日」
const bizToday = () => ymd(new Date(Date.now()-8*3600*1000));
const dowOf = s => parseYmd(s).getDay();
const fmtMD = s => { const d=parseYmd(s); return (d.getMonth()+1)+'/'+d.getDate()+'（'+DOW[d.getDay()]+'）'; };
const fmtYM = m => { const a=m.split('-').map(Number); return a[0]+'年'+a[1]+'月'; };
const fmtH = min => { const h=Math.round(min/6)/10; return (Number.isInteger(h)?h:h.toFixed(1))+'h'; };
const yen = n => '¥'+Math.round(n).toLocaleString('ja-JP');
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const clone = o => JSON.parse(JSON.stringify(o));
const $ = s => document.querySelector(s);

const I = (p,s) => `<svg width="${s||18}" height="${s||18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  grid: I('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  cal: I('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  sheet: I('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  sliders: I('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  check: I('<path d="M5 12l5 5L20 7"/>',14),
  chevL: I('<path d="M15 18l-6-6 6-6"/>'),
  chevR: I('<path d="M9 6l6 6-6 6"/>'),
  chevRs: I('<path d="M9 6l6 6-6 6"/>',16),
  chevDs: I('<path d="M6 9l6 6 6-6"/>',16),
  pause: I('<path d="M9 5v14M15 5v14"/>',15),
  play: I('<path d="M7 5l12 7-12 7z"/>',15),
  out: I('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>',16),
  plus: I('<path d="M12 5v14M5 12h14"/>',16),
  warn: I('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',16),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',16),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',11),
  rec: I('<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',11),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',16),
  menu: I('<path d="M4 6h16M4 12h16M4 18h16"/>',22),
  circ: I('<circle cx="12" cy="12" r="6.5"/>',14)
};

/* ===== 表示の設定（色・文字の大きさ） ===== */
let prefs = {theme:'system', fs:'m', navMini:false};
let tapN = 0, tapAt = 0;
try{ const p=JSON.parse(localStorage.getItem(PREF_KEY)||'null'); if(p){ if(['system','light','dark','ura'].includes(p.theme)) prefs.theme=p.theme; if(FS[p.fs]) prefs.fs=p.fs; prefs.navMini=!!p.navMini; } }catch(e){}
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : {matches:false};
let wantTheme = 'light';
function applyPrefs(){
  const root=document.documentElement;
  wantTheme = prefs.theme==='ura' ? 'ura' : ((prefs.theme==='dark' || (prefs.theme==='system' && mq.matches)) ? 'dark' : 'light');
  if(root.getAttribute('data-theme')!==wantTheme) root.setAttribute('data-theme', wantTheme);
  root.style.setProperty('--fs', String(FS[prefs.fs]));
  if(prefs.navMini) root.setAttribute('data-nav','mini'); else root.removeAttribute('data-nav');
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--surface').trim() || (wantTheme==='dark'?'#181c26':'#ffffff'));
}
function savePrefs(){ try{ localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }catch(e){} }
applyPrefs();
// 端末のダークモード設定が変わったら追従する
const onScheme = () => { if(prefs.theme==='system'){ applyPrefs(); if(ui && ui.modal && ui.modal.type==='settings') renderModal(); } };
if(mq.addEventListener) mq.addEventListener('change', onScheme); else if(mq.addListener) mq.addListener(onScheme);
// 外側から色の指定が上書きされても、選んだ設定に戻す
if(window.MutationObserver){ new MutationObserver(()=>{ if(document.documentElement.getAttribute('data-theme')!==wantTheme) document.documentElement.setAttribute('data-theme', wantTheme); }).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']}); }

/* ===== 画面の状態 ===== */
const T0 = bizToday();
const ui = {
  user:null, mustChange:false, booting:false, saving:false,
  view:'dash', dashDate:T0, dashMonth:ymOf(T0), empId:null, sub:'cal', calMode:'month', calMonth:ymOf(T0), selDate:T0,
  search:'', filter:'open', expanded:{}, attMonth:ymOf(T0), attScrolled:false,
  wc:null, entry:{kind:'basic',name:'',memo:'',min:60,taskId:''}, modal:null,
  repMonth:ymOf(T0), rep:{}, repBusy:false
};
/* ===== データ（GASから読み込んだもの） ===== */
function blankData(){ return {employees:[],workTypes:[],tasks:[],reports:{},attendance:{},closings:[],settings:{monthlyCost:300000,dayHours:11,dayStart:8},months:{},from:'',to:'',loadedAt:0}; }
let data = blankData();

/* ===== 参照 ===== */
const emp = id => data.employees.find(e=>e.id===id);
const empName = id => { const e=emp(id); return e?e.name:''; };
const me = () => emp(ui.user);
// 在籍している社員（表示順）
const staff = () => data.employees.filter(e=>e.active).sort((a,b)=>a.order-b.order);
const att = (e,d) => data.attendance[e+'|'+d] || '';
const rep = (e,d) => data.reports[e+'|'+d] || null;
const taskById = id => data.tasks.find(t=>t.id===id);
function calc(items){
  let plus=0, basicIn=0;
  items.forEach(i=>{ if(i.kind==='plus') plus+=i.min; else basicIn+=i.min; });
  const total=plus+basicIn;
  return {plus,basicIn,total,basic:Math.max(0,DAY_MIN-plus),other:Math.max(0,DAY_MIN-total),over:total>DAY_MIN};
}
// 11時間を超えた日は割合で11時間分に縮める
function scaled(c){ if(!c.over) return {plus:c.plus,basic:DAY_MIN-c.plus}; const p=c.plus*DAY_MIN/c.total; return {plus:p,basic:DAY_MIN-p}; }

const live = () => data.tasks.filter(t=>!t.deleted);
const kidsOf = id => live().filter(t=>t.parent===id);
function descIds(id){ const out=[]; data.tasks.filter(t=>t.parent===id).forEach(k=>{ out.push(k.id); out.push(...descIds(k.id)); }); return out; }
function prog(t){
  const k=kidsOf(t.id);
  if(k.length){ const w=k.reduce((s,x)=>s+(+x.weight||1),0); return k.reduce((s,x)=>s+(+x.weight||1)*prog(x),0)/w; }
  return t.status==='完了' ? 100 : (+t.progress||0);
}
const done = t => prog(t)>=100;
const overdue = t => !!t.due && t.due<bizToday() && !done(t);
function rootTasks(eid){ return live().filter(t=>{ if(t.owner!==eid) return false; if(!t.parent) return true; const p=taskById(t.parent); return !p || p.deleted || p.owner!==eid; }); }
function empProg(eid){
  const roots=rootTasks(eid); let w=0,s=0;
  roots.forEach(t=>{ const ww=+t.weight||1; w+=ww; s+=ww*prog(t); });
  return {pct:w?s/w:0, roots:roots.length, done:roots.filter(done).length, over:live().filter(t=>t.owner===eid && overdue(t) && !kidsOf(t.id).length).length};
}
const visibleTasks = eid => live().filter(t=>t.owner===eid || (t.co||[]).includes(eid));
function cmpTask(a,b){
  const da=done(a), db=done(b); if(da!==db) return da?1:-1;
  const p=PRI_ORDER[a.priority]-PRI_ORDER[b.priority]; if(p) return p;
  const x=a.due||'9999', y=b.due||'9999'; return x<y?-1:x>y?1:0;
}
function recLabel(r){ if(!r) return ''; if(r.type==='daily') return '毎日'; if(r.type==='weekly') return '毎週'+DOW[r.dow]; return '毎月'+r.dom+'日'; }

function monthStats(eid,m){
  const n=dim(m), today=bizToday(); let days=0, basicMin=0, plusMin=0; const byWork={}, byTask={};
  for(let i=1;i<=n;i++){
    const d=m+'-'+pad(i); if(d>today) break;
    if(att(eid,d)!=='in') continue;
    days++;
    const r=rep(eid,d); const items=(r && r.status==='submitted')?r.items:[];
    const c=calc(items); const f=c.over?DAY_MIN/c.total:1;
    items.forEach(x=>{ const k=x.kind+'|'+x.name; byWork[k]=(byWork[k]||0)+x.min*f; if(x.taskId) byTask[x.taskId]=(byTask[x.taskId]||0)+x.min*f; });
    if(c.other>0){ const k='basic|その他の基本業務'; byWork[k]=(byWork[k]||0)+c.other; }
    plusMin+=c.plus*f; basicMin+=DAY_MIN-c.plus*f;
  }
  return {days, rate: days?MONTHLY_COST/(days*DAY_MIN/60):0, basicMin, plusMin, byWork, byTask};
}

/* ===== 祝日（日本） ===== */
const holCache={};
function holidays(y){
  if(holCache[y]) return holCache[y];
  const h={}, add=(m,d,n)=>{ h[y+'-'+pad(m)+'-'+pad(d)]=n; };
  const nthMon=(m,n)=>{ const f=new Date(y,m-1,1).getDay(); return 1+((8-f)%7)+(n-1)*7; };
  const k=y-1980, q=Math.floor(k/4);
  add(1,1,'元日'); add(1,nthMon(1,2),'成人の日'); add(2,11,'建国記念の日'); add(2,23,'天皇誕生日');
  add(3,Math.floor(20.8431+0.242194*k-q),'春分の日'); add(4,29,'昭和の日'); add(5,3,'憲法記念日'); add(5,4,'みどりの日'); add(5,5,'こどもの日');
  add(7,nthMon(7,3),'海の日'); add(8,11,'山の日'); add(9,nthMon(9,3),'敬老の日'); add(9,Math.floor(23.2488+0.242194*k-q),'秋分の日');
  add(10,nthMon(10,2),'スポーツの日'); add(11,3,'文化の日'); add(11,23,'勤労感謝の日');
  Object.keys(h).forEach(d=>{ const mid=addDays(d,1); if(h[addDays(d,2)] && !h[mid] && dowOf(mid)!==0) h[mid]='国民の休日'; });
  Object.keys(h).sort().forEach(d=>{ if(dowOf(d)===0){ let x=addDays(d,1); while(h[x]) x=addDays(x,1); h[x]='振替休日'; } });
  return holCache[y]=h;
}
const holName = d => holidays(+d.slice(0,4))[d] || '';

/* ===== 共通の見た目 ===== */
function ring(pct,size,stroke){
  const r=(size-stroke)/2, c=2*Math.PI*r, off=c*(1-Math.min(100,pct)/100), h=size/2;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="進捗 ${Math.round(pct)}%"><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${pct>=100?'var(--good)':'var(--accent)'}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${h} ${h})"/><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" class="ring-t" style="font-size:${Math.round(size*0.27)}px">${Math.round(pct)}<tspan style="font-size:${Math.round(size*0.17)}px">%</tspan></text></svg>`;
}
function day11(items){
  const c=calc(items), tot=Math.max(DAY_MIN,c.total);
  return `<div class="day11 ${c.over?'over':''}" title="1日11時間の内訳"><i class="s-basic" style="width:${c.basicIn/tot*100}%"></i><i class="s-other" style="width:${c.other/tot*100}%"></i><i class="s-plus" style="width:${c.plus/tot*100}%"></i></div>
  <div class="d11-leg"><span><i class="sw" style="background:var(--basic)"></i>基本業務 <b>${fmtH(c.basic)}</b> <span class="muted">（入力 ${fmtH(c.basicIn)}・その他 ${fmtH(c.other)}）</span></span><span><i class="sw" style="background:var(--plus)"></i>＋α業務 <b>${fmtH(c.plus)}</b></span></div>`;
}
// 追加テーマのときはチェックマークの代わりに〇を使う
const CK = () => prefs.theme==='ura' ? '〇' : '✓';
const attChip = a => a==='in'?'<span class="chip good">'+CK()+' 出勤</span>':a==='off'?'<span class="chip bad">× 欠勤</span>':'<span class="chip">出勤 未登録</span>';
const attMark = a => a==='in'?'<b class="am in">✓</b>':a==='off'?'<b class="am off">×</b>':'';
function repDot(eid,d){
  const r=rep(eid,d), a=att(eid,d);
  if(r && r.status==='submitted') return '<i class="dot good" title="日報 提出済み"></i>';
  if(r && r.status==='draft') return '<i class="dot warn" title="日報 下書き"></i>';
  if(a==='in' && d<=bizToday()) return '<i class="dot bad" title="日報 未提出"></i>';
  return '';
}
function statusOf(t){ return done(t)?'完了':t.status; }

