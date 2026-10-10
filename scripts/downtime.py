"""Downtime rules data from Archives of Nethys (www.aonprd.com only, through aon_compendium's
cached, rate-limited fetch) for the Business Builder. Statistics only (no descriptions):

    python scripts/downtime.py     # writes compendium/downtime.json

Ultimate Campaign's downtime system: the capital values, every room and team (what it earns, what
it costs to create, how long it takes), the example buildings and organizations, and the example
managers and their wages.
"""
from __future__ import annotations

import html as htmllib
import json
import re
from pathlib import Path

import aon_compendium as aon

COMP = Path(__file__).resolve().parent.parent / "quartz" / "static" / "compendium"
CAPITAL = ["Goods", "Influence", "Labor", "Magic"]


def clean(fragment: str) -> str:
    t = htmllib.unescape(re.sub(r"<[^>]+>", " ", fragment)).replace("\xa0", " ").replace("’", "'")
    return re.sub(r"\s+", " ", t).strip()


def body(path: str) -> str:
    page = aon.fetch(path)
    start = page.find("MainContent_DetailedOutput")
    return page[start:page.find('id="footer"', start)]


def create(text: str) -> dict:
    """'8 Goods, 1 Influence, 5 Labor, 1 Magic (390 gp)' -> the four capital amounts and the gp price."""
    out = {k.lower(): 0 for k in CAPITAL}
    for n, k in re.findall(r"(\d+) (Goods|Influence|Labor|Magic)", text):
        out[k.lower()] = int(n)
    gp = re.search(r"\(([\d,]+) gp\)", text)
    out["gp"] = int(gp.group(1).replace(",", "")) if gp else 0
    return out


def earnings(text: str) -> dict | None:
    """'gp, Goods, or Magic +10' / 'capital +5' -> the kinds of capital it can earn and the bonus."""
    m = re.search(r"\+\s*(\d+)", text)
    if not m:
        return None
    kinds = [k.lower() for k in ["gp", *CAPITAL] if re.search(rf"\b{k}\b", text, re.I)]
    return {"kinds": ["gp", *[k.lower() for k in CAPITAL]] if re.search(r"\bcapital\b", text, re.I) or not kinds else kinds, "bonus": int(m.group(1)), "text": text}


def units(path: str, kind: str) -> list[dict]:
    """The room or team stat blocks on a list page (each an <h3 class="framing"> and bold-labelled lines)."""
    html = body(path)
    out = []
    parts = re.split(r'<h3 class="framing">(.*?)</h3>', html)
    for name, block in zip(parts[1::2], parts[2::2]):
        fields = {}
        labels = list(re.finditer(r"<b>(Earnings|Benefit|Create|Time|Size|Upgrades? To|Upgrades? From)</b>", block))
        # a label repeated further down belongs to the description's prose, not the stat block
        seen = [m.group(1) for m in labels]
        cut = next((i for i, x in enumerate(seen) if x in seen[:i]), len(labels))
        block = block[:labels[cut].start()] if cut < len(labels) else block
        labels = labels[:cut]
        for i, m in enumerate(labels):
            end = labels[i + 1].start() if i + 1 < len(labels) else len(block)
            value = block[m.end():end]
            # the last field ends where the description starts (a blank line, or the first sentence)
            if i + 1 == len(labels):
                value = re.split(r"<br\s*/?>\s*<br\s*/?>", value)[0]
            fields[re.sub(r"Upgrades? ", "Upgrades ", m.group(1))] = clean(value).rstrip(";").strip()
        if "Create" not in fields:
            continue
        # an "Upgrades To" value that ran into the description: keep the names only (title case, comma separated)
        for key in ("Upgrades To", "Upgrades From"):
            if key in fields:
                names = re.match(r"((?:[A-Z][\w'-]*(?: [A-Z][\w'-]*)*)(?:, (?:[A-Z][\w'-]*(?: [A-Z][\w'-]*)*))*)", fields[key])
                fields[key] = names.group(1) if names else fields[key]
        days = re.search(r"(\d+) day", fields.get("Time", ""))
        size = re.sub(r"(?<=\d)[^\w\s,.](?=\d)", "-", fields.get("Size", ""))
        size = m.group(1) if (m := re.match(r"(\d+(?:-\d+)? (?:squares?|people|person)|As original room)", size)) else size
        out.append({"name": clean(name), "kind": kind, "earnings": earnings(fields.get("Earnings", "")), "benefit": fields.get("Benefit", ""),
                    "create": create(fields["Create"]), "days": int(days.group(1)) if days else 0, "size": size,
                    "upgradesTo": [x.strip() for x in fields.get("Upgrades To", "").split(",") if x.strip()],
                    "upgradesFrom": [x.strip() for x in fields.get("Upgrades From", "").split(",") if x.strip()]})
    return out


TYPOS = {"Summmoning Chamber": "Summoning Chamber", "Toolbooth": "Tollbooth"}


