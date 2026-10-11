// Business Builder: put a building or organization together from the downtime rules' rooms and
// teams (Pathfinder RPG Ultimate Campaign, statistics from Archives of Nethys in
// compendium/downtime.json), and work out what it costs, how long it takes and what it earns.

const STORAGE_KEY = "sop-business-builder"
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch])
const num = (n, digits = 0) => (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: digits })
const gp = (n) => num(n, 2) + " gp"
const CAPITAL = ["goods", "influence", "labor", "magic"]
const KINDS = ["gp", ...CAPITAL]
const LABEL = { gp: "gp", goods: "Goods", influence: "Influence", labor: "Labor", magic: "Magic" }

const DATA = { ready: false, capital: {}, units: new Map(), rooms: [], teams: [], buildings: [], organizations: [], managers: [], urls: {} }
async function loadData() {
  const d = await fetch("../compendium/downtime.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)
  if (d) {
    Object.assign(DATA, d, { ready: true, units: new Map([...d.rooms, ...d.teams].map((u) => [u.name, u])) })
    state.units = state.units.filter((u) => DATA.units.has(u.name))
  }
  render()
}

const blank = () => ({ name: "", units: [], manager: "", wage: 0, d20: 10, run: false, rush: 1, have: { goods: 0, influence: 0, labor: 0, magic: 0 }, days: 30 })
let state = blank()
try { state = { ...state, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; state.have = { ...blank().have, ...state.have } } catch {}
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {} }

// ---- the sums ----
const unitOf = (row) => DATA.units.get(row.name)
// "capital +5 (of a type the building already generates)": only counts toward a type another room or team earns
const follows = (u) => /already generates|room's check/i.test(u.earnings?.text ?? "")

function totals() {
  const rows = state.units.map((r) => ({ row: r, u: unitOf(r), qty: Math.max(0, Number(r.qty) || 0) })).filter((x) => x.u)
  const rush = Math.min(4, Math.max(1, Number(state.rush) || 1))
  const cost = { goods: 0, influence: 0, labor: 0, magic: 0 }
  let days = 0, rooms = 0, teams = 0
  for (const { u, qty } of rows) {
    for (const k of CAPITAL) cost[k] += u.create[k] * qty * (rush > 1 && k === (u.kind === "team" ? "influence" : "labor") ? rush : 1)
    days += Math.ceil(u.days / rush) * qty
    if (u.kind === "team") teams += qty
    else rooms += qty
  }
  const price = (c, at) => CAPITAL.reduce((s, k) => s + c[k] * DATA.capital[k][at], 0)
  const need = Object.fromEntries(CAPITAL.map((k) => [k, Math.max(0, cost[k] - (Number(state.have[k]) || 0))]))
  // what it earns: one check a day per kind of capital, with every room and team that can earn that kind
  const made = new Set(rows.filter((x) => x.qty && x.u.earnings && !follows(x.u)).flatMap((x) => x.u.earnings.kinds))
  const d20 = Math.min(20, Math.max(1, Number(state.d20) || 10))
  const earn = KINDS.map((kind) => {
    let bonus = 0
    const from = []
    for (const { u, qty } of rows) {
      if (!qty || !u.earnings || !u.earnings.kinds.includes(kind) || (follows(u) && !made.has(kind))) continue
      // teams with no building to work from earn half
      const b = u.earnings.bonus * qty * (u.kind === "team" && !rooms ? 0.5 : 1)
      bonus += b
      from.push(`${qty > 1 ? qty + " × " : ""}${u.name} +${num(b, 1)}`)
    }
    bonus = Math.floor(bonus)
    const check = bonus ? d20 + bonus + (state.run ? 10 : 0) : 0
    const amount = kind === "gp" ? check / 10 : Math.floor(check / 10)
    return { kind, bonus, check, amount, from, keep: kind === "gp" ? 0 : amount * DATA.capital[kind].earn, worth: kind === "gp" ? amount : amount * DATA.capital[kind].buy }
  })
  const manager = DATA.managers.find((m) => m.name === state.manager)
  const wage = state.manager === "custom" ? Number(state.wage) || 0 : manager?.wage ?? 0
  return { rows, cost, days, rooms, teams, rush, buy: price(cost, "buy"), earnIt: price(cost, "earn"), need, needGp: price(need, "buy"), earn, wage, manager, d20 }
}

// ---- rendering ----
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`
const field = (label, inner, hint) => `<label class="field"><span>${label}</span>${inner}${hint ? `<span class="note">${hint}</span>` : ""}</label>`
const capText = (c, times = 1) => CAPITAL.filter((k) => c[k]).map((k) => `${num(c[k] * times)} ${LABEL[k]}`).join(", ") || "none"
const ext = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : esc(text))

function unitOptions(list) {
  return `<option value="">Choose…</option>` + list.map((u) => `<option value="${esc(u.name)}">${esc(u.name)}${u.earnings ? ` (${esc(u.earnings.text.replace(/\s*\(.*$/, "").replace(/\+\s+/, "+"))})` : ""}, ${num(u.create.gp)} gp</option>`).join("")
}

function render() {
  if (!DATA.ready) { $("panel").innerHTML = `<section class="card"><p class="muted">Loading the downtime tables…</p></section>`; return }
  const t = totals()
  const unitRow = ({ row, u, qty }, i) => `<tr>
      <td><input type="number" data-qty="${i}" value="${esc(row.qty)}" min="0" max="99" style="width:3.6rem" /></td>
      <td>${ext(DATA.urls[u.kind === "team" ? "teams" : "rooms"], u.name)} <span class="pi-meta">${u.kind}${row.note ? ` · ${esc(row.note)}` : ""}</span>
        ${u.benefit ? `<div class="note">${esc(u.benefit)}</div>` : ""}
        ${u.upgradesTo.length ? `<div class="note">Upgrades to ${u.upgradesTo.map((n) => { const to = DATA.units.get(n); return to ? `<a href="#" data-upgrade="${i}" data-to="${esc(n)}" title="Swap one for a ${esc(n)}: pay the difference (${num(Math.max(0, to.create.gp - u.create.gp))} gp in capital, ${Math.max(0, to.days - u.days)} days)">${esc(n)}</a>` : esc(n) }).join(", ")}</div>` : ""}</td>
      <td>${u.earnings ? esc(u.earnings.text.replace(/\+\s+/, "+")) : "—"}</td>
      <td>${esc(capText(u.create, qty || 1))}</td>
      <td class="num">${num(u.create.gp * (qty || 1))} gp</td>
      <td class="num">${u.days * (qty || 1)}</td>
      <td>${esc(u.size)}</td>
      <td><button type="button" data-remove="${i}" title="Remove">✕</button></td>
    </tr>`
  const earnRow = (e) => `<tr>
      <td><b>${LABEL[e.kind]}</b></td>
      <td class="num">${e.bonus ? "+" + e.bonus : "—"}</td>
      <td class="num">${e.bonus ? e.check : "—"}</td>
      <td class="num">${e.bonus ? (e.kind === "gp" ? gp(e.amount) : `${e.amount} ${LABEL[e.kind]}`) : "—"}</td>
      <td class="num">${e.bonus && e.kind !== "gp" ? gp(e.keep) : "—"}</td>
      <td class="num">${e.bonus ? gp(e.worth - e.keep) : "—"}</td>
      <td class="note">${esc(e.from.join(", "))}</td>
    </tr>`
  const gpDay = t.earn[0].amount
  const best = t.earn.filter((e) => e.bonus).sort((a, b) => b.worth - b.keep - (a.worth - a.keep))[0]
  const period = Math.max(1, Number(state.days) || 30)
  $("panel").innerHTML = `
    <section class="card">
      <h2>The business</h2>
      <div class="row">
        ${field("Name", `<input type="text" data-opt="name" value="${esc(state.name)}" placeholder="The Gilded Griffon" style="width:16rem" />`)}
        ${field("Start from an example", `<select id="template"><option value="">Choose a building or organization…</option>
          <optgroup label="Buildings">${DATA.buildings.map((b) => `<option value="b:${esc(b.name)}">${esc(b.name)} (${num(b.create.gp)} gp)</option>`).join("")}</optgroup>
          <optgroup label="Organizations">${DATA.organizations.map((b) => `<option value="o:${esc(b.name)}">${esc(b.name)} (${num(b.create.gp)} gp)</option>`).join("")}</optgroup></select>`, "Adds its rooms or teams to the list")}
        ${field("Add a room", `<select id="addRoom">${unitOptions(DATA.rooms)}</select>`)}
        ${field("Add a team", `<select id="addTeam">${unitOptions(DATA.teams)}</select>`)}
      </div>
      ${t.rows.length ? `<div class="table-wrap"><table class="mods">
        <thead><tr><th>#</th><th>Room or team</th><th>Earnings</th><th>Create</th><th class="num">Bought</th><th class="num">Days</th><th>Size</th><th></th></tr></thead>
        <tbody>${t.rows.map(unitRow).join("")}</tbody></table></div>
        <div class="row add-row"><button type="button" id="btnCopy">Copy as text</button><button type="button" id="btnSave" title="Download this as a file you can load again later">Save to file</button><button type="button" id="btnLoad" title="Open a file saved from this tool">Load from file</button><button type="button" id="btnClear">Clear</button></div>`
        : `<div class="row add-row"><button type="button" id="btnLoad" title="Open a file saved from this tool">Load from file</button></div><p class="muted">Pick an example building or organization to start from, or add rooms and teams one at a time. A building is a set of rooms; an organization is a set of teams; a business can have both.</p>`}
    </section>
    ${t.rows.length ? `
    <section class="card">
      <h2>Cost to create</h2>
      <div class="row">
        ${field("Rush the work", `<select data-opt="rush">${opt(1, "Normal time", state.rush)}${opt(2, "Half the time (2 × Labor / Influence)", state.rush)}${opt(3, "A third (3 ×)", state.rush)}${opt(4, "A quarter (4 ×)", state.rush)}</select>`, "Rooms cost extra Labor, teams extra Influence")}
        ${CAPITAL.map((k) => field(`${LABEL[k]} on hand`, `<input type="number" data-have="${k}" value="${esc(state.have[k])}" min="0" style="width:5.5rem" />`)).join("")}
      </div>
      <div class="table-wrap"><table class="mods"><tbody>
        <tr><td>Capital</td><td class="num">${esc(capText(t.cost))}</td></tr>
        <tr><td>Bought outright <span class="pi-meta">Goods and Labor ${DATA.capital.goods.buy} gp, Influence ${DATA.capital.influence.buy} gp, Magic ${DATA.capital.magic.buy} gp each</span></td><td class="num"><b>${gp(t.buy)}</b></td></tr>
        <tr><td>Earned with your own downtime <span class="pi-meta">half price</span></td><td class="num">${gp(t.earnIt)}</td></tr>
        ${CAPITAL.some((k) => Number(state.have[k]) > 0) ? `<tr><td>Still to buy after the capital on hand <span class="pi-meta">${esc(capText(t.need))}</span></td><td class="num"><b>${gp(t.needGp)}</b></td></tr>` : ""}
        <tr><td>Time, one after another <span class="pi-meta">${t.rooms} room${t.rooms === 1 ? "" : "s"}, ${t.teams} team${t.teams === 1 ? "" : "s"}${t.rush > 1 ? `, rushed × ${t.rush}` : ""}</span></td><td class="num">${num(t.days)} days</td></tr>
        <tr><td>Sold off <span class="pi-meta">half its price</span></td><td class="num">${gp(t.buy / 2)}</td></tr>
      </tbody></table></div>
    </section>
    <section class="card">
      <h2>Earnings per day</h2>
      <div class="row">
        ${field("The d20", `<input type="number" data-opt="d20" value="${esc(state.d20)}" min="1" max="20" style="width:4.5rem" />`, "10 is taking 10")}
        <label class="field"><span>&nbsp;</span><span class="row" style="gap:.3rem"><input type="checkbox" data-opt="run" ${state.run ? "checked" : ""} /> You spend the day running it (+10)</span></label>
        ${field("Manager", `<select data-opt="manager">${opt("", "None", state.manager)}${DATA.managers.map((m) => opt(m.name, `${m.name} (${num(m.wage, 1)} gp/day)`, state.manager)).join("")}${opt("custom", "Someone else…", state.manager)}</select>`)}
        ${state.manager === "custom" ? field("Wage (gp/day)", `<input type="number" data-opt="wage" value="${esc(state.wage)}" min="0" step="0.5" style="width:5rem" />`) : ""}
        ${field("Over (days)", `<input type="number" data-opt="days" value="${esc(state.days)}" min="1" style="width:5rem" />`)}
      </div>
      <div class="table-wrap"><table class="mods">
        <thead><tr><th>Earning</th><th class="num">Bonus</th><th class="num">Check</th><th class="num">Per day</th><th class="num">Cost to keep</th><th class="num">Net worth</th><th>From</th></tr></thead>
        <tbody>${t.earn.map(earnRow).join("")}</tbody></table></div>
      <p class="note">Each row is the whole business earning that one kind of capital for the day: the check is the d20 plus the bonus of every room and team that can earn it, and a tenth of the result is what comes in (gp to the silver piece, other capital in whole points, which you pay the earned price to keep). You may instead split the rooms and teams between kinds, each group making its own check.${!t.rooms && t.teams ? " Teams with no building to work from earn half." : ""}</p>
      ${t.earn[0].bonus || t.wage ? `<div class="table-wrap"><table class="mods"><tbody>
        ${t.earn[0].bonus ? `<tr><td>Earning gp</td><td class="num">${gp(gpDay)} a day</td><td class="num">${gp(gpDay * period)} in ${num(period)} days</td></tr>` : ""}
        ${t.wage ? `<tr><td>${esc(state.manager === "custom" ? "Manager" : state.manager)}'s wage${t.manager?.skills ? ` <span class="pi-meta">${esc(t.manager.skills)}</span>` : ""}</td><td class="num">−${gp(t.wage)} a day</td><td class="num">−${gp(t.wage * period)}</td></tr>` : ""}
        ${t.earn[0].bonus ? `<tr><td><b>Net</b></td><td class="num"><b>${gp(gpDay - t.wage)} a day</b></td><td class="num"><b>${gp((gpDay - t.wage) * period)}</b></td></tr>
        ${gpDay - t.wage > 0 ? `<tr><td>Pays for itself <span class="pi-meta">at the bought price</span></td><td class="num" colspan="2">${num(Math.ceil((CAPITAL.some((k) => Number(state.have[k]) > 0) ? t.needGp : t.buy) / (gpDay - t.wage)))} days</td></tr>` : ""}` : ""}
      </tbody></table></div>` : ""}
      ${best && best.kind !== "gp" ? `<p class="note">Worth the most per day here: ${LABEL[best.kind]} (${best.amount} a day, ${gp(best.worth - best.keep)} over what it costs to keep, if you'd otherwise buy it).</p>` : ""}
    </section>` : ""}
    <section class="card">
      <p class="note">Rules: ${ext(DATA.urls.rules, "Downtime")} (${ext(DATA.urls.rooms, "rooms")}, ${ext(DATA.urls.teams, "teams")}, ${ext(DATA.urls.buildings, "buildings")}, ${ext(DATA.urls.organizations, "organizations")}, ${ext(DATA.urls.managers, "managers")}) on Archives of Nethys, from Pathfinder RPG Ultimate Campaign. Not counted here: the settlement's limits on how much capital you can buy or spend, events, and what happens when you are away (a business left with no manager loses capital and earnings over time).</p>
    </section>`
}

function summary() {
  const t = totals()
  const lines = [state.name || "Business", ""]
  for (const { row, u, qty } of t.rows) lines.push(`${qty} × ${u.name}${row.note ? ` (${row.note})` : ""}: ${u.earnings ? u.earnings.text : "no earnings"}; ${capText(u.create, qty)} (${num(u.create.gp * qty)} gp), ${u.days * qty} days`)
  lines.push("", `Create: ${capText(t.cost)} (${gp(t.buy)} bought, ${gp(t.earnIt)} earned)`, `Time: ${num(t.days)} days${t.rush > 1 ? ` (rushed × ${t.rush})` : ""}`)
  for (const e of t.earn.filter((e) => e.bonus)) lines.push(`Earns ${LABEL[e.kind]} +${e.bonus}: ${e.kind === "gp" ? gp(e.amount) : `${e.amount} ${LABEL[e.kind]}`} a day (d20 of ${t.d20}${state.run ? ", +10 running it" : ""})`)
  if (t.wage) lines.push(`Manager: ${state.manager === "custom" ? "manager" : state.manager}, ${gp(t.wage)} a day`)
  return lines.join("\n")
}

function addUnit(name, qty = 1, note = "") {
  const hit = state.units.find((u) => u.name === name && (u.note ?? "") === note)
  if (hit) hit.qty = (Number(hit.qty) || 0) + qty
  else state.units.push({ name, qty, ...(note ? { note } : {}) })
}

function toast(msg) {
  const t = $("toast")
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), 2500)
}

