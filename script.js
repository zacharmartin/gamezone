(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var rnd=function(n){return Math.floor(Math.random()*n)};
var shuffle=function(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=rnd(i+1);var t=a[i];a[i]=a[j];a[j]=t}return a};
var pl=function(n,f){return n===1?f[0]:(n>=2&&n<=4?f[1]:f[2])};
var mem={};
var store={
  get:function(k){try{var v=localStorage.getItem('gz_'+k);if(v!==null)return JSON.parse(v)}catch(e){}return (k in mem)?mem[k]:null},
  set:function(k,v){mem[k]=v;try{localStorage.setItem('gz_'+k,JSON.stringify(v))}catch(e){}}
};
var svg=function(inner){return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+inner+'</svg>'};

/* ---------- Společné rozhraní pro hry ---------- */
var home=$('#home'),view=$('#view'),grid=$('#grid'),gameEl=$('#game');
var gt=$('#gt'),how=$('#how'),sc=$('#sc'),bs=$('#bs'),recs=$('#recs');
var cur=null,api=null,toastT=null;

function toast(text){
  var old=$('.toast');if(old)old.remove();
  var t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=text;
  document.body.appendChild(t);clearTimeout(toastT);
  toastT=setTimeout(function(){t.remove()},2200);
}
function bestOf(g){return store.get('best_'+g.id)}
function bestText(g){var b=bestOf(g);return b===null?'—':g.fmt(b)}

function makeApi(g){
  var d=[];
  return {
    _dispose:function(){d.splice(0).forEach(function(f){try{f()}catch(e){}})},
    cleanup:function(f){d.push(f)},
    timeout:function(fn,ms){var t=setTimeout(fn,ms);d.push(function(){clearTimeout(t)});return t},
    interval:function(fn,ms){var t=setInterval(fn,ms);d.push(function(){clearInterval(t)});return t},
    clear:function(t){clearTimeout(t);clearInterval(t)},
    on:function(el,ev,fn,o){el.addEventListener(ev,fn,o);d.push(function(){el.removeEventListener(ev,fn,o)})},
    score:function(v){sc.textContent=v},
    restart:function(){openGame(g)},
    report:function(v){
      if(g.better==='high'&&v<=0)return false;
      var c=bestOf(g);
      var better=c===null||(g.better==='high'?v>c:v<c);
      if(better){store.set('best_'+g.id,v);bs.textContent=g.fmt(v);toast('Nový rekord: '+g.fmt(v));return true}
      return false;
    }
  };
}

function closeGame(){if(api){api._dispose();api=null}}
function openGame(g){
  closeGame();
  cur=g;
  gameEl.innerHTML='';
  view.style.setProperty('--g','var(--'+g.color+')');
  gt.textContent=g.name;how.textContent=g.how;sc.textContent='0';bs.textContent=bestText(g);
  api=makeApi(g);
  g.mount(gameEl,api);
}

/* ---------- 1. Had ---------- */
function mountSnake(root,api){
  root.innerHTML='<div class="stage"><canvas class="cv" width="400" height="400" aria-label="Hrací plocha hada"></canvas></div>'+
    '<div class="row"><button class="btn primary" id="go">Start</button></div>'+
    '<div class="dpad"><button class="up" data-d="0,-1" aria-label="Nahoru">▲</button><button class="lf" data-d="-1,0" aria-label="Doleva">◀</button><button class="dn" data-d="0,1" aria-label="Dolů">▼</button><button class="rt" data-d="1,0" aria-label="Doprava">▶</button></div>';
  var cv=$('canvas',root),ctx=cv.getContext('2d'),go=$('#go',root),N=20,S=20;
  var body,dir,nd,food,score,state='idle',tm;
  function place(){do{food={x:rnd(N),y:rnd(N)}}while(body.some(function(p){return p.x===food.x&&p.y===food.y}))}
  function reset(){
    body=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];dir={x:1,y:0};nd=dir;score=0;api.score(0);place();
  }
  function draw(msg){
    ctx.fillStyle='#120f2e';ctx.fillRect(0,0,400,400);
    ctx.fillStyle='rgba(255,255,255,.035)';
    for(var x=0;x<N;x++)for(var y=0;y<N;y++)if((x+y)%2===0)ctx.fillRect(x*S,y*S,S,S);
    ctx.fillStyle='#ff4fa3';ctx.beginPath();ctx.arc(food.x*S+S/2,food.y*S+S/2,S*.36,0,Math.PI*2);ctx.fill();
    body.forEach(function(p,i){ctx.fillStyle=i?'#b8f24a':'#e6ff9a';ctx.fillRect(p.x*S+1,p.y*S+1,S-2,S-2)});
    if(msg){
      ctx.fillStyle='rgba(15,12,36,.72)';ctx.fillRect(0,0,400,400);
      ctx.fillStyle='#efecff';ctx.font='30px Bungee, Impact, sans-serif';ctx.textAlign='center';ctx.fillText(msg,200,205);
    }
  }
  function over(){
    state='over';draw('Konec hry');api.report(score);
    go.disabled=false;go.textContent='Hrát znovu';
  }
  function tick(){
    dir=nd;var h={x:body[0].x+dir.x,y:body[0].y+dir.y};
    if(h.x<0||h.y<0||h.x>=N||h.y>=N||body.some(function(p){return p.x===h.x&&p.y===h.y})){over();return}
    body.unshift(h);
    if(h.x===food.x&&h.y===food.y){score++;api.score(score);place()}else body.pop();
    draw();
  }
  function loop(){tick();if(state==='run')tm=api.timeout(loop,Math.max(65,130-score*2.5))}
  function start(){
    if(state==='run')return;
    reset();state='run';go.disabled=true;go.textContent='Hraje se';draw();tm=api.timeout(loop,250);
  }
  function turn(dx,dy){
    if(state!=='run')start();
    if(dx===-dir.x&&dy===-dir.y)return;
    nd={x:dx,y:dy};
  }
  var keys={ArrowUp:[0,-1],w:[0,-1],W:[0,-1],ArrowDown:[0,1],s:[0,1],S:[0,1],ArrowLeft:[-1,0],a:[-1,0],A:[-1,0],ArrowRight:[1,0],d:[1,0],D:[1,0]};
  api.on(document,'keydown',function(e){
    if(keys[e.key]){e.preventDefault();turn(keys[e.key][0],keys[e.key][1])}
    else if((e.key==='Enter'||e.key===' ')&&state!=='run'){e.preventDefault();start()}
  });
  var sx=null,sy=null;
  api.on(cv,'pointerdown',function(e){sx=e.clientX;sy=e.clientY});
  api.on(cv,'pointerup',function(e){
    if(sx===null)return;
    var dx=e.clientX-sx,dy=e.clientY-sy;sx=null;
    if(Math.max(Math.abs(dx),Math.abs(dy))<20)return;
    if(Math.abs(dx)>Math.abs(dy))turn(dx>0?1:-1,0);else turn(0,dy>0?1:-1);
  });
  root.querySelectorAll('.dpad button').forEach(function(b){
    api.on(b,'pointerdown',function(e){e.preventDefault();var p=b.dataset.d.split(',');turn(+p[0],+p[1])});
  });
  api.on(go,'click',start);
  reset();draw('Stiskni Start');
}

