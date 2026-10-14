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
     const numMatch=m[1].match(/\d+/);
     const n=numMatch?+numMatch[0]:(out.length+1);
     const prevStart=Math.max(0, m.index-260);
     const prevChunk=src.slice(prevStart, m.index);
     const tm=prevChunk.match(/🎵\s*Melody\s*\d+\s*[–—\-:]\s*([^\r\n=]+)/i);
     const title=tm?tm[1].trim():"";
     const displayName=title?`Melody ${n} · ${title}`:`Melody ${n}`;
     out.push({id:m[1].toLowerCase().replace(/\s/g,""),num:n,name:displayName,title,source:m[1],steps});
   }
 }
 return out.sort((a,b)=>(a.num||0)-(b.num||0));
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function drawList(){let q=$("search").value.toLowerCase().trim();$("list").innerHTML="";let rows=A.melodies.filter(m=>(m.name+" "+m.source+" "+(m.title||"")).toLowerCase().includes(q));if(!rows.length){$("list").innerHTML='<div class="empty">No matching melodies.</div>';return}rows.forEach(m=>{let b=document.createElement("button");b.className="item"+(A.selected?.id===m.id?" selected":"");const numDisplay=m.num!=null?m.num:(m.name.match(/\d+/)||[1])[0];b.innerHTML=`<span class="num">${numDisplay}</span><span class="itemtext"><b>${esc(m.name)}</b><small>${esc(m.source)} · ${m.steps.length} steps</small></span><span>›</span>`;b.onclick=()=>select(m);$("list").appendChild(b)})}
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
function advance(){if(!A.playing||!A.selected)return;if(A.index>=A.selected.steps.length){if(A.holdMelody){A.index=0;advance();return}A.playing=false;offTone();$("status").textContent="Completed";$("pause").disabled=true;$("bar").style.width="100%";[...$("horns").children].forEach(e=>e.classList.remove("active"));return}let s=A.selected.steps[A.index];render();tone(s.horns);$("status").textContent="Playing";$("pause").disabled=false;A.started=performance.now();A.remaining=s.duration/A.speed;A.timer=setTimeout(()=>{A.index++;advance()},A.remaining)}
async function play(){if(!A.selected)return;try{await audio()}catch(e){$("status").textContent=e.message;return}if(A.paused){A.paused=false;A.playing=true;tone(A.selected.steps[A.index]?.horns||[]);A.started=performance.now();A.timer=setTimeout(()=>{A.index++;advance()},A.remaining);$("status").textContent="Playing";$("pause").disabled=false;return}if(A.index>=A.selected.steps.length)A.index=0;A.playing=true;advance()}
function pause(){if(!A.playing)return;clearTimeout(A.timer);A.remaining=Math.max(0,A.remaining-(performance.now()-A.started));A.playing=false;A.paused=true;offTone();$("status").textContent="Paused";$("pause").disabled=true}
function stop(){clearTimeout(A.timer);A.playing=false;A.paused=false;A.holdMelody=false;$("holdMelody").classList.remove("held");offTone();A.index=0;if(A.selected){$("status").textContent="Stopped";render();drawSteps()}else $("status").textContent="Ready"}
function loadFileContent(name,text,size,autoSelectFirst=true){
 stop();A.melodies=parse(text);A.selected=null;
 $("filename").textContent=name;
 const byteStr=size!=null?`${Number(size).toLocaleString()} bytes · `:"";
 $("fileinfo").textContent=`${byteStr}${A.melodies.length} melodies found`;
 $("count").textContent=A.melodies.length;
 $("summary").textContent=A.melodies.length?`Parsed ${A.melodies.length} melody arrays`:"No arrays detected";
 $("clear").disabled=false;$("search").value="";drawList();
 if(A.melodies.length){
  if(autoSelectFirst){select(A.melodies[0]);}
  else{
   $("title").textContent="Choose a melody";$("stepdesc").textContent="Select a melody from the list";
   $("counter").textContent="Step — / —";$("total").textContent="0 steps";
   $("steps").innerHTML='<div class="empty">Select a melody on the right to preview its steps.</div>';
   ["holdMelody","play","pause","stop","restart"].forEach(id=>$(id).disabled=true);
  }
 }else{
  $("title").textContent="No melodies found";$("stepdesc").textContent="Check C array format";
  $("counter").textContent="Step — / —";$("total").textContent="0 steps";
  $("steps").innerHTML='<div class="empty">Check C array format</div>';
  ["holdMelody","play","pause","stop","restart"].forEach(id=>$(id).disabled=true);
 }
}
async function loadDefaultMelody(){
 try{
  const res=await fetch("asset/source/melody.cpp");
  if(!res.ok)throw Error(`HTTP ${res.status}`);
  const text=await res.text();
  loadFileContent("melody.cpp",text,text.length,true);
  return;
 }catch(e){
  if(window.DEFAULT_MELODY_SRC){
   loadFileContent(window.DEFAULT_MELODY_FILENAME||"melody.cpp",window.DEFAULT_MELODY_SRC,window.DEFAULT_MELODY_SIZE||window.DEFAULT_MELODY_SRC.length,true);
  }
 }
}
$("file").onchange=async e=>{let f=e.target.files?.[0];if(!f)return;loadFileContent(f.name,await f.text(),f.size,true)};
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

