#!/usr/bin/env python3
"""
Compilateur PIM Exaprint — JSON (4 pôles) → 2 migrations SQL.

Entrées : pole1_imprimes.json, pole2_papeterie.json, pole3_grandformat.json, pole4_packaging.json
Sorties :
  - 20260710000100_exaprint_gammes.sql       (renumérotation + nouvelles gammes)
  - 20260710000200_exaprint_definitions.sql  (définitions complètes + enrichissements)

Le mapping display_order + matching_rules est CENTRAL (ici), pas dans les JSON,
pour garantir la cohérence de l'arbre (ADR-4.17 : le gamme_slug explicite prime ;
matching_rules {} = gamme atteignable uniquement par slug explicite).
"""
import json, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
REPO = "/Users/arnaudmazon/Documents/Claude/BMAD/Magrit"

# ─── Arbre central : slug -> (parent, display_order, matching_rules|None=keep, rename|None) ───
# None matching_rules = gamme existante, on ne touche pas ses règles.
SN = lambda w, h, tol: {"kind": "leaflet", "size_near": {"tol": tol, "width": w, "height": h}}

TREE = {
    # ── existantes (renumérotation, rules conservées) ──
    "carterie":                 (None, 100, None, None),
    "carte_visite_standard":    ("carterie", 101, None, None),
    "carte_visite_horizontale": ("carterie", 102, None, None),
    "carte_visite_carree":      ("carterie", 103, None, None),
    "carte_correspondance":     ("carterie", 104, None, None),
    "carte_voeux":              ("carterie", 105, None, None),
    "flyer":                    (None, 120, None, None),
    "flyer_a6":                 ("flyer", 122, None, None),
    "flyer_a5":                 ("flyer", 123, None, None),
    "flyer_dl":                 ("flyer", 124, None, None),
    "flyer_a4":                 ("flyer", 125, None, None),
    "depliant":                 (None, 140, None, None),
    "depliant_plie_dl":         ("depliant", 141, None, None),
    "brochure":                 (None, 160, None, None),
    "brochure_piquee":          ("brochure", 161, None, None),
    "brochure_dos_carre":       ("brochure", 162, None, None),
    "brochure_spirale":         ("brochure", 163, None, None),
    "brochure_cousue":          ("brochure", 164, None, None),
    "affiche":                  (None, 180, None, None),
    "affiche_a3":               ("affiche", 181, None, None),
    "affiche_a2":               ("affiche", 182, None, None),
    "affiche_a1":               ("affiche", 184, None, None),
    "affiche_a0":               ("affiche", 185, None, None),
    "kakemono":                 (None, 200, None, None),
    "roll_up_80x200":           ("kakemono", 201, None, None),
    "banderole":                (None, 240, None, "Banderoles / Bâches"),
    "etiquette":                (None, 320, None, None),
    "packaging":                (None, 400, None, None),
    # ── nouvelles ──
    "carte_postale":            ("carterie", 106, {}, None),
    "carton_invitation":        ("carterie", 107, {}, None),
    "flyer_a7":                 ("flyer", 121, SN(74, 105, 3), None),
    "flyer_carre":              ("flyer", 126, SN(148, 148, 5), None),
    "depliant_2_volets":        ("depliant", 142, {}, None),
    "depliant_accordeon":       ("depliant", 143, {}, None),
    "affiche_40x60":            ("affiche", 183, SN(400, 600, 10), None),
    "affiche_abribus":          ("affiche", 186, SN(1200, 1760, 20), None),
    "affiche_dos_bleu":         ("affiche", 187, {}, None),
    "roll_up_100x200":          ("kakemono", 202, SN(1000, 2000, 50), None),
    "roll_up_120x200":          ("kakemono", 203, SN(1200, 2000, 50), None),
    "x_banner":                 ("kakemono", 204, {}, None),
    "drapeau":                  (None, 220, {"kind": ["drapeau", "beach flag", "beachflag", "oriflamme", "voile", "flag"]}, None),
    "beach_flag":               ("drapeau", 221, {}, None),
    "drapeau_mat":              ("drapeau", 222, {}, None),
    "bache_pvc":                ("banderole", 241, {}, None),
    "banderole_microperforee":  ("banderole", 242, {}, None),
    "banderole_textile":        ("banderole", 243, {}, None),
    "panneau":                  (None, 260, {"kind": ["panneau", "dibond", "forex", "akylux", "akilux", "plexi", "plexiglass", "alu composite", "pvc expanse"]}, None),
    "panneau_akylux":           ("panneau", 261, {}, None),
    "panneau_dibond":           ("panneau", 262, {}, None),
    "panneau_forex":            ("panneau", 263, {}, None),
    "panneau_plexi":            ("panneau", 264, {}, None),
    "adhesif":                  (None, 280, {"kind": ["adhesif", "vinyle", "vitrophanie", "covering", "autocollant vitrine", "sticker vitrine"]}, None),
    "vitrophanie":              ("adhesif", 281, {}, None),
    "adhesif_sol":              ("adhesif", 282, {}, None),
    "plv":                      (None, 300, {"kind": ["plv", "presentoir", "totem", "display", "stop-trottoir", "chevalet", "stand", "comptoir", "photocall"]}, None),
    "presentoir_comptoir":      ("plv", 301, {}, None),
    "totem_carton":             ("plv", 302, {}, None),
    "stop_trottoir":            ("plv", 303, {}, None),
    "stand_parapluie":          ("plv", 304, {}, None),
    "etiquette_planche":        ("etiquette", 321, {}, None),
    "etiquette_rouleau":        ("etiquette", 322, {}, None),
    "sticker_forme":            ("etiquette", 323, {}, None),
    "papeterie":                (None, 340, {"kind": ["papeterie", "tete de lettre", "en-tete", "enveloppe", "chemise", "bloc-notes", "bloc notes", "carnet", "autocopiant", "sous-main", "marque-page"]}, None),
    "tete_lettre":              ("papeterie", 341, {}, None),
    "enveloppe":                ("papeterie", 342, {}, None),
    "chemise_rabats":           ("papeterie", 343, {}, None),
    "bloc_note":                ("papeterie", 344, {}, None),
    "carnet_autocopiant":       ("papeterie", 345, {}, None),
    "marque_page":              ("papeterie", 346, SN(50, 210, 3), None),
    "sous_main":                ("papeterie", 347, {}, None),
    "calendrier":               (None, 360, {"kind": ["calendrier", "almanach", "ephemeride"]}, None),
    "calendrier_souple":        ("calendrier", 361, {}, None),
    "calendrier_spirale":       ("calendrier", 362, {}, None),
    "calendrier_bancaire":      ("calendrier", 363, {}, None),
    "restauration":             (None, 380, {"kind": ["menu", "carte des vins", "set de table", "restauration"]}, None),
    "menu":                     ("restauration", 381, {}, None),
    "set_de_table":             ("restauration", 382, {}, None),
    "boite_pliante":            ("packaging", 401, {}, None),
    "boite_expedition":         ("packaging", 402, {}, None),
    "coffret_premium":          ("packaging", 403, {}, None),
    "sac_papier":               ("packaging", 404, {}, None),
}

