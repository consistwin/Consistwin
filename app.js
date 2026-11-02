"use strict";

/* CONSISTWIN — browser-based edition */

const $ = id => document.getElementById(id);
const today = () => localDate(new Date());
function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function uid() {
  return Date.now().toString(36)+Math.random().toString(36).slice(2,8);
}
function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function readStore() {
  try { return JSON.parse(localStorage.getItem("consistwin-v1")) || {}; }
  catch { return {}; }
}
const initial = readStore();
let state = {
  routines: Array.isArray(initial.routines) ? initial.routines : [],
  completions: initial.completions || {},
  activities: initial.activities || {},
  workouts: Array.isArray(initial.workouts) ? initial.workouts : [],
  misses: initial.misses || {},
  rests: initial.rests || {},
  page:"dashboard",
  month:new Date().getMonth(),
  year:new Date().getFullYear(),
  selectedDate:today(),
  calendarId:"Gym",
  coach:"science",
  editingId:null,
  sets:[{weight:"",reps:"",rir:"2"}],
  selectedExercise:""
};

function save() {
  localStorage.setItem("consistwin-v1",JSON.stringify({
    routines:state.routines,completions:state.completions,
    activities:state.activities,workouts:state.workouts,misses:state.misses,
    rests:state.rests
  }));
  checkLevelUp();
}
function toast(msg) {
  $("toast").textContent=msg;
  $("toast").classList.add("show");
  setTimeout(()=>$("toast").classList.remove("show"),2200);
}
function showPage(page) {
  state.page=page;
  document.querySelectorAll(".nav[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  const titles={dashboard:"Dashboard",routines:"Daily routines",calendar:"Activity calendars",workouts:"Workout tracker",progress:"Progress & PRs",coaches:"Your coaches",settings:"Settings & backup"};
  $("pageTitle").textContent=titles[page]||"Dashboard";
  $("todayLabel").textContent=page==="dashboard"?"YOUR JOURNEY STARTS HERE":"SHOW UP. LEVEL UP.";
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".nav[data-page]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page)));
$("dateChip").textContent=new Date().toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});

