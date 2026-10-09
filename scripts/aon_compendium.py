"""Pathfinder 1e reference data from Archives of Nethys (www.aonprd.com, which hosts Paizo's PRD),
for the site's tools: quartz/static/compendium/pf1e/<category>.json.

Only www.aonprd.com is ever fetched (never 2e.aonprd.com, aonsrd.com or 2e.aonsrd.com). Pages
are fetched slowly (DELAY seconds apart) and cached in .cache/aon/, so a run can be stopped and
resumed, and later runs only fetch what isn't cached yet.

  python scripts/aon_compendium.py discover            # index pages only: how many entries each
  python scripts/aon_compendium.py crawl feats spells  # fetch + extract those categories
  python scripts/aon_compendium.py crawl all
  python scripts/aon_compendium.py build               # (re)write the JSON from the cache only

The rules text is Open Game Content (OGL 1.0a); see compendium/pf1e/LICENSE.md. Monster lore
("Ecology" onward) is left out, as it's mostly Paizo setting material (Product Identity).
"""
import hashlib
import html as htmllib
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString
from markdownify import markdownify

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "aon"
OUT = ROOT / "quartz" / "static" / "compendium" / "pf1e"
SITE = "https://www.aonprd.com/"
HOST = "www.aonprd.com"
DELAY = 1.2  # seconds between requests to AoN
UA = "Mozilla/5.0 (spheres-of-power wiki compendium; personal use, low request rate)"

# category -> (index pages, detail link pattern). Index entries may be ("from", category, fmt):
# every detail page of that category yields one more index page, e.g. each class's archetypes.
CATEGORIES = {
    "classes": (["Classes.aspx"], r"^ClassDisplay\.aspx\?ItemName="),
    "archetypes": ([("from", "classes", "Archetypes.aspx?Class={name}")], r"^ArchetypeDisplay\.aspx\?"),
    "feats": (["Feats.aspx"], r"^FeatDisplay\.aspx\?ItemName="),
    "traits": ([f"Traits.aspx?Type={t}" for t in (
        "Basic (Combat)", "Basic (Faith)", "Basic (Magic)", "Basic (Social)", "Campaign", "Cosmic",
        "Drawback", "Equipment", "Exemplar", "Faction", "Family", "Mount", "Race", "Region", "Religion")],
        r"^TraitDisplay\.aspx\?ItemName="),
    "races": (["Races.aspx?Category=Core", "Races.aspx?Category=NonCore"], r"^RacesDisplay\.aspx\?ItemName="),
    "spells": (["Spells.aspx?Class=All"], r"^SpellDisplay\.aspx\?ItemName="),
    "equipment": (["EquipmentArmor.aspx", "EquipmentWeapons.aspx", "EquipmentMisc.aspx",
                   ("self", "SpecialMaterials.aspx")],
                  r"^(Equipment\w*Display|Vehicles)\.aspx\?ItemName="),
    "magic-items": ([f"Magic{k}.aspx" for k in ("Armor", "Weapons", "Rings", "Rods", "Staves", "Wondrous",
                                                  "Potions", "Artifacts", "Cursed", "Intelligent", "Other")],
                    r"^Magic\w*Display\.aspx\?"),
    "monsters": (["Monsters.aspx?Letter=All"], r"^MonsterDisplay\.aspx\?ItemName="),
    "templates": (["MonsterTemplates.aspx?ItemName=All"], r"^MonsterTemplates\.aspx\?ItemName=(?!All$)"),
}

session = requests.Session()
session.headers["User-Agent"] = UA
_last = [0.0]


def page_url(path: str) -> str:
    """Absolute URL for a relative AoN link, with its query values properly encoded ("+1" stays "+1")."""
    base, _, query = path.partition("?")
    if query:
        parts = [kv.partition("=") for kv in query.split("&")]
        query = "&".join(k + eq + urllib.parse.quote(urllib.parse.unquote(v), safe="") for k, eq, v in parts)
    return urllib.parse.urljoin(SITE, base.replace(" ", "%20") + ("?" + query if query else ""))


def decode(raw: bytes) -> str:
    """AoN serves some pages as Windows-1252 whatever they declare."""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")


def cache_file(path: str) -> Path:
    return CACHE / (hashlib.sha1(page_url(path).encode()).hexdigest() + ".bin")


