/* Ludo Duel: a fast 2-player variant. 3 tokens each, split-step dice, boost and shield tiles. */
const $=s=>document.querySelector(s);
const COL=['#1e90ff','#e8262a'];

/* ---------- track ---------- */
// 7 columns x 8 rows. A ring of 26 tiles runs round the edge; each player has a 2-tile home lane
// and a finish tile in the middle. Both players share the whole ring (the "Battle Corridor").
const RING=[];
for(let c=3;c>=0;c--)RING.push([7,c]);
for(let r=6;r>=1;r--)RING.push([r,0]);
for(let c=0;c<=6;c++)RING.push([0,c]);
for(let r=1;r<=7;r++)RING.push([r,6]);
for(let c=5;c>=4;c--)RING.push([7,c]);
const LANE=[[[6,3],[5,3]],[[1,3],[2,3]]],FIN=[[4,3],[3,3]];
const YARD=[[[5.5,1.5],[5.5,2.5],[6.5,2]],[[2.5,5.5],[2.5,4.5],[1.5,5]]];
const YR=[[5,1],[1,4]];
const ST=[1,14],SAFE=[1,7,14,20],BOOST=[4,10,17,23],SHIELD=[11,24];
const GOAL=28;                       // rel 0..25 ring, 26-27 lane, 28 finish
const own=n=>n<3?0:1;
const idxOf=(p,rel)=>(ST[p]+rel)%26;

/* ---------- engine (pure, testable) ---------- */
export const newState=()=>({t:Array(6).fill(-1),bn:Array(6).fill(0),sh:Array(6).fill(0),turn:0,roll:0,rc:0,v:0,st:'roll',msg:'',win:null,forf:null});
const clone=s=>({...s,t:s.t.slice(),bn:s.bn.slice(),sh:s.sh.slice()});
// a token that has a boost moves one step further on every move, when that still fits
export function eff(s,n,d){
  const t=s.t[n];if(t<0||t>=GOAL)return null;
  if(t+d+s.bn[n]<=GOAL)return d+s.bn[n];
  if(t+d<=GOAL)return d;
  return null;
}
export function options(s,d){
  const p=s.turn,mine=[0,1,2].map(i=>p*3+i);
  const act=mine.filter(n=>s.t[n]>=0&&s.t[n]<GOAL),base=mine.find(n=>s.t[n]<0),o=[];
  if(d==6&&base!=null)o.push({k:'spawn',n:base});
  act.forEach(n=>{if(eff(s,n,d)!=null)o.push({k:'move',m:[[n,d]]})});
  for(let i=0;i<act.length;i++)for(let j=i+1;j<act.length;j++)
    for(let x=1;x<d;x++)if(eff(s,act[i],x)!=null&&eff(s,act[j],d-x)!=null)o.push({k:'split',m:[[act[i],x],[act[j],d-x]]});
  return o;
}
function step1(s,n,d,ev){
  const p=own(n);
  s.t[n]+=eff(s,n,d);s.sh[n]=0;
  let t=s.t[n];
  if(t<=25&&BOOST.includes(idxOf(p,t))&&t+1<=GOAL){s.t[n]=++t;ev.push({boost:n})}
  if(t<=25){
    const a=idxOf(p,t);
    if(!SAFE.includes(a))for(let i=0;i<3;i++){
      const q=(1-p)*3+i,u=s.t[q];
      if(u>=0&&u<=25&&idxOf(1-p,u)==a&&!s.sh[q]){s.t[q]=-1;s.bn[q]=0;s.sh[q]=0;s.bn[n]=1;ev.push({cap:q})}
    }
    if(SHIELD.includes(a)){s.sh[n]=1;ev.push({shield:n})}
  }
}
const passTurn=s=>{s.turn=1-s.turn;[0,1,2].forEach(i=>s.sh[s.turn*3+i]=0);s.st='roll'};
export function play(s,o){
  const p=s.turn,ev=[];
  if(o.k=='spawn'){s.t[o.n]=0;s.sh[o.n]=0;s.bn[o.n]=0;ev.push({spawn:o.n})}
  else o.m.forEach(([n,d])=>step1(s,n,d,ev));
  if([0,1,2].every(i=>s.t[p*3+i]==GOAL)){s.st='done';s.win=p;return ev}
  if(s.roll==6)s.st='roll';else passTurn(s);
  return ev;
}
const danger=(s,p,t)=>{
  const a=idxOf(p,t);let d=0;
  for(let i=0;i<3;i++){const u=s.t[(1-p)*3+i];if(u>=0&&u<=25){const dist=(a-idxOf(1-p,u)+26)%26;if(dist>=1&&dist<=6)d++}}
  return d;
};
function evalFor(s,p){
  let v=0;
  for(let i=0;i<3;i++){
    const n=p*3+i,t=s.t[n];
    if(t>=0){
      v+=t*1.6+8;if(t==GOAL)v+=40;
      else if(t<=25&&!SAFE.includes(idxOf(p,t))&&!s.sh[n])v-=danger(s,p,t)*(14+t*.7);
      v+=s.bn[n]*5;
    }
    const u=s.t[(1-p)*3+i];if(u>=0)v-=u*1.2+6;if(u==GOAL)v-=40;
  }
  return v;
}
export function botPick(s){
  const p=s.turn,o=options(s,s.roll);let best=o[0],bs=-1e9;
  o.forEach(x=>{const c=clone(s);play(c,x);const sc=evalFor(c,p)+Math.random()*4+(x.k=='spawn'?6:0);if(sc>bs){bs=sc;best=x}});
  return best;
}
export const nextRoll=(s,r)=>{ // used by the UI and tests
  s.roll=r;s.rc++;s.msg='';
  const o=options(s,r);
  if(!o.length){passTurn(s);return o}
  s.st='move';return o;
};