/* ---------- 2. Pexeso ---------- */
function mountPexeso(root,api){
  var syms=['🚀','🎲','🍕','🎧','🐙','🌵','⚡','🔮'];
  var deck=shuffle(syms.concat(syms)),first=-1,lock=false,moves=0,found=0;
  root.innerHTML='<div class="pex">'+deck.map(function(s,i){
    return '<button class="pc" data-i="'+i+'" aria-label="Karta '+(i+1)+'"><span class="pf"></span><span class="pb">'+s+'</span></button>';
  }).join('')+'</div><p class="msg" id="m">Najdi všech 8 dvojic.</p>';
  var cards=[].slice.call(root.querySelectorAll('.pc')),m=$('#m',root);
  api.score('0 tahů');
  cards.forEach(function(c,i){
    api.on(c,'click',function(){
      if(lock||c.classList.contains('open')||c.classList.contains('done'))return;
      c.classList.add('open');
      if(first<0){first=i;return}
      moves++;api.score(moves+' '+pl(moves,['tah','tahy','tahů']));
      var a=first;first=-1;
      if(deck[a]===deck[i]){
        cards[a].classList.add('done');c.classList.add('done');found++;
        if(found===8){
          m.innerHTML='Hotovo! Zvládl jsi to na <b>'+moves+' '+pl(moves,['tah','tahy','tahů'])+'</b>.';
          api.report(moves);
        }
      }else{
        lock=true;
        api.timeout(function(){cards[a].classList.remove('open');c.classList.remove('open');lock=false},800);
      }
    });
  });
}

/* ---------- 3. Piškvorky ---------- */
var LINES=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function tttLine(b){for(var i=0;i<LINES.length;i++){var l=LINES[i];if(b[l[0]]&&b[l[0]]===b[l[1]]&&b[l[0]]===b[l[2]])return l}return null}
function tttResult(b){var l=tttLine(b);if(l)return b[l[0]];return b.every(Boolean)?'D':null}
function tttMM(b,turn){
  var w=tttResult(b);if(w==='O')return 1;if(w==='X')return -1;if(w==='D')return 0;
  var best=turn==='O'?-2:2;
  for(var i=0;i<9;i++){if(b[i])continue;b[i]=turn;var v=tttMM(b,turn==='O'?'X':'O');b[i]=null;best=turn==='O'?Math.max(best,v):Math.min(best,v)}
  return best;
}
function tttAI(b,err){
  var free=[];for(var i=0;i<9;i++)if(!b[i])free.push(i);
  if(Math.random()<err)return free[rnd(free.length)];
  var bv=-2,mv=[];
  free.forEach(function(i){b[i]='O';var v=tttMM(b,'X');b[i]=null;if(v>bv){bv=v;mv=[i]}else if(v===bv)mv.push(i)});
  return mv[rnd(mv.length)];
}
function mountTtt(root,api){
  var ERR=[.55,.12],lvl=0,b,over,busy,round=0,streak=0,t={w:0,d:0,l:0};
  root.innerHTML='<div class="row"><div class="seg" role="group" aria-label="Obtížnost"><button data-l="0">Lehká</button><button data-l="1">Těžká</button></div></div>'+
    '<div class="ttt" id="bd"></div><p class="msg" id="m"></p><div class="row"><button class="btn" id="nx">Nové kolo</button></div><p class="msg" id="t"></p>';
  var bd=$('#bd',root),m=$('#m',root),tl=$('#t',root),segs=[].slice.call(root.querySelectorAll('.seg button'));
  function tally(){tl.textContent='Výhry '+t.w+' · Remízy '+t.d+' · Prohry '+t.l}
  function render(line){
    bd.innerHTML='';
    b.forEach(function(v,i){
      var c=document.createElement('button');
      c.className='tc'+(v?' '+v.toLowerCase():'')+(line&&line.indexOf(i)>=0?' win':'');
      c.textContent=v||'';c.disabled=!!v||over||busy;c.setAttribute('aria-label','Pole '+(i+1)+(v?', '+v:''));
      c.addEventListener('click',function(){play(i)});
      bd.appendChild(c);
    });
  }
  function finish(){
    var r=tttResult(b);if(!r)return false;
    over=true;
    if(r==='X'){streak++;t.w++;m.innerHTML='<b>Vyhrál jsi!</b>';api.report(streak)}
    else if(r==='O'){streak=0;t.l++;m.innerHTML='<b>Vyhrál počítač.</b>'}
    else{t.d++;m.innerHTML='<b>Remíza.</b>'}
    api.score('Série '+streak);tally();render(tttLine(b));return true;
  }
  function aiMove(){
    busy=false;if(over)return;
    b[tttAI(b,ERR[lvl])]='O';
    if(!finish()){m.textContent='Jsi na tahu.';render()}
  }
  function play(i){
    if(over||busy||b[i])return;
    b[i]='X';
    if(finish())return;
    busy=true;render();api.timeout(aiMove,350);
  }
  function newRound(){
    b=Array(9).fill(null);over=false;busy=false;round++;m.textContent='Jsi na tahu.';
    if(round%2===0){busy=true;m.textContent='Začíná počítač.';render();api.timeout(aiMove,450)}else render();
  }
  segs.forEach(function(s,i){
    api.on(s,'click',function(){lvl=i;streak=0;t={w:0,d:0,l:0};api.score('Série 0');tally();setSeg();newRound()});
  });
  function setSeg(){segs.forEach(function(s,i){s.setAttribute('aria-pressed',i===lvl?'true':'false')})}
  api.on($('#nx',root),'click',newRound);
  api.score('Série 0');setSeg();tally();newRound();
}

/* ---------- 4. Cíl ---------- */
function mountAim(root,api){
  root.innerHTML='<div class="stage aim" id="f"><button class="tgt" id="t" hidden aria-label="Cíl"></button>'+
    '<div class="overlay" id="ov"><p id="ot" style="margin:0">Klikej na cíle co nejrychleji. Máš 30 sekund.</p><button class="btn primary" id="go">Start</button></div></div>';
  var f=$('#f',root),t=$('#t',root),ov=$('#ov',root),go=$('#go',root),ot=$('#ot',root);
  var hits=0,miss=0,end=0,run=false,iv;
  function place(){
    var size=Math.max(36,66-hits*1.2),W=f.clientWidth,H=f.clientHeight;
    t.style.width=t.style.height=size+'px';
    t.style.left=rnd(Math.max(1,W-size))+'px';t.style.top=rnd(Math.max(1,H-size))+'px';
  }
  function tick(){
    var left=end-performance.now();
    if(left<=0){stop();return}
    api.score(hits+' · '+Math.ceil(left/1000)+' s');
  }
  function start(){
    hits=0;miss=0;run=true;ov.hidden=true;t.hidden=false;end=performance.now()+30000;place();
    api.score('0 · 30 s');iv=api.interval(tick,100);
  }
  function stop(){
    run=false;api.clear(iv);t.hidden=true;
    var acc=hits+miss?Math.round(hits/(hits+miss)*100):0;
    ot.innerHTML='Zásahy: <b>'+hits+'</b> · přesnost '+acc+' %';
    go.textContent='Hrát znovu';ov.hidden=false;api.score(hits+' · 0 s');api.report(hits);
  }
  api.on(t,'pointerdown',function(e){e.preventDefault();e.stopPropagation();if(!run)return;hits++;place()});
  api.on(f,'pointerdown',function(){if(run)miss++});
  api.on(go,'click',start);
}