def fetch(path: str) -> str:
    """A page of www.aonprd.com (relative path), from the cache when possible."""
    url = page_url(path)
    if urllib.parse.urlsplit(url).hostname != HOST:
        raise ValueError(f"refusing to fetch outside {HOST}: {url}")
    f = cache_file(path)
    if f.exists():
        return decode(f.read_bytes())
    for attempt in range(4):
        wait = DELAY - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            r = session.get(url, timeout=60)
            if r.status_code == 200:
                CACHE.mkdir(parents=True, exist_ok=True)
                f.write_bytes(r.content)
                return decode(r.content)
            if r.status_code == 404:
                return ""
        except requests.RequestException:
            pass
        time.sleep(10 * (attempt + 1))  # back off on errors
    print(f"  ! gave up on {url}")
    return ""


def links(html: str, pattern: str) -> list[str]:
    seen, out = set(), []
    for m in re.finditer(r'href="([^"]+)"', html):
        # entities decoded before the #fragment goes: "ItemName=Bear&#39;s Balance" is Bear's Balance
        href = htmllib.unescape(m.group(1)).split("#", 1)[0].lstrip("/")
        if not href:
            continue
        if re.match(pattern, href) and href not in seen:
            seen.add(href)
            out.append(href)
    return out


def discover(cat: str, cache: dict[str, list[str]]) -> list[str]:
    if cat in cache:
        return cache[cat]
    pages, pattern = CATEGORIES[cat]
    found: list[str] = []
    for page in pages:
        if isinstance(page, tuple) and page[0] == "self":  # a page that is itself the one entry
            found.append(page[1])
        elif isinstance(page, tuple):  # one index page per entry of another category
            _, other, fmt = page
            for href in discover(other, cache):
                name = urllib.parse.unquote(href.split("=", 1)[1])
                found += links(fetch(fmt.format(name=name)), pattern)
        else:
            html = fetch(page)
            found += links(html, pattern)
            # menu pages (armor by category, wondrous items by slot, ...): follow their sub-lists,
            # i.e. links to the same page with a query
            base = re.escape(page.split("?")[0])
            for sub in links(html, rf"^{base}\?\w+=") if "?" not in page else []:
                found += links(fetch(sub), pattern)
    cache[cat] = list(dict.fromkeys(found))
    return cache[cat]


def text_of(el) -> str:
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)) if el else ""


def extract(cat: str, href: str, html: str) -> dict | list[dict] | None:
    """One entry: name, AoN url, source, labelled fields and the rules text (markdown)."""
    soup = BeautifulSoup(html, "html.parser")
    main = soup.find(id="main") or soup.body
    if not main:
        return None
    titles = main.find_all(["h1", "h2"], class_="title")
    if not titles:
        return None
    # some pages lead with a generic heading ("Monster Templates"): use the one naming the entry
    want = urllib.parse.unquote(href.partition("=")[2]).lower()
    title = next((t for t in titles if want and want in text_of(t).lower()), titles[0])
    for img in main.find_all("img"):
        img.decompose()
    # the entry's own block: from its title to the end of the container holding it
    box = title.parent
    while box is not None and box.name not in ("span", "td", "div") and box is not main:
        box = box.parent
    box = box or main
    for nav in box.find_all(["script", "style"]):
        nav.decompose()
    lore_cut = None
    if cat == "monsters":  # lore and setting text (mostly Product Identity) stays on AoN
        lore_cut = next((h for h in box.find_all(["h3", "h2"]) if text_of(h).lower() in ("ecology", "description")), None)
    name = text_of(title)
    html_box = str(box)
    if lore_cut is not None:
        # the Ecology and Description sections go (loose text included); the Special Abilities section,
        # which AoN prints between them, stays: it's the rules for the stat block's abilities
        heads = [h for h in box.find_all(["h3", "h2"]) if str(h) in html_box]
        at = lambda h: html_box.find(str(h))
        cuts = []
        for n, h in enumerate(heads):
            if text_of(h).lower() in ("ecology", "description"):
                nxt = next((at(x) for x in heads[n + 1:] if text_of(x).lower() == "special abilities" and at(x) > at(h)), None)
                cuts.append((at(h), nxt if nxt is not None else len(html_box)))
        for a, b in sorted(cuts, reverse=True):
            html_box = html_box[:a] + html_box[b:]
    # a feat page also prints the feat's mythic version ("Mythic Power Attack") under its own
    # heading: that becomes an entry of its own. (Combat Trick sections stay with the feat.)
    mythic: list[tuple[str, str]] = []
    if cat == "feats":
        heads = [h for h in box.find_all(["h1", "h2"]) if h is not title and text_of(h).startswith("Mythic ")]
        cuts = sorted(html_box.find(str(h)) for h in heads if str(h) in html_box)
        if cuts:
            later = [html_box.find(str(h)) for h in box.find_all(["h1", "h2"]) if h is not title]
            rest, base = "", html_box[:cuts[0]]
            for n, at in enumerate(cuts):
                end = min([x for x in later if x > at] + [len(html_box)])
                nxt = cuts[n + 1] if n + 1 < len(cuts) else len(html_box)
                mythic.append((text_of(heads[n]), html_box[at:end]))
                rest += html_box[end:nxt]  # a non-mythic section after a mythic one goes back to the feat
            html_box = base + rest
    out = _entry(name, cat, href, html_box, monsters=lore_cut is not None)
    if not mythic:
        return out
    return [out] + [_entry(n, cat, href, h) | {"mythicOf": name} for n, h in mythic]


