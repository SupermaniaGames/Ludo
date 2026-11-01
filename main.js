let mp;
try{mp=await import('./multiplayer.js')}catch(e){
  console.error('Firebase setup problem:',e);
  const why=String(e&&e.message||'').includes('Firebase config')?e.message:'Online play is not set up. Check firebase-config.js';
  const off=()=>{throw new Error(why)};
  mp={me:()=>null,onUser(){},signIn:off,signUp:off,logout:async()=>{},createRoom:off,joinRoom:off,watchRoom:off,setRoom:off,sendChat:off,watchChat:off,setPresence:off,watchOnline:off,sendInvite:off,watchInvites:off,delInvite:off,setAlly:off,watchAlly:off};
}

let duel=null;
try{duel=await import('./duel.js')}catch(e){console.error('Ludo Duel failed to load',e)}

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],F='⚀⚁⚂⚃⚄⚅';
const C=['#e8262a','#1fa03a','#ffd60a','#1e90ff'],N=['Red','Green','Yellow','Blue'];
const SEATS={2:[0,2],3:[0,1,2],4:[0,1,2,3]};
const S={game:'ludo',mode:'bot',np:2,max:2,dmode:'bot',amode:'bot',ogame:'ludo'};
let g=null,ctx={},els=[];

const show=id=>$$('.sc').forEach(s=>s.hidden=s.id!=id);
const say=(id,m)=>$('#'+id).textContent=m||'';
const nm=k=>g.names[k];
const fe=e=>({'auth/email-already-in-use':'That username is taken','auth/invalid-credential':'Wrong username or password','auth/user-not-found':'Wrong username or password','auth/wrong-password':'Wrong username or password','auth/operation-not-allowed':'Turn on Email/Password sign-in in Firebase','auth/network-request-failed':'No connection','auth/admin-restricted-operation':'Turn on Anonymous sign-in in Firebase','permission-denied':'The database rules are blocking this. Add the ludoRooms rules in Firebase.'}[e.code]||e.message||String(e));

/* ---------- sound (synthesised, no files needed) ---------- */
let ac=null,muted=false,animCount=0,Q=0,vis=[],yardEls=[];
try{muted=localStorage.getItem('sm_mute')=='1'}catch{}
const audio=()=>{
  if(!ac){try{ac=new(window.AudioContext||window.webkitAudioContext)()}catch{return null}}
  if(ac.state=='suspended')ac.resume();return ac;
};
let diceBuf=null;
async function loadDice(){
  try{const a=audio();if(!a||diceBuf)return;const r=await fetch('dice.mp3');diceBuf=await a.decodeAudioData(await r.arrayBuffer())}catch(e){}
}
function playBuf(buf,v,maxDur){
  const a=audio();if(!a||muted||!buf)return false;
  const s=a.createBufferSource(),gn=a.createGain();gn.gain.value=v;s.buffer=buf;s.connect(gn).connect(a.destination);s.start(0,0,maxDur);return true;
}
document.addEventListener('pointerdown',()=>{audio();loadDice()},{passive:true});
function tone(f,t0,d,type,v){
  const a=audio();if(!a||muted)return;
  const o=a.createOscillator(),gn=a.createGain(),t=a.currentTime+t0;
  o.type=type;o.frequency.setValueAtTime(f,t);gn.gain.setValueAtTime(v,t);gn.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(gn).connect(a.destination);o.start(t);o.stop(t+d);
}
function noise(t0,d,v){
  const a=audio();if(!a||muted)return;
  const n=Math.floor(a.sampleRate*d),buf=a.createBuffer(1,n,a.sampleRate),ch=buf.getChannelData(0);
  for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*(1-i/n);
  const s=a.createBufferSource(),f=a.createBiquadFilter(),gn=a.createGain();
  f.type='bandpass';f.frequency.value=1800;gn.gain.value=v;s.buffer=buf;
  s.connect(f).connect(gn).connect(a.destination);s.start(a.currentTime+t0);
}
function slide(f0,f1,t0,d,type,v){
  const a=audio();if(!a||muted)return;
  const o=a.createOscillator(),gn=a.createGain(),t=a.currentTime+t0;
  o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+d);
  gn.gain.setValueAtTime(v,t);gn.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(gn).connect(a.destination);o.start(t);o.stop(t+d);
}
// one soft plastic "clack": a short muffled noise tick plus a low thump
function clack(t0,v,f){
  const a=audio();if(!a||muted)return;
  const t=a.currentTime+t0,n=Math.floor(a.sampleRate*.04),buf=a.createBuffer(1,n,a.sampleRate),ch=buf.getChannelData(0);
  for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
  const s=a.createBufferSource(),lp=a.createBiquadFilter(),gn=a.createGain();
  lp.type='lowpass';lp.frequency.value=f;gn.gain.value=v;s.buffer=buf;
  s.connect(lp).connect(gn).connect(a.destination);s.start(t);
  const o=a.createOscillator(),og=a.createGain();
  o.type='sine';o.frequency.setValueAtTime(150+f/12,t);o.frequency.exponentialRampToValueAtTime(70,t+.06);
  og.gain.setValueAtTime(v*.6,t);og.gain.exponentialRampToValueAtTime(.001,t+.08);
  o.connect(og).connect(a.destination);o.start(t);o.stop(t+.09);
}
const sfx={
  // shaken in the hand, then a few bounces that spread out and fade
  dice(){
    if(playBuf(diceBuf,1,1.6))return;
    [0,.055,.12,.17,.25,.31,.4].forEach(t=>clack(t,.22+Math.random()*.14,1500+Math.random()*600));
    [.55,.69,.8,.9].forEach((t,i)=>clack(t,.6-i*.12,950-i*110));
  },
  step(){tone(560,0,.08,'triangle',.22);tone(280,0,.06,'sine',.15)},
  cap(){slide(620,150,0,.4,'sawtooth',.13);slide(430,90,.34,.5,'sawtooth',.13)},
  start(){[392,523,659,784].forEach((f,i)=>tone(f,i*.11,.22,'triangle',.2));tone(1047,.5,.6,'triangle',.22);tone(262,0,.8,'sine',.12)},
  win(){[523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,i*.13,.32,'triangle',.22));tone(262,0,1,'sine',.14);tone(392,.4,.9,'sine',.12)}
};

/* ---------- 3D dice (one per player card) ---------- */
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]},ROT={1:[0,0],6:[0,180],2:[0,-90],5:[0,90],3:[-90,0],4:[90,0]};
let cards=[],cubes=[],dbtn=[];
function makeCube(cube){
  [1,2,3,4,5,6].forEach(v=>{
    const f=document.createElement('div');f.className='face f'+v;
    for(let i=0;i<9;i++){const s=document.createElement('span');if(PIPS[v].includes(i))s.className=v==1?'pip r':'pip';f.append(s)}
    cube.append(f);
  });
}
function face(c,v,go){
  const cu=cubes[c];if(!cu)return;
  if(go)cu._s=(cu._s||0)+1;
  const s=cu._s||0,[a,b]=ROT[v];
  cu.style.transform=`rotateX(${a+720*s}deg) rotateY(${b+720*s}deg)`;
}

/* ---------- characters ---------- */
const AVS=['🦁','🐯','🐼','🦊','🐸','🐵','🦄','🐲','🤖','👑','🥷','🧙','👻','🐧','🦖','🐙'];
const myAv=()=>{try{return localStorage.getItem('sm_av')||AVS[0]}catch{return AVS[0]}};
const setAv=a=>{try{localStorage.setItem('sm_av',a)}catch{}};
function buildAvGrid(){
  const gr=$('#avgrid');gr.innerHTML='';
  AVS.forEach(a=>{
    const b=document.createElement('button');b.textContent=a;b.setAttribute('aria-label','Character '+a);
    b.classList.toggle('on',a==myAv());
    b.onclick=()=>{setAv(a);buildAvGrid()};gr.append(b);
  });
}

