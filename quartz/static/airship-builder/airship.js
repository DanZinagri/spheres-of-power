// Airship Builder: size a hull, fit engines, a dirigible, rooms and siege engines, and get the
// ship's statistics and price by the wiki's Airship Rules (The Player's Guide to Skybourne). The
// tables come from compendium/airships.json, which scripts/scrape.py reads off that page.

const STORAGE_KEY = "sop-airship-builder"
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch])
const num = (n, digits = 1) => (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: digits })
const gp = (n) => num(n, 2) + " gp"
const tons = (n) => num(n, 2) + " t"
const DECK = 9 // Hardpoints in a Deck
const LOCATION = 5 * DECK // the most one Location holds
// a hull's price isn't in a table: every sample airship's cost works out to 30 gp per Hardpoint of hull
const HULL = { cost: 30, hp: 30, hardness: 5 }
const SIZES = [
  { name: "Large", max: 2, ac: 4, cmb: 1, ram: "1d8" }, { name: "Huge", max: 4, ac: 3, cmb: 2, ram: "2d8" },
  { name: "Gargantuan", max: 8, ac: 1, cmb: 4, ram: "4d8" }, { name: "Colossal", max: LOCATION, ac: -3, cmb: 8, ram: "8d8" }]
const MANEUVER = [
  { name: "Clumsy", pilot: -8, turns: "0 (1 per 2 rounds)", dodge: 1 }, { name: "Poor", pilot: -4, turns: "1", dodge: 3 }, { name: "Average", pilot: 0, turns: "2", dodge: 5 },
  { name: "Good", pilot: 4, turns: "4", dodge: 7 }, { name: "Perfect", pilot: 8, turns: "8", dodge: 9 }]
const FUEL = { Steam: { tons: 1, gp: 10 }, Alchemical: { tons: 0.5, gp: 30 } } // per Hardpoint of engine per 24 hours
const COMPONENT_SIZE = { Large: 1, Huge: 2, Gargantuan: 4, Colossal: 8 }
// the sample airships, as parts (the statistics are then worked out by the rules)
const D = DECK
const SAMPLES = {
  Coaster: { hull: 1, dirigible: ["Cloth", 2], engines: [["Sails", 2]], rooms: [["Cargo Bay", 1]] },
  Skidder: { hull: 2, dirigible: ["Magic", 4], engines: [["Sails", 4]], rooms: [["Bunks", 1], ["Cargo Bay", 1]] },
  Falcon: { hull: D, dirigible: ["Rigid", 2 * D], engines: [["Sails", 2 * D]], rooms: [["Cargo Bay", D]] },
  "Lantern Fly": { hull: 15 * D, dirigible: ["Rigid", 10 * D], engines: [["Elemental, air", 2 * D]], rooms: [["Captain's Quarters", 2], ["Cargo Bay", 2 * D], ["Kitchen", 1], ["Personal Quarters", 5], ["Sick Bay", 1]] },
  Steamclad: { hull: 15 * D, engines: [["Steam", 5 * D]], rooms: [["Brig", 1], ["Bunks", 2 * D], ["Captain's Quarters", 2], ["Cargo Bay", 7 * D], ["Kitchen", 1], ["Personal Quarters", 5]] },
  Arcania: { hull: 15 * D, engines: [["Spell", 3 * D]], rooms: [["Brig", 1], ["Bunks", 3 * D], ["Captain's Quarters", 2], ["Cargo Bay", 5 * D], ["Gunport", 3 * D], ["Kitchen", 1], ["Personal Quarters", 4], ["Sick Bay", 1]],
    weapons: [["Ballista, light", 54]] },
  Goliath: { hull: 50 * D, dirigible: ["Rigid", 100 * D], engines: [["Sails", 100 * D], ["Alchemical", 5 * D]],
    rooms: [["Brig", D], ["Bunks", 15 * D], ["Captain's Quarters", D], ["Cargo Bay", 10 * D], ["Gunport", 15 * D], ["Kitchen", D], ["Personal Quarters", D], ["Sick Bay", D]],
    weapons: [["Ballista, medium", 90], ["Ballista, gate breaker", 2], ["Trebuchet, heavy", 4]] },
}

