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
    activities:state.activities,workouts:state.workouts,misses:state.misses
  }));
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
function dayStreak() {
  const dates=new Set([...workoutDays(),...Object.keys(state.completions).filter(d=>state.completions[d]?.length)]);
  let d=new Date();if(!dates.has(localDate(d)))d.setDate(d.getDate()-1);
  let n=0;while(dates.has(localDate(d))){n++;d.setDate(d.getDate()-1);}
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
  return `<div class="grid stats">
    ${stat("TODAY'S ROUTINES",`${done}/${total}`,total?"Daily completion":"Create your first routine","✓")}
    ${stat("COMPLETION",pct+"%", "Today's routine progress","◉")}
    ${stat("WORKOUTS · 7 DAYS",weekly,"Logged in the last 7 days","↗")}
    ${stat("CURRENT STREAK",dayStreak()+" days","Logged active days","✦")}
  </div>
  <div class="grid two-col">
    ${panel("Today's focus",`<div class="big-progress"><div class="ring" style="--progress:${pct*3.6}deg"><strong>${pct}%</strong></div><div><h2>${pct===100&&total?"All routines complete!":total?"Keep showing up.":"Start small. Stay consistent."}</h2><p class="small">${done} of ${total} routines completed today.</p><button class="secondary" onclick="showPage('routines')">Manage routines →</button></div></div>`)}
    ${panel("Daily routines",routines,`<button class="secondary" onclick="newRoutine()">+ Add</button>`)}
    <div class="panel"><div class="panel-head"><h2>Recent workouts</h2><button class="secondary" onclick="showPage('workouts')">View all</button></div>
    ${latest.length?latest.map(w=>`<div class="list-item"><div class="item-main"><strong>${escapeHTML(w.exercise)}</strong><small>${escapeHTML(w.name)} · ${escapeHTML(w.date)}</small></div><span class="pill">${Math.round(workoutVolume(w)).toLocaleString()} kg vol.</span></div>`).join(""):empty("Your workout history will appear here.")}</div>
    ${panel("Your next step",`<div class="stack"><div class="row"><div><strong>Track a session</strong><div class="small">Record exercises and sets.</div></div><button class="secondary" onclick="openWorkout()">Log →</button></div><div class="row"><div><strong>Review your progress</strong><div class="small">Check estimated strength and PRs.</div></div><button class="secondary" onclick="showPage('progress')">Review →</button></div><div class="row"><div><strong>Plan your consistency</strong><div class="small">Mark training and rest days.</div></div><button class="secondary" onclick="showPage('calendar')">Calendar →</button></div></div>`)}
  </div>`;
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

/* CALENDARS */
function dayKey(date){return date;}
function isMarkedDone(date,id=state.calendarId) {
  return (state.activities[date]||[]).includes(id);
}
function markActivity(date,id,done) {
  const a=new Set(state.activities[date]||[]);
  if(done){a.add(id);delete state.misses[date]?.[id];}
  else a.delete(id);
  state.activities[date]=[...a];save();render();
}
function markMissed(date,id) {
  state.misses[date]=state.misses[date]||{};
  state.misses[date][id]=!state.misses[date][id];
  save();render();
}
function monthCalendar(month,year,compact=false) {
  const first=new Date(year,month,1),last=new Date(year,month+1,0);
  let html=["M","T","W","T","F","S","S"].map(x=>`<div class="cal-day-label">${x}</div>`).join("");
  let offset=(first.getDay()+6)%7;
  for(let i=0;i<offset;i++)html+=`<div></div>`;
  for(let day=1;day<=last.getDate();day++){
    const d=localDate(new Date(year,month,day));
    const done=isMarkedDone(d),miss=!!state.misses[d]?.[state.calendarId];
    const cls=[d===today()?"today":"",done?"done":"",miss?"missed":""].filter(Boolean).join(" ");
    html+=`<button class="cal-cell ${cls}" onclick="selectCalendarDay('${d}')" title="${escapeHTML(d)}${done?" · completed":miss?" · marked missed":""}">
      <span>${day}</span>${done&&!compact?'<span class="cell-mark">✓</span>':""}</button>`;
  }
  return `<div class="calendar-grid">${html}</div>`;
}
function renderCalendar() {
  const months=Array.from({length:12},(_,m)=>`<div class="year-month"><h3>${new Date(state.year,m,1).toLocaleDateString(undefined,{month:"long"})}</h3>${monthCalendar(m,state.year,true)}</div>`).join("");
  const ids=["Gym","Study","Reading","Cardio","Sleep","Work","Personal"];
  const options=ids.map(x=>`<option ${state.calendarId===x?"selected":""}>${x}</option>`).join("");
  const day=state.selectedDate;
  const activities=state.activities[day]||[];
  return `<div class="toolbar"><select onchange="state.calendarId=this.value;render()">${options}</select><button class="secondary" onclick="changeMonth(-1)">← Month</button><button class="secondary" onclick="state.month=new Date().getMonth();state.year=new Date().getFullYear();render()">Today</button><button class="secondary" onclick="changeMonth(1)">Month →</button><button class="primary" onclick="toggleCalendarView()">${window.calendarYear?"Monthly view":"Yearly view"}</button></div>
  <div class="grid two-col">
  ${panel(new Date(state.year,state.month,1).toLocaleDateString(undefined,{month:"long",year:"numeric"}),window.calendarYear?`<div class="year-grid">${months}</div>`:monthCalendar(state.month,state.year))}
  ${panel("Selected day",`<h2>${dayName(day)}</h2><p class="small">Choose how this day is recorded. Unmarked days remain neutral, not missed.</p>
    <div class="list-item"><div class="item-main"><strong>${escapeHTML(state.calendarId)}</strong><small>${isMarkedDone(day)?"Completed":state.misses[day]?.[state.calendarId]?"Marked missed":"Not marked"}</small></div><button class="${isMarkedDone(day)?"secondary":"primary"}" onclick="markActivity('${day}','${state.calendarId}',${!isMarkedDone(day)})">${isMarkedDone(day)?"Undo":"Mark done"}</button></div>
    <div class="list-item"><div class="item-main"><strong>Missed day</strong><small>Use only when you intentionally want to record a missed day.</small></div><button class="secondary" onclick="markMissed('${day}','${state.calendarId}')">${state.misses[day]?.[state.calendarId]?"Undo":"Mark missed"}</button></div>
    <h3>All activities for this date</h3>${activities.length?activities.map(a=>`<div class="pill">${escapeHTML(a)}</div>`).join(" "):empty("No activities completed on this date.")}
    <label>Choose date<input type="date" value="${day}" onchange="state.selectedDate=this.value;render()"></label>`)}
  </div><p class="small">Green = completed. Red dot = explicitly marked missed. Blank = rest, not recorded, or unknown. Your activity calendars are tracked separately.</p>`;
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
  renderSets();
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
  const data={version:1,exportedAt:new Date().toISOString(),routines:state.routines,completions:state.completions,activities:state.activities,workouts:state.workouts,misses:state.misses};
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
    state.completions=data.completions;state.misses=data.misses||{};save();render();toast("Backup imported");
  } catch {alert("This file does not look like a valid Consistwin backup.");}
  finally {e.target.value="";}
});
function resetData() {
  if(!confirm("Permanently clear all Consistwin routines, calendars, and workouts from this browser? Export a backup first if you want to keep them."))return;
  state.routines=[];state.completions={};state.activities={};state.workouts=[];state.misses={};save();render();toast("App data reset");
}

/* START */
render();