def _entry(name: str, cat: str, href: str, html: str, monsters: bool = False) -> dict:
    """An entry from its HTML: the source, the labelled fields ("**Prerequisites**: ...") and the
    rules text as markdown."""
    box = BeautifulSoup(html, "html.parser")
    src = box.find("b", string=re.compile(r"^\s*Source\s*$"))
    source = text_of(src.find_next("a")) if src else ""
    fields: dict[str, str] = {}
    for b in box.find_all("b"):
        label = text_of(b).rstrip(":")
        if not label or len(label) > 30 or label in fields:
            continue
        val = []
        for sib in b.next_siblings:
            if getattr(sib, "name", None) in ("b", "br", "h1", "h2", "h3"):
                break
            val.append(sib if isinstance(sib, NavigableString) else sib.get_text(" "))
        v = re.sub(r"\s+", " ", "".join(val)).strip(" :;")
        if v:
            fields[label] = v
    if monsters:
        fields = {k: v for k, v in fields.items() if k not in ("Environment", "Organization", "Treasure")}
    md = markdownify(html, heading_style="ATX", bullets="-", strip=["a"])
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    if not md.startswith("# "):  # a split-out mythic feat: its heading becomes the entry's title
        md = re.sub(r"^#+ ", "# ", md, count=1)
    return {"name": name, "category": cat, "url": page_url(href), "source": source, "fields": fields, "md": md}


def crawl(cats: list[str], build_only: bool = False) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    disc: dict[str, list[str]] = {}
    index = []
    for cat in cats:
        hrefs = discover(cat, disc)
        print(f"{cat}: {len(hrefs)} entries")
        entries = []
        for n, href in enumerate(hrefs, 1):
            cached = cache_file(href).exists()
            if build_only and not cached:
                continue
            e = extract(cat, href, fetch(href))
            if e:  # a feat page can give two (the feat and its mythic version)
                entries += e if isinstance(e, list) else [e]
            if n % 200 == 0:
                print(f"  {cat}: {n}/{len(hrefs)}")
        (OUT / f"{cat}.json").write_text(json.dumps({"category": cat, "source": "Archives of Nethys (www.aonprd.com)",
                                                     "license": "OGL 1.0a - see LICENSE.md", "entries": entries},
                                                    ensure_ascii=False), encoding="utf-8")
        print(f"  wrote {len(entries)} {cat}")
        index += [{"name": e["name"], "category": cat, "source": e["source"], "url": e["url"]} for e in entries]
    old = OUT / "index.json"
    prev = [e for e in json.loads(old.read_text(encoding="utf-8"))] if old.exists() else []
    keep = [e for e in prev if e["category"] not in cats]
    old.write_text(json.dumps(keep + index, ensure_ascii=False), encoding="utf-8")


def _html_text(html: str) -> str:
    return re.sub(r"\s+", " ", BeautifulSoup(html, "html.parser").get_text(" ")).strip()