const DATA = { ready: false, engines: [], dirigibles: [], rooms: [], weapons: [], components: [], speeds: [], urls: {} }
async function loadData() {
  const d = await fetch("../compendium/airships.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)
  if (d) Object.assign(DATA, d, { ready: true })
  render()
}

// a size is a count and its unit ("hp" Hardpoints or "deck" Decks)
const part = (hardpoints) => (hardpoints >= DECK && hardpoints % DECK === 0 ? { n: hardpoints / DECK, unit: "deck" } : { n: hardpoints, unit: "hp" })
const points = (p) => Math.max(0, Number(p?.n) || 0) * (p?.unit === "deck" ? DECK : 1)
const sized = (hardpoints) => (hardpoints >= DECK ? `${num(hardpoints / DECK, 2)} Deck${hardpoints === DECK ? "" : "s"}${hardpoints % DECK ? ` (${num(hardpoints)} Hardpoints)` : ""}` : `${num(hardpoints)} Hardpoint${hardpoints === 1 ? "" : "s"}`)

const blank = () => ({ name: "", hull: { n: 1, unit: "deck" }, dirigible: { type: "", n: 1, unit: "deck" }, engines: [], rooms: [], weapons: [], secret: 0,
  cargo: 0, people: 0, wind: 0 })
let state = blank()
try { state = { ...state, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") } } catch {}
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {} }

function loadSample(name) {
  const s = SAMPLES[name]
  if (!s) return
  state = { ...blank(), name, hull: part(s.hull), dirigible: s.dirigible ? { type: s.dirigible[0], ...part(s.dirigible[1]) } : blank().dirigible,
    engines: s.engines.map(([type, hp]) => ({ type, ...part(hp) })), rooms: s.rooms.map(([name, hp]) => ({ name, ...part(hp) })),
    weapons: (s.weapons ?? []).map(([name, qty]) => ({ name, qty })) }
}

// ---- the sums ----
const sizeOf = (hardpoints) => SIZES.find((s) => hardpoints <= s.max) ?? SIZES[SIZES.length - 1]
function speedFor(propulsion, mass) {
  // 1 point of propulsion per point of mass for each of speeds 1-10, 2 for 11-20, 3 for 21-30 ...
  let left = mass > 0 ? propulsion / mass : 0, speed = 0
  while (left >= Math.floor(speed / 10) + 1 - 1e-9 && speed < 200) { left -= Math.floor(speed / 10) + 1; speed++ }
  return speed
}
function travel(speed) {
  const row = DATA.speeds.find((s) => s.speed === speed)
  const mph = row ? row.mph : speed * 3.4
  return { feet: speed * 30, mph, day8: mph * 8, day24: mph * 24 }
}

function build() {
  const warnings = [], notes = []
  const hull = points(state.hull)
  const engines = state.engines.map((e) => ({ ...e, def: DATA.engines.find((d) => d.name === e.type), size: points(e) })).filter((e) => e.def && e.size > 0)
  const dirDef = DATA.dirigibles.find((d) => d.name === state.dirigible.type)
  const dirigible = dirDef ? points(state.dirigible) : 0
  const sails = engines.filter((e) => e.def.external).reduce((s, e) => s + e.size, 0)
  const rooms = state.rooms.map((r) => ({ ...r, def: DATA.rooms.find((d) => d.name === r.name), size: points(r) })).filter((r) => r.def && r.size > 0)
  const weapons = state.weapons.map((w) => ({ ...w, def: DATA.weapons.find((d) => d.name === w.name), qty: Math.max(0, Number(w.qty) || 0) })).filter((w) => w.def && w.qty > 0)

  // size: hull, sails and a physical dirigible each count, and each is its own Location (or several)
  const outside = dirDef?.location ? dirigible : 0
  const total = hull + sails + outside
  const size = sizeOf(total)
  const plus = total > LOCATION
  const locations = [["Hull", hull, HULL.hp, HULL.hardness], ["Sails", sails, DATA.engines.find((d) => d.external)?.hp ?? 20, 0], [`${dirDef?.name ?? ""} dirigible`, outside, dirDef?.hp ?? 0, dirDef?.hardness ?? 0]]
    .filter(([, hp]) => hp > 0).map(([name, hp, per, hardness]) => { const count = Math.ceil(hp / LOCATION); return { name, count, each: hp / count, size: sizeOf(hp / count), hp: Math.round((hp / count) * per), hardness } })
  const locationCount = locations.reduce((s, l) => s + l.count, 0)

  // weight, power, speed
  const mass = hull
  const weight = Math.max(0, 2 * hull - dirigible)
  const wind = Math.max(0, Number(state.wind) || 0)
  let power = 0, lift = 0, air = 0
  for (const e of engines) {
    const p = e.def.power * e.size + (e.def.external ? 0.5 * wind * e.size : 0)
    power += p
    if (!e.def.liftless) lift += p
    if (/elemental/i.test(e.def.name)) air += p
  }
  // an air elemental engine's power counts double against weight
  const airUsed = Math.min(air, weight / 2)
  const flies = lift + airUsed >= weight - 1e-9
  const propulsion = Math.max(0, power - (weight - airUsed))

  // load
  const equipment = engines.reduce((s, e) => s + e.def.weight * e.size, 0) + weapons.reduce((s, w) => s + w.def.weight * w.qty, 0)
  const people = Math.max(0, Number(state.people) || 0)
  const cargo = Math.max(0, Number(state.cargo) || 0)
  const load = equipment + cargo + people * 0.2
  const limits = { light: 2 * hull, medium: 5 * hull, heavy: 10 * hull }
  const burden = load < limits.light ? "Light" : load < limits.medium ? "Medium" : load <= limits.heavy ? "Heavy" : "Too heavy"
  const encumbered = burden === "Light" ? 0 : burden === "Medium" ? 1 : 2

  let speed = hull && flies ? speedFor(propulsion, mass) : 0
  let accel = hull && flies ? Math.floor(propulsion / 2 / mass) : 0
  if (encumbered) { speed = Math.max(0, speed - 1); accel = Math.max(0, accel - 1) }
  const maneuverable = engines.length > 0 && engines.every((e) => e.def.maneuverable)
  const baseStep = size.name !== "Colossal" ? 2 : locationCount <= 3 ? 1 : 0
  const step = Math.min(4, Math.max(0, baseStep + (maneuverable ? 1 : 0) - encumbered))
  const maneuver = MANEUVER[step]

  // space inside the hull
  const inside = engines.filter((e) => !e.def.external && e.def.hp > 0).reduce((s, e) => s + e.size, 0)
  const roomSpace = rooms.reduce((s, r) => s + r.size, 0)
  const used = inside + roomSpace
  const roomOf = (name) => rooms.filter((r) => r.name === name).reduce((s, r) => s + r.size, 0)
  const gunSpace = weapons.reduce((s, w) => s + w.def.hardpoints * w.qty, 0)

  // crew
  const crewRows = engines.filter((e) => e.def.crewPer).map((e) => ({ what: `${e.def.name} engine`, n: Math.max(1, Math.ceil(e.size / e.def.crewPer)), rule: e.def.crew }))
  const engineers = crewRows.reduce((s, c) => s + c.n, 0)
  const gunners = weapons.reduce((s, w) => s + w.def.team * w.qty, 0)
  const beds = roomOf("Bunks") * 6 + roomOf("Personal Quarters") + (roomOf("Captain's Quarters") ? 1 : 0)

  // price
  const lines = [[`Hull, ${sized(hull)}`, hull * HULL.cost]]
  for (const e of engines) lines.push([`${e.def.name} ${e.def.external ? "" : "engine"}, ${sized(e.size)}`.replace(" ,", ","), e.def.cost * e.size])
  if (dirDef && dirigible) lines.push([`${dirDef.name} dirigible, ${sized(dirigible)}`, dirDef.cost * dirigible])
  for (const r of rooms) if (r.def.cost) lines.push([`${r.name}, ${sized(r.size)}`, r.def.cost * r.size])
  for (const w of weapons) {
    const extras = DATA.components.filter((c) => w[c.name]).reduce((s, c) => s + c.cost * (COMPONENT_SIZE[w.def.size] ?? 1), 0)
    lines.push([`${w.qty} × ${w.def.name}${DATA.components.filter((c) => w[c.name]).map((c) => `, ${c.name.toLowerCase()}`).join("")}`, (w.def.cost + extras) * w.qty])
  }
  const secret = Math.max(0, Number(state.secret) || 0)
  if (secret) lines.push([`${secret} secret compartment${secret === 1 ? "" : "s"}`, secret * 500])
  const cost = lines.reduce((s, l) => s + l[1], 0)
  const fuel = engines.filter((e) => FUEL[e.def.name]).map((e) => ({ name: e.def.name, tons: FUEL[e.def.name].tons * e.size, gp: FUEL[e.def.name].tons * e.size * FUEL[e.def.name].gp }))

  // what the rules would object to
  if (!hull) warnings.push("The ship needs a hull.")
  if (hull && !engines.length) warnings.push("No engine: the ship has no power.")
  else if (hull && !flies) warnings.push(`Can't fly: the ship weighs ${num(weight)} and its lifting engines give ${num(lift)}${lift < power ? " (sails only push; they don't lift)" : ""}. Add a dirigible or a lifting engine.`)
  else if (hull && speed === 0) warnings.push(burden === "Light" ? "Speed 0: not enough propulsion left over to move the ship." : "Speed 0: too heavily loaded to move under its own power.")
  if (sails > 2 * hull) warnings.push(`Sails are limited to twice the hull (${sized(2 * hull)}).`)
  if (dirigible > 6 * hull) warnings.push(`A dirigible is limited to six times the hull (${sized(6 * hull)}).`)
  if (used > hull) warnings.push(`The engines and rooms take ${sized(used)}; the hull has ${sized(hull)}.`)
  for (const r of rooms) if (r.size < r.def.min) warnings.push(`${r.name} is at least ${r.def.min} Hardpoints.`)
  if (gunSpace > roomOf("Gunport")) warnings.push(`The siege engines need ${sized(gunSpace)} of gunport; the ship has ${roomOf("Gunport") ? sized(roomOf("Gunport")) : "none"} (siege engines outside a gunport can be carried but not fought).`)
  if (burden === "Too heavy") warnings.push(`Carrying ${tons(load)}; the hull holds ${tons(limits.heavy)} at most.`)
  if (cargo > roomOf("Cargo Bay") * 10) warnings.push(`${tons(cargo)} of cargo needs ${sized(Math.ceil(cargo / 10))} of cargo bay (10 tons per Hardpoint); the ship has ${roomOf("Cargo Bay") ? sized(roomOf("Cargo Bay")) : "none"}.`)
  if (people > beds && beds) notes.push(`Berths for ${num(beds)} (bunks sleep 6 per Hardpoint, quarters 1 each); ${num(people)} aboard.`)
  if (maneuverable) notes.push("Every engine is maneuverable: maneuverability is one step better.")
  if (encumbered) notes.push(`${burden} load: speed and acceleration −1, maneuverability ${encumbered} step${encumbered > 1 ? "s" : ""} worse.`)
  if (airUsed > 0) notes.push("The air elemental engine's power counts double against the ship's weight.")
  if (hull > used) notes.push(`${sized(hull - used)} of the hull unassigned.`)

  return { hull, sails, dirigible, dirDef, total, size, plus, locations, locationCount, spaces: Math.max(1, Math.ceil(total / LOCATION)), mass, weight, power, lift, propulsion, flies,
    speed, accel, maneuver, cmb: size.cmb + (plus ? Math.floor((total - LOCATION) / LOCATION) : 0), ram: size.ram + (weapons.some((w) => w.def.name === "Ram") ? " + 3d8" : ""),
    equipment, load, limits, burden, engines, rooms, weapons, used, crewRows, engineers, gunners, beds, lines, cost, fuel, warnings, notes, wind, people, cargo }
}

// ---- rendering ----
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`
const field = (label, inner, hint) => `<label class="field"><span>${label}</span>${inner}${hint ? `<span class="note">${hint}</span>` : ""}</label>`
const link = (url, text) => `<a href="../../${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`
// a size's two inputs; `path` says where in the state it lives ("hull", "dirigible", "engines.0" ...)
const sizeInputs = (path, p) => `<span class="row" style="gap:.3rem;flex-wrap:nowrap"><input type="number" data-size="${path}" value="${esc(p.n)}" min="0" step="1" style="width:4.5rem" />
  <select data-unit="${path}">${opt("hp", "Hardpoints", p.unit)}${opt("deck", "Decks", p.unit)}</select></span>`
const signed = (n) => (n >= 0 ? "+" : "−") + Math.abs(n)

function render() {
  if (!DATA.ready) { $("panel").innerHTML = `<section class="card"><p class="muted">Loading the airship tables…</p></section>`; return }
  const b = build()
  const unit = state.hull.unit === "deck" ? DECK : 1 // mass, weight and power read in the hull's own unit
  const inUnit = (n) => num(n / unit, 2)
  const t = travel(b.speed)
  const engineRow = (e, i) => { const def = DATA.engines.find((d) => d.name === e.type); const size = points(e); return `<tr>
      <td><select data-engine="${i}">${DATA.engines.map((d) => opt(d.name, d.name, e.type)).join("")}</select>
        <div class="note">${def ? esc([def.external ? "outside the hull, its own Location" : def.hp ? "takes hull space" : "takes no space", def.liftless ? "no lift" : "", def.maneuverable ? "maneuverable" : "", def.hidden ? "hidden" : "", def.unprotected ? "unprotected" : ""].filter(Boolean).join(" · ")) : ""}</div></td>
      <td>${sizeInputs(`engines.${i}`, e)}</td>
      <td class="num">${def ? num(def.power * size) : ""}</td><td class="num">${def ? tons(def.weight * size) : ""}</td><td>${def ? esc(def.crew) : ""}</td>
      <td class="num">${def ? gp(def.cost * size) : ""}</td><td><button type="button" data-remove="engines.${i}" title="Remove">✕</button></td></tr>` }
  const roomRow = (r, i) => { const def = DATA.rooms.find((d) => d.name === r.name); const size = points(r); return `<tr>
      <td>${def ? link(def.url, r.name) : esc(r.name)}${r.name === "Bunks" ? ` <span class="pi-meta">sleeps ${num(size * 6)}</span>` : r.name === "Cargo Bay" ? ` <span class="pi-meta">holds ${num(size * 10)} t</span>` : r.name === "Personal Quarters" ? ` <span class="pi-meta">${num(size)} room${size === 1 ? "" : "s"}</span>` : ""}</td>
      <td>${sizeInputs(`rooms.${i}`, r)}</td><td class="num">${def ? gp(def.cost * size) : ""}</td>
      <td><button type="button" data-remove="rooms.${i}" title="Remove">✕</button></td></tr>` }
  const weaponRow = (w, i) => { const def = DATA.weapons.find((d) => d.name === w.name); const qty = Math.max(0, Number(w.qty) || 0); return def ? `<tr>
      <td><input type="number" data-wqty="${i}" value="${esc(w.qty)}" min="0" style="width:4.2rem" /></td>
      <td>${esc(def.name)} <span class="pi-meta">${esc(def.size)}</span>
        <div class="note">${esc([def.damage, def.critical, def.range, def.type, def.reload && `reload ${def.reload}`, def.ammoCost ? `ammunition ${num(def.ammoCost)} gp a shot` : ""].filter(Boolean).join(" · "))}</div>
        ${def.hardpoints ? `<div class="note">${DATA.components.map((c) => `<label style="margin-right:.7rem"><input type="checkbox" data-comp="${i}" data-name="${esc(c.name)}" ${w[c.name] ? "checked" : ""} /> ${esc(c.name)} (${num(c.cost * (COMPONENT_SIZE[def.size] ?? 1))} gp)</label>`).join("")}</div>` : ""}</td>
      <td class="num">${def.hardpoints ? num(def.hardpoints * qty) : "—"}</td><td class="num">${def.team ? def.team * qty : "—"}</td><td class="num">${tons(def.weight * qty)}</td>
      <td class="num">${gp((def.cost + DATA.components.filter((c) => w[c.name]).reduce((s, c) => s + c.cost * (COMPONENT_SIZE[def.size] ?? 1), 0)) * qty)}</td>
      <td><button type="button" data-remove="weapons.${i}" title="Remove">✕</button></td></tr>` : "" }
  const stat = (label, value, hint) => `<tr><td>${label}${hint ? ` <span class="pi-meta">${hint}</span>` : ""}</td><td class="num">${value}</td></tr>`

  $("panel").innerHTML = `
    <section class="card">
      <h2>The ship</h2>
      <div class="row">
        ${field("Name", `<input type="text" data-opt="name" value="${esc(state.name)}" placeholder="The Wandering Star" style="width:15rem" />`)}
        ${field("Start from a sample airship", `<select id="sample"><option value="">Choose…</option>${Object.keys(SAMPLES).map((n) => `<option>${esc(n)}</option>`).join("")}</select>`, "Replaces what's below")}
        ${field("Hull", sizeInputs("hull", state.hull), `${gp(HULL.cost)} a Hardpoint, ${gp(HULL.cost * DECK)} a Deck`)}
        ${field("Dirigible", `<select data-dirigible>${opt("", "None", state.dirigible.type)}${DATA.dirigibles.map((d) => opt(d.name, `${d.name} (${num(d.cost)} gp a Hardpoint)`, state.dirigible.type)).join("")}</select>`, "Each Hardpoint lifts one point of weight")}
        ${state.dirigible.type ? field("Dirigible size", sizeInputs("dirigible", state.dirigible), b.dirDef?.location ? "Its own Location" : "An enchantment: no Location") : ""}
      </div>
      <h3>Engines</h3>
      ${state.engines.length ? `<div class="table-wrap"><table class="mods"><thead><tr><th>Engine</th><th>Size</th><th class="num">Power</th><th class="num">Weight</th><th>Crew</th><th class="num">Cost</th><th></th></tr></thead>
        <tbody>${state.engines.map(engineRow).join("")}</tbody></table></div>` : ""}
      <div class="row add-row">${field("Add an engine", `<select id="addEngine"><option value="">Choose…</option>${DATA.engines.map((d) => `<option value="${esc(d.name)}">${esc(d.name)} (power ${num(d.power)}, ${num(d.cost)} gp a Hardpoint)</option>`).join("")}</select>`)}</div>
      <h3>Rooms <span class="muted">${sized(b.used)} of ${sized(b.hull)} used</span></h3>
      ${state.rooms.length ? `<div class="table-wrap"><table class="mods"><thead><tr><th>Room</th><th>Size</th><th class="num">Cost</th><th></th></tr></thead><tbody>${state.rooms.map(roomRow).join("")}</tbody></table></div>` : ""}
      <div class="row add-row">
        ${field("Add a room", `<select id="addRoom"><option value="">Choose…</option>${DATA.rooms.map((d) => `<option value="${esc(d.name)}">${esc(d.name)} (${d.cost ? num(d.cost) + " gp a Hardpoint" : "free"})</option>`).join("")}</select>`)}
        ${field("Secret compartments", `<input type="number" data-opt="secret" value="${esc(state.secret)}" min="0" style="width:5rem" />`, "In cargo space, 500 gp each")}
      </div>
      <h3>Siege engines</h3>
      ${state.weapons.length ? `<div class="table-wrap"><table class="mods"><thead><tr><th>#</th><th>Weapon</th><th class="num">Hardpoints</th><th class="num">Team</th><th class="num">Weight</th><th class="num">Cost</th><th></th></tr></thead>
        <tbody>${state.weapons.map(weaponRow).join("")}</tbody></table></div>` : ""}
      <div class="row add-row">${field("Add a siege engine", `<select id="addWeapon"><option value="">Choose…</option>${DATA.weapons.map((d) => `<option value="${esc(d.name)}">${esc(d.name)} (${esc(d.damage)}, ${num(d.cost)} gp)</option>`).join("")}</select>`)}</div>
      <h3>Aboard</h3>
      <div class="row">
        ${field("Cargo (tons)", `<input type="number" data-opt="cargo" value="${esc(state.cargo)}" min="0" style="width:6rem" />`)}
        ${field("People aboard", `<input type="number" data-opt="people" value="${esc(state.people)}" min="0" style="width:6rem" />`, "0.2 tons each with their gear")}
        ${b.sails ? field("Wind at your back", `<input type="number" data-opt="wind" value="${esc(state.wind)}" min="0" max="6" style="width:5rem" />`, "Severity level: sails gain half of it in power") : ""}
        <span class="spacer"></span>
        <button type="button" id="btnCopy">Copy as text</button><button type="button" id="btnClear">Start over</button>
      </div>
    </section>
    ${b.warnings.length ? `<section class="card">${b.warnings.map((w) => `<p class="warn">⚠ ${esc(w)}</p>`).join("")}</section>` : ""}
    <section class="card">
      <div class="row"><h2 style="margin:0">${esc(state.name || "Airship")}: ${gp(b.cost)}</h2><span class="spacer"></span><span class="muted">${b.size.name}${b.plus ? "+" : ""} air vehicle</span></div>
      <div class="row" style="align-items:flex-start;gap:1.5rem">
        <div style="flex:1 1 20rem"><div class="table-wrap"><table class="mods"><tbody>
          ${stat("Size", `${sized(b.total)}`, `hull ${sized(b.hull)}${b.sails ? `, sails ${sized(b.sails)}` : ""}${b.dirDef?.location && b.dirigible ? `, dirigible ${sized(b.dirigible)}` : ""}`)}
          ${stat("Space", `${b.spaces} vehicle space${b.spaces === 1 ? "" : "s"}`, "30 ft. each")}
          ${b.locations.map((l) => stat(`${esc(l.name)}${l.count > 1 ? ` × ${l.count} Locations` : ""}`, `AC ${l.size.ac + b.maneuver.dodge}; ${num(l.hp)} hp; Hardness ${l.hardness}`, `${l.size.ac} ${l.size.name}, +${b.maneuver.dodge} dodge with a pilot${l.count > 1 ? "; each" : ""}`)).join("")}
          ${stat("CMB / CMD", `${signed(b.cmb)} / ${10 + b.cmb}`, "plus the pilot's skill bonus")}
          ${stat("Ram", esc(b.ram), "+1d8 per point of speed")}
        </tbody></table></div></div>
        <div style="flex:1 1 20rem"><div class="table-wrap"><table class="mods"><tbody>
          ${stat("Speed", b.speed ? `${b.speed} <span class="pi-meta">${num(t.feet)} ft. a round, ${num(t.mph)} mph</span>` : "0")}
          ${b.speed ? stat("Overland", `${num(t.day8)} miles in 8 hours, ${num(t.day24)} in 24`) : ""}
          ${stat("Acceleration", b.accel || (b.speed ? "1 space per 2 rounds" : "0"))}
          ${stat("Maneuverability", `${b.maneuver.name}`, `pilot checks ${signed(b.maneuver.pilot)}, ${b.maneuver.turns} turn${b.maneuver.turns === "1" ? "" : "s"} a round`)}
          ${stat("Power", inUnit(b.power), b.lift < b.power ? `${inUnit(b.lift)} of it lifts` : "")}
          ${stat("Mass / Weight", `${inUnit(b.mass)} / ${inUnit(b.weight)}`, state.hull.unit === "deck" ? "in Decks" : "in Hardpoints")}
          ${stat("Propulsion", inUnit(b.propulsion), "power left after lifting the weight")}
        </tbody></table></div></div>
      </div>
      <div class="row" style="align-items:flex-start;gap:1.5rem">
        <div style="flex:1 1 20rem"><h3>Load</h3><div class="table-wrap"><table class="mods"><tbody>
          ${stat("Carrying", `${tons(b.load)} <b>${b.burden}</b>`, `equipment ${tons(b.equipment)}${b.cargo ? `, cargo ${tons(b.cargo)}` : ""}${b.people ? `, people ${tons(b.people * 0.2)}` : ""}`)}
          ${stat("Light load", `less than ${tons(b.limits.light)}`)}
          ${stat("Medium load", `less than ${tons(b.limits.medium)}`)}
          ${stat("Heavy load", `up to ${tons(b.limits.heavy)}`)}
        </tbody></table></div></div>
        <div style="flex:1 1 20rem"><h3>Crew</h3><div class="table-wrap"><table class="mods"><tbody>
          ${stat("Pilot", "1")}
          ${b.crewRows.map((c) => stat(esc(c.what), c.n, esc(c.rule))).join("")}
          ${stat("<b>Required crew</b>", `<b>${1 + b.engineers}</b>`, `one 8-hour shift; ${3 * (1 + b.engineers)} to fly around the clock`)}
          ${b.gunners ? stat("Siege engine teams", b.gunners, "to fire every weapon at once") : ""}
          ${b.beds ? stat("Berths", num(b.beds)) : ""}
          ${b.fuel.map((f) => stat(`${esc(f.name)} fuel`, `${tons(f.tons)}, ${gp(f.gp)} a day`, "flying 24 hours")).join("")}
        </tbody></table></div></div>
      </div>
      <h3>Price</h3>
      <div class="table-wrap"><table class="mods"><tbody>${b.lines.map(([what, cost]) => `<tr><td>${esc(what)}</td><td class="num">${gp(cost)}</td></tr>`).join("")}
        <tr><td><b>Total</b></td><td class="num"><b>${gp(b.cost)}</b></td></tr></tbody></table></div>
      ${b.notes.map((n) => `<p class="note">${esc(n)}</p>`).join("")}
    </section>
    <section class="card">
      <p class="note">Rules: the wiki's ${link(DATA.url, "Airship Rules")} (${link(DATA.urls.engines, "engines")}, ${link(DATA.urls.dirigibles, "dirigibles")}, ${link(DATA.urls.rooms, "rooms")}, ${link(DATA.urls.weapons, "siege engines")}), from The Player's Guide to Skybourne. The hull's price (${HULL.cost} gp a Hardpoint) is not in a table there; it is what every sample airship's cost works out to. The sample airships are loaded as their parts and worked out by the rules, so a few numbers differ from their printed stat blocks. Crew wages, officers and ammunition are not counted.</p>
    </section>`
}

function summary() {
  const b = build(), t = travel(b.speed)
  const lines = [`${state.name || "Airship"} (${b.size.name}${b.plus ? "+" : ""} air vehicle), ${gp(b.cost)}`,
    `Size ${sized(b.total)}; Hull ${sized(b.hull)}; Space ${b.spaces} vehicle space${b.spaces === 1 ? "" : "s"}`, "",
    ...b.locations.map((l) => `${l.name}${l.count > 1 ? ` (${l.count} Locations, each)` : ""}: AC ${l.size.ac + b.maneuver.dodge}; ${l.hp} hp, Hardness ${l.hardness}`),
    `Attack ram (${b.ram}); CMB ${signed(b.cmb)}; CMD ${10 + b.cmb}`,
    `Speed ${b.speed}${b.speed ? ` (${t.feet} ft., ${num(t.mph)} mph)` : ""}; Acceleration ${b.accel || "1 space per 2 rounds"}; Maneuverability ${b.maneuver.name}`,
    `Propulsion ${b.engines.map((e) => `${e.def.name.toLowerCase()} (${sized(e.size)})`).join(", ") || "none"}; Power ${num(b.power, 2)} Hardpoints' worth`,
    `Mass ${sized(b.mass)}; Weight ${num(b.weight)}`, `Required crew ${1 + b.engineers} (1 pilot${b.engineers ? `, ${b.engineers} engineers or sailors` : ""})${b.gunners ? `; ${b.gunners} on the siege engines` : ""}`,
    `Load ${tons(b.load)} (${b.burden}); light under ${tons(b.limits.light)}, medium under ${tons(b.limits.medium)}, heavy to ${tons(b.limits.heavy)}`,
    `Rooms ${b.rooms.map((r) => `${r.name} (${sized(r.size)})`).join("; ") || "none"}`]
  if (b.dirDef && b.dirigible) lines.push(`Equipment ${b.dirDef.name} dirigible (${sized(b.dirigible)})`)
  if (b.weapons.length) lines.push(`Siege engines ${b.weapons.map((w) => `${w.qty} × ${w.def.name}`).join(", ")}`)
  return lines.join("\n")
}

function toast(msg) {
  const t = $("toast")
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), 2500)
}

