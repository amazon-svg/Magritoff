#!/usr/bin/env python3
"""Transpose le périmètre fonctionnel des stories Notion dans les story documents du dépôt.

Règle : docs/spec/STORY_DOCUMENT_STANDARD.md. Notion fait foi ; ce script ne fait que
recopier, entre deux marqueurs, ce qui a été extrait de Notion.

Entrées (produites par l'agent `scribe` via le MCP Notion, format décrit dans
docs/spec/notion-extraction-format.md) :
  --stories DIR   un fichier <ID>.md par story du Sprint Board (ligne 1 : <!-- props: {...} -->)
  --tf FILE       export TSV des cahiers de tests (tf_id, titre, statut, priorite, parcours, cible, stories, url)
  --date JJ/MM/AAAA  date d'extraction affichée

Effets (idempotents : la section entre marqueurs est remplacée à chaque passage) :
  1. story document existant rattaché à une story Notion (même ID, ou lot d'une story) :
     section fonctionnelle insérée en tête, juste sous le titre ;
  2. story Notion sans story document : création de story-<ID>.md (section fonctionnelle +
     traces trouvées dans le dépôt) ;
  3. story document sans story Notion : bloc court qui le signale ;
  4. index _bmad-output/implementation-artifacts/INDEX-stories-notion.md.
"""
import argparse
import json
import os
import re
import sys

BEGIN = "<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->"
END = "<!-- notion-functional:end -->"
MARK_RE = re.compile(r"<!-- notion-functional:begin.*?-->.*?<!-- notion-functional:end -->\n*", re.S)
ART = "_bmad-output/implementation-artifacts"
TRACE_DIRS = ["_bmad-output", "docs", "src", "supabase", "tests", "openapi", "quality", "SPRINT_HANDOFF.md"]
TRACE_EXT = (".md", ".ts", ".tsx", ".sql", ".yaml", ".yml", ".json", ".js", ".mjs")


def load_stories(d):
    stories = {}
    for name in sorted(os.listdir(d)):
        if not name.endswith(".md"):
            continue
        with open(os.path.join(d, name), encoding="utf-8") as fh:
            first = fh.readline()
            body = fh.read().strip("\n")
        m = re.match(r"<!-- props: (\{.*\}) -->", first.strip())
        if not m:
            sys.exit("props manquantes : " + name)
        props = json.loads(m.group(1))
        sid = name[:-3].replace("_", "/") if name.startswith("BCP-5_6") else name[:-3]
        if sid == "NOID":
            continue  # page vide du Sprint Board, sans ID ni contenu
        props["ID"] = sid
        stories[sid] = {"props": props, "body": body}
    return stories


def load_tf(path):
    rows = []
    with open(path, encoding="utf-8") as fh:
        header = fh.readline().rstrip("\n").split("\t")
        for line in fh:
            vals = line.rstrip("\n").split("\t")
            if len(vals) != len(header):
                continue
            r = dict(zip(header, vals))
            r["ids"] = [s.strip() for s in re.split(r"[,;]", r["stories"]) if s.strip()]
            rows.append(r)
    return rows


def norm(sid):
    return re.sub(r"[._-]", ".", sid).lower()


def repo_story_id(path):
    """ID d'un story document : champ id du frontmatter, sinon nom de fichier."""
    with open(path, encoding="utf-8") as fh:
        txt = fh.read()
    m = re.match(r"---\n(.*?)\n---\n", txt, re.S)
    if m:
        mm = re.search(r"^id:\s*(.+)$", m.group(1), re.M)
        if mm:
            return mm.group(1).strip().strip("'\""), txt
    return os.path.basename(path)[len("story-"):-3], txt


def parent_candidates(sid):
    """E10.18e-1 -> E10.18e-1, E10.18e, E10.18 ; E10.10a -> E10.10a, E10.10."""
    out = [sid]
    cur = sid
    while True:
        nxt = re.sub(r"(-\d+|[a-z])$", "", cur)
        if nxt == cur:
            break
        out.append(nxt)
        cur = nxt
    return out


def match_notion(repo_id, filename_id, stories_by_norm):
    for cand_src in (repo_id, filename_id):
        for i, cand in enumerate(parent_candidates(cand_src)):
            hit = stories_by_norm.get(norm(cand))
            if hit:
                return hit, i > 0
        # nom de fichier du type E10-9-remises-granulaires : tenter les préfixes
        parts = re.split(r"-", cand_src)
        for k in range(len(parts), 0, -1):
            hit = stories_by_norm.get(norm("-".join(parts[:k])))
            if hit:
                return hit, False
    return None, False


def cell(v):
    if v is None or v == "" or v == []:
        return "—"
    if isinstance(v, list):
        v = ", ".join(str(x) for x in v)
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).replace("|", "\\|").replace("\n", " ")


