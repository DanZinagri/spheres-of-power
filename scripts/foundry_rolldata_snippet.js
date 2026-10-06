// Paste into Foundry's browser console (F12) with a character token selected. Downloads
// pf1-rolldata-shape.json: the roll data key layout (types only, no values) and the live change
// target / bonus type / context note lists, including what active modules add. Then run:
//   node scripts/extract_pf1_formula_data.mjs <FoundryDataDir> <path to pf1-rolldata-shape.json>
(() => {
  const actor = canvas.tokens?.controlled[0]?.actor ?? game.user.character ?? game.actors.find((a) => a.type === "character");
  if (!actor) return ui.notifications.warn("Select a character token first");
  // keys and value types only, no character values
  const shape = (v, d = 0) => {
    if (v == null) return null;
    if (Array.isArray(v)) return v.length ? [shape(v[0], d + 1)] : [];
    if (typeof v === "object") {
      if (d > 8) return "{...}";
      const o = {};
      for (const [k, x] of Object.entries(v)) if (typeof x !== "function") o[k] = shape(x, d + 1);
      return o;
    }
    return typeof v;
  };
  const L = (s) => (typeof s === "string" ? game.i18n.localize(s) : s);
  const labels = (obj) => Object.fromEntries(Object.entries(obj ?? {}).map(([k, v]) => [k, typeof v === "object" ? { ...v, label: L(v.label) } : L(v)]));
  const c = pf1.config;
  const out = {
    pf1: game.system.version,
    modules: game.modules.filter((m) => m.active).map((m) => m.id),
    rollData: shape(actor.getRollData()),
    buffTargets: labels(c.buffTargets),
    buffTargetCategories: labels(c.buffTargetCategories),
    contextNoteTargets: labels(c.contextNoteTargets),
    contextNoteCategories: labels(c.contextNoteCategories),
    bonusTypes: labels(c.bonusTypes),
  };
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(out, null, 1), "application/json", "pf1-rolldata-shape.json");
})();
