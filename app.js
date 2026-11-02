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