function completedRoutines(date=today()) {
  return state.routines.filter(r=>(state.completions[date]||[]).includes(r.id));
}
function workoutDays() {
  return [...new Set(state.workouts.map(w=>w.date))];
}
function workoutVolume(w) {
  return (w.sets||[]).reduce((n,s)=>n+(Number(s.weight)||0)*(Number(s.reps)||0),0);
}
function allSets(exercise) {
  return state.workouts.filter(w=>w.exercise.toLowerCase()===exercise.toLowerCase())
    .flatMap(w=>(w.sets||[]).map(s=>({...s,date:w.date,workoutId:w.id})))
    .filter(s=>Number(s.weight)>0 && Number(s.reps)>0)
    .sort((a,b)=>a.date.localeCompare(b.date));
}
function estimate1RM(weight,reps) {
  weight=Number(weight);reps=Number(reps);
  if(weight<=0||reps<1||reps>15)return null;
  return reps===1?weight:weight*(1+reps/30);
}
function exercisePR(exercise) {
  const sets=allSets(exercise);
  if(!sets.length)return null;
  return sets.reduce((best,s)=>{
    const est=estimate1RM(s.weight,s.reps);
    return est && (!best||est>best.est)?{...s,est}:best;
  },null);
}
function uniqueExercises() {
  return [...new Set(state.workouts.map(w=>w.exercise).filter(Boolean))].sort();
}
function recentWorkouts() {
  return [...state.workouts].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
}
/* A rest day (on any calendar) keeps the streak alive without adding to it. */
function isRestDay(date) {
  return Object.values(state.rests[date]||{}).some(Boolean);
}
function dayStreak() {
  const dates=new Set([...workoutDays(),...Object.keys(state.completions).filter(d=>state.completions[d]?.length)]);
  const ok=x=>dates.has(x)||isRestDay(x);
  let d=new Date();if(!ok(localDate(d)))d.setDate(d.getDate()-1);
  let n=0;
  while(ok(localDate(d))){
    if(dates.has(localDate(d)))n++;
    d.setDate(d.getDate()-1);
  }
  return n;
}
function dayName(date) {
  return new Date(date+"T12:00:00").toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});
}
function stat(title,value,note,mark="↗") {
  return `<div class="stat"><div class="stat-top"><span>${title}</span><span class="stat-mark">${mark}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;
}
function empty(text) {return `<div class="empty">${text}</div>`;}
function panel(title,body,extra="") {
  return `<section class="panel"><div class="panel-head"><h2>${title}</h2>${extra}</div>${body}</section>`;
}
function render() {
  const pages={dashboard:renderDashboard,routines:renderRoutines,calendar:renderCalendar,
    workouts:renderWorkouts,progress:renderProgress,coaches:renderCoaches,settings:renderSettings};
  $("app").innerHTML=(pages[state.page]||renderDashboard)();
}

/* DASHBOARD */
function renderDashboard() {
  const done=completedRoutines().length,total=state.routines.length;
  const pct=total?Math.round(done/total*100):0;
  const week=new Date();week.setDate(week.getDate()-6);
  const weekly=workoutDays().filter(d=>d>=localDate(week)&&d<=today()).length;
  const routines=state.routines.length?state.routines.map(r=>{
    const checked=(state.completions[today()]||[]).includes(r.id);
    return `<div class="list-item"><input class="check" type="checkbox" ${checked?"checked":""} onchange="toggleRoutine('${r.id}',this.checked)">
      <div class="item-main"><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.category)}</small></div>
      ${checked?'<span class="pill">DONE</span>':""}</div>`;
  }).join(""):empty("Add your first routine to start tracking consistency.");
  const latest=recentWorkouts().slice(0,4);
  return `${levelBanner()}<div class="grid stats">
    ${stat("TODAY'S ROUTINES",`${done}/${total}`,total?"Daily completion":"Create your first routine","✓")}
    ${stat("COMPLETION",pct+"%", "Today's routine progress","◉")}
    ${stat("WORKOUTS · 7 DAYS",weekly,"Logged in the last 7 days","↗")}
    ${stat("CURRENT STREAK",dayStreak()+" days","Rest days keep it going","✦")}
  </div>
  <div class="grid two-col">
    ${panel("Today's focus",`<div class="big-progress"><div class="ring" style="--progress:${pct*3.6}deg"><strong>${pct}%</strong></div><div><h2>${pct===100&&total?"All routines complete!":total?"Keep showing up.":"Start small. Stay consistent."}</h2><p class="small">${done} of ${total} routines completed today.</p><button class="secondary" onclick="showPage('routines')">Manage routines →</button></div></div>`)}
    ${panel("Daily routines",routines,`<button class="secondary" onclick="newRoutine()">+ Add</button>`)}
    <div class="panel"><div class="panel-head"><h2>Recent workouts</h2><button class="secondary" onclick="showPage('workouts')">View all</button></div>
    ${latest.length?latest.map(w=>`<div class="list-item"><div class="item-main"><strong>${escapeHTML(w.exercise)}</strong><small>${escapeHTML(w.name)} · ${escapeHTML(w.date)}</small></div><span class="pill">${Math.round(workoutVolume(w)).toLocaleString()} kg vol.</span></div>`).join(""):empty("Your workout history will appear here.")}</div>
    ${panel("Your next step",`<div class="stack"><div class="row"><div><strong>Track a session</strong><div class="small">Record exercises and sets.</div></div><button class="secondary" onclick="openWorkout()">Log →</button></div><div class="row"><div><strong>Review your progress</strong><div class="small">Check estimated strength and PRs.</div></div><button class="secondary" onclick="showPage('progress')">Review →</button></div><div class="row"><div><strong>Plan your consistency</strong><div class="small">Mark training and rest days.</div></div><button class="secondary" onclick="showPage('calendar')">Calendar →</button></div></div>`)}
  </div>
  ${badgesPanel()}`;
}

/* ROUTINES */
function newRoutine() {$("routineForm").reset();$("routineDialog").showModal();}
$("routineForm").addEventListener("submit",e=>{
  e.preventDefault();
  state.routines.push({id:uid(),name:$("routineName").value.trim(),category:$("routineCategory").value});
  save();$("routineDialog").close();render();toast("Routine created");
});
function toggleRoutine(id,checked) {
  const list=state.completions[today()]||[];
  state.completions[today()]=checked?[...new Set([...list,id])]:list.filter(x=>x!==id);
  save();render();
}
function deleteRoutine(id) {
  if(!confirm("Delete this routine? Past completion records may still contain its ID."))return;
  state.routines=state.routines.filter(r=>r.id!==id);save();render();
}
function renderRoutines() {
  const done=completedRoutines().length,total=state.routines.length;
  return `<div class="grid stats">${stat("TOTAL ROUTINES",total,"Your active habits")}${stat("DONE TODAY",done,"Completed habits")}${stat("LEFT TODAY",Math.max(0,total-done),"Still to do")}${stat("TODAY",total?Math.round(done/total*100)+"%":"0%","Completion rate")}</div>
  ${panel("Your routines",state.routines.length?state.routines.map(r=>{
    const checked=(state.completions[today()]||[]).includes(r.id);
    return `<div class="list-item"><input class="check" type="checkbox" ${checked?"checked":""} onchange="toggleRoutine('${r.id}',this.checked)"><div class="item-main"><strong>${escapeHTML(r.name)}</strong><small>${escapeHTML(r.category)}</small></div><button class="icon-btn" onclick="deleteRoutine('${r.id}')">✕</button></div>`;
  }).join(""):empty("No routines yet. Create one to begin."),`<button class="primary" onclick="newRoutine()">+ New routine</button>`)}
  <p class="small">Completion is recorded by date. Use routines that fit your life, including study, recovery, and training.</p>`;
}

/* CALENDARS
   A day can be done, missed, or rest. Setting one clears the other two. */
function dayKey(date){return date;}
function isMarkedDone(date,id=state.calendarId) {
  return (state.activities[date]||[]).includes(id);
}
function isMarkedMissed(date,id=state.calendarId) {
  return !!state.misses[date]?.[id];
}
function isMarkedRest(date,id=state.calendarId) {
  return !!state.rests[date]?.[id];
}
function markActivity(date,id,done) {
  const a=new Set(state.activities[date]||[]);
  if(done){
    a.add(id);
    delete state.misses[date]?.[id];
    delete state.rests[date]?.[id];
  } else a.delete(id);
  state.activities[date]=[...a];save();render();
}
function markMissed(date,id) {
  state.misses[date]=state.misses[date]||{};
  const on=!state.misses[date][id];
  state.misses[date][id]=on;
  if(on){
    state.activities[date]=(state.activities[date]||[]).filter(x=>x!==id);
    delete state.rests[date]?.[id];
  }
  save();render();
}
function markRest(date,id) {
  state.rests[date]=state.rests[date]||{};
  const on=!state.rests[date][id];
  state.rests[date][id]=on;
  if(on){
    state.activities[date]=(state.activities[date]||[]).filter(x=>x!==id);
    delete state.misses[date]?.[id];
  }
  save();render();
}
function monthCalendar(month,year,compact=false) {
  const first=new Date(year,month,1),last=new Date(year,month+1,0);
  let html=["M","T","W","T","F","S","S"].map(x=>`<div class="cal-day-label">${x}</div>`).join("");
  let offset=(first.getDay()+6)%7;
  for(let i=0;i<offset;i++)html+=`<div></div>`;
  for(let day=1;day<=last.getDate();day++){
    const d=localDate(new Date(year,month,day));
    const done=isMarkedDone(d),miss=isMarkedMissed(d),rest=isMarkedRest(d);
    const cls=[d===today()?"today":"",done?"done":"",miss?"missed":"",rest?"rest":""].filter(Boolean).join(" ");
    const note=done?" · completed":miss?" · marked missed":rest?" · rest day":"";
    html+=`<button class="cal-cell ${cls}" onclick="selectCalendarDay('${d}')" title="${escapeHTML(d)}${note}">
      <span>${day}</span>${done&&!compact?'<span class="cell-mark">✓</span>':""}</button>`;
  }
  return `<div class="calendar-grid">${html}</div>`;
}
function renderCalendar() {
  const months=Array.from({length:12},(_,m)=>`<div class="year-month"><h3>${new Date(state.year,m,1).toLocaleDateString(undefined,{month:"long"})}</h3>${monthCalendar(m,state.year,true)}</div>`).join("");
  const ids=["Gym","Personal"];
  const options=ids.map(x=>`<option ${state.calendarId===x?"selected":""}>${x}</option>`).join("");
  const day=state.selectedDate;
  const activities=state.activities[day]||[];
  const status=isMarkedDone(day)?"Completed":isMarkedMissed(day)?"Marked missed":isMarkedRest(day)?"Rest day":"Not marked";
  return `<div class="toolbar"><select onchange="state.calendarId=this.value;render()">${options}</select><button class="secondary" onclick="changeMonth(-1)">← Month</button><button class="secondary" onclick="state.month=new Date().getMonth();state.year=new Date().getFullYear();render()">Today</button><button class="secondary" onclick="changeMonth(1)">Month →</button><button class="primary" onclick="toggleCalendarView()">${window.calendarYear?"Monthly view":"Yearly view"}</button></div>
  <div class="grid two-col">
  ${panel(new Date(state.year,state.month,1).toLocaleDateString(undefined,{month:"long",year:"numeric"}),window.calendarYear?`<div class="year-grid">${months}</div>`:monthCalendar(state.month,state.year))}
  ${panel("Selected day",`<h2>${dayName(day)}</h2><p class="small">Choose how this day is recorded. Unmarked days remain neutral, not missed.</p>
    <div class="list-item"><div class="item-main"><strong>${escapeHTML(state.calendarId)}</strong><small>${status}</small></div><button class="${isMarkedDone(day)?"secondary":"primary"}" onclick="markActivity('${day}','${state.calendarId}',${!isMarkedDone(day)})">${isMarkedDone(day)?"Undo":"Mark done"}</button></div>
    <div class="list-item"><div class="item-main"><strong>Rest day</strong><small>Planned recovery. It keeps your streak alive.</small></div><button class="secondary" onclick="markRest('${day}','${state.calendarId}')">${isMarkedRest(day)?"Undo":"Mark rest"}</button></div>
    <div class="list-item"><div class="item-main"><strong>Missed day</strong><small>Use only when you skipped a planned day.</small></div><button class="secondary" onclick="markMissed('${day}','${state.calendarId}')">${isMarkedMissed(day)?"Undo":"Mark missed"}</button></div>
    <h3>All activities for this date</h3>${activities.length?activities.map(a=>`<div class="pill">${escapeHTML(a)}</div>`).join(" "):empty("No activities completed on this date.")}
    <label>Choose date<input type="date" value="${day}" onchange="state.selectedDate=this.value;render()"></label>`)}
  </div><p class="small">Green = completed. Red = missed. Blue = rest day.</p>`;
}
window.calendarYear=false;
function toggleCalendarView(){window.calendarYear=!window.calendarYear;render();}
function changeMonth(n){state.month+=n;if(state.month<0){state.month=11;state.year--;}if(state.month>11){state.month=0;state.year++;}render();}
function selectCalendarDay(d){state.selectedDate=d;render();}

/* WORKOUTS */
function openWorkout(id=null) {
  state.editingId=id;
  const w=id?state.workouts.find(x=>x.id===id):null;
  $("workoutDialogTitle").textContent=w?"Edit workout":"Log workout";
const t=today();
if(!w && window.nameDay!==t) $("workoutName").value="";
window.nameDay=t;
$("workoutDate").value=w?w.date:t;
$("workoutName").value=w?(w.name||""):$("workoutName").value;
  $("exerciseName").value=w?.exercise||"";
  $("workoutNotes").value=w?.notes||"";
  state.sets=w?JSON.parse(JSON.stringify(w.sets)): [{weight:"",reps:"",rir:"2"}];
  $("exerciseList").innerHTML=uniqueExercises().map(x=>`<option value="${escapeHTML(x)}"></option>`).join("");
  renderSets();
  updateLastHint();
  $("workoutDialog").showModal();
}
function closeWorkout(){$("workoutDialog").close();}
function addSet(){state.sets.push({weight:"",reps:"",rir:"2"});renderSets();}
function removeSet(i){state.sets.splice(i,1);if(!state.sets.length)state.sets.push({weight:"",reps:"",rir:"2"});renderSets();}
function renderSets() {
  $("setsEditor").innerHTML=`<p class="eyebrow">SETS · WEIGHT IN KG</p>
    <div class="set-row"><span>#</span><span>Weight</span><span>Reps</span><span>RIR</span><span></span></div>`+
    state.sets.map((s,i)=>`<div class="set-row"><span>${i+1}</span>
    <input aria-label="Set ${i+1} weight in kg" type="number" min="0" step=".5" placeholder="kg" value="${escapeHTML(s.weight)}" onchange="updateSet(${i},'weight',this.value)">
    <input aria-label="Set ${i+1} reps" type="number" min="0" step="1" placeholder="reps" value="${escapeHTML(s.reps)}" onchange="updateSet(${i},'reps',this.value)">
    <input aria-label="Set ${i+1} reps in reserve" type="number" min="0" max="10" step="1" placeholder="RIR" value="${escapeHTML(s.rir)}" onchange="updateSet(${i},'rir',this.value)">
    <button type="button" aria-label="Remove set" onclick="removeSet(${i})">×</button></div>`).join("");
}
function updateSet(i,key,value){state.sets[i][key]=value;}