// "engines.2" -> the object that size lives in
const at = (path) => { const [key, i] = path.split("."); return i === undefined ? state[key] : state[key][Number(i)] }

$("panel").addEventListener("change", (e) => {
  const el = e.target, d = el.dataset
  if (el.id === "sample" && el.value) loadSample(el.value)
  else if (el.id === "addEngine" && el.value) state.engines.push({ type: el.value, n: 1, unit: state.hull.unit === "deck" && points(state.hull) >= 5 * DECK ? "deck" : "hp" })
  else if (el.id === "addRoom" && el.value) state.rooms.push({ name: el.value, n: DATA.rooms.find((r) => r.name === el.value)?.min ?? 1, unit: "hp" })
  else if (el.id === "addWeapon" && el.value) state.weapons.push({ name: el.value, qty: 1 })
  else if (d.size) at(d.size).n = Math.max(0, Number(el.value) || 0)
  else if (d.unit) {
    // keep the same size where it converts cleanly
    const p = at(d.unit), hp = points(p)
    p.unit = el.value
    p.n = el.value === "deck" ? (hp % DECK ? p.n : hp / DECK) : hp
  } else if (d.engine) state.engines[Number(d.engine)].type = el.value
  else if ("dirigible" in d) state.dirigible.type = el.value
  else if (d.wqty) state.weapons[Number(d.wqty)].qty = Math.max(0, Number(el.value) || 0)
  else if (d.comp) state.weapons[Number(d.comp)][d.name] = el.checked
  else if (d.opt) state[d.opt] = el.type === "number" ? Number(el.value) || 0 : el.value
  else return
  save()
  render()
})
$("panel").addEventListener("click", (e) => {
  const el = e.target
  if (el.dataset.remove) { const [key, i] = el.dataset.remove.split("."); state[key].splice(Number(i), 1) }
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
