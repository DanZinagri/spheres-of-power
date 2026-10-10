// Ship Builder: design a land, water or air vehicle (hull, material, templates, engines, armor,
// rooms, siege engines, equipment, crew) and get its statistics, price and monthly upkeep by the
// Skybourne vehicle rules. Rooms, siege engines, dirigibles and the speed table come from
// compendium/airships.json (read off the wiki's Airship Rules page by scripts/scrape.py); the
// options that page lacks (Ships of Skybourne) are the tables below.

const STORAGE_KEY = "sop-ship-builder"
const $ = (id) => document.getElementById(id)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch])
const num = (n, digits = 1) => (Number(n) || 0).toLocaleString("en-US", { maximumFractionDigits: digits })
const gp = (n) => num(n, 2) + " gp"
const tons = (n) => num(n, 2) + " t"
const DECK = 9 // Hardpoints in a Deck
const LOCATION = 5 * DECK // the most one Location holds
const SIZES = [
  { name: "Large", max: 2, ac: 4, cmb: 1, ram: "1d8", mult: 1 }, { name: "Huge", max: 4, ac: 3, cmb: 2, ram: "2d8", mult: 2 },
  { name: "Gargantuan", max: 8, ac: 1, cmb: 4, ram: "4d8", mult: 4 }, { name: "Colossal", max: LOCATION, ac: -3, cmb: 8, ram: "8d8", mult: 8 }]
const MANEUVER = [
  { name: "Clumsy", pilot: -8, turns: "1 per 2 rounds", dodge: 1 }, { name: "Poor", pilot: -4, turns: "1", dodge: 3 }, { name: "Average", pilot: 0, turns: "2", dodge: 5 },
  { name: "Good", pilot: 4, turns: "4", dodge: 7 }, { name: "Perfect", pilot: 8, turns: "8", dodge: 9 }]
// hull materials: gp, hit points per Hardpoint, hardness, how many Hardpoints each counts as for mass
const MATERIALS = [
  { name: "Bone", cost: 10, hp: 15, hardness: 5, mass: 1 }, { name: "Wood", cost: 30, hp: 30, hardness: 5, mass: 1 }, { name: "Stone", cost: 300, hp: 45, hardness: 8, mass: 1.5 },
  { name: "Iron", cost: 600, hp: 90, hardness: 10, mass: 2 }, { name: "Glass", cost: 6000, hp: 12, hardness: 1, mass: 1.5 }, { name: "Darkwood", cost: 30000, hp: 30, hardness: 5, mass: 0.5 },
  { name: "Greenwood", cost: 150000, hp: 30, hardness: 5, mass: 1 }, { name: "Gold", cost: 300000, hp: 30, hardness: 5, mass: 2 }, { name: "Living Steel", cost: 750000, hp: 100, hardness: 15, mass: 2 },
  { name: "Mithral", cost: 1500000, hp: 90, hardness: 15, mass: 1 }, { name: "Adamantine", cost: 3000000, hp: 120, hardness: 20, mass: 3 }, { name: "Diamond", cost: 15000000, hp: 30, hardness: 20, mass: 2.5 }]
// engines, per Hardpoint: crew is crewmen per Hardpoint of engine
const HP1 = 1, PER_DECK = 1 / DECK, PER_5 = 1 / LOCATION
const E = (name, cost, power, weight, crew, crewText, hp, flags = {}) => ({ name, cost, power, weight, crewRate: crew, crew: crewText, hp, ...flags })
const ENGINES = [
  E("Oars", 15, 2, 0.1, 4, "4 per Hardpoint", 20, { unprotected: true, only: "water" }),
  E("Oars, air", 15, 2, 0.2, 4, "4 per Hardpoint", 20, { unprotected: true, liftless: true, only: "air" }),
  E("Manual", 25, 2, 1, 2, "2 per Hardpoint", 20),
  E("Sails", 25, 1, 0.2, PER_DECK, "1 per Deck", 20, { unprotected: true, liftless: true, external: true }),
  E("Sails, silk", 300, 2, 0.1, PER_DECK, "1 per Deck", 30, { unprotected: true, liftless: true, external: true }),
  E("Steam, inferior", 100, 6, 4, HP1, "1 per Hardpoint", 40, { fuel: [1, 10] }),
  E("Steam", 175, 9, 5, HP1, "1 per Hardpoint", 50, { fuel: [1, 10] }),
  E("Steam, superior", 250, 12, 6, HP1, "1 per Hardpoint", 60, { fuel: [1, 10] }),
  E("Alchemical, inferior", 300, 9, 3, PER_DECK, "1 per Deck", 60, { fuel: [0.5, 30] }),
  E("Alchemical", 500, 15, 4, PER_DECK, "1 per Deck", 80, { fuel: [0.5, 30] }),
  E("Alchemical, superior", 750, 20, 5, PER_DECK, "1 per Deck", 100, { fuel: [0.5, 30] }),
  E("Elemental, air", 1000, 20, 2, PER_5, "1 per 5 Decks", 30, { maneuverable: true, doubleLift: true, magic: true }),
  E("Elemental, earth", 1000, 20, 2, PER_5, "1 per 5 Decks", 140, { magic: true }),
  E("Elemental, water", 1000, 15, 2, PER_5, "1 per 5 Decks", 80, { maneuverable: true, magic: true }),
  E("Elemental, fire", 1000, 25, 2, PER_5, "1 per 5 Decks", 80, { magic: true }),
  E("Vampiric", 2500, 50, 2, PER_5, "1 per 5 Decks", 100, { magic: true }),
  E("Enchantment", 5000, 10, 0, 0, "None", 0, { hidden: true, maneuverable: true, noSpace: true, magic: true }),
  E("Necrotic", 5000, 75, 2, PER_5, "1 per 5 Decks", 100, { magic: true }),
  E("Spell", 7500, 75, 1, PER_5, "1 per 5 Decks", 100, { hidden: true, magic: true }),
  E("Shadow", 10000, 100, 1, PER_5, "1 per 5 Decks", 120, { hidden: true, magic: true })]
const ARMOR = [
  { name: "Chain", bonus: 4, large: 400, location: 3200, weight: 0.5, weightLocation: 4, kind: "Light" },
  { name: "Scale", bonus: 6, large: 800, location: 6400, weight: 1, weightLocation: 8, kind: "Medium" },
  { name: "Plate", bonus: 8, large: 2400, location: 19200, weight: 2, weightLocation: 16, kind: "Heavy" }]
const ARMOR_MATERIAL = {
  Mithral: { Light: [4000, 32000], Medium: [16000, 128000], Heavy: [36000, 288000] },
  Adamantine: { Light: [20000, 160000], Medium: [40000, 320000], Heavy: [60000, 480000] } }
// templates beyond the mediums of travel: price for a Large vehicle / for each Location of a Colossal one
const TEMPLATES = [
  { key: "aerodynamic", name: "Aerodynamic", large: 200, location: 1600, note: "half the carrying capacity; maneuverability +1 step; speed and acceleration +1 under engine power" },
  { key: "covered", name: "Covered", large: 100, location: 800, note: "enclosed all round: no indirect-fire siege engines, crew never exposed, can go underwater" },
  { key: "glider", name: "Glider", large: 200, location: 1600, only: "air", note: "half mass and weight for speed and acceleration; maneuverability −1 step; no sails or physical dirigible" },
  { key: "maneuverable", name: "Maneuverable", large: 200, location: 1600, note: "twice the engine power per point of speed; maneuverability +1 step" },
  { key: "track", name: "Track", large: 200, location: 1600, only: "land", note: "runs on laid track (100 gp a mile): always Clumsy, half mass for speed and acceleration" },
  { key: "living", name: "Living", large: 0, location: 0, note: "an animated object: works its own engines without a crew" }]
const MEDIUMS = [["land", "Land"], ["water", "Water"], ["air", "Air"]]
const TREADS = [
  { name: "Wheels", large: 0, location: 0, note: "half speed over sand or snow" }, { name: "Sand runners", large: 0, location: 0, note: "half speed over snow or hard ground" },
  { name: "Snow runners", large: 0, location: 0, note: "half speed over sand or hard ground" }, { name: "Caterpillar track", large: 100, location: 800, speed: 0.75, note: "three-quarters speed, on any ground" },
  { name: "Legs, mechanical", large: 2000, location: 16000, note: "full speed on any ground" }, { name: "Hover charm", large: 4000, location: 32000, note: "full speed on any ground, and over water" }]
