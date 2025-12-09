const img=document.getElementById('partsImg');
const wrap=document.getElementById('partsWrap');
const editBtn=document.getElementById('editPins');
const saveBtn=document.getElementById('savePins');
const resetBtn=document.getElementById('resetPins');
const controls=document.getElementById('hiddenControls');
const defaults=[
 {title:'Headstock',info:'Holds tuners',x:87,y:14},
 {title:'Pickups',info:'Convert vibration',x:44,y:49},
];
let pins=[], isEditing=false, drag={active:false, el:null};
function loadPins(){
 try{const raw=localStorage.getItem('gtr'); if(raw)return JSON.parse(raw);}catch(e){}
 return defaults;
}
function renderPins(){
 wrap.querySelectorAll('.marker').forEach(m=>m.remove());
 pins.forEach((p,i)=>{
  const m=document.createElement('div');
  m.className='marker';
  m.style.left=p.x+'%';
  m.style.top=p.y+'%';
  m.dataset.i=i;
  m.onclick=()=>{
    document.querySelectorAll('.bubble').forEach(b=>b.remove());
    const b=document.createElement('div');
    b.className='bubble show';
    b.style.left=p.x+'%'; b.style.top=p.y+'%';
    b.textContent=p.title+': '+p.info;
    wrap.appendChild(b);
  }
  wrap.appendChild(m);
 });
}
wrap.onmousedown=e=>{
 if(!isEditing)return;
 const t=e.target.closest('.marker'); if(!t)return;
 drag.active=true; drag.el=t;
};
window.onmousemove=e=>{
 if(!drag.active||!isEditing)return;
 const r=wrap.getBoundingClientRect();
 const x=((e.clientX-r.left)/r.width)*100;
 const y=((e.clientY-r.top)/r.height)*100;
 drag.el.style.left=x+'%'; drag.el.style.top=y+'%';
 pins[drag.el.dataset.i].x=x; pins[drag.el.dataset.i].y=y;
};
window.onmouseup=()=>{drag.active=false; drag.el=null;}
editBtn.onclick=()=>{isEditing=!isEditing; saveBtn.disabled=!isEditing;}
saveBtn.onclick=()=>{localStorage.setItem('gtr',JSON.stringify(pins)); isEditing=false; saveBtn.disabled=true;}
resetBtn.onclick=()=>{localStorage.removeItem('gtr'); pins=defaults.map(d=>({...d})); renderPins();}
document.onkeydown=e=>{if(e.key.toLowerCase()==='e')controls.style.display=controls.style.display==='none'?'block':'none';}
function init(){pins=loadPins().map(d=>({...d})); renderPins();}
if(img.complete)init(); else img.onload=init;

document.querySelectorAll('.play').forEach(btn=>btn.onclick=()=>{
 const player=document.getElementById('player');
 player.src=btn.dataset.src;
 player.play();
});

