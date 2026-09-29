import * as mp from './multiplayer.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],F='⚀⚁⚂⚃⚄⚅';
const C=['#e8262a','#1fa03a','#ffd60a','#1e90ff'],N=['Red','Green','Yellow','Blue'];
const SEATS={2:[0,2],3:[0,1,2],4:[0,1,2,3]};
const S={game:'ludo',mode:'bot',np:2,max:2};
let g=null,ctx={},els=[];

const show=id=>$$('.sc').forEach(s=>s.hidden=s.id!=id);
const say=(id,m)=>$('#'+id).textContent=m||'';
const nm=k=>g.names[k];
const fe=e=>({'auth/email-already-in-use':'That username is taken','auth/invalid-credential':'Wrong username or password','auth/user-not-found':'Wrong username or password','auth/wrong-password':'Wrong username or password','auth/operation-not-allowed':'Turn on Email/Password sign-in in Firebase','auth/network-request-failed':'No connection'}[e.code]||e.message||String(e));

/* ---------- menu ---------- */
function markSeg(){$$('.seg').forEach(sg=>[...sg.children].forEach(b=>b.classList.toggle('on',String(S[sg.dataset.k])==b.dataset.v)))}
$$('.seg').forEach(sg=>sg.onclick=e=>{const b=e.target.closest('button');if(!b)return;S[sg.dataset.k]=isNaN(b.dataset.v)?b.dataset.v:+b.dataset.v;markSeg()});
markSeg();
function renderMe(){
  const u=mp.me(),m=$('#me');m.innerHTML='';
  const b=document.createElement('button');b.className='btn';
  if(u){m.append('👤 '+u.name+' ');b.textContent='Log out';b.onclick=async()=>{await mp.logout();renderMe()}}
  else{b.textContent='Sign in';b.onclick=()=>show('auth')}
  m.append(b);
}
mp.onUser(renderMe);
function leave(){
  clearTimeout(ctx.bt);ctx.unsubR&&ctx.unsubR();ctx.unsubC&&ctx.unsubC();
  ctx={};g=null;$('#chat').hidden=true;$('#chatbtn').hidden=true;
}
function home(){leave();show('home');renderMe()}
$$('[data-back]').forEach(b=>b.onclick=home);
$$('[data-go]').forEach(b=>b.onclick=()=>{
  const v=b.dataset.go;
  if(v=='friends')return show(mp.me()?'friends':'auth');
  S.game=v=='snl'?'snl':'ludo';S.mode=v=='snl'?'pass':v;markSeg();show('setup');
});
async function doAuth(create){
  const u=$('#u').value.trim(),p=$('#p').value;
  if(!/^[A-Za-z0-9_]{3,14}$/.test(u))return say('aerr','Username: 3-14 letters, numbers or _');
  if(p.length<6)return say('aerr','Password needs 6 or more characters');
  try{create?await mp.signUp(u,p):await mp.signIn(u,p);say('aerr');renderMe();show('friends')}catch(e){say('aerr',fe(e))}
}
$('#signin').onclick=()=>doAuth(false);
$('#signup').onclick=()=>doAuth(true);

/* ---------- start games ---------- */
$('#play').onclick=()=>{
  const P=SEATS[S.np];ctx={mode:S.mode};
  const names=P.map((p,k)=>S.mode=='bot'?(k?'Computer '+(k+1):'You'):N[p]);
  g=S.game=='ludo'
    ?{k:'ludo',P,names,t:Array(P.length*4).fill(-1),turn:0,roll:0,st:'roll',msg:''}
    :{k:'snl',P,names,pos:P.map(()=>1),turn:0,roll:0,st:'roll',msg:''};
  enter();
};
function enter(){show('game');$('#chatbtn').hidden=ctx.mode!='online';build();draw();botCheck()}

