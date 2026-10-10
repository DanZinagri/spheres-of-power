// Cohort Builder: the Character Builder (builder.js) with window.BUILDER_VARIANT = "cohort" and its
// own save slot. A Leadership sphere cohort has no class levels: its Hit Dice, base attack bonus,
// saves, feats and talents come from Table: Cohort by its leader's associated skill ranks, and its
// ability scores, saves, class skills and abilities from its job (compendium/cohort-jobs.json).
"use strict"

const COHORT = { data: null }
const blankCohort = () => ({ hpSet: false, leader: "", ranks: 1, skill: "dip", job: null, growth: [], increases: [], skillChoices: [], caster: "", casting: "prepared", utility: false })
const cohortRow = () => {
  const table = COHORT.data?.progression ?? []
  return table[Math.min(table.length, Math.max(1, Math.floor(num(state.cohort?.ranks)))) - 1] ?? { ranks: 1, hd: 1, bab: 1, good: 2, bad: 0, feats: 1, talents: 0 }
}
// a number field that commits when it's left (the panel re-renders on a change)
function cohortNum(path, attrs = {}) {
  const el = h("input", { type: "number", ...attrs, value: getPath(state, path) ?? 0 })
  el.addEventListener("change", () => { setPath(state, path, el.value === "" ? 0 : +el.value); changed(true) })
  return el
}

// everything the job and the leader's ranks decide, worked out again whenever either changes
function syncCohort() {
  const co = (state.cohort ??= blankCohort()), job = co.job
  // a cohort is a nonplayer character: average hit points per Hit Die (the Classes tab can change it)
  if (!co.hpSet) { state.hpMode = "average"; co.hpSet = true }
  if (!job || !COHORT.data) return
  const row = cohortRow()
  const growths = Math.floor(row.ranks / 4), increases = Math.floor(row.hd / 4)
  co.growth = Array.from({ length: growths }, (_, i) => co.growth[i] ?? { mode: "two", a: "", b: "", c: "" })
  co.increases = Array.from({ length: increases }, (_, i) => co.increases[i] ?? "")
  co.skillChoices = Array.from({ length: job.choices }, (_, i) => co.skillChoices[i] ?? "")
  const casts = job.caster && co.caster
  // the one "class": the job, at the cohort's Hit Dice
  const cls = state.classes[0] ?? (state.classes[0] = blankClass(true))
  Object.assign(cls, { name: `${job.name} (cohort)`, level: row.hd, hd: job.hd, bab: job.bab, fort: job.saves.fort, ref: job.saves.ref, will: job.saves.will,
    skills: 4, classSkills: [...new Set([...job.classSkills, ...co.skillChoices.filter(Boolean)])], caster: casts && co.caster === "sphere" ? "low" : "none",
    favored: false, cohort: true })
  for (const k of ABL) {
    let v = job.abilities[k]
    for (const g of co.growth) v += g.mode === "two" ? (g.a === k ? 2 : 0) : [g.a, g.b, g.c].filter((x) => x === k).length ? 1 : 0
    v += co.increases.filter((x) => x === k).length
    state.abilities[k] = v
  }
  const auto = job.benefits.filter((b) => b.level <= row.hd).map((b) => newFeature("classFeat", {
    name: b.name || `${job.name} benefit (${b.level}${["th", "st", "nd", "rd"][b.level] ?? "th"} level)`, desc: b.text }))
  if (job.special) auto.unshift(newFeature("classFeat", { name: `${job.name} (special)`, desc: job.special }))
  auto.unshift(newFeature("classFeat", { name: "Cohort",
    desc: [`${co.leader ? `${co.leader}'s cohort` : "A cohort"} (Leadership sphere), a ${job.name.toLowerCase()} of job level ${row.hd}, from ${row.ranks} associated skill rank${row.ranks === 1 ? "" : "s"}.`,
      "Proficient with simple weapons, light armor and bucklers, plus a martial tradition suited to the job.",
      `Talents: ${cohortTalentsText(row)}.`,
      `Starting equipment: one kit suited to the job, worth up to ${50 * row.ranks} gp.`].join("\n\n") }))
  state.features = [...auto.map((f) => ({ ...f, auto: "cohort" })), ...state.features.filter((f) => f.auto !== "cohort")]
}
function cohortTalentsText(row) {
  const co = state.cohort
  if (co.job?.caster && co.caster === "classic") return "none from the progression (a classic caster cohort gets spellcasting instead)"
  if (co.utility) return `${Math.floor(row.hd / 2)} talents and ${Math.ceil(row.hd / 2)} utility talents (utilitarian progression)`
  return `${row.talents} combat talent${row.talents === 1 ? "" : "s"} (adept progression)${co.job?.caster && co.caster === "sphere" ? ", which may be magic talents" : ""}`
}