/* ---------- 5. Reakce ---------- */
function mountReact(root,api){
  root.innerHTML='<div class="react" id="pad" role="button" tabindex="0"><span class="big" id="big">Klikni pro start</span><span class="sub" id="sub">5 pokusů, spočítám průměr</span></div><ol class="times" id="times"></ol>';
  var pad=$('#pad',root),big=$('#big',root),sub=$('#sub',root),tl=$('#times',root);
  var state='idle',times=[],tmo,t0=0;
  function set(cls,a,b){pad.className='react'+(cls?' '+cls:'');big.textContent=a;sub.textContent=b}
  function renderTimes(){tl.innerHTML=times.map(function(x){return '<li>'+x+' ms</li>'}).join('')}
  function act(){
    if(state==='idle'||state==='done'){
      if(state==='done'){times=[];renderTimes()}
      state='wait';set('wait','Počkej na zelenou…','Neklikej předčasně');
      tmo=api.timeout(function(){state='go';set('go','TEĎ!','Klikni');t0=performance.now()},1200+rnd(2800));
    }else if(state==='wait'){
      api.clear(tmo);state='idle';set('early','Příliš brzy!','Klikni a zkus to znovu');
    }else if(state==='go'){
      var ms=Math.round(performance.now()-t0);times.push(ms);renderTimes();
      if(times.length===5){
        var avg=Math.round(times.reduce(function(a,b){return a+b},0)/5);
        state='done';set('','Průměr '+avg+' ms','Klikni pro novou sérii');api.score(avg+' ms');api.report(avg);
      }else{
        state='idle';set('',ms+' ms','Pokus '+times.length+' z 5 · klikni na další');api.score(ms+' ms');
      }
    }
  }
  api.on(pad,'pointerdown',function(e){e.preventDefault();act()});
  api.on(document,'keydown',function(e){if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();act()}});
  api.score('—');
}

/* ---------- 6. Hádej číslo ---------- */
function mountNum(root,api){
  var secret=1+rnd(100),lo=1,hi=100,tries=0,done=false;
  root.innerHTML='<div><div class="rbar"><i id="fill"></i></div><div class="rlab"><span id="lo">1</span><span id="hi">100</span></div></div>'+
    '<form id="f" class="row" novalidate><input id="n" type="number" inputmode="numeric" min="1" max="100" placeholder="1–100" autocomplete="off" aria-label="Tvůj tip"><button class="btn primary" id="ok">Hádej</button></form>'+
    '<p class="msg" id="m">Myslím si číslo od 1 do 100.</p><ul class="log" id="log"></ul>';
  var fill=$('#fill',root),n=$('#n',root),m=$('#m',root),log=$('#log',root),f=$('#f',root);
  function range(){
    fill.style.left=((lo-1)/99*100)+'%';fill.style.width=(Math.max(0,(hi-lo))/99*100)+'%';
    $('#lo',root).textContent=lo;$('#hi',root).textContent=hi;
  }
  api.score('0 tipů');range();
  api.on(f,'submit',function(e){
    e.preventDefault();
    if(done){api.restart();return}
    var g=parseInt(n.value,10);
    if(isNaN(g)||g<1||g>100){m.textContent='Zadej celé číslo od 1 do 100.';return}
    tries++;api.score(tries+' '+pl(tries,['tip','tipy','tipů']));
    var li=document.createElement('li');
    if(g===secret){
      done=true;li.innerHTML='<span>'+g+'</span><b>Trefa!</b>';
      m.innerHTML='Správně! Číslo <b>'+secret+'</b> jsi našel na <b>'+tries+' '+pl(tries,['tip','tipy','tipů'])+'</b>.';
      $('#ok',root).textContent='Nová hra';n.disabled=true;api.report(tries);
    }else if(g<secret){
      lo=Math.max(lo,g+1);li.innerHTML='<span>'+g+'</span><span>↑ víc</span>';m.textContent='Hledané číslo je větší.';
    }else{
      hi=Math.min(hi,g-1);li.innerHTML='<span>'+g+'</span><span>↓ míň</span>';m.textContent='Hledané číslo je menší.';
    }
    log.insertBefore(li,log.firstChild);range();n.value='';if(!done)n.focus();
  });
}

/* ---------- 7. Krtek ---------- */
function mountMole(root,api){
  root.innerHTML='<div class="holes">'+Array.apply(null,Array(9)).map(function(_,i){
    return '<button class="hole" data-i="'+i+'" aria-label="Díra '+(i+1)+'"><span class="mole"></span></button>';
  }).join('')+'</div><div class="row"><button class="btn primary" id="go">Start</button></div><p class="msg" id="m">Klepni na krtka, než zmizí.</p>';
  var holes=[].slice.call(root.querySelectorAll('.hole')),go=$('#go',root),m=$('#m',root);
  var run=false,hits=0,end=0,cur=-1,hideT,iv;
  function spawn(){
    if(!run)return;
    var i;do{i=rnd(9)}while(i===cur);
    cur=i;holes[i].classList.add('up');
    hideT=api.timeout(function(){holes[i].classList.remove('up');cur=-1;api.timeout(spawn,150+rnd(250))},Math.max(420,900-hits*14));
  }
  function tick(){
    var left=end-performance.now();
    if(left<=0){stop();return}
    api.score(hits+' · '+Math.ceil(left/1000)+' s');
  }
  function start(){
    hits=0;run=true;cur=-1;end=performance.now()+30000;go.disabled=true;m.textContent='Plácni je!';
    api.score('0 · 30 s');iv=api.interval(tick,100);spawn();
  }
  function stop(){
    run=false;api.clear(iv);api.clear(hideT);cur=-1;
    holes.forEach(function(h){h.classList.remove('up')});
    api.score(hits+' · 0 s');m.innerHTML='Konec! Plácnuto <b>'+hits+' '+pl(hits,['krtek','krtci','krtků'])+'</b>.';
    go.disabled=false;go.textContent='Hrát znovu';api.report(hits);
  }
  holes.forEach(function(h,i){
    api.on(h,'pointerdown',function(e){
      e.preventDefault();
      if(!run||i!==cur)return;
      api.clear(hideT);h.classList.remove('up');h.classList.add('hit');
      api.timeout(function(){h.classList.remove('hit')},150);
      hits++;cur=-1;api.timeout(spawn,120+rnd(200));
    });
  });
  api.on(go,'click',start);
}

/* ---------- 8. Kámen, nůžky, papír ---------- */
function mountRps(root,api){
  var O=[{n:'Kámen',e:'✊'},{n:'Nůžky',e:'✌️'},{n:'Papír',e:'✋'}];
  var streak=0,t={w:0,d:0,l:0};
  root.innerHTML='<div class="versus" id="vs"><span>❔</span><small>PROTI</small><span>❔</span></div><p class="msg" id="m">Vyber si.</p>'+
    '<div class="rps">'+O.map(function(o,i){return '<button data-i="'+i+'"><span>'+o.e+'</span>'+o.n+'</button>'}).join('')+'</div><p class="msg" id="t"></p>';
  var vs=$('#vs',root),m=$('#m',root),tl=$('#t',root);
  function tally(){tl.textContent='Výhry '+t.w+' · Remízy '+t.d+' · Prohry '+t.l}
  root.querySelectorAll('.rps button').forEach(function(b){
    api.on(b,'click',function(){
      var p=+b.dataset.i,c=rnd(3),d=(p-c+3)%3;
      vs.innerHTML='<span>'+O[p].e+'</span><small>PROTI</small><span>'+O[c].e+'</span>';
      if(d===0){t.d++;m.innerHTML='<b>Remíza.</b> Oba jste zvolili '+O[p].n.toLowerCase()+'.'}
      else if(d===2){t.w++;streak++;m.innerHTML='<b>Vyhráváš!</b> '+O[p].n+' poráží '+O[c].n.toLowerCase()+'.';api.report(streak)}
      else{t.l++;streak=0;m.innerHTML='<b>Prohráváš.</b> '+O[c].n+' poráží '+O[p].n.toLowerCase()+'.'}
      api.score('Série '+streak);tally();
    });
  });
  api.score('Série 0');tally();
}

