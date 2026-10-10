// Kingdom Builder: keep a kingdom's sheet by the Pathfinder kingdom-building rules (Ultimate
// Campaign): leaders, alignment, edicts, hexes and terrain improvements, settlements and their
// buildings, and what a turn's checks, upkeep and income come to. Building, improvement and terrain
// statistics come from Archives of Nethys in compendium/kingdom.json.

const STORAGE_KEY = "sop-kingdom-builder"
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch])
const num = (n, digits = 0) => (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: digits })
const signed = (n) => (n >= 0 ? "+" : "−") + Math.abs(n)
const ATTRS = ["economy", "loyalty", "stability"]
const LABEL = { economy: "Economy", loyalty: "Loyalty", stability: "Stability" }
const LOTS = 36 // in a district
const BP_GP = 4000

const ALIGNMENTS = { LG: "Lawful Good", NG: "Neutral Good", CG: "Chaotic Good", LN: "Lawful Neutral", N: "Neutral", CN: "Chaotic Neutral", LE: "Lawful Evil", NE: "Neutral Evil", CE: "Chaotic Evil" }
// Chaotic and Good: Loyalty +2; Lawful and Evil: Economy +2; each Neutral: Stability +2
const alignmentMods = (a) => {
  const out = { economy: 0, loyalty: 0, stability: 0 }
  const [first, second] = a === "N" ? ["N", "N"] : [a[0], a[1]]
  for (const c of [first === "L" ? "economy" : first === "C" ? "loyalty" : "stability", second === "E" ? "economy" : second === "G" ? "loyalty" : "stability"]) out[c] += 2
  return out
}
// leadership roles: the attribute the leader's ability modifier adds to (or a choice), and what a vacancy costs
const ROLES = [
  { name: "Ruler", choice: true, abilities: "Cha", vacancy: { unrest: 4 }, vacant: "can't claim hexes, make Farms, build Roads or buy districts" },
  { name: "Consort", attr: "loyalty", half: true, abilities: "Cha", optional: true },
  { name: "Councilor", attr: "loyalty", abilities: "Cha or Wis", vacancy: { loyalty: -2, unrest: 1 }, vacant: "no benefit from the Holiday edict" },
  { name: "General", attr: "stability", abilities: "Cha or Str", vacancy: { loyalty: -4 } },
  { name: "Grand Diplomat", attr: "stability", abilities: "Cha or Int", vacancy: { stability: -2 }, vacant: "no Diplomatic or Exploration edicts" },
  { name: "Heir", attr: "loyalty", half: true, abilities: "Cha", optional: true },
  { name: "High Priest", attr: "stability", abilities: "Cha or Wis", vacancy: { stability: -2, loyalty: -2, unrest: 1 } },
  { name: "Magister", attr: "economy", abilities: "Cha or Int", vacancy: { economy: -4 } },
  { name: "Marshal", attr: "economy", abilities: "Dex or Wis", vacancy: { economy: -4 } },
  { name: "Royal Enforcer", attr: "loyalty", abilities: "Dex or Str", optional: true },
  { name: "Spymaster", choice: true, one: true, abilities: "Dex or Int", vacancy: { economy: -4, unrest: 1 } },
  { name: "Treasurer", attr: "economy", abilities: "Int or Wis", vacancy: { economy: -4 }, vacant: "no taxes are collected" },
  { name: "Viceroy", attr: "economy", half: true, abilities: "Int or Wis", optional: true },
  { name: "Warden", attr: "loyalty", abilities: "Con or Str", vacancy: { loyalty: -2, stability: -2 } }]
const HOLIDAYS = [["None", -1, 0], ["1", 1, 1], ["6", 2, 2], ["12", 3, 4], ["24", 4, 8]] // a year, Loyalty, Consumption
const PROMOTION = [["None", -1, 0], ["Token", 1, 1], ["Standard", 2, 2], ["Aggressive", 3, 4], ["Expansionist", 4, 8]] // Stability, Consumption
const TAXATION = [["None", 0, 1], ["Light", 1, -1], ["Normal", 2, -2], ["Heavy", 3, -4], ["Overwhelming", 4, -8]] // Economy, Loyalty
// by kingdom Size: new settlements, new buildings, terrain improvements, hex claims a turn
const IMPROVEMENT = [[10, 1, 1, 2, 1], [25, 1, 2, 3, 2], [50, 1, 5, 5, 3], [100, 2, 10, 7, 4], [200, 3, 20, 9, 8], [Infinity, 4, "No limit", 12, 12]]
const SETTLEMENT_SIZE = [[20, "Thorp", 50], [60, "Hamlet", 200], [200, "Village", 500], [2000, "Small town", 1000], [5000, "Large town", 2000], [10000, "Small city", 4000], [25000, "Large city", 8000], [Infinity, "Metropolis", 16000]]
// terrain improvements counted on the sheet: what each adds
const IMPROVED = [
  { key: "farms", name: "Farms", consumption: -2 }, { key: "fisheries", name: "Fisheries", consumption: -1 }, { key: "mines", name: "Mines", economy: 1, income: 1 },
  { key: "quarries", name: "Quarries", stability: 1, income: 1 }, { key: "sawmills", name: "Sawmills", stability: 1, income: 1 }, { key: "forts", name: "Forts", stability: 2, consumption: 1, defense: 4 },
  { key: "watchtowers", name: "Watchtowers", stability: 1, defense: 2 }, { key: "aqueducts", name: "Aqueducts", loyalty: 1, stability: 1 },
  { key: "roads", name: "Road hexes", per: { economy: 4, stability: 8 } }, { key: "highways", name: "Highway hexes", per: { economy: 4, stability: 8 } }]