function chooseJob(job) {
  const co = (state.cohort ??= blankCohort())
  co.job = job
  co.skillChoices = []
  co.caster = job.caster ? co.caster || "classic" : ""
  changed(true)
  toast(`${job.name} chosen`)
}

function leaderFromBuilder() {
  let raw = null
  try { raw = JSON.parse(localStorage.getItem(CHARACTER_KEY) || "null") } catch {}
  if (!raw || !(raw.classes ?? []).some((cl) => cl.name)) return toast("No character is saved in the Character Builder on this browser.")
  const co = state.cohort
  const pro = Math.max(0, ...(raw.subSkills?.pro ?? []).map((e) => num(e.rank)))
  const ranks = co.skill === "pro" ? pro : num(raw.skills?.dip)
  co.leader = raw.name || co.leader
  co.ranks = Math.max(1, ranks)
  toast(`Leader: ${raw.name || "the Character Builder's character"} (${co.skill === "pro" ? "Profession" : "Diplomacy"} ${ranks} rank${ranks === 1 ? "" : "s"})`)
  changed(true)
}

const ablOptions = (cur, label = "Choose…") => [h("option", { value: "" }, label), ...ABL.map((k) => h("option", { value: k, selected: cur === k }, ABILITIES[k]))]
function pickAbility(obj, key, title) {
  const el = h("select", { "aria-label": title }, ...ablOptions(obj[key]))
  el.addEventListener("change", () => { obj[key] = el.value; changed(true) })
  return el
}