/* ---------- 9. Simon ---------- */
function mountSimon(root,api){
  var cols=['--pink','--cyan','--lime','--amber'],F=[262,330,392,523];
  root.innerHTML='<div class="simon">'+cols.map(function(c,i){
    return '<button class="sp" style="--p:var('+c+')" data-i="'+i+'" aria-label="Pole '+(i+1)+'"></button>';
  }).join('')+'</div><p class="msg" id="m">Stiskni Start a sleduj pořadí.</p><div class="row"><button class="btn primary" id="go">Start</button></div>';
  var pads=[].slice.call(root.querySelectorAll('.sp')),m=$('#m',root),go=$('#go',root);
  var seq=[],pos=0,state='idle',ac=null;
  api.cleanup(function(){try{if(ac)ac.close()}catch(e){}});
  function tone(i,ms){
    try{
      ac=ac||new (window.AudioContext||window.webkitAudioContext)();
      var o=ac.createOscillator(),g=ac.createGain(),n=ac.currentTime;
      o.type='sine';o.frequency.value=F[i];
      g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.2,n+.02);g.gain.exponentialRampToValueAtTime(.0001,n+ms/1000);
      o.connect(g);g.connect(ac.destination);o.start(n);o.stop(n+ms/1000+.05);
    }catch(e){}
  }
  function flash(i,ms){
    pads[i].classList.add('lit');tone(i,ms);
    api.timeout(function(){pads[i].classList.remove('lit')},ms);
  }
  function play(){
    state='show';m.textContent='Sleduj…';
    var gap=Math.max(280,640-seq.length*22);
    seq.forEach(function(s,k){api.timeout(function(){flash(s,gap*.6)},500+k*gap)});
    api.timeout(function(){state='input';pos=0;m.textContent='Tvůj tah'},500+seq.length*gap);
  }
  function next(){seq.push(rnd(4));api.score('Kolo '+seq.length);play()}
  function press(i){
    if(state!=='input')return;
    flash(i,180);
    if(i!==seq[pos]){
      state='over';m.innerHTML='Chyba v kole '+seq.length+'. Zvládl jsi <b>'+(seq.length-1)+' '+pl(seq.length-1,['kolo','kola','kol'])+'</b>.';
      go.disabled=false;go.textContent='Hrát znovu';return;
    }
    pos++;
    if(pos===seq.length){state='wait';api.report(seq.length);m.textContent='Správně!';api.timeout(next,800)}
  }
  pads.forEach(function(p,i){api.on(p,'pointerdown',function(e){e.preventDefault();press(i)})});
  api.on(document,'keydown',function(e){var k=parseInt(e.key,10);if(k>=1&&k<=4)press(k-1)});
  api.on(go,'click',function(){seq=[];go.disabled=true;go.textContent='Hraje se';next()});
  api.score('Kolo 0');
}

/* ---------- 10. Rychlá matika ---------- */
function mountMath(root,api){
  root.innerHTML='<div class="timebar"><i id="tb"></i></div><div class="q" id="q">Připraven?</div>'+
    '<div class="ans" id="ans">'+[1,2,3,4].map(function(i){return '<button disabled data-k="'+i+'">–</button>'}).join('')+'</div>'+
    '<div class="row"><button class="btn primary" id="go">Start</button></div><p class="msg" id="m">Špatná odpověď tě stojí 2 sekundy.</p>';
  var tb=$('#tb',root),q=$('#q',root),btns=[].slice.call(root.querySelectorAll('.ans button')),go=$('#go',root),m=$('#m',root);
  var score=0,ans=0,endAt=0,state='idle',lock=false,iv;
  function gen(){
    var lv=Math.min(4,Math.floor(score/6)),t=rnd(lv<1?2:3),a,b,text,r;
    if(t===0){var mx=10+lv*15;a=1+rnd(mx);b=1+rnd(mx);text=a+' + '+b;r=a+b}
    else if(t===1){var mx2=10+lv*15;a=2+rnd(mx2);b=1+rnd(a-1);text=a+' − '+b;r=a-b}
    else{a=2+rnd(8+lv);b=2+rnd(8);text=a+' × '+b;r=a*b}
    var set={};set[r]=1;var arr=[r];
    while(arr.length<4){var d=(1+rnd(10))*(rnd(2)?1:-1),v=r+d;if(v>=0&&!set[v]){set[v]=1;arr.push(v)}}
    ans=r;q.textContent=text;
    shuffle(arr).forEach(function(v,i){btns[i].textContent=v;btns[i].dataset.v=v;btns[i].className='';btns[i].disabled=false});
  }
  function tick(){
    var left=endAt-performance.now();
    if(left<=0){stop();return}
    tb.style.width=Math.min(100,left/300)+'%';api.score(score+' · '+Math.ceil(left/1000)+' s');
  }
  function stop(){
    state='done';api.clear(iv);tb.style.width='0%';q.textContent='Čas vypršel';
    btns.forEach(function(b){b.disabled=true});
    m.innerHTML='Vyřešeno: <b>'+score+' '+pl(score,['příklad','příklady','příkladů'])+'</b>.';
    api.score(score+' · 0 s');go.disabled=false;go.textContent='Hrát znovu';api.report(score);
  }
  function start(){
    score=0;state='run';lock=false;endAt=performance.now()+30000;go.disabled=true;m.textContent='Počítej!';
    api.score('0 · 30 s');gen();iv=api.interval(tick,100);
  }
  function pick(b){
    if(state!=='run'||lock||b.disabled)return;
    if(+b.dataset.v===ans){score++;b.classList.add('ok');lock=true;api.timeout(function(){lock=false;if(state==='run')gen()},120)}
    else{
      endAt-=2000;b.classList.add('bad');lock=true;
      btns.forEach(function(x){if(+x.dataset.v===ans)x.classList.add('ok')});
      api.timeout(function(){lock=false;if(state==='run')gen()},450);
    }
  }
  btns.forEach(function(b){api.on(b,'click',function(){pick(b)})});
  api.on(document,'keydown',function(e){var k=parseInt(e.key,10);if(k>=1&&k<=4)pick(btns[k-1])});
  api.on(go,'click',start);
  api.score('—');
}

