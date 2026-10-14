("use strict");
const $=id=>document.getElementById(id);
const A={melodies:[],selected:null,index:0,playing:false,paused:false,timer:null,started:0,remaining:0,ctx:null,master:null,osc:null,volume:.15,speed:1,frequencies:[300,350,400,450,500,550],manualHorn:null,holdMelody:false};
function parse(src){
 // Strip C/C++ comments while preserving line positions.
 const clean=src.replace(/\/\*[\s\S]*?\*\//g,m=>" ".repeat(m.length)).replace(/\/\/[^\r\n]*/g,m=>" ".repeat(m.length));
 const re=/(?:MelodyStep|(?:const\s+)?[\w:]+)\s+(melody\s*[_-]?\s*\d+|melody\d+)\s*\[\s*\]\s*=\s*\{([\s\S]*?)\}\s*;/gi;
 let m,out=[];
 while((m=re.exec(clean))){
   const steps=[];
   // Accept single horns, bitwise combinations (H1 | H2), numeric bitmasks,
   // and common aliases such as HORN_1. Duration may have a U/UL suffix.
   const pr=/\{\s*([^{}]+?)\s*,\s*(\d+)\s*(?:u|ul|lu|ull)?\s*\}/gi;
   let p;
   while((p=pr.exec(m[2]))){
     const expr=p[1].trim().replace(/\b(?:static|constexpr|const)\b/gi,"").trim();
     let horns=[];
     if(/^(?:0|false)$/i.test(expr)) {
       horns=[];
     } else {
       const parts=expr.split(/\s*(?:\||\bor\b)\s*/i);
       for(const raw of parts){
         const t=raw.trim().toUpperCase();
         let n=0;
         const hm=t.match(/^(?:H|HORN_?)([1-6])$/);
         if(hm) n=+hm[1];
         else if(/^\d+$/.test(t)){
           const v=Number(t);
           // A lone 1..6 means a channel number; larger numeric values are bitmasks.
           if(parts.length===1 && v>=1 && v<=6) n=v;
           else for(let bit=0;bit<6;bit++) if(v & (1<<bit)) horns.push(bit+1);
         }
         if(n) horns.push(n);
       }
     }
     horns=[...new Set(horns)].filter(n=>n>=1&&n<=6).sort((a,b)=>a-b);
     steps.push({horns,duration:Math.max(1,Number(p[2]))});
   }
   if(steps.length){
     const n=+(m[1].match(/\d+/)||[out.length+1])[0];
     out.push({id:m[1].toLowerCase().replace(/\s/g,""),name:"Melody "+n,source:m[1],steps});
   }
 }
 return out.sort((a,b)=>+a.name.match(/\d+/)[0]-+b.name.match(/\d+/)[0]);
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function drawList(){let q=$("search").value.toLowerCase().trim();$("list").innerHTML="";let rows=A.melodies.filter(m=>(m.name+" "+m.source).toLowerCase().includes(q));if(!rows.length){$("list").innerHTML='<div class="empty">No matching melodies.</div>';return}rows.forEach(m=>{let b=document.createElement("button");b.className="item"+(A.selected?.id===m.id?" selected":"");b.innerHTML=`<span class="num">${m.name.match(/\d+/)[0]}</span><span class="itemtext"><b>${esc(m.name)}</b><small>${esc(m.source)} · ${m.steps.length} steps</small></span><span>›</span>`;b.onclick=()=>select(m);$("list").appendChild(b)})}
function select(m){stop();A.selected=m;A.index=0;$("title").textContent=m.name;$("status").textContent="Ready";$("total").textContent=m.steps.length+" steps";["holdMelody","play","stop","restart"].forEach(id=>$(id).disabled=false);$("pause").disabled=true;drawList();drawSteps();render()}
function drawSteps(){$("steps").innerHTML="";A.selected.steps.forEach((s,i)=>{let d=document.createElement("div");d.className="step"+(i===A.index?" current":"");d.innerHTML=`<span>${i+1}</span><b class="${s.horns.length?"on":"silence"}">${s.horns.length?"HORN"+(s.horns.length>1?"S ":" ")+s.horns.join(" + ")+" ON":"ALL HORNS OFF"}</b><small>${s.duration} ms</small>`;$("steps").appendChild(d)})}
function render(){if(!A.selected)return;let s=A.selected.steps[Math.min(A.index,A.selected.steps.length-1)];$("counter").textContent=`Step ${Math.min(A.index+1,A.selected.steps.length)} / ${A.selected.steps.length}`;$("stepdesc").textContent=s?(s.horns.length?`HORN${s.horns.length>1?"S":""} ${s.horns.join(" + ")} ON · ${s.duration} ms`:`SILENCE · ${s.duration} ms`):"Ready";$("bar").style.width=(A.index/A.selected.steps.length*100)+"%";[...$("horns").children].forEach((e,i)=>e.classList.toggle("active",!!s&&s.horns.includes(i+1)));[...$("steps").children].forEach((e,i)=>e.classList.toggle("current",i===A.index))}
async function audio(){let C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error("Web Audio not supported");if(!A.ctx){A.ctx=new C();A.master=A.ctx.createGain();A.master.gain.value=A.volume;A.master.connect(A.ctx.destination)}await A.ctx.resume()}
function tone(input){offTone();if(!A.ctx)return;const hs=Array.isArray(input)?input:(input?[input]:[]);if(!hs.length)return;const voices=[];hs.forEach(h=>{if(h<1||h>6)return;let o=A.ctx.createOscillator(),g=A.ctx.createGain();o.type="sawtooth";o.frequency.value=A.frequencies[h-1];g.gain.value=.8/Math.sqrt(hs.length);o.connect(g);g.connect(A.master);o.start();voices.push({o,g,h})});A.osc=voices.length?{voices}:null}
function buildHornTools(){
 const manual=$("manualHorns"),freqs=$("frequencyControls");manual.innerHTML="";freqs.innerHTML="";
 A.frequencies.forEach((freq,i)=>{
   const b=document.createElement("button");b.type="button";b.className="manual-horn";b.textContent=`HORN ${i+1} · HOLD`;b.setAttribute("aria-label",`Press and hold to test Horn ${i+1}`);
   const start=async ev=>{ev.preventDefault();if(A.manualHorn!==null)return;try{await audio();A.manualHorn=i; b.classList.add("held");tone(i+1)}catch(e){$("status").textContent=e.message}};
   const end=ev=>{if(ev)ev.preventDefault();if(A.manualHorn===i){A.manualHorn=null;b.classList.remove("held");offTone()}};
   b.addEventListener("pointerdown",start);b.addEventListener("pointerup",end);b.addEventListener("pointerleave",end);b.addEventListener("pointercancel",end);b.addEventListener("lostpointercapture",end);
   b.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat)start(e)});b.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter")end(e)});
   manual.appendChild(b);
   const row=document.createElement("div");row.className="freq-row";row.innerHTML=`<label for="freq${i}"><span>HORN ${i+1}</span><strong><span id="freqVal${i}">${freq}</span> Hz</strong></label><input id="freq${i}" type="range" min="100" max="1500" step="10" value="${freq}"><input id="freqNum${i}" class="freq-number" type="number" min="100" max="1500" step="10" value="${freq}" aria-label="Horn ${i+1} frequency in hertz">`;
   const slider=row.querySelector(`#freq${i}`),num=row.querySelector(`#freqNum${i}`);
   const update=v=>{let n=Math.max(100,Math.min(1500,Number(v)||100));A.frequencies[i]=n;slider.value=n;num.value=n;$(`freqVal${i}`).textContent=n;if(A.osc&&A.ctx)A.osc.voices.filter(v=>v.h===i+1).forEach(v=>v.o.frequency.setTargetAtTime(n,A.ctx.currentTime,.02))};
   slider.addEventListener("input",()=>update(slider.value));num.addEventListener("change",()=>update(num.value));freqs.appendChild(row);
 });
}

