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
const S={game:'ludo',mode:'bot',np:2,max:2,dmode:'bot',amode:'bot',ogame:'ludo',vmode:'solo'};
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
$$('.seg').forEach(sg=>sg.onclick=e=>{const b=e.target.closest('button');if(!b)return;S[sg.dataset.k]=isNaN(b.dataset.v)?b.dataset.v:+b.dataset.v;markSeg();const vh=$('#vmhint');if(vh)vh.textContent=VMT[S.vmode]});
markSeg();
const GN={ludo:'🎲 Ludo',snl:'🐍 Snakes & Ladders',ally:'🤝 Secret Ally · needs 4 players',duel:'⚔️ Ludo Duel · 2 players'};
const maxFor=()=>S.ogame=='ally'?4:S.ogame=='duel'?2:S.max;
const needFor=g=>g=='ally'?4:2;
const VMT={solo:'Everyone wins on their own. Make secret pacts in the game, two pairs can ally.',duo:'Fixed teams: Red + Yellow against Green + Blue. Both partners must finish to win together.'};
function markFriends(){$('#maxseg').hidden=S.ogame=='ally'||S.ogame=='duel';$('#vmseg').hidden=S.ogame!='ally';markSeg();$('#vmhint').textContent=VMT[S.vmode]}
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
    if(!code){code=await mp.createRoom(maxFor(),myAv(),S.ogame);fresh=true;if(S.ogame=='ally')mp.setRoom(code,{vm:S.vmode}).catch(()=>{})}
    await mp.sendInvite(p.uid,code,mpName(),myAv());
    b.textContent='Invited ✓';
    if(fresh)watch(code);
  }catch(e){b.disabled=false;say('ferr',fe(e))}
}
$('#hide').onchange=e=>{try{localStorage.setItem('sm_hide',e.target.checked?'1':'0')}catch{}beat()};
$('#hide').checked=hidden();