$("panel").addEventListener("change", (e) => {
  const el = e.target
  if (el.id === "template" && el.value) {
    const [kind, name] = [el.value[0], el.value.slice(2)]
    const ex = (kind === "b" ? DATA.buildings : DATA.organizations).find((b) => b.name === name)
    for (const m of ex?.units ?? []) addUnit(m.name, m.qty, m.note)
    if (ex && !state.name) state.name = ex.name
  } else if ((el.id === "addRoom" || el.id === "addTeam") && el.value) addUnit(el.value)
  else if (el.dataset.qty) state.units[Number(el.dataset.qty)].qty = Math.max(0, Number(el.value) || 0)
  else if (el.dataset.have) state.have[el.dataset.have] = Math.max(0, Number(el.value) || 0)
  else if (el.dataset.opt) state[el.dataset.opt] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) || 0 : el.value
  else return
  save()
  render()
})
$("panel").addEventListener("click", (e) => {
  const el = e.target
  if (el.dataset.remove) state.units.splice(Number(el.dataset.remove), 1)
  else if (el.dataset.upgrade) {
    e.preventDefault()
    const row = state.units[Number(el.dataset.upgrade)]
    row.qty = (Number(row.qty) || 0) - 1
    if (row.qty <= 0) state.units.splice(Number(el.dataset.upgrade), 1)
    addUnit(el.dataset.to)
  } else if (el.id === "btnClear") state = { ...state, units: [], name: "" }
  else if (el.id === "btnCopy") { navigator.clipboard?.writeText(summary()).then(() => toast("Copied"), () => toast("Couldn't copy")); return }
  else return
  save()
  render()
})