/* ---------- 11-20: nové hry ---------- */
function clock(api,tb,sec,sc,done){
  var o={end:performance.now()+sec*1000},iv=api.interval(function(){
    var l=o.end-performance.now();
    if(l<=0){api.clear(iv);tb.style.width='0%';done();return}
    tb.style.width=Math.min(100,l/(sec*10))+'%';api.score(sc()+' · '+Math.ceil(l/1000)+' s');
  },100);
  return o;
}
function mountRace(root,api){
  root.innerHTML='<div class="stage"><canvas class="cv" width="300" height="440"></canvas></div><div class="row"><button class="btn primary" id="go">Start</button></div><p class="msg">Šipky nebo klepnutí vlevo a vpravo mění pruh.</p>';
  var cv=$('canvas',root),c=cv.getContext('2d'),go=$('#go',root),lane=1,obs=[],d=0,off=0,nx=0,st='idle',iv;
  function draw(msg){
    c.fillStyle='#120f2e';c.fillRect(0,0,300,440);c.fillStyle='rgba(255,255,255,.25)';
    for(var i=1;i<3;i++)for(var y=off%80-80;y<440;y+=80)c.fillRect(i*100-2,y,4,40);
    obs.forEach(function(o){c.fillStyle='#ffb02e';c.fillRect(o.l*100+22,o.y,56,50)});
    c.fillStyle='#37d8ff';c.fillRect(lane*100+28,360,44,64);
    if(msg){c.fillStyle='rgba(15,12,36,.72)';c.fillRect(0,0,300,440);c.fillStyle='#efecff';c.font='26px Bungee, Impact, sans-serif';c.textAlign='center';c.fillText(msg,150,225)}
  }
  function tick(){
    var sp=6+d/150;d+=sp/8;off+=sp;nx-=sp;
    if(nx<=0){obs.push({l:rnd(3),y:-50});nx=Math.max(110,200-d/8)}
    obs.forEach(function(o){o.y+=sp});obs=obs.filter(function(o){return o.y<440});
    if(obs.some(function(o){return o.l===lane&&o.y+50>360&&o.y<424})){
      st='over';api.clear(iv);draw('Bouračka');api.report(Math.floor(d));go.disabled=false;go.textContent='Hrát znovu';return;
    }
    api.score(Math.floor(d)+' m');draw();
  }
  function start(){if(st==='run')return;lane=1;obs=[];d=0;nx=0;st='run';go.disabled=true;go.textContent='Jede se';iv=api.interval(tick,30)}
  function mv(dx){if(st!=='run')start();lane=Math.max(0,Math.min(2,lane+dx))}
  api.on(document,'keydown',function(e){
    if(e.key==='ArrowLeft'||e.key==='a'){e.preventDefault();mv(-1)}
    else if(e.key==='ArrowRight'||e.key==='d'){e.preventDefault();mv(1)}
    else if((e.key==='Enter'||e.key===' ')&&st!=='run'){e.preventDefault();start()}
  });
  api.on(cv,'pointerdown',function(e){var r=cv.getBoundingClientRect();mv(e.clientX<r.left+r.width/2?-1:1)});
  api.on(go,'click',start);api.score('0 m');draw('Stiskni Start');
}
function mountBounce(root,api){
  root.innerHTML='<div class="stage"><canvas class="cv" width="300" height="400"></canvas></div><div class="row"><button class="btn primary" id="go">Start</button></div><p class="msg">Ovládej pálku prstem, myší nebo šipkami.</p>';
  var cv=$('canvas',root),c=cv.getContext('2d'),go=$('#go',root),px=150,key=0,bx=150,by=200,vx=0,vy=0,n=0,st='idle',iv;
  function draw(msg){
    c.fillStyle='#120f2e';c.fillRect(0,0,300,400);c.fillStyle='#ff4fa3';c.beginPath();c.arc(bx,by,8,0,7);c.fill();
    c.fillStyle='#37d8ff';c.fillRect(px-40,382,80,10);
    if(msg){c.fillStyle='rgba(15,12,36,.72)';c.fillRect(0,0,300,400);c.fillStyle='#efecff';c.font='26px Bungee, Impact, sans-serif';c.textAlign='center';c.fillText(msg,150,205)}
  }
  function tick(){
    px=Math.max(40,Math.min(260,px+key*7));bx+=vx;by+=vy;
    if(bx<8||bx>292){vx=-vx;bx=bx<8?8:292}
    if(by<8){vy=-vy;by=8}
    if(vy>0&&by>=374&&by<=392&&Math.abs(bx-px)<=48){vy=-Math.min(11,vy*1.04);vx=Math.max(-9,Math.min(9,vx*1.03+(bx-px)*.05));n++;by=374;api.score(n)}
    if(by>410){st='over';api.clear(iv);draw('Konec hry');api.report(n);go.disabled=false;go.textContent='Hrát znovu';return}
    draw();
  }
  function start(){if(st==='run')return;n=0;bx=150;by=200;vx=(rnd(2)?1:-1)*(2+Math.random()*2);vy=-4;st='run';go.disabled=true;go.textContent='Hraje se';api.score(0);iv=api.interval(tick,16)}
  function pos(e){var r=cv.getBoundingClientRect();px=Math.max(40,Math.min(260,(e.clientX-r.left)/r.width*300))}
  api.on(cv,'pointermove',pos);api.on(cv,'pointerdown',pos);
  api.on(document,'keydown',function(e){
    if(e.key==='ArrowLeft'||e.key==='a'){e.preventDefault();key=-1}
    else if(e.key==='ArrowRight'||e.key==='d'){e.preventDefault();key=1}
    else if((e.key==='Enter'||e.key===' ')&&st!=='run'){e.preventDefault();start()}
  });
  api.on(document,'keyup',function(){key=0});
  api.on(go,'click',start);api.score(0);draw('Stiskni Start');
}
function mountClick(root,api){
  root.innerHTML='<button class="react" id="b"><span class="big">Klikej!</span><span class="sub">Deset sekund se spustí prvním kliknutím</span></button><p class="msg" id="m">Co nejvíc kliknutí za 10 sekund.</p>';
  var b=$('#b',root),big=$('.big',root),m=$('#m',root),n=0,end=0,st='idle',iv;
  function fin(){st='done';api.clear(iv);big.textContent=n;m.innerHTML='Hotovo: <b>'+n+' '+pl(n,['klik','kliky','kliků'])+'</b>. Klepni na Znovu.';api.score(n+' · 0 s');api.report(n)}
  api.on(b,'pointerdown',function(e){
    e.preventDefault();if(st==='done')return;
    if(st==='run'&&performance.now()>=end){fin();return}
    if(st==='idle'){st='run';end=performance.now()+10000;iv=api.interval(function(){var l=end-performance.now();if(l<=0)fin();else api.score(n+' · '+Math.ceil(l/1000)+' s')},100)}
    n++;big.textContent=n;
  });
  api.score('0');
}
function mountStroop(root,api){
  var N=['Červená','Modrá','Zelená','Žlutá'],C=['#ff4f6a','#37d8ff','#6ee06a','#ffd23a'];
  root.innerHTML='<div class="timebar"><i id="tb"></i></div><div class="q" id="q">Připraven?</div><div class="ans">'+N.map(function(n){return '<button disabled>'+n+'</button>'}).join('')+'</div><div class="row"><button class="btn primary" id="go">Start</button></div><p class="msg" id="m">Klikni na barvu písma, ne na slovo. Chyba stojí 2 sekundy.</p>';
  var tb=$('#tb',root),q=$('#q',root),bt=[].slice.call(root.querySelectorAll('.ans button')),go=$('#go',root),m=$('#m',root),score=0,ink=0,st='idle',ck;
  function gen(){var w=rnd(4);ink=rnd(4);q.textContent=N[w].toUpperCase();q.style.color=C[ink]}
  function done(){st='done';q.textContent='Čas vypršel';q.style.color='';bt.forEach(function(b){b.disabled=true});m.innerHTML='Správně: <b>'+score+' '+pl(score,['odpověď','odpovědi','odpovědí'])+'</b>.';api.score(score+' · 0 s');go.disabled=false;go.textContent='Hrát znovu';api.report(score)}
  function pick(i){if(st!=='run')return;if(i===ink)score++;else ck.end-=2000;gen()}
  function start(){score=0;st='run';go.disabled=true;bt.forEach(function(b){b.disabled=false});m.textContent='Rychle!';gen();ck=clock(api,tb,30,function(){return score},done)}
  bt.forEach(function(b,i){api.on(b,'click',function(){pick(i)})});
  api.on(document,'keydown',function(e){var k=parseInt(e.key,10);if(k>=1&&k<=4)pick(k-1)});
  api.on(go,'click',start);api.score('—');
}
function mountHiLo(root,api){
  root.innerHTML='<div class="q" id="q"></div><div class="row"><button class="btn primary" id="hi">▲ Vyšší</button><button class="btn" id="lo">▼ Nižší</button></div><p class="msg" id="m">Bude další karta vyšší, nebo nižší?</p>';
  var q=$('#q',root),m=$('#m',root),v=1+rnd(13),s=0,over=false;
  var nm=function(n){return {1:'A',11:'J',12:'Q',13:'K'}[n]||n};
  q.textContent=nm(v);api.score('série 0');
  function guess(up){
    if(over)return;var n;do{n=1+rnd(13)}while(n===v);
    if(up?n>v:n<v){s++;api.score('série '+s);v=n;q.textContent=nm(n);m.innerHTML='Správně, padlo <b>'+nm(n)+'</b>.'}
    else{over=true;q.textContent=nm(n);m.innerHTML='Špatně, padlo <b>'+nm(n)+'</b>. Série: <b>'+s+'</b>. Klepni na Znovu.';api.report(s)}
  }
  api.on($('#hi',root),'click',function(){guess(true)});api.on($('#lo',root),'click',function(){guess(false)});
  api.on(document,'keydown',function(e){if(e.key==='ArrowUp'){e.preventDefault();guess(true)}else if(e.key==='ArrowDown'){e.preventDefault();guess(false)}});
}
function mountLights(root,api){
  root.innerHTML='<div class="lo" id="lo"></div><p class="msg" id="m">Klepnutí přepne políčko i jeho sousedy. Zhasni všechna světla.</p>';
  var lo=$('#lo',root),m=$('#m',root),g=[],mv=0,done=false,i;
  lo.style.gridTemplateColumns='repeat(5,1fr)';
  for(i=0;i<25;i++){var b=document.createElement('button');b.setAttribute('aria-label','Políčko '+(i+1));lo.appendChild(b);g.push(0)}
  var bt=[].slice.call(lo.children);
  function tg(k){var x=k%5,y=(k/5)|0;[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var a=x+d[0],c=y+d[1];if(a>=0&&a<5&&c>=0&&c<5)g[c*5+a]^=1})}
  function paint(){bt.forEach(function(e,k){e.className=g[k]?'on':''})}
  do{for(i=0;i<12;i++)tg(rnd(25))}while(!g.some(Boolean));
  paint();api.score('0 tahů');
  bt.forEach(function(e,k){api.on(e,'click',function(){
    if(done)return;tg(k);mv++;api.score(mv+' '+pl(mv,['tah','tahy','tahů']));paint();
    if(!g.some(Boolean)){done=true;m.innerHTML='Hotovo za <b>'+mv+' '+pl(mv,['tah','tahy','tahů'])+'</b>.';api.report(mv)}
  })});
}
function mountDigits(root,api){
  root.innerHTML='<div class="q" id="q">Připraven?</div><div class="row"><input class="tx" id="in" inputmode="numeric" autocomplete="off" style="width:220px" disabled><button class="btn primary" id="go">Start</button></div><p class="msg" id="m">Zapamatuj si číslo a pak ho napiš.</p>';
  var q=$('#q',root),inp=$('#in',root),go=$('#go',root),m=$('#m',root),L=0,num='',st='idle';
  function next(){
    L++;api.score('Úroveň '+L);num='';for(var i=0;i<L+2;i++)num+=1+rnd(9);
    st='show';q.textContent=num;inp.value='';inp.disabled=true;go.disabled=true;m.textContent='Pamatuj…';
    api.timeout(function(){st='in';q.textContent='?';inp.disabled=false;inp.focus();go.disabled=false;go.textContent='Potvrdit';m.textContent='Napiš číslo.'},900+L*450);
  }
  function check(){
    if(st!=='in')return;
    if(inp.value.trim()===num){api.report(L);st='wait';m.textContent='Správně!';api.timeout(next,600)}
    else{st='over';q.textContent=num;m.innerHTML='Chyba. Zvládl jsi <b>'+(L-1)+' '+pl(L-1,['úroveň','úrovně','úrovní'])+'</b>.';inp.disabled=true;go.disabled=false;go.textContent='Hrát znovu'}
  }
  api.on(go,'click',function(){if(st==='in')check();else if(st==='idle'||st==='over'){L=0;next()}});
  api.on(inp,'keydown',function(e){if(e.key==='Enter')check()});
  api.score('Úroveň 0');
}
function mountStop(root,api){
  root.innerHTML='<button class="react" id="b"><span class="big" id="t">0,00</span><span class="sub" id="s">Klepni a spusť stopky</span></button><p class="msg" id="m">Zastav stopky co nejblíž pěti sekundám. Po dvou sekundách se čas skryje.</p>';
  var b=$('#b',root),t=$('#t',root),s=$('#s',root),m=$('#m',root),st='idle',t0=0,iv;
  var f=function(ms){return (ms/1000).toFixed(2).replace('.',',')};
  api.on(b,'pointerdown',function(e){
    e.preventDefault();
    if(st==='idle'){st='run';t0=performance.now();s.textContent='Klepni pro zastavení';iv=api.interval(function(){var x=performance.now()-t0;t.textContent=x<2000?f(x):'?,??'},30)}
    else if(st==='run'){
      var x=performance.now()-t0,diff=Math.round(Math.abs(x-5000));st='done';api.clear(iv);
      t.textContent=f(x);s.textContent='Odchylka '+diff+' ms';m.innerHTML='Zastavil jsi na <b>'+f(x)+' s</b>. Klepni na Znovu.';api.score(diff+' ms');api.report(diff);
    }
  });
  api.score('—');
}
var pigS=0;
function mountPig(root,api){
  root.innerHTML='<div class="versus"><span id="d" style="font-size:4.5rem">🎲</span></div><div class="row"><button class="btn primary" id="roll">Hodit</button><button class="btn" id="hold">Zapsat</button></div><p class="msg" id="m"></p>';
  var d=$('#d',root),rl=$('#roll',root),hd=$('#hold',root),m=$('#m',root),me=0,cp=0,tp=0,busy=false,F=['⚀','⚁','⚂','⚃','⚄','⚅'];
  var lock=function(x){busy=x;rl.disabled=hd.disabled=x};
  function info(t){m.innerHTML='Ty: <b>'+me+'</b> · Počítač: <b>'+cp+'</b> · V tahu: <b>'+tp+'</b>'+(t?' · '+t:'')}
  function end(w){
    lock(true);
    if(w){pigS++;api.score('série '+pigS);api.report(pigS);m.innerHTML='<b>Vyhrál jsi '+me+' : '+cp+'!</b> Klepni na Znovu pro další hru.'}
    else{m.innerHTML='Počítač vyhrál '+cp+' : '+me+'. Série skončila na <b>'+pigS+'</b>.';pigS=0;api.score('série 0')}
  }
  function cpTurn(){
    tp=0;(function step(){
      var r=1+rnd(6);d.textContent=F[r-1];
      if(r===1){tp=0;lock(false);info('Počítač hodil jedničku.');return}
      tp+=r;
      if(cp+tp>=50){cp+=tp;tp=0;end(false);return}
      if(tp>=18){cp+=tp;tp=0;lock(false);info('Počítač zapsal body.');return}
      info();api.timeout(step,600);
    })();
  }
  api.on(rl,'click',function(){
    if(busy)return;var r=1+rnd(6);d.textContent=F[r-1];
    if(r===1){tp=0;lock(true);info('Padla jednička!');api.timeout(cpTurn,900)}
    else{tp+=r;if(me+tp>=50){me+=tp;tp=0;end(true)}else info()}
  });
  api.on(hd,'click',function(){if(busy||!tp)return;me+=tp;tp=0;lock(true);info();api.timeout(cpTurn,700)});
  api.score('série '+pigS);info('Kdo první dosáhne 50.');
}
function mountOdd(root,api){
  root.innerHTML='<div class="timebar"><i id="tb"></i></div><div class="odd" id="od"></div><div class="row"><button class="btn primary" id="go">Start</button></div><p class="msg" id="m">Najdi políčko s jiným odstínem. Chyba stojí 2 sekundy.</p>';
  var tb=$('#tb',root),od=$('#od',root),go=$('#go',root),m=$('#m',root),score=0,st='idle',ck;
  function gen(){
    var n=Math.min(7,2+((score/3)|0)),h=rnd(360),dl=Math.max(3,16-score*.5),o=rnd(n*n);
    od.style.gridTemplateColumns='repeat('+n+',1fr)';od.innerHTML='';
    for(var i=0;i<n*n;i++){var b=document.createElement('button');b.style.background='hsl('+h+',65%,'+(i===o?50+dl:50)+'%)';b.dataset.o=i===o?1:0;b.setAttribute('aria-label','Políčko');od.appendChild(b)}
  }
  function done(){st='done';od.innerHTML='';m.innerHTML='Nalezeno: <b>'+score+' '+pl(score,['políčko','políčka','políček'])+'</b>.';api.score(score+' · 0 s');go.disabled=false;go.textContent='Hrát znovu';api.report(score)}
  api.on(od,'pointerdown',function(e){
    var b=e.target.closest('button');if(!b||st!=='run')return;
    if(b.dataset.o==='1')score++;else ck.end-=2000;gen();
  });
  api.on(go,'click',function(){score=0;st='run';go.disabled=true;m.textContent='Hledej!';gen();ck=clock(api,tb,30,function(){return score},done)});
  api.score('—');
}