function offTone(){if(A.osc){A.osc.voices.forEach(v=>{try{v.o.stop()}catch{}});A.osc=null}}
function advance(){if(!A.playing||!A.selected)return;if(A.index>=A.selected.steps.length){if(A.holdMelody){A.index=0;advance();return}A.playing=false;offTone();$("status").textContent="Completed";$("pause").disabled=true;$("bar").style.width="100%";[...$("horns").children].forEach(e=>e.classList.remove("active"));return}let s=A.selected.steps[A.index];render();drawSteps();tone(s.horns);$("status").textContent="Playing";$("pause").disabled=false;A.started=performance.now();A.remaining=s.duration/A.speed;A.timer=setTimeout(()=>{A.index++;advance()},A.remaining)}
async function play(){if(!A.selected)return;try{await audio()}catch(e){$("status").textContent=e.message;return}if(A.paused){A.paused=false;A.playing=true;tone(A.selected.steps[A.index]?.horns||[]);A.started=performance.now();A.timer=setTimeout(()=>{A.index++;advance()},A.remaining);$("status").textContent="Playing";$("pause").disabled=false;return}if(A.index>=A.selected.steps.length)A.index=0;A.playing=true;advance()}
function pause(){if(!A.playing)return;clearTimeout(A.timer);A.remaining=Math.max(0,A.remaining-(performance.now()-A.started));A.playing=false;A.paused=true;offTone();$("status").textContent="Paused";$("pause").disabled=true}
function stop(){clearTimeout(A.timer);A.playing=false;A.paused=false;A.holdMelody=false;$("holdMelody").classList.remove("held");offTone();A.index=0;if(A.selected){$("status").textContent="Stopped";render();drawSteps()}else $("status").textContent="Ready"}
$("file").onchange=async e=>{let f=e.target.files?.[0];if(!f)return;stop();A.melodies=parse(await f.text());A.selected=null;$("filename").textContent=f.name;$("fileinfo").textContent=`${f.size.toLocaleString()} bytes · ${A.melodies.length} melodies found`;$("count").textContent=A.melodies.length;$("summary").textContent=A.melodies.length?`Parsed ${A.melodies.length} melody arrays`:"No arrays detected";$("clear").disabled=false;$("search").value="";drawList();$("title").textContent=A.melodies.length?"Choose a melody":"No melodies found";$("stepdesc").textContent=A.melodies.length?"Select a melody from the list":"Check C array format";$("counter").textContent="Step — / —";$("total").textContent="0 steps";$("steps").innerHTML='<div class="empty">Select a melody on the right to preview its steps.</div>';["holdMelody","play","pause","stop","restart"].forEach(id=>$(id).disabled=true)};
$("search").oninput=drawList;
const holdMelodyBtn=$("holdMelody");
const beginHeldMelody=async ev=>{
 if(ev)ev.preventDefault();
 if(!A.selected||A.holdMelody)return;
 A.holdMelody=true;holdMelodyBtn.classList.add("held");
 try{await audio()}catch(e){A.holdMelody=false;holdMelodyBtn.classList.remove("held");$("status").textContent=e.message;return}
 if(!A.holdMelody)return;
 clearTimeout(A.timer);A.playing=false;A.paused=false;A.index=0;A.playing=true;advance();
};
const endHeldMelody=ev=>{
 if(ev)ev.preventDefault();
 if(!A.holdMelody)return;
 A.holdMelody=false;clearTimeout(A.timer);A.playing=false;A.paused=false;A.index=0;
 holdMelodyBtn.classList.remove("held");offTone();
 if(A.selected){$("status").textContent="Stopped — HORN released";render();drawSteps()}
 $("pause").disabled=true;
};
holdMelodyBtn.addEventListener("pointerdown",async ev=>{
 if(holdMelodyBtn.disabled)return;
 try{holdMelodyBtn.setPointerCapture(ev.pointerId)}catch{}
 await beginHeldMelody(ev);
});
holdMelodyBtn.addEventListener("pointerup",endHeldMelody);
holdMelodyBtn.addEventListener("pointercancel",endHeldMelody);
holdMelodyBtn.addEventListener("lostpointercapture",endHeldMelody);
holdMelodyBtn.addEventListener("keydown",e=>{if((e.key===" "||e.key==="Enter")&&!e.repeat)beginHeldMelody(e)});
holdMelodyBtn.addEventListener("keyup",e=>{if(e.key===" "||e.key==="Enter")endHeldMelody(e)});
$("play").onclick=play;$("pause").onclick=pause;$("stop").onclick=stop;$("restart").onclick=()=>{if(A.selected){stop();play()}};
$("speed").oninput=()=>{
 let n=+$("speed").value;
 $("speedtxt").textContent=(n===1?"1.00× Normal":n.toFixed(2)+"×");
 if(A.playing){
   const elapsed=Math.max(0,performance.now()-A.started);
   const oldWallRemaining=Math.max(0,A.remaining-elapsed);
   clearTimeout(A.timer);
   A.remaining=oldWallRemaining*A.speed/n;
   A.speed=n;A.started=performance.now();
   A.timer=setTimeout(()=>{A.index++;advance()},A.remaining);
 } else A.speed=n;
};
$("vol").oninput=()=>{A.volume=+$("vol").value/100;$("voltxt").textContent=$("vol").value+"%";if(A.master)A.master.gain.setTargetAtTime(A.volume,A.ctx.currentTime,.02)};
$("resetFreq").onclick=()=>{A.frequencies=[300,350,400,450,500,550];buildHornTools();};
document.addEventListener("visibilitychange",()=>{if(document.hidden){A.manualHorn=null;offTone();document.querySelectorAll(".manual-horn.held").forEach(b=>b.classList.remove("held"));if(A.holdMelody)endHeldMelody();}});

$("clear").onclick=()=>{stop();A.melodies=[];A.selected=null;$("file").value="";$("filename").textContent="No file selected";$("fileinfo").textContent="Upload a C/C++ melody file";$("count").textContent="0";$("summary").textContent="Supports MelodyStep arrays";$("list").innerHTML='<div class="empty">Uploaded melodies will appear here one by one.</div>';$("title").textContent="Select a melody";$("stepdesc").textContent="Upload a file to begin";$("counter").textContent="Step — / —";$("total").textContent="0 steps";$("steps").innerHTML='<div class="empty">Upload a file and select a melody from the list.</div>';["play","pause","stop","restart","clear"].forEach(id=>$(id).disabled=true)};
window.onbeforeunload=()=>{A.manualHorn=null;offTone()};
buildHornTools();