// other equipment: "size" items are priced for a Large vehicle or per Location; "flat" ones each
const EQUIPMENT = [
  { group: "Subterranean", only: "land", items: [
    { name: "Burrowers", large: 3000, location: 27000, toggle: true, front: true }, { name: "Burrowers, magical", large: 5000, location: 45000, toggle: true, front: true },
    { name: "Earthglide enchantment", large: 8000, location: 72000, toggle: true }] },
  { group: "Underwater", only: "water", items: [
    { name: "Buoyancy control", large: 1000, location: 8000, toggle: true }, { name: "Pressure resistance", large: 100, location: 800, hint: "+100 ft. each" },
    { name: "Swimming enchantment", large: 3000, location: 24000, toggle: true }] },
  { group: "Arms and controls", items: [
    { name: "Mechanical arms", large: 4000, location: 32000, hint: "pairs", perVehicle: true }, { name: "Automation, mechanical", flat: 1000, hint: "crew replaced" }, { name: "Automation, magical", flat: 2000, hint: "crew replaced" },
    { name: "Full-body cockpit, mechanical", flat: 5000, toggle: true }, { name: "Full-body cockpit, magical", flat: 10000, toggle: true }] },
  { group: "Protection", items: [
    { name: "Energy resilience (10)", large: 500, location: 4000, hint: "energy types" }, { name: "Energy resistance (30)", large: 2000, location: 16000, hint: "energy types" },
    { name: "Energy immunity", large: 5000, location: 40000, hint: "energy types" }, { name: "Fire pump", large: 50, location: 400, toggle: true }, { name: "Water pump", large: 50, location: 400, toggle: true }] },
  { group: "Lights and senses", items: [
    { name: "Light, mechanical", flat: 50, hint: "facings" }, { name: "Light, magical", flat: 500, hint: "facings" }, { name: "Tremorsense", flat: 5000, hint: "Locations" }, { name: "Blindsense", flat: 20000, hint: "Locations" }] }]
const EXTRA_ROOMS = [{ name: "Air Tank", cost: 50, min: 1, meta: (s) => `air for ${num(s)} for 30 days` }, { name: "Air Garden", cost: 100, min: 1, meta: (s) => `air for ${num(s * 8)}` }, { name: "Crystal of Living", cost: 10000, min: 1, meta: (s) => `air for ${num(s * 60)}` }]
const EXTRA_DIMENSIONAL = 5000 // more per Hardpoint for a room outside the hull's space
const EXTRA_WEAPONS = [
  { name: "Firedrake", group: "Other Siege Engines", size: "Huge", hardpoints: 2, perDeck: 4, cost: 4000, damage: "6d6", critical: "", range: "60-ft. line or 30-ft. cone", type: "fire", team: 3, reload: "3 rounds", hardness: 10, hp: 70, weight: 2, ammoCost: 200 },
  { name: "Firewyrm", group: "Other Siege Engines", size: "Gargantuan", hardpoints: 4, perDeck: 2, cost: 6000, damage: "6d6", critical: "", range: "120-ft. line or 60-ft. cone", type: "fire", team: 5, reload: "4 rounds", hardness: 10, hp: 140, weight: 4, ammoCost: 400 },
  { name: "Springal, arrow", group: "Other Siege Engines", size: "Huge", hardpoints: 2, perDeck: 4, cost: 1000, damage: "3d8", critical: "x3", range: "100 ft. (50 min.)", type: "P", team: 3, reload: "2 rounds", hardness: 10, hp: 100, weight: 2, ammoCost: 20 },
  { name: "Springal, rocket", group: "Other Siege Engines", size: "Huge", hardpoints: 2, perDeck: 4, cost: 6000, damage: "3d10", critical: "x4", range: "100 ft. (50 min.)", type: "fire", team: 3, reload: "2 rounds", hardness: 10, hp: 100, weight: 2, ammoCost: 500 }]
const COMPONENT_SIZE = { Large: 1, Huge: 2, Gargantuan: 4, Colossal: 8 }
// crew and upkeep (gp a month)
const CREW_WAGE = 3, OFFICER_WAGE = 30, SLAVE_PRICE = 300, SMALL_CREW = 12.5
const CREW_KINDS = { sailors: "Sailors (experts)", marines: "Marines (warriors)", slaves: "Slaves (commoners)" }
const ROLES = [["Captain", ""], ["Pilot", "Profession (sailor) or (driver)"], ["Boatswain", "Profession (sailor)"], ["Head Engineer", "by engine"], ["Quartermaster", "Profession (soldier)"],
  ["Master Carpenter", "Profession (carpentry)"], ["Sail Master", "Profession (navigator)"], ["Master Gunner", "Profession (siege engineer)"], ["Surgeon", "Heal"],
  ["Chef", "Profession (chef)"], ["Cabin Boy/Girl", "Profession (servant)"], ["Entertainer", "Perform or Profession (courtesan)"], ["Lieutenant", "leads a crew"]]
const RATIONS = { "": ["None", 0, 0, 0], poor: ["Poor", 1, 10, 0.08], average: ["Average", 3, 30, 0.08], excellent: ["Excellent", 5, 50, 0.08] } // each, per small crew, tons each
const ALCOHOL = { "": ["None", 0, 0, 0], grog: ["Grog", 0.3, 3, 0.02], ale: ["Ale", 1, 10, 0.02] }
// sample vehicles, as parts (the statistics are then worked out by the rules)
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
  "North Star": { hull: 5 * D, engines: [["Sails, silk", 10 * D], ["Alchemical", 6]], templates: ["covered", "aerodynamic"],
    rooms: [["Brig", 1], ["Bunks", D], ["Cargo Bay", 5], ["Gunport", 2 * D], ["Kitchen", 1], ["Personal Quarters", 5]], weapons: [["Ballista, medium", 18]] },
  "Shriek's Anywhere Vessel": { hull: 5 * D, material: "Iron", mediums: ["land", "water", "air"], templates: ["covered"], dirigible: ["Magic", 20 * D], engines: [["Spell", D]], tread: "Hover charm",
    rooms: [["Crystal of Living", 1], ["Cargo Bay", 2 * D], ["Kitchen", 1], ["Library", D], ["Personal Quarters", 7]],
    equip: { "Burrowers, magical": 1, "Earthglide enchantment": 1, "Swimming enchantment": 1, Blindsense: 1, "Automation, magical": 1 } },
}

const DATA = { ready: false, dirigibles: [], rooms: [], weapons: [], components: [], speeds: [], urls: {} }
async function loadData() {
  const d = await fetch("../compendium/airships.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)
  if (d) Object.assign(DATA, d, { ready: true, rooms: [...d.rooms, ...EXTRA_ROOMS].sort((a, b) => a.name.localeCompare(b.name)),
    weapons: [...d.weapons, ...EXTRA_WEAPONS.filter((w) => !d.weapons.some((x) => x.name === w.name))] })
  render()
}

// a size is a count and its unit ("hp" Hardpoints or "deck" Decks)
const part = (hardpoints) => (hardpoints >= DECK && hardpoints % DECK === 0 ? { n: hardpoints / DECK, unit: "deck" } : { n: hardpoints, unit: "hp" })
const points = (p) => Math.max(0, Number(p?.n) || 0) * (p?.unit === "deck" ? DECK : 1)
const sized = (hardpoints) => (hardpoints >= DECK ? `${num(hardpoints / DECK, 2)} Deck${hardpoints === DECK ? "" : "s"}${hardpoints % DECK ? ` (${num(hardpoints)} Hardpoints)` : ""}` : `${num(hardpoints)} Hardpoint${hardpoints === 1 ? "" : "s"}`)

const blank = () => ({ name: "", hull: { n: 1, unit: "deck" }, material: "Wood", mediums: { land: false, water: false, air: true }, templates: {}, armor: { type: "", material: "" },
  dirigible: { type: "", n: 1, unit: "deck" }, engines: [], rooms: [], weapons: [], secret: 0, tread: "Wheels", equip: {}, muscle: { on: false, speed: 40, count: 0 },
  cargo: 0, passengers: 0, wind: 0, crew: { level: 1, kind: "sailors", shifts: 1, gunners: true, hired: "" }, officers: [], rations: "average", alcohol: "", months: 1, hours: 8 })
let state = blank()
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"), b = blank()
  state = { ...b, ...saved }
  for (const k of ["mediums", "templates", "armor", "dirigible", "equip", "muscle", "crew"]) state[k] = { ...b[k], ...(saved[k] ?? {}) }
} catch {}
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {} }

function loadSample(name) {
  const s = SAMPLES[name], b = blank()
  if (!s) return
  state = { ...b, name, hull: part(s.hull), material: s.material ?? "Wood", tread: s.tread ?? "Wheels", equip: { ...(s.equip ?? {}) },
    mediums: s.mediums ? Object.fromEntries(MEDIUMS.map(([k]) => [k, s.mediums.includes(k)])) : b.mediums, templates: Object.fromEntries((s.templates ?? []).map((k) => [k, true])),
    dirigible: s.dirigible ? { type: s.dirigible[0], ...part(s.dirigible[1]) } : b.dirigible,
    engines: s.engines.map(([type, hp]) => ({ type, ...part(hp) })), rooms: s.rooms.map(([name, hp]) => ({ name, ...part(hp) })),
    weapons: (s.weapons ?? []).map(([name, qty]) => ({ name, qty })) }
}

