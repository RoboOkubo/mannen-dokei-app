// ===== 潮汐（調和分解による天文潮位の推算） =====
// 定数は気象庁の潮位表・分潮一覧表に基づく。h(t)=Z0+Σ f·H·cos(σ·t + u − g)
// g は epoch 2026-01-01 00:00 JST 基準。潮位は潮位表基準面上 cm。
const TIDE={
  cons:['M2','S2','N2','K2','K1','O1','P1','Sa','Ssa'],
  sig:{M2:28.9841042,S2:30.0,N2:28.4397295,K2:30.0821373,K1:15.0410686,
       O1:13.9430356,P1:14.9589314,Sa:0.0410686,Ssa:0.0821373},
  maxKm:150,   // 最寄り港がこれより遠い場合は自動選択せず、港を選んでもらう
  ports:{
    // z0 と各分潮は気象庁の潮位表・分潮一覧表に基づく。港を足すだけで最寄り自動選択の候補が増える
    TK:{name:'東京',lat:35.65,lng:139.77,z0:120.0,
      h:{M2:[47.74,69.68],S2:[23.60,172.10],N2:[7.10,68.81],K2:[6.50,327.36],
         K1:[25.12,163.85],O1:[19.68,91.35],P1:[8.26,182.41],Sa:[9.51,236.55],Ssa:[0.57,85.12]}},
    NG:{name:'名古屋',lat:35.08,lng:136.88,z0:140.0,
      h:{M2:[64.74,99.52],S2:[30.35,199.83],N2:[11.08,97.55],K2:[8.51,355.14],
         K1:[24.03,174.38],O1:[17.78,100.70],P1:[7.62,191.73],Sa:[14.73,225.51],Ssa:[1.47,186.52]}},
    OS:{name:'大阪',lat:34.65,lng:135.43,z0:95.0,
      h:{M2:[29.96,139.91],S2:[16.88,226.77],N2:[6.41,136.08],K2:[4.20,26.93],
         K1:[26.05,193.00],O1:[19.55,116.74],P1:[8.05,210.85],Sa:[15.15,230.84],Ssa:[1.08,174.39]}},
    KB:{name:'神戸',lat:34.68,lng:135.18,z0:95.0,
      h:{M2:[28.45,141.48],S2:[16.15,227.72],N2:[6.14,137.22],K2:[4.02,28.39],
         K1:[25.67,193.30],O1:[19.29,117.11],P1:[7.93,211.31],Sa:[15.87,231.53],Ssa:[1.50,184.44]}},
    MZ:{name:'舞鶴',lat:35.48,lng:135.38,z0:19.0,
      h:{M2:[6.20,355.83],S2:[2.26,88.61],N2:[1.62,345.17],K2:[0.64,239.33],
         K1:[5.35,331.40],O1:[5.46,249.96],P1:[1.79,350.52],Sa:[17.22,241.63],Ssa:[1.86,35.75]}},
    TY:{name:'富山',lat:36.77,lng:137.22,z0:22.0,
      h:{M2:[5.74,3.17],S2:[2.08,103.19],N2:[1.47,350.73],K2:[0.62,252.81],
         K1:[5.36,332.83],O1:[5.23,253.82],P1:[1.69,350.09],Sa:[15.90,244.22],Ssa:[1.90,32.77]}},
    AY:{name:'鮎川（石巻）',lat:38.30,lng:141.50,z0:88.0,
      h:{M2:[31.59,27.05],S2:[14.71,136.09],N2:[4.14,14.01],K2:[4.14,290.81],
         K1:[24.02,152.39],O1:[19.36,82.06],P1:[7.78,171.71],Sa:[8.29,247.80],Ssa:[2.59,68.46]}},
    B3:{name:'小樽',lat:43.20,lng:141.00,z0:16.0,
      h:{M2:[4.67,34.04],S2:[2.23,139.80],N2:[1.09,19.23],K2:[0.64,289.05],
         K1:[5.24,332.33],O1:[5.32,256.75],P1:[1.72,351.99],Sa:[8.78,233.63],Ssa:[1.55,27.58]}},
    // 分潮一覧表が公表されていないため主要4分潮のみ（年周期成分を含まず精度は劣る）
    QF:{name:'博多（福岡）',lat:33.62,lng:130.40,z0:110.0,rough:true,
      h:{M2:[50.25,213.46],S2:[23.99,311.75],K1:[14.85,260.87],O1:[14.03,187.82]}}
  }
};