EXISTING = {s for s, (_, _, r, _) in TREE.items() if r is None}

def q(s):
    """Escape SQL literal."""
    return "'" + str(s).replace("'", "''") + "'"

def jb(obj):
    """jsonb literal."""
    return q(json.dumps(obj, ensure_ascii=False)) + "::jsonb"

def arr(items):
    """text[] literal."""
    if not items:
        return "null"
    return "array[" + ",".join(q(i) for i in items) + "]::text[]"

def load():
    data = {"gammes_completes": [], "enrichissements": []}
    for f in ["pole1_imprimes.json", "pole2_papeterie.json", "pole3_grandformat.json", "pole4_packaging.json"]:
        p = os.path.join(BASE, f)
        if not os.path.exists(p):
            print(f"MANQUANT: {f}", file=sys.stderr); sys.exit(1)
        with open(p) as fh:
            j = json.load(fh)
        data["gammes_completes"] += j.get("gammes_completes", [])
        data["enrichissements"] += j.get("enrichissements", [])
    return data

def main():
    data = load()
    by_slug = {g["slug"]: g for g in data["gammes_completes"]}

    # Validation : chaque gamme JSON doit être dans TREE, et chaque nouvelle gamme TREE doit avoir un JSON
    errors = []
    for slug in by_slug:
        if slug not in TREE:
            errors.append(f"JSON slug hors arbre: {slug}")
    for slug, (_p, _o, rules, _r) in TREE.items():
        if rules is not None and slug not in by_slug:
            errors.append(f"gamme nouvelle sans JSON: {slug}")
    # les 4 racines existantes sans définition doivent être couvertes en complet
    for slug in ["etiquette", "banderole", "kakemono", "packaging"]:
        if slug not in by_slug:
            errors.append(f"racine sans définition non couverte: {slug}")
    if errors:
        print("ERREURS:\n  " + "\n  ".join(errors), file=sys.stderr); sys.exit(2)

    # ─── Migration 1 : gammes ───
    lines = [
        "-- =============================================================================",
        "-- S-PIM-EXAPRINT-1 (2026-07-10) — Extension de l'arbre des gammes PIM",
        "-- Référentiel catalogue « cœur imprimeur » aligné sur les gammes du marché",
        "-- (réf. Exaprint/Vistaprint, ADR-4.17). 16 familles racines, 81 gammes.",
        "--",
        "-- Politique matching_rules (ADR-4.17) : le gamme_slug explicite PRIME toujours.",
        "-- Les nouvelles gammes ambiguës reçoivent {} (= jamais matchées par résolution",
        "-- dimensionnelle, atteignables uniquement par slug explicite) pour ne créer",
        "-- AUCUN faux positif sur les produits historiques.",
        "-- =============================================================================",
        "BEGIN;",
        "",
        "-- ─── Renumérotation des gammes existantes (plages par centaines) ───",
    ]
    for slug, (parent, order, rules, rename) in TREE.items():
        if rules is None:  # existante
            set_parts = [f"display_order = {order}"]
            if rename:
                set_parts.append(f"name = {q(rename)}")
            lines.append(f"UPDATE public.product_gammes SET {', '.join(set_parts)} WHERE slug = {q(slug)};")
    lines += ["", "-- ─── Nouvelles gammes ───"]
    for slug, (parent, order, rules, _rn) in TREE.items():
        if rules is None:
            continue
        g = by_slug[slug]
        parent_sql = q(parent) if parent else "null"
        lines.append(
            "INSERT INTO public.product_gammes (slug, name, parent_slug, display_order, matching_rules)\n"
            f"VALUES ({q(slug)}, {q(g['name'])}, {parent_sql}, {order}, {jb(rules)})\n"
            "ON CONFLICT (slug) DO UPDATE SET name = excluded.name, parent_slug = excluded.parent_slug,\n"
            "  display_order = excluded.display_order, matching_rules = excluded.matching_rules;"
        )
    lines += ["", "COMMIT;", "", "notify pgrst, 'reload schema';", ""]
    mig1 = "\n".join(lines)

    # ─── Migration 2 : définitions ───
    dl = [
        "-- =============================================================================",
        "-- S-PIM-EXAPRINT-2 (2026-07-10) — Définitions produit complètes (PIM)",
        "-- 1 définition complète par gamme (templates + SEO + marketing + technique),",
        "-- contenu FR original informé par l'étude du marché (réf. Exaprint).",
        "-- generated_by='hybrid', validated_by='pending' (curation Arnaud à suivre).",
        "-- Enrichissement des définitions existantes : uniquement les champs NULL",
        "-- (commercial_pitch, benefits, use_cases, seo_keywords, technical_spec).",
        "-- =============================================================================",
        "BEGIN;",
        "",
    ]
    for g in data["gammes_completes"]:
        d = g["definition"]
        dl.append(f"-- ─── {g['slug']} : {g['name']} ───")
        dl.append(
            "INSERT INTO public.product_definitions\n"
            "  (gamme_slug, variation_filter, locale, name, keywords,\n"
            "   title_template, short_description_template, description_template, h1_template,\n"
            "   seo_title, seo_description, seo_keywords, schema_org_type,\n"
            "   commercial_pitch, benefits, use_cases, usage_examples, faq, technical_spec,\n"
            "   generated_by, validated_by)\n"
            "VALUES (\n"
            f"  {q(g['slug'])}, '{{}}'::jsonb, 'fr', {q(d['name'])}, {arr(d.get('keywords'))},\n"
            f"  {q(d['title_template'])}, {q(d['short_description_template'])},\n"
            f"  {q(d['description_template'])}, {q(d['h1_template'])},\n"
            f"  {q(d['seo_title'])}, {q(d['seo_description'])}, {arr(d.get('seo_keywords'))}, 'Product',\n"
            f"  {q(d['commercial_pitch'])}, {jb(d.get('benefits', []))}, {jb(d.get('use_cases', []))},\n"
            f"  {jb(d.get('usage_examples', []))}, {jb(d.get('faq', []))}, {jb(d.get('technical_spec', {}))},\n"
            "  'hybrid', 'pending')\n"
            "ON CONFLICT (gamme_slug, variation_filter, locale) DO NOTHING;"
        )
        dl.append("")
    dl.append("-- ─── Enrichissement des définitions existantes (champs NULL uniquement) ───")
    for e in data["enrichissements"]:
        dl.append(
            "UPDATE public.product_definitions SET\n"
            f"  commercial_pitch = coalesce(commercial_pitch, {q(e['commercial_pitch'])}),\n"
            f"  benefits         = coalesce(benefits, {jb(e.get('benefits', []))}),\n"
            f"  use_cases        = coalesce(use_cases, {jb(e.get('use_cases', []))}),\n"
            f"  seo_keywords     = coalesce(seo_keywords, {arr(e.get('seo_keywords'))}),\n"
            f"  technical_spec   = coalesce(technical_spec, {jb(e.get('technical_spec', {}))})\n"
            f"WHERE gamme_slug = {q(e['slug'])} AND locale = 'fr';"
        )
        dl.append("")
    dl += ["COMMIT;", "", "notify pgrst, 'reload schema';", ""]
    mig2 = "\n".join(dl)

    out1 = os.path.join(REPO, "supabase/migrations/20260710000100_exaprint_gammes.sql")
    out2 = os.path.join(REPO, "supabase/migrations/20260710000200_exaprint_definitions.sql")
    with open(out1, "w") as f:
        f.write(mig1)
    with open(out2, "w") as f:
        f.write(mig2)
    n_new = sum(1 for s, (_, _, r, _) in TREE.items() if r is not None)
    print(f"OK — gammes: {len(TREE)} total ({n_new} nouvelles) ; définitions complètes: {len(data['gammes_completes'])} ; enrichissements: {len(data['enrichissements'])}")
    print(f"  -> {out1}\n  -> {out2}")

if __name__ == "__main__":
    main()