// ---- the sums ----
const sizeOf = (hardpoints) => SIZES.find((s) => hardpoints <= s.max) ?? SIZES[SIZES.length - 1]
function speedFor(power, mass) {
  // 1 point of power per point of mass for each of speeds 1-10, 2 for 11-20, 3 for 21-30 ...
  let left = mass > 0 ? power / mass : 0, speed = 0
  while (left >= Math.floor(speed / 10) + 1 - 1e-9 && speed < 200) { left -= Math.floor(speed / 10) + 1; speed++ }
  return speed
}
function travel(speed) {
  const row = DATA.speeds.find((s) => s.speed === speed)
  const mph = row ? row.mph : speed * 3.4
  return { feet: speed * 30, mph, day8: mph * 8, day24: mph * 24 }
}
const qty = (name) => Math.max(0, Number(state.equip[name]) || 0)

function build() {
  const warnings = [], notes = []
  const hull = points(state.hull)
  const material = MATERIALS.find((m) => m.name === state.material) ?? MATERIALS[1]
  const med = state.mediums, tpl = state.templates
  const mediums = MEDIUMS.filter(([k]) => med[k])
  const engines = state.engines.map((e) => ({ ...e, def: ENGINES.find((d) => d.name === e.type), size: points(e) })).filter((e) => e.def && e.size > 0)
  const dirDef = med.air ? DATA.dirigibles.find((d) => d.name === state.dirigible.type) : null
  const dirigible = dirDef ? points(state.dirigible) : 0
  const sails = engines.filter((e) => e.def.external).reduce((s, e) => s + e.size, 0)
  const sailDef = engines.find((e) => e.def.external)?.def
  const rooms = state.rooms.map((r) => ({ ...r, def: DATA.rooms.find((d) => d.name === r.name), size: points(r) })).filter((r) => r.def && r.size > 0)
  const weapons = state.weapons.map((w) => ({ ...w, def: DATA.weapons.find((d) => d.name === w.name), qty: Math.max(0, Number(w.qty) || 0) })).filter((w) => w.def && w.qty > 0)

  // size: hull, sails and a physical dirigible each count, and each is its own Location (or several)
  const outside = dirDef?.location ? dirigible : 0
  const total = hull + sails + outside
  const size = sizeOf(total)
  const hullSize = sizeOf(hull)
  const hullLocations = Math.max(1, Math.ceil(hull / LOCATION))
  // "price for Large / price per Location": doubled for Huge, quadrupled for Gargantuan
  const bySize = (large, location) => (hull <= 8 ? large * hullSize.mult : location * hullLocations)
  const armor = ARMOR.find((a) => a.name === state.armor.type)
  const armorExtra = armor ? ARMOR_MATERIAL[state.armor.material]?.[armor.kind] : null
  const hardness = material.hardness + (armor && state.armor.material === "Adamantine" ? { Light: 1, Medium: 2, Heavy: 3 }[armor.kind] : 0)
  const locations = [["Hull", hull, material.hp, hardness, armor?.bonus ?? 0], ["Sails", sails, sailDef?.hp ?? 20, 0, 0], [`${dirDef?.name ?? ""} dirigible`, outside, dirDef?.hp ?? 0, dirDef?.hardness ?? 0, 0]]
    .filter(([, hp]) => hp > 0).map(([name, hp, per, hard, bonus]) => { const count = Math.ceil(hp / LOCATION); return { name, count, each: hp / count, size: sizeOf(hp / count), hp: Math.round((hp / count) * per), hardness: hard, armor: bonus } })
  const locationCount = locations.reduce((s, l) => s + l.count, 0)
  const spaces = Math.max(1, Math.ceil(total / LOCATION))
  const plus = locationCount > 1 && total > LOCATION

  // mass, weight, power
  const mass = hull * material.mass
  const half = tpl.glider && med.air ? 0.5 : 1
  const weight = Math.max(0, 2 * mass * half - dirigible)
  const wind = Math.max(0, Number(state.wind) || 0)
  let power = 0, lift = 0, doubled = 0
  for (const e of engines) {
    const p = e.def.power * e.size + (e.def.external ? 0.5 * wind * e.size : 0)
    power += p
    if (!e.def.liftless) lift += p
    if (e.def.doubleLift) doubled += p
  }
  // an air elemental engine's power counts double against weight
  const airUsed = Math.min(doubled, weight / 2)
  const flies = lift + airUsed >= weight - 1e-9
  const propulsion = Math.max(0, power - (weight - airUsed))

  // load
  const armorWeight = armor ? bySize(armor.weight, armor.weightLocation) * (state.armor.material === "Mithral" ? 0.5 : 1) : 0
  const equipment = engines.reduce((s, e) => s + e.def.weight * e.size, 0) + weapons.reduce((s, w) => s + w.def.weight * w.qty, 0) + armorWeight
  const cargo = Math.max(0, Number(state.cargo) || 0)

  // crew
  const auto = qty("Automation, mechanical") + qty("Automation, magical")
  const crewRows = tpl.living ? [] : engines.filter((e) => e.def.crewRate).map((e) => ({ what: `${e.def.name}${e.def.external ? "" : /^Oars/.test(e.def.name) ? "" : " engine"}`, n: Math.max(1, Math.ceil(e.size * e.def.crewRate - 1e-9)), rule: e.def.crew }))
  const engineers = crewRows.reduce((s, c) => s + c.n, 0)
  const gunners = weapons.reduce((s, w) => s + w.def.team * w.qty, 0)
  const shifts = Number(state.crew.shifts) === 3 ? 3 : 1
  const needed = Math.max(0, (1 + engineers) * shifts + (state.crew.gunners ? gunners : 0) - auto)
  const hired = state.crew.hired === "" || state.crew.hired == null ? needed : Math.max(0, Number(state.crew.hired) || 0)
  const officers = state.officers.map((o) => ({ ...o, level: Math.min(20, Math.max(1, Number(o.level) || 1)) }))
  const passengers = Math.max(0, Number(state.passengers) || 0)
  const people = hired + officers.length + passengers
  const months = Math.max(0, Number(state.months) || 0)
  const ration = RATIONS[state.rations] ?? RATIONS[""], drink = ALCOHOL[state.alcohol] ?? ALCOHOL[""]
  const supplies = people * months * (ration[3] + drink[3])
  const load = equipment + cargo + people * 0.2 + supplies
  const capacity = tpl.aerodynamic ? 0.5 : 1
  const limits = { light: 2 * hull * capacity, medium: 5 * hull * capacity, heavy: 10 * hull * capacity }
  const burden = load < limits.light ? "Light" : load < limits.medium ? "Medium" : load <= limits.heavy ? "Heavy" : "Too heavy"
  let encumbered = burden === "Light" ? 0 : burden === "Medium" ? 1 : 2

  // drawn by creatures: 1 Large creature per Hardpoint of mass (and of weight, in the air); engines lighten the pull
  const muscle = state.muscle.on ? (() => {
    const pullMass = Math.max(0, mass * (tpl.aerodynamic ? 0.5 : 1) * (tpl.track && med.land ? 0.5 : 1) - power)
    const need = Math.max(Math.ceil(mass / 4), Math.ceil(pullMass + (med.air ? weight : 0)))
    const have = Math.max(0, Number(state.muscle.count) || 0)
    const ratio = need ? have / need : 0
    const factor = have < Math.ceil(mass / 4) || ratio < 0.25 ? 0 : ratio < 0.5 ? 0.25 : ratio < 1 ? 0.5 : 1
    const lighter = ratio > 2 ? 2 : ratio > 1.5 ? 1 : 0
    const feet = Math.max(0, Number(state.muscle.speed) || 0)
    return { need, have, factor, lighter, feet, speed: Math.floor((2 * feet * factor) / 30), accel: Math.floor((feet * factor) / 30), steps: factor === 0.5 ? 1 : factor === 0.25 ? 2 : 0 }
  })() : null
  if (muscle) encumbered = Math.max(0, encumbered - muscle.lighter)

  // speed by medium
  const engineDriven = engines.length > 0
  const powerPer = tpl.maneuverable && engineDriven ? 2 : 1 // twice the power per point of speed
  const tread = TREADS.find((t) => t.name === state.tread) ?? TREADS[0]
  const speeds = []
  const finish = (label, pw, m, ok, factor = 1, note = "") => {
    let speed = hull && ok ? speedFor(pw / powerPer, m) : 0
    let accel = hull && ok ? Math.floor(pw / powerPer / 2 / m) : 0
    if (tpl.aerodynamic && speed >= 1) { speed++; accel++ }
    if (encumbered) { speed = Math.max(0, speed - 1); accel = Math.max(0, accel - 1) }
    speed = Math.floor(speed * factor)
    speeds.push({ label, speed, accel, note })
  }
  if (muscle) speeds.push({ label: "Drawn by creatures", speed: Math.max(0, muscle.speed - (encumbered ? 1 : 0)), accel: muscle.accel, note: `${muscle.have} of ${muscle.need} Large creatures` })
  else {
    if (med.land) {
      finish("Land", power, mass * (tpl.track ? 0.5 : 1), true, tread.speed ?? 1, tread.name.toLowerCase())
      if (qty("Burrowers") || qty("Burrowers, magical")) speeds.push({ ...speeds[speeds.length - 1], label: "Underground", speed: qty("Earthglide enchantment") ? speeds[speeds.length - 1].speed : Math.floor(speeds[speeds.length - 1].speed / 2), note: qty("Earthglide enchantment") ? "earthglide" : "half speed" })
    }
    if (med.water) finish("Water", power, mass, true, 1, qty("Buoyancy control") || qty("Swimming enchantment") ? "and underwater" : "")
    if (med.air) finish("Air", propulsion, mass * half, flies)
  }
  const best = speeds.reduce((a, s) => (s.speed > a.speed ? s : a), speeds[0] ?? { speed: 0, accel: 0 })
  const maneuverable = engineDriven && engines.every((e) => e.def.maneuverable)
  const baseStep = size.name !== "Colossal" ? 2 : spaces <= 3 ? 1 : 0
  const rawStep = baseStep + (maneuverable ? 1 : 0) + (tpl.aerodynamic ? 1 : 0) + (tpl.maneuverable && engineDriven && !muscle ? 1 : 0) - (tpl.glider && med.air ? 1 : 0) - encumbered - (muscle?.steps ?? 0)
  const step = Math.min(4, Math.max(0, rawStep))
  const maneuver = { ...MANEUVER[step], dodge: MANEUVER[step].dodge + 2 * Math.max(0, rawStep - 4) }

  // space inside the hull
  const inside = engines.filter((e) => !e.def.external && !e.def.noSpace).reduce((s, e) => s + e.size, 0)
  const roomSpace = rooms.filter((r) => !r.xd).reduce((s, r) => s + r.size, 0)
  const used = inside + roomSpace
  const roomOf = (name, real) => rooms.filter((r) => r.name === name && (!real || !r.xd)).reduce((s, r) => s + r.size, 0)
  const gunSpace = weapons.reduce((s, w) => s + w.def.hardpoints * w.qty, 0)
  const beds = roomOf("Bunks") * 6 + roomOf("Personal Quarters") + (roomOf("Captain's Quarters") ? 1 : 0)

  // price
  const lines = [[`${material.name} hull, ${sized(hull)}`, hull * material.cost]]
  if (mediums.length > 1) lines.push([`${mediums.length - 1} more medium${mediums.length > 2 ? "s" : ""} of travel (${mediums.map((m) => m[1].toLowerCase()).join(", ")})`, (mediums.length - 1) * bySize(500, 4000)])
  for (const t of TEMPLATES) if (tpl[t.key] && t.large) lines.push([`${t.name} template`, bySize(t.large, t.location)])
  if (armor) lines.push([`${state.armor.material ? state.armor.material + " " : ""}${armor.name.toLowerCase()} armor (+${armor.bonus} AC)`, bySize(armor.large, armor.location) + (armorExtra ? bySize(armorExtra[0], armorExtra[1]) : 0)])
  for (const e of engines) lines.push([`${e.def.name}${e.def.external || /^Oars/.test(e.def.name) ? "" : " engine"}, ${sized(e.size)}`, e.def.cost * e.size])
  if (dirDef && dirigible) lines.push([`${dirDef.name} dirigible, ${sized(dirigible)}`, dirDef.cost * dirigible])
  for (const r of rooms) if (r.def.cost || r.xd) lines.push([`${r.name}, ${sized(r.size)}${r.xd ? " (extra-dimensional)" : ""}`, (r.def.cost + (r.xd ? EXTRA_DIMENSIONAL : 0)) * r.size])
  for (const w of weapons) {
    const extras = DATA.components.filter((c) => w[c.name]).reduce((s, c) => s + c.cost * (COMPONENT_SIZE[w.def.size] ?? 1), 0)
    lines.push([`${w.qty} × ${w.def.name}${DATA.components.filter((c) => w[c.name]).map((c) => `, ${c.name.toLowerCase()}`).join("")}`, (w.def.cost + extras) * w.qty])
  }
  const secret = Math.max(0, Number(state.secret) || 0)
  if (secret) lines.push([`${secret} secret compartment${secret === 1 ? "" : "s"}`, secret * 500])
  if (med.land && tread.large) lines.push([`${tread.name}`, bySize(tread.large, tread.location)])
  const fitted = []
  for (const g of EQUIPMENT) for (const it of g.items) {
    const n = qty(it.name)
    if (!n || (g.only && !med[g.only])) continue
    const each = it.flat ?? (it.front || it.perVehicle ? (hull <= 8 ? it.large * hullSize.mult : it.location) : bySize(it.large, it.location))
    lines.push([`${it.toggle ? "" : n + " × "}${it.name}`, each * n])
    fitted.push(`${it.toggle ? "" : n + " × "}${it.name.toLowerCase()}`)
  }
  const cost = lines.reduce((s, l) => s + l[1], 0)

  // upkeep, a month
  const level = Math.min(20, Math.max(1, Number(state.crew.level) || 1))
  const slaves = state.crew.kind === "slaves"
  const wages = slaves ? 0 : hired * CREW_WAGE * level
  const officerPay = officers.filter((o) => !o.unpaid).reduce((s, o) => s + o.level * OFFICER_WAGE, 0)
  const bulk = (each, perCrew) => { const crews = Math.floor(people / SMALL_CREW); return crews * perCrew + Math.max(0, people - Math.round(crews * SMALL_CREW)) * each }
  const food = bulk(ration[1], ration[2]) + bulk(drink[1], drink[2])
  const hours = Math.min(24, Math.max(0, Number(state.hours) || 0))
  const fuel = engines.filter((e) => e.def.fuel).map((e) => ({ name: e.def.name, tons: (e.def.fuel[0] * e.size * hours) / 24, gp: (e.def.fuel[0] * e.size * e.def.fuel[1] * hours) / 24 }))
  const fuelMonth = fuel.reduce((s, f) => s + f.gp, 0) * 30
  const upkeep = wages + officerPay + food + fuelMonth

  // what the rules would object to
  if (!hull) warnings.push("The vehicle needs a hull.")
  if (!mediums.length) warnings.push("Pick a medium of travel: land, water or air.")
  if (hull && !engines.length && !muscle) warnings.push("No engine and nothing pulling it: the vehicle can't move.")
  if (hull && med.air && !muscle && engines.length && !flies) warnings.push(`Can't fly: it weighs ${num(weight)} and its lifting engines give ${num(lift)}${lift < power ? " (sails and air oars only push; they don't lift)" : ""}. Add a dirigible or a lifting engine.`)
  else if (hull && (engines.length || muscle) && best.speed === 0) warnings.push(muscle && !muscle.factor ? `Too few creatures to move it: it takes ${muscle.need} Large creatures, and no fewer than a quarter of that.` : burden === "Light" ? "Speed 0: not enough power to move the vehicle." : "Speed 0: too heavily loaded to move.")
  for (const e of engines) if (e.def.only && !med[e.def.only]) warnings.push(`${e.def.name} only work on ${e.def.only === "air" ? "an air" : "a water"} vehicle.`)
  if (sails > 2 * hull) warnings.push(`Sails are limited to twice the hull (${sized(2 * hull)}).`)
  if (dirigible > 6 * hull) warnings.push(`A dirigible is limited to six times the hull (${sized(6 * hull)}).`)
  if (state.dirigible.type && !med.air) notes.push("A dirigible only fits an air vehicle.")
  if (tpl.glider && med.air && (sails || outside)) warnings.push("A glider loses the template's effects while it uses sails or a physical dirigible.")
  for (const t of TEMPLATES) if (tpl[t.key] && t.only && !med[t.only]) warnings.push(`The ${t.name.toLowerCase()} template is for ${t.only} vehicles.`)
  if (qty("Buoyancy control") && med.water && !tpl.covered) warnings.push("Buoyancy control needs the covered template.")
  if (used > hull) warnings.push(`The engines and rooms take ${sized(used)}; the hull has ${sized(hull)}.`)
  for (const r of rooms) if (r.size < r.def.min) warnings.push(`${r.name} is at least ${r.def.min} Hardpoints.`)
  for (const r of rooms) if (r.xd && /^(Gunport|Hanger)$/.test(r.name)) warnings.push(`A ${r.name.toLowerCase()} can't be extra-dimensional.`)
  if (gunSpace > roomOf("Gunport", true)) warnings.push(`The siege engines need ${sized(gunSpace)} of gunport; the vehicle has ${roomOf("Gunport", true) ? sized(roomOf("Gunport", true)) : "none"} (siege engines outside a gunport can be carried but not fought).`)
  if (tpl.covered && weapons.some((w) => /indirect/i.test(w.def.group) || /^Springal/.test(w.def.name))) warnings.push("A covered vehicle can't use indirect-fire siege engines.")
  if (secret > roomOf("Cargo Bay")) warnings.push("Secret compartments are one per Hardpoint of cargo bay.")
  if (burden === "Too heavy") warnings.push(`Carrying ${tons(load)}; the hull holds ${tons(limits.heavy)} at most.`)
  if (cargo > roomOf("Cargo Bay") * 10) warnings.push(`${tons(cargo)} of cargo needs ${sized(Math.ceil(cargo / 10))} of cargo bay (10 tons per Hardpoint); the vehicle has ${roomOf("Cargo Bay") ? sized(roomOf("Cargo Bay")) : "none"}.`)
  const captain = officers.find((o) => o.role === "Captain")
  const paid = officers.filter((o) => !o.unpaid && o.role !== "Captain")
  if (captain && paid.length && captain.level < 3) warnings.push("A captain must be at least 3rd level to hire an officer.")
  if (captain && paid.some((o) => o.level > captain.level)) warnings.push("No hired officer can be of higher level than the captain.")
  if (hired < needed) notes.push(`${num(hired)} crew hired; it takes ${num(needed)} to man it${shifts === 3 ? " around the clock" : ""}${state.crew.gunners && gunners ? " and fire every weapon" : ""}: an engine with half its crew gives half power.`)
  if (people > beds && beds) notes.push(`Berths for ${num(beds)} (bunks sleep 6 per Hardpoint, quarters 1 each); ${num(people)} aboard.`)
  if (officers.length > roomOf("Personal Quarters") + (roomOf("Captain's Quarters") ? 1 : 0) && officers.length) notes.push("An officer without personal quarters takes −1 to loyalty.")
  if (maneuverable) notes.push("Every engine is maneuverable: maneuverability is one step better.")
  if (encumbered) notes.push(`${burden} load${muscle?.lighter ? " (eased by extra creatures pulling)" : ""}: speed and acceleration −1, maneuverability ${encumbered} step${encumbered > 1 ? "s" : ""} worse.`)
  if (airUsed > 0) notes.push("The air elemental engine's power counts double against the vehicle's weight.")
  if (tpl.track && med.land) notes.push("On its track the vehicle is always Clumsy and never rolls.")
  if (tpl.glider && med.air && weight > 0) notes.push("A glider with weight left to carry can't fly slower than speed 10.")
  if (rooms.some((r) => r.xd)) notes.push("What is kept in an extra-dimensional room doesn't count toward the load (take it off the cargo yourself).")
  if (hull > used) notes.push(`${sized(hull - used)} of the hull unassigned.`)

  return { hull, material, mediums, sails, dirigible, dirDef, total, size, plus, locations, locationCount, spaces, mass, weight, power, lift, propulsion, flies, speeds, best, maneuver, muscle,
    cmb: size.cmb + (plus ? locationCount - 1 : 0), ram: size.ram + (weapons.some((w) => w.def.name === "Ram") ? " + 3d8" : "") + (material.name === "Diamond" ? " + 4d8" : ""),
    equipment, load, limits, burden, engines, rooms, weapons, used, crewRows, engineers, gunners, needed, hired, officers, people, passengers, beds, supplies, lines, cost, fuel, fitted, tread, armor,
    wages, officerPay, food, fuelMonth, upkeep, level, slaves, shifts, months, warnings, notes, wind, cargo, bySize, hours }
}