const DATA = { ready: false, buildings: [], improvements: [], terrain: [], urls: {}, byName: new Map() }
async function loadData() {
  const d = await fetch("../compendium/kingdom.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)
  if (d) Object.assign(DATA, d, { ready: true, byName: new Map(d.buildings.map((b) => [b.name, b])) })
  render()
}

const blankLeader = () => ({ filled: false, name: "", mod: 0, feat: false, pick: "economy" })
const blank = () => ({ name: "", alignment: "N", size: 1, treasury: 0, unrest: 0, d20: 10, leaders: Object.fromEntries(ROLES.map((r) => [r.name, blankLeader()])),
  holidays: 0, promotion: 0, taxation: 0, improved: {}, other: { economy: 0, loyalty: 0, stability: 0, consumption: 0, income: 0 }, settlements: [] })
let state = blank()
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"), b = blank()
  state = { ...b, ...saved, other: { ...b.other, ...(saved.other ?? {}) }, improved: { ...(saved.improved ?? {}) },
    leaders: Object.fromEntries(ROLES.map((r) => [r.name, { ...blankLeader(), ...(saved.leaders?.[r.name] ?? {}) }])) }
} catch {}
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {} }
const n0 = (v) => Math.max(0, Number(v) || 0)

// ---- the sums ----
function settlementTotals(s) {
  const rows = (s.buildings ?? []).map((r) => ({ row: r, def: DATA.byName.get(r.name), qty: n0(r.qty) })).filter((x) => x.def)
  const districts = Math.max(1, n0(s.districts) || 1)
  const present = new Set(rows.filter((x) => x.qty).map((x) => x.def.name))
  // a building halves the cost of the first of each kind it discounts
  const discounted = new Set(rows.filter((x) => x.qty).flatMap((x) => x.def.discount))
  const out = { rows, districts, lots: 0, bp: 0, bpDiscounted: 0, economy: 0, loyalty: 0, stability: 0, unrest: 0, fame: 0, defense: 0, baseValue: 0, settlement: {}, items: [], notes: [] }
  for (const { def, qty } of rows) {
    if (!qty) continue
    out.lots += def.lots * qty
    out.bp += def.bp * qty
    out.bpDiscounted += def.bp * qty - (discounted.has(def.name) ? Math.floor(def.bp / 2) : 0)
    for (const k of [...ATTRS, "unrest", "fame"]) out[k] += (def.kingdom[k] ?? 0) * qty
    out.defense += def.defense * qty
    out.baseValue += def.baseValue * qty
    for (const [k, v] of Object.entries(def.settlement)) out.settlement[k] = (out.settlement[k] ?? 0) + v * qty
    if (def.magicItems) out.items.push(`${qty > 1 ? qty + " × " : ""}${def.name}: ${def.magicItems}`)
    const per = /1 per settlement/.test(def.limit) ? 1 : /1 per district/.test(def.limit) ? districts : 0
    if (per && qty > per) out.notes.push(`${def.name}: ${def.limit.match(/1 per \w+/)[0]}.`)
    const need = def.limit.match(/Adjacent to (\d) (House[^,]*(?:, [A-Z][a-z]+(?: [A-Z][a-z]+)?)*(?:,? or [A-Z][a-z]+(?: [A-Z][a-z]+)?)?)/)
    if (need) {
      const kinds = [...new Set([...need[2].replace(/Houses/, "House").split(/, or |, | or /), "Tenement"])].filter((k) => DATA.byName.has(k))
      if (!kinds.some((k) => present.has(k))) out.notes.push(`${def.name} must be next to ${need[1] === "2" ? "2 Houses" : need[2].replace(/, or /, " or ")}.`)
    }
  }
  out.population = out.lots * 250
  const size = SETTLEMENT_SIZE.find((r) => out.population <= r[0])
  out.sizeName = size[1]
  out.value = Math.min(out.baseValue, size[2])
  out.cap = size[2]
  if (out.lots > districts * LOTS) out.notes.push(`${out.lots} lots of buildings; ${districts} district${districts === 1 ? " has" : "s have"} ${districts * LOTS}.`)
  return out
}