$("clear").onclick=()=>{stop();A.melodies=[];A.selected=null;$("file").value="";$("filename").textContent="No file selected";$("fileinfo").textContent="Upload a C/C++ melody file";$("count").textContent="0";$("summary").textContent="Supports MelodyStep arrays";$("list").innerHTML='<div class="empty">Uploaded melodies will appear here one by one.</div>';$("title").textContent="Select a melody";$("stepdesc").textContent="Upload a file to begin";$("counter").textContent="Step — / —";$("total").textContent="0 steps";$("steps").innerHTML='<div class="empty">Upload a file and select a melody from the list.</div>';["holdMelody","play","pause","stop","restart","clear"].forEach(id=>$(id).disabled=true)};
window.onbeforeunload=()=>{A.manualHorn=null;offTone()};
buildHornTools();
loadDefaultMelody();


/* Tune Composer: record physical keyboard key-hold time and gaps, preview, export C++. */
(()=>{
 const $c=id=>document.getElementById(id);
 const keys={x:1,c:2,v:3,b:4,n:5,m:6};
 const down=new Map();
 let recording=false, previewing=false, previewTimer=null, previewIndex=0, lastRelease=null, audioCtx=null, master=null, activeOsc=[];
 let steps=[];
 const now=()=>performance.now();
 function composerAudio(){
   const C=window.AudioContext||window.webkitAudioContext;
   if(!C)throw Error("Web Audio is not supported in this browser.");
   if(!audioCtx){audioCtx=new C();master=audioCtx.createGain();master.gain.value=.22;master.connect(audioCtx.destination)}
   return audioCtx.resume();
 }
 function playHorn(horns){
   stopOsc();
   if(!horns.length)return;
   horns.forEach(h=>{
     const o=audioCtx.createOscillator(),g=audioCtx.createGain();
     o.type="sawtooth";o.frequency.value=[300,350,400,450,500,550][h-1]||400;
     g.gain.value=.22/Math.sqrt(horns.length);o.connect(g);g.connect(master);o.start();activeOsc.push(o);
   });
 }
 function stopOsc(){activeOsc.forEach(o=>{try{o.stop()}catch{}});activeOsc=[]}
 function fmt(ms){return `${Math.round(ms)} ms`}
 function paint(){
   $c("composeCount").textContent=`${steps.length} steps`;
   $c("composeClock").textContent=`${steps.filter(s=>s.horn).length} notes`;
   $c("composeUndo").disabled=!steps.length;
   $c("composePlay").disabled=!steps.some(s=>s.horn)||recording;
   $c("composeDone").disabled=!steps.some(s=>s.horn)||recording;
   const box=$c("composeSteps");
   if(!steps.length){box.innerHTML='<div class="empty">Start recording, then hold X, C, V, B, N or M to compose your tone.</div>';return}
   box.innerHTML=steps.map((s,i)=>`<div class="compose-step"><span>${i+1}</span><b class="${s.horn?'on':'silence'}">${s.horn?`HORN ${s.horn} (${s.key.toUpperCase()})`:"SILENCE / GAP"}</b><small>${fmt(s.ms)}</small><button type="button" data-remove="${i}" aria-label="Remove step">×</button></div>`).join("");
   box.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{if(recording)return;steps.splice(+b.dataset.remove,1);paint()});
 }
 function stopRecording(){
   recording=false;
   down.clear();
   document.querySelectorAll(".compose-key.held").forEach(b=>b.classList.remove("held"));
   $c("composeRecord").disabled=false;$c("composeStopRecord").disabled=true;
   $c("composeState").textContent="Recording stopped";
   paint();
 }
 function keyDown(k, sourceEvent){
   if(!recording||!(k in keys)||down.has(k))return;
   if(sourceEvent)sourceEvent.preventDefault();
   const t=now();
   if(lastRelease!==null){
     const gap=Math.max(0,t-lastRelease);
     if(gap>0)steps.push({horn:0,ms:gap,key:""});
   }
   down.set(k,{start:t,horn:keys[k]});
   document.querySelector(`.compose-key[data-key="${k}"]`)?.classList.add("held");
   composerAudio().then(()=>playHorn([keys[k]])).catch(()=>{});
   $c("composeState").textContent=`Recording ${k.toUpperCase()} · hold to set duration`;
 }
 function keyUp(k, sourceEvent){
   if(!recording||!down.has(k))return;
   if(sourceEvent)sourceEvent.preventDefault();
   const rec=down.get(k),t=now(),duration=Math.max(1,t-rec.start);
   down.delete(k);document.querySelector(`.compose-key[data-key="${k}"]`)?.classList.remove("held");
   stopOsc();
   steps.push({horn:rec.horn,ms:duration,key:k});
   lastRelease=t;
   $c("composeState").textContent=`Captured ${k.toUpperCase()} · ${Math.round(duration)} ms`;
   paint();
 }
 function stopPreview(){previewing=false;clearTimeout(previewTimer);stopOsc();$c("composeStopPlay").disabled=true;$c("composePlay").disabled=!steps.some(s=>s.horn)||recording;$c("composeState").textContent="Preview stopped"}
 async function preview(){
   if(recording||!steps.length)return;
   try{await composerAudio()}catch(e){$c("composeState").textContent=e.message;return}
   previewing=true;previewIndex=0;$c("composeStopPlay").disabled=false;$c("composePlay").disabled=true;
   const tick=()=>{
     if(!previewing)return;
     if(previewIndex>=steps.length){
       if($c("composeMode").value==="loop")previewIndex=0;
       else {stopPreview();$c("composeState").textContent="Preview completed";return}
     }
     const s=steps[previewIndex++];playHorn(s.horn?[s.horn]:[]);
     previewTimer=setTimeout(tick,Math.max(1,s.ms/(+$c("composeTempo").value||1)));
   };
   tick();
 }
 function exportCpp(){
   const toneSteps=steps.filter(s=>s.ms>0);
   if(!toneSteps.some(s=>s.horn))return;
   const raw=($c("composeName").value||"MyTone").trim();
   const safe=raw.replace(/[^a-zA-Z0-9_]/g,"").replace(/^[0-9]+/,"")||"MyTone";
   const arrayName=safe[0].toLowerCase()+safe.slice(1);
   const rows=toneSteps.map(s=>`  {${s.horn?`H${s.horn}`:"0"}, ${Math.max(1,Math.round(s.ms))}}, // ${s.horn?`key ${s.key.toUpperCase()} hold`:"key release gap"}`);
   const source=`// Generated by BLT MD DEVICE Tune Composer\n// Key-hold durations and release gaps are recorded in milliseconds.\n// Low tones: X=H1, C=H2, V=H3. High tones: B=H4, N=H5, M=H6.\n// Playback mode selected in the browser: ${$c("composeMode").value==="loop"?"LOOP":"ONCE"}\n\nstruct MelodyStep { int horn; unsigned long duration; };\n// Define H1..H6 in your firmware to match your horn channels.\nconst MelodyStep ${arrayName}[] = {\n${rows.join(",\n")}\n};\nconst unsigned int ${arrayName}Count = sizeof(${arrayName}) / sizeof(${arrayName}[0]);\n`;
   const blob=new Blob([source],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download="tone.cpp";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
   $c("composeState").textContent="Done · tone.cpp downloaded";
 }
 $c("composeOpen").onclick=()=>{
   stopPreview();
   $c("playerView").hidden=true;$c("composerView").hidden=false;
   window.scrollTo({top:0,behavior:"instant"});
 };
 $c("composerBack").onclick=()=>{
   stopPreview();if(recording)stopRecording();
   $c("composerView").hidden=true;$c("playerView").hidden=false;
   window.scrollTo({top:0,behavior:"instant"});
 };
 $c("composeRecord").onclick=()=>{
   stopPreview();steps=[];down.clear();lastRelease=null;recording=true;
   $c("composeRecord").disabled=true;$c("composeStopRecord").disabled=false;
   $c("composeState").textContent="Recording · press and hold X, C, V, B, N or M";
   paint();
 };
 $c("composeStopRecord").onclick=()=>{for(const k of [...down.keys()])keyUp(k);stopRecording()};
 $c("composeClear").onclick=()=>{stopPreview();stopRecording();steps=[];lastRelease=null;paint();$c("composeState").textContent="Cleared · ready to record"};
 $c("composeUndo").onclick=()=>{if(!recording&&steps.length){steps.pop();lastRelease=null;paint()}};
 $c("composePlay").onclick=preview;$c("composeStopPlay").onclick=stopPreview;$c("composeDone").onclick=exportCpp;
 $c("composeTempo").oninput=()=>{$c("composeTempoText").textContent=(+$c("composeTempo").value).toFixed(2)+"×"};
 document.querySelectorAll(".compose-key").forEach(b=>{
   const k=b.dataset.key;
   b.addEventListener("pointerdown",e=>{if(!recording)return;e.preventDefault();try{b.setPointerCapture(e.pointerId)}catch{}keyDown(k,e)});
   b.addEventListener("pointerup",e=>keyUp(k,e));b.addEventListener("pointercancel",e=>keyUp(k,e));b.addEventListener("lostpointercapture",e=>keyUp(k,e));
 });
 document.addEventListener("keydown",e=>{
   if($c("composerView").hidden||e.repeat)return;
   const k=e.key.toLowerCase();if(k in keys)keyDown(k,e);
 });
 document.addEventListener("keyup",e=>{
   if($c("composerView").hidden)return;
   const k=e.key.toLowerCase();if(k in keys)keyUp(k,e);
 });
 window.addEventListener("blur",()=>{if(recording){for(const k of [...down.keys()])keyUp(k)}});
 paint();
})();