function leave(){
  duel&&duel.leaveOnline&&duel.leaveOnline();duel&&duel.stop();ctx.unsubA&&ctx.unsubA();clearTimeout(ctx.preqT);$('#cover').hidden=true;$('#areq').hidden=true;$('#rxbar').hidden=true;$('#result .rtitle').textContent='Congratulations!';clearTimer();clearTimeout(ctx.bt);ctx.unsubR&&ctx.unsubR();ctx.unsubC&&ctx.unsubC();
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
  $('#game').classList.toggle('solo',solo);$('#game').classList.toggle('sa',!!g.sa);$('#rxbtn').hidden=!g.sa;$('#rxbar').hidden=true;
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
    d.innerHTML='<div class="av"></div><div class="pn"><b></b><small></small>'+(g.sa?'<em class="ainfo"></em>':'')+'</div><div class="dbox"><button class="dice" disabled aria-label="Roll the dice"><div class="cube"></div></button></div>';
    d.querySelector('.av').textContent=used?(g.avs&&g.avs[k])||'🙂':'';
    d.querySelector('b').textContent=used?nm(k):'';
    if(g.sa&&used){
      const sp=document.createElement('span');sp.className='shs';d.querySelector('small').after(sp);
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
  g.P.forEach((q,j)=>{if(j!=k&&!(g.al&&g.al[k]===j))for(let x=0;x<4;x++){const t=g.t[j*4+x];if(t>=0&&t<=50&&(START[q]+t)%52==a&&!shielded(j,x,k))h.push(j*4+x)}});
  return h;
}
const inOrder=j=>(g.order||[]).includes(j),forfd=j=>(g.forf||[]).includes(j);
const placed=j=>inOrder(j)||forfd(j);                       // has a final place (or forfeited)
const out=j=>placed(j)||(g.dn||[]).includes(j);             // skipped in the turn order (a duo partner that is home waits in g.dn)
const nxt=k=>{let j=k;do{j=(j+1)%g.P.length}while(out(j)&&j!=k);return j};
const human=()=>{if(g&&g.idle)g.idle[g.turn]=0};
// fair dice: never a third 6 in a row, and nobody waits forever for a 6 to leave home
function dice(){
  const k=g.turn;g.ns=g.ns||[0,0,0,0];
  const allHome=[0,1,2,3].every(x=>g.t[k*4+x]<0);
  // 6s are made a little more common: all tokens at home = 1 in 3, otherwise about 1 in 4.5
  let r=Math.random()<(allHome?.34:.22)?6:1+Math.random()*5|0;
  if((g.sixes||0)>=2&&r==6)r=1+Math.random()*5|0;
  else if(r!=6&&(g.ns[k]||0)>=(allHome?2:7)&&(g.sixes||0)<2)r=6;
  g.ns[k]=r==6?0:(g.ns[k]||0)+1;
  return r;
}
function roll(r){
  if(!g||g.st!='roll')return;
  const k=g.turn;g.roll=r;g.msg='';g.rp=g.P[k];g.rc=(g.rc||0)+1;ctx.picking=0;ctx.shp=0;if(g.sa&&g.cd[k]>0)g.cd[k]--;
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
  ctx.shp=0;
  g.t[k*4+i]=n;
  const h=hits(k,n);h.forEach(x=>g.t[x]=-1);
  if(wasAl&&h.length)g.cr[k]++;
  g.msg=h.length?nm(k)+' captured a token!':'';
  if(g.t.slice(k*4,k*4+4).every(t=>t==56)){
    g.sixes=0;
    const j=g.sa?g.al[k]:-1,pm=j>=0&&g.pm&&g.pm[k];
    if(pm&&pm.vm=='duo'&&!placed(j)){
      if((g.dn||[]).includes(j)){            // second partner home: the team has finished
        g.dn=g.dn.filter(x=>x!=j);g.order=(g.order||[]).concat(j,k);g.duo=[j,k];
        if(g.order.length==2){finishAll();return}   // the team came first: Duo Victory
      }else{                                   // first partner home: wait for the other one
        g.dn=(g.dn||[]).concat(k);g.msg='✔ '+nm(k)+' is home. Waiting for '+nm(j)+' to finish too';g.turn=nxt(base);g.st='roll';return;
      }
    }else g.order=(g.order||[]).concat(k);
    const ended=g.sa&&checkAllyEnd();
    const left=g.P.map((_,j)=>j).filter(j=>!placed(j));
    if(left.length<=1){finishAll();return}
    g.msg=nm(k)+' finished in place '+g.order.length+'!'+(ended?' · 🤝 only allies are left: the pact is over, play for yourself!':'');g.turn=nxt(base);g.st='roll';return;
  }
  const bonus=r==6||h.length||n==56;
  if(base!=k){g.turn=bonus&&!out(base)?base:nxt(base);g.sixes=0}   // a gifted move never gives the ally another roll: the turn goes back to whoever gifted it
  else if(!bonus){g.turn=nxt(base);g.sixes=0}
  g.st='roll';
}
// everybody still playing gets a place (most tokens home first), then the forfeits, last forfeit last
function finishAll(){
  const home=x=>g.t.slice(x*4,x*4+4).reduce((a,t)=>a+Math.max(t,0),0);
  const team=x=>g.vm=='duo'?home(x)+home((x+2)%4):0;
  const rest=g.P.map((_,x)=>x).filter(x=>!placed(x)).sort((a,b)=>g.vm=='duo'?(team(b)-team(a))||((a%2)-(b%2))||(home(b)-home(a)):home(b)-home(a));
  g.dn=[];g.order=(g.order||[]).concat(rest,(g.forf||[]).slice().reverse());
  g.st='done';g.win=g.order[0];g.msg='';
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
  if(g.sa){pactTick();shTick()}
  draw();
  if(ctx.mode=='online'){
    const pub={...g};delete pub.al;delete pub.cd;delete pub.cr;delete pub.pm;   // private alliance data never goes into the shared room
    mp.setRoom(ctx.code,{g:pub}).catch(e=>say('status',fe(e)));
    if(g.sa)persistAlly();
  }
  botCheck();
}
function rollAnim(cb){
  if(ctx.rolling)return;ctx.rolling=1;
  const r=dice(),p=g.P[g.turn];ctx.shown=(g.rc||0)+1;face(p,r,true);sfx.dice();
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
    if(g.st=='roll'){if(g.sa&&(botMaintain()||botShield()||botPropose()||botPair()))return;return rollAnim(g.k=='snl'?sRoll:roll)}
    if(g.st!='move')return;
    if(g.sa&&botAlly())return;
    {const k=g.turn;apply(botPick(k));if(g.sa&&/captured/.test(g.msg)&&Math.random()<.4)showRx(k,Math.random()<.5?'😈':'😂');sync()}
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
    if(yi>=0){bg=C[yi];d.className='yc'}
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
      if(g.sa&&ctx.shp){if(k==g.turn&&canAct()&&shieldable(k,i)){human();activateShield(k,i)}return}
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
    e.style.zIndex=(o.n>>2)==g.turn&&g.st!='done'?4:2;   // the tokens of whoever is playing sit on top of a shared square
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
  if(g.sa&&ctx.shp&&canAct()){[0,1,2,3].filter(i=>shieldable(g.turn,i)).forEach(i=>els[g.turn*4+i].classList.add('go'));return}
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
  if(g.st=='done')t=duoFirst()?'🤝 '+teamName(g.duo[0],g.duo[1])+' win the Duo Victory!':nm(g.win)+' wins! 🏆';
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
$('#create').onclick=async()=>{try{say('ferr');const c=await mp.createRoom(maxFor(),myAv(),S.ogame);if(S.ogame=='ally')mp.setRoom(c,{vm:S.vmode}).catch(()=>{});watch(c)}catch(e){say('ferr',fe(e))}};
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
    $('#lgame').textContent=GN[d.game||'ludo']+(d.game=='ally'?(d.vm=='duo'?' · 🤝 Duo Victory (Red+Yellow vs Green+Blue)':' · 🏁 Solo Victory'):'');
    $('#start').hidden=!(host&&d.players.length>=need);
    $('#lmsg').textContent=d.players.length+' of '+d.max+' joined'+(d.players.length<need?' · needs '+need+' to start':host?'':' · waiting for the host to start');
  }else{
    if(pending)return;
    if(d.g.k=='duel'){
      if(!ctx.playing){ctx.playing=1;duel.start(denvOnline(d.g))}else duel.remote(d.g.s);
      return;
    }
    if(ctx.playing&&g&&(d.g.v||0)<=(g.v||0)){takeRx(d);return}      // same state again (for example only a reaction arrived)
    g=d.g;
    if(g.sa)injectAlly();
    if(!ctx.playing){ctx.playing=1;enter();if(g.sa)startAllyOnline()}
    else{if(g.sa){checkAllyEnd();pactTick();persistAlly()}draw()}
    takeRx(d);
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
  if(game=='ally'){g.sa=1;g.vm=S.vmode=='duo'?'duo':'solo';g.gid=Date.now();g.gfrom=null;g.dn=[];g.sh=P.map(()=>({s:'a'}));injectAlly()}
  const pub={...g};delete pub.al;delete pub.cd;delete pub.cr;delete pub.pm;
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
  const duoWin=g.k=='ludo'&&duoFirst();
  $('#result .rtitle').textContent=duoWin?'🤝 Duo Victory!':'Congratulations!';
  const ord=g.k=='ludo'?g.order.slice():[g.win,...g.P.map((_,j)=>j).filter(j=>j!=g.win).sort((a,b)=>((g.forf||[]).includes(a)-(g.forf||[]).includes(b))||g.pos[b]-g.pos[a])];
  // a duo team is shown as one row, with both names
  const items=[];
  for(let i=0;i<ord.length;i++){
    const k=ord[i];
    const fo2=x=>(g.forf||[]).includes(x);
    if((g.duo&&k==g.duo[0]&&ord[i+1]==g.duo[1])||(g.vm=='duo'&&g.k=='ludo'&&ord[i+1]==(k+2)%4&&!fo2(k)&&!fo2(ord[i+1]))){items.push({ks:[k,ord[i+1]],duo:1});i++}
    else items.push({ks:[k]});
  }
  const list=$('#rlist');list.innerHTML='';
  items.forEach((it,i)=>{
    const k=it.ks[0],fo=(g.forf||[]).includes(k),last=(i==items.length-1&&items.length>1)||fo;
    const row=document.createElement('div');row.className='rrow r'+i;
    const ic=document.createElement('span');ic.className='ric';
    if(last)ic.textContent='👎';else{ic.textContent='👑';const b=document.createElement('b');b.textContent=i+1;ic.append(b)}
    const av=document.createElement('span');av.className='rav';av.textContent=it.duo?'🤝':(g.avs&&g.avs[k])||'🙂';
    const nmEl=document.createElement('span');nmEl.className='nm';nmEl.textContent=it.duo?teamName(it.ks[0],it.ks[1])+' ('+it.ks.map(nm).join(' & ')+')':it.ks.map(nm).join(' & ');
    const tag=document.createElement('span');tag.textContent=fo?'Forfeited':it.duo?(i==0?'Duo Victory':'Duo · #'+(i+1)):i==0?'Winner':last?'Loser':'#'+(i+1);
    row.append(ic,av,nmEl,tag);list.append(row);
  });
  const cf=$('#confetti');cf.innerHTML='';
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)
    for(let i=0;i<(duoWin?48:26);i++){const s=document.createElement('span');s.textContent=(duoWin?['🤝','🎉','✨','🏆','🎊']:['🎉','✨','⭐','🎊'])[i%(duoWin?5:4)];
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
  if(!$('#areq').hidden){closeAreq();return}
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
  if(g.st=='roll')roll(dice());
  if(g.st=='move'&&g.turn==k){apply(botPick(k));sync()}
  if(!g.msg)g.msg=nm(k)+' was away: played automatically';
  sync();
}
function forfeit(k){
  g.forf=(g.forf||[]).concat(k);g.idle[k]=0;if(g.sa){unally(k);checkAllyEnd()}g.msg=nm(k)+' forfeited (away 3 turns)';
  const left=g.P.map((_,j)=>j).filter(j=>!placed(j));
  if(left.length<=1){
    if(g.k=='ludo'){if(left.length)g.order=(g.order||[]).concat(left[0]);g.order=(g.order||[]).concat(g.forf.slice().reverse());g.win=g.order[0]}
    else g.win=left.length?left[0]:g.win;
    g.st='done';
  }else if(g.turn==k){const b=g.gfrom!=null?g.gfrom:k;g.gfrom=null;g.turn=nxt(b);g.st='roll';g.sixes=0}
  sync();
}

/* ---------- splash ---------- */
setTimeout(()=>{const s=$('#splash');if(s){s.classList.add('hide');setTimeout(()=>s.remove(),600)}},1400);

/* ---------- Ludo Duel ---------- */
const denv=()=>({sfx,tone,AVS,myAv,show,home,ask,mode:S.dmode,myName:()=>(mp.me()||{}).name||'',muted:()=>muted});
$('#dplay').onclick=()=>duel&&duel.start(denv());
$('#dmute').onclick=()=>{$('#mute').click();$('#dmute').textContent=muted?'🔇':'🔊'};


/* ---------- Ludo: Secret Ally ---------- */
const ALLY_CFG={turns:[12,20,32],defTurns:20,reqMs:30000,renewAt:6};   // pact length in game turns (one turn = one dice roll), request timeout, renew window
const duoFirst=()=>!!(g.duo&&g.order&&g.order[0]==g.duo[0]&&g.order[1]==g.duo[1]);
const termsText=t=>(t.m=='t'?'⏳ Temporary · '+t.d+' turns':'♾ Continuous')+' · '+(t.vm=='duo'?'🤝 Duo Victory':'🏁 Solo Victory');
$('#aplay').onclick=()=>{
  const P=SEATS[4],bot=S.amode=='bot';ctx={mode:S.amode};
  g={k:'ludo',sa:1,gid:Date.now(),P,names:P.map((p,k)=>bot?(k?'Computer '+(k+1):'You'):N[p]),t:Array(16).fill(-1),turn:0,roll:0,st:'roll',msg:'',vm:S.vmode=='duo'?'duo':'solo',
     al:[-1,-1,-1,-1],cd:[0,0,0,0],cr:[0,0,0,0],pm:[null,null,null,null],gfrom:null,idle:[0,0,0,0],forf:[],order:[],dn:[],
     sh:[0,1,2,3].map(()=>({s:'a'}))};
  g.avs=P.map((p,k)=>bot?(k?AVS.filter(a=>a!=myAv())[(k*5+3)%15]:myAv()):AVS[p*4]);
  // the computers sometimes team up between themselves, in secret
  if(g.vm=='duo')duoTeams(g);
  else if(bot&&Math.random()<.65){const b=[1,2,3].sort(()=>Math.random()-.5);pact(b[0],b[1],botTerms())}
  enter();
  setTimeout(()=>{if(g&&g.sa)toast(g.vm=='duo'?'🤝 '+teamName(0,2)+' (Red + Yellow) vs '+teamName(1,3)+' (Green + Blue)':'Tip: tap 🤝 Ask for ally before you roll. 🛡 Shield protects one token for a turn.')},700);
};
const botTerms=()=>({m:Math.random()<.5?'t':'c',vm:'solo',d:ALLY_CFG.defTurns});
// every team gets a random name (the same on every phone: it comes from the game id)
const TN=['Thunder Twins','Royal Rockets','Dragon Duo','Ninja Knights','Fire Foxes','Storm Riders','Tiger Titans','Cosmic Crew','Lightning Lions','Shadow Hawks','Mighty Mambas','Golden Eagles'];
const hsh=s=>{let h=7;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h};
function teamName(a,b){
  const lo=Math.min(a,b),hi=Math.max(a,b),id=(g&&g.gid)||0;
  if(g&&g.vm=='duo'){const i=hsh(id)%TN.length,j=(i+1+hsh(id+'x')%(TN.length-1))%TN.length;return TN[lo==0?i:j]}
  return TN[(hsh(id)+lo*5+hi*11)%TN.length];
}
// Duo Victory: fixed teams on opposite corners (Red+Yellow, Green+Blue), set up for everybody and never broken
function duoTeams(o){
  const pr=[[0,2],[1,3]];
  pr.forEach(([a,b])=>{const pm={m:'c',vm:'duo',d:0,exp:0,rn:{},fixed:1};o.al[a]=b;o.al[b]=a;o.pm[a]=o.pm[b]=pm});
}
const isDuo=()=>!!(g&&g.vm=='duo');
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
// news for the two allies: shown at once to the one who is looking, or on their next turn in Pass N Play
function note(pair,msg){
  if(ctx.mode=='pass'){(ctx.notes=ctx.notes||[]).push({pair,msg});return}
  if(pair.includes(viewer()))toast(msg);
}

/* ----- pacts ----- */
function pact(a,b,t){
  const pm={m:t.m,vm:t.vm,d:t.d,exp:(g.rc||0)+(t.d||0),rn:{}};
  g.al[a]=b;g.al[b]=a;g.cr[a]=g.cr[b]=0;g.pm[a]=g.pm[b]=pm;
}
function unally(k){
  if(!(g.al&&g.al[k]>=0))return;
  const j=g.al[k];
  g.al[k]=-1;g.al[j]=-1;g.cr[k]=g.cr[j]=0;g.pm[k]=g.pm[j]=null;
  [k,j].forEach(x=>{if((g.dn||[]).includes(x)){g.dn=g.dn.filter(y=>y!=x);if(!placed(x))g.order.push(x)}});   // a duo partner that was waiting gets their place now
}
// ends a pact on purpose (or by expiry) and tells both allies
function breakPact(k,why){
  const j=g.al[k];if(j<0)return;
  unally(k);
  const left=g.P.map((_,x)=>x).filter(x=>!placed(x));
  if(g.st!='done'&&left.length<=1)finishAll();
  note([k,j],why=='expired'?'⏳ Your alliance has expired':why=='mine'?'💔 The alliance was ended':'💔 Your ally ended the alliance');
}
// temporary pacts run out by themselves
function pactTick(){
  if(!g||!g.sa||!g.pm)return;
  const seen=new Set();
  g.P.forEach((_,k)=>{
    const pm=g.pm[k];if(!pm||g.al[k]<0||seen.has(pm))return;seen.add(pm);
    if(pm.m=='t'&&pm.exp-(g.rc||0)<=0)breakPact(k,'expired');
  });
}
// a pact ends when one ally is out; a solo pact also ends when only the two allies are left
function checkAllyEnd(){
  g.P.forEach((_,k)=>{if(g.al[k]>=0&&placed(k))unally(k)});
  const left=g.P.map((_,j)=>j).filter(j=>!placed(j));
  if(left.length==2&&g.al[left[0]]===left[1]&&g.pm[left[0]]&&g.pm[left[0]].vm=='solo'){unally(left[0]);return true}
  return false;
}
// renew a temporary pact: both allies have to agree before it runs out
function renewPact(k){
  const j=g.al[k],pm=g.pm[k];if(j<0||!pm||pm.m!='t')return;
  pm.rn[k]=pm.exp;
  if(ctx.mode=='bot'&&j>0){if(Math.random()<.8)pm.rn[j]=pm.exp;else toast(nm(j)+' does not want to renew')}
  if(ctx.mode=='online'){
    const me=g.uids[k],f={rnw:{[me]:pm.exp}};
    mp.setAlly(ctx.code,me,f).catch(()=>{});mp.setAlly(ctx.code,g.uids[j],f).catch(()=>{});
  }
  renewCheck(k);
  top();
}
function renewCheck(k){
  const j=g.al[k],pm=g.pm[k];
  if(j>=0&&pm&&pm.rn[k]===pm.exp&&pm.rn[j]===pm.exp){pm.exp+=pm.d;pm.rn={};note([k,j],'🔄 Alliance renewed for '+pm.d+' more turns');if(ctx.mode=='online')persistAlly()}
}
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
  g.sixes=0;g.gfrom=k;g.turn=j;ctx.betray=0;ctx.shp=0;
  g.msg=nm(j)+' uses a gifted '+r;
  if(ctx.mode=='bot'&&m.length==1){apply(m[0]);return sync()}
  g.st='move';
  if(ctx.mode=='pass'&&!isDuo()){
    ctx.hold=1;sync();
    cover(nm(j),'Your secret ally gave you a '+r+'. You must use it.',()=>{ctx.hold=0;top()});
  }else sync();
}