function totals() {
  const size = Math.max(0, n0(state.size))
  const sets = state.settlements.map((s) => ({ s, t: settlementTotals(s) }))
  const districts = sets.reduce((a, x) => a + x.t.districts, 0)
  const parts = { economy: [], loyalty: [], stability: [] }
  const add = (attr, what, n) => { if (n) parts[attr].push([what, n]) }
  const al = alignmentMods(state.alignment)
  for (const k of ATTRS) add(k, `${ALIGNMENTS[state.alignment]} alignment`, al[k])
  // leaders
  let upkeepUnrest = 0
  const flags = {}
  const rulerPicks = size >= 101 ? 3 : size >= 26 ? 2 : 1
  for (const role of ROLES) {
    const l = state.leaders[role.name]
    if (!l.filled) {
      if (role.optional) continue
      for (const k of ATTRS) add(k, `No ${role.name}`, role.vacancy?.[k] ?? 0)
      upkeepUnrest += role.vacancy?.unrest ?? 0
      flags[role.name] = true
      continue
    }
    const mod = Number(l.mod) || 0
    const bonus = (role.half ? Math.floor(mod / 2) : mod) + (l.feat ? 1 : 0)
    const label = `${role.name}${l.name ? ` (${l.name})` : ""}`
    if (role.name === "Ruler") {
      const picks = rulerPicks === 3 ? ATTRS : rulerPicks === 2 ? ATTRS.filter((k) => k !== l.pick) : [l.pick]
      for (const k of picks) add(k, label, bonus)
    } else add(role.choice ? l.pick : role.attr, label, bonus)
  }
  // edicts
  const hol = HOLIDAYS[state.holidays] ?? HOLIDAYS[0], pro = PROMOTION[state.promotion] ?? PROMOTION[0]
  const tax = flags.Treasurer ? TAXATION[0] : TAXATION[state.taxation] ?? TAXATION[0]
  const hasBuilding = (name) => sets.some((x) => x.t.rows.some((r) => r.def.name === name && r.qty))
  add("loyalty", `Holidays (${hol[0]} a year)`, flags.Councilor && hol[1] > 0 ? 0 : hol[1])
  add("stability", `Promotion (${pro[0].toLowerCase()})`, pro[1])
  add("economy", `Taxation (${tax[0].toLowerCase()})`, tax[1])
  add("loyalty", `Taxation (${tax[0].toLowerCase()})${hasBuilding("Waterfront") && tax[2] < 0 ? ", halved by a Waterfront" : ""}`, hasBuilding("Waterfront") && tax[2] < 0 ? Math.ceil(tax[2] / 2) : tax[2])
  // terrain improvements
  let consumption = size + districts, income = 0, defense = 0
  const cons = [["Size", size], ["Districts", districts]]
  for (const imp of IMPROVED) {
    const n = n0(state.improved[imp.key])
    if (!n) continue
    for (const k of ATTRS) add(k, `${n} ${imp.name.toLowerCase()}`, imp.per ? Math.floor(n / imp.per[k]) || 0 : (imp[k] ?? 0) * n)
    if (imp.consumption) { consumption += imp.consumption * n; cons.push([imp.name, imp.consumption * n]) }
    income += (imp.income ?? 0) * n
  }
  const promo = hasBuilding("Cathedral") ? Math.ceil(pro[2] / 2) : pro[2]
  for (const [what, n] of [[`Holidays`, hol[2]], [`Promotion${hasBuilding("Cathedral") && pro[2] ? " (halved by a Cathedral)" : ""}`, promo], ["Other", Number(state.other.consumption) || 0]]) if (n) { consumption += n; cons.push([what, n]) }
  // settlements
  let fame = 0, buildUnrest = 0, population = 0, bp = 0
  for (const { s, t } of sets) {
    for (const k of ATTRS) add(k, s.name || "Settlement", t[k])
    fame += t.fame; buildUnrest += t.unrest; population += t.population; bp += t.bp
  }
  for (const k of ATTRS) add(k, "Other", Number(state.other[k]) || 0)
  const score = Object.fromEntries(ATTRS.map((k) => [k, parts[k].reduce((a, p) => a + p[1], 0)]))
  const unrest = n0(state.unrest)
  const dc = 20 + size + districts
  const d20 = Math.min(20, Math.max(1, Number(state.d20) || 10))
  // a check: d20 + attribute − Unrest against the Control DC; a 1 always fails, a 20 always succeeds
  const check = (attr) => {
    const bonus = score[attr] - unrest
    const need = Math.min(20, Math.max(2, dc - bonus))
    return { bonus, need, chance: (21 - need) * 5, result: d20 + bonus, pass: d20 === 20 || (d20 !== 1 && d20 + bonus >= dc) }
  }
  const checks = Object.fromEntries(ATTRS.map((k) => [k, check(k)]))
  consumption = Math.max(0, consumption)
  // taxes are a third of the Economy check's result, whether or not it beats the Control DC
  const taxes = flags.Treasurer ? 0 : Math.floor(Math.max(0, checks.economy.result) / 3)
  const negative = ATTRS.filter((k) => score[k] < 0)
  const otherIncome = income + (Number(state.other.income) || 0)
  const limits = IMPROVEMENT.find((r) => size <= r[0])
  return { size, sets, districts, parts, score, unrest, dc, d20, checks, consumption, cons, taxes, otherIncome, net: taxes + otherIncome - consumption, upkeepUnrest, negative, flags, rulerPicks,
    fame, buildUnrest, population, bp, limits, treasury: Number(state.treasury) || 0, tax, hol, pro }
}