/* LAST SESSION HINT: shows what you lifted last time and a target to beat. */
function lastSession(exercise,excludeId) {
  const key=String(exercise||"").trim().toLowerCase();
  if(!key)return null;
  const date=$("workoutDate").value||today();
  return state.workouts
    .filter(w=>w.id!==excludeId&&w.date<=date&&String(w.exercise).toLowerCase()===key&&(w.sets||[]).length)
    .sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0))[0]||null;
}
function beatTarget(w) {
  const top=[...w.sets].sort((a,b)=>b.weight-a.weight||b.reps-a.reps)[0];
  if(!(top.weight>0))return `Aim for ${top.reps+1} reps`;
  if(top.reps>=12)return `Aim for ${+(top.weight+2.5).toFixed(1)} kg × 8`;
  return `Aim for ${top.weight} kg × ${top.reps+1}`;
}
function updateLastHint() {
  const box=$("lastHint");
  if(!box)return;
  const w=lastSession($("exerciseName").value,state.editingId);
  if(!w){box.hidden=true;box.innerHTML="";return;}
  const sets=w.sets.map(s=>`${s.weight} kg × ${s.reps}`).join(" · ");
  box.hidden=false;
  box.innerHTML=`<strong>Last time · ${escapeHTML(w.date)}</strong><div class="small">${escapeHTML(sets)}</div><div style="margin:8px 0">Beat it: <strong>${beatTarget(w)}</strong></div><button type="button" class="secondary" onclick="copyLastSets()">Copy last sets</button>`;
}
function copyLastSets() {
  const w=lastSession($("exerciseName").value,state.editingId);
  if(!w)return;
  state.sets=w.sets.map(s=>({weight:s.weight,reps:s.reps,rir:s.rir===null||s.rir===undefined?"2":s.rir}));
  renderSets();
  toast("Copied last session's sets");
}
(function setupLastHint(){
  const input=$("exerciseName");
  const hint=document.createElement("div");
  hint.id="lastHint";hint.className="coach-message";hint.hidden=true;
  input.closest("label").after(hint);
  const list=document.createElement("datalist");
  list.id="exerciseList";
  document.body.appendChild(list);
  input.setAttribute("list","exerciseList");
  input.addEventListener("input",updateLastHint);
  $("workoutDate").addEventListener("change",updateLastHint);
})();