def race_data() -> int:
    """pf1e/race-data.json: each AoN race's standard racial traits ("<b>Low-Light Vision</b>: ...")
    and alternate racial traits (grouped under "Replaces ..." headings), read from the cached race
    pages, with the stats the Character Builder fills in (see scrape.race_stats)."""
    sys.path.insert(0, str(Path(__file__).parent))
    from scrape import ability_mods, race_stats
    src = OUT / "races.json"
    if not src.exists():
        return 0
    races = []
    for e in json.loads(src.read_text(encoding="utf-8"))["entries"]:
        href = e["url"].replace(SITE, "")
        if not cache_file(href).exists():
            continue
        html = fetch(href)
        race = urllib.parse.unquote(href.partition("ItemName=")[2]).strip()
        std = re.search(r'<h1 class="title">[^<]*Racial Traits</h1>(.*?)(?=<h1|\Z)', html, re.S)
        traits = []
        for m in re.finditer(r"<b>(.*?)</b>\s*:?(.*?)(?=<b>|$)", std.group(1) if std else "", re.S):
            label, text = _html_text(m.group(1)).rstrip(":"), _html_text(m.group(2)).lstrip(": ")
            if label and text:
                traits.append({"name": label, "kind": "Standard", "replaces": "", "source": e["source"],
                               "md": text})
        start = html.find("Alternate Racial Trait")
        end = html.find("Favored Class Options", start) if start >= 0 else -1
        seg = html[start:end if end > 0 else len(html)] if start >= 0 else ""
        tokens = list(re.finditer(r'<h2 class="title">(.*?)</h2>|<b>(?:\s*<img[^>]*>)?\s*([^<]+?)\s*</b>\s*<br\s*/?>'
                                  r'\s*<b>Source</b>', seg, re.S))
        replaces = ""
        for n, m in enumerate(tokens):
            if m.group(1) is not None:
                replaces = re.sub(r"^Replaces\s+", "", _html_text(m.group(1)))
                continue
            body = seg[m.end():tokens[n + 1].start() if n + 1 < len(tokens) else len(seg)]
            src_html, _, rest = body.partition("<br")
            rest = rest.partition(">")[2]
            md = markdownify(rest, heading_style="ATX", strip=["a", "img"])
            traits.append({"name": _html_text(m.group(2)), "kind": "Alternate", "replaces": replaces,
                           "source": ", ".join(_html_text(i) for i in re.findall(r"<i>(.*?)</i>", src_html, re.S)),
                           "md": re.sub(r"\n{3,}", "\n\n", md).strip()})
        # subraces / heritages ("Angel-Blooded (Angelkin)": "Ability Modifiers +2 Str, +2 Cha", or
        # which alternate racial traits they take)
        subraces = []
        sub = re.search(r'<h1 class="title">Subraces</h1>(.*?)(?=<h1|\Z)', html, re.S)
        parts = re.split(r'<h3 class="framing">(.*?)</h3>', sub.group(1) if sub else "", flags=re.S)
        for name_html, body in zip(parts[1::2], parts[2::2]):
            src_html = re.search(r"<b>Source</b>(.*?)<br", body, re.S)
            text = markdownify(re.sub(r"<b>Source</b>.*?<br\s*/?>", "", body, count=1, flags=re.S),
                               strip=["a", "img"])
            subraces.append({"name": _html_text(name_html), "mods": ability_mods(_html_text(body)),
                             "source": ", ".join(_html_text(i) for i in re.findall(r"<i>(.*?)</i>",
                                                                                   src_html.group(1) if src_html else "", re.S)),
                             "md": re.sub(r"\n{3,}", "\n\n", text).strip()})
        std_traits = [(t["name"], t["md"]) for t in traits if t["kind"] == "Standard"]
        races.append({"name": race, "url": e["url"], "source": e["source"]} | race_stats(std_traits)
                     | {"traits": traits, "subraces": subraces})
    (OUT / "race-data.json").write_text(json.dumps({"races": races}, ensure_ascii=False, indent=1), encoding="utf-8")
    return len(races)