// ---- rendering ----
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`
const field = (label, inner, hint) => `<label class="field"><span>${label}</span>${inner}${hint ? `<span class="note">${hint}</span>` : ""}</label>`
const ext = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text))
const numIn = (attrs, v, width = "5rem") => `<input type="number" ${attrs} value="${esc(v)}" style="width:${width}" />`
const modsText = (m) => Object.entries(m).filter(([, v]) => v).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} ${signed(v)}`).join(", ")

function leaderRow(role, t) {
  const l = state.leaders[role.name]
  const key = esc(role.name)
  const pickOptions = role.name === "Ruler" && t.rulerPicks === 2
    ? ATTRS.map((k) => opt(k, ATTRS.filter((x) => x !== k).map((x) => LABEL[x]).join(" and "), l.pick)).join("")
    : ATTRS.map((k) => opt(k, LABEL[k], l.pick)).join("")
  const adds = role.choice ? (role.name === "Ruler" && t.rulerPicks === 3 ? "all three" : `<select data-leader="${key}" data-key="pick">${pickOptions}</select>`) : LABEL[role.attr]
  const vac = role.vacancy ? modsText(Object.fromEntries(Object.entries(role.vacancy).map(([k, v]) => [k === "unrest" ? "unrest each turn" : k, v]))) : ""
  return `<tr>
    <td><label style="white-space:nowrap"><input type="checkbox" data-leader="${key}" data-key="filled" ${l.filled ? "checked" : ""} /> <b>${esc(role.name)}</b></label>
      <div class="note">${l.filled ? "" : role.optional ? "No penalty while empty" : `Vacant: ${esc([vac, role.vacant].filter(Boolean).join("; "))}`}</div></td>
    <td><input type="text" data-leader="${key}" data-key="name" value="${esc(l.name)}" placeholder="Name" style="width:10rem" ${l.filled ? "" : "disabled"} /></td>
    <td>${numIn(`data-leader="${key}" data-key="mod" ${l.filled ? "" : "disabled"}`, l.mod, "4rem")} <span class="pi-meta">${role.half ? "half " : ""}${esc(role.abilities)}</span></td>
    <td><label style="white-space:nowrap"><input type="checkbox" data-leader="${key}" data-key="feat" ${l.feat ? "checked" : ""} ${l.filled ? "" : "disabled"} /> Leadership</label></td>
    <td>${l.filled ? adds : "—"}</td></tr>`
}