/* ----- one-time immunity shield ----- */
const shieldable=(p,i)=>{const t=g.t[p*4+i];return t>=0&&t<=50&&!SAFE.includes((START[g.P[p]]+t)%52)};
function shielded(j,x,k){const s=g.sh&&g.sh[j];return !!(s&&s.s=='x'&&s.tok==x&&s.for==k&&g.turn==k)}
// the shield can only be raised on your own turn, so always before the opponent it is meant for has rolled
function canShield(p){
  const s=g.sh&&g.sh[p];
  return !!(g.sa&&s&&s.s=='a'&&g.turn==p&&(g.st=='roll'||g.st=='move')&&!out(p)&&nxt(p)!=p&&[0,1,2,3].some(i=>shieldable(p,i)));
}
function activateShield(p,i){
  if(!canShield(p)||!shieldable(p,i))return false;
  g.sh[p]={s:'x',tok:i,for:nxt(p),seen:0};
  ctx.shp=0;g.msg='🛡 '+nm(p)+' raised a shield';
  sfx.start();sync();return true;
}
// the shield ends when the protected opponent's turn is over
function shTick(){
  if(!g.sh)return;
  g.sh.forEach(s=>{
    if(s.s!='x')return;
    if(g.turn==s.for)s.seen=1;
    else if(s.seen||placed(s.for))s.s='u';
  });
}
function botShield(){
  const k=g.turn;if(!canShield(k)||Math.random()>.6)return false;
  const c=[0,1,2,3].filter(i=>shieldable(k,i)&&endangered(k,i)).sort((a,b)=>g.t[k*4+b]-g.t[k*4+a]);
  if(!c.length)return false;
  activateShield(k,c[0]);return true;
}