// ---- Upgrades: more parts, tuned positions, search, connectors, styling ----
(function(){
  const img=document.getElementById('partsImg');
  const wrap=document.getElementById('partsWrap');
  const svg=document.getElementById('partsSvg');
  if(!img||!wrap||!svg) return;

  const searchInput=document.getElementById('partSearch');
  const searchBtn=document.getElementById('partSearchBtn');

  const tunedDefaults = [
    {title:'Headstock', info:'Holds the tuning machines.', x:87, y:14},
    {title:'Tuning Pegs', info:'Adjust string tension to change pitch.', x:84, y:10},
    {title:'Nut', info:'Guides strings at the start of the fretboard.', x:76, y:27},
    {title:'Neck', info:'Supports the fretboard and truss rod.', x:66, y:34},
    {title:'Frets', info:'Metal strips dividing the scale.', x:60, y:37},
    {title:'Pickup Selector', info:'Switches between pickups.', x:49, y:40},
    {title:'Pickups', info:'Magnets and coils convert vibration to signal.', x:44, y:49},
    {title:'Bridge', info:'Anchors/intonates strings; transfers vibration.', x:34, y:63},
    {title:'Tremolo Arm', info:'Temporarily changes pitch.', x:31, y:58},
    {title:'Volume Knob', info:'Controls overall loudness.', x:41, y:64},
    {title:'Tone Knob', info:'Rolls off high frequencies.', x:45, y:67},
    {title:'Body', info:'Resonates and houses electronics.', x:28, y:56},
    {title:'Output Jack', info:'Connects to the amp via cable.', x:21, y:69},
    {title:'Fretboard', info:'Surface where you press the strings.', x:70, y:31}
  ];

  const LSKEY = 'gtr';
  try{
    if(typeof pins !== 'undefined'){
      let saved=null; try{ saved=JSON.parse(localStorage.getItem(LSKEY)||'null'); }catch(e){}
      pins = Array.isArray(saved)&&saved.length ? saved : tunedDefaults.map(d=>({...d}));
      if(typeof renderPins === 'function'){ renderPins(); }
    }
  }catch(e){}

  function clearConnectors(){
    [...svg.querySelectorAll('.parts-connector')].forEach(n=>n.remove());
  }
  function drawConnector(mx,my,bx,by){
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1', mx);
    line.setAttribute('y1', my);
    line.setAttribute('x2', bx);
    line.setAttribute('y2', by);
    line.setAttribute('class','parts-connector');
    svg.appendChild(line);
  }

  const originalRender = (typeof renderPins === 'function') ? renderPins : null;
  if(originalRender){
    window.renderPins = function(){
      originalRender();
      wrap.querySelectorAll('.marker').forEach(m=>{
        m.addEventListener('click', ()=>{
          wrap.querySelectorAll('.marker.highlight').forEach(h=>h.classList.remove('highlight'));
          m.classList.add('highlight');
        });
      });
    };
  }

  function syncSvgSize(){
    const r = wrap.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.max(1,r.width)} ${Math.max(1,r.height)}`);
  }
  syncSvgSize();
  window.addEventListener('resize',()=>{ syncSvgSize(); clearConnectors(); });

  function doSearch(){
    if(!searchInput)return;
    const q = searchInput.value.trim().toLowerCase();
    if(!q)return;
    const i = pins.findIndex(p=>p.title.toLowerCase().includes(q));
    wrap.querySelectorAll('.bubble').forEach(b=>b.remove());
    wrap.querySelectorAll('.marker.highlight').forEach(h=>h.classList.remove('highlight'));
    if(i>=0){
      const m = wrap.querySelectorAll('.marker')[i];
      if(m){
        m.click();
        m.classList.add('highlight');
        m.scrollIntoView({behavior:'smooth'});
      }
    }
  }
  if(searchBtn)searchBtn.addEventListener('click',doSearch);
  if(searchInput)searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doSearch();}});

  if(typeof renderPins === 'function'){
    renderPins();
  }
})();

// === Neck Profile Visualizer ===

const neckSvg = document.getElementById("neckSvg");
function drawProfile(shape) {
  let path="";
  if(shape==="c"){path="M10 80 Q125 10 240 80";}
  else if(shape==="v"){path="M10 80 Q80 30 125 25 Q170 30 240 80";}
  else if(shape==="u"){path="M10 80 Q125 -20 240 80";}
  neckSvg.innerHTML = `<path d="${path}" stroke="black" fill="none" stroke-width="4"/>`;
}
drawProfile("c");
document.querySelectorAll('input[name="neck"]').forEach(r=>r.onchange=e=>drawProfile(e.target.value));

// === Setup Calculators ===

function calcSetup(gauge, guitar){
  if(!gauge) return "Enter a string gauge first.";
  let baseAction=gauge<=9?1.4:gauge>=11?1.9:1.6;
  let pickupHeight=2.2;
  let relief=0.10;
  if(guitar==="tele")baseAction+=0.1;
  if(guitar==="jazz")pickupHeight+=0.2;
  return `
    Recommended Action (12th fret): ${baseAction.toFixed(2)} mm<br>
    Pickup Height: ${pickupHeight.toFixed(2)} mm<br>
    Neck Relief: ${relief.toFixed(2)} mm
  `;
}

document.getElementById("stratCalcBtn").onclick=()=>{
  const g=Number(document.getElementById("stratGauge").value);
  document.getElementById("stratResult").innerHTML=calcSetup(g,"strat");
};
document.getElementById("teleCalcBtn").onclick=()=>{
  const g=Number(document.getElementById("teleGauge").value);
  document.getElementById("teleResult").innerHTML=calcSetup(g,"tele");
};
document.getElementById("jazzCalcBtn").onclick=()=>{
  const g=Number(document.getElementById("jazzGauge").value);
  document.getElementById("jazzResult").innerHTML=calcSetup(g,"jazz");
};

// === Note Trainer ===

const openStrings=["E","A","D","G","B","E"];
const notes=["A","A#","B","C","C#","D","D#","E","F","F#","G","G#"];
const overlay=document.getElementById("fretOverlay");
const noteDisplay=document.getElementById("noteDisplay");

const fretX=[8,53,96,136,174,210,245,278,310,341,370,398,425];
const stringY=[18,38,58,78,98,118];

for(let s=0;s<6;s++){
  for(let f=0;f<12;f++){
    const pad=document.createElement("div");
    pad.className="fretPad";
    pad.style.left=`${fretX[f]}px`;
    pad.style.top=`${stringY[s]}px`;
    pad.dataset.string=s;
    pad.dataset.fret=f;
    overlay.appendChild(pad);
  }
}

overlay.addEventListener("click",(e)=>{
  if(!e.target.classList.contains("fretPad"))return;
  const s=Number(e.target.dataset.string);
  const f=Number(e.target.dataset.fret);
  const open=openStrings[s];
  const noteIndex=(notes.indexOf(open)+f)%notes.length;
  noteDisplay.textContent=`Note: ${notes[noteIndex]}`;
});

// === Capo Tool ===

const chromatic=["A","A#","B","C","C#","D","D#","E","F","F#","G","G#"];
document.getElementById("capoBtn").onclick=()=>{
  const key=document.getElementById("capoKey").value;
  const fret=Number(document.getElementById("capoFret").value);
  const result=document.getElementById("capoResult");
  if(!key||isNaN(fret)){result.innerHTML="Please select a key and fret.";return;}
  const index=chromatic.indexOf(key.split(" ")[0]);
  const newKey=chromatic[(index+fret)%12];
  result.innerHTML=`
    <strong>Original Key:</strong> ${key}<br>
    <strong>Capo Fret:</strong> ${fret}<br>
    <strong>New Key:</strong> ${newKey}
  `;
};

// === Metro Tiles ===

document.querySelectorAll(".tile").forEach(tile=>{
  tile.addEventListener("click",()=>{
    const target=tile.dataset.target;
    document.querySelector(target).scrollIntoView({behavior:"smooth"});
  });
});

// === GUITAR MULTI-QUESTION QUIZ (FIXED) ===

const quizData = [
  { q:"Which guitar is known for its three single-coil pickups?", options:["Stratocaster","Telecaster","Jazzmaster","None"], answer:"Stratocaster" },
  { q:"Which guitar has a twangy bridge pickup?", options:["Jazzmaster","Telecaster","Stratocaster","Les Paul"], answer:"Telecaster" },
  { q:"Which is an offset body design?", options:["Stratocaster","Telecaster","Jazzmaster","Flying V"], answer:"Jazzmaster" },
  { q:"Often used in surf rock?", options:["Telecaster","Stratocaster","Jazzmaster","ES-335"], answer:"Jazzmaster" },
  { q:"Marketed to jazz players but adopted by indie musicians?", options:["Telecaster","Jazzmaster","Stratocaster","Jaguar"], answer:"Jazzmaster" },
  { q:"Most classic bell-like clean tone?", options:["Stratocaster","Telecaster","Jazzmaster","SG"], answer:"Stratocaster" },
  { q:"Floating tremolo system?", options:["Telecaster","Jazzmaster","Stratocaster","PRS"], answer:"Jazzmaster" },
  { q:"Slab body and simple electronics?", options:["Telecaster","Stratocaster","Jazzmaster","Mustang"], answer:"Telecaster" }
];

let currentQuestion=0;
let score=0;
let answered=false;

const quizQuestion=document.getElementById("quizQuestion");
const quizOptions=document.getElementById("quizOptions");
const quizScore=document.getElementById("quizScore");
const quizNext=document.getElementById("quizNext");

function loadQuestion(){
  answered=false;
  quizOptions.innerHTML="";
  const q=quizData[currentQuestion];
  quizQuestion.textContent=q.q;

  q.options.forEach(option=>{
    const div=document.createElement("div");
    div.className="quizOption";
    div.textContent=option;

    div.onclick=()=>{
      if(answered) return;
      answered=true;

      if(option===q.answer){
        div.classList.add("correct");
        score++;
      }else{
        div.classList.add("wrong");
        [...quizOptions.children].find(o=>o.textContent===q.answer).classList.add("correct");
      }
      quizScore.textContent=`Score: ${score}/${quizData.length}`;
    };

    quizOptions.appendChild(div);
  });
}

quizNext.onclick=()=>{
  if(!answered) return;

  currentQuestion++;
  if(currentQuestion>=quizData.length){
    quizQuestion.textContent="Quiz Complete!";
    quizOptions.innerHTML="";
    quizNext.style.display="none";
    quizScore.textContent=`Final Score: ${score}/${quizData.length}`;
    return;
  }
  loadQuestion();
};

loadQuestion();

const contactBtn = document.querySelector('#contact button');
const contactStatus = document.getElementById('contactStatus');

if (contactBtn && contactStatus) {
  contactBtn.addEventListener('click', () => {
    contactStatus.textContent = "Message sent successfully!";
    contactStatus.classList.add("show");

    setTimeout(() => {
      contactStatus.classList.remove("show");
    }, 2600);
  });
}