/* ---------- UI ---------- */
let E=null,D=null;
const PIN='<svg viewBox="0 0 40 58" aria-hidden="true"><defs><linearGradient id="dpb" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#e9ecf5"/><stop offset="1" stop-color="#aab2c8"/></linearGradient><radialGradient id="dph" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient></defs><ellipse cx="20" cy="52" rx="12" ry="4.5" fill="#0006"/><ellipse cx="20" cy="50" rx="13" ry="5.5" fill="none" style="stroke:color-mix(in srgb,var(--c) 55%,#000)" stroke-width="3.5"/><path d="M20 54C20 54 3 34 3 20a17 17 0 0 1 34 0c0 14-17 34-17 34z" fill="url(#dpb)" stroke="#7d86a0" stroke-width="1.5"/><circle cx="20" cy="20" r="11" style="fill:var(--c)" stroke="#0005" stroke-width="1"/><circle cx="20" cy="20" r="11" fill="url(#dph)"/><ellipse cx="16" cy="14.5" rx="4.2" ry="2.4" fill="#fff" opacity=".7"/></svg>';
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]},ROT={1:[0,0],6:[0,180],2:[0,-90],5:[0,90],3:[-90,0],4:[90,0]};
const FLAGS=['🇮🇳','🇺🇸','🇬🇧','🇧🇷','🇯🇵','🇩🇪','🇫🇷','🇿🇦','🇦🇺','🇨🇦'];
const myFlag=()=>{
  try{const m=(navigator.language||'').match(/-([A-Za-z]{2})$/);
    if(m)return[...m[1].toUpperCase()].map(c=>String.fromCodePoint(127397+c.charCodeAt(0))).join('')}catch{}
  return'🌍';
};
const getCoins=()=>{try{return+localStorage.getItem('dl_coins')||1000}catch{return 1000}};
const setCoins=v=>{try{localStorage.setItem('dl_coins',String(v))}catch{}};
const nm=p=>D.names[p];
const canAct=()=>D&&!D.anim&&!D.rolling&&D.s.st!='done'&&(D.mode=='pass'||D.s.turn==0);

export const active=()=>!!D;
export const over=()=>!D||D.s.st=='done';
export function stop(){
  if(!D)return;
  clearTimeout(D.bt);clearTimeout(D.tm);clearInterval(D.ti);
  D.els.forEach(e=>clearTimeout(e._t));
  D=null;
}
export function start(env){
  stop();E=env;
  const bot=env.mode=='bot',AV=env.AVS,mine=env.myAv();
  const other=AV.filter(a=>a!=mine)[Math.floor(Math.random()*(AV.length-1))];
  const nick=(env.myName&&env.myName())||'';
  D={s:newState(),mode:bot?'bot':'pass',names:bot?[nick||'You','Computer']:[nick||'Player 1','Player 2'],
     avs:[mine,bot?other:AV.filter(a=>a!=mine)[3]],flags:[myFlag(),FLAGS[Math.floor(Math.random()*FLAGS.length)]],
     coins:[getCoins(),bot?500+Math.floor(Math.random()*4500):1000],
     vis:Array(6).fill(-1),els:[],cards:[],cubes:[],btn:[],anim:0,rolling:0,idle:[0,0],split:{on:false,pick:[]},won:0};
  env.show('duel');env.sfx.start();
  $('#dmute').textContent=env.muted()?'🔇':'🔊';
  buildCards();buildBoard();refresh();
}