/* ----- danger warning: an opponent could cut this token with one roll of 1-6 ----- */
function endangered(j,i){
  const t=g.t[j*4+i];if(t<0||t>50)return false;
  const a=(START[g.P[j]]+t)%52;if(SAFE.includes(a))return false;
  const s=g.sh&&g.sh[j];if(s&&s.s=='x'&&s.tok==i)return false;      // shielded
  for(let q=0;q<g.P.length;q++){
    if(q==j||g.al[j]===q||placed(q)||(g.dn||[]).includes(q))continue;   // never a danger: yourself, your ally, players that are done
    for(let x=0;x<4;x++){
      const u=g.t[q*4+x];if(u<0||u>50)continue;
      for(let d=1;d<=6;d++)if(u+d<=50&&(START[g.P[q]]+u+d)%52==a)return true;
    }
  }
  return false;
}

/* ----- asking for an ally ----- */
function reqAlly(t){
  if(!g||!g.sa||g.st=='done'||ctx.hold||isDuo())return;
  const k=g.turn;
  if(t===k)return;
  if(ctx.mode=='bot'&&k!==0)return;
  if(ctx.mode=='online'&&k!==myIdx())return;
  if(!canAct()||g.st!='roll')return toast('Ask for an ally at the start of your turn, before you roll');
  if(t==null||t<0||t>=g.P.length)return;
  if(out(t))return toast(nm(t)+' is already out');
  if(g.al[k]>=0)return toast('You already have a secret ally');
  if(ctx.preq)return toast('You already have a request waiting');
  if(g.cd[k]>0)return toast('No new alliance for your next '+g.cd[k]+' roll'+(g.cd[k]>1?'s':''));
  openAreq(k,t);
}
let rq=null;
function openAreq(k,t){
  ctx.hold=1;clearTimer();
  rq={m:'t',d:ALLY_CFG.defTurns,vm:'solo'};
  $('#areqt').textContent='Ask '+nm(t)+' to team up in secret. Allies never cut each other.';
  const paint=()=>{
    $$('#areq .sg').forEach(sg=>[...sg.children].forEach(b=>b.classList.toggle('on',String(rq[sg.dataset.k])==b.dataset.v)));
    $('#areq-d').hidden=rq.m!='t';
  };
  $$('#areq .sg').forEach(sg=>sg.onclick=e=>{const b=e.target.closest('button');if(!b)return;rq[sg.dataset.k]=sg.dataset.k=='d'?+b.dataset.v:b.dataset.v;paint()});
  paint();
  $('#areq').hidden=false;
  $('#areqs').onclick=()=>{const terms={...rq};$('#areq').hidden=true;sendReq(k,t,terms)};
  $('#areqx').onclick=closeAreq;
}
function closeAreq(){$('#areq').hidden=true;if(!ctx.hold)return;ctx.hold=0;ctx.mode=='online'?top():sync()}
function sendReq(k,t,terms){
  const my=ctx;
  if(ctx.mode=='bot'){
    ctx.preq={t};toast('Request sent to '+nm(t)+'…');
    setTimeout(()=>{
      if(ctx!==my||!g)return;
      ctx.preq=null;
      if(!out(t)&&g.al[t]<0&&g.cd[t]==0&&g.al[k]<0&&Math.random()<.6){pact(k,t,terms);toast('🤝 '+nm(t)+' accepted: '+termsText(terms));sfx.start()}
      else toast(nm(t)+' declined');
      ctx.hold=0;sync();
    },1100);
  }else if(ctx.mode=='online'){
    const ts=Date.now();
    mp.setAlly(ctx.code,g.uids[t],{req:{from:g.uids[k],fromName:nm(k),ts,m:terms.m,vm:terms.vm,d:terms.d}}).catch(e=>toast(fe(e)));
    ctx.preq={t,ts};
    ctx.preqT=setTimeout(()=>{      // nobody answered: the request runs out
      if(ctx!==my||!ctx.preq||ctx.preq.ts!==ts)return;
      ctx.preq=null;toast('Your request to '+nm(t)+' expired');
      mp.setAlly(ctx.code,g.uids[t],{req:null}).catch(()=>{});
    },ALLY_CFG.reqMs);
    toast('Request sent to '+nm(t)+'. Only they can see it.');
    ctx.hold=0;top();
  }else{
    // pass n play: the phone goes to the other player, who answers in private, and comes back
    if(out(t)||g.al[t]>=0||g.cd[t]>0){toast(nm(t)+' cannot ally right now');ctx.hold=0;return sync()}
    cover(nm(t),'A private request is waiting for you',()=>{
      const done=ok=>{
        if(ok){pact(k,t,terms);sfx.start()}
        cover(nm(k),'Hand the phone back to continue your turn',()=>{
          toast(ok?'🤝 '+nm(t)+' accepted: '+termsText(terms):nm(t)+' declined');
          ctx.hold=0;sync();
        });
      };
      askAB(nm(k)+' asks for a secret alliance',termsText(terms),'Accept','Decline',()=>done(true),()=>done(false));
    });
  }
}
// a computer sometimes asks you
function botPropose(){
  const k=g.turn;
  if(isDuo()||ctx.mode!='bot'||g.al[k]>=0||g.cd[k]>0||g.al[0]>=0||g.cd[0]>0||out(0)||out(k)||(g.rc||0)<4||Math.random()>.12)return false;
  ctx.hold=1;const terms=botTerms();
  askAB('🤝 '+nm(k)+' sends you a Secret Alliance Request',termsText(terms),'Accept','Decline',
    ()=>{pact(k,0,terms);ctx.hold=0;toast('🤝 Secret pact formed with '+nm(k)+' · team '+teamName(k,0));sync();sfx.start()},()=>{ctx.hold=0;sync()});
  return true;
}
// in Solo Victory the computers also team up with each other, in secret
function botPair(){
  const k=g.turn;
  if(isDuo()||ctx.mode!='bot'||k==0||g.al[k]>=0||g.cd[k]>0||(g.rc||0)<4||Math.random()>.07)return false;
  const c=[1,2,3].filter(t=>t!=k&&!out(t)&&g.al[t]<0&&g.cd[t]==0);
  if(c.length)pact(k,c[Math.random()*c.length|0],botTerms());
  return false;
}
// computers renew their own pacts, most of the time
function botMaintain(){
  const seen=new Set();
  g.P.forEach((_,k)=>{
    const pm=g.pm[k],j=g.al[k];
    if(!pm||j<0||seen.has(pm))return;seen.add(pm);
    if(k>0&&j>0&&pm.m=='t'&&pm.exp-(g.rc||0)<=2&&!pm.bd){pm.bd=1;if(Math.random()<.7){pm.exp+=pm.d;pm.bd=0}}
  });
  return false;
}
// the computer's use of gifts and betrayal
function botAlly(){
  const k=g.turn,j=g.al[k],r=g.roll;
  if(j<0||g.gfrom!=null)return false;
  if(g.cr[k]>0&&!isDuo()){
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

/* ----- indicators and buttons ----- */
function allyUI(){
  if(!g||!g.sa)return;
  requestAnimationFrame(fitBoard);
  const v=viewer(),pv=g.st=='done'?-1:g.al[v],pmv=pv>=0?g.pm[v]:null;
  // pass n play: news for whoever is looking now
  if(ctx.mode=='pass'&&ctx.notes&&ctx.notes.length&&!ctx.hold){
    const m=ctx.notes.filter(x=>x.pair.includes(v));ctx.notes=ctx.notes.filter(x=>!x.pair.includes(v));
    if(m.length)toast(m[m.length-1].msg);
  }
  g.P.forEach((c,k)=>{
    const card=cards[c];if(!card)return;
    const b=card.querySelector('.abadge'),inf=card.querySelector('.ainfo'),sh=g.sh[k];
    const mine=isDuo()?g.al[k]>=0:pv>=0&&(k==v||k==pv);
    if(b){b.hidden=!mine;if(mine)b.title=isDuo()?'Team mate':'Secret ally'}
    if(inf){
      let tx='';
      if(isDuo()){const j=g.al[k];if(j>=0)tx=(g.dn||[]).includes(k)?'✔ Home · waiting':'🤝 '+teamName(k,j)}
      else if(mine&&pmv){
        tx='🤝 '+teamName(k,g.al[k])+' · '+(pmv.m=='t'?'⏳'+Math.max(0,pmv.exp-(g.rc||0)):'♾');
        if((g.dn||[]).includes(k))tx='✔ Home · waiting for ally';
      }
      inf.textContent=tx;
    }
    const ss=card.querySelector('.shs');
    if(ss)ss.textContent=sh.s=='a'?'🛡 Available':sh.s=='x'?'🛡 Active':'🛡 Used';
  });
  // glow around allied, shielded and endangered tokens
  els.forEach((e,n)=>{
    const k=n>>2,i=n&3,sh=g.sh[k];
    e.classList.toggle('alt',pv>=0&&(k==v||k==pv));
    e.classList.toggle('shd',sh.s=='x'&&sh.tok==i);
    e.classList.toggle('dg',k==v&&g.st!='done'&&endangered(k,i));
  });
  const bar=$('#aact');bar.innerHTML='';
  const k=g.turn;
  if(g.st=='done'||v!==k||!canAct()||ctx.hold)return;
  const add=(t,f,dis)=>{const b=document.createElement('button');b.className='btn';b.textContent=t;b.onclick=f;if(dis)b.disabled=true;bar.append(b)};
  if(ctx.shp)return add('✖ Cancel shield',()=>{ctx.shp=0;mark();allyUI()}),toast('Tap the token to protect');
  const shield=()=>{if(canShield(k))add('🛡 Shield',()=>{ctx.shp=1;ctx.picking=0;mark();allyUI()})};
  // before the roll: ask somebody to be your secret ally, renew or end your pact, raise the shield
  if(g.st=='roll'){
    if(isDuo())return shield();
    if(g.al[k]>=0){
      const pm=g.pm[k];
      if(pm&&pm.m=='t'&&pm.exp-(g.rc||0)<=ALLY_CFG.renewAt){
        if(pm.rn[k]===pm.exp)add('🔄 Renew sent',null,true);else add('🔄 Renew',()=>renewPact(k));
      }
      add('💔 End pact',()=>{ctx.hold=1;clearTimer();askAB('End the alliance?',nm(g.al[k])+' will be told.','End pact','Keep',()=>{breakPact(k,'mine');ctx.hold=0;sync()},()=>{ctx.hold=0;top()})});
      return shield();
    }
    if(g.cd[k]>0)add('🤝 Ask for ally in '+g.cd[k]+' roll'+(g.cd[k]>1?'s':''),null,true);
    else{
      const cand=g.P.map((_,t)=>t).filter(t=>t!=k&&!out(t));
      if(cand.length){
        if(!ctx.picking)add('🤝 Ask for ally',()=>{ctx.picking=1;allyUI()});
        else{cand.forEach(t=>add('🤝 '+nm(t),()=>{ctx.picking=0;reqAlly(t)}));return add('✖',()=>{ctx.picking=0;allyUI()})}
      }
    }
    return shield();
  }
  // after the roll: give the number to your ally, or cut them
  if(g.st!='move')return;
  if(g.al[k]>=0&&g.gfrom==null){
    const j=g.al[k],r=g.roll;
    if(!ctx.betray){
      if(!out(j)&&movable(j,r).length)add('🎁 Give this '+r+' to ally',()=>{human();gift()});
      else add('🎁 Ally cannot use a '+r,null,true);
    }
    if(!isDuo()&&g.cr[k]>0&&movable(k,r).some(i=>cutsAlly(k,i)))
      add(ctx.betray?'✖ Cancel':'💔 Break Alliance & Cut',()=>{ctx.betray=ctx.betray?0:1;mark();allyUI();if(ctx.betray)toast('Tap the glowing token to cut your ally')});
  }
  if(!ctx.betray)shield();
}

/* ----- quick reactions ----- */
const RX=['🤝','😂','😈','🛡️','👏'];
function showRx(idx,e){
  const c=g&&cards[g.P[idx]];if(!c)return;
  const x=document.createElement('span');x.className='rx';x.textContent=e;c.append(x);
  setTimeout(()=>x.remove(),3200);
}
function sendRx(e){
  if(!g||!g.sa||!RX.includes(e))return;
  const now=Date.now();if(ctx.rxT&&now-ctx.rxT<1500)return;ctx.rxT=now;     // not too often
  const me=ctx.mode=='online'?myIdx():ctx.mode=='bot'?0:g.turn;
  showRx(me,e);
  if(ctx.mode=='online')mp.setRoom(ctx.code,{['rx.'+g.uids[me]]:{e,ts:now}}).catch(()=>{});
  $('#rxbar').hidden=true;
}
RX.forEach(e=>{const b=document.createElement('button');b.textContent=e;b.setAttribute('aria-label','Reaction '+e);b.onclick=()=>sendRx(e);$('#rxbar').append(b)});
$('#rxbtn').onclick=()=>{$('#rxbar').hidden=!$('#rxbar').hidden};
// reactions from the other players, seen in real time
function takeRx(d){
  if(!g||!g.sa||!d.rx)return;
  const me=(mp.me()||{}).uid;ctx.rxSeen=ctx.rxSeen||{};
  for(const uid in d.rx){
    const r=d.rx[uid];if(uid==me||!r||r.ts<=(ctx.rxSeen[uid]||0))continue;
    ctx.rxSeen[uid]=r.ts;
    if(Date.now()-r.ts<8000){const i=g.uids.indexOf(uid);if(i>=0)showRx(i,r.e)}
  }
}

/* ----- Secret Ally online: each player keeps their own pact in a private document ----- */
function injectAlly(){
  if(!ctx.al){ctx.al=[-1,-1,-1,-1];ctx.cd=[0,0,0,0];ctx.cr=[0,0,0,0];ctx.pm=[null,null,null,null];if(g.vm=='duo')duoTeams(ctx)}
  g.al=ctx.al;g.cd=ctx.cd;g.cr=ctx.cr;g.pm=ctx.pm;
}
function startAllyOnline(){
  ctx.unsubA=mp.watchAlly(ctx.code,onAlly);
}
const pmDoc=pm=>pm?{m:pm.m,vm:pm.vm,d:pm.d,exp:pm.exp}:null;
function persistAlly(){
  if(ctx.mode!='online'||!g||!g.sa||g.vm=='duo'||!ctx.al||!ctx.alInit)return;
  const me=myIdx();if(me<0)return;
  const j=ctx.al[me],pm=ctx.pm[me],key=j+'|'+ctx.cd[me]+'|'+ctx.cr[me]+'|'+(pm?pm.exp+pm.m+pm.vm:'');
  if(ctx.akey===key)return;
  const was=ctx.apart==null?-1:ctx.apart,uid=g.uids[me];
  ctx.akey=key;ctx.apart=j;
  mp.setAlly(ctx.code,uid,{gid:g.gid,pact:j>=0?g.uids[j]:null,pm:pmDoc(pm),cd:ctx.cd[me],cr:ctx.cr[me]}).catch(()=>{});
  if(was>=0&&was!==j)mp.setAlly(ctx.code,g.uids[was],{pact:null,pm:null}).catch(()=>{});
  if(j>=0&&was!==j)mp.setAlly(ctx.code,g.uids[j],{gid:g.gid,pact:uid,pm:pmDoc(pm),cr:0}).catch(()=>{});
}
function onAlly(d,pending){
  if(!g||!g.sa||g.vm=='duo'||ctx.mode!='online'||pending)return;
  const me=myIdx();if(me<0)return;
  if(!ctx.alInit){
    ctx.alInit=1;
    if(d.gid!==g.gid){      // a new game: start clean. The same game after a reconnect keeps its pact
      d={gid:g.gid,pact:null,pm:null,cd:0,cr:0,req:null,resp:null};
      mp.setAlly(ctx.code,g.uids[me],d).catch(()=>{});
    }
    ctx.cd[me]=d.cd||0;ctx.cr[me]=d.cr||0;
  }
  const j=d.pact?g.uids.indexOf(d.pact):-1;
  if(j!==ctx.al[me]){
    const was=ctx.al[me];
    if(was>=0){ctx.al[was]=-1;ctx.pm[was]=null}
    ctx.al[me]=-1;ctx.pm[me]=null;
    if(j>=0){
      const pm={...d.pm,rn:{}};
      ctx.al[me]=j;ctx.al[j]=me;ctx.pm[me]=ctx.pm[j]=pm;ctx.cr[me]=d.cr||0;
      if(ctx.preq){clearTimeout(ctx.preqT);ctx.preq=null}
      if(ctx.alInit>1)toast('🤝 Team '+teamName(me,g.al[me])+' formed: '+termsText(pm));
      sfx.start();
    }else if(was>=0&&ctx.alInit>1)toast('💔 Your alliance has ended');
    ctx.apart=j;ctx.akey=j+'|'+ctx.cd[me]+'|'+ctx.cr[me]+'|'+(ctx.pm[me]?ctx.pm[me].exp+ctx.pm[me].m+ctx.pm[me].vm:'');
  }
  ctx.alInit=2;
  const pm=ctx.pm[me];
  if(pm&&d.rnw){for(const uid in d.rnw){const i=g.uids.indexOf(uid);if(i>=0)pm.rn[i]=d.rnw[uid]}renewCheck(me)}
  if(d.resp&&d.resp.ts!==ctx.lastResp){
    ctx.lastResp=d.resp.ts;
    if(!d.resp.ok){if(ctx.preq){clearTimeout(ctx.preqT);ctx.preq=null}toast(d.resp.name+' declined')}
  }
  if(d.req&&d.req.ts!==ctx.lastReq){ctx.lastReq=d.req.ts;if(Date.now()-d.req.ts<ALLY_CFG.reqMs)showAllyReq(d.req)}
  top();
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
  const left=ALLY_CFG.reqMs-(Date.now()-req.ts);
  ctx.expiredReq=0;
  const timer=setTimeout(()=>{if(!$('#dlg').hidden&&ctx.curReq===req.ts){ctx.expiredReq=1;closeDlg()}},Math.max(0,left));
  ctx.curReq=req.ts;
  const terms={m:req.m,vm:req.vm,d:req.d};
  askAB('🤝 '+nm(from)+' sends you a Secret Alliance Request',termsText(terms)+'. Both of you must agree. It runs out in '+Math.ceil(left/1000)+'s.','Accept','Decline',
    ()=>{clearTimeout(timer);ctx.curReq=0;pact(me,from,terms);persistAlly();reply(true);toast('🤝 Team '+teamName(me,from)+' formed: '+termsText(terms));sfx.start();top()},
    ()=>{clearTimeout(timer);ctx.curReq=0;if(ctx.expiredReq){ctx.expiredReq=0;mp.setAlly(ctx.code,g.uids[me],{req:null}).catch(()=>{});return}reply(false)});
}
