// ===== 北さがしコンパス（星時計・テスト機能） =====
// 夜空で北極星・北斗七星を探すためのリアルタイムコンパス。
// ・カメラアプリ式の「水平テープ」：端末を回すと方位が流れ、中央の印に「北」が来たら正面が北
// ・北を向くと、北極星の見上げ角（＝緯度）を「こぶし◯つ分」で案内
// ・磁北→真北の補正：国土地理院の近似式（西偏）
// ・iOS Safari は「タップして開始」で許可を取得。センサーが無ければ静かに案内のみ。
// 削除方法：このファイルと、index.html の <div id="starcompass"> と <script src="starcompass.js"> を消すだけ。
(function(){
  const mount=document.getElementById('starcompass');
  if(!mount)return;

  const css=document.createElement('style');
  css.textContent=`
  #starcompass{max-width:560px;margin:10px auto 4px}
  #starcompass::before{content:'▲';display:block;text-align:center;color:#e0483e;font-size:26px;line-height:1;margin-bottom:4px}   /* 端末の上端＝計測の基準方向 */
  .stc-box{border:1px solid var(--line,#2d3548);border-radius:12px;padding:10px 14px;background:rgba(255,255,255,.02)}
  .stc-row{display:flex;align-items:center;gap:12px}
  .stc-title{font-family:"Shippori Mincho",serif;font-weight:700;font-size:14px;color:#e0b84e;letter-spacing:.03em}
  .stc-sub{font-size:11.5px;color:#9aa3b4;line-height:1.6;margin-top:6px}
  .stc-deg{font-family:ui-monospace,monospace;color:#e2e7f3}
  .stc-btn{margin-left:auto;background:linear-gradient(90deg,rgba(224,184,78,.16),rgba(207,149,64,.16));
    border:1px solid #cf9540;color:#e3bd72;border-radius:9px;padding:7px 14px;font-size:13px;
    font-weight:700;cursor:pointer;font-family:"Shippori Mincho",serif;white-space:nowrap}
  .stc-tape{margin-top:9px}
  .stc-tape svg{width:100%;height:auto;display:block}
  #stc-clock{max-width:560px;margin:8px auto 4px}
  #stc-clock .stc-box{padding:12px 14px 16px}
  .stc-time{text-align:center;margin-top:6px;font-family:"Space Mono",ui-monospace,monospace;font-size:38px;font-weight:700;color:#e2e7f3;letter-spacing:.04em;line-height:1.2}
  .stc-time .s{font-size:24px;color:#c4cbd9;margin-left:2px}
  .stc-place{font-size:11.5px;color:#9aa3b4}
  .stc-on .stc-title{color:#8fbf7b}
  .stc-on .stc-box{border-color:rgba(143,191,123,.55);box-shadow:0 0 14px rgba(143,191,123,.10) inset}
  `;
  document.head.appendChild(css);

  // --- 方位の下の時計（地点のタイムゾーンで 時:分:秒 を毎秒表示） ---
  const clock=document.createElement('div');
  clock.id='stc-clock';
  clock.innerHTML=`<div class="stc-box"><div class="stc-row">
    <span class="stc-title">✦ 時計</span><span class="stc-place" id="stc-cplace"></span></div>
    <div class="stc-time" id="stc-ctime">--:--<span class="s">:--</span></div></div>`;
  mount.insertAdjacentElement('afterend',clock);
  function tickClock(){
    const panel=document.getElementById('panel-star');
    if(panel && panel.hidden)return;
    let tz=9,name='';
    try{ if(typeof place!=='undefined'&&place){ if(place.tz!=null)tz=place.tz; name=place.name||''; } }catch(e){}
    const d=new Date(Date.now()+tz*3600000), p2=n=>String(n).padStart(2,'0');
    document.getElementById('stc-ctime').innerHTML=`${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}<span class="s">:${p2(d.getUTCSeconds())}</span>`;
    document.getElementById('stc-cplace').textContent=name;
  }
  tickClock(); setInterval(tickClock,250);

  function latlng(){ let lat=35.7,lng=139.7;
    try{ if(typeof place!=='undefined'&&place&&place.lat!=null){lat=place.lat;lng=place.lng;} }catch(e){}
    return [lat,lng]; }
  function declination(){ const [lat,lng]=latlng();
    return 7.619 + 0.3125*(lat-37) - 0.1127*(lng-138); }   // 国土地理院近似式（西偏・度）
  // 度→「度・分・秒」表記（例 35°41′22″）
  function dms(v){ let t=Math.round(Math.abs(v)*3600)%1296000;   // 360°ちょうどは0°に
    const d=Math.floor(t/3600), m=Math.floor(t%3600/60), sec=t%60;
    return `${d}°${String(m).padStart(2,'0')}′${String(sec).padStart(2,'0')}″`; }
  function fistText(){ const [lat]=latlng();
    const f=Math.round(lat/10*2)/2;   // こぶし1つ≈10°
    const n=Number.isInteger(f)?String(f):String(Math.floor(f))+'つ半';
    return {alt:dms(lat), fists:Number.isInteger(f)?`${f}つ`:`${n}`}; }

  // --- 水平テープSVG。heading=端末正面の真方位（0=北,90=東） ---
  const W=520,H=64,CX=W/2;
  const PPD=3.4;                       // 1°あたりのピクセル
  const DIRS=[[0,'北',1],[45,'北東',0],[90,'東',1],[135,'南東',0],[180,'南',1],[225,'南西',0],[270,'西',1],[315,'北西',0]];
  function tapeSVG(heading,aligned){
    let g='';
    // 中央±80°ぶんの目盛りとラベルを描く
    for(let d=Math.ceil((heading-80)/5)*5; d<=heading+80; d+=5){
      const x=CX+(d-heading)*PPD, dd=((d%360)+360)%360;
      const major=dd%45===0, mid=dd%15===0;
      g+=`<line x1="${x.toFixed(1)}" y1="${major?22:mid?28:32}" x2="${x.toFixed(1)}" y2="38" stroke="${major?'#7d8aa8':'#46506a'}" stroke-width="${major?1.6:1}"/>`;
    }
    for(const [az,label,big] of DIRS){
      for(const wrap of [-360,0,360]){
        const x=CX+(az+wrap-heading)*PPD;
        if(x<-30||x>W+30)continue;
        const north=az===0, col=north?(aligned?'#8fbf7b':'#e0b84e'):big?'#e2e7f3':'#9aa3b4';
        g+=`<text x="${x.toFixed(1)}" y="16" fill="${col}" font-size="${big?15:12}" font-weight="700" text-anchor="middle" font-family="'Shippori Mincho',serif">${label}</text>`;
        if(north)g+=`<circle cx="${x.toFixed(1)}" cy="${aligned?46:44}" r="2.6" fill="${col}"/>`;   // 北の下に導きの点
      }
    }
    const mc=aligned?'#8fbf7b':'#e0b84e';
    return `<svg viewBox="0 0 ${W} ${H}">
      <rect x="0" y="0" width="${W}" height="${H}" rx="9" fill="#0a0f1a" stroke="#232b3d"/>
      <g clip-path="inset(0 round 9)">${g}</g>
      <path d="M ${CX-7} 54 L ${CX} 42 L ${CX+7} 54 Z" fill="${mc}"/>
      <line x1="${CX}" y1="8" x2="${CX}" y2="40" stroke="${mc}" stroke-width="1.6" stroke-opacity="0.85"/>
    </svg>`;
  }

  const hasSensor='DeviceOrientationEvent' in window;
  const needsPerm=hasSensor && typeof DeviceOrientationEvent.requestPermission==='function';
  let smoothing=null,lastPaint=0;

  function guidance(heading){
    const off=((heading+180)%360+360)%360-180;   // -180..180（0=北）
    const {alt,fists}=fistText();
    if(Math.abs(off)<=10)
      return {aligned:true, txt:`正面が北です。そのまま <b>約${alt}</b> 見上げると北極星 — 地平線からこぶし<b>${fists}</b>ぶん上。北斗七星はその周りを回っています。`};
    const side=off>0?'左':'右';
    return {aligned:false, txt:`${side}へ ${dms(off)} 回ると北を向きます。`};
  }

  function render(state,heading){
    if(state==='idle'){
      mount.innerHTML=`<div class="stc-box"><div class="stc-row">
        <span class="stc-title">✦ 方位</span>
        <button class="stc-btn" id="stc-start">${needsPerm?'タップして開始':'開始'}</button></div>
        <div class="stc-sub">端末を立てて構えると、方位が流れるコンパスが動きます。「北」が中央に来たら正面が北。真北基準（偏角 西${dms(declination())}補正）。開始時に位置情報の利用を求めます（場所に合わせて偏角を補正するため）。</div></div>`;
      const b=document.getElementById('stc-start'); if(b)b.onclick=start;
    } else if(state==='nosensor'){
      const {alt,fists}=fistText();
      mount.innerHTML=`<div class="stc-box"><div class="stc-row">
        <span class="stc-title">✦ 方位</span>
        <button class="stc-btn" id="stc-demo">デモを見る</button></div>
        <div class="stc-sub">この端末では方位センサーを利用できません（実機のHTTPS環境で動作します）。北を向いたら、地平線からこぶし${fists}ぶん（約${alt}）見上げた高さに北極星があります。</div></div>`;
      const b=document.getElementById('stc-demo'); if(b)b.onclick=demo;
    } else if(state==='denied'){
      mount.innerHTML=`<div class="stc-box"><div class="stc-row">
        <span class="stc-title">✦ 方位</span>
        <button class="stc-btn" id="stc-start">再試行</button></div>
        <div class="stc-sub">方位センサーの利用が許可されませんでした。ブラウザの設定から許可すると使えます。</div></div>`;
      const b=document.getElementById('stc-start'); if(b)b.onclick=start;
    } else {
      const gd=guidance(heading);
      mount.innerHTML=`<div class="${gd.aligned?'stc-on':''}"><div class="stc-box">
        <div class="stc-row"><span class="stc-title">${gd.aligned?'✓ 正面が北':'✦ 方位'}</span>
        <span class="stc-sub" style="margin:0 0 0 auto">向き <span class="stc-deg">${dms(((heading%360)+360)%360)}</span></span></div>
        <div class="stc-tape">${tapeSVG(heading,gd.aligned)}</div>
        <div class="stc-sub">${gd.txt}</div></div></div>`;
    }
  }

  // alpha/beta/gamma（Z-X'-Y''）から「正面」の方位を求める。360-alpha は端末を平らに置いた時しか正しくなく、
  // 立てて構えると左右の傾きや画面の縦横で大きく（90°以上）ずれるため、回転行列から直接計算する。
  // ・平らに近い時：画面の上端が向く方向　・立てた時：背面（カメラ）が向く方向　を傾きに応じて切り替える
  function headingFromEuler(a,b,g,scr){
    const R=Math.PI/180, cA=Math.cos(a*R),sA=Math.sin(a*R),cB=Math.cos(b*R),sB=Math.sin(b*R),cG=Math.cos(g*R),sG=Math.sin(g*R);
    const xE=cA*cG-sA*sB*sG, xN=sA*cG+cA*sB*sG;    // 端末x軸（右）の水平成分 [東,北]
    const yE=-sA*cB,          yN=cA*cB;              // 端末y軸（上端）
    const bE=-cA*sG-sA*sB*cG, bN=-sA*sG+cA*sB*cG;   // 背面（-z）
    const cS=Math.cos(scr*R), sS=Math.sin(scr*R);    // 画面の回転（横持ち）に合わせた「画面の上」
    const uE=cS*yE+sS*xE, uN=cS*yN+sS*xN;
    const w=Math.pow(cB*cG,4);                        // 画面の法線の鉛直成分^4：平ら≈1、立てる≈0（立てた時は背面方向だけを使う）
    const E=w*uE+bE, N=w*uN+bN;
    return ((Math.atan2(E,N)/R)%360+360)%360;
  }

  function onOrient(e){
    // 星時計パネルが隠れている間は描かない（電池と処理の節約）
    const panel=document.getElementById('panel-star');
    if(panel && panel.hidden)return;
    // 絶対方位のみ採用。相対値（起動時の向き基準）は北を指さないため、針を出さず正直に案内する
    let scr=0; try{scr=(screen.orientation&&screen.orientation.angle)||window.orientation||0;}catch(_){}
    let hMag=null;
    if(e.webkitCompassHeading!=null) hMag=e.webkitCompassHeading + scr;    // iOS：磁方位
    else if(e.absolute===true && e.alpha!=null) hMag=headingFromEuler(e.alpha,e.beta||0,e.gamma||0,scr);   // Android：絶対方位
    if(hMag==null){
      if(!onOrient._warned){ onOrient._warned=true; render('nosensor'); }
      return;
    }
    const hTrue=hMag - declination();
    // 円環スムージング（359↔0の跳ねを sin/cos 平均で回避）
    const r=hTrue*Math.PI/180;
    if(!smoothing)smoothing={s:Math.sin(r),c:Math.cos(r)};
    else{const a=0.25;smoothing.s+= a*(Math.sin(r)-smoothing.s);smoothing.c+=a*(Math.cos(r)-smoothing.c);}
    const h=((Math.atan2(smoothing.s,smoothing.c)*180/Math.PI)%360+360)%360;
    const now=Date.now(); if(now-lastPaint<90)return;
    lastPaint=now; render('run',h);
  }

  // デモ：東(96°)から北へゆっくり回り、北で数秒静止して案内を見せる → 待機に戻る
  let demoTimer=null;
  function demo(){
    if(demoTimer)clearInterval(demoTimer);
    let h=96; const t0=Date.now();
    demoTimer=setInterval(()=>{
      const panel=document.getElementById('panel-star');
      if(panel && panel.hidden){clearInterval(demoTimer);demoTimer=null;return;}
      if(h>0.5){ h=Math.max(0,h-1.6); render('run',h); }
      else { render('run',0);
        if(Date.now()-t0>10000){clearInterval(demoTimer);demoTimer=null;render('nosensor');} }
    },60);
  }

  function start(){
    if(!hasSensor){render('nosensor');return;}
    const go=()=>{
      if('ondeviceorientationabsolute' in window)
        window.addEventListener('deviceorientationabsolute',onOrient);
      else
        window.addEventListener('deviceorientation',onOrient);
      render('run',0);
    };
    if(needsPerm){
      DeviceOrientationEvent.requestPermission()
        .then(r=>{ if(r==='granted')go(); else render('denied'); })
        .catch(()=>render('denied'));
    } else go();
    askLocation();   // iOSの方位許可（requestPermission）を先に呼んでから、同じタップ内で位置情報の許可を求める
  }

  // 偏角（磁北→真北の補正）は場所で変わるため、開始時に位置情報の利用を求める。
  // ページ上部の「現在地」ボタンと同じ処理を使い、地点・地点名もそろえて更新する。
  function askLocation(){
    try{ if(typeof place!=='undefined'&&place&&place.geo)return; }catch(e){}   // 取得済みなら聞かない
    const g=document.getElementById('geo');
    if(g && navigator.geolocation) g.click();
  }

  render(hasSensor?'idle':'nosensor');
})();