function buildCards(){
  const mk=p=>{
    const d=document.createElement('div');d.className='pc dcard'+(p==1?' r':'');d.style.setProperty('--c',COL[p]);
    d.innerHTML='<div class="av"></div><div class="pn"><b></b><small></small></div><div class="dbox"><button class="dice" disabled aria-label="Roll the dice"><div class="cube"></div></button></div>';
    d.querySelector('.av').textContent=D.avs[p];
    d.querySelector('b').textContent=D.flags[p]+' '+D.names[p];
    const cube=d.querySelector('.cube');
    [1,2,3,4,5,6].forEach(v=>{
      const f=document.createElement('div');f.className='face f'+v;
      for(let i=0;i<9;i++){const s=document.createElement('span');if(PIPS[v].includes(i))s.className=v==1?'pip r':'pip';f.append(s)}
      cube.append(f);
    });
    const btn=d.querySelector('.dice');
    btn.onclick=()=>{if(D&&D.s.st=='roll'&&canAct()&&D.s.turn==p){human();rollAnim()}};
    D.cards[p]=d;D.cubes[p]=cube;D.btn[p]=btn;return d;
  };
  $('#dtop').replaceChildren(mk(1));
  $('#dbot').replaceChildren(mk(0));
}
function face(p,v){
  const cu=D.cubes[p];cu._s=(cu._s||0)+1;
  const[a,b]=ROT[v];cu.style.transform=`rotateX(${a+720*cu._s}deg) rotateY(${b+720*cu._s}deg)`;
}