panels.cohort = () => {
  const co = (state.cohort ??= blankCohort()), data = COHORT.data
  if (!data) return [h("h2", {}, "Cohort"), h("p", { class: "muted" }, "Loading the cohort jobs…")]
  const row = cohortRow(), job = co.job
  const jobSel = h("select", { "aria-label": "Cohort job" }, h("option", { value: "" }, "Choose a job…"),
    ...data.jobs.map((j) => h("option", { value: j.id, selected: job?.id === j.id }, `${j.name}${j.sample ? " (sample job)" : ""}${j.caster ? " · caster" : ""}`)))
  jobSel.addEventListener("change", () => { const j = data.jobs.find((x) => x.id === jobSel.value); if (j) chooseJob(j) })
  const head = [
    h("h2", {}, "Cohort"),
    h("div", { class: "card" },
      h("div", { class: "row" }, h("div", { class: "group-title", style: "margin:0" }, "Leader"), h("div", { class: "spacer" }),
        h("button", { class: "small", title: "Read the leader's name and skill ranks from the character saved in the Character Builder on this browser", onclick: leaderFromBuilder }, "From the Character Builder")),
      h("div", { class: "row" },
        field("Leader's name", input("cohort.leader", { placeholder: "Leader's name" })),
        field("Associated skill", select("cohort.skill", { dip: "Diplomacy", pro: "Profession" })),
        field("Associated skill ranks", cohortNum("cohort.ranks", { min: 1, max: 30, style: "width:5.5rem" }), "The Leadership sphere's associated skill"),
        field("Job", jobSel)),
      h("p", { class: "note" }, "A cohort has no class levels: Table: Cohort sets its Hit Dice, base attack bonus, saves, feats and talents from the leader's ranks, and its job sets the rest. ",
        h("a", { href: `../../${data.url}#cohort-statistics`, target: "_blank", rel: "noopener" }, "Cohort rules on the wiki"))),
  ]
  if (!job) return [...head, h("p", { class: "muted" }, "Choose a job to build the cohort. Jobs marked as casters need the Advanced Cohorts legendary talent (magic cohorts).")]
  const c = calc()
  const stat = (v, label) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, label))
  const reached = job.benefits.filter((b) => b.level <= row.hd), later = job.benefits.filter((b) => b.level > row.hd)
  const choiceSel = (i) => {
    const el = h("select", { "aria-label": `Class skill choice ${i + 1}` }, h("option", { value: "" }, "Choose a class skill…"),
      ...Object.entries(SKILLS).filter(([k]) => !job.classSkills.includes(k)).map(([k, v]) => h("option", { value: k, selected: co.skillChoices[i] === k }, v[0])))
    el.addEventListener("change", () => { co.skillChoices[i] = el.value; changed(true) })
    return el
  }
  const perDay = data.spellsPerDay[Math.min(20, row.hd) - 1], known = data.spellsKnown[Math.min(20, row.hd) - 1]
  const levels = (r, from) => r.slice(1).map((n, i) => (n ? `${i + from}${["th", "st", "nd", "rd"][i + from] ?? "th"}: ${n}` : "")).filter(Boolean).join(", ")
  return [
    ...head,
    h("div", { class: "card" },
      h("div", { class: "row" }, h("div", { class: "group-title", style: "margin:0" }, `${job.name}, job level ${row.hd}`), h("div", { class: "spacer" }),
        h("a", { href: `../../${job.url}`, target: "_blank", rel: "noopener" }, "Job on the wiki")),
      h("div", { class: "mon-compare" }, stat(`${row.hd}d${job.hd}`, "Hit Dice"), stat(signed(c.bab), "BAB"), stat(signed(c.saves.fort), "Fort"), stat(signed(c.saves.ref), "Ref"),
        stat(signed(c.saves.will), "Will"), stat(String(c.featSlots), "Feats"), stat(job.caster && co.caster === "classic" ? "—" : String(co.utility ? Math.floor(row.hd / 2) : row.talents), "Talents"), stat(String(c.skillBudget), "Skill ranks")),
      job.prerequisite ? h("p", { class: "note" }, h("b", {}, "Prerequisite: "), job.prerequisite) : null,
      job.special ? h("p", { class: "note" }, h("b", {}, "Special: "), job.special) : null,
      job.note ? h("p", { class: "note" }, h("b", {}, "Note: "), job.note) : null,
      h("p", { class: "note" }, h("b", {}, "Class skills: "), job.classSkillsText),
      job.choices ? h("div", { class: "row" }, ...Array.from({ length: job.choices }, (_, i) => choiceSel(i))) : null),
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, "Ability scores"),
      h("p", { class: "note" }, `The job's array: ${ABL.map((k) => `${k[0].toUpperCase()}${k.slice(1)} ${job.abilities[k]}`).join(", ")}. Racial modifiers come from the Race tab.`),
      ...co.growth.map((g, i) => h("div", { class: "row" }, h("span", { class: "note", style: "min-width:11rem" }, `Stat growth (${(i + 1) * 4} ranks):`),
        (() => { const el = h("select", { "aria-label": "Stat growth" }, h("option", { value: "two", selected: g.mode === "two" }, "+2 to one score"), h("option", { value: "three", selected: g.mode === "three" }, "+1 to three scores"))
          el.addEventListener("change", () => { g.mode = el.value; changed(true) }); return el })(),
        pickAbility(g, "a", "Ability"), ...(g.mode === "three" ? [pickAbility(g, "b", "Second ability"), pickAbility(g, "c", "Third ability")] : []))),
      ...co.increases.map((_, i) => h("div", { class: "row" }, h("span", { class: "note", style: "min-width:11rem" }, `+1 at ${(i + 1) * 4} Hit Dice:`), pickAbility(co.increases, i, "Ability score increase"))),
      !co.growth.length && !co.increases.length ? h("p", { class: "note" }, "Stat growth comes every 4 ranks; a +1 ability score increase every 4 Hit Dice.") : null),
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, "Talents and casting"),
      h("div", { class: "row" },
        job.caster ? field("Caster cohort", select("cohort.caster", { classic: "Classic caster (spells)", sphere: "Spherecaster", "": "Not casting" })) : null,
        job.caster && co.caster === "classic" ? field("Casting", select("cohort.casting", { prepared: "Prepared", spontaneous: "Spontaneous" })) : null,
        !(job.caster && co.caster === "classic") ? h("div", { class: "field" }, h("span", {}, " "), checkbox("cohort.utility", "Utilitarian progression (Spheres of Guile)")) : null),
      h("p", { class: "note" }, `Talents: ${cohortTalentsText(row)}. A cohort also gets a martial tradition${state.spheresModule ? " (add it and the talents on the Spheres tab)" : " (turn on Spheres for PF1e above to add it and the talents)"}.`),
      job.caster && co.caster === "classic" && perDay ? h("p", { class: "note" }, `Spells per day at job level ${Math.min(20, row.hd)}: ${levels(perDay, 1) || "none"} (plus bonus spells for a high casting score${co.casting === "spontaneous" ? ", and 1 more of each level" : ""}).`,
        co.casting === "spontaneous" && known ? ` Spells known: ${levels(known, 0)}.` : " A prepared caster starts with all 0-level spells and three 1st-level spells, and learns one more at each job level.") : null,
      job.caster && co.caster === "sphere" ? h("p", { class: "note" }, "A spherecaster cohort is a Low-Caster with a casting tradition (without the two bonus talents), and may take magic talents in place of combat talents; see the job's 1st-level benefit for its spheres.") : null),
    h("div", { class: "card" },
      h("div", { class: "group-title", style: "margin-top:0" }, "Job benefits"),
      ...reached.map((b) => h("details", {}, h("summary", {}, `${b.level}${["th", "st", "nd", "rd"][b.level] ?? "th"} level${b.name ? `: ${b.name}` : ""}`), h("p", { class: "note", style: "white-space:pre-wrap" }, b.text))),
      later.length ? h("p", { class: "note" }, `Later: ${later.map((b) => `${b.name || "benefit"} at job level ${b.level}`).join(", ")}.`) : null,
      h("p", { class: "note" }, `Starting equipment: one kit suited to the job, worth up to ${50 * row.ranks} gp. The benefits above are also listed on the Feats & Features tab.`)),
  ]
}