/* ---------- Seznam her ---------- */
var GAMES=[
  {id:'had',name:'Had',color:'lime',desc:'Jez kuličky, rost a nenarazit do sebe.',better:'high',
   fmt:function(v){return v+' '+pl(v,['bod','body','bodů'])},
   how:'Šipky nebo WASD. Na telefonu přejeď prstem po hrací ploše nebo použij tlačítka. Jez růžové kuličky a vyhýbej se zdem i vlastnímu ocasu.',
   icon:svg('<path d="M8 38V18h14v16h14V14"/><circle cx="36" cy="9" r="3.5" fill="currentColor" stroke="none"/>'),mount:mountSnake},
  {id:'pexeso',name:'Pexeso',color:'cyan',desc:'Najdi osm dvojic na co nejméně tahů.',better:'low',
   fmt:function(v){return v+' '+pl(v,['tah','tahy','tahů'])},
   how:'Otáčej karty a hledej dvojice. Čím méně tahů, tím lepší výsledek.',
   icon:svg('<rect x="6" y="10" width="20" height="26" rx="4"/><rect x="22" y="14" width="20" height="26" rx="4" fill="currentColor" fill-opacity=".25"/>'),mount:mountPexeso},
  {id:'piskvorky',name:'Piškvorky',color:'pink',desc:'Křížky proti počítači, s lehkou i těžkou obtížností.',better:'high',
   fmt:function(v){return 'série '+v},
   how:'Ty hraješ křížky. Spoj tři v řadě dřív než počítač. Počítá se série výher za sebou.',
   icon:svg('<path d="M18 6v36M30 6v36M6 18h36M6 30h36" stroke-opacity=".45"/><path d="M8 8l8 8M16 8l-8 8"/><circle cx="36" cy="36" r="5"/>'),mount:mountTtt},
  {id:'cil',name:'Cíl',color:'amber',desc:'Za 30 sekund trefíš co nejvíc zmenšujících se terčů.',better:'high',
   fmt:function(v){return v+' '+pl(v,['zásah','zásahy','zásahů'])},
   how:'Klikej nebo klepej na terče. Čím víc zásahů, tím menší terče.',
   icon:svg('<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="2.5" fill="currentColor"/>'),mount:mountAim},
  {id:'reakce',name:'Reakce',color:'violet',desc:'Změř, jak rychle zareaguješ na zelenou.',better:'low',
   fmt:function(v){return v+' ms'},
   how:'Počkej, až červená zezelená, a hned klikni. Pět pokusů, počítá se průměr.',
   icon:svg('<path d="M27 5L10 27h12l-3 16 19-24H26z"/>'),mount:mountReact},
  {id:'cislo',name:'Hádej číslo',color:'cyan',desc:'Počítač myslí číslo od 1 do 100. Najdeš ho?',better:'low',
   fmt:function(v){return v+' '+pl(v,['tip','tipy','tipů'])},
   how:'Zadej tip a podle nápovědy zužuj rozmezí. Čím méně tipů, tím lépe.',
   icon:svg('<path d="M17 18a7 7 0 1 1 10 6c-2 1.5-3 2.5-3 5"/><circle cx="24" cy="38" r="2" fill="currentColor" stroke="none"/>'),mount:mountNum},
  {id:'krtek',name:'Plácni krtka',color:'amber',desc:'Krtci vykukují z děr čím dál rychleji.',better:'high',
   fmt:function(v){return v+' '+pl(v,['krtek','krtci','krtků'])},
   how:'Plácni krtka, jakmile vykoukne. Máš 30 sekund a krtci jsou stále rychlejší.',
   icon:svg('<path d="M6 36h36"/><path d="M12 36a12 12 0 0 1 24 0"/><circle cx="20" cy="29" r="1.8" fill="currentColor" stroke="none"/><circle cx="28" cy="29" r="1.8" fill="currentColor" stroke="none"/>'),mount:mountMole},
  {id:'knp',name:'Kámen, nůžky, papír',color:'pink',desc:'Klasika proti počítači. Kolik výher v řadě dáš?',better:'high',
   fmt:function(v){return 'série '+v},
   how:'Vyber kámen, nůžky nebo papír. Počítá se série výher za sebou.',
   icon:svg('<path d="M14 36L34 12M34 36L14 12"/><circle cx="12" cy="38" r="4"/><circle cx="36" cy="38" r="4"/>'),mount:mountRps},
  {id:'simon',name:'Simon',color:'lime',desc:'Zapamatuj si pořadí barev a tónů a zopakuj ho.',better:'high',
   fmt:function(v){return v+' '+pl(v,['kolo','kola','kol'])},
   how:'Sleduj pořadí barev a zopakuj ho. Každé kolo je o jednu barvu delší. Můžeš i čísly 1 až 4.',
   icon:svg('<rect x="6" y="6" width="16" height="16" rx="4" fill="currentColor" fill-opacity=".3"/><rect x="26" y="6" width="16" height="16" rx="4"/><rect x="6" y="26" width="16" height="16" rx="4"/><rect x="26" y="26" width="16" height="16" rx="4" fill="currentColor" fill-opacity=".3"/>'),mount:mountSimon},
  {id:'matika',name:'Rychlá matika',color:'violet',desc:'30 sekund počítání z hlavy, příklady jsou stále těžší.',better:'high',
   fmt:function(v){return v+' '+pl(v,['příklad','příklady','příkladů'])},
   how:'Vyber správný výsledek ze čtyř. Špatná odpověď tě stojí 2 sekundy. Můžeš i čísly 1 až 4.',
   icon:svg('<path d="M8 14h12M14 8v12M28 14h12M9 30l10 10M19 30L9 40M28 33h12M28 39h12"/>'),mount:mountMath},
  {id:'zavody',name:'Závody',color:'cyan',desc:'Řiď auto a vyhýbej se překážkám na čím dál rychlejší silnici.',better:'high',
   fmt:function(v){return v+' m'},
   how:'Šipky nebo A a D mění pruh. Na telefonu klepni vlevo nebo vpravo. Čím dál dojedeš, tím lépe.',
   icon:svg('<rect x="14" y="10" width="20" height="28" rx="6"/><path d="M9 16h5M34 16h5M9 32h5M34 32h5"/>'),mount:mountRace},
  {id:'odraz',name:'Odraz',color:'pink',desc:'Odrážej míček pálkou, jak dlouho to půjde.',better:'high',
   fmt:function(v){return v+' '+pl(v,['odraz','odrazy','odrazů'])},
   how:'Pohybuj pálkou prstem, myší nebo šipkami. Míček je po každém odrazu rychlejší.',
   icon:svg('<path d="M8 40h20"/><circle cx="34" cy="14" r="4" fill="currentColor" stroke="none"/><path d="M34 14L22 36"/>'),mount:mountBounce},
  {id:'klikac',name:'Klikač',color:'lime',desc:'Deset sekund klikání na maximum.',better:'high',
   fmt:function(v){return v+' '+pl(v,['klik','kliky','kliků'])},
   how:'Klikej nebo klepej na velké tlačítko. Deset sekund se spustí prvním kliknutím.',
   icon:svg('<path d="M16 8v24l6-5 5 11 5-2-5-11h8z"/>'),mount:mountClick},
  {id:'barvy',name:'Barvy',color:'amber',desc:'Slovo říká jednu barvu, písmo má jinou. Zmást tě nenechá.',better:'high',
   fmt:function(v){return v+' '+pl(v,['bod','body','bodů'])},
   how:'Vyber barvu písma, ne to, co slovo říká. Máš 30 sekund, chyba stojí 2 sekundy. Můžeš i čísly 1 až 4.',
   icon:svg('<circle cx="18" cy="20" r="10" fill="currentColor" fill-opacity=".3"/><circle cx="30" cy="20" r="10"/><circle cx="24" cy="31" r="10" stroke-opacity=".6"/>'),mount:mountStroop},
  {id:'hilo',name:'Vyšší nebo nižší',color:'violet',desc:'Hádej, jestli bude další karta vyšší nebo nižší.',better:'high',
   fmt:function(v){return 'série '+v},
   how:'Tipni si, jestli bude další karta vyšší, nebo nižší. Počítá se série správných tipů.',
   icon:svg('<path d="M24 8l12 14H12zM24 40L12 26h24z"/>'),mount:mountHiLo},
  {id:'svetla',name:'Zhasni světla',color:'cyan',desc:'Logická hádanka. Zhasni všechna světla na co nejméně tahů.',better:'low',
   fmt:function(v){return v+' '+pl(v,['tah','tahy','tahů'])},
   how:'Klepnutí přepne políčko i jeho čtyři sousedy. Cílem je zhasnout celou mřížku.',
   icon:svg('<circle cx="24" cy="22" r="11"/><path d="M20 36h8M21 41h6"/>'),mount:mountLights},
  {id:'cisla',name:'Paměť čísel',color:'violet',desc:'Zapamatuj si číslo, které na chvíli zmizí.',better:'high',
   fmt:function(v){return 'úroveň '+v},
   how:'Podívej se na číslo, počkej, až zmizí, a napiš ho. Každé kolo je o číslici delší.',
   icon:svg('<rect x="8" y="12" width="32" height="24" rx="5"/><path d="M16 22h4M24 22h4M16 29h16"/>'),mount:mountDigits},
  {id:'stopky',name:'Stopky',color:'pink',desc:'Zastav čas na přesně pěti sekundách, i když ho nevidíš.',better:'low',
   fmt:function(v){return v+' ms'},
   how:'Spusť stopky a zastav je co nejblíž pěti sekundám. Po dvou sekundách se čas skryje. Čím menší odchylka, tím lépe.',
   icon:svg('<circle cx="24" cy="28" r="14"/><path d="M24 28V19M20 8h8"/>'),mount:mountStop},
  {id:'prasatko',name:'Prasátko',color:'lime',desc:'Kostková hra na 50 bodů proti počítači.',better:'high',
   fmt:function(v){return 'série '+v},
   how:'Házej kostkou a sčítej body. Jednička ti vezme body z tahu. Zapiš body včas. Kdo první dá 50, vyhrává. Počítá se série výher.',
   icon:svg('<rect x="8" y="8" width="32" height="32" rx="7"/><circle cx="17" cy="17" r="2.5" fill="currentColor" stroke="none"/><circle cx="31" cy="31" r="2.5" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none"/>'),mount:mountPig},
  {id:'odstin',name:'Odlišný odstín',color:'amber',desc:'Najdi políčko s mírně jinou barvou. Čím dál těžší.',better:'high',
   fmt:function(v){return v+' '+pl(v,['políčko','políčka','políček'])},
   how:'Klikni na políčko s jiným odstínem. Mřížka roste a rozdíl se zmenšuje. Máš 30 sekund, chyba stojí 2 sekundy.',
   icon:svg('<rect x="8" y="8" width="14" height="14" rx="3" fill="currentColor" fill-opacity=".3"/><rect x="26" y="8" width="14" height="14" rx="3" fill="currentColor" fill-opacity=".3"/><rect x="8" y="26" width="14" height="14" rx="3" fill="currentColor" fill-opacity=".3"/><rect x="26" y="26" width="14" height="14" rx="3" fill="currentColor" fill-opacity=".6"/>'),mount:mountOdd}
];