/* ---------- menu ---------- */
function markSeg(){$$('.seg').forEach(sg=>[...sg.children].forEach(b=>b.classList.toggle('on',String(S[sg.dataset.k])==b.dataset.v)))}
$$('.seg').forEach(sg=>sg.onclick=e=>{const b=e.target.closest('button');if(!b)return;S[sg.dataset.k]=isNaN(b.dataset.v)?b.dataset.v:+b.dataset.v;markSeg()});
markSeg();
const GN={ludo:'🎲 Ludo',snl:'🐍 Snakes & Ladders',ally:'🤝 Secret Ally · needs 4 players',duel:'⚔️ Ludo Duel · 2 players'};
const maxFor=()=>S.ogame=='ally'?4:S.ogame=='duel'?2:S.max;
const needFor=g=>g=='ally'?4:2;
function markFriends(){$('#maxseg').hidden=S.ogame=='ally'||S.ogame=='duel';markSeg()}
$('[data-k=ogame]').addEventListener('click',markFriends);markFriends();
function renderMe(){
  const u=mp.me(),m=$('#me');m.innerHTML='';
  const ab=document.createElement('button');ab.className='avbtn';ab.textContent=myAv();ab.setAttribute('aria-label','Choose your character');
  ab.onclick=()=>{buildAvGrid();show('chars')};m.append(ab);
  const un=document.createElement('span');un.className='uname';un.textContent=u?u.name:'Not signed in';m.append(un);
  const b=document.createElement('button');b.className='btn';
  if(u){b.textContent='Log out';b.onclick=async()=>{try{await mp.setPresence(mpName(),myAv(),false)}catch{}stopSocial();await mp.logout();renderMe()}}
  else{b.textContent='Sign in';b.onclick=()=>show('auth')}
  m.append(b);
}
const pendingRoom=new URLSearchParams(location.search).get('room');
if(/^\d{4}$/.test(pendingRoom||''))S.pending=pendingRoom;
let booted=false;
mp.onUser(u=>{
  renderMe();startSocial(u);
  if(booted)return;booted=true;
  if(S.pending){if(u)joinCode(S.pending);else{say('aerr','Sign in or play as a guest to join room '+S.pending);show('auth')}}
});
/* ---------- who is online + invites ---------- */
const mpName=()=>(mp.me()||{}).name||'';
const hidden=()=>{try{return localStorage.getItem('sm_hide')=='1'}catch{return false}};
let soc={};
function beat(){if(!mp.me())return;mp.setPresence(mpName(),myAv(),!hidden()&&document.visibilityState=='visible').catch(()=>{})}
function stopSocial(){clearInterval(soc.hb);soc.un&&soc.un();soc.ui&&soc.ui();soc={};$('#inv').hidden=true;renderOnline()}
function startSocial(u){
  if(!u){if(soc.uid)stopSocial();return}
  if(soc.uid==u.uid)return;
  stopSocial();soc.uid=u.uid;soc.list=[];
  try{
    beat();soc.hb=setInterval(()=>{if(document.visibilityState=='visible')beat();renderOnline()},30000);
    soc.un=mp.watchOnline(l=>{soc.list=l;renderOnline()});
    soc.ui=mp.watchInvites(l=>{
      const now=Date.now();
      l.forEach(i=>{if(now-i.ts>6e5)mp.delInvite(i.id).catch(()=>{})});
      const fresh=l.filter(i=>now-i.ts<=6e5).sort((a,b)=>b.ts-a.ts)[0];
      if(fresh)showInvite(fresh);else $('#inv').hidden=true;
    });
  }catch(e){console.warn('presence off',e)}
}
document.addEventListener('visibilitychange',()=>{if(soc.uid)beat()});
addEventListener('pagehide',()=>{if(soc.uid)beat()});
function showInvite(i){
  $('#invt').textContent=(i.av||'🙂')+' '+i.fromName+' invited you to play Ludo';
  $('#inv').hidden=false;
  $('#invj').onclick=async()=>{$('#inv').hidden=true;mp.delInvite(i.id).catch(()=>{});leave();S.pending=null;await joinCode(i.code)};
  $('#invx').onclick=()=>{$('#inv').hidden=true;mp.delInvite(i.id).catch(()=>{})};
  try{sfx.start()}catch{}
}
function renderOnline(){
  const me=mp.me(),now=Date.now();
  const list=((soc.list)||[]).filter(p=>me&&p.uid!=me.uid&&p.on&&now-p.lastSeen<90000);
  $$('.onl').forEach(ul=>{
    ul.innerHTML='';
    if(!list.length){const li=document.createElement('li');li.className='none';li.textContent='No one else is online right now';ul.append(li);return}
    list.forEach(p=>{
      const li=document.createElement('li'),d=document.createElement('i'),n=document.createElement('span'),b=document.createElement('button');
      d.className='dot';n.textContent=(p.av||'🙂')+' '+p.name;b.className='btn p';b.textContent='Invite';
      b.onclick=()=>invite(p,b);li.append(d,n,b);ul.append(li);
    });
  });
}
async function invite(p,b){
  try{
    b.disabled=true;
    let code=ctx.code,fresh=false;
    if(!code){code=await mp.createRoom(maxFor(),myAv(),S.ogame);fresh=true}
    await mp.sendInvite(p.uid,code,mpName(),myAv());
    b.textContent='Invited ✓';
    if(fresh)watch(code);
  }catch(e){b.disabled=false;say('ferr',fe(e))}
}
$('#hide').onchange=e=>{try{localStorage.setItem('sm_hide',e.target.checked?'1':'0')}catch{}beat()};
$('#hide').checked=hidden();

function leave(){
  duel&&duel.leaveOnline&&duel.leaveOnline();duel&&duel.stop();ctx.unsubA&&ctx.unsubA();$('#cover').hidden=true;clearTimer();clearTimeout(ctx.bt);ctx.unsubR&&ctx.unsubR();ctx.unsubC&&ctx.unsubC();
  ctx={};g=null;animCount=0;dlgNo=null;$('#result').hidden=true;$('#dlg').hidden=true;$('#chat').hidden=true;$('#chatbtn').hidden=true;
}
function home(){leave();show('home');renderMe()}
$$('[data-go]').forEach(b=>b.onclick=()=>{
  const v=b.dataset.go;
  if(v=='friends')return show(mp.me()?'friends':'auth');
  if(v=='ally')return(markSeg(),show('asetup'));
  if(v=='duel'){if(!duel)return alert('Ludo Duel could not load. Check that duel.js is uploaded.');markSeg();return show('dsetup')}
  S.game=v=='snl'?'snl':'ludo';S.mode=v=='snl'?'pass':v;markSeg();show('setup');
});
async function doAuth(create){
  const u=$('#u').value.trim(),p=$('#p').value;
  if(!/^[A-Za-z0-9_]{3,14}$/.test(u))return say('aerr','Username: 3-14 letters, numbers or _');
  if(p.length<6)return say('aerr','Password needs 6 or more characters');
  try{create?await mp.signUp(u,p):await mp.signIn(u,p);say('aerr');renderMe();afterAuth()}catch(e){say('aerr',fe(e))}
}
const afterAuth=()=>S.pending?joinCode(S.pending):show('friends');
$('#guest').onclick=async()=>{
  const t=$('#u').value.trim(),name=/^[A-Za-z0-9_]{3,14}$/.test(t)?t:'Guest'+(1000+Math.floor(Math.random()*9000));
  try{await mp.guest(name);say('aerr');renderMe();afterAuth()}catch(e){say('aerr',fe(e))}
};
$('#signin').onclick=()=>doAuth(false);
$('#signup').onclick=()=>doAuth(true);

/* ---------- start games ---------- */
$('#play').onclick=()=>{
  const P=SEATS[S.np];ctx={mode:S.mode};
  const names=P.map((p,k)=>S.mode=='bot'?(k?'Computer '+(k+1):'You'):N[p]);
  g=S.game=='ludo'
    ?{k:'ludo',P,names,t:Array(P.length*4).fill(-1),turn:0,roll:0,st:'roll',msg:''}
    :{k:'snl',P,names,pos:P.map(()=>1),turn:0,roll:0,st:'roll',msg:''};
  g.idle=P.map(()=>0);g.forf=[];g.order=[];
  g.avs=P.map((p,k)=>S.mode=='bot'?(k?AVS.filter(a=>a!=myAv())[(k*5+3)%15]:myAv()):AVS[p*4]);
  enter();
};
let soloBtn=null;
function buildCards(){
  cards=[];cubes=[];dbtn=[];soloBtn=null;
  const solo=ctx.mode=='bot',at=[];
  $('#game').classList.toggle('solo',solo);$('#game').classList.toggle('sa',!!g.sa);
  // against the computer the action buttons sit beside the dice, so the board keeps the same size as in normal Ludo
  if(solo)$('#solo').append($('#aact'));else $('#cbot').after($('#aact'));$('#solo').hidden=!solo;
  let soloCube=null;
  if(solo){
    soloBtn=$('#solo .dice');soloCube=$('#solo .cube');soloCube.innerHTML='';soloCube.style.transform='';soloCube._s=0;makeCube(soloCube);
    soloBtn.onclick=()=>{if(g&&g.st=='roll'&&canAct()){human();rollAnim(g.k=='snl'?sSel():roll)}};
  }
  [0,1,2,3].forEach(c=>at[(c+Q)%4]=c);
  const mk=c=>{
    const k=g.P.indexOf(c),used=k>=0,pos=(c+Q)%4,d=document.createElement('div');
    d.className='pc '+(pos==1||pos==2?'r':'l')+(used?'':' off');d.style.setProperty('--c',C[c]);
    d.innerHTML='<div class="av"></div><div class="pn"><b></b><small></small></div><div class="dbox"><button class="dice" disabled aria-label="Roll the dice"><div class="cube"></div></button></div>';
    d.querySelector('.av').textContent=used?(g.avs&&g.avs[k])||'🙂':'';
    d.querySelector('b').textContent=used?nm(k):'';
    if(g.sa&&used){
      const bd=document.createElement('span');bd.className='abadge';bd.textContent='🤝';bd.hidden=true;d.append(bd);
      d.querySelector('.pn').onclick=()=>reqAlly(k);
    }
    const btn=d.querySelector('.dice'),cube=d.querySelector('.cube');
    if(solo){cubes[c]=soloCube;dbtn[c]={}}
    else{
      makeCube(cube);cubes[c]=cube;dbtn[c]=btn;
      btn.onclick=()=>{if(g&&g.st=='roll'&&canAct()&&g.P[g.turn]==c){human();rollAnim(g.k=='snl'?sSel():roll)}};
    }
    cards[c]=d;return d;
  };
  $('#ctop').replaceChildren(mk(at[0]),mk(at[1]));
  $('#cbot').replaceChildren(mk(at[3]),mk(at[2]));
}
const sSel=()=>sRoll;
function enter(){show('game');sfx.start();$('#chatbtn').hidden=ctx.mode!='online';Q=viewQ();buildCards();build();draw();fitBoard();botCheck()}
// make the board as big as the screen allows, with only small gaps around it
function fitBoard(){
  const gm=$('#game');if(!gm||gm.hidden||!g)return;
  const gap=parseFloat(getComputedStyle(gm).rowGap)||12,bs=getComputedStyle(document.body);
  const kids=['#ctop','#cbot','#solo','#aact'].map($).filter(e=>e&&getComputedStyle(e).display!='none'&&!(e.id=='aact'&&e.parentNode.id=='solo'));
  let used=0;kids.forEach(e=>{used+=e.offsetHeight||0});
  const avail=innerHeight-parseFloat(bs.paddingTop)-parseFloat(bs.paddingBottom)-50-used-gap*kids.length-16;
  const w=Math.max(200,Math.min(gm.clientWidth,avail,480));
  gm.style.setProperty('--bw',Math.floor(w)+'px');
}
addEventListener('resize',()=>requestAnimationFrame(fitBoard));
try{const ro=new ResizeObserver(()=>fitBoard());['#ctop','#cbot','#solo','#aact'].forEach(s=>ro.observe($(s)))}catch{}
addEventListener('orientationchange',()=>setTimeout(fitBoard,250));