def fmt_date(iso):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", iso or "")
    return "%s/%s/%s" % (m.group(3), m.group(2), m.group(1)) if m else None


def tf_table(tf_rows, ids):
    wanted = {norm(i) for i in ids}
    hits = [r for r in tf_rows if any(norm(x) in wanted for x in r["ids"])]
    if not hits:
        return "_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._"
    lines = ["| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |", "|---|---|---|---|---|---|---|"]
    for r in sorted(hits, key=lambda r: int(r["tf_id"])):
        lines.append("| [TF-%s](%s) | %s | %s | %s | %s | %s | %s |" % (
            r["tf_id"], r["url"], cell(r["titre"]), cell(r["statut"]), cell(r["priorite"]),
            cell(r["parcours"]), cell(r["cible"]), cell(r["stories"])))
    return "\n".join(lines)


def functional_section(st, tf_rows, date, lot_of=None, tf_ids=None):
    p = st["props"]
    edited = fmt_date(p.get("last_edited"))
    src = "> **Source qui fait foi : Notion** — [%s](%s) · extrait le %s%s." % (
        cell(p.get("Story")), p["url"], date, (" · page modifiée le %s" % edited) if edited else "")
    out = [BEGIN, "## Périmètre fonctionnel — story Notion", "", src,
           "> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. "
           "En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas."]
    if lot_of:
        out.append("> Ce story document est un **lot** de la story Notion **%s** : le périmètre ci-dessous est celui de la story entière ; "
                   "la part propre à ce lot est décrite dans la partie implémentation." % lot_of)
    out += ["", "| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |",
            "|---|---|---|---|---|---|---|---|---|",
            "| %s |" % " | ".join(cell(p.get(k)) for k in ["Epic", "Sprint", "Priorité", "Effort", "Statut", "Assigné à", "Offre", "Source", "Ordre"]),
            "", "### Description fonctionnelle (Notion)", "", st["body"], "",
            "### Cas de test fonctionnels rattachés (Notion)", "", tf_table(tf_rows, tf_ids or [p["ID"]]), "", "---", "", "_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._", END, ""]
    return "\n".join(out)


def orphan_section(sid, tf_rows):
    return "\n".join([BEGIN, "## Périmètre fonctionnel — story Notion", "",
                      "> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt "
                      "(refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. "
                      "Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.",
                      "", "### Cas de test fonctionnels rattachés (Notion)", "", tf_table(tf_rows, [sid]), "", "---", "", "_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._", END, ""])


def insert_section(txt, section):
    txt = MARK_RE.sub("", txt)
    pos = 0
    m = re.match(r"---\n.*?\n---\n", txt, re.S)
    if m:
        pos = m.end()
    rest = txt[pos:]
    h = re.match(r"(\s*# [^\n]*\n)", rest)
    if h:
        pos += h.end()
    head, tail = txt[:pos], txt[pos:].lstrip("\n")
    sep = "\n" if head and not head.endswith("\n\n") else ""
    return head + sep + section + "\n" + tail


_CORPUS = None


def corpus(repo):
    """Charge une seule fois les fichiers texte où chercher les traces."""
    global _CORPUS
    if _CORPUS is None:
        _CORPUS = []
        for base in TRACE_DIRS:
            root = os.path.join(repo, base)
            paths = [root] if os.path.isfile(root) else []
            if os.path.isdir(root):
                for dp, dns, fns in os.walk(root):
                    dns[:] = [d for d in dns if d not in ("node_modules", ".git")]
                    paths += [os.path.join(dp, f) for f in fns if f.endswith(TRACE_EXT)]
            for fp in paths:
                try:
                    with open(fp, encoding="utf-8") as fh:
                        txt = fh.read()
                except (UnicodeDecodeError, OSError):
                    continue
                rel = os.path.relpath(fp, repo)
                # les copies Notion ne sont pas des traces d'implémentation
                if rel.endswith("INDEX-stories-notion.md") or re.match(r"---\n(?:.*\n)*?source: notion\n(?:.*\n)*?---\n", txt):
                    continue
                _CORPUS.append((rel, MARK_RE.sub("", txt)))
    return _CORPUS