/* ---------- Hlavní stránka a směrování ---------- */
function renderHome(){
  var n=0;
  grid.innerHTML=GAMES.map(function(g){
    if(bestOf(g)!==null)n++;
    return '<a class="card" href="#'+g.id+'" style="--c:var(--'+g.color+')"><div class="tile">'+g.icon+'</div>'+
      '<h3>'+g.name+'</h3><p>'+g.desc+'</p>'+
      '<div class="foot"><span>Rekord: <b>'+bestText(g)+'</b></span><span aria-hidden="true">Hrát →</span></div></a>';
  }).join('');
  recs.textContent=n?('Rekordy máš v '+n+' z '+GAMES.length+' her'):'Zatím žádný rekord. Zkus první hru.';
}
function route(){
  var id=location.hash.slice(1),g=null;
  for(var i=0;i<GAMES.length;i++)if(GAMES[i].id===id)g=GAMES[i];
  if(!g){
    closeGame();view.hidden=true;home.hidden=false;renderHome();window.scrollTo(0,0);return;
  }
  home.hidden=true;view.hidden=false;openGame(g);window.scrollTo(0,0);
}
$('#rand').addEventListener('click',function(){location.hash=GAMES[rnd(GAMES.length)].id});
$('#restart').addEventListener('click',function(){if(cur)openGame(cur)});
window.addEventListener('hashchange',route);
route();
})();