// ---------- hooks ----------
HOOKS.changed = () => syncCohort()
// average hit points round down once, as a creature's do
HOOKS.calc = (out, s) => { if (s.cohort && s.hpMode === "average") out.hp = Math.floor(out.hp) }
HOOKS.summary = () => {
  const co = state.cohort
  if (!co?.job) return []
  const row = cohortRow()
  const stat = (v, label) => h("div", { class: "stat" }, h("b", {}, v), h("span", {}, label))
  return [h("div", { class: "card" }, h("div", { class: "stat-grid" }, stat(String(row.ranks), "Leader ranks"), stat(String(row.hd), "Job level"), stat(String(co.utility ? Math.floor(row.hd / 2) : row.talents), "Talents")))]
}
HOOKS.pdfRows = (rows) => {
  const co = state.cohort
  if (!co?.job) return rows
  rows[0][0] = ["Leader", co.leader || state.details.player]
  rows[3][2] = ["Job level", `${cohortRow().hd} (${co.job.name})`]
  return rows
}
HOOKS.pdfWide = () => (state.cohort?.job ? [["Cohort", `${state.cohort.job.name}; leader's associated skill ranks ${cohortRow().ranks}; talents: ${cohortTalentsText(cohortRow())}`]] : [])
HOOKS.exportActor = (actor) => {
  if (state.cohort?.job && !state.name) actor.name = actor.prototypeToken.name = `${state.cohort.job.name} cohort`
}

state.cohort ??= blankCohort()
loadCompendium("cohort-jobs.json", { progression: [], jobs: [], spellsPerDay: [], spellsKnown: [] }).then((d) => {
  COHORT.data = d
  // the saved cohort keeps its job's entry; refresh it from the data in case the rules page changed
  if (state.cohort.job) state.cohort.job = d.jobs.find((j) => j.id === state.cohort.job.id) ?? state.cohort.job
  syncCohort()
  renderAll()
})
renderAll()