function buildBoard(){
  const b=$('#dboard');b.innerHTML='';
  const tile=(r,c,cls,txt,bg)=>{const d=document.createElement('i');d.className='dt '+cls;d.style.gridArea=`${r+1} / ${c+1}`;if(txt)d.textContent=txt;if(bg)d.style.background=bg;b.append(d);return d};
  RING.forEach(([r,c],i)=>{
    let cls='ring',txt='';
    if(SAFE.includes(i)){cls+=' safe';txt='★'}
    if(BOOST.includes(i)){cls+=' boost';txt='⚡'}
    if(SHIELD.includes(i)){cls+=' shield';txt='🛑'}
    const sp=ST.indexOf(i);
    const d=tile(r,c,cls+(sp>=0?' start':''),txt,sp>=0?COL[sp]:'');
    if(i==0||i==13)d.classList.add('mouth');
  });
  FIN.forEach(([r,c],p)=>tile(r,c,'fin','🏁',COL[p]));
  LANE.forEach((l,p)=>l.forEach(([r,c])=>{const d=tile(r,c,'lane arrow','',COL[p]);d.textContent=p?'▼':'▲'}));
  YR.forEach(([r,c],p)=>{
    const y=document.createElement('div');y.className='dyard';y.style.gridArea=`${r+1} / ${c+1} / span 2 / span 2`;
    const sl=YARD[p].map(([a,z])=>[(z-c)/2*100,(a-r)/2*100]);
    y.style.background=sl.map(([x,yy])=>`radial-gradient(circle at ${x}% ${yy}%,#0006 0 13%,#fff6 14% 17%,#0000 18%)`).join(',')+`,color-mix(in srgb,${COL[p]} 45%,#0b1d4d)`;
    y.style.borderColor=COL[p];b.append(y);
  });
  [['⚔','BATTLE','1','1'],['🛡','ARENA','5','4'],['','BATTLE','3','1'],['','CORRIDOR','3','4']].forEach(([ic,tx,r,c],k)=>{
    const m=document.createElement('div');m.className='ddeco'+(k<2?' big':'');
    m.style.gridArea=`${+r+(k<2?0:1)} / ${+c+1} / span ${k<2?2:2} / span 2`;
    if(k<2)m.style.gridArea=`${+r+1} / ${+c+1} / span 2 / span 2`;
    m.innerHTML=k<2?'<b>'+ic+'</b>':'<small>'+tx+'</small>';
    if(k>=2)m.style.gridArea=`${4} / ${c==1?2:5} / span 2 / span 2`;
    b.append(m);
  });
  D.els=D.s.t.map((_,n)=>{
    const e=document.createElement('button');e.className='dtok';e.style.setProperty('--c',COL[own(n)]);
    e.setAttribute('aria-label',nm(own(n))+' token '+(n%3+1));
    e.innerHTML=PIN+'<i>'+(n%3+1)+'</i>';
    e.onclick=()=>tap(n);b.append(e);return e;
  });
  layout();
}
const posOf=(p,rel,i)=>{
  if(rel<0)return YARD[p][i];
  const[r,c]=rel<=25?RING[idxOf(p,rel)]:rel<=27?LANE[p][rel-26]:FIN[p];
  return[r+.5,c+.5];
};
function layout(){
  if(!D)return;
  const grp={};
  D.vis.forEach((rel,n)=>{const[r,c]=posOf(own(n),rel,n%3);(grp[r+','+c]||(grp[r+','+c]=[])).push({n,r,c})});
  Object.values(grp).forEach(a=>a.forEach((o,i)=>{
    const e=D.els[o.n],off=a.length>1?(i-(a.length-1)/2)*.36:0;
    e.style.left=(o.c+off)/7*100+'%';e.style.top=o.r/8*100+'%';
    e.style.setProperty('--s',a.length>1?.82:1);
    e.style.zIndex=1+Math.round(o.r);
  }));
}
function startAnim(n,target){
  const e=D.els[n],my=D;clearTimeout(e._t);
  if(!e._a){e._a=1;D.anim++}
  e._g=target;
  const stp=()=>{
    if(D!==my)return;
    const v=D.vis[n];
    if(v===target){e._a=0;if(--D.anim<=0){D.anim=0;ui()}return}
    D.vis[n]=(target<0||v<0||target<v)?target:v+1;
    layout();
    if(target<0)E.sfx.cap();else{E.sfx.step();e.classList.remove('hop');void e.offsetWidth;e.classList.add('hop')}
    e._t=setTimeout(stp,D.vis[n]===target?240:170);
  };
  stp();
}
function refresh(){
  if(!D)return;
  const s=D.s;let maxSteps=0;
  s.t.forEach((tg,n)=>{if(D.vis[n]!==tg&&tg>=0)maxSteps=Math.max(maxSteps,D.vis[n]<0?1:Math.max(1,tg-D.vis[n]))});
  s.t.forEach((tg,n)=>{
    const e=D.els[n];
    if(D.vis[n]===tg||e._g===tg)return;
    if(tg<0&&D.vis[n]>=0&&maxSteps>0){
      const my=D;e._g=tg;if(!e._a){e._a=1;D.anim++}
      clearTimeout(e._t);e._t=setTimeout(()=>{if(D===my)startAnim(n,tg)},maxSteps*170);
    }else startAnim(n,tg);
  });
  layout();ui();
}
const human=()=>{if(D)D.idle[D.s.turn]=0};