def singular(word: str) -> list[str]:
    """The names a listed (often plural) room or team could be filed under."""
    out = [word]
    if word.endswith("ies"):
        out.append(word[:-3] + "y")
    if word.endswith("es"):
        out.append(word[:-2])
    if word.endswith("s"):
        out.append(word[:-1])
    return out


def resolve(text: str, names: set[str]) -> tuple[str, str] | None:
    """'Storages', 'Furnishings (Bedroom and Sitting Room)', 'Sage An Apprentice ...' -> (unit name, note)."""
    note = re.search(r"\(([^)]*)\)?", text)
    base = text[:note.start()].strip() if note else text.strip()
    words = base.split()
    for n in range(len(words), 0, -1):  # the longest leading run of words that names a unit
        for cand in singular(" ".join(words[:n])):
            for full in (cand, f"{cand} (Augmentation)", f"{cand}s (Augmentation)"):
                if full in names:
                    return full, (note.group(1).strip() if note and n == len(words) else "")
    return None


def collections(path: str, word: str, names: set[str]) -> list[dict]:
    """Example buildings / organizations: 'Name Create ... (gp) Rooms 1 Bar, 2 Baths, ...'."""
    html = body(path)
    out = []
    parts = re.split(r'<h3 class="framing">(.*?)</h3>', html)
    for name, block in zip(parts[1::2], parts[2::2]):
        made = re.search(r"<b>Create</b>(.*?)(?=<b>|<br)", block, re.S)
        listed = re.search(rf"<b>{word}</b>(.*?)(?=<br|<b>|$)", block, re.S)
        if not made or not listed:
            continue
        members = []
        for n, x in re.findall(r"(\d+) ([A-Z](?:[^,;(]|\([^)]*\)?)*)", clean(listed.group(1))):
            hit = resolve(x, names)
            if hit:
                members.append({"qty": int(n), "name": hit[0], **({"note": hit[1]} if hit[1] else {})})
            else:
                print("warning:", clean(name), "lists an unknown", word[:-1].lower(), repr(x))
        out.append({"name": clean(name), "create": create(clean(made.group(1))), "units": members})
    return out


def managers() -> list[dict]:
    html = body("Rules.aspx?ID=1284")
    out = []
    parts = re.split(r'<h3 class="framing">(.*?)</h3>', html)
    for name, block in zip(parts[1::2], parts[2::2]):
        wage = re.search(r"<b>Wage</b>\s*([\d,.]+) gp/day", block)
        skills = re.search(r"<b>Skills</b>(.*?)(?=<br|<b>)", block, re.S)
        if wage:
            out.append({"name": clean(name), "wage": float(wage.group(1).replace(",", "")), "skills": clean(skills.group(1)) if skills else ""})
    return out


def main() -> None:
    rooms = units("Rules.aspx?Name=Rooms&Category=Rooms and Teams", "room")
    teams = units("Rules.aspx?Name=Teams&Category=Rooms and Teams", "team")
    for u in rooms + teams:
        u["name"] = TYPOS.get(u["name"], u["name"])
    names = {u["name"] for u in rooms + teams}
    for u in rooms + teams:
        for key in ("upgradesTo", "upgradesFrom"):
            u[key] = [hit[0] for x in u[key] if (hit := resolve(TYPOS.get(x, x), names))]
    buildings = collections("Rules.aspx?ID=1296", "Rooms", names)
    orgs = collections("Rules.aspx?ID=1297", "Teams", names)
    out = {"source": "Archives of Nethys (www.aonprd.com), Pathfinder RPG Ultimate Campaign",
           "urls": {"rules": aon.page_url("Rules.aspx?ID=1245"), "rooms": aon.page_url("Rules.aspx?Name=Rooms&Category=Rooms and Teams"),
                    "teams": aon.page_url("Rules.aspx?Name=Teams&Category=Rooms and Teams"), "buildings": aon.page_url("Rules.aspx?ID=1296"),
                    "organizations": aon.page_url("Rules.aspx?ID=1297"), "managers": aon.page_url("Rules.aspx?ID=1284")},
           "capital": {"goods": {"buy": 20, "earn": 10}, "influence": {"buy": 30, "earn": 15}, "labor": {"buy": 20, "earn": 10}, "magic": {"buy": 100, "earn": 50}},
           "rooms": rooms, "teams": teams, "buildings": buildings, "organizations": orgs, "managers": managers()}
    (COMP / "downtime.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print({k: len(v) for k, v in out.items() if isinstance(v, list)})
    # an example's listed capital should be the sum of its parts (the books round a few)
    by = {u["name"]: u for u in rooms + teams}
    drift = [c["name"] for c in buildings + orgs
             if any(sum(by[m["name"]]["create"][k] * m["qty"] for m in c["units"]) != c["create"][k] for k in ("goods", "influence", "labor", "magic"))]
    print("examples whose capital differs from the sum of their parts:", len(drift), drift)
    # each listed gp price should be its capital at the purchase price
    cap = out["capital"]
    off = [u["name"] for u in rooms + teams if u["create"]["gp"] != sum(u["create"][k] * cap[k]["buy"] for k in cap)]
    print("gp price differs from its capital:", off)


if __name__ == "__main__":
    main()