/* ---------- ludo engine ---------- */
const PATH=[[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
const START=[0,13,26,39],SAFE=[0,8,13,21,26,34,39,47];
const HC=[[1,2,3,4,5].map(i=>[7,i]),[1,2,3,4,5].map(i=>[i,7]),[13,12,11,10,9].map(i=>[7,i]),[13,12,11,10,9].map(i=>[i,7])];
const ARR={'7,0':['→',0],'0,7':['↓',1],'7,14':['←',2],'14,7':['↑',3]};
const FIN=[[7,6],[6,7],[7,8],[8,7]],Y0=[[0,0],[0,9],[9,9],[9,0]];

const can=(k,i,r)=>{const t=g.t[k*4+i];return t<0?r==6:t+r<=56};
const movable=(k,r)=>[0,1,2,3].filter(i=>can(k,i,r));
function hits(k,n){
  const a=(START[g.P[k]]+n)%52,h=[];
  if(n>50||SAFE.includes(a))return h;
  g.P.forEach((q,j)=>{if(j!=k&&!(g.al&&g.al[k]===j))for(let x=0;x<4;x++){const t=g.t[j*4+x];if(t>=0&&t<=50&&(START[q]+t)%52==a)h.push(j*4+x)}});
  return h;
}
const out=j=>(g.order||[]).includes(j)||(g.forf||[]).includes(j);
const nxt=k=>{let j=k;do{j=(j+1)%g.P.length}while(out(j)&&j!=k);return j};
const human=()=>{if(g&&g.idle)g.idle[g.turn]=0};
function roll(r){
  if(!g||g.st!='roll')return;
  const k=g.turn;g.roll=r;g.msg='';g.rp=g.P[k];g.rc=(g.rc||0)+1;ctx.picking=0;if(g.sa&&g.cd[k]>0)g.cd[k]--;
  g.sixes=r==6?(g.sixes||0)+1:0;
  if(g.sixes>=3){g.sixes=0;g.msg=nm(k)+' rolled three 6s in a row: turn lost';g.turn=nxt(k);return sync()}
  const m=movable(k,r);
  if(!m.length){g.msg=nm(k)+' rolled '+r+': no move';g.turn=nxt(k);g.sixes=0}
  else if(m.length==1)apply(m[0]);
  else g.st='move';
  sync();
}
function apply(i){
  const k=g.turn,r=g.roll,t0=g.t[k*4+i],n=t0<0?0:t0+r,base=g.gfrom!=null?g.gfrom:k,wasAl=g.sa&&g.al[k]>=0;
  g.gfrom=null;ctx.betray=0;
  g.t[k*4+i]=n;
  const h=hits(k,n);h.forEach(x=>g.t[x]=-1);
  if(wasAl&&h.length)g.cr[k]++;
  g.msg=h.length?nm(k)+' captured a token!':'';
  if(g.t.slice(k*4,k*4+4).every(t=>t==56)){
    g.order=(g.order||[]).concat(k);g.sixes=0;
    const ended=g.sa&&checkAllyEnd();
    const left=g.P.map((_,j)=>j).filter(j=>!out(j));
    if(left.length<=1){if(left.length)g.order.push(left[0]);g.order=g.order.concat((g.forf||[]).slice().reverse());g.st='done';g.win=g.order[0];g.msg='';return}
    g.msg=nm(k)+' finished in place '+g.order.length+'!'+(ended?' · 🤝 only allies are left: the pact is over, play for yourself!':'');g.turn=nxt(base);g.st='roll';return;
  }
  if(!(r==6||h.length||n==56)){g.turn=nxt(base);g.sixes=0}
  g.st='roll';
}
function xy(p,rel,i){
  let x,y;
  if(rel<0){const o=Y0[p];x=o[1]+3+(i%2?1:-1);y=o[0]+3+(i>1?1:-1)}
  else{const[r,c]=rel<=50?PATH[(START[p]+rel)%52]:rel<=55?HC[p][rel-51]:FIN[p];x=c+.5;y=r+.5}
  for(let q=0;q<Q;q++)[x,y]=[15-y,x];
  return[x,y];
}
const rotCell=(r,c)=>{for(let q=0;q<Q;q++)[r,c]=[c,14-r];return[r,c]};
// Ludo King style: the local player's colour sits at the bottom-left
function viewQ(){
  const k=ctx.mode=='online'?Math.max(0,g.uids.indexOf((mp.me()||{}).uid)):0;
  return(3-g.P[k]+4)%4;
}

/* ---------- who can act, sync, bots ---------- */
const isBot=()=>ctx.mode=='bot'&&g.turn>0;
const canAct=()=>g&&g.st!='done'&&!animCount&&!ctx.sBusy&&(ctx.mode=='pass'||(ctx.mode=='bot'?g.turn==0:g.uids[g.turn]==(mp.me()||{}).uid));
function sync(){
  g.v=(g.v||0)+1;
  draw();
  if(ctx.mode=='online'){
    const pub={...g};delete pub.al;delete pub.cd;delete pub.cr;   // private alliance data never goes into the shared room
    mp.setRoom(ctx.code,{g:pub}).catch(e=>say('status',fe(e)));
    if(g.sa)persistAlly();
  }
  botCheck();
}
function rollAnim(cb){
  if(ctx.rolling)return;ctx.rolling=1;
  const r=1+Math.random()*6|0,p=g.P[g.turn];ctx.shown=(g.rc||0)+1;face(p,r,true);sfx.dice();
  setTimeout(()=>{ctx.rolling=0;cb(r)},1200);
}
function botPick(k){
  const p=g.P[k],r=g.roll,mv=movable(k,r);
  const danger=abs=>{
    if(SAFE.includes(abs))return 0;let d=0;
    g.P.forEach((q,j)=>{if(j==k||(g.al&&g.al[k]===j))return;for(let x=0;x<4;x++){
      const t=g.t[j*4+x];if(t<0||t>50)continue;
      const dist=(abs-(START[q]+t)%52+52)%52;if(dist>=1&&dist<=6)d++;
    }});
    return d;
  };
  const score=i=>{
    const t=g.t[k*4+i],n=t<0?0:t+r;let s=Math.random()*14;
    if(n==56)s+=100;
    s+=hits(k,n).length*80;
    if(t<0)s+=40;
    if(n<=50){const a=(START[p]+n)%52;if(SAFE.includes(a))s+=22;s-=danger(a)*30}
    else s+=30;
    if(t>=0&&t<=50){const a=(START[p]+t)%52;s+=danger(a)*38;if(SAFE.includes(a))s-=18}
    return s;
  };
  return mv.sort((a,b)=>score(b)-score(a))[0];
}
function botCheck(){
  clearTimeout(ctx.bt);
  if(!g||g.st=='done'||!isBot()||ctx.hold)return;
  ctx.bt=setTimeout(()=>{
    if(!g||!isBot()||ctx.hold)return;
    if(animCount>0)return botCheck();
    if(g.st=='roll'){if(g.sa&&botPropose())return;return rollAnim(g.k=='snl'?sRoll:roll)}
    if(g.st!='move')return;
    if(g.sa&&botAlly())return;
    apply(botPick(g.turn));sync();
  },800);
}

/* ---------- board building & drawing ---------- */
const PIN='<svg viewBox="0 0 40 58" aria-hidden="true"><ellipse cx="20" cy="50" rx="13" ry="5.5" fill="none" style="stroke:color-mix(in srgb,var(--c) 45%,#000)" stroke-width="3.5"/><path d="M20 54C20 54 3 34 3 20a17 17 0 0 1 34 0c0 14-17 34-17 34z" fill="#f6f7fb" stroke="#8b93a6" stroke-width="1.5"/><circle cx="20" cy="20" r="10.5" style="fill:var(--c)" stroke="#0004" stroke-width="1"/><ellipse cx="16.5" cy="15.5" rx="4" ry="2.6" fill="#fff" opacity=".55"/></svg>';

function build(){g.k=='ludo'?buildLudo():buildSnl()}
function buildLudo(){
  const b=$('#board');b.className='lb';b.innerHTML='';els=[];yardEls=[];
  const pi=new Map(PATH.map((p,i)=>[p+'',i])),SEQ=['→','↓','←','↑'];
  for(let r=0;r<15;r++)for(let c=0;c<15;c++){
    const d=document.createElement('i');let bg='transparent';
    const yi=Y0.findIndex(([a,z])=>r>=a&&r<a+6&&c>=z&&c<z+6);
    if(yi>=0)bg=C[yi];
    else if(pi.has(r+','+c)){
      const ix=pi.get(r+','+c),s=START.indexOf(ix);bg=s>=0?C[s]:'#fff';
      if(SAFE.includes(ix)){d.textContent='★';d.className=s>=0?'star w':'star'}
      const ar=ARR[r+','+c];if(ar){d.textContent=SEQ[(ar[1]+Q)%4];d.style.color=C[ar[1]];d.style.fontWeight=900}
    }else{const h=HC.findIndex(a=>a.some(([x,y])=>x==r&&y==c));if(h>=0)bg=C[h]}
    const[R,K]=rotCell(r,c);d.style.gridArea=`${R+1} / ${K+1}`;
    d.style.background=bg;b.append(d);
  }
  Y0.forEach((o,yi)=>{
    const y=document.createElement('div');y.className='yard';
    const a=rotCell(o[0],o[1]),z=rotCell(o[0]+5,o[1]+5);
    y.style.left=(Math.min(a[1],z[1])+1)/15*100+'%';y.style.top=(Math.min(a[0],z[0])+1)/15*100+'%';
    y.style.background=[[25,25],[75,25],[25,75],[75,75]].map(([x,zz])=>`radial-gradient(circle at ${x}% ${zz}%,${C[yi]} 0 12.5%,#0005 13.5% 16.5%,#0000 17.5%)`).join(',')+',#fff';
    const k=g.P.indexOf(yi);
    if(k>=0){const l=document.createElement('b');l.textContent=g.names[k];y.append(l)}
    const cr=document.createElement('div');cr.className='crown';y.append(cr);yardEls[yi]=cr;
    b.append(y);
  });
  const ctr=document.createElement('div'),S0=[1,2,3,0],S=[0,1,2,3].map(j=>S0[(j-Q+4)%4]);
  ctr.className='ctr';
  ctr.style.background=`conic-gradient(from -45deg,${C[S[0]]} 0 25%,${C[S[1]]} 0 50%,${C[S[2]]} 0 75%,${C[S[3]]} 0)`;
  b.append(ctr);
  els=g.t.map((_,n)=>{
    const e=document.createElement('button');e.className='tok';e.style.setProperty('--c',C[g.P[n>>2]]);
    e.setAttribute('aria-label',nm(n>>2)+' token '+((n&3)+1));e.innerHTML=PIN;
    e.onclick=()=>{
      const k=n>>2,i=n&3;
      if(g.st=='move'&&k==g.turn&&canAct()&&movable(k,g.roll).includes(i)){
        human();
        if(ctx.betray){if(!cutsAlly(k,i))return;betrayWith(i);return sync()}
        apply(i);sync()
      }
    };
    b.append(e);return e;
  });
  vis=g.t.slice();animCount=0;layout();
}
function layout(){
  if(!g||g.k!='ludo')return;
  const grp={};
  vis.forEach((rel,n)=>{const[x,y]=xy(g.P[n>>2],rel,n&3);(grp[x+','+y]||(grp[x+','+y]=[])).push({n,x,y})});
  Object.values(grp).forEach(a=>a.forEach((o,i)=>{
    const e=els[o.n],off=a.length>1?(i-(a.length-1)/2)*.34:0;
    e.style.left=(o.x+off)/15*100+'%';e.style.top=o.y/15*100+'%';
    e.style.setProperty('--s',a.length>1?.8:1);
  }));
}
// pieces walk one square at a time, with a tick for every step
function startAnim(n,target){
  const e=els[n],my=ctx;clearTimeout(e._t);
  if(!e._a){e._a=1;animCount++}
  e._g=target;
  const step=()=>{
    if(ctx!==my||!g)return;
    const v=vis[n];
    if(v===target){e._a=0;if(--animCount<=0){animCount=0;settle()}return}
    vis[n]=(target<0||v<0||target<v)?target:v+1;
    layout();target<0?sfx.cap():(sfx.step(),e.classList.remove('hop'),void e.offsetWidth,e.classList.add('hop'));
    e._t=setTimeout(step,vis[n]===target?240:170);
  };
  step();
}
function mark(){
  els.forEach(e=>e.classList.remove('go','hop'));
  if(g.st=='move'&&canAct()){let m=movable(g.turn,g.roll);if(ctx.betray)m=m.filter(i=>cutsAlly(g.turn,i));m.forEach(i=>els[g.turn*4+i].classList.add('go'))}
}
function settle(){if(!g)return;mark();top();botCheck()}
function draw(){
  if(!g)return;
  if(g.k=='snl')return sDraw();
  let maxSteps=0;
  g.t.forEach((target,n)=>{if(vis[n]!==target&&target>=0)maxSteps=Math.max(maxSteps,vis[n]<0?1:Math.max(1,target-vis[n]))});
  g.t.forEach((target,n)=>{
    if(vis[n]===target||els[n]._g===target)return;
    if(target<0&&vis[n]>=0&&maxSteps>0){
      const e=els[n],my=ctx;e._g=target;if(!e._a){e._a=1;animCount++}
      clearTimeout(e._t);e._t=setTimeout(()=>{if(ctx===my&&g)startAnim(n,target)},maxSteps*170);
    }else startAnim(n,target);
  });
  layout();mark();top();
}
function top(){
  const st=$('#status'),k=g.turn,p=g.P[k];
  let t;
  if(g.st=='done')t=nm(g.win)+' wins! 🏆';
  else if(g.st=='move')t=nm(k)+' rolled '+g.roll+': tap a token';
  else if(g.st=='busy')t=g.msg;
  else t=(g.msg?g.msg+' · ':'')+nm(k)+"'s turn";
  st.innerHTML='';
  const dot=document.createElement('i');dot.style.background=g.st=='done'?C[g.P[g.win]]:C[p];
  st.append(dot,t);
  if(g.k=='ludo')(g.order||[]).forEach((kk,i)=>{
    if(g.st=='done'&&i==g.order.length-1)return;
    const cr=yardEls[g.P[kk]];if(cr){cr.innerHTML='👑<b>'+(i+1)+'</b>';cr.classList.add('on')}
  });
  if(g.st=='done'&&!animCount&&!ctx.sBusy&&!ctx.won){ctx.won=1;sfx.win();setTimeout(showResult,600)}
  if(g.rp!=null&&ctx.shown!==g.rc){ctx.shown=g.rc;sfx.dice();face(g.rp,g.roll,true)}
  g.P.forEach((c,kk)=>{
    const card=cards[c],act=g.st!='done'&&kk==g.turn;
    card.classList.toggle('act',act);card.classList.toggle('gone',(g.forf||[]).includes(kk));
    dbtn[c].disabled=!(act&&g.st=='roll'&&canAct());
    card.querySelector('small').textContent=g.k=='ludo'?'🏁 '+g.t.slice(kk*4,kk*4+4).filter(v=>v==56).length+'/4':'📍 '+g.pos[kk];
  });
  if(soloBtn)soloBtn.disabled=!(g.st=='roll'&&canAct());
  allyUI();
  if(ctx.mode=='online'&&!ctx.fmsg&&g.st!='done'){
    const me=g.uids.indexOf((mp.me()||{}).uid);
    if(me>=0&&(g.forf||[]).includes(me)){ctx.fmsg=1;ask('You were removed','You missed 3 turns in a row, so you forfeited this game. You can stay and watch.','Leave',home)}
  }
  armTimer();
}

/* ---------- snakes & ladders ---------- */
const SN={16:6,47:26,49:11,56:53,62:19,64:60,87:24,93:73,95:75,98:78},LD={1:38,4:14,9:31,21:42,28:84,36:44,51:67,71:91,80:100};
const cell=n=>{const r=Math.floor((n-1)/10),c=r%2?9-(n-1)%10:(n-1)%10;return[c*10+5,(9-r)*10+5]};
function buildSnl(){
  const b=$('#board');b.className='sb';b.innerHTML='';
  const PAL=['#ff5a5f','#ffb020','#2ec4d6','#6cc644','#a66cff','#ff7ac6'];
  for(let row=9;row>=0;row--)for(let col=0;col<10;col++){
    const n=row*10+(row%2?9-col:col)+1,d=document.createElement('i');
    d.textContent=n==100?'100 🏆':n;d.style.background=PAL[(col+row*2)%6];b.append(d);
  }
  const V=(p,q)=>[q[0]-p[0],q[1]-p[1]],len=v=>Math.hypot(v[0],v[1]);
  const line=(p,q,w,c)=>`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  let s='<svg viewBox="0 0 100 100">';
  for(const a in LD){
    const A=cell(+a),B=cell(LD[a]),d=V(A,B),L=len(d),u=[d[0]/L,d[1]/L],nr=[-u[1]*1.7,u[0]*1.7];
    const A1=[A[0]+nr[0],A[1]+nr[1]],A2=[A[0]-nr[0],A[1]-nr[1]],B1=[B[0]+nr[0],B[1]+nr[1]],B2=[B[0]-nr[0],B[1]-nr[1]];
    s+=line(A1,B1,1.8,'#4a2608')+line(A2,B2,1.8,'#4a2608');
    const cnt=Math.max(2,Math.floor(L/4.5));
    for(let i=1;i<=cnt;i++){
      const t=i/(cnt+1),p=[A1[0]+(B1[0]-A1[0])*t,A1[1]+(B1[1]-A1[1])*t],q=[A2[0]+(B2[0]-A2[0])*t,A2[1]+(B2[1]-A2[1])*t];
      s+=line(p,q,1.3,'#4a2608')+line(p,q,.8,'#f2c078');
    }
    s+=line(A1,B1,1.1,'#d99a4a')+line(A2,B2,1.1,'#d99a4a');
  }
  const SC=['#2fb83a','#f0a500','#e84a4a','#8a5cf0','#19a7d8'];let si=0;
  for(const a in SN){
    const H=cell(+a),T=cell(SN[a]),d=V(H,T),L=len(d),u=[d[0]/L,d[1]/L],nr=[-u[1],u[0]],amp=Math.min(9,L*.2);
    const c1=[H[0]+u[0]*L*.33+nr[0]*amp,H[1]+u[1]*L*.33+nr[1]*amp],c2=[H[0]+u[0]*L*.66-nr[0]*amp,H[1]+u[1]*L*.66-nr[1]*amp];
    const path=`M${H[0]} ${H[1]}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${T[0]} ${T[1]}`,col=SC[si++%5];
    const tv=V(H,c1),tl=len(tv),h=[-tv[0]/tl,-tv[1]/tl],hn=[-h[1],h[0]],hx=H[0]+h[0]*.8,hy=H[1]+h[1]*.8;
    s+=`<path d="${path}" fill="none" stroke="#12331a" stroke-width="4.4" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${col}" stroke-width="3.4" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3.4" stroke-dasharray=".9 2.2"/>`;
    s+=line([hx+h[0]*2,hy+h[1]*2],[hx+h[0]*4.4,hy+h[1]*4.4],.7,'#e11')+`<circle cx="${hx}" cy="${hy}" r="3.2" fill="${col}" stroke="#12331a" stroke-width=".9"/>`;
    s+=[-1,1].map(k=>`<circle cx="${hx+h[0]*.9+hn[0]*1.4*k}" cy="${hy+h[1]*.9+hn[1]*1.4*k}" r="1" fill="#fff"/><circle cx="${hx+h[0]*1.2+hn[0]*1.4*k}" cy="${hy+h[1]*1.2+hn[1]*1.4*k}" r=".5" fill="#000"/>`).join('');
  }
  b.insertAdjacentHTML('beforeend',s+'</svg>');
  els=g.P.map(p=>{const e=document.createElement('i');e.className='tok';e.style.setProperty('--c',C[p]);e.innerHTML=PIN;b.append(e);return e});
}
const sPlace=(k,n)=>{const[x,y]=cell(n),o=k*1.4-2;els[k].style.left=x+o+'%';els[k].style.top=y+o*.5+'%'};
function sDraw(){
  // another player's move arrives as one update: walk their token square by square
  if(ctx.mode=='online'&&g.an&&g.an.rc!==ctx.sRc&&!ctx.sBusy){
    const a=g.an,my=ctx;ctx.sRc=a.rc;ctx.sBusy=1;
    g.pos.forEach((n,k)=>{if(k!=a.k)sPlace(k,n)});
    let cur=a.from;sPlace(a.k,cur);
    const stp=()=>{
      if(ctx!==my||!g)return;
      if(cur<a.mid){cur++;sPlace(a.k,cur);sfx.step();return setTimeout(stp,190)}
      if(a.to!==a.mid){setTimeout(()=>{if(ctx!==my||!g)return;sPlace(a.k,a.to);ctx.sBusy=0;top()},500);return}
      ctx.sBusy=0;top();
    };
    setTimeout(stp,150);
    return top();
  }
  if(ctx.sBusy)return top();
  g.pos.forEach((n,k)=>sPlace(k,n));
  top();
}
function sRoll(r){
  if(!g||g.st!='roll')return;
  const k=g.turn,from=g.pos[k],on=ctx.mode=='online';let left=g.pos[k]+r>100?0:r;
  g.st='busy';g.roll=r;g.rp=g.P[k];g.rc=(g.rc||0)+1;g.msg=nm(k)+' rolled '+r;
  if(on)ctx.sRc=g.rc;   // we animate our own move here
  sDraw();
  const step=()=>{
    if(!g)return;
    if(left>0){g.pos[k]++;left--;sDraw();sfx.step();return setTimeout(step,190)}
    const q=g.pos[k],to=SN[q]||LD[q];
    if(to){g.pos[k]=to;g.msg=nm(k)+(SN[q]?' got bitten!':' climbed up!');sDraw()}
    const an={k,from,mid:q,to:g.pos[k],rc:g.rc};
    if(g.pos[k]==100){g.st='done';g.win=k;if(on){g.an=an;return sync()}return sDraw()}
    setTimeout(()=>{if(!g)return;if(r!=6)g.turn=nxt(k);g.st='roll';g.msg='';if(on){g.an=an;sync()}else{sDraw();botCheck()}},to?700:250);
  };
  setTimeout(step,250);
}

/* ---------- online: rooms, lobby, chat ---------- */
async function watch(code){
  ctx={mode:'online',code};
  ctx.unsubR=mp.watchRoom(code,onRoom);
  ctx.unsubC=mp.watchChat(code,renderChat);
  $('#chatbtn').hidden=false;show('lobby');
}
$('#create').onclick=async()=>{try{say('ferr');watch(await mp.createRoom(maxFor(),myAv(),S.ogame))}catch(e){say('ferr',fe(e))}};
async function joinCode(c){
  try{say('ferr');await mp.joinRoom(c,myAv());S.pending=null;history.replaceState(null,'',location.pathname);watch(c)}
  catch(e){S.pending=null;show('friends');say('ferr',fe(e))}
}
$('#join').onclick=()=>{
  const c=$('#code').value.trim();
  if(!/^\d{4}$/.test(c))return say('ferr','Enter the 4-digit code');
  joinCode(c);
};
const inviteLink=()=>location.origin+location.pathname+'?room='+ctx.code;
$('#wa').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent('Join my Supermania Ludo game! Room code: '+ctx.code+'\n'+inviteLink()),'_blank');
$('#copy').onclick=async()=>{
  try{await navigator.clipboard.writeText(inviteLink());$('#link').textContent='Link copied!'}
  catch{prompt('Copy this link',inviteLink())}
};
function onRoom(d,pending){
  if(!ctx.code)return;
  if(!d){alert('The room was closed.');return home()}
  ctx.room=d;
  if(d.status=='lobby'){
    $('#rcode').textContent=ctx.code;$('#link').textContent=inviteLink();
    const ul=$('#plist');ul.innerHTML='';
    d.players.forEach((p,k)=>{const li=document.createElement('li');li.textContent=(p.av||'🙂')+'  '+p.name;li.style.setProperty('--c',C[SEATS[Math.max(2,d.players.length)][k]||0]);ul.append(li)});
    const host=d.host==mp.me().uid,need=needFor(d.game);
    $('#lgame').textContent=GN[d.game||'ludo'];
    $('#start').hidden=!(host&&d.players.length>=need);
    $('#lmsg').textContent=d.players.length+' of '+d.max+' joined'+(d.players.length<need?' · needs '+need+' to start':host?'':' · waiting for the host to start');
  }else{
    if(pending)return;
    if(d.g.k=='duel'){
      if(!ctx.playing){ctx.playing=1;duel.start(denvOnline(d.g))}else duel.remote(d.g.s);
      return;
    }
    g=d.g;
    if(g.sa)injectAlly();
    if(!ctx.playing){ctx.playing=1;enter();if(g.sa)startAllyOnline()}
    else{if(g.sa){checkAllyEnd();persistAlly()}draw()}
  }
}
const denvOnline=gd=>({...denv(),mode:'online',online:{code:ctx.code,my:gd.uids.indexOf(mp.me().uid),names:gd.names,avs:gd.avs,s:gd.s,push:s=>mp.setRoom(ctx.code,{'g.s':s}).catch(()=>{})}});
$('#start').onclick=()=>{
  const d=ctx.room,game=d.game||'ludo',n=d.players.length,P=SEATS[n];
  const who={names:d.players.map(p=>p.name),avs:d.players.map(p=>p.av||'🙂'),uids:d.players.map(p=>p.uid)};
  if(game=='duel'&&!duel)return alert('Ludo Duel could not load. Check that duel.js is uploaded.');
  if(game=='duel'){
    const gd={k:'duel',...who,s:duel.newState()};
    ctx.playing=1;g=null;
    mp.setRoom(ctx.code,{status:'playing',g:gd}).catch(e=>alert(fe(e)));
    return duel.start(denvOnline(gd));
  }
  if(game=='snl')g={k:'snl',P,...who,pos:P.map(()=>1),turn:0,roll:0,st:'roll',msg:'',idle:P.map(()=>0),forf:[],order:[]};
  else g={k:'ludo',P,...who,t:Array(P.length*4).fill(-1),turn:0,roll:0,st:'roll',msg:'',idle:P.map(()=>0),forf:[],order:[]};
  if(game=='ally'){g.sa=1;g.gfrom=null;injectAlly()}
  const pub={...g};delete pub.al;delete pub.cd;delete pub.cr;
  ctx.playing=1;
  mp.setRoom(ctx.code,{status:'playing',g:pub}).catch(e=>alert(fe(e)));
  enter();
  if(g.sa)startAllyOnline();
};
const chatOpen=o=>{$('#chat').hidden=!o;$('#chatbtn').hidden=o||ctx.mode!='online';if(o)$('#msgs').scrollTop=1e9};
$('#chatbtn').onclick=()=>chatOpen(true);
$('#cclose').onclick=()=>chatOpen(false);
function renderChat(list){
  const l=$('#msgs'),mine=(mp.me()||{}).uid;l.innerHTML='';
  list.forEach(m=>{
    const d=document.createElement('div'),n=document.createElement('b'),t=document.createElement('span');
    d.className='m'+(m.uid==mine?' me':'');n.textContent=m.name;t.textContent=m.text;d.append(n,t);l.append(d);
  });
  l.scrollTop=l.scrollHeight;
}
function sendMsg(){const t=$('#ct').value.trim();if(t&&ctx.code){mp.sendChat(ctx.code,t.slice(0,200));$('#ct').value=''}}
$('#send').onclick=sendMsg;
$('#ct').onkeydown=e=>{if(e.key=='Enter')sendMsg()};

/* ---------- updates come from the network, never a stale cache ---------- */
if('serviceWorker' in navigator){
  const had=!!navigator.serviceWorker.controller;let reloaded=false;
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{
    r.update();
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState=='visible')r.update()});
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had&&!reloaded){reloaded=true;location.reload()}});
}

/* ---------- install button ---------- */
let installEvt=null;
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
const showInstall=()=>{$('#install').hidden=!!standalone||(!installEvt&&!isIOS)};
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;showInstall()});
addEventListener('appinstalled',()=>{installEvt=null;showInstall()});
$('#install').onclick=async()=>{
  if(installEvt){installEvt.prompt();await installEvt.userChoice;installEvt=null;showInstall()}
  else alert('On iPhone: tap the Share button, then Add to Home Screen.');
};
showInstall();

/* ---------- sound toggle ---------- */
$('#mute').textContent=muted?'🔇':'🔊';
$('#mute').onclick=()=>{muted=!muted;try{localStorage.setItem('sm_mute',muted?'1':'0')}catch{}$('#mute').textContent=muted?'🔇':'🔊';if(!muted)sfx.step()};

/* ---------- results ---------- */
function showResult(){
  if(!g||g.st!='done')return;
  const ord=g.k=='ludo'?g.order.slice():[g.win,...g.P.map((_,j)=>j).filter(j=>j!=g.win).sort((a,b)=>((g.forf||[]).includes(a)-(g.forf||[]).includes(b))||g.pos[b]-g.pos[a])];
  const list=$('#rlist');list.innerHTML='';
  ord.forEach((k,i)=>{
    const fo=(g.forf||[]).includes(k),last=(i==ord.length-1&&ord.length>1)||fo;
    const row=document.createElement('div');row.className='rrow r'+i;
    const ic=document.createElement('span');ic.className='ric';
    if(last)ic.textContent='👎';else{ic.textContent='👑';const b=document.createElement('b');b.textContent=i+1;ic.append(b)}
    const av=document.createElement('span');av.className='rav';av.textContent=(g.avs&&g.avs[k])||'🙂';
    const nmEl=document.createElement('span');nmEl.className='nm';nmEl.textContent=nm(k);
    const tag=document.createElement('span');tag.textContent=fo?'Forfeited':i==0?'Winner':last?'Loser':'#'+(i+1);
    row.append(ic,av,nmEl,tag);list.append(row);
  });
  const cf=$('#confetti');cf.innerHTML='';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)
    for(let i=0;i<26;i++){const s=document.createElement('span');s.textContent=['🎉','✨','⭐','🎊'][i%4];
      s.style.left=Math.random()*100+'%';s.style.animationDuration=3+Math.random()*3+'s';s.style.animationDelay=Math.random()*3+'s';cf.append(s)}
  $('#rreplay').hidden=ctx.mode=='online';
  $('#result').hidden=false;
}
$('#rmenu').onclick=home;
$('#rreplay').onclick=()=>{$('#result').hidden=true;duel&&duel.active()?duel.start(denv()):(g&&g.sa?$('#aplay').onclick():$('#play').onclick())};
$('#rshare').onclick=()=>shareApp('I just played Supermania Ludo! Come play with me:');

/* ---------- share app ---------- */
async function shareApp(text){
  const url=location.origin+location.pathname.replace(/index\.html$/,'');
  text=text||'Play Supermania Ludo with me! Ludo and Snakes & Ladders:';
  if(navigator.share){try{await navigator.share({title:'Supermania Ludo',text,url});return}catch(e){if(e.name=='AbortError')return}}
  window.open('https://wa.me/?text='+encodeURIComponent(text+'\n'+url),'_blank');
}
$('#shareapp').onclick=()=>shareApp();

/* ---------- "are you sure?" and the phone's back button ---------- */
function ask(title,text,yes,cb,info){
  dlgNo=null;$('#dno').textContent='Stay';$('#dno').hidden=!!info;
  $('#dt').textContent=title;$('#dp').textContent=text;$('#dyes').textContent=yes;
  $('#dyes').onclick=()=>{closeDlg();cb()};$('#dno').onclick=closeDlg;$('#dlg').hidden=false;
}
let dlgNo=null;
function askAB(title,text,yes,no,cbYes,cbNo){
  $('#dno').hidden=false;$('#dt').textContent=title;$('#dp').textContent=text;
  $('#dyes').textContent=yes;$('#dno').textContent=no;dlgNo=cbNo||null;
  $('#dyes').onclick=()=>{dlgNo=null;closeDlg();cbYes()};
  $('#dno').onclick=()=>closeDlg();
  $('#dlg').hidden=false;
}
const closeDlg=()=>{$('#dlg').hidden=true;const f=dlgNo;dlgNo=null;f&&f()};
const cur=()=>($$('.sc').find(s=>!s.hidden)||{}).id;
function leaveFlow(){
  const sc=cur();
  if(sc=='game'&&g&&g.st!='done')ask('Leave game?','Your game will be lost.','Leave',home);
  else if(sc=='duel'&&duel&&duel.active()&&!duel.over())ask('Leave game?','Your game will be lost.','Leave',home);
  else if(sc=='lobby')ask('Leave room?','You will leave this room.','Leave',home);
  else home();
}
$$('[data-back]').forEach(b=>b.onclick=leaveFlow);
let armed=false,exiting=false;
document.addEventListener('pointerdown',()=>{if(!armed){armed=true;history.pushState({sm:1},'')}},{passive:true});
addEventListener('popstate',()=>{
  armed=false;
  if(exiting)return;
  if(!$('#dlg').hidden){closeDlg();return}
  if(!$('#result').hidden){home();return}
  if(!$('#chat').hidden){chatOpen(false);return}
  if(cur()=='home')ask('Exit app?','Do you want to exit Supermania Ludo?','Exit',()=>{exiting=true;try{window.close()}catch{}history.go(-2)});
  else leaveFlow();
});

/* ---------- 10-second turn timer, auto-play and forfeit ---------- */
const TURN_MS=10000;
function clearTimer(){
  clearTimeout(ctx.tm);clearInterval(ctx.ti);ctx.tkey=null;ctx.tstart=0;
  cards.forEach(cd=>cd&&delete cd.dataset.t);
}
function tickTimer(){
  if(!g||!ctx.tstart)return;
  const rem=Math.max(0,Math.ceil((TURN_MS-(Date.now()-ctx.tstart))/1000));
  cards.forEach((cd,c)=>{if(!cd)return;if(c==g.P[g.turn]&&g.st!='done')cd.dataset.t=rem;else delete cd.dataset.t});
}
function armTimer(){
  if(!g||g.st=='done'||g.st=='busy'||animCount||ctx.hold||(ctx.mode=='bot'&&g.turn>0)){clearTimer();return}
  const key=(g.v||0)+':'+g.turn+':'+g.st+':'+(g.rc||0);
  if(ctx.tkey===key)return;
  clearTimer();ctx.tkey=key;ctx.tstart=Date.now();
  ctx.ti=setInterval(tickTimer,250);tickTimer();
  let delay=TURN_MS;
  if(ctx.mode=='online'){
    const me=g.uids.indexOf((mp.me()||{}).uid);
    if(me<0||(g.forf||[]).includes(me))return;
    // the player's own phone acts first; if they have left, the others step in one after another
    delay+=2500*((me-g.turn+g.P.length)%g.P.length);
  }
  ctx.tm=setTimeout(()=>{if(g&&ctx.tkey===key)autoPlay()},delay);
}
function autoPlay(){
  if(!g||g.st=='done')return;
  const k=g.turn;
  g.idle=g.idle||g.P.map(()=>0);
  g.idle[k]=(g.idle[k]||0)+1;
  if(g.idle[k]>=3){
    if(ctx.mode=='bot'){
      home();
      ask('Game closed','You were away for 3 turns in a row, so the game was closed.','OK',()=>{},true);
      return;
    }
    return forfeit(k);
  }
  if(g.k=='snl'){if(g.st=='roll')sRoll(1+Math.random()*6|0);return}
  if(g.st=='roll')roll(1+Math.random()*6|0);
  if(g.st=='move'&&g.turn==k){apply(botPick(k));sync()}
  if(!g.msg)g.msg=nm(k)+' was away: played automatically';
  sync();
}
function forfeit(k){
  g.forf=(g.forf||[]).concat(k);g.idle[k]=0;if(g.sa){unally(k);checkAllyEnd()}g.msg=nm(k)+' forfeited (away 3 turns)';
  const left=g.P.map((_,j)=>j).filter(j=>!out(j));
  if(left.length<=1){
    if(g.k=='ludo'){if(left.length)g.order=(g.order||[]).concat(left[0]);g.order=(g.order||[]).concat(g.forf.slice().reverse());g.win=g.order[0]}
    else g.win=left.length?left[0]:g.win;
    g.st='done';
  }else if(g.turn==k){g.turn=nxt(k);g.st='roll';g.sixes=0}
  sync();
}

/* ---------- splash ---------- */
setTimeout(()=>{const s=$('#splash');if(s){s.classList.add('hide');setTimeout(()=>s.remove(),600)}},1400);

/* ---------- Ludo Duel ---------- */
const denv=()=>({sfx,tone,AVS,myAv,show,home,ask,mode:S.dmode,myName:()=>(mp.me()||{}).name||'',muted:()=>muted});
$('#dplay').onclick=()=>duel&&duel.start(denv());
$('#dmute').onclick=()=>{$('#mute').click();$('#dmute').textContent=muted?'🔇':'🔊'};


/* ---------- Ludo: Secret Ally ---------- */
$('#aplay').onclick=()=>{
  const P=SEATS[4],bot=S.amode=='bot';ctx={mode:S.amode};
  g={k:'ludo',sa:1,P,names:P.map((p,k)=>bot?(k?'Computer '+(k+1):'You'):N[p]),t:Array(16).fill(-1),turn:0,roll:0,st:'roll',msg:'',
     al:[-1,-1,-1,-1],cd:[0,0,0,0],cr:[0,0,0,0],gfrom:null,idle:[0,0,0,0],forf:[],order:[]};
  g.avs=P.map((p,k)=>bot?(k?AVS.filter(a=>a!=myAv())[(k*5+3)%15]:myAv()):AVS[p*4]);
  // the computers sometimes team up between themselves, in secret
  if(bot&&Math.random()<.65){const b=[1,2,3].sort(()=>Math.random()-.5);g.al[b[0]]=b[1];g.al[b[1]]=b[0]}
  enter();
  setTimeout(()=>{if(g&&g.sa)toast(bot?'Tip: tap 🤝 Ask for ally before you roll':'Tip: tap 🤝 Ask for ally before you roll. The phone is handed over in private.')},700);
};
let toastT=0;
function toast(m){const t=$('#atoast');if(!t)return;t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},3800)}
const myIdx=()=>g.uids.indexOf((mp.me()||{}).uid);
const viewer=()=>ctx.mode=='bot'?0:ctx.mode=='online'?myIdx():g.turn;
// "pass the phone" screen, so a private step is not seen by the other players
function cover(name,sub,cb){
  ctx.hold=1;clearTimer();
  $('#cvt').textContent='Pass the phone to '+name;$('#cvs').textContent=sub;$('#cvb').textContent="I'm "+name;
  $('#cover').hidden=false;
  $('#cvb').onclick=()=>{$('#cover').hidden=true;cb&&cb()};
}
const pact=(a,b)=>{g.al[a]=b;g.al[b]=a;g.cr[a]=g.cr[b]=0};
function unally(k){if(g.al&&g.al[k]>=0){const j=g.al[k];g.al[k]=-1;g.al[j]=-1;g.cr[k]=g.cr[j]=0}}
// a pact ends when one ally is out, or when only the two allies are left
function checkAllyEnd(){
  g.P.forEach((_,k)=>{if(g.al[k]>=0&&out(k))unally(k)});
  const left=g.P.map((_,j)=>j).filter(j=>!out(j));
  if(left.length==2&&g.al[left[0]]===left[1]){unally(left[0]);return true}
  return false;
}
// does moving token i land on a spot where it would cut the ally?
function cutsAlly(k,i){
  const j=g.al[k];if(j<0)return false;
  const t=g.t[k*4+i],n=t<0?0:t+g.roll;if(n>50)return false;
  const a=(START[g.P[k]]+n)%52;if(SAFE.includes(a))return false;
  return [0,1,2,3].some(x=>{const u=g.t[j*4+x];return u>=0&&u<=50&&(START[g.P[j]]+u)%52==a});
}
function betrayWith(i){
  const k=g.turn,j=g.al[k];
  unally(k);g.cd[k]=3;
  apply(i);
  g.msg='💔 '+nm(k)+' betrayed '+nm(j)+' and cut their token!';
}
// hand the number you just rolled to your ally: they have to use it
function gift(){
  const k=g.turn,j=g.al[k],r=g.roll,m=movable(j,r);
  g.sixes=0;g.gfrom=k;g.turn=j;ctx.betray=0;
  g.msg=nm(j)+' uses a gifted '+r;
  if(ctx.mode=='bot'&&m.length==1){apply(m[0]);return sync()}
  g.st='move';
  if(ctx.mode=='pass'){
    ctx.hold=1;sync();
    cover(nm(j),'Your secret ally gave you a '+r+'. You must use it.',()=>{ctx.hold=0;top()});
  }else sync();
}
function reqAlly(t){
  if(!g||!g.sa||g.st=='done'||ctx.hold)return;
  const k=g.turn;
  if(t===k)return;
  if(ctx.mode=='bot'&&k!==0)return;
  if(ctx.mode=='online'&&k!==myIdx())return;
  if(!canAct()||g.st!='roll')return toast('Ask for an ally at the start of your turn, before you roll');
  if(out(t))return toast(nm(t)+' is already out');
  if(g.al[k]>=0)return toast('You already have a secret ally');
  if(g.cd[k]>0)return toast('No new alliance for your next '+g.cd[k]+' roll'+(g.cd[k]>1?'s':''));
  ctx.hold=1;clearTimer();
  askAB('Send Secret Alliance Request?','Ask '+nm(t)+' to team up in secret. Allies never cut each other.','Accept','Decline',()=>sendReq(k,t),()=>{ctx.hold=0;ctx.mode=='online'?top():sync()});
}
function sendReq(k,t){
  const my=ctx;
  if(ctx.mode=='bot'){
    toast('Request sent to '+nm(t)+'…');
    setTimeout(()=>{
      if(ctx!==my||!g)return;
      if(!out(t)&&g.al[t]<0&&g.cd[t]==0&&g.al[k]<0&&Math.random()<.6){pact(k,t);toast('🤝 '+nm(t)+' accepted. Your pact is secret!');sfx.start()}
      else toast(nm(t)+' declined');
      ctx.hold=0;sync();
    },1100);
  }else if(ctx.mode=='online'){
    mp.setAlly(ctx.code,g.uids[t],{req:{from:g.uids[k],fromName:nm(k),ts:Date.now()}}).catch(e=>toast(fe(e)));
    toast('Request sent to '+nm(t)+'. Only they can see it.');
    ctx.hold=0;top();
  }else{
    // pass n play: the phone goes to the other player, who answers in private, and comes back
    if(out(t)||g.al[t]>=0||g.cd[t]>0){toast(nm(t)+' cannot ally right now');ctx.hold=0;return sync()}
    cover(nm(t),'A private request is waiting for you',()=>{
      const done=ok=>{
        if(ok){pact(k,t);sfx.start()}
        cover(nm(k),'Hand the phone back to continue your turn',()=>{
          toast(ok?'🤝 '+nm(t)+' accepted. Your pact is secret!':nm(t)+' declined');
          ctx.hold=0;sync();
        });
      };
      askAB(nm(k)+' asks for a secret alliance','Team up in secret? Allies never cut each other.','Accept','Decline',()=>done(true),()=>done(false));
    });
  }
}
// a computer sometimes asks you
function botPropose(){
  const k=g.turn;
  if(ctx.mode!='bot'||g.al[k]>=0||g.cd[k]>0||g.al[0]>=0||g.cd[0]>0||out(0)||out(k)||(g.rc||0)<4||Math.random()>.12)return false;
  ctx.hold=1;
  askAB('🤝 '+nm(k)+' sends you a Secret Alliance Request','Accept to team up in secret. Allies never cut each other.','Accept','Decline',
    ()=>{pact(k,0);ctx.hold=0;toast('🤝 Secret pact formed with '+nm(k));sync();sfx.start()},()=>{ctx.hold=0;sync()});
  return true;
}
// the computer's use of gifts and betrayal
function botAlly(){
  const k=g.turn,j=g.al[k],r=g.roll;
  if(j<0||g.gfrom!=null)return false;
  if(g.cr[k]>0){
    const c=movable(k,r).filter(i=>cutsAlly(k,i));
    if(c.length&&Math.random()<.5){betrayWith(c[0]);sync();return true}
  }
  if(!out(j)){
    const win=(q,i)=>{const t=g.t[q*4+i],n=t<0?0:t+r;return n==56||hits(q,n).length>0};
    const theirs=movable(j,r).some(i=>win(j,i)),mine=movable(k,r).some(i=>win(k,i));
    if(theirs&&!mine&&Math.random()<.7){gift();return true}
  }
  return false;
}
function allyUI(){
  if(!g||!g.sa)return;
  requestAnimationFrame(fitBoard);
  const v=viewer(),pv=g.st=='done'?-1:g.al[v];
  g.P.forEach((c,k)=>{
    const b=cards[c]&&cards[c].querySelector('.abadge');
    if(b){const on=pv>=0&&(k==v||k==pv);b.hidden=!on;if(on)b.title='Secret ally'}
  });
  const bar=$('#aact');bar.innerHTML='';
  const k=g.turn;
  if(g.st=='done'||v!==k||!canAct()||ctx.hold)return;
  const add=(t,f,dis)=>{const b=document.createElement('button');b.className='btn';b.textContent=t;b.onclick=f;if(dis)b.disabled=true;bar.append(b)};
  // before the roll: ask somebody to be your secret ally
  if(g.st=='roll'){
    if(g.al[k]>=0)return;
    if(g.cd[k]>0)return add('🤝 Ask for ally in '+g.cd[k]+' roll'+(g.cd[k]>1?'s':''),null,true);
    const cand=g.P.map((_,t)=>t).filter(t=>t!=k&&!out(t));
    if(!cand.length)return;
    if(!ctx.picking)return add('🤝 Ask for ally',()=>{ctx.picking=1;allyUI()});
    cand.forEach(t=>add('🤝 '+nm(t),()=>{ctx.picking=0;reqAlly(t)}));
    return add('✖',()=>{ctx.picking=0;allyUI()});
  }
  // after the roll: give the number to your ally, or cut them
  if(g.st!='move'||g.al[k]<0||g.gfrom!=null)return;
  const j=g.al[k],r=g.roll;
  if(!ctx.betray){
    if(!out(j)&&movable(j,r).length)add('🎁 Give this '+r+' to ally',()=>{human();gift()});
    else add('🎁 Ally cannot use a '+r,null,true);
  }
  if(g.cr[k]>0&&movable(k,r).some(i=>cutsAlly(k,i)))
    add(ctx.betray?'✖ Cancel':'💔 Break Alliance & Cut',()=>{ctx.betray=ctx.betray?0:1;mark();allyUI();if(ctx.betray)toast('Tap the glowing token to cut your ally')});
}

/* ----- Secret Ally online: each player keeps their own pact in a private document ----- */
function injectAlly(){
  if(!ctx.al){ctx.al=[-1,-1,-1,-1];ctx.cd=[0,0,0,0];ctx.cr=[0,0,0,0]}
  g.al=ctx.al;g.cd=ctx.cd;g.cr=ctx.cr;
}
async function startAllyOnline(){
  const my=ctx,uid=(mp.me()||{}).uid;
  try{await mp.setAlly(ctx.code,uid,{pact:null,cd:0,cr:0,req:null,resp:null})}catch{}
  if(ctx!==my)return;
  ctx.unsubA=mp.watchAlly(ctx.code,onAlly);
}
function persistAlly(){
  if(ctx.mode!='online'||!g||!g.sa||!ctx.al)return;
  const me=myIdx();if(me<0)return;
  const j=ctx.al[me],key=j+'|'+ctx.cd[me]+'|'+ctx.cr[me];
  if(ctx.akey===key)return;
  const was=ctx.apart==null?-1:ctx.apart,uid=g.uids[me];
  ctx.akey=key;ctx.apart=j;
  mp.setAlly(ctx.code,uid,{pact:j>=0?g.uids[j]:null,cd:ctx.cd[me],cr:ctx.cr[me]}).catch(()=>{});
  if(was>=0&&was!==j)mp.setAlly(ctx.code,g.uids[was],{pact:null}).catch(()=>{});
  if(j>=0&&was!==j)mp.setAlly(ctx.code,g.uids[j],{pact:uid,cr:0}).catch(()=>{});
}
function onAlly(d,pending){
  if(!g||!g.sa||ctx.mode!='online'||pending)return;
  const me=myIdx();if(me<0)return;
  if(!ctx.alInit){ctx.alInit=1;ctx.cd[me]=d.cd||0;ctx.cr[me]=d.cr||0}
  const j=d.pact?g.uids.indexOf(d.pact):-1;
  if(j!==ctx.al[me]){
    const was=ctx.al[me];
    if(was>=0)ctx.al[was]=-1;
    ctx.al[me]=-1;
    if(j>=0){ctx.al[me]=j;ctx.al[j]=me;ctx.cr[me]=d.cr||0;toast('🤝 Secret pact formed with '+nm(j));sfx.start()}
    else if(was>=0)toast('💔 Your alliance has ended');
    ctx.apart=j;ctx.akey=j+'|'+ctx.cd[me]+'|'+ctx.cr[me];
    top();
  }
  if(d.resp&&d.resp.ts!==ctx.lastResp){ctx.lastResp=d.resp.ts;if(!d.resp.ok)toast(d.resp.name+' declined')}
  if(d.req&&d.req.ts!==ctx.lastReq){ctx.lastReq=d.req.ts;if(Date.now()-d.req.ts<120000)showAllyReq(d.req)}
}
function showAllyReq(req){
  if(!g||!g.sa)return;
  const me=myIdx(),from=g.uids.indexOf(req.from);
  const reply=ok=>{
    mp.setAlly(ctx.code,req.from,{resp:{ok,name:nm(me),ts:Date.now()}}).catch(()=>{});
    mp.setAlly(ctx.code,g.uids[me],{req:null}).catch(()=>{});
  };
  if(from<0||out(from)||out(me)||ctx.al[me]>=0||ctx.cd[me]>0){reply(false);return}
  if(!$('#dlg').hidden)return setTimeout(()=>showAllyReq(req),2500);
  askAB('🤝 '+nm(from)+' sends you a Secret Alliance Request','Accept to team up in secret. Allies never cut each other.','Accept','Decline',
    ()=>{pact(me,from);persistAlly();reply(true);toast('🤝 Secret pact formed with '+nm(from));sfx.start();top()},()=>reply(false));
}