/* ---------- choosing a move ---------- */
const eligible=o=>{
  const pk=D.split.pick,set=new Set();
  o.filter(x=>x.k=='split').forEach(x=>{
    const a=x.m[0][0],b=x.m[1][0];
    if(!pk.length){set.add(a);set.add(b)}
    else if(pk.length==1){if(a==pk[0]||b==pk[0]){set.add(a);set.add(b)}}
    else if(pk.includes(a)&&pk.includes(b)){set.add(a);set.add(b)}
  });
  return[...set];
};
function tap(n){
  if(!D||!canAct()||D.s.st!='move'||own(n)!=D.s.turn)return;
  const s=D.s,o=options(s,s.roll);
  if(D.split.on){
    if(!eligible(o).includes(n))return;
    const pk=D.split.pick,i=pk.indexOf(n);
    if(i>=0)pk.splice(i,1);else if(pk.length<2)pk.push(n);
    return ui();
  }
  const one=s.t[n]<0?o.find(x=>x.k=='spawn'):o.find(x=>x.k=='move'&&x.m[0][0]==n);
  if(one){human();applyOpt(one)}
}
function mark(){
  D.els.forEach(e=>e.classList.remove('go','hop','pk'));
  D.els.forEach((e,n)=>{e.classList.toggle('sh',!!D.s.sh[n]);e.classList.toggle('bn',!!D.s.bn[n])});
  const s=D.s;
  if(s.st!='move'||!canAct())return;
  const o=options(s,s.roll);
  if(D.split.on){eligible(o).forEach(n=>D.els[n].classList.add('go'));D.split.pick.forEach(n=>D.els[n].classList.add('pk'))}
  else{
    o.forEach(x=>{if(x.k=='move')D.els[x.m[0][0]].classList.add('go');if(x.k=='spawn')[0,1,2].map(i=>s.turn*3+i).filter(n=>s.t[n]<0).forEach(n=>D.els[n].classList.add('go'))});
  }
}
function panel(){
  const s=D.s,msg=$('#dmsg'),act=$('#dact');act.innerHTML='';
  const btn=(t,f,p)=>{const b=document.createElement('button');b.className='btn'+(p?' p':'');b.textContent=t;b.onclick=f;act.append(b);return b};
  if(s.st=='done'){msg.textContent=nm(s.win)+' wins! 🏆';return}
  if(s.st=='roll'){msg.textContent=(s.msg?s.msg+' · ':'')+nm(s.turn)+(canAct()||D.mode=='pass'?"'s turn: roll the dice":"'s turn");return}
  if(!canAct()){msg.textContent=nm(s.turn)+' rolled '+s.roll+'…';return}
  const o=options(s,s.roll),sp=o.filter(x=>x.k=='split');
  if(!D.split.on){
    msg.textContent=nm(s.turn)+' rolled '+s.roll+': tap a token'+(sp.length?' or split the steps':'');
    if(sp.length)btn('✂ Split steps',()=>{
      const pairs=new Set(sp.map(x=>x.m[0][0]+','+x.m[1][0]));
      D.split={on:true,pick:pairs.size==1?sp[0].m.map(m=>m[0]):[]};ui();
    });
  }else{
    const pk=D.split.pick;
    if(pk.length<2){msg.textContent='Split '+s.roll+': tap '+(pk.length?'the second token':'two tokens');}
    else{
      msg.textContent='Split '+s.roll+' steps between #'+(pk[0]%3+1)+' and #'+(pk[1]%3+1);
      sp.filter(x=>pk.includes(x.m[0][0])&&pk.includes(x.m[1][0])).forEach(x=>{
        const m=x.m;btn('#'+(m[0][0]%3+1)+' +'+m[0][1]+'  ·  #'+(m[1][0]%3+1)+' +'+m[1][1],()=>{human();applyOpt(x)},true);
      });
    }
    btn('Cancel',()=>{D.split={on:false,pick:[]};ui()});
  }
}
function applyOpt(o){
  const s=D.s,p=s.turn,r=s.roll,ev=play(s,o);
  const caps=ev.filter(e=>e.cap!=null).length,bo=ev.some(e=>e.boost!=null),sh=ev.some(e=>e.shield!=null),m=[];
  if(o.k=='spawn')m.push('entered a token');
  if(bo){m.push('⚡ boost +1');E.tone(880,0,.12,'square',.1);E.tone(1320,.09,.16,'square',.1)}
  if(sh){m.push('🛑 shield up');E.tone(330,0,.18,'triangle',.18);E.tone(495,.12,.22,'triangle',.18)}
  if(caps)m.push('captured '+(caps>1?caps+' tokens':'a token')+' and gets +1 boost');
  if(s.st!='done'&&r==6)m.push('bonus roll');
  s.msg=m.length?nm(p)+' '+m.join(', '):'';
  s.v++;D.split={on:false,pick:[]};
  refresh();
}