$("workoutForm").addEventListener("submit",e=>{
  e.preventDefault();
  const exercise=$("exerciseName").value.trim();
  if(!exercise)return;
  const sets=state.sets.filter(s=>s.weight!==""&&s.reps!==""&&Number(s.weight)>=0&&Number(s.reps)>=1)
    .map(s=>({weight:Number(s.weight),reps:Number(s.reps),rir:s.rir===""?null:Number(s.rir)}));
  if(!sets.length){toast("Enter at least one set with weight and reps");return;}
  const old=state.workouts.find(w=>w.id===state.editingId);
  const w={id:state.editingId||uid(),date:$("workoutDate").value,name:$("workoutName").value.trim(),
    exercise,sets,notes:$("workoutNotes").value.trim(),createdAt:old?.createdAt||Date.now()};
  if(old)state.workouts=state.workouts.map(x=>x.id===old.id?w:x);
  else state.workouts.push(w);
  save();closeWorkout();render();toast(old?"Workout updated":"Workout saved");
});
function deleteWorkout(id) {
  if(!confirm("Delete this workout entry?"))return;
  state.workouts=state.workouts.filter(w=>w.id!==id);save();render();toast("Workout deleted");
}
function renderWorkouts() {
  const list=recentWorkouts();
  const exerciseOptions=uniqueExercises().map(x=>`<option>${escapeHTML(x)}</option>`).join("");
  const records=list.filter(w=>!state.selectedExercise||w.exercise===state.selectedExercise);
  return `<div class="toolbar"><select onchange="state.selectedExercise=this.value;render()"><option value="">All exercises</option>${exerciseOptions}</select><button class="primary" onclick="openWorkout()">+ Log workout</button></div>
  <div class="grid stats">${stat("LOGGED ENTRIES",records.length,"Workout records")}${stat("EXERCISES",uniqueExercises().length,"Distinct exercises")}${stat("TOTAL VOLUME",Math.round(records.reduce((n,w)=>n+workoutVolume(w),0)).toLocaleString()+" kg","Weight × reps across sets")}${stat("TRAINING DAYS",new Set(records.map(w=>w.date)).size,"Dates with these entries")}</div>
  ${panel("Workout history",records.length?`<div class="stack">${records.map(w=>`<div class="list-item"><div class="item-main"><strong>${escapeHTML(w.exercise)}</strong><small>${escapeHTML(w.name)} · ${escapeHTML(w.date)} · ${(w.sets||[]).length} sets · ${Math.round(workoutVolume(w)).toLocaleString()} kg volume</small><small>${(w.sets||[]).map(s=>`${s.weight} kg × ${s.reps}${s.rir===null?"":` @ ${s.rir} RIR`}`).join(" · ")}</small>${w.notes?`<small>${escapeHTML(w.notes)}</small>`:""}</div><button class="icon-btn" onclick="openWorkout('${w.id}')">Edit</button><button class="icon-btn" onclick="deleteWorkout('${w.id}')">✕</button></div>`).join("")}</div>`:empty("No workout entries yet. Log your first exercise to start tracking strength.") )}
  <p class="small">RIR means reps in reserve: your estimated number of additional reps before failure. Enter honest estimates; the number is not a precise measurement.</p>`;
}
/* PROGRESS CHART */
window.chartMode="w";
function progressChart(){
  const ex=state.selectedExercise||uniqueExercises()[0]||"";
  if(!ex)return "";
  const byDay={};
  allSets(ex).forEach(s=>{
    const v=window.chartMode==="e"?estimate1RM(s.weight,s.reps):Number(s.weight);
    if(v&&(!byDay[s.date]||v>byDay[s.date]))byDay[s.date]=v;
  });
  const pts=Object.keys(byDay).sort().map(d=>({d,v:byDay[d]}));
  const unit=window.chartMode==="e"?"Estimated 1RM":"Top weight";
  const toggle=`<div class="toolbar"><button class="secondary" onclick="window.chartMode='w';render()">Top weight</button><button class="secondary" onclick="window.chartMode='e';render()">Estimated 1RM</button></div>`;
  if(pts.length<2)return panel("Progress over time: "+escapeHTML(ex),toggle+`<p class="small">Log this exercise on at least 2 different days to see a graph.</p>`);
  const W=340,H=200,L=40,R=12,T=14,B=28;
  const vals=pts.map(p=>p.v);
  let lo=Math.min(...vals),hi=Math.max(...vals);
  if(hi===lo){hi+=1;lo-=1;}
  const t0=Date.parse(pts[0].d),t1=Date.parse(pts[pts.length-1].d);
  const X=p=>L+(t1===t0?0:(Date.parse(p.d)-t0)/(t1-t0))*(W-L-R);
  const Y=p=>T+(1-(p.v-lo)/(hi-lo))*(H-T-B);
  const line=pts.map(p=>X(p).toFixed(1)+","+Y(p).toFixed(1)).join(" ");
  const dots=pts.map(p=>`<circle cx="${X(p).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="4" fill="#9be15d"/>`).join("");
  const fmt=d=>new Date(d+"T00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"});
  const first=vals[0],last=vals[vals.length-1],mid=vals[Math.floor((vals.length-1)/2)];
  const d1=mid-first,d2=last-mid,change=last-first;
  let msg;
  const recent=vals.slice(-3);
  if(vals.length>=3&&Math.max(...recent)-Math.min(...recent)<0.5)msg="Plateau: no change over your last 3 sessions.";
  else if(change>0&&vals.length>=4&&d1>0&&d2<d1*0.5)msg="Going up, but the rate of increase is slowing down.";
  else if(change>0)msg="Going up: +"+change.toFixed(1)+" kg since "+fmt(pts[0].d)+".";
  else if(change<0)msg="Going down: "+change.toFixed(1)+" kg since "+fmt(pts[0].d)+".";
  else msg="No overall change since "+fmt(pts[0].d)+".";
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    <line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#2c332e"/>
    <line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#2c332e"/>
    <polyline points="${line}" fill="none" stroke="#9be15d" stroke-width="2.5"/>${dots}
    <text x="${L-6}" y="${T+4}" text-anchor="end" font-size="11" fill="#9aa39c">${hi.toFixed(0)}</text>
    <text x="${L-6}" y="${H-B}" text-anchor="end" font-size="11" fill="#9aa39c">${lo.toFixed(0)}</text>
    <text x="${L}" y="${H-8}" font-size="11" fill="#9aa39c">${fmt(pts[0].d)}</text>
    <text x="${W-R}" y="${H-8}" text-anchor="end" font-size="11" fill="#9aa39c">${fmt(pts[pts.length-1].d)}</text>
  </svg>`;
  return panel(unit+" over time: "+escapeHTML(ex),toggle+svg+`<p class="small"><strong>${msg}</strong> Latest: ${last.toFixed(1)} kg.</p>`);
}
const _renderProgressOld=renderProgress;
renderProgress=function(){return _renderProgressOld()+progressChart();};
/* PROGRESS */
function renderProgress() {
  const exercises=uniqueExercises();
  const selected=state.selectedExercise||exercises[0]||"";
  const sets=selected?allSets(selected):[];
  const best=selected?exercisePR(selected):null;
  const trend=sets.slice(-8);
  const max=trend.length?Math.max(...trend.map(s=>estimate1RM(s.weight,s.reps)||0)):0;
  const bars=trend.map(s=>{
    const v=estimate1RM(s.weight,s.reps)||0;
    return `<div class="bar-group"><span class="bar-value">${v.toFixed(0)}</span><div class="bar" style="height:${Math.max(3,v/max*100)}%"></div><span class="bar-label">${s.date.slice(5)}</span></div>`;
  }).join("");
  const option=exercises.map(x=>`<option ${x===selected?"selected":""}>${escapeHTML(x)}</option>`).join("");
  const prRows=exercises.map(x=>{
    const p=exercisePR(x);
    return p?`<tr><td>${escapeHTML(x)}</td><td>${p.weight} kg × ${p.reps}</td><td>${p.est.toFixed(1)} kg</td><td>${p.date}</td></tr>`:"";
  }).join("");
  return `<div class="toolbar"><label style="margin:0;min-width:220px">Exercise<select onchange="state.selectedExercise=this.value;render()"><option value="">Choose exercise</option>${option}</select></label></div>
  <div class="grid stats">${stat("EXERCISES TRACKED",exercises.length,"With logged workouts")}${stat("BEST EST. 1RM",best?best.est.toFixed(1)+" kg":"—",best?"Estimate from best logged set":"Log sets to calculate")}${stat("BEST SET",best?`${best.weight} × ${best.reps}`:"—",best?best.date:"No data yet")}${stat("RECORDED SETS",sets.length,"For selected exercise")}</div>
  <div class="grid two-col">
  ${panel("Estimated strength trend",selected&&trend.length?`<p class="small">Estimated 1RM from your last ${trend.length} recorded sets. This is an estimate, not a direct 1RM test.</p><div class="chart">${bars}</div>`:empty("Select an exercise with logged sets to see its trend."))}
  ${panel("1RM calculator",`<p class="small">Epley estimate for a typical working set (up to 15 reps).</p><label>Weight (kg)<input id="calcWeight" type="number" min="1" step=".5" value="${best?best.weight:55}"></label><label>Repetitions<input id="calcReps" type="number" min="1" max="15" value="${best?best.reps:3}"></label><button class="primary" onclick="calculate1RM()">Calculate estimate</button><div id="calcResult" class="coach-message">Your estimated 1RM will appear here.</div>`)}
  ${panel("Strength forecast",`<p class="small">A simple scenario based on your recent estimated strength trend. It is not a promise of future performance.</p><label>Forecast horizon<select id="forecastMonths"><option value="2">2 months</option><option value="3">3 months</option></select></label><label>Assumed monthly change (%)<input id="forecastRate" type="number" value="1" min="-10" max="10" step=".5"></label><button class="primary" onclick="forecastStrength()">Calculate scenario</button><div id="forecastResult" class="coach-message">Select an exercise with a logged estimate.</div>`)}
  </div>
  ${panel("Exercise records",prRows?`<div class="table-wrap"><table><thead><tr><th>Exercise</th><th>Best logged set</th><th>Est. 1RM</th><th>Date</th></tr></thead><tbody>${prRows}</tbody></table></div>`:empty("Your personal records will appear here after you log workouts."))}
  <p class="small">Estimated 1RM can be inaccurate, especially for high-rep sets or exercises where technique varies. Don't attempt a maximal lift just to validate a calculator.</p>`;
}
function calculate1RM() {
  const est=estimate1RM($("calcWeight").value,$("calcReps").value);
  $("calcResult").innerHTML=est?`Estimated 1RM: <strong>${est.toFixed(1)} kg</strong><br><span class="small">A formula-based estimate, not a guarantee of what you can lift.</span>`:"Enter a weight and 1–15 reps.";
}
function forecastStrength() {
  const exercise=state.selectedExercise||uniqueExercises()[0];
  const best=exercise&&exercisePR(exercise);
  const months=Number($("forecastMonths").value),rate=Number($("forecastRate").value);
  if(!best){$("forecastResult").textContent="Log an exercise and set first.";return;}
  if(rate< -10||rate>10){$("forecastResult").textContent="Choose a monthly rate between -10% and +10%.";return;}
  const result=best.est*Math.pow(1+rate/100,months);
  $("forecastResult").innerHTML=`Starting estimate: <strong>${best.est.toFixed(1)} kg</strong><br>At ${rate}% per month for ${months} months: <strong>${result.toFixed(1)} kg</strong><br><span class="small">Illustrative scenario only. Real progress is uneven and may be slower or faster.</span>`;
}
/* COACHES */
function renderCoaches() {
  return `<div class="grid two-col">
    <div class="coach-card" onclick="openCoach('science')" style="cursor:pointer;">
  <div class="coach-content">
    <span class="pill">EVIDENCE-BASED</span>
    <h2>Science-Based Coach</h2>
    <p>Measured guidance on training volume, effort, recovery, technique, and progressive overload.</p>
    <button class="primary" onclick="event.stopPropagation(); openCoach('science')">Talk to this coach →</button>
  </div>
  <img class="coach-character" src="images/science-coach.png" alt="Science-Based Coach">
</div>
<div class="coach-card old" onclick="openCoach('old')" style="cursor:pointer;">
  <div class="coach-content">
    <span class="pill">OLD-SCHOOL MINDSET</span>
    <h2>Old-School Coach</h2>
    <p>Direct, motivating gym advice focused on discipline, hard work, and consistent training.</p>
    <button class="primary" onclick="event.stopPropagation(); openCoach('old')">Talk to this coach →</button>
  </div>
  <img class="coach-character" src="images/oldschool-coach.png" alt="Old-School Coach">
</div>
  </div>
  <section class="panel" style="margin-top:16px">
    <div class="panel-head"><h2 id="coachTitle">Coach advice</h2></div>
    <div id="coachContent">${empty("Select a coach above to get guidance based on your workout history.")}</div>
  </section>
  <p class="small" style="margin-top: 12px;">These are built-in coaching responses, not live AI or a substitute for a qualified coach or medical professional.</p>`;
}
/* SETTINGS / BACKUPS */
function renderSettings() {
  return `<div class="grid two-col">
  ${panel("Your data",`<p>Routines, calendars, and workout records are stored in this browser using local storage.</p><div class="coach-message"><strong>Important</strong><p>Clearing browser data can erase your records. Export a backup regularly. A backup file may contain personal information about your training.</p></div><button class="primary" onclick="exportData()">Export backup (.json)</button> <button class="secondary" onclick="$('importFile').click()">Import backup</button>`)}
  ${panel("Storage overview",`<div class="list-item"><div class="item-main"><strong>Routines</strong><small>Active daily habits</small></div><span class="pill">${state.routines.length}</span></div><div class="list-item"><div class="item-main"><strong>Workout entries</strong><small>Exercise and set history</small></div><span class="pill">${state.workouts.length}</span></div><div class="list-item"><div class="item-main"><strong>Activity dates</strong><small>Dates with activity records</small></div><span class="pill">${Object.keys(state.activities).length}</span></div><button class="danger" onclick="resetData()">Reset all app data</button>`)}
  </div><div class="panel" style="margin-top:16px"><h2>About Consistwin</h2><p>SHOW UP. LEVEL UP.</p><p class="small">A personal consistency and training tracker. This version runs in your browser; it does not have account login, cloud sync, or a connected AI service.</p></div>`;
}
function exportData() {
  const data={version:1,exportedAt:new Date().toISOString(),routines:state.routines,completions:state.completions,activities:state.activities,workouts:state.workouts,misses:state.misses,rests:state.rests};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`consistwin-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);toast("Backup exported");
}
$("importFile").addEventListener("change",async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try {
    const data=JSON.parse(await file.text());
    if(!Array.isArray(data.routines)||!Array.isArray(data.workouts)||!data.activities||!data.completions)throw new Error("Invalid backup");
    if(!confirm("Import this backup and replace the current Consistwin data? Export your current data first if you need it."))return;
    state.routines=data.routines;state.workouts=data.workouts;state.activities=data.activities;
    state.completions=data.completions;state.misses=data.misses||{};state.rests=data.rests||{};save();render();toast("Backup imported");
  } catch {alert("This file does not look like a valid Consistwin backup.");}
  finally {e.target.value="";}
});
function resetData() {
  if(!confirm("Permanently clear all Consistwin routines, calendars, and workouts from this browser? Export a backup first if you want to keep them."))return;
  state.routines=[];state.completions={};state.activities={};state.workouts=[];state.misses={};state.rests={};save();render();toast("App data reset");
}

/* ===================== LEVEL UP SYSTEM ===================== */
const LEVEL_CSS=`
.level-card{margin-bottom:18px;background:linear-gradient(135deg,#1b241b,#121513 70%);border-color:#344232}
.level-top{display:flex;align-items:center;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.level-badge{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;background:var(--green);color:#10150c;font-size:26px;font-weight:950;flex-shrink:0}
.level-top h2{font-size:22px;margin:0}
.level-top .eyebrow{margin:0 0 2px}
.level-card .progress-track{height:10px;margin-bottom:10px}
.badge-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.badge-item{border:1px solid var(--line);border-radius:12px;padding:12px;background:#0f1210}
.badge-item strong{display:block;font-size:13px}
.badge-item small{display:block;color:var(--muted);font-size:11px}
.badge-icon{font-size:22px;display:block;margin-bottom:6px;color:var(--green)}
.badge-item.locked{opacity:.4;filter:grayscale(1)}
.badge-item.got{border-color:#3f6633;background:#142014}
.badges-wrap{margin-top:16px}
.coach-reply p{color:var(--text);margin:8px 0}
.levelup{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:rgba(0,0,0,.78);backdrop-filter:blur(4px);animation:luFade .25s ease}
.levelup-card{position:relative;overflow:hidden;text-align:center;background:var(--panel);border:1px solid #3f6633;border-radius:22px;padding:34px 40px;width:min(360px,calc(100% - 32px));animation:luPop .45s cubic-bezier(.2,1.4,.4,1)}
.levelup-card>*{position:relative;z-index:1}
.levelup-num{font-size:96px;line-height:1;font-weight:950;color:var(--green);letter-spacing:-4px;margin:6px 0}
.levelup-card h2{margin:0 0 6px;font-size:22px}
.levelup-card p{color:var(--muted);margin:4px 0}
.levelup-card .primary{margin-top:14px}
.confetti{position:absolute;top:-16px;width:8px;height:14px;border-radius:2px;background:var(--green);animation:luFall 2.4s linear infinite;z-index:0}
.confetti:nth-child(even){background:#f2f5f2;width:6px;height:10px}
@keyframes luFade{from{opacity:0}to{opacity:1}}
@keyframes luPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes luFall{to{transform:translateY(460px) rotate(540deg);opacity:0}}
@media (prefers-reduced-motion:reduce){.levelup,.levelup-card,.confetti{animation:none}}
`;
(function injectLevelCSS(){
  const s=document.createElement("style");
  s.textContent=LEVEL_CSS;
  document.head.appendChild(s);
})();

const RANKS=[[1,"Rookie"],[2,"Regular"],[4,"Grinder"],[6,"Iron Soul"],[8,"Beast"],[11,"Machine"],[15,"Legend"]];
function rankName(level){return [...RANKS].reverse().find(r=>level>=r[0])[1];}
function routineCompletions(){
  return Object.values(state.completions).reduce((n,a)=>n+(a?.length||0),0);
}
function activityDays(){
  return Object.values(state.activities).reduce((n,a)=>n+(a?.length||0),0);
}
function restDaysCount(){
  return Object.values(state.rests).reduce((n,o)=>n+Object.values(o||{}).filter(Boolean).length,0);
}
function totalVolume(){
  return state.workouts.reduce((n,w)=>n+workoutVolume(w),0);
}
/* XP is calculated from your data, so it always matches what you logged. */
function xpTotal(){
  return state.workouts.length*50+activityDays()*30+routineCompletions()*10+uniqueExercises().length*25;
}
function levelInfo(xp=xpTotal()){
  const level=Math.floor(Math.sqrt(xp/100))+1;
  const start=100*(level-1)**2,next=100*level**2;
  return {level,xp,start,next,toNext:next-xp,pct:Math.max(0,Math.min(100,(xp-start)/(next-start)*100)),rank:rankName(level)};
}
function longestStreak(){
  const act=new Set([...workoutDays(),...Object.keys(state.completions).filter(d=>state.completions[d]?.length)]);
  if(!act.size)return 0;
  const d=new Date([...act].sort()[0]+"T12:00:00"),end=localDate(new Date());
  let run=0,best=0;
  while(localDate(d)<=end){
    const k=localDate(d);
    if(act.has(k)){run++;best=Math.max(best,run);}
    else if(!isRestDay(k))run=0;
    d.setDate(d.getDate()+1);
  }
  return best;
}
function badgeList(){
  const w=state.workouts.length,s=longestStreak();
  return [
    {n:"First Rep",d:"Log your first workout",ok:w>=1},
    {n:"Warming Up",d:"Log 5 workouts",ok:w>=5},
    {n:"Dedicated",d:"Log 25 workouts",ok:w>=25},
    {n:"3-Day Streak",d:"Show up 3 days in a row",ok:s>=3},
    {n:"7-Day Streak",d:"Show up 7 days in a row",ok:s>=7},
    {n:"30-Day Streak",d:"Show up 30 days in a row",ok:s>=30},
    {n:"Iron Tonnage",d:"Move 10,000 kg in total",ok:totalVolume()>=10000},
    {n:"Variety Pack",d:"Log 5 different exercises",ok:uniqueExercises().length>=5},
    {n:"Rest Smart",d:"Mark 3 rest days",ok:restDaysCount()>=3},
    {n:"Habit Builder",d:"Complete 10 routines",ok:routineCompletions()>=10}
  ];
}
function levelBanner(){
  const L=levelInfo();
  return `<section class="panel level-card"><div class="level-top"><div class="level-badge">${L.level}</div><div class="item-main"><p class="eyebrow">LEVEL ${L.level} · ${escapeHTML(L.rank.toUpperCase())}</p><h2>${L.xp.toLocaleString()} XP</h2></div><span class="pill">${L.toNext.toLocaleString()} XP to level ${L.level+1}</span></div>
  <div class="progress-track"><div class="progress-fill" style="width:${L.pct.toFixed(1)}%"></div></div>
  <p class="small">+50 XP per workout · +30 per calendar day done · +10 per routine · +25 per new exercise</p></section>`;
}
function badgesPanel(){
  const list=badgeList(),got=list.filter(b=>b.ok).length;
  return `<div class="badges-wrap">${panel(`Badges · ${got}/${list.length}`,`<div class="badge-grid">${list.map(b=>`<div class="badge-item ${b.ok?"got":"locked"}"><span class="badge-icon">★</span><strong>${escapeHTML(b.n)}</strong><small>${escapeHTML(b.d)}</small></div>`).join("")}</div>`)}</div>`;
}
function showLevelUp(info){
  const old=document.getElementById("levelUp");if(old)old.remove();
  const o=document.createElement("div");
  o.id="levelUp";o.className="levelup";
  const quote=state.coach==="old"?"That's what showing up gets you.":"Consistency compounds. Keep going.";
  const confetti=Array.from({length:18},(_,i)=>`<i class="confetti" style="left:${(i*5.7+3)%100}%;animation-delay:${(i%6)*0.25}s"></i>`).join("");
  o.innerHTML=`<div class="levelup-card">${confetti}<p class="eyebrow">LEVEL UP</p><div class="levelup-num">${info.level}</div><h2>${escapeHTML(info.rank)}</h2><p>${quote}</p><button class="primary" onclick="document.getElementById('levelUp').remove()">Keep going</button></div>`;
  o.addEventListener("click",e=>{if(e.target===o)o.remove();});
  document.body.appendChild(o);
}
function checkLevelUp(){
  try{
    const info=levelInfo();
    const prev=Number(localStorage.getItem("consistwin-level"));
    localStorage.setItem("consistwin-level",String(info.level));
    if(prev&&info.level>prev)showLevelUp(info);
    let seen=null;
    try{seen=JSON.parse(localStorage.getItem("consistwin-badges"));}catch{}
    const have=badgeList().filter(b=>b.ok).map(b=>b.n);
    localStorage.setItem("consistwin-badges",JSON.stringify(have));
    if(Array.isArray(seen)){
      const fresh=have.filter(n=>!seen.includes(n));
      if(fresh.length)setTimeout(()=>toast("Badge unlocked: "+fresh.join(", ")),2400);
    }
  }catch{}
}

/* ===================== TALKING COACHES ===================== */
function daysAgo(date){
  return Math.round((new Date(today()+"T12:00:00")-new Date(date+"T12:00:00"))/86400000);
}
function latestWorkout(ex){
  return state.workouts.filter(w=>w.exercise.toLowerCase()===ex.toLowerCase()&&(w.sets||[]).length)
    .sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0))[0]||null;
}
function coachStats(){
  const ws=state.workouts;
  const lastDate=ws.map(w=>w.date).sort().pop()||null;
  const inRange=(w,a,b)=>{const n=daysAgo(w.date);return n>=a&&n<=b;};
  const vol=(a,b)=>ws.filter(w=>inRange(w,a,b)).reduce((n,w)=>n+workoutVolume(w),0);
  const days=(a,b)=>new Set(ws.filter(w=>inRange(w,a,b)).map(w=>w.date)).size;
  let focus=null;
  uniqueExercises().forEach(ex=>{
    const byDate={};
    allSets(ex).forEach(s=>{
      const e=estimate1RM(s.weight,s.reps);
      if(e&&(!byDate[s.date]||e>byDate[s.date]))byDate[s.date]=e;
    });
    const dates=Object.keys(byDate).sort();
    if(dates.length<2)return;
    const vals=dates.map(d=>byDate[d]);
    const last=vals[vals.length-1],prev=vals[vals.length-2],recent=vals.slice(-3);
    const item={ex,pct:(last-prev)/prev*100,plateau:vals.length>=3&&Math.max(...recent)-Math.min(...recent)<0.5,lastDate:dates[dates.length-1]};
    if(!focus||item.lastDate>focus.lastDate)focus=item;
  });
  return {n:ws.length,lastDate,daysSince:lastDate?daysAgo(lastDate):null,d7:days(0,6),v7:vol(0,6),vPrev:vol(7,13),focus,streak:dayStreak()};
}
function coachAdvice(which){
  const c=coachStats(),L=levelInfo(),old=which==="old";
  const head=`<strong>Level ${L.level} · ${escapeHTML(L.rank)}</strong>`;
  const wrap=p=>`<div class="coach-message coach-reply">${head}${p.map(x=>`<p>${x}</p>`).join("")}</div>`;
  if(!c.n){
    return wrap([old
      ?"Zero workouts logged. Nobody got strong sitting on the couch. Log your first session and show up."
      :"There is no data yet. Log one session and I can give you feedback based on your numbers. Start with 2 to 3 hard sets per exercise, stopping 1 to 3 reps before failure."]);
  }
  const p=[];
  const change=c.vPrev>0?(c.v7-c.vPrev)/c.vPrev*100:null;
  const f=c.focus,fx=f?escapeHTML(f.ex):"";
  const pct=f?Math.abs(f.pct).toFixed(1):"";
  if(old){
    const since=c.daysSince;
    p.push((since===0?"You trained today. That's what I like to see."
      :since===1?"Last session was yesterday. Don't let it be a one-off."
      :since>=4?`It's been ${since} days since you lifted. Excuses don't build muscle. Get to the gym.`
      :`Last session was ${since} days ago. Time to go again.`)
      +(c.streak>=3?` ${c.streak} days in a row. Keep stacking them.`:""));
    if(change===null)p.push("Build the habit first: show up on the same days every week.");
    else if(change>25)p.push(`You moved ${Math.round(change)}% more weight than last week. That's what I'm talking about.`);
    else if(change<-25)p.push(`Volume's down ${Math.round(-change)}% from last week. Pick it back up.`);
    else p.push("Same work as last week. Now push a little harder.");
    if(f){
      if(f.plateau)p.push(`${fx} hasn't moved in 3 sessions. Time to grind: add a rep, add a plate, and sleep and eat like you mean it.`);
      else if(f.pct>0.5)p.push(`${fx} is up ${pct}%. Strength comes from showing up and pushing a little harder every time.`);
      else if(f.pct<-0.5)p.push(`${fx} went down. Happens. Don't sulk. Come back and beat it with clean form.`);
      else p.push(`${fx} is flat since last time. Give me one more rep.`);
    }
  } else {
    p.push(c.d7>=3?`You trained on ${c.d7} days in the last week, a solid frequency. Training each muscle about twice a week is a good default.`
      :c.d7>=1?`You trained on ${c.d7} day${c.d7>1?"s":""} in the last week. Aim for at least two sessions per muscle group each week if your schedule allows.`
      :"No sessions in the last 7 days. Restart small: one short session beats waiting for the perfect plan.");
    if(change===null)p.push("Once you have two weeks of data, I can compare your weekly volume.");
    else if(change>25)p.push(`Your volume is up ${Math.round(change)}% on last week. Big jumps add fatigue, so keep most sets 1 to 3 reps from failure and watch your recovery.`);
    else if(change<-25)p.push(`Your volume is down ${Math.round(-change)}% from last week. That's fine if it was a planned lighter week. Otherwise check sleep and food.`);
    else p.push("Your volume is steady compared with last week, which is what consistent progress looks like.");
    if(f){
      if(f.plateau)p.push(`${fx} has been flat for 3 sessions. Check sleep, protein and effort first, then try adding a set or swapping to a close variation.`);
      else if(f.pct>0.5)p.push(`${fx}: estimated 1RM is up ${pct}% since the previous session. Keep using double progression: add reps first, then weight.`);
      else if(f.pct<-0.5)p.push(`${fx} dipped about ${pct}% last session. One lower session is normal day-to-day variation. If it repeats, consider a lighter week.`);
      else p.push(`${fx} is about the same as last session. Try for one more rep next time.`);
    } else p.push("Log the same exercise on at least two different days and I can track its trend.");
    if(c.streak>=7)p.push(`${c.streak} days in a row. Plan a rest day soon. Recovery is when muscle is actually built.`);
  }
  const target=latestWorkout(f?f.ex:state.workouts[state.workouts.length-1].exercise);
  if(target)p.push(`Next session on ${escapeHTML(target.exercise)}: ${beatTarget(target).replace("Aim for","aim for")}.`);
  if(old)p.push(`Level ${L.level+1} is ${L.toNext.toLocaleString()} XP away. Train hard, keep your form clean, and go get it.`);
  return wrap(p);
}
function openCoach(which){
  state.coach=which;
  $("coachTitle").textContent=(which==="old"?"Old-School Coach":"Science-Based Coach")+" says";
  $("coachContent").innerHTML=coachAdvice(which);
  $("coachContent").scrollIntoView({behavior:"smooth",block:"nearest"});
}
/* First load: remember the current level and badges so you don't get a fake level-up. */
if(localStorage.getItem("consistwin-level")===null)checkLevelUp();

/* START */
render();