// ---- rendering ----
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`
const field = (label, inner, hint) => `<label class="field"><span>${label}</span>${inner}${hint ? `<span class="note">${hint}</span>` : ""}</label>`
const link = (url, text) => `<a href="../../${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`
const check = (attrs, on, label, title = "") => `<label style="margin-right:.9rem;white-space:nowrap" ${title ? `title="${esc(title)}"` : ""}><input type="checkbox" ${attrs} ${on ? "checked" : ""} /> ${label}</label>`
// a size's two inputs; `path` says where in the state it lives ("hull", "dirigible", "engines.0" ...)
const sizeInputs = (path, p) => `<span class="row" style="gap:.3rem;flex-wrap:nowrap"><input type="number" data-size="${path}" value="${esc(p.n)}" min="0" step="1" style="width:4.5rem" />
  <select data-unit="${path}">${opt("hp", "Hardpoints", p.unit)}${opt("deck", "Decks", p.unit)}</select></span>`
const signed = (n) => (n >= 0 ? "+" : "−") + Math.abs(n)

function render() {
  if (!DATA.ready) { $("panel").innerHTML = `<section class="card"><p class="muted">Loading the vehicle tables…</p></section>`; return }
  const b = build()
  const unit = state.hull.unit === "deck" ? DECK : 1 // mass, weight and power read in the hull's own unit
  const inUnit = (n) => num(n / unit, 2)
  const med = state.mediums
  const engineRow = (e, i) => { const def = ENGINES.find((d) => d.name === e.type); const size = points(e); return `<tr>
      <td><select data-engine="${i}">${ENGINES.map((d) => opt(d.name, d.name, e.type)).join("")}</select>
        <div class="note">${def ? esc([def.external ? "outside the hull, its own Location" : def.noSpace ? "takes no space" : "takes hull space", def.liftless ? "no lift" : "", def.maneuverable ? "maneuverable" : "", def.hidden ? "hidden" : "", def.unprotected ? "unprotected" : "", def.only ? `${def.only} vehicles only` : "", def.magic ? "magic item" : ""].filter(Boolean).join(" · ")) : ""}</div></td>
      <td>${sizeInputs(`engines.${i}`, e)}</td>
      <td class="num">${def ? num(def.power * size) : ""}</td><td class="num">${def ? tons(def.weight * size) : ""}</td><td>${def ? esc(def.crew) : ""}</td>
      <td class="num">${def ? gp(def.cost * size) : ""}</td><td><button type="button" data-remove="engines.${i}" title="Remove">✕</button></td></tr>` }
  const roomRow = (r, i) => { const def = DATA.rooms.find((d) => d.name === r.name); const size = points(r); return `<tr>
      <td>${def?.url ? link(def.url, r.name) : esc(r.name)}${r.name === "Bunks" ? ` <span class="pi-meta">sleeps ${num(size * 6)}</span>` : r.name === "Cargo Bay" ? ` <span class="pi-meta">holds ${num(size * 10)} t</span>` : r.name === "Personal Quarters" ? ` <span class="pi-meta">${num(size)} room${size === 1 ? "" : "s"}</span>` : def?.meta ? ` <span class="pi-meta">${esc(def.meta(size))}</span>` : ""}</td>
      <td>${sizeInputs(`rooms.${i}`, r)}</td><td>${check(`data-xd="${i}"`, r.xd, "extra-dimensional", "Outside the hull's space: +5,000 gp a Hardpoint")}</td>
      <td class="num">${def ? gp((def.cost + (r.xd ? EXTRA_DIMENSIONAL : 0)) * size) : ""}</td>
      <td><button type="button" data-remove="rooms.${i}" title="Remove">✕</button></td></tr>` }
  const weaponRow = (w, i) => { const def = DATA.weapons.find((d) => d.name === w.name); const n = Math.max(0, Number(w.qty) || 0); return def ? `<tr>
      <td><input type="number" data-wqty="${i}" value="${esc(w.qty)}" min="0" style="width:4.2rem" /></td>
      <td>${esc(def.name)} <span class="pi-meta">${esc(def.size)}</span>
        <div class="note">${esc([def.damage, def.critical, def.range, def.type, def.reload && `reload ${def.reload}`, def.ammoCost ? `ammunition ${num(def.ammoCost)} gp a shot` : ""].filter(Boolean).join(" · "))}</div>
        ${def.hardpoints ? `<div class="note">${DATA.components.map((c) => check(`data-comp="${i}" data-name="${esc(c.name)}"`, w[c.name], `${esc(c.name)} (${num(c.cost * (COMPONENT_SIZE[def.size] ?? 1))} gp)`)).join("")}</div>` : ""}</td>
      <td class="num">${def.hardpoints ? num(def.hardpoints * n) : "—"}</td><td class="num">${def.team ? def.team * n : "—"}</td><td class="num">${tons(def.weight * n)}</td>
      <td class="num">${gp((def.cost + DATA.components.filter((c) => w[c.name]).reduce((s, c) => s + c.cost * (COMPONENT_SIZE[def.size] ?? 1), 0)) * n)}</td>
      <td><button type="button" data-remove="weapons.${i}" title="Remove">✕</button></td></tr>` : "" }
  const officerRow = (o, i) => `<tr>
      <td><select data-officer="${i}" data-key="role">${ROLES.map(([r]) => opt(r, r, o.role)).join("")}</select><div class="note">${esc(ROLES.find(([r]) => r === o.role)?.[1] ?? "")}</div></td>
      <td><input type="text" data-officer="${i}" data-key="name" value="${esc(o.name ?? "")}" placeholder="Name" style="width:10rem" /></td>
      <td><input type="number" data-officer="${i}" data-key="level" value="${esc(o.level)}" min="1" max="20" style="width:4rem" /></td>
      <td>${check(`data-officer="${i}" data-key="unpaid"`, o.unpaid, "PC or cohort (no wage)")}</td>
      <td class="num">${o.unpaid ? "—" : gp((Math.min(20, Math.max(1, Number(o.level) || 1))) * OFFICER_WAGE)}</td>
      <td><button type="button" data-remove="officers.${i}" title="Remove">✕</button></td></tr>`
  const stat = (label, value, hint) => `<tr><td>${label}${hint ? ` <span class="pi-meta">${hint}</span>` : ""}</td><td class="num">${value}</td></tr>`
  const equipInput = (it) => it.toggle ? check(`data-equip="${esc(it.name)}"`, qty(it.name), `${esc(it.name)} <span class="pi-meta">${num(it.flat ?? (it.front || it.perVehicle ? (b.hull <= 8 ? it.large * sizeOf(b.hull).mult : it.location) : b.bySize(it.large, it.location)))} gp</span>`)
    : `<label style="margin-right:.9rem;white-space:nowrap"><input type="number" data-equip="${esc(it.name)}" value="${qty(it.name)}" min="0" style="width:3.6rem" /> ${esc(it.name)} <span class="pi-meta">${num(it.flat ?? (it.perVehicle ? (b.hull <= 8 ? it.large * sizeOf(b.hull).mult : it.location) : b.bySize(it.large, it.location)))} gp${it.hint ? `, ${esc(it.hint)}` : ""}</span></label>`
  const vehicleKind = `${b.size.name}${b.plus ? "+" : ""} ${b.material.name.toLowerCase()} ${b.mediums.map((m) => m[1].toLowerCase()).join("/") || ""} vehicle${TEMPLATES.filter((t) => state.templates[t.key]).length ? ` (${TEMPLATES.filter((t) => state.templates[t.key]).map((t) => t.name.toLowerCase()).join(", ")})` : ""}`

  $("panel").innerHTML = `
    <section class="card">
      <h2>The vehicle</h2>
      <div class="row">
        ${field("Name", `<input type="text" data-opt="name" value="${esc(state.name)}" placeholder="The Wandering Star" style="width:15rem" />`)}
        ${field("Start from a sample", `<select id="sample"><option value="">Choose…</option>${Object.keys(SAMPLES).map((n) => `<option>${esc(n)}</option>`).join("")}</select>`, "Replaces what's below")}
        ${field("Hull", sizeInputs("hull", state.hull), `${gp(b.material.cost)} a Hardpoint, ${gp(b.material.cost * DECK)} a Deck`)}
        ${field("Material", `<select data-opt="material">${MATERIALS.map((m) => opt(m.name, `${m.name} (${num(m.cost)} gp)`, state.material)).join("")}</select>`, `${b.material.hp} hp a Hardpoint, Hardness ${b.material.hardness}${b.material.mass !== 1 ? `, mass × ${b.material.mass}` : ""}`)}
      </div>
      <div class="row">
        <div class="field"><span>Travels by</span><span>${MEDIUMS.map(([k, l]) => check(`data-medium="${k}"`, med[k], l)).join("")}</span><span class="note">The first is free; each more ${gp(b.bySize(500, 4000))}</span></div>
        <div class="field"><span>Templates</span><span>${TEMPLATES.map((t) => check(`data-template="${t.key}"`, state.templates[t.key], `${t.name}${t.large ? ` <span class="pi-meta">${num(b.bySize(t.large, t.location))} gp</span>` : ""}`, t.note)).join("")}</span></div>
      </div>
      <div class="row">
        ${field("Armor", `<select data-armor="type">${opt("", "None", state.armor.type)}${ARMOR.map((a) => opt(a.name, `${a.name} (+${a.bonus} AC, ${num(b.bySize(a.large, a.location))} gp)`, state.armor.type)).join("")}</select>`)}
        ${state.armor.type ? field("Armor material", `<select data-armor="material">${opt("", "Steel", state.armor.material)}${opt("Mithral", "Mithral (half weight)", state.armor.material)}${opt("Adamantine", "Adamantine (more Hardness)", state.armor.material)}</select>`) : ""}
        ${med.air ? field("Dirigible", `<select data-dirigible>${opt("", "None", state.dirigible.type)}${DATA.dirigibles.map((d) => opt(d.name, `${d.name} (${num(d.cost)} gp a Hardpoint)`, state.dirigible.type)).join("")}</select>`, "Each Hardpoint lifts one point of weight") : ""}
        ${med.air && state.dirigible.type ? field("Dirigible size", sizeInputs("dirigible", state.dirigible), b.dirDef?.location ? "Its own Location" : "An enchantment: no Location") : ""}
        ${med.land ? field("Tread", `<select data-opt="tread">${TREADS.map((t) => opt(t.name, `${t.name}${t.large ? ` (${num(b.bySize(t.large, t.location))} gp)` : ""}`, state.tread)).join("")}</select>`, esc(b.tread.note)) : ""}
      </div>
      <h3>Propulsion</h3>
      ${state.engines.length ? `<div class="table-wrap"><table class="mods"><thead><tr><th>Engine</th><th>Size</th><th class="num">Power</th><th class="num">Weight</th><th>Crew</th><th class="num">Cost</th><th></th></tr></thead>
        <tbody>${state.engines.map(engineRow).join("")}</tbody></table></div>` : ""}
      <div class="row add-row">
        ${field("Add an engine", `<select id="addEngine"><option value="">Choose…</option>${ENGINES.map((d) => `<option value="${esc(d.name)}">${esc(d.name)} (power ${num(d.power)}, ${num(d.cost)} gp a Hardpoint)</option>`).join("")}</select>`)}
        <div class="field"><span>&nbsp;</span><span>${check(`data-muscle="on"`, state.muscle.on, "Drawn by creatures")}</span></div>
        ${state.muscle.on ? field("Slowest creature's speed (ft.)", `<input type="number" data-muscle="speed" value="${esc(state.muscle.speed)}" min="0" step="5" style="width:5rem" />`) + field("Creatures pulling", `<input type="number" data-muscle="count" value="${esc(state.muscle.count)}" min="0" style="width:5rem" />`, `As Large creatures (two Medium make one); it takes ${b.muscle.need}`) : ""}
      </div>
      <h3>Rooms <span class="muted">${sized(b.used)} of ${sized(b.hull)} used</span></h3>
      ${state.rooms.length ? `<div class="table-wrap"><table class="mods"><thead><tr><th>Room</th><th>Size</th><th></th><th class="num">Cost</th><th></th></tr></thead><tbody>${state.rooms.map(roomRow).join("")}</tbody></table></div>` : ""}
      <div class="row add-row">
        ${field("Add a room", `<select id="addRoom"><option value="">Choose…</option>${DATA.rooms.map((d) => `<option value="${esc(d.name)}">${esc(d.name)} (${d.cost ? num(d.cost) + " gp a Hardpoint" : "free"})</option>`).join("")}</select>`)}
        ${field("Secret compartments", `<input type="number" data-opt="secret" value="${esc(state.secret)}" min="0" style="width:5rem" />`, "In cargo space, 500 gp each")}
      </div>
      <h3>Siege engines</h3>
      ${state.weapons.length ? `<div class="table-wrap"><table class="mods"><thead><tr><th>#</th><th>Weapon</th><th class="num">Hardpoints</th><th class="num">Team</th><th class="num">Weight</th><th class="num">Cost</th><th></th></tr></thead>
        <tbody>${state.weapons.map(weaponRow).join("")}</tbody></table></div>` : ""}
      <div class="row add-row">${field("Add a siege engine", `<select id="addWeapon"><option value="">Choose…</option>${DATA.weapons.map((d) => `<option value="${esc(d.name)}">${esc(d.name)} (${esc(d.damage)}, ${num(d.cost)} gp)</option>`).join("")}</select>`)}</div>
      <h3>Equipment</h3>
      ${EQUIPMENT.filter((g) => !g.only || med[g.only]).map((g) => `<p style="margin:.35rem 0;line-height:2"><b>${esc(g.group)}:</b> ${g.items.map(equipInput).join("")}</p>`).join("")}
    </section>
    <section class="card">
      <h2>Crew and upkeep</h2>
      <div class="row">
        ${field("Crew", `<select data-crew="kind">${Object.entries(CREW_KINDS).map(([k, l]) => opt(k, l, state.crew.kind)).join("")}</select>`, b.slaves ? `Bought at ${SLAVE_PRICE} gp a level per small crew; no wage` : `${CREW_WAGE} gp a level each month`)}
        ${field("Crew level", `<input type="number" data-crew="level" value="${esc(state.crew.level)}" min="1" max="20" style="width:4.5rem" />`)}
        ${field("Shifts", `<select data-crew="shifts">${opt(1, "One 8-hour shift", state.crew.shifts)}${opt(3, "Three (around the clock)", state.crew.shifts)}</select>`)}
        <div class="field"><span>&nbsp;</span><span>${check(`data-crew="gunners"`, state.crew.gunners, "Man every siege engine")}</span></div>
        ${field("Crew hired", `<input type="number" data-crew="hired" value="${esc(state.crew.hired)}" min="0" placeholder="${b.needed}" style="width:5.5rem" />`, `Blank for what it takes (${num(b.needed)}): about ${num(b.hired / SMALL_CREW, 1)} small crews`)}
        ${field("Passengers", `<input type="number" data-opt="passengers" value="${esc(state.passengers)}" min="0" style="width:5rem" />`)}
      </div>
      ${state.officers.length ? `<div class="table-wrap"><table class="mods"><thead><tr><th>Officer</th><th>Name</th><th>Level</th><th></th><th class="num">A month</th><th></th></tr></thead><tbody>${state.officers.map(officerRow).join("")}</tbody></table></div>` : ""}
      <div class="row add-row">
        ${field("Add an officer", `<select id="addOfficer"><option value="">Choose a role…</option>${ROLES.map(([r, s]) => `<option value="${esc(r)}">${esc(r)}${s ? ` (${esc(s)})` : ""}</option>`).join("")}</select>`, `${OFFICER_WAGE} gp a level each month`)}
        ${field("Rations", `<select data-opt="rations">${Object.entries(RATIONS).map(([k, r]) => opt(k, r[1] ? `${r[0]} (${num(r[1])} gp each a month)` : r[0], state.rations)).join("")}</select>`)}
        ${field("Alcohol", `<select data-opt="alcohol">${Object.entries(ALCOHOL).map(([k, r]) => opt(k, r[1] ? `${r[0]} (${num(r[1])} gp each a month)` : r[0], state.alcohol)).join("")}</select>`)}
        ${field("Months of supplies aboard", `<input type="number" data-opt="months" value="${esc(state.months)}" min="0" step="0.5" style="width:5rem" />`, "Their weight counts toward the load")}
        ${b.fuel.length ? field("Hours under way a day", `<input type="number" data-opt="hours" value="${esc(state.hours)}" min="0" max="24" style="width:5rem" />`, "For fuel") : ""}
      </div>
      <div class="row">
        ${field("Cargo (tons)", `<input type="number" data-opt="cargo" value="${esc(state.cargo)}" min="0" style="width:6rem" />`)}
        ${b.sails ? field("Wind at your back", `<input type="number" data-opt="wind" value="${esc(state.wind)}" min="0" max="7" style="width:5rem" />`, "Severity level: sails gain half of it in power") : ""}
        <span class="spacer"></span>
        <button type="button" id="btnCopy">Copy as text</button><button type="button" id="btnClear">Start over</button>
      </div>
    </section>
    ${b.warnings.length ? `<section class="card">${b.warnings.map((w) => `<p class="warn">⚠ ${esc(w)}</p>`).join("")}</section>` : ""}
    <section class="card">
      <div class="row"><h2 style="margin:0">${esc(state.name || "Vehicle")}: ${gp(b.cost)}</h2><span class="spacer"></span><span class="muted">${esc(vehicleKind)}</span></div>
      <div class="row" style="align-items:flex-start;gap:1.5rem">
        <div style="flex:1 1 20rem"><div class="table-wrap"><table class="mods"><tbody>
          ${stat("Size", `${sized(b.total)}`, `hull ${sized(b.hull)}${b.sails ? `, sails ${sized(b.sails)}` : ""}${b.dirDef?.location && b.dirigible ? `, dirigible ${sized(b.dirigible)}` : ""}`)}
          ${stat("Space", `${b.spaces} vehicle space${b.spaces === 1 ? "" : "s"}`, "30 ft. each")}
          ${b.locations.map((l) => stat(`${esc(l.name)}${l.count > 1 ? ` × ${l.count} Locations` : ""}`, `AC ${l.size.ac + b.maneuver.dodge + l.armor}; ${num(l.hp)} hp; Hardness ${l.hardness}`, `${l.size.ac} ${l.size.name}, +${b.maneuver.dodge} dodge with a pilot${l.armor ? `, +${l.armor} armor` : ""}${l.count > 1 ? "; each" : ""}`)).join("")}
          ${stat("CMB / CMD", `${signed(b.cmb)} / ${10 + b.cmb}`, "plus the pilot's skill bonus")}
          ${stat("Ram", esc(b.ram), "+1d8 per point of speed")}
        </tbody></table></div></div>
        <div style="flex:1 1 20rem"><div class="table-wrap"><table class="mods"><tbody>
          ${b.speeds.map((s) => { const t = travel(s.speed); return stat(`${esc(s.label)} speed`, s.speed ? `${s.speed} <span class="pi-meta">${num(t.feet)} ft. a round, ${num(t.mph)} mph, ${num(t.day8)} miles in 8 hours</span>` : "0", `${s.note ? esc(s.note) + "; " : ""}acceleration ${s.accel || (s.speed ? "1 per 2 rounds" : 0)}`) }).join("") || stat("Speed", "0")}
          ${stat("Maneuverability", `${b.maneuver.name}`, `pilot checks ${signed(b.maneuver.pilot)}, ${b.maneuver.turns} turn${b.maneuver.turns === "1" ? "" : "s"} a round`)}
          ${stat("Power", inUnit(b.power), med.air && b.lift < b.power ? `${inUnit(b.lift)} of it lifts` : "")}
          ${stat(med.air ? "Mass / Weight" : "Mass", med.air ? `${inUnit(b.mass)} / ${inUnit(b.weight)}` : inUnit(b.mass), state.hull.unit === "deck" ? "in Decks" : "in Hardpoints")}
          ${med.air ? stat("Propulsion", inUnit(b.propulsion), "power left after lifting the weight") : ""}
        </tbody></table></div></div>
      </div>
      <div class="row" style="align-items:flex-start;gap:1.5rem">
        <div style="flex:1 1 20rem"><h3>Load</h3><div class="table-wrap"><table class="mods"><tbody>
          ${stat("Carrying", `${tons(b.load)} <b>${b.burden}</b>`, `equipment ${tons(b.equipment)}${b.cargo ? `, cargo ${tons(b.cargo)}` : ""}${b.people ? `, ${num(b.people)} people ${tons(b.people * 0.2)}` : ""}${b.supplies ? `, supplies ${tons(b.supplies)}` : ""}`)}
          ${stat("Light load", `less than ${tons(b.limits.light)}`)}
          ${stat("Medium load", `less than ${tons(b.limits.medium)}`)}
          ${stat("Heavy load", `up to ${tons(b.limits.heavy)}`)}
        </tbody></table></div></div>
        <div style="flex:1 1 20rem"><h3>Crew</h3><div class="table-wrap"><table class="mods"><tbody>
          ${stat("Pilot", "1")}
          ${b.crewRows.map((c) => stat(esc(c.what), c.n, esc(c.rule))).join("")}
          ${stat("<b>Required crew</b>", `<b>${1 + b.engineers}</b>`, `one 8-hour shift; ${3 * (1 + b.engineers)} around the clock`)}
          ${b.gunners ? stat("Siege engine teams", b.gunners, "to fire every weapon at once") : ""}
          ${stat("Aboard", num(b.people), `${num(b.hired)} crew${b.officers.length ? `, ${b.officers.length} officer${b.officers.length === 1 ? "" : "s"}` : ""}${b.passengers ? `, ${num(b.passengers)} passenger${b.passengers === 1 ? "" : "s"}` : ""}${b.beds ? `; berths for ${num(b.beds)}` : ""}`)}
        </tbody></table></div></div>
      </div>
      <div class="row" style="align-items:flex-start;gap:1.5rem">
        <div style="flex:1 1 20rem"><h3>Price</h3>
          <div class="table-wrap"><table class="mods"><tbody>${b.lines.map(([what, cost]) => `<tr><td>${esc(what)}</td><td class="num">${gp(cost)}</td></tr>`).join("")}
            <tr><td><b>Total</b></td><td class="num"><b>${gp(b.cost)}</b></td></tr>
            <tr><td>Built yourself <span class="pi-meta">a third, in raw materials</span></td><td class="num">${gp(b.cost / 3)}</td></tr>
            <tr><td>Commissioned <span class="pi-meta">half down, half on delivery</span></td><td class="num">${num(Math.max(1, Math.ceil(b.cost / 1000)), 0)} weeks</td></tr>
            ${b.slaves && b.hired ? `<tr><td>Slave crew <span class="pi-meta">${num(b.hired / SMALL_CREW, 1)} small crews at level ${b.level}</span></td><td class="num">${gp((b.hired / SMALL_CREW) * SLAVE_PRICE * b.level)}</td></tr>` : ""}
          </tbody></table></div></div>
        <div style="flex:1 1 20rem"><h3>Upkeep a month</h3>
          <div class="table-wrap"><table class="mods"><tbody>
            ${stat("Crew wages", gp(b.wages), b.slaves ? "slaves are unpaid" : `${num(b.hired)} at level ${b.level}, ${CREW_WAGE} gp a level`)}
            ${b.officers.length ? stat("Officers", gp(b.officerPay), `${b.officers.filter((o) => !o.unpaid).length} paid, ${OFFICER_WAGE} gp a level`) : ""}
            ${b.food ? stat("Rations and drink", gp(b.food), `for ${num(b.people)}`) : ""}
            ${b.fuel.map((f) => stat(`${esc(f.name)} fuel`, gp(f.gp * 30), `${tons(f.tons)} a day, ${num(b.hours)} hours under way`)).join("")}
            <tr><td><b>Total</b></td><td class="num"><b>${gp(b.upkeep)}</b></td></tr>
            ${stat("Paid once instead", gp(b.upkeep * 12), "twelve months' worth, if you'd rather not track upkeep")}
          </tbody></table></div></div>
      </div>
      ${b.notes.map((n) => `<p class="note">${esc(n)}</p>`).join("")}
    </section>
    <section class="card">
      <p class="note">Rules: the wiki's ${link(DATA.url, "Airship Rules")} (${link(DATA.urls.engines, "engines")}, ${link(DATA.urls.dirigibles, "dirigibles")}, ${link(DATA.urls.rooms, "rooms")}, ${link(DATA.urls.weapons, "siege engines")}, crews and officers) from The Player's Guide to Skybourne, with the hull materials, templates, mediums of travel, armor, further engines, rooms, siege engines and equipment of Ships of Skybourne. The samples are loaded as their parts and worked out by the rules, so a few numbers differ from their printed stat blocks. Not counted: ammunition, crew equipment and perks, and vehicles smaller than a Hardpoint.</p>
    </section>`
}