def class_stats() -> int:
    """pf1e/class-stats.json: each AoN class in the Character Builder's terms (hit die, BAB and
    save progressions, skill ranks, class skills, caster progression), like compendium/classes.json
    for the Spheres classes. Casters map by their highest spell level: 9th -> high-caster, 6th ->
    mid, 4th -> low (Spheres of Power's conversion)."""
    sys.path.insert(0, str(Path(__file__).parent))
    from scrape import class_skill_keys, progression_from_table
    src = OUT / "classes.json"
    if not src.exists():
        return 0
    out = []
    for e in json.loads(src.read_text(encoding="utf-8"))["entries"]:
        md, f = e["md"], e["fields"]
        if not re.search(r"d\d+", f.get("Hit Die", "")):
            continue  # companion stat pages (Companion, Eidolon, Familiar, Drake, Phantom), not classes
        hd = re.search(r"d(\d+)", f.get("Hit Die", ""))
        ranks = next((re.search(r"\d+", v) for k, v in f.items() if re.match(r"Skill (Ranks|Points)", k)), None)
        # "**Class Skills**: ..." or a "## Class Skills" heading with the sentence under it
        skills = re.search(r"(?:\*\*Class Skills\*\*:?|#+ Class Skills\s*\n)\s*([^\n]+)", md)
        prog = progression_from_table(md)
        head = next((l for l in md.split("\n") if "Base Attack Bonus" in l), "")
        top = max((int(m) for m in re.findall(r"\*\*(\d)(?:st|nd|rd|th)\*\*", head)), default=0)
        if prog.get("caster", "none") == "none" and top:
            prog["caster"] = "high" if top >= 9 else "mid" if top >= 6 else "low"
        c = {"name": e["name"], "system": "Pathfinder", "url": e["url"], "source": e["source"],
             "hd": int(hd.group(1)) if hd else None, "skills": int(ranks.group(0)) if ranks else None,
             "classSkills": class_skill_keys(skills.group(1)) if skills else [],
             "classSkillsText": skills.group(1).strip() if skills else ""} | prog
        c["prestige"] = (c.get("levels") or 20) <= 10
        c["complete"] = all(c.get(k) is not None for k in ("hd", "bab", "fort", "ref", "will", "skills"))
        out.append(c)
    (OUT / "class-stats.json").write_text(json.dumps({"classes": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    return len(out)


def gear_data() -> int:
    """pf1e/gear-data.json: where AoN lists each equipment and magic item - the sub-list
    ("Proficiency=Martial", "Category=Light", "FinalSlot=Belts") and the table heading above it
    ("Two-Handed Weapons", "One-Handed Firearms (Early)") - read from the cached index pages. The
    item pages themselves don't say whether armor is light or heavy, or a ranged weapon's hands."""
    out: dict[str, dict] = {}
    for top, pattern in (("equipment", r"^(Equipment\w*Display|Vehicles)\.aspx\?ItemName="),
                         ("magic-items", r"^Magic\w*Display\.aspx\?")):
        for page in CATEGORIES[top][0]:
            if isinstance(page, tuple):
                continue
            html = fetch(page)
            subs = links(html, rf"^{re.escape(page)}\?\w+=") or [page]
            for sub in subs:
                main = BeautifulSoup(fetch(sub), "html.parser").find(id="main")
                if not main:
                    continue
                listed = sub.partition("?")[2].partition("=")[2] or page.split(".")[0]
                section = ""
                for el in main.descendants:
                    if getattr(el, "name", None) == "h1" and "title" in (el.get("class") or []):
                        section = text_of(el)
                    elif getattr(el, "name", None) == "a" and el.get("href"):
                        href = el["href"].lstrip("/").replace("&amp;", "&")
                        if re.match(pattern, href):
                            rec = out.setdefault(page_url(href), {"index": page.split(".")[0], "list": listed,
                                                                  "section": section, "lists": []})
                            if listed not in rec["lists"]:  # a special ability can be melee and ranged
                                rec["lists"].append(listed)
    (OUT / "gear-data.json").write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    return len(out)


if __name__ == "__main__":
    cmd, *args = sys.argv[1:] or ["discover"]
    cats = list(CATEGORIES) if args in ([], ["all"]) else args
    if cmd == "discover":
        disc: dict[str, list[str]] = {}
        for c in cats:
            print(f"{c}: {len(discover(c, disc))} entries")
    elif cmd == "crawl":
        crawl(cats)
    elif cmd == "build":
        crawl(cats, build_only=True)
    elif cmd == "class-stats":
        print(f"class stats: {class_stats()}")
    elif cmd == "gear-data":
        print(f"gear data: {gear_data()}")
    elif cmd == "race-data":
        print(f"race data: {race_data()}")