function settlementCard(x, i) {
  const { s, t } = x
  const row = ({ row, def, qty }, j) => `<tr>
      <td>${numIn(`data-bqty="${i}.${j}" min="0" max="99"`, row.qty, "3.6rem")}</td>
      <td>${ext(DATA.urls.buildings, def.name)} <span class="pi-meta">${def.lots ? `${def.lots} lot${def.lots === 1 ? "" : "s"}` : "no lot"}</span>
        ${def.limit || def.special ? `<div class="note">${esc([def.limit, def.special].filter(Boolean).join(". "))}</div>` : ""}
        ${def.upgradeTo.length ? `<div class="note">Upgrades to ${def.upgradeTo.map((n) => { const to = DATA.byName.get(n); return to ? `<a href="#" data-upgrade="${i}.${j}" data-to="${esc(n)}" title="Swap one for a ${esc(n)}: pay the difference, ${Math.max(0, to.bp - def.bp)} BP">${esc(n)}</a>` : esc(n) }).join(", ")}</div>` : ""}</td>
      <td>${esc(modsText(def.kingdom)) || "—"}</td>
      <td>${esc([modsText(def.settlement), def.baseValue ? `base value +${num(def.baseValue)} gp` : "", def.defense ? `Defense +${def.defense}` : ""].filter(Boolean).join("; ")) || "—"}</td>
      <td class="num">${num(def.bp * (qty || 1))} BP</td>
      <td><button type="button" data-bremove="${i}.${j}" title="Remove">✕</button></td></tr>`
  return `<section class="card">
    <div class="row">
      ${field("Settlement", `<input type="text" data-set="${i}" data-key="name" value="${esc(s.name ?? "")}" placeholder="Name" style="width:14rem" />`)}
      ${field("Districts", numIn(`data-set="${i}" data-key="districts" min="1" max="20"`, s.districts ?? 1, "4.5rem"), `${t.lots} of ${t.districts * LOTS} lots used`)}
      ${field("Add a building", `<select data-addbuilding="${i}"><option value="">Choose…</option>${DATA.buildings.map((b) => `<option value="${esc(b.name)}">${esc(b.name)} (${b.bp} BP${b.lots > 1 ? `, ${b.lots} lots` : ""})</option>`).join("")}</select>`)}
      <span class="spacer"></span><button type="button" data-setremove="${i}">Remove settlement</button>
    </div>
    ${t.rows.length ? `<div class="table-wrap"><table class="mods">
      <thead><tr><th>#</th><th>Building</th><th>Kingdom</th><th>Settlement</th><th class="num">Cost</th><th></th></tr></thead><tbody>${t.rows.map(row).join("")}</tbody></table></div>
      <div class="table-wrap"><table class="mods"><tbody>
        <tr><td>${esc(t.sizeName)} <span class="pi-meta">population about ${num(t.population)}</span></td><td class="num">base value ${num(t.value)} gp <span class="pi-meta">of at most ${num(t.cap)} gp</span></td></tr>
        <tr><td>Adds to the kingdom</td><td class="num">${esc(modsText({ economy: t.economy, loyalty: t.loyalty, stability: t.stability, fame: t.fame })) || "—"}</td></tr>
        ${t.unrest ? `<tr><td>Unrest as its buildings were completed <span class="pi-meta">once each, not counted below</span></td><td class="num">${signed(t.unrest)}</td></tr>` : ""}
        ${Object.keys(t.settlement).length || t.defense ? `<tr><td>Settlement modifiers</td><td class="num">${esc([modsText(t.settlement), t.defense ? `Defense ${signed(t.defense)}` : ""].filter(Boolean).join(", "))}</td></tr>` : ""}
        <tr><td>Buildings' cost <span class="pi-meta">${t.bpDiscounted < t.bp ? `${num(t.bpDiscounted)} BP with each discount used once` : "no discounts"}</span></td><td class="num">${num(t.bp)} BP</td></tr>
      </tbody></table></div>
      ${t.items.length ? `<p class="note"><b>Magic item slots:</b> ${esc(t.items.join("; "))}</p>` : ""}
      ${t.notes.map((n) => `<p class="warn">⚠ ${esc(n)}</p>`).join("")}`
      : `<p class="muted">Add this settlement's buildings. A first settlement usually starts with an Inn, Shrine, Monastery or Watchtower, and a House or Tenement.</p>`}
  </section>`
}

function render() {
  if (!DATA.ready) { $("panel").innerHTML = `<section class="card"><p class="muted">Loading the kingdom tables…</p></section>`; return }
  const t = totals()
  const attrCard = (k) => { const c = t.checks[k]; return `<div style="flex:1 1 15rem"><h3>${LABEL[k]} <span class="muted">${signed(t.score[k])}</span></h3>
      <div class="table-wrap"><table class="mods"><tbody>${t.parts[k].map(([what, n]) => `<tr><td>${esc(what)}</td><td class="num">${signed(n)}</td></tr>`).join("") || `<tr><td class="muted">Nothing yet</td><td></td></tr>`}
        ${t.unrest ? `<tr><td>Unrest, on checks</td><td class="num">−${t.unrest}</td></tr>` : ""}
        <tr><td><b>Check</b> <span class="pi-meta">needs a ${c.need}${c.need >= 20 ? " (a natural 20)" : c.need <= 2 ? " (fails only on a 1)" : ""}</span></td><td class="num"><b>${signed(c.bonus)}</b> · ${c.chance}%</td></tr>
      </tbody></table></div></div>` }
  const stab = t.checks.stability
  $("panel").innerHTML = `
    <section class="card">
      <h2>The kingdom</h2>
      <div class="row">
        ${field("Name", `<input type="text" data-opt="name" value="${esc(state.name)}" placeholder="The Stolen Lands" style="width:15rem" />`)}
        ${field("Alignment", `<select data-opt="alignment">${Object.entries(ALIGNMENTS).map(([k, l]) => opt(k, l, state.alignment)).join("")}</select>`, esc(modsText(alignmentMods(state.alignment))))}
        ${field("Size (hexes)", numIn(`data-opt="size" min="0"`, state.size), "1 BP to claim each")}
        ${field("Treasury (BP)", numIn(`data-opt="treasury"`, state.treasury), `about ${num(t.treasury * BP_GP)} gp`)}
        ${field("Unrest", numIn(`data-opt="unrest" min="0"`, state.unrest), "Off every kingdom check")}
        ${field("The d20", numIn(`data-opt="d20" min="1" max="20"`, state.d20, "4.5rem"), "For the turn below; 10 is average")}
      </div>
      <h3>Edicts</h3>
      <div class="row">
        ${field("Holidays a year", `<select data-opt="holidays">${HOLIDAYS.map((h, i) => opt(i, `${h[0]} (Loyalty ${signed(h[1])}, Consumption +${h[2]})`, state.holidays)).join("")}</select>`, t.flags.Councilor ? "No benefit without a Councilor" : "")}
        ${field("Promotion", `<select data-opt="promotion">${PROMOTION.map((h, i) => opt(i, `${h[0]} (Stability ${signed(h[1])}, Consumption +${h[2]})`, state.promotion)).join("")}</select>`)}
        ${field("Taxation", `<select data-opt="taxation">${TAXATION.map((h, i) => opt(i, `${h[0]} (Economy ${signed(h[1])}, Loyalty ${signed(h[2])})`, state.taxation)).join("")}</select>`, t.flags.Treasurer ? "No taxes without a Treasurer" : "")}
      </div>
      <h3>Hexes</h3>
      <div class="row">
        ${IMPROVED.map((imp) => field(imp.name, numIn(`data-improved="${imp.key}" min="0"`, n0(state.improved[imp.key]), "4.5rem"), esc(imp.per ? "Economy +1 per 4, Stability +1 per 8" : [modsText({ economy: imp.economy, stability: imp.stability, loyalty: imp.loyalty }), imp.consumption ? `Consumption ${signed(imp.consumption)}` : "", imp.income ? "+1 BP a turn" : ""].filter(Boolean).join(", ")))).join("")}
      </div>
      <div class="row">
        ${ATTRS.map((k) => field(`Other ${LABEL[k]}`, numIn(`data-other="${k}"`, state.other[k], "4.5rem"))).join("")}
        ${field("Other Consumption", numIn(`data-other="consumption"`, state.other.consumption, "4.5rem"))}
        ${field("Other income (BP)", numIn(`data-other="income"`, state.other.income, "4.5rem"), "Events, special terrain, trade, Granaries and the like")}
      </div>
    </section>
    <section class="card">
      <h2>Leaders</h2>
      <div class="table-wrap"><table class="mods"><thead><tr><th>Role</th><th>Leader</th><th>Ability modifier</th><th>Feat</th><th>Adds to</th></tr></thead>
        <tbody>${ROLES.map((r) => leaderRow(r, t)).join("")}</tbody></table></div>
      <p class="note">Tick a role when someone holds it and spends 7 days a month at it. A leader adds an ability modifier (the higher of the two listed; half for a Consort, Heir or Viceroy) to the attribute shown, and 1 more with the Leadership feat. The Ruler adds to one attribute, two at Size 26 and all three at Size 101.</p>
    </section>
    ${t.sets.map(settlementCard).join("")}
    <section class="card"><div class="row add-row"><button type="button" class="primary" id="btnSettlement">Add a settlement</button><button type="button" id="btnCopy">Copy as text</button><button type="button" id="btnClear">Start over</button></div></section>
    <section class="card">
      <div class="row"><h2 style="margin:0">${esc(state.name || "Kingdom")}</h2><span class="spacer"></span><span class="muted">${esc(ALIGNMENTS[state.alignment])} · Size ${t.size} · ${t.sets.length} settlement${t.sets.length === 1 ? "" : "s"}, ${t.districts} district${t.districts === 1 ? "" : "s"} · population about ${num(t.population)}</span></div>
      <div class="row" style="align-items:flex-start;gap:1.5rem">${ATTRS.map(attrCard).join("")}</div>
      <div class="row" style="align-items:flex-start;gap:1.5rem">
        <div style="flex:1 1 20rem"><h3>Sheet</h3><div class="table-wrap"><table class="mods"><tbody>
          <tr><td>Control DC <span class="pi-meta">20 + Size + districts</span></td><td class="num"><b>${t.dc}</b></td></tr>
          <tr><td>Consumption <span class="pi-meta">${esc(t.cons.map(([w, n]) => `${w} ${signed(n)}`).join(", "))}</span></td><td class="num"><b>${t.consumption} BP</b></td></tr>
          <tr><td>Unrest</td><td class="num">${t.unrest}</td></tr>
          ${t.fame ? `<tr><td>Fame from buildings</td><td class="num">${signed(t.fame)}</td></tr>` : ""}
          <tr><td>Buildings standing <span class="pi-meta">about ${num(t.bp * BP_GP)} gp</span></td><td class="num">${num(t.bp)} BP</td></tr>
          <tr><td>Each turn you may <span class="pi-meta">improvement edicts at Size ${t.size}</span></td><td class="num">found ${t.limits[1]} settlement${t.limits[1] === 1 ? "" : "s"}, ${String(t.limits[2]).toLowerCase() === "no limit" ? "any number of buildings" : `${t.limits[2]} building${t.limits[2] === 1 ? "" : "s"}`}, ${t.limits[3]} terrain improvements, claim ${t.limits[4]} hex${t.limits[4] === 1 ? "" : "es"}</td></tr>
        </tbody></table></div></div>
        <div style="flex:1 1 20rem"><h3>A turn, on a ${t.d20}</h3><div class="table-wrap"><table class="mods"><tbody>
          <tr><td>Upkeep: Stability check <span class="pi-meta">${stab.result} against DC ${t.dc}</span></td><td class="num">${stab.pass ? (t.unrest ? "Unrest −1" : "+1 BP") : stab.result >= t.dc - 4 ? "Unrest +1" : "Unrest +1d4"}</td></tr>
          <tr><td>Upkeep: pay Consumption</td><td class="num">−${t.consumption} BP</td></tr>
          ${t.upkeepUnrest ? `<tr><td>Upkeep: vacant roles <span class="pi-meta">${esc(ROLES.filter((r) => t.flags[r.name] && r.vacancy?.unrest).map((r) => r.name).join(", "))}</span></td><td class="num">Unrest +${t.upkeepUnrest}</td></tr>` : ""}
          ${t.negative.length ? `<tr><td>Upkeep: negative attributes <span class="pi-meta">${esc(t.negative.map((k) => LABEL[k]).join(", "))}</span></td><td class="num">Unrest +${t.negative.length}</td></tr>` : ""}
          <tr><td>Income: Economy check <span class="pi-meta">${t.flags.Treasurer ? "no Treasurer, no taxes" : `a third of the result, ${t.checks.economy.result}`}</span></td><td class="num">+${t.taxes} BP</td></tr>
          ${t.otherIncome ? `<tr><td>Income: mines, quarries, sawmills and other</td><td class="num">${signed(t.otherIncome)} BP</td></tr>` : ""}
          <tr><td><b>Net</b></td><td class="num"><b>${signed(t.net + (stab.pass && !t.unrest ? 1 : 0))} BP</b></td></tr>
          <tr><td>Treasury after</td><td class="num">${num(t.treasury + t.net + (stab.pass && !t.unrest ? 1 : 0))} BP</td></tr>
        </tbody></table></div></div>
      </div>
      ${t.treasury + t.net < 0 ? `<p class="warn">⚠ The Treasury goes negative: Unrest +2 when Consumption can't be paid.</p>` : ""}
      ${t.unrest >= 20 ? `<p class="warn">⚠ Unrest 20 or more: the kingdom falls into anarchy.</p>` : t.unrest >= 11 ? `<p class="warn">⚠ Unrest above 10: the kingdom loses a hex each Upkeep phase.</p>` : ""}
      ${t.flags.Ruler ? `<p class="warn">⚠ No Ruler: the kingdom can't claim hexes, make Farms, build Roads or buy districts.</p>` : ""}
    </section>
    <section class="card">
      <p class="note">Rules: ${ext(DATA.urls.rules, "Kingdom Building")} (${ext(DATA.urls.leadership, "leadership roles")}, ${ext(DATA.urls.edicts, "edicts")}, ${ext(DATA.urls.improvements, "terrain improvements")}, ${ext(DATA.urls.settlements, "settlements")}, ${ext(DATA.urls.buildings, "buildings")}) on Archives of Nethys, from Pathfinder RPG Ultimate Campaign. A building's Unrest change happens once when it is finished, so set Unrest yourself. Not modeled: the district grid (which lots are adjacent, and land or water borders), events, armies, special terrain, and the optional rules (fame and infamy, forms of government, trade and special edicts).</p>
    </section>`
}

function summary() {
  const t = totals()
  const lines = [state.name || "Kingdom", `${ALIGNMENTS[state.alignment]}; Size ${t.size}; Control DC ${t.dc}; population about ${num(t.population)}`,
    `Economy ${signed(t.score.economy)}; Loyalty ${signed(t.score.loyalty)}; Stability ${signed(t.score.stability)}; Unrest ${t.unrest}`,
    `Consumption ${t.consumption} BP; Treasury ${num(t.treasury)} BP; income on a ${t.d20}: ${t.taxes + t.otherIncome} BP`,
    `Edicts: holidays ${t.hol[0]}, promotion ${t.pro[0].toLowerCase()}, taxation ${t.tax[0].toLowerCase()}`, "", "Leaders:"]
  for (const r of ROLES) { const l = state.leaders[r.name]; if (l.filled || !r.optional) lines.push(`- ${r.name}: ${l.filled ? `${l.name || "filled"} (${signed(Number(l.mod) || 0)}${l.feat ? ", Leadership" : ""})` : "vacant"}`) }
  const hexes = IMPROVED.filter((i) => n0(state.improved[i.key])).map((i) => `${n0(state.improved[i.key])} ${i.name.toLowerCase()}`)
  if (hexes.length) lines.push("", `Terrain improvements: ${hexes.join(", ")}`)
  for (const { s, t: st } of t.sets) lines.push("", `${s.name || "Settlement"} (${st.sizeName.toLowerCase()}, population ${num(st.population)}, ${st.districts} district${st.districts === 1 ? "" : "s"}, base value ${num(st.value)} gp${st.defense ? `, Defense ${st.defense}` : ""})`,
    st.rows.filter((r) => r.qty).map((r) => `${r.qty > 1 ? r.qty + " " : ""}${r.def.name}`).join(", ") || "no buildings")
  return lines.join("\n")
}

function toast(msg) {
  const t = $("toast")
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), 2500)
}
const value = (el) => (el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) || 0 : el.value)
function addBuilding(set, name, qty = 1) {
  set.buildings ??= []
  const hit = set.buildings.find((b) => b.name === name)
  if (hit) hit.qty = n0(hit.qty) + qty
  else set.buildings.push({ name, qty })
}

$("panel").addEventListener("change", (e) => {
  const el = e.target, d = el.dataset
  if (d.leader) state.leaders[d.leader][d.key] = value(el)
  else if (d.improved) state.improved[d.improved] = n0(el.value)
  else if (d.other) state.other[d.other] = Number(el.value) || 0
  else if (d.addbuilding && el.value) addBuilding(state.settlements[Number(d.addbuilding)], el.value)
  else if (d.set) state.settlements[Number(d.set)][d.key] = value(el)
  else if (d.bqty) { const [i, j] = d.bqty.split(".").map(Number); state.settlements[i].buildings[j].qty = n0(el.value) }
  else if (d.opt) state[d.opt] = value(el)
  else return
  save()
  render()
})
$("panel").addEventListener("click", (e) => {
  const el = e.target, d = el.dataset
  if (d.bremove) { const [i, j] = d.bremove.split(".").map(Number); state.settlements[i].buildings.splice(j, 1) }
  else if (d.upgrade) {
    e.preventDefault()
    const [i, j] = d.upgrade.split(".").map(Number), set = state.settlements[i], row = set.buildings[j]
    row.qty = n0(row.qty) - 1
    if (row.qty <= 0) set.buildings.splice(j, 1)
    addBuilding(set, d.to)
  } else if (d.setremove) state.settlements.splice(Number(d.setremove), 1)
  else if (el.id === "btnSettlement") state.settlements.push({ name: state.settlements.length ? "" : "Capital", districts: 1, buildings: [] })
  else if (el.id === "btnClear") state = blank()
  else if (el.id === "btnCopy") { navigator.clipboard?.writeText(summary()).then(() => toast("Copied"), () => toast("Couldn't copy")); return }
  else return
  save()
  render()
})

// follow the wiki's dark-mode toggle when embedded on the site
function applyTheme(theme) {
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme
}
try {
  window.parent?.document?.addEventListener("themechange", (e) => applyTheme(e.detail?.theme))
} catch {}
window.addEventListener("storage", (e) => e.key === "theme" && applyTheme(e.newValue))

render()
loadData()