function summary() {
  const b = build()
  const speed = b.speeds.map((s) => `${s.label.toLowerCase()} ${s.speed}`).join(", ") || "0"
  const lines = [`${state.name || "Vehicle"}`, `${b.size.name}${b.plus ? "+" : ""} ${b.material.name} ${b.mediums.map((m) => m[1]).join("/")} Vehicle${TEMPLATES.filter((t) => state.templates[t.key]).length ? ` (${TEMPLATES.filter((t) => state.templates[t.key]).map((t) => t.name.toLowerCase()).join(", ")})` : ""}`,
    `Space ${b.spaces} vehicle space${b.spaces === 1 ? "" : "s"}; Cost ${gp(b.cost)}`, `Size ${sized(b.total)}; Hull ${sized(b.hull)}`, "",
    ...b.locations.map((l) => `${l.name}${l.count > 1 ? ` (${l.count} Locations, each)` : ""}: AC ${l.size.ac + b.maneuver.dodge + l.armor}; ${l.hp} hp, Hardness ${l.hardness}`),
    `Attack ram (${b.ram})${b.weapons.length ? "; " + b.weapons.map((w) => `${w.qty} ${w.def.name} (${w.def.damage}${w.def.critical ? "/" + w.def.critical : ""}${w.def.range ? "; " + w.def.range : ""})`).join(", ") : ""}`,
    `CMB ${signed(b.cmb)}; CMD ${10 + b.cmb}`, `Speed ${speed}; Acceleration ${b.best.accel || "1 per 2 rounds"}; Maneuverability ${b.maneuver.name}`,
    `Propulsion ${b.muscle ? `${b.muscle.have} creatures` : b.engines.map((e) => `${e.def.name.toLowerCase()} (${sized(e.size)})`).join(", ") || "none"}; Power ${num(b.power, 2)} Hardpoints' worth`,
    `Mass ${num(b.mass, 2)} Hardpoints${state.mediums.air ? `; Weight ${num(b.weight, 2)}` : ""}${state.mediums.land ? `; Tread ${b.tread.name.toLowerCase()}` : ""}`,
    `Required crew ${1 + b.engineers} (1 pilot${b.engineers ? `, ${b.engineers} engineers or sailors` : ""})${b.gunners ? `; ${b.gunners} on the siege engines` : ""}`,
    `Load ${tons(b.load)} (${b.burden}); light under ${tons(b.limits.light)}, medium under ${tons(b.limits.medium)}, heavy to ${tons(b.limits.heavy)}`,
    `Rooms ${b.rooms.map((r) => `${r.name} (${sized(r.size)}${r.xd ? ", extra-dimensional" : ""})`).join("; ") || "none"}`]
  const gear = [b.armor ? `${state.armor.material ? state.armor.material.toLowerCase() + " " : ""}${b.armor.name.toLowerCase()} armor` : "", b.dirDef && b.dirigible ? `${b.dirDef.name.toLowerCase()} dirigible (${sized(b.dirigible)})` : "", ...b.fitted].filter(Boolean)
  if (gear.length) lines.push(`Equipment ${gear.join(", ")}`)
  lines.push("", `Crew ${num(b.hired)} ${b.slaves ? "slaves" : state.crew.kind} (level ${b.level})${b.officers.length ? "; officers " + b.officers.map((o) => `${o.name ? o.name + ", " : ""}${o.role.toLowerCase()} ${o.level}`).join("; ") : ""}`,
    `Upkeep ${gp(b.upkeep)} a month (wages ${gp(b.wages + b.officerPay)}${b.food ? `, rations ${gp(b.food)}` : ""}${b.fuelMonth ? `, fuel ${gp(b.fuelMonth)}` : ""})`)
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
const value = (el) => (el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? "" : Number(el.value) || 0) : el.value)