// --- 節点補正（f, u）。18.6年周期なので日単位で十分（誤差 <0.01mm） ---
function _tideNodal(Ndeg){
  const N=Ndeg*Math.PI/180,cN=Math.cos(N),c2=Math.cos(2*N),c3=Math.cos(3*N),
        sN=Math.sin(N),s2=Math.sin(2*N),s3=Math.sin(3*N);
  const fM2=1.0004-0.0373*cN+0.0002*c2,uM2=-2.14*sN;
  return {M2:[fM2,uM2],N2:[fM2,uM2],S2:[1,0],
    K2:[1.0241+0.2863*cN+0.0083*c2-0.0015*c3,-17.74*sN+0.68*s2-0.04*s3],
    K1:[1.0060+0.1150*cN-0.0088*c2+0.0006*c3,-8.86*sN+0.68*s2-0.07*s3],
    O1:[1.0089+0.1871*cN-0.0147*c2+0.0014*c3,10.80*sN-1.34*s2+0.19*s3],
    P1:[1,0],Sa:[1,0],Ssa:[1,0]};
}

// --- 1日分の係数をあらかじめ畳んでおく（描画1回あたり数百回の評価を軽くする） ---
const _tideCache=new Map();
function _tideCtx(port,Y,M,D){
  const key=port+'|'+Y+'-'+M+'-'+D;
  let cx=_tideCache.get(key); if(cx)return cx;
  const p=TIDE.ports[port]; if(!p)return null;
  const base=(Date.UTC(Y,M-1,D)-Date.UTC(2026,0,1))/3600000;      // epochからの経過時間[h]
  const dj=(Date.UTC(Y,M-1,D)+12*3600000-9*3600000-Date.UTC(2000,0,1,12))/86400000;
  const nod=_tideNodal(((125.04452-1934.136261*(dj/36525))%360+360)%360);
  const R=Math.PI/180, terms=[];
  for(const c in p.h){const hp=p.h[c],nd=nod[c],s=TIDE.sig[c];
    terms.push([nd[0]*hp[0], s*R, (s*base+nd[1]-hp[1])*R]);}     // [振幅, 角速度, 位相]
  cx={z0:p.z0,terms};
  if(_tideCache.size>60)_tideCache.clear();
  _tideCache.set(key,cx);
  return cx;
}
function _tideAt(cx,Hh){let h=cx.z0;
  for(let i=0;i<cx.terms.length;i++){const t=cx.terms[i];h+=t[0]*Math.cos(t[1]*Hh+t[2]);}
  return h;}
function tideHeight(port,Y,M,D,Hh){const cx=_tideCtx(port,Y,M,D);return cx?_tideAt(cx,Hh):null;}