def traces(repo, sid):
    toks = [re.escape(t) for t in re.split(r"[._/-]", sid) if t]
    pat = re.compile(r"(?<![0-9A-Za-z])" + r"[._-]".join(toks) + r"(?![0-9A-Za-z])", re.I)
    own = "story-%s.md" % sid.replace("/", "_")
    found = set()
    for rel, txt in corpus(repo):
        if rel.endswith("INDEX-stories-notion.md") or rel.endswith("/" + own):
            continue
        if pat.search(os.path.basename(rel)) or pat.search(txt):
            found.add(rel)
    return sorted(found)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--stories", required=True)
    ap.add_argument("--tf", required=True)
    ap.add_argument("--date", required=True)
    a = ap.parse_args()

    stories = load_stories(a.stories)
    tf_rows = load_tf(a.tf)
    by_norm = {norm(k): v for k, v in stories.items()}
    art = os.path.join(a.repo, ART)
    linked = {k: [] for k in stories}
    report = {"enrichis": 0, "lots": 0, "sans_notion": 0, "crees_ou_regeneres": 0}

    entries = []
    for name in sorted(os.listdir(art)):
        if not (name.startswith("story-") and name.endswith(".md")):
            continue
        path = os.path.join(art, name)
        rid, txt = repo_story_id(path)
        created = bool(re.match(r"---\n(?:.*\n)*?source: notion\n(?:.*\n)*?---\n", txt))
        st, is_lot = match_notion(rid, name[len("story-"):-3], by_norm)
        entries.append((name, path, rid, txt, st, is_lot, created))
        if st and not created:
            linked[st["props"]["ID"]].append((name, rid, is_lot))

    for (name, path, rid, txt, st, is_lot, created) in entries:
        if created:
            continue  # régénéré en entier plus bas
        if st:
            nid = st["props"]["ID"]
            sec = functional_section(st, tf_rows, a.date, lot_of=nid if is_lot else None,
                                     tf_ids=[rid, nid] if is_lot else [nid])
            report["lots" if is_lot else "enrichis"] += 1
        else:
            sec = orphan_section(rid, tf_rows)
            report["sans_notion"] += 1
        new = insert_section(txt, sec)
        if new != txt:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(new)

    for nid, st in stories.items():
        exact = [x for x in linked[nid] if not x[2]]
        if exact:
            continue
        fname = "story-%s.md" % nid.replace("/", "_")
        path = os.path.join(art, fname)
        lots = linked[nid]
        p = st["props"]
        sub_tf = [nid] + [rid for (_, rid, _) in lots]
        sec = functional_section(st, tf_rows, a.date, tf_ids=sub_tf)
        impl = ["## Implémentation — état constaté dans le dépôt", "",
                "> Aucun story document d'implémentation propre à cette story n'existait au %s. Cette partie recense ce que le dépôt en contient ; "
                "elle est à compléter par l'agent `dev-story` lorsque la story est développée." % a.date, ""]
        if lots:
            impl += ["### Lots développés sous leur propre story document", ""]
            impl += ["- [%s](%s)" % (rid, n) for (n, rid, _) in sorted(lots)]
            impl.append("")
        tr = traces(a.repo, nid)
        impl += ["### Fichiers du dépôt qui citent %s" % nid, ""]
        if tr:
            impl += ["- `%s`" % t for t in tr[:60]]
            if len(tr) > 60:
                impl.append("- … et %d autres fichiers" % (len(tr) - 60))
        else:
            impl.append("_Aucun fichier du dépôt ne cite cet identifiant._")
        fm = "---\nid: %s\nepic: %s\nsource: notion\nnotion_url: %s\n---\n" % (nid, cell(p.get("Epic")), p["url"])
        content = fm + "# %s\n\n" % cell(p.get("Story")) + sec + "\n" + "\n".join(impl) + "\n"
        if os.path.exists(path) and not any(e[0] == fname and e[6] for e in entries):
            sys.exit("collision de nom sur un fichier existant : " + fname)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)
        linked[nid].append((fname, nid, None))
        report["crees_ou_regeneres"] += 1

    idx = ["# Index — stories Notion ↔ story documents", "",
           "> Généré le %s par `scripts/notion/sync_story_functional.py` (règle : `docs/spec/STORY_DOCUMENT_STANDARD.md`). "
           "Source : base Notion « 📋 Backlog Magrit — Sprint Board ». Ne pas modifier à la main." % a.date, "",
           "| ID Notion | Story | Epic | Sprint | Statut Notion | Story documents |", "|---|---|---|---|---|---|"]
    for nid in sorted(stories, key=lambda s: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", s)]):
        p = stories[nid]["props"]
        docs = []
        for (n, rid, lot) in sorted(linked[nid]):
            tag = " (créé depuis Notion)" if lot is None else (" (lot)" if lot else "")
            docs.append("[%s](%s)%s" % (n[len("story-"):-3], n, tag))
        idx.append("| [%s](%s) | %s | %s | %s | %s | %s |" % (nid, p["url"], cell(p.get("Story")), cell(p.get("Epic")),
                                                        cell(p.get("Sprint")), cell(p.get("Statut")), "<br>".join(docs)))
    with open(os.path.join(art, "INDEX-stories-notion.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(idx) + "\n")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