// ---- save to a file, load it back ----
// The browser keeps the work in progress, but that goes with its site data: a file is the copy to keep.
const FILE_KIND = STORAGE_KEY
function saveFile() {
  const blob = new Blob([JSON.stringify({ kind: FILE_KIND, version: 1, saved: new Date().toISOString(), state }, null, 1)], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${String(state.name || "business").trim().replace(/[^\w .'-]+/g, "").replace(/\s+/g, "-").toLowerCase() || "business"}.business.json`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
function loadFile() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".json,application/json"
  input.addEventListener("change", async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (data?.kind !== FILE_KIND || typeof data.state !== "object" || !data.state) { toast("That file isn't one saved from this tool"); return }
      // stored, then read back the way a saved session is (so older files get the same defaults filled in)
      let stored = false
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data.state)); stored = localStorage.getItem(STORAGE_KEY) !== null } catch {}
      if (stored) location.reload()
      else { state = { ...blank(), ...data.state }; render(); toast("Loaded (this browser isn't keeping site data, so save to a file again when you're done)") }
    } catch { toast("Couldn't read that file") }
  })
  input.click()
}
$("panel").addEventListener("click", (e) => {
  if (e.target.id === "btnSave") saveFile()
  else if (e.target.id === "btnLoad") loadFile()
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