function _tideHaversine(a,b,c,d){const R=6371,r=Math.PI/180,dLa=(c-a)*r,dLo=(d-b)*r,
  x=Math.sin(dLa/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function _tideNearest(){
  const keys=Object.keys(TIDE.ports);
  if(typeof place==='undefined'||!place||place.lat==null||place.lng==null)return {port:keys[0],km:null,far:false};
  let best=keys[0],bd=1e9;
  for(const k of keys){const p=TIDE.ports[k],d=_tideHaversine(place.lat,place.lng,p.lat,p.lng);
    if(d<bd){bd=d;best=k;}}
  return {port:best,km:Math.round(bd),far:bd>TIDE.maxKm};
}
const _SHIONAME=[null,'大潮','大潮','大潮','中潮','中潮','中潮','小潮','小潮','小潮','長潮','若潮',
  '中潮','中潮','中潮','大潮','大潮','大潮','大潮','中潮','中潮','中潮','小潮','小潮','小潮','長潮','若潮',
  '中潮','中潮','中潮','大潮'];
function _tideExtremes(cx){
  const step=5/60,pts=[]; for(let t=-1;t<=25.0001;t+=step)pts.push([t,_tideAt(cx,t)]);
  const ex=[];
  for(let i=1;i<pts.length-1;i++){const a=pts[i-1][1],b=pts[i][1],c=pts[i+1][1],t=pts[i][0];
    if(t<0||t>=24)continue;
    if(b>=a&&b>=c&&(b>a||b>c))ex.push({t,h:b,type:'高'});
    else if(b<=a&&b<=c&&(b<a||b<c))ex.push({t,h:b,type:'低'});}
  return ex;
}
function renderTide(){
  const el=document.getElementById('tide'); if(!el||typeof sel==='undefined')return;
  if(document.body.dataset.view && document.body.dataset.view!=='koyomi')return;  // 暦ビュー以外では描かない
  let selPort=localStorage.getItem('koyomi-tide-port')||'auto';
  const near=_tideNearest();
  const auto=(selPort==='auto'||!TIDE.ports[selPort]);
  const port=auto?near.port:selPort;
  const Y=sel.Y,M=sel.M,D=sel.D;
  const cx=_tideCtx(port,Y,M,D); if(!cx)return;
  let shio=null; try{const l=lunarOf(Y,M,D,place.tz); if(l)shio=_SHIONAME[l.ld]; }catch(e){}
  const hrs=[0,3,6,9,12,15,18,21], ex=_tideExtremes(cx);
  const opts=['<option value="auto"'+(selPort==='auto'?' selected':'')+'>現在地から自動'
    +(auto?`（${TIDE.ports[near.port].name}）`:'')+'</option>']
    .concat(Object.keys(TIDE.ports).map(k=>`<option value="${k}"${selPort===k?' selected':''}>${TIDE.ports[k].name}</option>`)).join('');
  const hilo=ex.length?ex.map(e=>{const hh=Math.floor(e.t+1e-6),mm=Math.round((e.t-hh)*60);
      const t2=mm===60?[hh+1,0]:[hh,mm];
      return `<span class="${e.type==='高'?'th-hi':'th-lo'}"><b>${e.type==='高'?'満潮':'干潮'}</b> ${pad(t2[0])}:${pad(t2[1])} <span class="mono">${Math.round(e.h)}</span></span>`;
    }).join('') : '<span class="di-none">この日は明瞭な満干潮なし</span>';

  // ---- 折れ線グラフ：縦軸=潮位(cm)、横軸=時刻(時) ----
  const W=340,H=190,L=38,Rr=8,Tp=16,Bt=26;
  const px=t=>L+(t/24)*(W-L-Rr);
  const NS=96,cs=[]; let cmin=1e9,cmax=-1e9;
  for(let i=0;i<=NS;i++){const t=i*24/NS,v=_tideAt(cx,t);cs.push([t,v]);if(v<cmin)cmin=v;if(v>cmax)cmax=v;}
  ex.forEach(e=>{if(e.h<cmin)cmin=e.h;if(e.h>cmax)cmax=e.h;});
  const span=Math.max(20,cmax-cmin); let step=50; [10,20,25,50,100].some(s=>{if(span/s<=5){step=s;return true;}return false;});
  const yMin=Math.floor(cmin/step)*step,yMax=Math.ceil(cmax/step)*step;
  const py=v=>Tp+(yMax-v)/(yMax-yMin)*(H-Tp-Bt);
  let g='';
  for(let y=yMin;y<=yMax+0.5;y+=step){const Y2=py(y);
    g+=`<line class="tc-grid" x1="${L}" y1="${Y2.toFixed(1)}" x2="${W-Rr}" y2="${Y2.toFixed(1)}"/>`
      +`<text class="tc-lbl" x="${L-5}" y="${(Y2+3).toFixed(1)}" text-anchor="end">${y}</text>`;}
  for(let t=0;t<=24;t+=3){const X2=px(t);
    g+=`<line class="tc-grid" x1="${X2.toFixed(1)}" y1="${Tp}" x2="${X2.toFixed(1)}" y2="${H-Bt}"/>`;
    if(t%6===0)g+=`<text class="tc-lbl" x="${X2.toFixed(1)}" y="${H-Bt+13}" text-anchor="middle">${t}</text>`;}
  g+=`<line class="tc-axis" x1="${L}" y1="${Tp}" x2="${L}" y2="${H-Bt}"/>`
    +`<line class="tc-axis" x1="${L}" y1="${H-Bt}" x2="${W-Rr}" y2="${H-Bt}"/>`;
  const pts=cs.map(a=>`${px(a[0]).toFixed(1)},${py(a[1]).toFixed(1)}`).join(' ');
  let cv=`<polygon class="tc-fill" points="${px(0).toFixed(1)},${(H-Bt).toFixed(1)} ${pts} ${px(24).toFixed(1)},${(H-Bt).toFixed(1)}"/>`
    +`<polyline class="tc-curve" points="${pts}"/>`;
  hrs.concat([24]).forEach(hh=>{const v=_tideAt(cx,hh),X2=px(hh),Y2=py(v);
    cv+=`<circle class="tc-dot" cx="${X2.toFixed(1)}" cy="${Y2.toFixed(1)}" r="2.3"/>`
      +`<text class="tc-val" x="${X2.toFixed(1)}" y="${(Y2-6).toFixed(1)}">${Math.round(v)}</text>`;});
  ex.forEach(e=>{cv+=`<circle class="${e.type==='高'?'tc-hi':'tc-lo'}" cx="${px(e.t).toFixed(1)}" cy="${py(e.h).toFixed(1)}" r="3"/>`;});
  const units=`<text class="tc-unit" x="${L-5}" y="${Tp-5}" text-anchor="end">cm</text>`
    +`<text class="tc-unit" x="${W-Rr}" y="${H-4}" text-anchor="end">時</text>`;
  const chart=`<div class="tide-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="潮位の折れ線グラフ 縦軸は潮位cm 横軸は時刻">${g}${cv}${units}</svg></div>`;

  el.innerHTML=
    `<div class="tide-head"><span class="tide-title">🌊 潮汐</span>`
    +`<select class="tide-port" id="tide-port" aria-label="基準港">${opts}</select>`
    +(shio?`<span class="tide-shio">${shio}</span>`:'')+`</div>`
    +`<div class="tide-hilo">${hilo}</div>`
    +chart
    +`<div class="tide-note">${TIDE.ports[port].name}・気象庁潮位表基準面上の推算値（cm）。`
    +(auto&&near.km!=null?`現在地から約${near.km}km。`:'')
    +(auto&&near.far?`<br><b style="color:#e0a0a0">最寄りの港まで遠いため、潮位は参考値です。</b>近くの港を選んでください。`:'')
    +`<br>主要分潮による推算のため、潮位で数〜十数cm、満干潮の時刻で十数分〜約40分の差が出ることがあります。`
    +(TIDE.ports[port].rough?`<br><b style="color:#e0a0a0">この港は主要4分潮のみ（年周期成分なし）のため、季節により±15cm程度ずれます。</b>`:'')
    +`</div>`;
  const psel=document.getElementById('tide-port');
  if(psel)psel.onchange=()=>{ localStorage.setItem('koyomi-tide-port',psel.value); renderTide(); };
}
// 本体スクリプトより後に読み込まれるため、初回はここで描画する
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>renderTide());
else renderTide();