/* ---------- ludo engine ---------- */
const PATH=[[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
const START=[0,13,26,39],SAFE=[0,8,13,21,26,34,39,47];
const HC=[[1,2,3,4,5].map(i=>[7,i]),[1,2,3,4,5].map(i=>[i,7]),[13,12,11,10,9].map(i=>[7,i]),[13,12,11,10,9].map(i=>[i,7])];
const FIN=[[7,6],[6,7],[7,8],[8,7]],Y0=[[0,0],[0,9],[9,9],[9,0]];

const can=(k,i,r)=>{const t=g.t[k*4+i];return t<0?r==6:t+r<=56};
const movable=(k,r)=>[0,1,2,3].filter(i=>can(k,i,r));
function hits(k,n){
  const a=(START[g.P[k]]+n)%52,h=[];
  if(n>50||SAFE.includes(a))return h;
  g.P.forEach((q,j)=>{if(j!=k)for(let x=0;x<4;x++){const t=g.t[j*4+x];if(t>=0&&t<=50&&(START[q]+t)%52==a)h.push(j*4+x)}});
  return h;
}
function roll(r){
  if(!g||g.st!='roll')return;
  const k=g.turn,m=movable(k,r);g.roll=r;g.msg='';
  if(!m.length){g.msg=nm(k)+' rolled '+r+': no move';g.turn=(k+1)%g.P.length}
  else if(m.length==1)apply(m[0]);
  else g.st='move';
  sync();
}
function apply(i){
  const k=g.turn,r=g.roll,t0=g.t[k*4+i],n=t0<0?0:t0+r;
  g.t[k*4+i]=n;
  const h=hits(k,n);h.forEach(x=>g.t[x]=-1);
  g.msg=h.length?nm(k)+' captured a token!':'';
  if(g.t.slice(k*4,k*4+4).every(t=>t==56)){g.st='done';g.win=k;g.msg='';return}
  if(!(r==6||h.length||n==56))g.turn=(k+1)%g.P.length;
  g.st='roll';
}
function xy(p,rel,i){
  if(rel<0){const o=Y0[p];return[o[1]+3+(i%2?1:-1),o[0]+3+(i>1?1:-1)]}
  const[r,c]=rel<=50?PATH[(START[p]+rel)%52]:rel<=55?HC[p][rel-51]:FIN[p];
  return[c+.5,r+.5];
}

/* ---------- who can act, sync, bots ---------- */
const isBot=()=>ctx.mode=='bot'&&g.turn>0;
const canAct=()=>g&&g.st!='done'&&(ctx.mode=='pass'||(ctx.mode=='bot'?g.turn==0:g.uids[g.turn]==(mp.me()||{}).uid));
function sync(){
  draw();
  if(ctx.mode=='online')mp.setRoom(ctx.code,{g}).catch(e=>say('status',fe(e)));
  botCheck();
}
function rollAnim(cb){
  if(ctx.rolling)return;ctx.rolling=1;let n=0;
  const iv=setInterval(()=>{
    $('#dice').textContent=F[Math.random()*6|0];
    if(++n>7){clearInterval(iv);ctx.rolling=0;cb(1+Math.random()*6|0)}
  },60);
}
$('#dice').onclick=()=>{if(g&&g.st=='roll'&&canAct())rollAnim(g.k=='snl'?sRoll:roll)};
function botCheck(){
  clearTimeout(ctx.bt);
  if(!g||g.st=='done'||!isBot())return;
  ctx.bt=setTimeout(()=>{
    if(!g||!isBot())return;
    if(g.st=='roll')return rollAnim(g.k=='snl'?sRoll:roll);
    if(g.st!='move')return;
    const k=g.turn,sc=i=>{const t=g.t[k*4+i],n=t<0?0:t+g.roll;
      return(n==56?90:0)+hits(k,n).length*60+(t<0?40:0)+(n<51&&SAFE.includes((START[g.P[k]]+n)%52)?15:0)+n/10};
    apply(movable(k,g.roll).sort((a,b)=>sc(b)-sc(a))[0]);sync();
  },800);
}

/* ---------- board building & drawing ---------- */
function build(){g.k=='ludo'?buildLudo():buildSnl()}
function buildLudo(){
  const b=$('#board');b.className='lb';b.innerHTML='';els=[];
  const pi=new Map(PATH.map((p,i)=>[p+'',i]));
  for(let r=0;r<15;r++)for(let c=0;c<15;c++){
    const d=document.createElement('i');let bg='transparent';
    const yi=Y0.findIndex(([a,z])=>r>=a&&r<a+6&&c>=z&&c<z+6);
    if(yi>=0)bg=C[yi];
    else if(pi.has(r+','+c)){
      const ix=pi.get(r+','+c),s=START.indexOf(ix);bg=s>=0?C[s]:'#fff';
      if(s<0&&SAFE.includes(ix))d.textContent='☆';
    }else{const h=HC.findIndex(a=>a.some(([x,y])=>x==r&&y==c));if(h>=0)bg=C[h]}
    d.style.background=bg;b.append(d);
  }
  Y0.forEach((o,yi)=>{
    const y=document.createElement('div');y.className='yard';
    y.style.left=(o[1]+1)/15*100+'%';y.style.top=(o[0]+1)/15*100+'%';
    y.style.background=[[25,25],[75,25],[25,75],[75,75]].map(([x,z])=>`radial-gradient(circle at ${x}% ${z}%,${C[yi]} 0 16%,#0000 17%)`).join(',')+',#fff';
    const k=g.P.indexOf(yi);
    if(k>=0){const l=document.createElement('b');l.textContent=g.names[k];y.append(l)}
    b.append(y);
  });
  const ctr=document.createElement('div');ctr.className='ctr';
  C.forEach((c,i)=>ctr.style.setProperty('--c'+i,c));b.append(ctr);
  els=g.t.map((_,n)=>{
    const e=document.createElement('button');e.className='tok';e.style.setProperty('--c',C[g.P[n>>2]]);
    e.setAttribute('aria-label',nm(n>>2)+' token '+((n&3)+1));
    e.onclick=()=>{
      const k=n>>2,i=n&3;
      if(g.st=='move'&&k==g.turn&&canAct()&&movable(k,g.roll).includes(i)){apply(i);sync()}
    };
    b.append(e);return e;
  });
}
function draw(){
  if(!g)return;
  if(g.k=='snl')return sDraw();
  const cnt={};
  g.t.forEach((rel,n)=>{
    const[x,y]=xy(g.P[n>>2],rel,n&3),key=x+','+y,c=cnt[key]=(cnt[key]||0)+1,o=(c-1)*.2,e=els[n];
    e.style.left=(x+o)/15*100+'%';e.style.top=(y-o)/15*100+'%';e.classList.remove('go');
  });
  if(g.st=='move'&&canAct())movable(g.turn,g.roll).forEach(i=>els[g.turn*4+i].classList.add('go'));
  top();
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
  $('#dice').textContent=g.roll?F[g.roll-1]:'⚀';
  $('#dice').disabled=!(g.st=='roll'&&canAct());
}

/* ---------- snakes & ladders ---------- */
const SN={16:6,47:26,49:11,56:53,62:19,64:60,87:24,93:73,95:75,98:78},LD={1:38,4:14,9:31,21:42,28:84,36:44,51:67,71:91,80:100};
const cell=n=>{const r=Math.floor((n-1)/10),c=r%2?9-(n-1)%10:(n-1)%10;return[c*10+5,(9-r)*10+5]};
function buildSnl(){
  const b=$('#board');b.className='sb';b.innerHTML='';
  for(let row=9;row>=0;row--)for(let col=0;col<10;col++){
    const n=row*10+(row%2?9-col:col)+1,d=document.createElement('i');d.textContent=n;
    d.style.background=(row+col)%2?'#ffe9e9':'#fff7f0';b.append(d);
  }
  let s='<svg viewBox="0 0 100 100">';
  for(const a in LD){
    const[x1,y1]=cell(+a),[x2,y2]=cell(LD[a]),L=Math.hypot(x2-x1,y2-y1),ox=(y2-y1)/L*1.3,oy=-(x2-x1)/L*1.3;
    s+=`<g stroke="#39c6d6" stroke-linecap="round"><line x1="${x1+ox}" y1="${y1+oy}" x2="${x2+ox}" y2="${y2+oy}" stroke-width="1"/><line x1="${x1-ox}" y1="${y1-oy}" x2="${x2-ox}" y2="${y2-oy}" stroke-width="1"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="2.6" stroke-dasharray=".8 2.4"/></g>`;
  }
  for(const a in SN){
    const[x1,y1]=cell(+a),[x2,y2]=cell(SN[a]),mx=(x1+x2)/2+(y2-y1)*.12,my=(y1+y2)/2-(x2-x1)*.12;
    s+=`<path d="M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="#2fb83a" stroke-width="2.2" stroke-linecap="round" opacity=".9"/><circle cx="${x1}" cy="${y1}" r="2" fill="#1f8a2a"/><circle cx="${x1}" cy="${y1-.5}" r=".6" fill="#fff"/>`;
  }
  b.insertAdjacentHTML('beforeend',s+'</svg>');
  els=g.P.map(p=>{const e=document.createElement('i');e.className='tok';e.style.setProperty('--c',C[p]);b.append(e);return e});
}
function sDraw(){
  g.pos.forEach((n,k)=>{const[x,y]=cell(n),o=k*1.4-2;els[k].style.left=x+o+'%';els[k].style.top=y+o*.5+'%'});
  top();
}
function sRoll(r){
  if(!g||g.st!='roll')return;
  const k=g.turn;let left=g.pos[k]+r>100?0:r;
  g.st='busy';g.roll=r;g.msg=nm(k)+' rolled '+r;sDraw();
  const step=()=>{
    if(!g)return;
    if(left>0){g.pos[k]++;left--;sDraw();return setTimeout(step,180)}
    const q=g.pos[k],to=SN[q]||LD[q];
    if(to){g.pos[k]=to;g.msg=nm(k)+(SN[q]?' got bitten!':' climbed up!');sDraw()}
    if(g.pos[k]==100){g.st='done';g.win=k;return sDraw()}
    setTimeout(()=>{if(!g)return;if(r!=6)g.turn=(k+1)%g.P.length;g.st='roll';g.msg='';sDraw();botCheck()},to?700:250);
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
$('#create').onclick=async()=>{try{say('ferr');watch(await mp.createRoom(S.max))}catch(e){say('ferr',fe(e))}};
$('#join').onclick=async()=>{
  const c=$('#code').value.trim();
  if(!/^\d{4}$/.test(c))return say('ferr','Enter the 4-digit code');
  try{say('ferr');await mp.joinRoom(c);watch(c)}catch(e){say('ferr',fe(e))}
};
function onRoom(d,pending){
  if(!ctx.code)return;
  if(!d){alert('The room was closed.');return home()}
  ctx.room=d;
  if(d.status=='lobby'){
    $('#rcode').textContent=ctx.code;
    const ul=$('#plist');ul.innerHTML='';
    d.players.forEach((p,k)=>{const li=document.createElement('li');li.textContent=p.name;li.style.setProperty('--c',C[SEATS[Math.max(2,d.players.length)][k]||0]);ul.append(li)});
    const host=d.host==mp.me().uid;
    $('#start').hidden=!(host&&d.players.length>=2);
    $('#lmsg').textContent=d.players.length+' of '+d.max+' joined'+(host?'':' · waiting for the host to start');
  }else{
    if(pending)return;
    g=d.g;
    if(!ctx.playing){ctx.playing=1;enter()}else draw();
  }
}
$('#start').onclick=()=>{
  const d=ctx.room,P=SEATS[d.players.length];
  g={k:'ludo',P,names:d.players.map(p=>p.name),uids:d.players.map(p=>p.uid),t:Array(P.length*4).fill(-1),turn:0,roll:0,st:'roll',msg:''};
  ctx.playing=1;
  mp.setRoom(ctx.code,{status:'playing',g}).catch(e=>alert(fe(e)));
  enter();
};
$('#chatbtn').onclick=()=>{const c=$('#chat');c.hidden=!c.hidden;if(!c.hidden)$('#msgs').scrollTop=1e9};
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
