"""Parse the Archives of Nethys monster stat blocks (compendium/pf1e/monsters.json, from
aon_compendium.py) into structured monsters for the Monster Creator: CR/XP, type, HD (racial and
class), AC parts, saves, defenses, speeds, attacks, abilities, feats, skills, special abilities.

    python scripts/monsters.py            # writes compendium/monsters-index.json + compendium/monsters/*.json
"""
from __future__ import annotations

import json
import re
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMP = ROOT / "quartz" / "static" / "compendium"
SRC = COMP / "pf1e" / "monsters.json"
MYTHIC_SRC = COMP / "pf1e" / "mythic-monsters.json"
OUT_DIR = COMP / "monsters"
CHUNKS = 48

DASH = "—–−-"
SIZES = ["Fine", "Diminutive", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Colossal"]
# Bestiary creature types: racial HD die, BAB rate, good saves (a default; the stat block decides), skill ranks per HD
TYPES = {
    "aberration": (8, "med", ["will"], 4), "animal": (8, "med", ["fort", "ref"], 2), "construct": (10, "high", [], 2),
    "dragon": (12, "high", ["fort", "ref", "will"], 6), "fey": (6, "low", ["ref", "will"], 6),
    "humanoid": (8, "med", ["ref"], 2), "magical beast": (10, "high", ["fort", "ref"], 2),
    "monstrous humanoid": (10, "high", ["ref", "will"], 4), "ooze": (8, "med", [], 2),
    "outsider": (10, "high", ["ref", "will"], 6), "plant": (8, "med", ["fort"], 2), "undead": (8, "med", ["will"], 4),
    "vermin": (8, "med", ["fort"], 2),
}
ALIGN = r"(?:LG|NG|CG|LN|N|CN|LE|NE|CE|Any(?: alignment)?|any(?: alignment)?|[LNC][GNE]? ?or ?[LNC][GNE]?|Always [A-Za-z ]+?)"
PC_CLASSES = {"alchemist", "antipaladin", "arcanist", "barbarian", "bard", "bloodrager", "brawler", "cavalier", "cleric",
              "druid", "fighter", "gunslinger", "hunter", "inquisitor", "investigator", "kineticist", "magus", "medium",
              "mesmerist", "monk", "ninja", "occultist", "oracle", "paladin", "psychic", "ranger", "rogue", "samurai",
              "shaman", "shifter", "skald", "slayer", "sorcerer", "spiritualist", "summoner", "swashbuckler", "vigilante",
              "warpriest", "witch", "wizard"}
NPC_CLASSES = {"adept", "aristocrat", "commoner", "expert", "warrior"}


def clean(t: str) -> str:
    t = re.sub(r"[*_]", "", t or "").replace(" ", " ")
    return re.sub(r"[ \t]+", " ", t).strip()


def num(t: str | None) -> int | None:
    if t is None:
        return None
    m = re.search(rf"[+{DASH}]?\s?\d+", t)
    if not m:
        return None
    v = m.group(0).replace(" ", "")
    return -int(v[1:]) if v[0] in DASH else int(v.lstrip("+"))


def field(text: str, label: str, stop: str = r";|\n") -> str:
    m = re.search(rf"(?:^|[;\n]\s*|\s){re.escape(label)}\s+(.+?)(?=(?:{stop})|$)", text, re.M)
    return m.group(1).strip(" ,;") if m else ""


def section(md: str, name: str) -> str:
    m = re.search(rf"(?m)^###\s+{name}\s*$(.*?)(?=^###? |\Z)", md, re.S)
    return m.group(1) if m else ""


def parse_attacks(text: str) -> list[list[dict]]:
    """"2 claws +8 (1d6+4 plus grab), bite +8 (1d6+4) or mwk longsword +9/+4 (1d8+3/19-20)" ->
    [[{count, name, bonuses, damage, crit, extra}, ...], [...]] (one list per "or" option)."""
    out = []
    for option in re.split(r"\s+or\s+(?![^()]*\))", text):
        group = []
        for part in re.split(r",\s*(?![^()]*\))", option):
            m = re.match(rf"\s*(?:(\d+)\s+)?(.+?)\s+((?:[+{DASH}]\d+)(?:/[+{DASH}]\d+)*)\s*(?:\(([^()]*(?:\([^()]*\)[^()]*)*)\))?\s*$", part)
            if not m:
                if part.strip():
                    group.append({"count": 1, "name": part.strip(), "bonuses": [], "damage": "", "extra": "", "raw": part.strip()})
                continue
            count = int(m.group(1) or 1)
            bonuses = [num(b) for b in m.group(3).split("/")]
            inner = m.group(4) or ""
            dmg, _, extra = inner.partition(" plus ")
            crit = ""
            if (c := re.search(rf"/(\d+[{DASH}]20(?:/[x×]\d)?|[x×]\d)", dmg)):
                crit = c.group(1)
                dmg = dmg[:c.start()]
            group.append({"count": count, "name": m.group(2).strip(), "bonuses": bonuses, "damage": dmg.strip(),
                          "crit": crit.replace("×", "x"), "extra": extra.strip(), "raw": part.strip()})
        if group:
            out.append(group)
    return out


def parse_special_abilities(md: str) -> list[dict]:
    sa = section(md, "Special Abilities")
    out = []
    for m in re.finditer(r"(?m)^\*\*(.+?)\s*\((Ex|Su|Sp)\)\*\*\s*(.+?)(?=^\*\*|\Z)", sa, re.S):
        out.append({"name": clean(m.group(1)), "kind": m.group(2), "text": clean(m.group(3))})
    return out


def parse(e: dict) -> dict | None:
    md = e["md"]
    head = re.search(r"(?m)^## (.+?) CR ([\d/]+)(?:/MR (\d+))?\s*$", md)
    if not head:
        return None
    body = md[head.end():]
    lines = [clean(l) for l in body.split("\n") if clean(l)]
    m = {"name": e["name"], "statName": head.group(1).strip(), "cr": head.group(2), "url": e["url"], "source": e["source"],
         "mr": int(head.group(3)) if head.group(3) else 0}
    xp = next((l for l in lines if l.startswith("XP ")), "")
    m["xp"] = int(re.sub(r"\D", "", xp) or 0)
    # the identity lines: an optional "Goblin warrior 1" (race + class levels), then "NE Small humanoid (goblinoid)"
    ident_i = next((i for i, l in enumerate(lines[:8]) if re.match(rf"^{ALIGN}\s+(?:{'|'.join(SIZES)})\b", l)), None)
    classes = []
    if ident_i is not None:
        ident = lines[ident_i]
        mm = re.match(rf"^({ALIGN})\s+({'|'.join(SIZES)})\s+(.+?)(?:\s+\((.+)\))?$", ident)
        if mm:
            m["alignment"], m["size"] = mm.group(1), mm.group(2)
            m["type"] = mm.group(3).strip().lower()
            m["subtypes"] = [s.strip() for s in (mm.group(4) or "").split(",") if s.strip()]
        prev = lines[ident_i - 1] if ident_i else ""
        if not prev.startswith("XP") and not prev.startswith("Source"):
            for cm in re.finditer(r"([A-Za-z][a-z]+(?: \([a-z ]+\))?)\s+(\d+)", prev):
                cls = cm.group(1).split(" (")[0].lower()
                if cls in PC_CLASSES or cls in NPC_CLASSES:
                    classes.append({"name": cls.title(), "level": int(cm.group(2)), "npc": cls in NPC_CLASSES})
            if classes:
                m["race"] = re.sub(r"\s+[A-Za-z]+(?: \([a-z ]+\))?\s+\d+.*$", "", prev).strip()
    m["classes"] = classes
    t = "\n".join(lines)
    m["init"] = num(field(t, "Init"))
    senses = field(t, "Senses", r"\n")
    m["senses"] = re.sub(r";?\s*Perception\s*[+\-−—]?\s*\d+.*$", "", senses).strip(" ;")
    m["aura"] = field(t, "Aura", r"\n")
    # AC
    ac_line = field(t, "AC", r"\n")
    m["ac"] = {"total": num(ac_line), "touch": num(field(ac_line, "touch", r",")), "flat": num(field(ac_line, "flat-footed", r"[ ,(]"))}
    parts = {}
    if (pm := re.search(r"\(([^()]*)\)\s*$", ac_line) or re.search(r"\(([^()]*)\)", ac_line)):
        for p in pm.group(1).split(","):
            pp = re.match(rf"\s*([+{DASH}]\d+)\s+(.+)", p.strip())
            if pp:
                parts[pp.group(2).strip().lower()] = num(pp.group(1))
    m["ac"]["parts"] = parts
    hp_line = field(t, "hp", r"\n")
    m["hp"] = num(hp_line)
    m["hpFormula"] = (re.search(r"\(([^)]*)\)", hp_line) or [None, ""])[1]
    dice = [(int(a), int(b)) for a, b in re.findall(r"(\d+)d(\d+)", m["hpFormula"])]
    m["hd"] = sum(a for a, _ in dice)
    m["hpExtra"] = re.sub(r"^[\d\s,()]+", "", hp_line[len(str(m["hp"] or "")):]).strip(" ;")
    m["saves"] = {k: num(field(t, lab, r",|;|\n")) for k, lab in (("fort", "Fort"), ("ref", "Ref"), ("will", "Will"))}
    m["saveNotes"] = (re.search(r"Will\s+[+\-−—]?\d+[^;\n]*?;\s*(.+)$", t, re.M) or [None, ""])[1]
    for k, lab in (("defensive", "Defensive Abilities"), ("dr", "DR"), ("immune", "Immune"), ("resist", "Resist"),
                   ("sr", "SR"), ("weaknesses", "Weaknesses")):
        m[k] = field(t, lab)
    # offense
    sp = field(t, "Speed", r"\n")
    speeds = {"land": num(sp) if not re.match(r"\s*(fly|swim|climb|burrow)", sp) else 0}
    for kind in ("fly", "swim", "climb", "burrow"):
        if (sm := re.search(rf"\b{kind}\s+(\d+)\s*ft\.?(?:\s*\(([a-z]+)\))?", sp)):
            speeds[kind] = int(sm.group(1))
            if kind == "fly" and sm.group(2):
                speeds["flyManeuver"] = sm.group(2)
    m["speed"] = speeds
    m["speedText"] = sp
    m["melee"] = parse_attacks(field(t, "Melee", r"\n"))
    m["ranged"] = parse_attacks(field(t, "Ranged", r"\n"))
    m["space"] = field(t, "Space", r",|;|\n")
    m["reach"] = field(t, "Reach", r";|\n")
    m["specialAttacks"] = field(t, "Special Attacks", r"\n")
    off = section(md, "Offense")
    sla = re.search(r"\*\*Spell-Like Abilities\*\*(.*?)(?=\n\*\*[A-Z]|\Z)", off, re.S)
    m["sla"] = clean(sla.group(0)) if sla else ""
    spells = re.search(r"\*\*[A-Za-z ]*Spells (?:Known|Prepared)\*\*(.*?)(?=\n\*\*(?![A-Z][a-z]+ Spells)|\Z)", off, re.S)
    m["spells"] = clean(spells.group(0)) if spells else ""
    # statistics
    ab = {}
    for k, lab in (("str", "Str"), ("dex", "Dex"), ("con", "Con"), ("int", "Int"), ("wis", "Wis"), ("cha", "Cha")):
        v = field(t, lab, r",|;|\n")
        ab[k] = None if not v or v[0] in DASH else num(v)
    m["abilities"] = ab
    m["bab"] = num(field(t, "Base Atk"))
    m["cmb"] = num(field(t, "CMB"))
    m["cmd"] = num(field(t, "CMD"))
    feats = field(t, "Feats", r"\n")
    m["feats"] = [f.strip() for f in re.split(r",\s*(?![^()]*\))", feats) if f.strip()]
    skills_line = field(t, "Skills", r";|\n")
    m["skills"] = []
    for s in re.split(r",\s*(?![^()]*\))", skills_line):
        if (sm := re.match(rf"\s*(.+?)\s+([+{DASH}]\d+)(?:\s*\((.+)\))?\s*$", s)):
            m["skills"].append({"name": sm.group(1).strip(), "total": num(sm.group(2)), "note": sm.group(3) or ""})
    m["racialMods"] = field(t, "Racial Modifiers", r"\n")
    m["languages"] = field(t, "Languages", r"\n")
    m["sq"] = field(t, "SQ", r"\n")
    m["gear"] = "; ".join(x for x in (field(t, "Combat Gear", r"\n"), field(t, "Other Gear", r"\n"), field(t, "Gear", r"\n")) if x)
    m["specialAbilities"] = parse_special_abilities(md)
    # racial HD = all HD less the class levels
    tdef = TYPES.get(m.get("type", ""))
    class_hd = sum(c["level"] for c in classes)
    m["racialHd"] = max(0, m["hd"] - class_hd)
    m["typeRules"] = {"hd": tdef[0], "bab": tdef[1], "good": tdef[2], "skills": tdef[3]} if tdef else None
    m["md"] = md
    return m


def build() -> int:
    raw = json.loads(SRC.read_text(encoding="utf-8"))["entries"]
    # mythic monsters (a separate AoN list): named as their stat block names them ("Mythic Aboleth")
    if MYTHIC_SRC.exists():
        raw += [{**e, "mythicList": True} for e in json.loads(MYTHIC_SRC.read_text(encoding="utf-8"))["entries"]]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    chunks: dict[int, list[dict]] = {}
    index, used, failed = [], set(), []
    for e in raw:
        try:
            m = parse(e)
        except Exception as ex:  # one odd stat block shouldn't stop the rest
            failed.append((e["name"], repr(ex)))
            continue
        if not m:
            failed.append((e["name"], "no CR heading"))
            continue
        m["mythic"] = bool(m["mr"] or e.get("mythicList"))
        if e.get("mythicList"):
            m["name"] = m["statName"]
        mid = "monster/" + re.sub(r"[^a-z0-9]+", "-", m["name"].lower()).strip("-")
        n = 2
        while mid in used:
            mid, n = f"{mid}-{n}", n + 1
        used.add(mid)
        m["id"] = mid
        c = zlib.crc32(mid.encode()) % CHUNKS
        m["file"] = f"monsters/m{c:02d}.json"
        chunks.setdefault(c, []).append(m)
        index.append({"id": mid, "name": m["name"], "cr": m["cr"], "xp": m["xp"], "type": m.get("type", ""),
                      "subtypes": m.get("subtypes", []), "size": m.get("size", ""), "alignment": m.get("alignment", ""),
                      "hd": m["hd"], "source": m["source"], "file": m["file"], "mythic": m["mythic"], "mr": m["mr"],
                      "classes": [f"{c['name']} {c['level']}" for c in m["classes"]]})
    for c, ms in chunks.items():
        (OUT_DIR / f"m{c:02d}.json").write_text(json.dumps({"entries": ms}, ensure_ascii=False), encoding="utf-8")
    index.sort(key=lambda x: x["name"].lower())
    (COMP / "monsters-index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")
    if failed:
        print(f"{len(failed)} not parsed, e.g. {failed[:5]}")
    return len(index)


if __name__ == "__main__":
    print(f"monsters: {build()}")