/* ---------- dice, bots, timer ---------- */
function rollAnim(){
  if(!D||D.rolling||D.s.st!='roll')return;
  clearTimer();D.rolling=1;D.split={on:false,pick:[]};
  const r=1+Math.random()*6|0,p=D.s.turn,my=D;
  face(p,r);E.sfx.dice();ui();
  setTimeout(()=>{if(D!==my)return;D.rolling=0;doRoll(r)},1200);
}
function doRoll(r){
  const s=D.s,k=s.turn,o=nextRoll(s,r);
  if(!o.length)s.msg=nm(k)+' rolled '+r+': no move';
  else if(o.length==1){s.msg='';return applyOpt(o[0])}
  else if(D.auto){D.auto=0;return applyOpt(botPick(s))}
  s.v++;refresh();
}
function botCheck(){
  if(!D)return;clearTimeout(D.bt);
  const s=D.s;
  if(s.st=='done'||D.mode!='bot'||s.turn!=1)return;
  const my=D;
  D.bt=setTimeout(()=>{
    if(D!==my)return;
    if(D.anim>0||D.rolling)return botCheck();
    if(s.st=='roll')return rollAnim();
    if(s.st=='move')applyOpt(botPick(s));
  },800);
}
const TURN_MS=10000;
function clearTimer(){
  if(!D)return;
  clearTimeout(D.tm);clearInterval(D.ti);D.tkey=null;
  D.cards.forEach(c=>c&&delete c.dataset.t);
}
function armTimer(){
  const s=D.s;
  if(s.st=='done'||D.anim||D.rolling||(D.mode=='bot'&&s.turn==1)){clearTimer();return}
  const key=s.rc+':'+s.turn+':'+s.st+':'+s.v+':'+(D.split.on?D.split.pick.length+'s':'');
  if(D.tkey===key)return;
  clearTimer();D.tkey=key;
  const t0=Date.now(),my=D;
  const tick=()=>{if(D!==my)return;const rem=Math.max(0,Math.ceil((TURN_MS-(Date.now()-t0))/1000));
    D.cards.forEach((c,p)=>{if(p==D.s.turn&&D.s.st!='done')c.dataset.t=rem;else delete c.dataset.t})};
  D.ti=setInterval(tick,250);tick();
  D.tm=setTimeout(()=>{if(D===my&&D.tkey===key)autoPlay()},TURN_MS);
}
function autoPlay(){
  const s=D.s,k=s.turn;
  D.idle[k]++;
  if(D.idle[k]>=3){
    if(D.mode=='bot'){E.home();E.ask('Game closed','You were away for 3 turns in a row, so the game was closed.','OK',()=>{},true);return}
    s.st='done';s.win=1-k;s.forf=k;s.msg='';refresh();return;
  }
  D.split={on:false,pick:[]};
  if(s.st=='roll'){D.auto=1;rollAnim()}
  else if(s.st=='move')applyOpt(botPick(s));
}

/* ---------- HUD, status, result ---------- */
function hud(){
  const s=D.s;
  [0,1].forEach(p=>{
    const act=s.st!='done'&&p==s.turn,c=D.cards[p];
    c.classList.toggle('act',act);
    D.btn[p].disabled=!(act&&s.st=='roll'&&canAct());
    const home=[0,1,2].filter(i=>s.t[p*3+i]==GOAL).length,bn=[0,1,2].filter(i=>s.bn[p*3+i]).length;
    c.querySelector('small').textContent='🪙 '+D.coins[p].toLocaleString()+'  🏁 '+home+'/3'+(bn?'  ⚡'+bn:'');
  });
  if(s.st=='done'&&!D.anim&&!D.won){D.won=1;E.sfx.win();setTimeout(()=>{if(D)showResult()},600)}
  panel();armTimer();
}
function ui(){if(!D)return;mark();hud();botCheck()}
function showResult(){
  const s=D.s,w=s.win,l=1-w;
  if(D.mode=='bot'&&w==0){D.coins[0]+=100;setCoins(D.coins[0])}
  const list=$('#rlist');list.innerHTML='';
  [w,l].forEach((p,i)=>{
    const row=document.createElement('div');row.className='rrow r'+i;
    const ic=document.createElement('span');ic.className='ric';
    if(i){ic.textContent='👎'}else{ic.textContent='👑';const b=document.createElement('b');b.textContent='1';ic.append(b)}
    const av=document.createElement('span');av.className='rav';av.textContent=D.avs[p];
    const n=document.createElement('span');n.className='nm';n.textContent=nm(p);
    const tag=document.createElement('span');tag.textContent=i?(s.forf===p?'Forfeited':'Loser'):'Winner'+(D.mode=='bot'&&w==0?'  +100 🪙':'');
    row.append(ic,av,n,tag);list.append(row);
  });
  const cf=$('#confetti');cf.innerHTML='';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)
    for(let i=0;i<26;i++){const e=document.createElement('span');e.textContent=['🎉','✨','⭐','🎊'][i%4];
      e.style.left=Math.random()*100+'%';e.style.animationDuration=3+Math.random()*3+'s';e.style.animationDelay=Math.random()*3+'s';cf.append(e)}
  $('#rreplay').hidden=false;
  $('#result').hidden=false;
}