$("panel").addEventListener("change", (e) => {
  const el = e.target, d = el.dataset
  if (el.id === "sample" && el.value) loadSample(el.value)
  else if (el.id === "addEngine" && el.value) state.engines.push({ type: el.value, n: 1, unit: state.hull.unit === "deck" && points(state.hull) >= 5 * DECK ? "deck" : "hp" })
  else if (el.id === "addRoom" && el.value) state.rooms.push({ name: el.value, n: DATA.rooms.find((r) => r.name === el.value)?.min ?? 1, unit: "hp" })
  else if (el.id === "addWeapon" && el.value) state.weapons.push({ name: el.value, qty: 1 })
  else if (el.id === "addOfficer" && el.value) state.officers.push({ role: el.value, name: "", level: 1, unpaid: el.value === "Captain" })
  else if (d.size) at(d.size).n = Math.max(0, Number(el.value) || 0)
  else if (d.unit) {
    // keep the same size where it converts cleanly
    const p = at(d.unit), hp = points(p)
    p.unit = el.value
    p.n = el.value === "deck" ? (hp % DECK ? p.n : hp / DECK) : hp
  } else if (d.engine) state.engines[Number(d.engine)].type = el.value
  else if ("dirigible" in d) state.dirigible.type = el.value
  else if (d.medium) state.mediums[d.medium] = el.checked
  else if (d.template) state.templates[d.template] = el.checked
  else if (d.armor) state.armor[d.armor] = el.value
  else if (d.muscle) state.muscle[d.muscle] = value(el)
  else if (d.crew) state.crew[d.crew] = value(el)
  else if (d.equip) state.equip[d.equip] = el.type === "checkbox" ? (el.checked ? 1 : 0) : Math.max(0, Number(el.value) || 0)
  else if (d.officer) state.officers[Number(d.officer)][d.key] = value(el)
  else if (d.xd) state.rooms[Number(d.xd)].xd = el.checked
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
