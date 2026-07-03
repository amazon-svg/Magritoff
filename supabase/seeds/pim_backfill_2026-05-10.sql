-- Backfill product_definitions via pim-generate (S-FIX-DATA-1)
-- Genere automatiquement le 2026-05-10 — re-runnable via ON CONFLICT

begin;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'carterie', '{}'::jsonb, 'fr',
  'Cartes et dépliants imprimés FSC - Carterie professionnelle',
  ARRAY['carte imprimée','dépliant carterie','carte de visite','flyer plié','impression quadrichromie','papier FSC','pelliculage mat','carterie professionnelle','impression écologique','petit format imprimé']::text[],
  '{{format}} imprimé {{grammage}}g/m² - {{papier}} {{finition}} | Carterie professionnelle FSC',
  '{{format}} imprimé en {{papier}} {{grammage}}g/m² avec finition {{finition}}. Production {{quantite}} exemplaires, certifiés FSC. Qualité quadrichromie.',
  '# Cartes et dépliants imprimés professionnels en {{format}}

Nos **cartes et dépliants {{format}}** en {{papier}} {{grammage}}g/m² conjuguent excellence technique et responsabilité environnementale. Imprimés en **quadrichromie (CMJN)** pour des couleurs éclatantes, ils bénéficient d''une finition {{finition}} qui garantit durabilité et prestige. Chaque exemplaire est produit selon les standards de qualité web-to-print, avec un rendu fidèle à vos fichiers.

## Caractéristiques techniques

- **Format** : {{format}} (conforme aux standards carterie)
- **Papier** : {{papier}} certifié FSC
- **Grammage** : {{grammage}}g/m² (résistance et toucher optimal)
- **Impression** : Quadrichromie haute définition
- **Finition** : {{finition}} (protection et esthétique)
- **Quantité** : À partir de {{quantite}} exemplaires

## Avantages de cette offre

**Qualité professionnelle** : Impression nette, couleurs fidèles et rendu haut de gamme grâce à la quadrichromie.

**Engouement écologique** : Papier FSC certifié, démarche durable sans compromis sur la qualité.

**Flexibilité de production** : Commandes de faibles à grandes quantités, délais optimisés en fonction de vos besoins.

**Finitions valorisantes** : Pelliculage {{finition}} pour une protection longue durée et un toucher premium.',
  'Cartes et dépliants {{format}} en {{papier}} FSC - Impression {{grammage}}g/m² quadrichromie',
  'Cartes {{format}} imprimées FSC - Quadrichromie {{grammage}}g',
  'Cartes {{format}} imprimées en quadrichromie sur papier {{papier}} FSC {{grammage}}g/m². Finition {{finition}}. Production dès {{quantite}} ex. Qualité & écologie.',
  'Product',
  '[{"title": "Cartes de visite et de présentation", "description": "Cartes de visite professionnelles au format 85×55 mm ou carte de présentation A6, imprimées en quadrichromie sur papier couché FSC. La finition pelliculée assure robustesse et prestige lors des échanges commerciaux."}, {"title": "Dépliants et flyers pliés", "description": "Dépliants A4 plié en trois ou flyers format réduit, idéaux pour campagnes commerciales, événements ou documentation produit. L''impression recto-verso en quadrichromie offre un véritable support marketing."}, {"title": "Invitations et faire-part", "description": "Cartes d''invitation, faire-part ou annonces événementielles sur papier de qualité supérieure. La finition pelliculage soft-touch crée une expérience tactile premium, parfaite pour événements haut de gamme."}]'::jsonb,
  '[{"question": "Quels formats et tailles sont disponibles pour la carterie ?", "answer": "Nous proposons l''ensemble des formats standards : cartes de visite (85×55 mm), A6 (105×148 mm), A5 (148×210 mm), A4 plié (210×297 mm), ainsi que formats personnalisés jusqu''à 150 mm de dimension maximale conforme aux règles web-to-print. Consultez nos tarifs spécifiques pour chaque format."}, {"question": "Quel papier recommandez-vous pour les cartes imprimées ?", "answer": "Pour une carterie professionnelle, nous recommandons un papier couché FSC à partir de 250g/m² (cartes de visite) ou 300g/m² (dépliants), garantissant rigidité et toucher premium. Le papier offset est idéal pour une approche plus écologique et naturelle. Tous nos papiers sont certifiés FSC ou PEFC."}, {"question": "Qu''apporte la finition pelliculage à mes cartes ?", "answer": "Le pelliculage (mat, brillant ou soft-touch) protège votre impression contre l''humidité et l''usure, prolonge la durée de vie des cartes et améliore le rendu esthétique. Le mat offre une finition sobre et élégante, le brillant amplifie les couleurs, et le soft-touch procure une sensation tactile haut de gamme."}, {"question": "Puis-je imprimer des cartes en recto uniquement ou dois-je faire du recto-verso ?", "answer": "Vous avez le choix : impression recto seul pour cartes simples, ou recto-verso pour maximiser l''espace de communication. Le recto-verso est particulièrement adapté aux dépliants, faire-part et cartes de présentation premium. Nos tarifs s''ajustent selon votre choix d''impression."}, {"question": "Quelles sont les quantités minimales pour une commande de carterie ?", "answer": "Les quantités minimales dépendent du format et de la finition choisie. En règle générale, à partir de 250 à 500 exemplaires pour des cartes de visite, ou 100 à 250 pour des formats plus grands. Consultez directement le configurateur ou notre équipe pour votre cas spécifique."}, {"question": "Vos papiers sont-ils vraiment écologiques et certifiés ?", "answer": "Oui. Tous nos papiers carterie sont certifiés FSC ou PEFC, garantissant une gestion durable des forêts. Cette certification s''ajoute à notre engagement de production responsable, sans compromis sur la qualité d''impression ou la durabilité du produit fini."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'carte_visite_standard', '{}'::jsonb, 'fr',
  'Carte de visite standard - Définition produit',
  ARRAY['carte de visite','carte de visite standard','85x55mm','impression quadrichromie','carte visite professionnelle','carte de visite personnalisée','impression carte visite','carte visite papier couché','carte visite offset','pelliculage mat','pelliculage brillant','FSC','PEFC','impression recto verso','carte visite eco-responsable']::text[],
  'Carte de visite {{format}} {{grammage}}g - {{papier}} {{finition}} | Impression {{quantite}} ex.',
  'Carte de visite standard {{format}} en {{papier}} {{grammage}}g avec impression {{finition}}. Qualité professionnelle, livraison rapide.',
  '## Votre carte de visite professionnelle en {{format}} {{grammage}}g

Imprimée en **quadrichromie haute définition** sur papier {{papier}} {{grammage}}g, votre carte de visite {{format}} combine élégance et durabilité. Le format **85 × 55 mm** (dimensions ISO) est le standard incontournable pour tous les secteurs professionnels. Avec une finition {{finition}}, vos cartes offrent une présentation impeccable et une prise en main agréable.

## Caractéristiques techniques

- **Format** : {{format}} (85 × 55 mm)
- **Grammage** : {{grammage}}g/m² – robustesse et prestige garantis
- **Papier** : {{papier}} – texture et rendu optimisés
- **Impression** : Recto verso en quadrichromie CMJN
- **Finition** : {{finition}} – protection et esthétique
- **Quantité** : {{quantite}} exemplaires

## Certification écologique

Nous proposons des papiers certifiés **FSC** ou **PEFC** pour vos projets éco-responsables, répondant à vos engagements de développement durable sans compromis sur la qualité.

## Idéale pour tous les usages

Que vous soyez entrepreneur, consultant, artisan ou agent commercial, la carte de visite {{format}} reste votre meilleur outil de networking. Facilement transportable, elle crée une première impression durable lors de vos rencontres professionnelles.',
  'Carte de visite {{format}} en {{papier}} {{grammage}}g | Impression professionnelle {{finition}}',
  'Carte de visite 85x55mm {{papier}} | Impression qualité',
  'Carte de visite standard 85x55mm en {{papier}} {{grammage}}g. Impression quadrichromie, finition {{finition}}. Commandez dès maintenant.',
  'Product',
  '[{"title": "Représentant commercial", "description": "Distribuez vos cartes de visite lors de salons professionnels et prospection terrain. Le format standard 85×55 mm s''adapte parfaitement aux portefeuilles et aux porte-cartes de vos clients."}, {"title": "Consultant indépendant", "description": "Laissez une trace professionnelle après chaque réunion. La qualité d''impression en quadrichromie sur papier couché valorise votre image et vos coordonnées."}, {"title": "Artisan et petite entreprise", "description": "Promotionnez votre savoir-faire avec une carte de visite soignée. Idéale pour les chantiers, les livraisons et les recommandations client-à-client."}, {"title": "Secteur médical et bien-être", "description": "Praticiens, thérapeutes et professionnels de santé utilisent la carte de visite standard pour faciliter les prises de rendez-vous et construire une clientèle de confiance."}, {"title": "Networking et événements", "description": "Échanges de contact efficaces lors de conférences, formations et événements professionnels. Le format compact se glisse facilement dans une poche ou un sac."}]'::jsonb,
  '[{"question": "Quel est le format exact d''une carte de visite standard ?", "answer": "Le format standard international est de 85 × 55 mm. C''est la dimension la plus courante qui convient à tous les portefeuilles et porte-cartes standard. Nous proposons également des formats carrés (90 × 90 mm) ou allongés selon vos besoins."}, {"question": "Quelle est la différence entre un papier couché et un papier offset ?", "answer": "Le papier couché offre une surface brillante ou mate, idéale pour l''impression quadrichromie haute définition avec des couleurs éclatantes. Le papier offset présente une texture plus naturelle et offre une sensation premium. Le choix dépend de votre identité visuelle."}, {"question": "Que signifie ''impression recto verso'' ?", "answer": "L''impression recto verso signifie que votre carte est imprimée des deux côtés. C''est le format standard qui maximise l''utilité de votre support : logo et coordonnées d''un côté, détails ou message personnalisé de l''autre."}, {"question": "Qu''est-ce que la finition pelliculage mat ou brillant ?", "answer": "Le pelliculage mat offre un rendu sobre et anti-reflets, idéal pour une image premium. Le pelliculage brillant donne des couleurs plus vives et éclatantes. Le pelliculage soft-touch procure une sensation veloutée et haut de gamme. Tous trois protègent votre impression contre l''usure."}, {"question": "Quelle quantité minimale puis-je commander ?", "answer": "Les quantités minimales varient selon vos options de personnalisation. Consultez notre configurateur ou contactez notre équipe pour connaître les quantités disponibles et les tarifs dégressifs applicables."}, {"question": "Quel grammage choisir pour une carte de visite ?", "answer": "Les grammages recommandés sont 300g/m² (standard robuste) ou 350g/m² (premium). Plus le grammage est élevé, plus la carte est rigide et durable. Pour un rendu haut de gamme, privilégiez 350g/m²."}, {"question": "Vos papiers sont-ils certifiés écologiques ?", "answer": "Oui, nous proposons des papiers certifiés FSC (Forest Stewardship Council) ou PEFC (Programme for the Endorsement of Forest Certification). Ces certifications garantissent une gestion responsable des forêts et un engagement écologique."}, {"question": "Quel est le délai de livraison pour une commande de cartes de visite ?", "answer": "Les délais varient selon la quantité et les options choisies. Contactez-nous pour un devis précis. Nous proposons des options standard et express pour répondre à vos urgences."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'carte_visite_horizontale', '{}'::jsonb, 'fr',
  'Carte de visite horizontale',
  ARRAY['carte de visite horizontale','carte de visite 90x54','carte de visite paysage','carte de visite professionnelle','impression carte de visite','carte de visite quadrichromie','carte de visite pelliculée','carte de visite FSC','carte de visite PEFC','carte de visite papier couché','impression web-to-print']::text[],
  'Carte de visite horizontale {{quantite}} ex. - Format {{format}} - Papier {{papier}} {{grammage}}g/m² - {{finition}}',
  'Carte de visite horizontale {{format}} en {{papier}} {{grammage}}g/m². Impression quadrichromie {{finition}}. Parfait pour les professionnels qui veulent marquer les esprits.',
  '# Carte de visite horizontale : le format paysage professionnel par excellence

Votre carte de visite est votre ambassadeur. Optez pour le format horizontal {{format}} (90 × 54 mm) et démarquez-vous avec une présentation paysage moderne et généreuse. Ce format offre plus d''espace pour votre logo, vos coordonnées et votre message, tout en restant dans les dimensions standardisées reconnues mondialement.

## Caractéristiques techniques

Notre gamme de cartes de visite horizontales {{quantite}} exemplaires vous propose :
- **Format** : {{format}} (90 × 54 mm) - format paysage optimal
- **Papier** : {{papier}} {{grammage}}g/m² - qualité professionnelle garantie
- **Impression** : Quadrichromie CMJN recto et verso pour des couleurs éclatantes
- **Finition** : {{finition}} - protection et effet premium
- **Certifications** : Papiers FSC et PEFC disponibles pour une démarche éco-responsable

## Avantages du format horizontal

Le format paysage crée une impression de modernité et de professionnalisme. Il s''insère parfaitement dans un portefeuille ou une pochette tout en maximisant la lisibilité de vos informations. Que vous soyez consultant, créatif, entrepreneur ou représentant commercial, ce format valorise votre image et facilite le mémorisation lors d''échanges professionnels.

## Finitions et papiers variés

Personnalisez votre carte avec nos options de {{finition}} : pelliculage mat pour un effet sobre et élégant, pelliculage brillant pour une brillance maximale, ou soft-touch pour un toucher velouté incomparable. Disponible en papier couché ou offset, chaque option renforce l''identité de votre marque.',
  'Carte de visite horizontale {{format}} {{grammage}}g/m² - Impression {{finition}}',
  'Carte visite horizontale 90x54 | Impression quadrichromie',
  'Carte de visite horizontale format 90x54mm en papier couché/offset. Impression quadrichromie, finitions pelliculage. FSC/PEFC. Commande en ligne.',
  'Product',
  '[{"title": "Représentants commerciaux et consultants", "description": "Le format horizontal offre plus d''espace pour afficher vos domaines de compétence, votre certification ou un message clé. Les finitions brillantes ou soft-touch captent l''attention lors de vos rendez-vous professionnels."}, {"title": "Agences créatives et studios de design", "description": "Un format paysage parfait pour mettre en avant votre créativité. Utilisez l''espace généreux pour des visuels percutants, des couleurs CMJN saturées et des finitions premium (pelliculage brillant, soft-touch)."}, {"title": "Entrepreneurs et startups", "description": "Imposez votre marque avec un format moderne et différenciant. La carte horizontale se souvient mieux qu''une classique et s''intègre harmonieusement dans les pochettes d''événements networking et salons professionnels."}, {"title": "Secteur hôtellerie, restauration et événements", "description": "Transmettez vos coordonnées avec style. Le format paysage et les finitions mat ou soft-touch renforcent l''image premium de votre établissement."}]'::jsonb,
  '[{"question": "Quelles sont les dimensions exactes de la carte de visite horizontale ?", "answer": "Le format standard est de 90 × 54 mm, au format paysage. C''est une dimension reconnue internationalement, pratique pour les portefeuilles de cartes et les présentoirs."}, {"question": "Quel grammage de papier me conseille-vous ?", "answer": "Pour une carte de visite professionnelle, nous recommandons un grammage minimum de 250g/m² en papier couché. Pour plus de rigidité et de prestige, optez pour 300g/m² ou 350g/m². Le grammage influence l''épaisseur, la durabilité et la perception de qualité."}, {"question": "Quelle est la différence entre pelliculage mat et brillant ?", "answer": "Le pelliculage brillant crée une surface réfléchissante qui intensifie les couleurs et crée une impression de luxe. Le pelliculage mat offre un aspect discret et élégant, anti-reflet, avec un toucher doux. Le soft-touch combine les deux avec une texture veloutée premium."}, {"question": "Vos papiers sont-ils certifiés écologiquement ?", "answer": "Oui, nous proposons des papiers FSC (Forest Stewardship Council) et PEFC (Programme for the Endorsement of Forest Certification) pour vos cartes de visite horizontales. Ces certifications garantissent une gestion responsable des forêts."}, {"question": "Puis-je imprimer recto-verso en quadrichromie ?", "answer": "Absolument. Nous imprimons en quadrichromie CMJN sur le recto et le verso. Cela permet des designs couleur complets, des fonds colorés et des visuels percutants sur les deux côtés."}, {"question": "Quelles sont les quantités minimales de commande ?", "answer": "Nos quantités minimales varient selon vos options (papier, finition, certifications). Consultez notre catalogue pour connaître les tarifs dégressifs. En général, les petites tirages commencent à partir de 250 exemplaires."}, {"question": "Quel est le délai de livraison ?", "answer": "Les délais dépendent de la complexité et du volume de votre commande, ainsi que de la finition choisie. Comptez généralement 5 à 10 jours ouvrés après validation du bon à tirer. Des délais express sont disponibles sur demande."}, {"question": "Puis-je personnaliser complètement le design de ma carte ?", "answer": "Oui, vous téléchargez votre fichier PDF aux normes (CMJN, 300dpi, traits de coupe). Nos équipes vérifient la conformité et vous proposent un bon à tirer avant impression. Nous acceptons également les demandes de création graphique."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'carte_visite_carree', '{}'::jsonb, 'fr',
  'Carte de visite carrée - Définition gamme',
  ARRAY['carte de visite carrée','carte visite 55x55','carte de visite format carré','impression carte visite','carte visite personnalisée','carte visite professionnel','carte visite quadrichromie','carte visite pelliculée','carte visite FSC','carte visite PEFC','carte visite dos carré collé','web-to-print','imprimerie en ligne']::text[],
  'Carte de Visite Carrée {{format}} {{grammage}} - {{papier}} {{finition}}',
  'Carte de visite carrée {{format}} imprimée en {{papier}} {{grammage}} avec {{finition}}. Format original pour un impact professionnel maximal.',
  '## Votre Carte de Visite Carrée au Format {{format}}

Imprimée sur {{papier}} {{grammage}} en quadrichromie, votre carte de visite carrée offre une présentation originale et mémorable. Le format {{format}} crée une rupture visuelle avec les cartes standards et positionne votre identité comme moderne et réfléchie. Parfait pour les créatifs, les startups et les professionnels en quête de distinction.

## Caractéristiques Techniques

Vos cartes bénéficient d''une **impression haute définition CMJN** garantissant des couleurs éclatantes et des détails nets. Le papier {{papier}} {{grammage}} assure une rigidité optimale et une belle sensation tactile. La finition {{finition}} sublime vos designs avec un rendu respectueux de votre identité visuelle. Nous proposons également des finitions mat, brillant ou soft-touch selon votre préférence esthétique.

## Labels Écologiques et Durabilité

Nos papiers sont certifiés FSC ou PEFC, garantissant une gestion responsable des forêts. Chaque commande s''inscrit dans une démarche environnementale sans compromis sur la qualité.

## Flexibilité d''Impression

Qu''il s''agisse d''une première commande en {{quantite}} ou d''un renouvellement plus volumineux, nos tarifs dégressifs récompensent votre fidélité. Délai de livraison court et service client réactif incluent.',
  'Carte de Visite Carrée {{format}} en {{papier}} {{grammage}} - Impression Personnalisée en Ligne',
  'Carte Visite Carrée 55x55 | Impression Personnalisée',
  'Carte de visite carrée 55x55 imprimée en ligne. Papier de qualité, finitions au choix, certifications FSC/PEFC. Devis gratuit et livraison rapide.',
  'Product',
  '[{"title": "Artiste et créatif", "description": "Le format carré original de votre carte de visite devient une signature visuelle. Photographes, designers et illustrateurs l''apprécient pour son impact immédiat et sa différenciation en événements professionnels."}, {"title": "Startup et entrepreneur", "description": "Marquez les esprits lors de pitchs, conférences ou networking. Le format {{format}} traduit une approche novatrice et attentive aux détails, essentiels pour construire votre réputation dès le premier contact."}, {"title": "Agence de communication", "description": "Distribuez des cartes qui incarnent votre expertise créative. La qualité {{papier}} {{grammage}} et les finitions disponibles reflètent le professionnalisme de votre agence auprès de vos clients."}, {"title": "Commerce de luxe", "description": "Papier satiné, pelliculage soft-touch et dorure à chaud (sur devis) transforment votre carte en objet de prestige. Le carré intemporel renforce l''image haut de gamme de votre marque."}]'::jsonb,
  '[{"question": "Quel est le délai de livraison pour une commande de cartes de visite carrées ?", "answer": "Les cartes de visite carrées en quadrichromie sont livrées sous 5 à 7 jours ouvrables après validation du BAT. Des délais express (2-3 jours) sont disponibles sur demande, avec frais additionnels."}, {"question": "Le format 55×55 mm est-il vraiment carré ?", "answer": "Oui, le format 55×55 mm est parfaitement carré, contrairement aux cartes de visite standards rectangulaires (85×55 mm). Cette dimension offre une présentation originale et un excellent ratio pour les designs symétriques."}, {"question": "Quels papiers et grammages sont disponibles ?", "answer": "Nous proposons du papier couché brillant, mat et satiné en 250 g/m² (standard recommandé) ou 300 g/m² pour plus de rigidité. Papier offset naturel sur demande. Tous nos papiers sont certifiés FSC ou PEFC."}, {"question": "Puis-je ajouter une finition spéciale (pelliculage, vernis, dorure) ?", "answer": "Oui, nous proposons pelliculage mat ou brillant, vernis sélectif, et finitions soft-touch. La dorure et l''argenture sont disponibles sur devis. Ces finitions rehaussent l''aspect premium de votre carte et assurent sa durabilité."}, {"question": "Quel est le tirage minimum pour commander ?", "answer": "Le tirage minimum est de 250 exemplaires. Pour les petites quantités (50-100 cartes), consultez notre équipe pour une tarification spécifique ou une alternative (impression numérique)."}, {"question": "Comment importer mon fichier pour la carte de visite carrée ?", "answer": "Chargez votre PDF, PSD ou AI directement sur notre plateforme. Assurez-vous que votre document est au format 55×55 mm avec fond perdu de 3 mm (57×57 mm total). Une vérification automatique et un BAT numérique vous seront proposés avant impression."}, {"question": "Vos cartes de visite sont-elles écologiques ?", "answer": "Oui, tous nos papiers possèdent les certifications FSC ou PEFC, garantissant une gestion durable des forêts. Nous utilisons des encres respectueuses de l''environnement et optimisons nos émissions de transport et de déchet."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'carte_correspondance', '{}'::jsonb, 'fr',
  'Carte de correspondance personnalisée',
  ARRAY['carte de correspondance','carte postale personnalisée','carte 10x15 cm','impression quadrichromie','papier couché brillant','carte postale FSC','carte de visite luxe','impression offset','pelliculage mat','correspondance professionnelle']::text[],
  'Carte de correspondance {{format}} {{grammage}}g {{papier}} {{finition}} | Impression {{quantite}} ex',
  'Carte de correspondance {{format}} en {{papier}} {{grammage}}g avec finition {{finition}}. Impression nette en quadrichromie pour vos correspondances professionnelles.',
  '# Carte de correspondance haut de gamme

Notre carte de correspondance au format {{format}} (148 x 105 mm) est le support idéal pour valoriser votre identité visuelle lors de vos échanges professionnels. Imprimée en **quadrichromie (CMJN)** sur un papier {{papier}} de {{grammage}}g/m², elle combine élégance et robustesse. La finition {{finition}} offre une texture raffinée qui reflète le sérieux de votre entreprise.

Parfaitement adaptée aux correspondances, aux remerciements ou aux communications ponctuelles, cette carte bénéficie d''une **impression offset** garantissant une qualité d''image exceptionnelle. Disponible en quantités de {{quantite}} exemplaires, elle peut être certifiée **FSC ou PEFC** pour répondre à vos engagements écologiques. Le papier {{papier}} assure une excellente tenue en main et une résistance optimale.

Personnalisez chaque détail : choix du papier (couché brillant, couché mat ou offset naturel), option de pelliculage {{finition}} (brillant, mat ou soft-touch) pour une protection supplémentaire, et impression recto-verso possible. Conçue pour les professionnels exigeants, cette carte de correspondance transforme chaque envoi en opportunité de communication premium.',
  'Carte de correspondance {{format}} en {{papier}} {{grammage}}g - Impression quadrichromie {{finition}}',
  'Carte correspondance {{format}} | Impression qualité',
  'Carte de correspondance {{format}} en {{papier}} {{grammage}}g, impression quadrichromie, finition {{finition}}. Personnalisé à partir de {{quantite}} ex.',
  'Product',
  '[{"title": "Communication professionnelle B2B", "description": "Envoyez une carte de correspondance personnalisée avec votre logo et coordonnées pour accompagner vos devis, factures ou propositions commerciales. L''impression en quadrichromie garantit une restitution fidèle de vos couleurs."}, {"title": "Remerciements et courriers de prestige", "description": "Utilisez cette carte haut de gamme pour vos courriers de remerciement, félicitations ou invitations VIP. La finition pelliculée (mat ou brillant) renforce l''aspect premium et protège votre message."}, {"title": "Identité visuelle cohérente", "description": "Complétez votre identité avec des cartes de correspondance assorties à vos cartes de visite. Papier certifié FSC, même teinte, même finition pour une harmonie visuelle totale."}, {"title": "Correspondance administrative", "description": "Idéale pour les cabinets de conseil, agences ou institutions, cette carte signe vos courriers importants avec une touche d''excellence et de professionnalisme reconnaissable."}]'::jsonb,
  '[{"question": "Quel est le format exact de la carte de correspondance ?", "answer": "Le format standard est 148 x 105 mm (soit environ 10 x 15 cm), parfaitement dimensionné pour une enveloppe C6 ou un courrier plié. Ce format est conforme aux standards postaux internationaux."}, {"question": "Quels papiers sont disponibles pour cette carte ?", "answer": "Nous proposons du papier couché brillant (260-350 g/m²) pour un rendu lumineux, du papier couché mat (260-350 g/m²) pour un style épuré, et du papier offset (160-250 g/m²) pour un aspect naturel. Tous peuvent être certifiés FSC ou PEFC."}, {"question": "Puis-je avoir une impression recto-verso ?", "answer": "Oui, l''impression recto-verso est possible. Vous pouvez imprimer vos coordonnées au recto et un motif ou message au verso. Indiquez vos fichiers en CMJN pour une quadrichromie optimale."}, {"question": "Qu''est-ce que le pelliculage et est-ce recommandé ?", "answer": "Le pelliculage (mat, brillant ou soft-touch) est un vernis de protection appliqué en surface. Il améliore la durabilité, renforce l''aspect premium et protège l''impression. Très recommandé pour une carte de correspondance de prestige."}, {"question": "Quels délais de production pour {{quantite}} exemplaires ?", "answer": "Les délais varient selon la quantité et la complexité du projet : comptez 3-5 jours ouvrés pour une impression simple sans finition, 5-7 jours avec pelliculage. Un devis express est possible sur demande."}, {"question": "La carte est-elle écologique ?", "answer": "Oui, tous nos papiers peuvent être certifiés FSC (gestion responsable des forêts) ou PEFC (gestion durable). Demandez une certification lors de votre commande pour afficher un engagement environnemental."}, {"question": "Quelle quantité minimale puis-je commander ?", "answer": "Les quantités minimales dépendent de votre option d''impression. Généralement, comptez un minimum de 100 exemplaires pour une commande standard, avec possibilités de petits tirages à tarif dégréssif."}, {"question": "Comment préparer mon fichier pour l''impression ?", "answer": "Fournissez un fichier PDF haute résolution (300 dpi minimum) en mode CMJN (quadrichromie). Incluez un débord de 3 mm de chaque côté pour le massicotage. Nos équipes valident votre BAT avant production."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'carte_voeux', '{}'::jsonb, 'fr',
  'Carte de vœux pliée standard',
  ARRAY['carte de vœux pliée','carte de vœux personnalisée','carte de vœux imprimée','carte de voeux quadrichromie','carte pliée 148x210','carte de vœux FSC','carte de vœux entreprise','impression carte de vœux','carte de vœux pelliculée','carte de vœux dos carré collé']::text[],
  'Carte de vœux pliée {{format}} {{grammage}}g - {{papier}} - {{finition}}',
  'Carte de vœux pliée {{format}} en {{papier}} {{grammage}}g avec {{finition}}. Impression en quadrichromie recto-verso. De {{quantite}} exemplaires.',
  '## Votre carte de vœux pliée {{format}} en {{papier}} {{grammage}}g

Nos cartes de vœux pliées au format {{format}} allient élégance et professionnalisme. Imprimées en **quadrichromie haute définition** recto-verso, elles offrent une reproduction fidèle de vos visuels. Le {{papier}} {{grammage}}g garantit une belle tenue en main et une excellente rigidité, idéal pour des envois prestigieux. {{finition}} : un toucher premium et une protection optimale contre les rayures.

**Caractéristiques techniques :**
- Format fermé : {{format}} (148 × 210 mm)
- Papier : {{papier}} {{grammage}}g/m²
- Impression : Quadrichromie CMJN recto-verso
- Finition : {{finition}}
- Quantité minimale : à partir de {{quantite}} exemplaires
- Options : dos carré collé, pliage automatisé, adressage personnalisé

**Usages professionnels :**
Parfaite pour vos vœux de fin d''année, félicitations, remerciements ou événementiel corporate. Vos clients et partenaires apprécieront cette touche de distinction personnalisée.',
  'Carte de vœux pliée {{format}} en {{papier}} {{grammage}}g – Impression quadrichromie {{finition}}',
  'Carte de vœux pliée {{format}} {{papier}} {{grammage}}g',
  'Carte de vœux pliée {{format}} en {{papier}} {{grammage}}g. Quadrichromie, {{finition}}, dès {{quantite}} ex. Qualité professionnelle, livraison rapide.',
  'Product',
  '[{"title": "Vœux de fin d''année corporate", "description": "Envoyez vos vœux de Noël et Bonne Année avec style grâce à une carte pliée imprimée en quadrichromie. Papier épais et finition {{finition}} garantissent une présentation mémorable auprès de vos clients et collaborateurs."}, {"title": "Cartes de remerciement et félicitations", "description": "Idéale pour remercier vos fournisseurs, féliciter un client ou marquer une occasion importante. Le format {{format}} pliée offre espace intérieur pour un message personnel et une présentation compacte."}, {"title": "Cartons d''invitation et événementiel", "description": "Invitations à un événement professionnel, lancement de produit ou séminaire. La {{finition}} confère une allure premium, tandis que la quadrichromie reproduit fidèlement logos et mises en page sophistiquées."}]'::jsonb,
  '[{"question": "Quel est le format fermé de la carte de vœux pliée ?", "answer": "Le format fermé est 148 × 210 mm (1/4 A4 plié). Une fois dépliée, la surface intérieure offre 296 × 210 mm pour vos messages et visuels."}, {"question": "Puis-je imprimer recto-verso en quadrichromie ?", "answer": "Oui, absolument. L''impression quadrichromie (CMJN) s''applique sur l''intérieur et l''extérieur de la carte pour une reproduction fidèle de vos visuels en couleur complète."}, {"question": "Quels papiers et grammages sont disponibles ?", "answer": "Nous proposons {{papier}} en {{grammage}}g/m², garant d''une belle tenue et d''une excellente qualité tactile. Des papiers couché brillant, mat ou offset sont disponibles selon vos préférences esthétiques et écologiques (FSC/PEFC)."}, {"question": "Qu''est-ce que la finition {{finition}} et pourquoi la choisir ?", "answer": "La {{finition}} crée un toucher premium et protège votre impression contre les rayures et l''usure. Elle sublime aussi les couleurs tout en réduisant les reflets, pour une finition élégante et durable."}, {"question": "Quelle est la quantité minimale de commande ?", "answer": "La quantité minimale est {{quantite}} exemplaires. Nous proposons également des tarifs dégressifs pour les commandes plus importantes, n''hésitez pas à nous consulter."}, {"question": "Avez-vous des options d''adressage ou de personnalisation ?", "answer": "Oui, nous proposons l''adressage personnalisé, le surimpression variable, ainsi que des services de façonnage comme le dos carré collé pour un rendu encore plus professionnel."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'flyer', '{}'::jsonb, 'fr',
  'Flyer standard - Définition produit',
  ARRAY['flyer','tract publicitaire','dépliant','impression flyer','flyer couleur','flyer A5','flyer A6','flyer quadrichromie','flyer pelliculé','flyer FSC','flyer pas cher','commander flyer','impression professionnelle','marketing direct','communication imprimée']::text[],
  'Flyer {{format}} {{grammage}}g/m² en {{papier}} - {{finition}} | Impression {{quantite}} ex',
  'Flyer {{format}} {{quantite}} exemplaires en {{papier}} {{grammage}}g/m². {{finition}} pour un impact visuel maximal. Impression couleur CMJN professionnelle.',
  '## Flyer d''impact pour vos campagnes marketing

Nos flyers {{format}} en {{papier}} {{grammage}}g/m² constituent un support de communication incontournable pour vos distributions, événements ou actions de prospection. Imprimés en **quadrichromie (CMJN)** pour une restitution couleur fidèle et éclatante, ces tracts allient efficacité commerciale et qualité d''impression professionnelle.

## Caractéristiques techniques

Votre flyer bénéficie de :
- **Format {{format}}** : idéal pour la distribution et le rangement
- **Papier {{papier}}** {{grammage}}g/m² : rigidité et toucher premium
- **Finition {{finition}}** : {{finition == ''Pelliculage brillant'' ? ''protection brillante, couleurs éclatantes et effet premium'' : finition == ''Pelliculage mat'' ? ''rendu professionnel, anti-reflet, toucher velouté'' : finition == ''Sans finition'' ? ''impression nette et économique'' : ''finition qualité''}}
- **Impression {{impression_recto}}** haute définition
- **Quantité : {{quantite}} exemplaires** minimum recommandé pour des distributions efficaces

## Adaptée à vos besoins

Que ce soit pour des prospections B2B, des lancements produits, des événements ou du marketing direct, cette fiche constitue un support de communication polyvalent et économique. Compatible avec les bases de données clients et les stratégies porte-à-porte, le flyer reste un incontournable du mix marketing.

*Papier certifié FSC/PEFC disponible pour vos engagements environnementaux.*',
  'Flyer {{format}} {{grammage}}g/m² en {{papier}} – Impression couleur {{finition}}',
  'Flyer {{format}} professionnel | Impression couleur {{quantite}} ex',
  'Imprimez vos flyers {{format}} en couleur CMJN sur {{papier}} {{grammage}}g. {{finition}}, de {{quantite}} à 10 000 ex. Livraison rapide. Devis gratuit.',
  'Product',
  '[{"title": "Prospection et marketing direct", "description": "Distribuez des flyers à fort impact pour promouvoir vos produits/services, acquérir des clients et générer des leads. Format compact, facile à insérer en boîte aux lettres."}, {"title": "Événementiel et salons", "description": "Utilisez des flyers pour annoncer vos événements, conférences ou salons professionnels. Un support économique pour toucher un large public et générer des inscriptions."}, {"title": "Promotion en point de vente", "description": "Disposez des flyers sur le comptoir ou en présentoir pour promouvoir des offres, réductions ou nouveaux produits auprès de votre clientèle présente."}, {"title": "Communication immobilière et locale", "description": "Annoncez des biens, services ou événements locaux via des flyers distribués dans le voisinage. Idéal pour les petits commerces et PME."}]'::jsonb,
  '[{"question": "Quel format de flyer choisir ?", "answer": "Le format A5 (148 × 210 mm) est le standard économique et pratique pour la distribution. Le format A6 (105 × 148 mm) offre plus de compacité. Choisissez selon votre contenu et votre mode de distribution."}, {"question": "Quel grammage et papier pour mon flyer ?", "answer": "Un papier couché 135 g/m² offre un bon équilibre rigidité/économie. Pour un toucher premium, préférez 170 g/m². Le papier offset convient aux budgets serrés ; le couché pour des couleurs éclatantes."}, {"question": "Quelle finition choisir pour mon flyer ?", "answer": "Le pelliculage brillant rend les couleurs éclatantes (effet premium). Le pelliculage mat convient aux visuels épurés et professionnels. Sans finition = économies et séchage rapide. Soft-touch = toucher velouté luxe."}, {"question": "Combien de flyers commander minimum ?", "answer": "Les quantités minimales varient de 500 à 1 000 exemplaires selon les tarifs. Pour des tests ou petites distributions locales, des quantités de 250-500 ex sont envisageables. Consultez-nous pour un devis personnalisé."}, {"question": "Mes flyers peuvent-ils être FSC/PEFC ?", "answer": "Oui, nous proposons des papiers certifiés FSC et PEFC pour répondre à vos engagements environnementaux. Mentionnez-le lors de votre commande. Valorisez votre démarche éco-responsable auprès de vos clients."}, {"question": "Quel délai de livraison pour mon flyer ?", "answer": "Livraison standard : 5 à 7 jours ouvrés après validation du BAT. Express disponible (3-4 jours). Les délais dépendent du volume et de la finition. Contactez-nous pour une planification spécifique."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'flyer_a6', '{}'::jsonb, 'fr',
  'Flyer A6 - Définition produit',
  ARRAY['flyer A6','tract publicitaire','leaflet A6','flyer 105x148','imprimerie offset','impression quadrichromie','flyer pelliculé','papier FSC','flyer pas cher','flyer professionnel','flyer couleur','imprimé marketing','tract commercial','dépliant A6','flyer en ligne']::text[],
  'Flyer A6 {{grammage}}g {{papier}} - {{finition}} - {{quantite}} ex.',
  'Flyer A6 (105×148 mm) en {{papier}} {{grammage}}g, impression {{impression_recto}}. Parfait pour vos campagnes commerciales avec finitions {{finition}}.',
  '## Flyer A6 : votre outil marketing au format compact

Notre gamme de **flyers A6** (105×148 mm) vous offre un format de référence pour distribuer vos messages publicitaires, offres commerciales et informations pratiques. Léger et facilement transportable, ce format **standard** est idéal pour les boîtes à lettres, comptoirs de magasins et événements. Imprimé en **{{impression_recto}}** sur papier **{{papier}}** {{grammage}}g, votre flyer bénéficie d''une excellente qualité d''image et d''une tenue remarquable en main.

Personnalisez votre commande avec nos options de finition : **{{finition}}** pour un rendu premium et durable. Tous nos papiers sont disponibles en versions **FSC** ou **PEFC**, garantissant une démarche écologique reconnue. Que vous optiez pour un papier **couché brillant** (couleurs éclatantes), **couché mat** (aspect sophistiqué) ou **offset** (toucher naturel), chaque flyer est produit aux normes de qualité d''imprimerie professionnelle.

Avec des **quantités modulables** et des **délais de production rapides**, commandez vos flyers A6 en ligne et profitez d''une logistique optimisée. Notre système de tarification transparente et nos options d''expédition flexibles font de chaque projet une réussite, du petit tirage au grand volume.',
  'Flyer A6 {{grammage}}g en {{papier}} {{finition}} | Imprimerie en ligne',
  'Flyer A6 professionnel {{grammage}}g {{papier}}',
  'Commandez vos flyers A6 (105×148 mm) en {{papier}} {{grammage}}g. Impression couleur, finitions {{finition}}, papiers FSC/PEFC. Qualité professionnelle, prix compétitifs.',
  'Product',
  '[{"title": "Promotion en magasin", "description": "Imprimez des flyers A6 pour annoncer vos soldes, nouveaux produits ou offres limitées. Le format compact facilite l''insertion en caisse, la distribution en main propre ou l''affichage sur étagères."}, {"title": "Événementiel et animations", "description": "Parfaits pour les salons, foires, mariages ou événements d''entreprise : distribuez rapidement vos informations pratiques, codes d''accès ou invitations en format léger et transportable."}, {"title": "Prospection B2B et B2C", "description": "Supports de prospection classiques et économiques : présentez votre service, vos coordonnées ou un QR code vers votre site web. Excellent ROI pour les campagnes de sensibilisation locale."}, {"title": "Communication interne et externe", "description": "Avis clients, témoignages, infographies, conseils pratiques : les flyers A6 se glissent facilement dans des emballages ou se distribuent lors de points de vente pour renforcer votre image de marque."}]'::jsonb,
  '[{"question": "Quelles sont les dimensions exactes d''un flyer A6 ?", "answer": "Le format A6 mesure 105 × 148 mm (soit la moitié d''un A5). C''est un format standard reconnu internationalement, facile à imprimer et à distribuer."}, {"question": "Quels papiers proposez-vous pour les flyers A6 ?", "answer": "Nous proposons plusieurs options : papier couché brillant (couleurs éclatantes), couché mat (aspect premium), et offset (toucher naturel). Tous disponibles en grammages variés (80g à 350g) et en versions certificatives FSC ou PEFC."}, {"question": "Qu''est-ce que le pelliculage et quand l''utiliser ?", "answer": "Le pelliculage est une finition protectrice appliquée en surface : brillant (effet premium, couleurs vibrant), mat (aspect sophistiqué, moins de reflets) ou soft-touch (toucher velouté). Idéal pour augmenter la durabilité et l''impact visuel de vos flyers."}, {"question": "Quelles quantités minimales puis-je commander ?", "answer": "Nos quantités minimales commencent généralement à 250 ou 500 exemplaires selon les options choisies. Consultez directement nos tarifs en ligne ou contactez notre équipe pour les petits tirages personnalisés."}, {"question": "Puis-je imprimer au recto-verso ?", "answer": "Oui, l''impression recto-verso est possible et recommandée pour maximiser votre message. Vous pouvez choisir des finitions différentes par face selon vos besoins (par exemple : recto couleur brillant, verso mat)."}, {"question": "Les papiers FSC et PEFC : quelle différence ?", "answer": "FSC et PEFC sont deux certifications de gestion durable des forêts. Tous deux garantissent une approche écologique responsable. Le choix dépend de votre politique environnementale et de vos partenaires commerciaux."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'flyer_a5', '{}'::jsonb, 'fr',
  'Flyer A5 - Gamme produit',
  ARRAY['flyer A5','tract A5','dépliant A5','impression flyer','flyer quadrichromie','flyer pelliculé','impression offset A5','flyer pas cher','flyer professionnel','imprimerie en ligne']::text[],
  'Flyer A5 {{grammage}}g {{papier}} - {{finition}} | Impression {{quantite}} ex.',
  'Flyers A5 {{papier}} {{grammage}}g en {{quantite}} exemplaires. {{finition}} de qualité professionnelle. Commande en ligne express.',
  '## Flyer A5 professionnel : votre solution de communication impactante

Nos flyers au format A5 (148 × 210 mm) sont conçus pour les campagnes de marketing direct, distributions en points de vente ou événementiel. Imprimés en quadrichromie (CMJN) sur {{papier}} {{grammage}}g, ils conjuguent impact visuel et robustesse. La {{finition}} garantit une présentation soignée et une durabilité optimale. Disponibles en {{quantite}} exemplaires minimum.

## Caractéristiques techniques et personnalisation

Chaque flyer bénéficie d''une impression de haute qualité avec des couleurs éclatantes et des contrastes maîtrisés. Nous proposons des papiers certifiés FSC ou PEFC pour les projets éco-responsables, et des finitions variées : pelliculage brillant (aspect premium), mat (discrétion élégante) ou soft-touch (toucher velours). {{finition_recto}} et {{finition_verso}} peuvent être combinées selon vos besoins.

## Avantages pour votre entreprise

Le format A5 est idéal pour les petits budgets marketing avec un impact maximal : facile à distribuer, à glisser dans un courrier ou une pochette, il reste mémorable. Production rapide, tarification dégressives et mise en page gratuite pour les volumes. Commandez en ligne, suivez votre production en temps réel et recevez votre commande dans les délais convenus.',
  'Imprimerie flyer A5 {{papier}} {{grammage}}g - {{finition}} & couleurs CMJN',
  'Flyer A5 professionnel | Impression quadrichromie en ligne',
  'Flyer A5 imprimé en couleurs CMJN sur papier {{papier}} {{grammage}}g. {{finition}}. Commande express en ligne avec tarifs dégressifs.',
  'Product',
  '[{"title": "Prospection commerciale", "description": "Distribuez vos flyers A5 pelliculés lors de salons, événements ou porte-à-porte. Le format compact facilite la distribution massive tout en restant perceptible."}, {"title": "Insérer en courrier ou colis", "description": "Complétez vos mailings B2B ou B2C avec un flyer A5 de présentation produit. Dimensions optimales pour une insertion en enveloppe DL sans surcoût postal."}, {"title": "Communication point de vente", "description": "Mettez en avant une promotion, un nouveauté ou une offre limitée en magasin. Le pelliculage brillant ou mat assure une tenue parfaite en linéaire."}, {"title": "Événementiel et accueil", "description": "Créez des flyers d''information pour accueillir vos visiteurs, expliquer une visite guidée ou présenter le programme d''un événement."}]'::jsonb,
  '[{"question": "Quel est le délai de production d''un flyer A5 ?", "answer": "Nos délais standards sont de 3 à 5 jours ouvrables après validation du bon à tirer. Des options express (48-72h) sont disponibles sur demande et selon disponibilités."}, {"question": "Puis-je mélanger recto et verso en finitions différentes ?", "answer": "Oui, tout à fait. Vous pouvez par exemple commander un recto brillant et un verso mat (soft-touch). Cela crée un effet premium et différencie vos deux faces."}, {"question": "Quel papier choisir : couché, offset ou recyclé ?", "answer": "Le papier couché (115-300 g/m²) offre des couleurs éclatantes et un rendu lisse. L''offset (80-170 g/m²) est plus économique. Les papiers recyclés et certifiés FSC/PEFC répondent aux normes environnementales. Consultez nos conseillers pour le meilleur rapport qualité-prix selon votre budget."}, {"question": "Y a-t-il une quantité minimale de commande ?", "answer": "Oui, le minimum est généralement de 250 ou 500 exemplaires selon les options choisies. Des prix dégressifs s''appliquent à partir de 1 000, 5 000 ou 10 000 ex. Contactez-nous pour un devis personnalisé."}, {"question": "Le pelliculage affecte-t-il le délai de livraison ?", "answer": "Non, le pelliculage est intégré au process standard. Les délais restent identiques que vous choisissiez un flyer simple ou pelliculé (brillant, mat ou soft-touch)."}, {"question": "Proposez-vous des fichiers d''aide à la création ?", "answer": "Oui, nous mettons à disposition des templates gratuits au format A5 avec zones de sécurité, fonds perdus et repères de découpe. Téléchargez-les sur notre site ou demandez-les au support."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'flyer_a4', '{}'::jsonb, 'fr',
  'Flyer A4 - Définition générique',
  ARRAY['flyer A4','tract A4','dépliant A4','impression flyer','flyer publicitaire','imprimerie flyer','flyer quadrichromie','flyer pelliculé','flyer FSC','flyer PEFC','flyer professionnel','flyer pas cher','flyer personnalisé']::text[],
  'Flyer A4 {{grammage}}g {{papier}} - {{finition}} - {{quantite}} ex.',
  'Flyer A4 en {{papier}} {{grammage}}g avec finition {{finition}}. Impression {{impression_recto}} de qualité professionnelle, {{quantite}} exemplaires minimum.',
  '# Flyer A4 professionnel : votre outil de communication incontournable

Nos flyers A4 (210 × 297 mm) offrent une surface généreuse pour un message impactant. Imprimés en **quadrichromie (CMJN)** sur {{papier}} {{grammage}}g, ils garantissent une restitution des couleurs fidèle et éclatante. Disponibles en finition {{finition}}, ils s''adaptent à tous vos besoins : promotion commerciale, événementiel, prospection ou communication interne.

**Caractéristiques techniques :**
- Format : A4 (210 × 297 mm)
- Papier : {{papier}} {{grammage}}g/m² (résistant et professionnel)
- Impression : {{impression_recto}}
- Finition : {{finition}} (durable et élégante)
- Quantité minimale : {{quantite}} exemplaires
- Certifications écologiques : FSC/PEFC disponibles

Choix idéal pour les campagnes marketing, les salons professionnels, les distributions en rue ou les mailings ciblés. Délais rapides et tarifs compétitifs pour petites et grandes quantités.',
  'Flyer A4 {{grammage}}g en {{papier}} {{finition}} : impression professionnelle pour {{quantite}} exemplaires',
  'Flyer A4 impression professionnelle - {{grammage}}g {{papier}}',
  'Flyer A4 professionnel en {{papier}} {{grammage}}g. Finition {{finition}}, impression quadrichromie, {{quantite}} ex. min. Rapide, écologique FSC/PEFC.',
  'Product',
  '[{"title": "Campagne marketing et prospection", "description": "Distribuez vos flyers A4 dans les boîtes aux lettres ou lors d''événements pour promouvoir vos produits/services. La taille A4 offre assez d''espace pour un message clair et des visuels attrayants, tout en restant facile à manipuler et à stocker."}, {"title": "Communication événementielle", "description": "Annoncez vos salons, conférences, formations ou lancements produits avec des flyers A4 percutants. Imprimés en couleurs vives avec pelliculage brillant ou mat, ils captent l''attention et communiquent professionnalisme."}, {"title": "Documentation commerciale et restauration", "description": "Utilisez vos flyers A4 comme menus, cartes promotionnelles, bons de réduction ou guides d''utilisation. Résistants et durables, ils supportent la manipulation fréquente sans perdre leur qualité visuelle."}]'::jsonb,
  '[{"question": "Quel est le délai de livraison pour des flyers A4 ?", "answer": "Les délais varient selon la quantité et les options de finition. Comptez généralement 3 à 5 jours ouvrés pour un tirage standard, avec des options « 24/48h » disponibles moyennant supplément."}, {"question": "Quel papier choisir pour un flyer A4 ?", "answer": "Nous proposons papier couché brillant (80-250g/m²) pour un rendu premium et lumineux, et papier offset (80-130g/m²) pour un rendu mat et naturel. Le grammage dépend de votre budget et de l''usage : 120g minimum recommandé pour une bonne rigidité."}, {"question": "Qu''est-ce que le pelliculage mat, brillant ou soft-touch ?", "answer": "Le pelliculage est un revêtement protecteur qui améliore la durabilité et l''esthétique : mat (discrétion, anti-reflet), brillant (couleurs éclatantes, luminosité), soft-touch (toucher velouté, premium). Tous offrent une protection contre l''usure et l''eau."}, {"question": "Vos flyers A4 sont-ils certifiés écologiques ?", "answer": "Oui, nous proposons papiers FSC ou PEFC (gestion forestière responsable) pour tous nos flyers. Ces certifications garantissent une production respectueuse de l''environnement, idéale pour renforcer l''image durable de votre entreprise."}, {"question": "Quelle est la quantité minimale de commande ?", "answer": "La quantité minimale dépend de votre configuration (papier, finition, finitions spéciales). Généralement à partir de 250-500 exemplaires pour des tarifs optimisés. Consultez nos tarifs pour des petits tirage ou demandez un devis personnalisé."}, {"question": "Puis-je commander des flyers A4 recto seul ou recto/verso ?", "answer": "Oui, flexibilité totale : impression recto seul (économique) ou recto/verso (valorise l''espace et le message). Le recto/verso offre une meilleure communication et n''augmente que légèrement le coût."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'flyer_dl', '{}'::jsonb, 'fr',
  'Flyer DL - Fiche produit gamme',
  ARRAY['flyer DL','prospectus DL','dépliant long','flyer 100x210','impression flyer','flyer publicitaire','flyer couleur','flyer papier couché','flyer offset','impression quadrichromie','flyer FSC','flyer PEFC','flyer pelliculé','flyer mat','flyer brillant','flyer soft-touch','flyer professionnel','impression DL','tract DL','leaflet DL']::text[],
  'Flyer DL {{format}} {{grammage}}g {{papier}} - {{finition}} - {{quantite}} ex.',
  'Flyer DL {{format}} en {{papier}} {{grammage}}g avec finition {{finition}}. Format idéal pour vos campagnes de prospection et communications commerciales.',
  '## Flyer DL : Votre outil de prospection par excellence

Nos **flyers DL au format 100 × 210 mm** constituent le support de communication idéal pour vos campagnes de marketing direct, distributions en événements et prospections commerciales. Cet format allongé, parfois appelé **format long ou prospectus DL**, maximise l''impact visuel tout en restant facilement transportable et distribuable.

### Caractéristiques techniques

Vos flyers {{quantite}} exemplaires sont imprimés en **{{impression_recto}}** sur papier **{{papier}} {{grammage}}g/m²**, garantissant une qualité d''image supérieure en quadrichromie (CMJN). La finition {{finition}} sublime vos créations : choisissez le **pelliculage brillant** pour un rendu éclatant et protégé, le **pelliculage mat** pour plus de sophistication, ou le **soft-touch** pour une sensation premium au toucher. Chaque flyer peut bénéficier d''une **certification écologique FSC ou PEFC**, garantissant une démarche développement durable.

### Pourquoi choisir nos flyers DL ?

Notre gamme DL associe **qualité d''impression professionnelle**, choix de papiers nobles (couché brillant, couché mat, offset) et finitions haut de gamme. Que vous imprimiez {{quantite}} flyers ou davantage, nous offrons des délais courts et un rapport qualité-prix imbattable. Vos documents {{papier}} sont traités avec soin et livrés prêts à distribuer.',
  'Flyer DL 100×210 mm - Impression {{papier}} {{grammage}}g {{finition}} | Clariprint',
  'Flyer DL 100×210mm | Impression couleur - Clariprint',
  'Flyers DL 100×210mm en couleur (CMJN). Papier couché/offset, finitions mat/brillant/soft-touch. Devis gratuit, délais rapides, certifications FSC/PEFC.',
  'Product',
  '[{"title": "Prospection commerciale", "description": "Distribuez vos flyers DL lors de salons professionnels, porte-à-porte ou en boîte aux lettres. Le format allongé captive l''attention et facilite le stockage chez le destinataire."}, {"title": "Promotion événementielle", "description": "Annoncez vos événements, concerts, formations ou réductions avec un flyer DL couleur. La finition brillante ou soft-touch renforce l''attrait visuel et la mémorisation."}, {"title": "Communication restaurant/commerce", "description": "Présentez vos menus, offres spéciales ou services en format DL. Idéal à glisser en emballage ou à afficher sur le comptoir avec pelliculage mat haute résistance."}, {"title": "Mailing et marketing direct", "description": "Intégrez vos flyers DL en encart postal ou dans vos envois clients. Le format économe en port favorise les stratégies de mailing massif certifiées FSC."}]'::jsonb,
  '[{"question": "Quel est le format exact d''un flyer DL ?", "answer": "Le format DL mesure 100 × 210 mm (largeur × hauteur). C''est un format long et étroit, parfait pour la prospection. À plat, il correspond à un tiers de feuille A4 (210 × 297 mm)."}, {"question": "Quels papiers proposez-vous pour les flyers DL ?", "answer": "Nous offrons papier couché brillant (rendu éclatant, photos nettes), papier couché mat (effet plus sobre et professionnel) et papier offset (économique, aspect naturel). Tous disponibles de 120 à 350 g/m²."}, {"question": "Qu''est-ce que le pelliculage et lequel choisir ?", "answer": "Le pelliculage est un film protecteur transparent appliqué en surface. Choisissez brillant pour maximiser les couleurs et la brillance, mat pour élégance et discrétion, ou soft-touch pour une sensation premium au toucher avec une légère adhérence."}, {"question": "Mes flyers peuvent-ils être certifiés écologiques ?", "answer": "Oui. Tous nos flyers DL peuvent être imprimés sur papier certifié FSC (Forest Stewardship Council) ou PEFC (Programme for the Endorsement of Forest Certification), garantissant une gestion durable des forêts."}, {"question": "Quel délai pour imprimer 5 000 flyers DL ?", "answer": "Nos délais standard varient de 3 à 7 jours ouvrables selon la finition et la charge d''imprimerie. Contactez notre équipe pour une date ferme ou des options express (délai réduit possible)."}, {"question": "Puis-je imprimer recto-verso sur mes flyers DL ?", "answer": "Oui, tous nos flyers DL supportent l''impression recto-verso en quadrichromie (CMJN). Parfait pour optimiser votre message avec contenu avant et arrière."}, {"question": "Quelle quantité minimum pour commander des flyers DL ?", "answer": "Notre quantité minimale est de 500 exemplaires. Pour les très petites tirages, contactez-nous pour étudier une solution personnalisée."}, {"question": "Comment préparer mon fichier pour l''impression DL ?", "answer": "Fournissez un PDF haute résolution (300 dpi minimum) au format 100 × 210 mm avec marges de sécurité de 3-5 mm. Les couleurs doivent être en profil CMJN (quadrichromie), pas en RVB ou Pantone."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'affiche', '{}'::jsonb, 'fr',
  'Affiche personnalisée - Gamme standard',
  ARRAY['affiche imprimée','affiche personnalisée','affiche quadrichromie','affiche format A3','affiche format A2','affiche papier couché','affiche publicitaire','impression affiche','affiche FSC','affiche PEFC','affiche pelliculée','affiche brillante','affiche mate','commande affiche en ligne']::text[],
  'Affiche {{format}} {{grammage}}g/m² - {{papier}} {{finition}} | Impression couleur',
  'Affiche {{format}} imprimée en quadrichromie sur papier {{papier}} {{grammage}}g/m². Finition {{finition}} pour vos campagnes et communications visuelles.',
  '## Affiche {{format}} professionnelle - Impression couleur haute définition

Votre affiche {{format}} est imprimée en **quadrichromie (CMJN)** sur papier {{papier}} {{grammage}}g/m² pour une qualité d''image exceptionnelle et des couleurs éclatantes. Qu''il s''agisse d''une campagne publicitaire, d''une décoration murale ou d''une communication événementielle, cette affiche allie impact visuel et durabilité.

### Caractéristiques techniques

- **Format** : {{format}}
- **Papier** : {{papier}} {{grammage}}g/m² (qualité premium)
- **Impression** : Quadrichromie (CMJN) recto
- **Finition** : {{finition}}
- **Quantité minimale** : à partir de {{quantite}} exemplaires

Le papier {{papier}} offre une très bonne tenue mécanique et une surface optimale pour une reproduction fidèle des couleurs. Le grammage {{grammage}}g/m² garantit une rigidité appropriée pour une affichage professionnel sans gondolement.

### Finitions disponibles

Votre affiche peut bénéficier d''une **finition {{finition}}** (pelliculage ou naturel) pour une protection et une esthétique adaptées à votre environnement d''affichage :
- **Finition brillante** : renforce la saturation des couleurs et l''impact visuel
- **Finition mate** : réduit les reflets et offre un rendu plus discret et professionnel
- **Finition soft-touch** : texture veloutée pour une sensation premium

### Certifications écologiques

Nos affiches sont imprimées sur papier certifié **FSC® ou PEFC™**, garantissant une gestion responsable des forêts et une production respectueuse de l''environnement.

### Avantages de cette affiche

✓ Qualité d''impression supérieure en quadrichromie  
✓ Papier premium {{papier}} résistant  
✓ Finition {{finition}} pour une meilleure présentation  
✓ Délai court et tarif compétitif  
✓ Production écoresponsable (FSC/PEFC)  
✓ Idéale pour le retail, événementiel, collectivités et communication d''entreprise',
  'Affiche {{format}} {{grammage}}g/m² imprimée en quadrichromie | {{papier}} {{finition}}',
  'Affiche {{format}} personnalisée - Impression quadrichromie',
  'Affiche {{format}} imprimée en couleur sur papier {{papier}} {{grammage}}g/m². Finition {{finition}}, certifiée FSC/PEFC. Commandez en ligne.',
  'Product',
  '[{"title": "Campagne publicitaire et promotion commerciale", "description": "Affiche A2 ou A3 imprimée en haute définition pour promouvoir vos produits, services ou événements. Idéale pour l''affichage en magasins, vitrines, transports ou lieux publics. La finition brillante renforce l''impact des visuels et attire l''attention."}, {"title": "Communication d''entreprise et corporate", "description": "Affiche format A2 avec finition mate pour un rendu premium en milieu professionnel. Idéale pour les bureaux, salons, conférences ou communications internes. Le papier couché de qualité garantit une présentation soignée et durable."}, {"title": "Événementiel et animation commerciale", "description": "Affiches imprimées pour promouvoir salons, concerts, séminaires ou événements. Format A2 recommandé pour une visibilité maximale. Papier résistant et finition pelliculée pour supporter l''affichage répété et les intempéries."}, {"title": "Décoration intérieure et murale", "description": "Affiche artistique ou thématique pour décorer bureaux, espaces de détente, salles d''attente. Finition soft-touch pour un rendu premium et tactile. Papier couché mat pour une excellente stabilité dimensionnelle."}]'::jsonb,
  '[{"question": "Quels formats d''affiche proposez-vous ?", "answer": "Nous proposons les formats standard : A4 (210×297 mm), A3 (297×420 mm), A2 (420×594 mm) et sur devis d''autres formats custom. Le format A3 et A2 sont les plus populaires pour l''affichage public et la communication."}, {"question": "Quel papier choisir pour une affiche durable ?", "answer": "Pour une affiche durable, nous recommandons papier couché 250-300 g/m² ou papier offset 200-250 g/m². Le papier couché offre meilleure qualité d''impression et résistance aux rayures. Tous nos papiers sont certifiés FSC® ou PEFC™ pour une démarche écoresponsable."}, {"question": "Quelle finition choisir pour mon affiche ?", "answer": "La finition brillante (pelliculage brillant) renforce saturation des couleurs et l''impact visuel, idéale pour le retail. La finition mate réduit reflets et offre rendu discret et professionnel, parfaite pour corporate. Le soft-touch apporte sensation premium et veloutée pour un positionnement haut de gamme."}, {"question": "Quel délai pour une commande d''affiches ?", "answer": "Les délais standard sont 5-7 jours ouvrés après validation de BAT. Des délais express (2-3 jours) sont possibles selon volume et finition choisie. Nous vous confirmons délai exact avant commande selon configurations spécifiques."}, {"question": "Vos affiches sont-elles écologiques ?", "answer": "Oui, toutes nos affiches sont imprimées sur papier certifié FSC® (Forest Stewardship Council) ou PEFC™ (Programme for the Endorsement of Forest Certification), garantissant gestion responsable des forêts et production respectueuse de l''environnement."}, {"question": "Quantité minimale pour commander ?", "answer": "La quantité minimale est généralement 50-100 exemplaires selon format et finition. Nous acceptons aussi petits tirages (25-50 ex.) avec supplément tarif. Demandez tarif spécifique pour votre projet."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'affiche_a3', '{}'::jsonb, 'fr',
  'Affiche A3 - Définition générique',
  ARRAY['affiche A3','impression affiche','affiche 297x420','affiche publicitaire','affiche événement','affiche papier couché','impression quadrichromie','affiche FSC','affiche PEFC','affiche pelliculée','affiche brillant','affiche mat','commande affiche en ligne','affiche professionnel']::text[],
  'Affiche A3 {{quantite}} ex. - {{papier}} {{grammage}}g - {{finition}}',
  'Affiche A3 (297×420 mm) en {{papier}} {{grammage}}g avec impression {{finition}}. Idéale pour vos campagnes d''affichage.',
  '## Affiche A3 {{quantite}} exemplaires – Format standard professionnel

Notre affiche A3 (297 × 420 mm) est le format incontournable pour vos campagnes d''affichage, événements et communications visuelles. Imprimée en **quadrichromie (CMJN)** sur {{papier}} {{grammage}}g, elle offre une restitution de couleur précise et éclatante. La finition {{finition}} vous garantit un rendu {{finition}} adapté à vos besoins : le pelliculage **brillant** pour l''impact maximal, le **mat** pour l''élégance, ou le **soft-touch** pour une toucher premium.

## Papiers et labels écologiques

Choisissez entre nos papiers couché (brillance et onctuosité) ou offset (texturé, traditionnel). Toutes nos productions peuvent être certifiées **FSC** ou **PEFC**, garantissant une gestion forestière responsable et durable. Ces labels rassurent vos clients et valorisent votre image.

## Finitions professionnelles

Le {{finition}} confère à votre affiche un aspect {{finition}}. Disponibles également : **pelliculage brillant** (effet lisse et lumineux), **mat** (discret et haut de gamme) ou **soft-touch** (sensation veloutée). Parfait pour affichage intérieur/extérieur, magasin, salle d''exposition, événement.

## Commande simple, délais rapides

De 25 à plusieurs milliers d''exemplaires, production française, livraison par transport sécurisé. Validation à l''écran avant tirage garantie.',
  'Affiche A3 {{quantite}} ex. en {{papier}} {{grammage}}g – Impression {{finition}}',
  'Affiche A3 – Impression en ligne | {{grammage}}g {{finition}}',
  'Affiche A3 (297×420) en {{papier}} {{grammage}}g, finition {{finition}}. Impression quadrichromie, FSC/PEFC. Commande en ligne, livraison rapide.',
  'Product',
  '[{"title": "Affichage magasin et point de vente", "description": "Promotions, tarifs, visuels produits : l''affiche A3 est le format idéal pour le linéaire. Son format vertical s''adapte aux vitrines et cloisons. Finition brillant pour un maximum d''impact en rayons."}, {"title": "Événement et communication d''entreprise", "description": "Congrès, séminaire, salon : affichage de l''ordre du jour, maps de visite, actualités. Papier couché 170g + pelliculage résistant aux manipulations répétées."}, {"title": "Campagne publicitaire et affichage urbain", "description": "Campagne de marque, film/spectacle, annonce locale. L''A3 se glisse sur les panneaux communaux et posters de quartier. Papier offset 160g ou couché 200g selon durabilité souhaitée."}, {"title": "Communication interne et ressources humaines", "description": "Annonces de réunions, consignes de sécurité, tableaux de bord RH. Format A3 encadré pour visibilité maximale dans les espaces partagés."}]'::jsonb,
  '[{"question": "Quels sont les dimensions exactes de l''affiche A3 ?", "answer": "L''affiche A3 mesure 297 mm de largeur × 420 mm de hauteur (format portrait). Elle peut aussi être commandée en paysage (420 × 297 mm) selon vos besoins."}, {"question": "Quel papier choisir pour une affiche A3 ?", "answer": "Papier **couché** (blanc brillant, 135–200g) : restitution couleur éclatante, idéal pour photo et visuels. Papier **offset** (160–200g) : texture naturelle, rendu traditionnel, excellent rapport qualité/prix. Pour affichage durable, privilégiez 200g minimum."}, {"question": "Est-ce que mes affiches peuvent avoir une finition brillant, mat ou soft-touch ?", "answer": "Oui. Le pelliculage **brillant** apporte du lustre et protège contre les rayures. Le **mat** offre une finition élégante anti-reflet, parfaite pour textes. Le **soft-touch** (vernis velours) procure un toucher premium unique. Tous compatibles avec impression quadrichromie."}, {"question": "Vos affiches sont-elles certifiées FSC ou PEFC ?", "answer": "Oui, vous pouvez opter pour du papier **FSC** ou **PEFC** à la commande, sans surcoût significatif. Ces labels garantissent une gestion durable des forêts et renforcent votre démarche RSE."}, {"question": "Quel est le délai de production et livraison pour l''affiche A3 ?", "answer": "Production : 3 à 5 jours ouvrables après validation de BAT. Livraison : 2 à 4 jours selon région (transport économique inclus à partir de 100 ex.). Express disponible sur demande."}, {"question": "Quelle est la quantité minimale pour commander une affiche A3 ?", "answer": "Quantité minimale : **25 exemplaires**. Au-delà, tarifs dégressifs automatiques. Pour très petits volumes, consultez notre service client."}, {"question": "Comment se déroule la validation avant tirage ?", "answer": "Vous recevez un **BAT (bon à tirer) numérique** par email pour vérifier couleurs, texte et mise en page. Validation gratuite et illimitée jusqu''à votre satisfaction avant lancement de la production."}, {"question": "L''affiche A3 peut-elle être imprimée recto-verso ?", "answer": "Oui, impression recto-verso possible pour affiche pliée ou double-face. Consultez notre service pour options de finition (dos carré collé si besoin) et surcoûts associés."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'affiche_a2', '{}'::jsonb, 'fr',
  'Affiche A2 - Définition de gamme',
  ARRAY['affiche A2','affiche 420x594','impression affiche','affiche publicitaire','affiche quadrichromie','affiche papier couché','affiche FSC','affiche PEFC','affiche pelliculage','affiche offset','commande affiche en ligne','impression affiche pas cher','affiche personnalisée','affiche événementiel','affiche marketing']::text[],
  'Affiche A2 {{format}} {{grammage}} g/m² - Impression {{finition}} | Clariprint',
  'Affiche A2 (420×594 mm) en {{papier}} {{grammage}} g/m² avec finition {{finition}}. Impression quadrichromie haute définition. Certifications FSC/PEFC disponibles.',
  '## Affiche A2 {{grammage}} g/m² - Impact maximum pour vos campagnes

L''affiche A2 est le format de référence pour vos besoins de communication visuelle en intérieur comme en extérieur. Avec ses dimensions de **420 × 594 mm**, elle offre une surface d''affichage généreuse tout en restant facilement manipulable et transportable. Imprimée en **quadrichromie CMJN**, votre création bénéficie d''une reproduction chromatique précise et de contrastes éclatants, idéale pour capter l''attention dans les points de vente, les galeries, les espaces événementiels ou les campagnes de sensibilisation.

### Papier et finitions premium

Nous vous proposons cette affiche en {{papier}} de {{grammage}} g/m², garantissant une rigidité optimale et une excellente tenue dans le temps. La finition **{{finition}}** que vous choisissez renforce l''effet recherché : un pelliculage **mat** pour une élégance discrète et anti-reflet, un pelliculage **brillant** pour des couleurs éclatantes et lumineuses, ou un pelliculage **soft-touch** pour une texture premium et agréable au toucher. Tous nos papiers sont certifiés **FSC ou PEFC**, respectant les normes environnementales internationales.

### Impression professionnelle et robustesse

Chaque affiche A2 est imprimée sur nos presses offset dernière génération, garantissant une qualité constante {{quantite}} exemplaires après {{quantite}}. Le grammage {{grammage}} g/m² assure une rigidité suffisante pour un affichage sans ondulation, même en environnement humide. Nos finitions de surface protègent votre visuel contre l''usure, les rayures et les effets du temps, prolongeant ainsi la durée de vie de votre communication.

### Commande flexible et livraison rapide

Que vous commandiez une petite série ou une grande quantité, Clariprint adapte ses tarifs à vos besoins. Les délais de production sont courts (48 à 72 h selon la charge), et nos options de livraison couvrent toute la France métropolitaine. Téléchargez votre fichier PDF aux normes ISO 12647-2, validez votre devis et nous nous chargeons du reste.',
  'Affiche A2 {{format}} : impression {{papier}} {{grammage}} g/m² avec finition {{finition}}',
  'Affiche A2 - Impression quadrichromie | Clariprint',
  'Imprimez votre affiche A2 (420×594 mm) en quadrichromie sur papier {{papier}} {{grammage}} g/m² avec finition {{finition}}. FSC/PEFC. Livraison rapide.',
  'Product',
  '[{"title": "Affichage événementiel et culturel", "description": "Festivals, expositions, concerts : l''affiche A2 en pelliculage brillant capte les regards et communique l''énergie de votre événement. Le grammage 200 g/m² offre une rigidité idéale pour les panneaux d''affichage."}, {"title": "Campagne de marketing en point de vente", "description": "Promotions, nouveaux produits, campagnes saisonnières : l''affiche A2 en papier couché mat {{grammage}} g/m² s''intègre élégamment dans les vitrines et les espaces intérieurs. La finition mat supprime les reflets sous éclairage."}, {"title": "Communication interne et affichage institutionnel", "description": "Plans d''évacuation, chartes éthiques, informations RH : l''affiche A2 certifiée FSC/PEFC en finition soft-touch crée une impression premium et responsable, adaptée aux environnements professionnels."}, {"title": "Portfolio artistique et galeries", "description": "Reproduction d''œuvres, expositions temporaires : le format A2 en quadrichromie haute définition sur papier premium révèle tous les détails et nuances de votre création artistique."}]'::jsonb,
  '[{"question": "Quelles sont les dimensions exactes d''une affiche A2 ?", "answer": "L''affiche A2 mesure 420 × 594 mm (ou 16,54 × 23,39 pouces). Ce format est parfait pour les applications murales, les chevalets et les panneaux d''affichage standard."}, {"question": "Quel grammage de papier choisir pour une affiche A2 ?", "answer": "Nous recommandons un grammage minimum de 150 g/m² pour une affiche d''intérieur standard, 200 g/m² pour un meilleur rendu premium et plus de rigidité, et 250 g/m² pour une durabilité maximale en environnement extérieur ou à fort trafic."}, {"question": "Quelle différence entre pelliculage mat, brillant et soft-touch ?", "answer": "Le pelliculage **mat** offre une finition élégante anti-reflet, idéale pour les textes et les designs sophistiqués. Le pelliculage **brillant** rehausse les couleurs et offre un aspect lumineux spectaculaire. Le pelliculage **soft-touch** combine l''esthétique du mat avec une texture premium agréable au toucher, parfait pour les applications haut de gamme."}, {"question": "Les affiches A2 de Clariprint sont-elles certifiées écologiquement ?", "answer": "Oui, toutes nos affiches A2 utilisent des papiers certifiés FSC (Forest Stewardship Council) ou PEFC (Programme for the Endorsement of Forest Certification), garantissant une gestion responsable des ressources forestières. Les encres utilisées respectent les normes environnementales ISO."}, {"question": "Quels sont les délais de production et livraison ?", "answer": "Les délais de production standard sont de 48 à 72 heures à partir de la validation du BAT (bon à tirer). La livraison en France métropolitaine s''effectue sous 3 à 5 jours ouvrables selon votre localisation. Des délais rush (24 h) sont disponibles sur demande."}, {"question": "Acceptez-vous les fichiers PDF et quels sont les critères techniques ?", "answer": "Oui, nous acceptons les fichiers PDF haute résolution (300 dpi minimum). Veuillez inclure un débord de 3 mm sur tous les côtés, convertir les couleurs en CMJN (ISO 12647-2), et embarquer les polices ou les convertir en courbes. Nos équipes peuvent valider votre fichier avant impression."}, {"question": "Quelle est la quantité minimale de commande ?", "answer": "La quantité minimale pour une affiche A2 est de 10 exemplaires. Pour des volumes plus importants (à partir de 250 ex.), nous appliquons automatiquement des tarifs dégressifs compétitifs."}, {"question": "Proposez-vous des options de finition supplémentaires (vernis, dorure) ?", "answer": "En option standard, nous offrons le pelliculage mat, brillant et soft-touch. Pour des demandes spéciales (vernis sélectif, dorure, gaufrage), contactez notre équipe commerciale : nous étudions chaque projet sur mesure."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'affiche_a1', '{}'::jsonb, 'fr',
  'Affiche A1 - Définition produit standard',
  ARRAY['affiche A1','affiche 594x841','impression affiche','affiche publicitaire','affiche quadrichromie','affiche haute qualité','affiche pelliculée','affiche FSC','affiche PEFC','affiche papier couché','affiche offset','affiche 84x59 cm','affiche événementiel','affiche magasin','affiche poster']::text[],
  'Affiche A1 {{format}} {{grammage}}g/m² {{papier}} {{finition}} - Quantité {{quantite}}',
  'Affiche A1 (594×841 mm) en {{papier}} {{grammage}}g/m², imprimée en quadrichromie {{finition}}. Idéale pour vos campagnes publicitaires et événements.',
  '## Affiche A1 Professionnelle en {{papier}} {{grammage}}g/m²

Nos affiches A1 (594 × 841 mm) offrent un format d''impact maximal pour vos besoins en communication visuelle. Imprimées en **quadrichromie haute définition** sur {{papier}} {{grammage}}g/m², elles garantissent des couleurs éclatantes et une excellente restitution des détails. Le format A1 est le choix privilégié des campagnes publicitaires, événements, vitrines commerciales et affichage urbain.

### Caractéristiques techniques
- **Format** : 594 × 841 mm (A1)
- **Papier** : {{papier}}
- **Grammage** : {{grammage}}g/m²
- **Impression** : Quadrichromie (CMJN) recto
- **Finition** : {{finition}}
- **Quantité commandée** : {{quantite}} exemplaires

### Avantages de l''affiche A1
Le format A1 offre une visibilité exceptionnelle tout en conservant un poids et une logistique gérables. Qu''elle soit imprimée sur papier **couché brillant** pour un rendu premium ou **papier offset** pour un aspect plus classique, votre affiche bénéficie d''une prise en main professionnelle. La {{finition}} appliquée protège vos créations et améliore leur durabilité.

### Respectueux de l''environnement
Nous proposons nos affiches A1 sur papiers certifiés **FSC** et **PEFC**, garantissant une gestion responsable des forêts. Ideal pour les entreprises soucieuses de leur empreinte écologique.',
  'Affiche A1 {{format}} {{grammage}}g/m² en {{papier}} {{finition}} - Impression Quadrichromie',
  'Affiche A1 {{papier}} {{grammage}}g/m² | Impression pro',
  'Affiche A1 (594×841 mm) en quadrichromie {{papier}} {{grammage}}g/m² {{finition}}. Commandez à partir de {{quantite}} ex. Livraison rapide, qualité garantie.',
  'Product',
  '[{"title": "Campagnes publicitaires et marketing", "description": "Maximisez votre impact visuel avec une affiche A1 en quadrichromie. Parfaite pour annoncer promotions, lancements de produits ou événements. Le grand format assure une visibilité optimale en point de vente, gare, ou affichage urbain."}, {"title": "Événementiel et communication culturelle", "description": "Affichage de spectacles, concerts, conférences ou expositions. L''affiche A1 est le format standard des circuits d''affichage publicitaire. Impression de qualité premium en papier couché pour un effet haut de gamme."}, {"title": "Signalétique commerciale et interne", "description": "Utilisez l''affiche A1 pour vos vitrines, halls d''entrée ou espaces d''attente. Avec finition pelliculée, elle résiste mieux aux manipulations et conserve ses couleurs dans le temps."}, {"title": "Affichage en intérieur et extérieur", "description": "Grâce à des papiers de qualité supérieure et finitions adaptées (brillant, mat, soft-touch), vos affiches A1 restent impeccables en environnement intérieur ou semi-extérieur avec protection appropriée."}]'::jsonb,
  '[{"question": "Quelles sont les dimensions exactes d''une affiche A1 ?", "answer": "Une affiche A1 mesure 594 × 841 mm (soit 59,4 × 84,1 cm). C''est le format standard international, obtenu en divisant une feuille A0 par deux. Parfait pour l''affichage public et les campagnes commerciales."}, {"question": "Quel papier choisir pour mon affiche A1 ?", "answer": "Pour une affiche publicitaire de prestige, nous recommandons un **papier couché brillant** (200-250 g/m²) qui rehausse les couleurs. Pour un style plus classique ou institutionnel, le **papier offset** convient parfaitement. Les papiers sont certifiés FSC ou PEFC pour un impact écologique minimal."}, {"question": "Qu''est-ce qu''une finition pelliculée et pourquoi la choisir ?", "answer": "Le **pelliculage** (brillant, mat ou soft-touch) ajoute une couche protectrice transparente sur votre affiche. Il améliore la durabilité, protège contre l''usure et augmente l''éclat des couleurs. Idéal pour un affichage prolongé ou en environnement difficile. Le pelliculage mat offre un rendu plus sobre et moins réfléchissant."}, {"question": "Quels sont les délais de production et livraison ?", "answer": "Les délais dépendent de la quantité et de la complexité de votre création. Comptez généralement 3 à 5 jours ouvrés pour la production + délai de livraison. Pour les commandes urgentes, consultez-nous : nous proposons des options de production accélérée."}, {"question": "Y a-t-il une quantité minimale pour commander des affiches A1 ?", "answer": "Non, nous acceptons les petites commandes à partir d''un seul exemplaire. Cependant, pour les quantités plus importantes, des remises dégressives s''appliquent automatiquement, rendant vos achats en volume plus compétitifs."}, {"question": "Vos affiches A1 sont-elles écologiques ?", "answer": "Oui, tous nos papiers sont certifiés **FSC** (Forest Stewardship Council) ou **PEFC** (Programme de Reconnaissance de la Certification Forestière), garantissant une gestion responsable des forêts. Nous privilégions les encres respectueuses de l''environnement et réduisons nos déchets de production."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'affiche_a0', '{}'::jsonb, 'fr',
  'Affiche A0 - Gamme standard',
  ARRAY['affiche A0','affiche grand format','impression A0','affiche 841x1189','affiche quadrichromie','affiche publicitaire','affiche événement','impression grand format','affiche papier couché','affiche offset','impression CMJN','affiche FSC','affiche PEFC','affiche pelliculée','affiche mat','affiche brillant']::text[],
  'Affiche A0 {{grammage}}g {{papier}} - {{finition}} - {{quantite}} ex. | Impression quadrichromie',
  'Affiche A0 grand format (841×1189 mm) en {{papier}} {{grammage}}g avec finition {{finition}}. Impression quadrichromie haute définition.',
  '# Affiche A0 : Impact maximal pour vos campagnes

Notre gamme d''**affiches A0** (841 × 1189 mm) offre une surface d''impression généreuse idéale pour les campagnes publicitaires, les événements et la signalisation intérieure/extérieure. Impression en **quadrichromie (CMJN)** garantissant des couleurs éclatantes et une définition irréprochable.

## Caractéristiques techniques

Chaque affiche A0 est imprimée sur du papier {{papier}} {{grammage}}g avec une finition {{finition}} au choix :
- **Papier couché** : rendu premium, brillance optimale
- **Papier offset** : rendu naturel, économique
- **Finition mate** : élégante, anti-reflet
- **Finition brillante** : éclatante, haute protection
- **Pelliculage soft-touch** : tactile premium, très résistant

Certifiées **FSC ou PEFC**, nos affiches respectent les standards d''impression écologique.

## Pourquoi choisir nos affiches A0 ?

Format maximal de la gamme ISO, l''A0 capte l''attention immédiatement. Idéale pour les galeries, musées, festivals, points de vente et campagnes d''affichage urbain. Quantité de {{quantite}} exemplaires livrés à plat, prêts à l''affichage ou à la mise en place sur cadre/châssis.',
  'Affiche A0 {{grammage}}g en {{papier}} {{finition}} - Impression quadrichromie professionnelle',
  'Affiche A0 grand format | Impression quadrichromie',
  'Affiche A0 (841×1189mm) impression quadrichromie. Papier couché/offset, finition mate/brillante. Certifiée FSC/PEFC. Devis gratuit.',
  'Product',
  '[{"title": "Affichage événementiel", "description": "Concerts, expositions, festivals : l''A0 maximise la visibilité en lieux publics. Format dominant qui capte l''attention des passants."}, {"title": "Signalisation commerciale", "description": "Boutiques, galeries, musées : utilisez l''A0 pour promouvoir vos collections ou événements. Pelliculage brillant ou mat pour adaptation à tout environnement."}, {"title": "Campagnes publicitaires", "description": "Affichage urbain et périphérique : format standard pour les panneaux publicitaires. Excellente lisibilité de loin grâce au grand format."}, {"title": "Décoration intérieure", "description": "Art prints, posters design : l''A0 s''impose comme pièce maîtresse murale. Papier couché premium pour rendu artistique optimal."}]'::jsonb,
  '[{"question": "Quelles sont les dimensions exactes d''une affiche A0 ?", "answer": "L''affiche A0 mesure 841 × 1189 mm (33,1 × 46,8 pouces). C''est le plus grand format de la gamme ISO, équivalant à 16 feuilles A4 (ou 4 feuilles A1)."}, {"question": "Quel papier recommandez-vous pour une affiche A0 ?", "answer": "Nous proposons du papier couché 135-300g/m² pour un rendu premium et brillant, ou du papier offset 120-200g/m² pour un look plus naturel et économique. Recommandation : 200g minimum pour une tenue optimale."}, {"question": "Peut-on imprimer des photos en haute définition sur l''A0 ?", "answer": "Oui, l''impression quadrichromie (CMJN) sur papier couché offre une résolution et une définition excellentes. Respectez une résolution de 300 dpi pour un rendu piqué. À distance de lecture, 150 dpi peut suffire."}, {"question": "Quelle finition choisir pour un affichage extérieur ?", "answer": "Pour l''extérieur, préférez la finition brillante ou le pelliculage soft-touch/brillant qui offrent une meilleure résistance aux UV et aux intempéries. Demandez un vernis de protection si exposition prolongée."}, {"question": "Quel délai pour imprimer une affiche A0 ?", "answer": "Les délais varient selon la quantité et les finitions. Comptez généralement 3-5 jours ouvrés pour une commande standard. Les commandes urgentes (48h) sont disponibles sur devis."}, {"question": "Comment est livrée l''affiche A0 ?", "answer": "Les affiches sont livrées à plat dans un carton de protection, en rouleau ou pochettes selon la quantité. Elles arrivent prêtes à l''affichage, sans pli ni dommage."}, {"question": "Est-ce que vos affiches A0 sont certifiées écologiquement ?", "answer": "Oui, nous proposons des papiers certifiés FSC ou PEFC issus de forêts gérées durablement. Demandez l''option lors de votre commande pour un engagement environnemental."}, {"question": "Quel est le grammage idéal pour une affiche A0 ?", "answer": "Un grammage de 170-200g/m² offre un bon équilibre entre rigidité et manipulation. Pour un usage premium ou affichage long terme, optez pour 250-300g/m²."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'depliant', '{}'::jsonb, 'fr',
  'Dépliant plié standard',
  ARRAY['dépliant','dépliant plié','dépliant publicitaire','impression dépliant','dépliant couleur','dépliant A4 plié','dépliant tri-pli','dépliant commercial','imprimerie dépliant','dépliant FSC','dépliant PEFC','dépliant quadrichromie']::text[],
  'Dépliant {{format}} {{grammage}} g/m² {{papier}} {{finition}} - Impression {{quantite}} ex',
  'Dépliant plié professionnel en {{papier}} {{grammage}} g/m² avec finition {{finition}}. Idéal pour vos campagnes commerciales et promotionnelles.',
  '# Dépliant {{format}} professionnel en {{papier}} {{grammage}} g/m²

Nos dépliants pliés combinent qualité d''impression et finitions premium pour valoriser votre message commercial. Imprimés en quadrichromie (CMJN) haute résolution, ils offrent des couleurs éclatantes et des détails nets qui captivent vos cibles. Disponibles en {{papier}} {{grammage}} g/m² avec finition {{finition}}, nos dépliants garantissent une tenue impeccable et une excellente perception de qualité.

## Caractéristiques techniques

- **Format** : {{format}} plié
- **Papier** : {{papier}} {{grammage}} g/m²
- **Impression** : Quadrichromie recto-verso
- **Finition** : {{finition}}
- **Quantité** : À partir de {{quantite}} exemplaires
- **Certifications écologiques** : FSC et PEFC disponibles

## Avantages de nos dépliants

Le format plié maximise l''impact visuel tout en respectant l''ergonomie de distribution et de stockage. La {{finition}} préserve les couleurs et protège le papier contre l''usure. Nos dépliants s''adaptent à tous vos besoins : promotions saisonnières, événements, supports commerciaux ou documentations techniques.

Commandez en toute confiance : délais rapides, tarifs compétitifs et conformité environnementale avec options FSC/PEFC.',
  'Impression de dépliants {{format}} en {{papier}} {{grammage}} g/m² - Finition {{finition}}',
  'Dépliant plié {{format}} {{grammage}}g - Impression pro',
  'Dépliants {{format}} {{grammage}}g/m² en {{papier}} avec finition {{finition}}. Impression quadrichromie, options FSC/PEFC. Commande à partir de {{quantite}} ex.',
  'Product',
  '[{"title": "Campagne marketing et promotion", "description": "Dépliants A4 tri-pli pour distribuer lors d''événements commerciaux, salons professionnels ou campagnes de communication. La finition brillante souligne les visuels accrocheurs et facilite la mémorisation de votre offre."}, {"title": "Documentation commerciale et devis", "description": "Dépliants présentant vos services, tarifs ou catalogue produit. Imprimés en haute qualité sur papier couché 250g, ils renforcent votre crédibilité auprès des prospects et clients B2B."}, {"title": "Communication touristique et culturelle", "description": "Dépliants pour hôtels, musées, agences de voyage. Le format plié A4 s''intègre parfaitement dans les pochettes d''accueil et les comptoirs d''information. Papier résistant et finitions premium garantissent une bonne durée de vie."}, {"title": "Supports RSE et communication écologique", "description": "Dépliants certifiés FSC ou PEFC pour vos messages de développement durable. Papier écologique sans compromis sur la qualité d''impression, idéal pour renforcer votre image verte."}]'::jsonb,
  '[{"question": "Quels formats de dépliants sont disponibles ?", "answer": "Nous proposons les formats standards pliés : A4 (210×297 mm plié en 105×297 mm), A5 (148×210 mm), DL (99×210 mm tri-pli) et formats personnalisés sur demande. Le pliage peut être simple, double ou triple selon votre besoin."}, {"question": "Quels papiers recommandez-vous pour les dépliants ?", "answer": "Nous conseillons les papiers couché brillant ou mat pour une impression vibrante, ou offset pour un rendu plus naturel. Grammages recommandés : 170g (léger), 250g (standard), 300g (premium). Plus lourd = meilleure perception de qualité et durabilité accrue."}, {"question": "Quelle est la différence entre pelliculage brillant et mat ?", "answer": "Le pelliculage brillant amplifie les couleurs et crée un effet premium éclatant, idéal pour les produits luxe. Le mat offre un rendu élégant et épuré, réduit les reflets et convient mieux aux textes longs. Le soft-touch combine la douceur du mat avec une légère brillance."}, {"question": "Quel délai de livraison pour une commande de dépliants ?", "answer": "Délai standard : 5-7 jours ouvrables après validation du bon à tirer (BAT). Express possible sous 3 jours selon les quantités et options finition. FSC/PEFC peuvent ajouter 1-2 jours de traitement administratif."}, {"question": "Peut-on imprimer des dépliants avec vernis sélectif ou surimpression ?", "answer": "Oui, nous proposons le vernis sélectif pour mettre en avant certains éléments. Pour les surimpression (numérotation, personnalisation), des tarifs supplémentaires s''appliquent selon la complexité. Minimum de quantité peut être exigé."}, {"question": "Les dépliants sont-ils éligibles aux certifications écologiques ?", "answer": "Oui, tous nos dépliants peuvent être imprimés sur papier certifié FSC ou PEFC. Ces labels garantissent une gestion durable des forêts et constituent un atout communicationnel fort pour votre marque responsable."}, {"question": "Quel est le délai minimum de commande (quantité) ?", "answer": "Minimum : 100 exemplaires pour la plupart des configurations. Demandez un devis pour quantités plus faibles ou productions très élevées (dès 10 000 ex, tarifs dégressifs appliqués)."}, {"question": "Comment gérer les fichiers à imprimer (format, résolution) ?", "answer": "Formats acceptés : PDF haute résolution (300 dpi), fichiers sources (InDesign, Illustrator, CorelDraw). Nous fournissons un gabarit de pliage gratuit. Les fichiers doivent inclure 3-5 mm de débord pour la découpe (marges de sécurité)."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'brochure', '{}'::jsonb, 'fr',
  'Brochure standard - Dos carré collé',
  ARRAY['brochure','brochure dos carré collé','brochure imprimée','brochure couleur','brochure quadrichromie','brochure papier couché','brochure FSC','brochure PEFC','brochure pelliculée','brochure mat','brochure brillant','impression brochure','brochure A5','brochure A4','brochure B5','brochure personnalisée','imprimerie brochure','brochure d''entreprise','brochure produits','brochure présentation']::text[],
  'Brochure {{pages}} pages {{format}} - {{grammage}}g {{papier}} {{finition}} | Dos carré collé',
  'Brochure {{pages}} pages {{format}} en {{grammage}}g {{papier}}, {{finition}}, dos carré collé. Impression couleur quadrichromie haute qualité. {{quantite}} ex.',
  '## Brochure {{pages}} pages {{format}} - Dos carré collé {{finition}}

Votre brochure professionnelle imprimée en quadrichromie (CMJN) sur papier {{papier}} {{grammage}}g/m². Avec dos carré collé, elle offre une tenue impeccable et une présentation soignée. Finition {{finition}} pour un rendu premium adapté à votre identité visuelle.

### Caractéristiques techniques

- **Format** : {{format}} (idéal pour présentation et distribution)
- **Nombre de pages** : {{pages}} pages
- **Grammage** : {{papier}} {{grammage}}g/m² (structure robuste et prestige)
- **Impression** : {{impression_recto}} {{impression_verso}} quadrichromie haute définition
- **Finition** : {{finition}} (protection et toucher premium)
- **Reliure** : Dos carré collé professionnel (couture possible en option)
- **Quantité minimum** : {{quantite}} exemplaires
- **Certifications** : Papier FSC/PEFC disponible

### Usages professionnels

Parfaite pour les catalogues produits, présentations d''entreprise, dossiers commerciaux, portfolios créatifs et guides clients. Le dos carré collé garantit une durabilité optimale et une image premium.',
  'Brochure {{pages}} pages {{format}} {{finition}} - Impression professionnelle dos carré collé',
  'Brochure dos carré collé {{format}} | Impression couleur',
  'Brochure {{pages}} pages {{format}} en {{grammage}}g {{papier}}, finition {{finition}}. Dos carré collé, quadrichromie. À partir de {{quantite}} ex.',
  'Product',
  '[{"title": "Catalogue produits B2B", "description": "Brochure 20-24 pages A4 en papier couché 300g brillant. Présente votre gamme produits en haute résolution couleur avec photos premium. Le dos carré collé assure une durée de vie prolongée en mains de clients."}, {"title": "Dossier de présentation commerciale", "description": "Brochure A5 8-12 pages en papier couché 250g mat finition soft-touch. Format compact, facile à distribuer lors de réunions ou salons. Impression recto-verso couleur optimale pour valoriser vos services et savoir-faire."}, {"title": "Guide client ou manuel produit", "description": "Brochure A4 16-32 pages papier offset blanc 100g intérieur, couverture 300g pelliculée. Dos carré collé robuste pour usage intensif. Parfait pour documentation technique, mode d''emploi ou guide d''utilisation distribué massivement."}, {"title": "Portfolio créatif ou dossier de candidature", "description": "Brochure 12-20 pages B5 papier couché premium 200g mate. Finition vernis sélectif sur couverture pour effet prestige. Dos carré collé haut de gamme. Idéale pour agences créatives, photographes et freelances."}]'::jsonb,
  '[{"question": "Quel est le nombre minimum de pages pour une brochure dos carré collé ?", "answer": "Le minimum est généralement de 8 pages (4 feuilles). Pour un impact optimal et une reliure stable, nous recommandons au minimum 12 pages. Le nombre de pages doit être multiple de 4."}, {"question": "Quels formats sont disponibles pour les brochures ?", "answer": "Les formats standards sont A6, A5, A4, B6 et B5. D''autres formats personnalisés sur demande. A5 (14,8 x 21 cm) et A4 (21 x 29,7 cm) sont les plus populaires pour les brochures professionnelles."}, {"question": "Quelle différence entre papier couché mat et brillant pour une brochure ?", "answer": "Le papier couché brillant offre des couleurs éclatantes et un effet premium, idéal pour les catalogues produits. Le mat est plus discret, anti-reflet, et convient aux textes denses et dossiers professionnels. Le soft-touch combine toucher velouté et légère brillance."}, {"question": "Le dos carré collé est-il aussi solide qu''une couture ?", "answer": "Oui, pour la plupart des usages. La colle professionnelle garantit une tenue excellente. Pour très haute durabilité (manuels techniques, guides d''utilisation intensive), nous proposons la couture optionnelle en supplément."}, {"question": "Puis-je obtenir une brochure FSC ou PEFC ?", "answer": "Tout à fait. Nous proposons des papiers certifiés FSC (Forest Stewardship Council) et PEFC pour une démarche éco-responsable. À préciser à la commande, coût additionnel minimal."}, {"question": "Quel grammage recommandez-vous pour une couverture vs l''intérieur ?", "answer": "Couverture : 250-300g minimum (robustesse et prestige). Intérieur : 100-150g suffisant (économies possibles). Recommandation : couverture 300g brillant + intérieur 150g offset offre excellent rapport qualité/prix."}, {"question": "Les délais de production pour une brochure dos carré collé ?", "answer": "Délai standard : 7-10 jours ouvrés. Dépend du volume, grammage et finitions (vernis, pelliculage ralentissent légèrement). Urgent possible sur devis. Délai de livraison transport à ajouter."}, {"question": "Puis-je commander une brochure en petite quantité (moins de 100 ex) ?", "answer": "Oui, quantités à partir de 50-100 exemplaires selon le format et options. Les petites quantités sont légèrement plus chères à l''unité. Demandez un devis personnalisé pour votre projet."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'brochure_dos_carre', '{}'::jsonb, 'fr',
  'Brochure dos carré collé',
  ARRAY['brochure dos carré collé','brochure reliée','dos carré','brochure imprimée','brochure professionnel','reliure dos carré collé','brochure couleur CMJN','brochure papier couché','brochure FSC PEFC','brochure pelliculée','commande brochure en ligne','impression brochure B2B']::text[],
  'Brochure dos carré collé {{format}} {{pages}} pages - {{grammage}}g {{papier}} - {{quantite}} ex.',
  'Brochure {{format}} reliée dos carré collé en {{papier}} {{grammage}}g. Finition {{finition}}, impression {{impression_recto}}. Dès {{quantite}} exemplaires.',
  '## Brochure dos carré collé : reliure professionnelle et durable

Notre gamme de **brochures dos carré collé** combine solidité structurelle et élégance visuelle. Parfaite pour les catalogues, rapports d''activité, portfolios et présentations commerciales, cette reliure garantit une tenue exceptionnelle dans le temps. Le dos carré collé crée une colonne vertébrale rigide et des plats parfaitement alignés, donnant à votre brochure une présentation haut de gamme.

## Caractéristiques techniques et options de personnalisation

Vos brochures sont imprimées en **quadrichromie (CMJN)** sur papier {{papier}} {{grammage}}g, offrant des couleurs vibrantes et une reproduction d''image fidèle. Choisissez entre pelliculage **{{finition}}** (brillant pour plus de contraste, mat pour une finition premium, ou soft-touch pour un toucher velouté). Disponible en formats standards ou sur mesure, de {{pages}} pages minimum, votre brochure peut combiner dos recto/verso imprimé et couverture renforcée.

## Conformité écologique et production optimisée

Nos papiers sont certifiés **FSC ou PEFC**, garantissant une gestion responsable des forêts. Pour commandes de {{quantite}} exemplaires et plus, bénéficiez de tarifs dégressifs et de délais de production courts. Impression haute résolution 2400 dpi, pliage et assemblage automatisés, finition professionnelle.',
  'Brochure dos carré collé {{format}} {{pages}} pages en {{papier}} {{grammage}}g avec finition {{finition}}',
  'Brochure dos carré collé | Impression professionnel',
  'Brochure reliée dos carré collé. Impression quadrichromie, papiers FSC/PEFC, finitions pelliculées. Dès {{quantite}} ex. Devis gratuit.',
  'Product',
  '[{"title": "Catalogues commerciaux", "description": "Présentez vos produits ou services avec une brochure dos carré collé robuste. Idéale pour les remises en mains lors de salons, showrooms ou prospection B2B. La reliure solide protège les pages et assure une durabilité maximale."}, {"title": "Rapports annuels et rapports d''activité", "description": "Communiquez vos résultats et votre vision avec un document professionnel et officiel. Le dos carré collé confère une légitimité et une crédibilité aux publications d''entreprise, collectivités et associations."}, {"title": "Portfolios et livres de prestige", "description": "Mettez en valeur votre portfolio créatif, photographique ou architectural. Les brochures dos carré collé avec pelliculage soft-touch et papiers haut de gamme créent une impression durable auprès de vos prospects et clients."}, {"title": "Guides, manuels et formation", "description": "Proposez des guides utilisateur, manuels techniques ou supports de formation durables. La reliure dos carré collé permet une consultation prolongée sans risque de détachement des pages."}]'::jsonb,
  '[{"question": "Quelle est la différence entre dos carré collé et agrafage ?", "answer": "Le dos carré collé offre une reliure bien plus robuste et professsionnelle. Contrairement à l''agrafage, le dos carré est collé sur toute sa hauteur, offrant une meilleure tenue mécanique et une capacité à supporter des brochures épaisses (20+ pages). Idéal pour les documents qui circulent longtemps."}, {"question": "Quel papier recommandez-vous pour une brochure dos carré collé ?", "answer": "Nous préconisons un papier couché brillant ou mat 250-300g pour la couverture (protection et esthétique) et 80-150g pour l''intérieur. Le papier offset est une alternative économique. Tous nos papiers sont certifiés FSC ou PEFC pour une démarche écoresponsable."}, {"question": "Combien de pages minimum pour une brochure dos carré collé ?", "answer": "Le minimum conseillé est 8 pages (2 feuilles pliées). En pratique, à partir de 12-16 pages, la reliure dos carré collé révèle tout son intérêt. Il n''y a pas de maximum : nous produisons des brochures de 100+ pages sans surcoût technique."}, {"question": "Quels délais et quantités minimums ?", "answer": "Quantité minimum : 50 exemplaires. Délai standard : 5-7 jours ouvrés après validation du BAT. Versioning/fichier : PDF haute résolution en 3mm de débord. Nos équipes peuvent accélérer la production sur demande."}, {"question": "Puis-je combiner plusieurs finitions (brillant/mat) sur une même brochure ?", "answer": "Oui, vous pouvez appliquer une finition brillante sur la couverture et une finition mate sur les pages intérieures, ou inversement. Cela ajoute peu de surcoût et crée des effets visuels distinctifs."}, {"question": "Comment garantir la qualité d''impression des couleurs ?", "answer": "Nous utilisons le standard CMJN (quadrichromie) et livrons un BAT (Bon À Tirer) avant production. Nos presses offset 2400 dpi respectent les profils ICC. Papiers certifiés et inks écologiques assurent une fidélité colorimétrique optimale."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'brochure_piquee', '{}'::jsonb, 'fr',
  'Brochure piquée 2 points',
  ARRAY['brochure piquée','brochure 2 points','brochure agrafée','brochure reliée piquée','imprimerie brochure','brochure quadrichromie','brochure pas cher','impression brochure','brochure A5','brochure A4','papier couché brochure','brochure FSC','brochure PEFC','brochure pelliculée','brochure brillant','brochure mat','web-to-print brochure']::text[],
  'Brochure Piquée 2 Points {{pages}} Pages {{format}} | {{grammage}}g {{papier}} | {{quantite}} ex',
  'Brochure piquée {{pages}} pages en {{format}}, {{papier}} {{grammage}}g, parfait pour catalogues, magazines et plaquettes commerciales.',
  '## Brochure Piquée 2 Points : Reliure Simple et Efficace

Notre gamme de **brochures piquées 2 points** offre une solution de reliure économique et professionnelle pour vos documents de {{quantite}} exemplaires. Idéale pour les catalogues, magazines, plaquettes commerciales et dossiers, cette reliure par agrafage au point combine robustesse et coût maîtrisé.

## Caractéristiques Techniques

La brochure piquée est composée de feuilles {{papier}} de {{grammage}}g/m² assemblées au centre par deux points d''agrafage métallique. Ce procédé garantit une excellente tenue mécanique tout en préservant une flexibilité de lecture optimale. Disponible en **{{format}}**, elle s''adapte à tous les besoins de communication : branding, présentation produits, contenus éditoriaux.

### Finitions et Options

Personnalisez votre brochure avec des finitions premium : **pelliculage brillant** pour un rendu épuré et protection renforcée, **pelliculage mat** pour un toucher noble et antireflet, ou **pelliculage soft-touch** pour une sensation haut de gamme. Impression en **quadrichromie (CMJN)** recto-verso pour des couleurs éclatantes et une couverture impactante.

## Papier Écologique et Certification

Nos brochures sont imprimées sur papier certifié **FSC ou PEFC**, respectant les standards de gestion forestière responsable. Choix entre papier couché (brillant, idéal quadrichromie) ou offset (mat, texturé) selon votre univers graphique.

**Quantité minimum flexible** | **Délai court** | **Tarif dégressif**',
  'Brochure Piquée 2 Points {{pages}} Pages {{format}} en {{papier}} {{grammage}}g',
  'Brochure Piquée 2 Points | Impression Agrafée Pas Cher',
  'Brochure piquée 2 points, impression quadrichromie, papier FSC, finition brillant/mat. Devis rapide pour {{quantite}} ex.',
  'Product',
  '[{"title": "Catalogue Produits", "description": "Présentez votre offre complète avec une brochure piquée A4 couleur quadrichromie. L''agrafage 2 points assure une reliure durable pour un catalogue destiné aux points de vente, congrès ou envois postaux."}, {"title": "Magazine ou Journal Interne", "description": "Publiez votre actualité d''entreprise dans une brochure piquée de 12 à 48 pages. Le papier couché {{grammage}}g met en valeur photographies et mise en page, tandis que la reliure piquée convient parfaitement à une distribution régulière."}, {"title": "Plaquette Commerciale ou Portfolio", "description": "Imprimez vos références et services sur une brochure A5 ou A4 avec couverture pelliculée brillant. L''agraçage 2 points crée un produit fini professionnel, robuste et facilement distribuable en salon ou sur le terrain."}, {"title": "Dossier de Présentation ou Appel d''Offres", "description": "Reliez vos documents techniques ou commerciaux avec une brochure piquée certifiée FSC. Impression recto-verso en quadrichromie, elle donne du crédit à vos projets auprès de clients B2B exigeants."}]'::jsonb,
  '[{"question": "Quel est le nombre minimum de pages pour une brochure piquée 2 points ?", "answer": "La brochure piquée fonctionne avec un minimum de 4 pages (couverture + intérieur). Nous recommandons un nombre de pages multiple de 4 pour optimiser la production. Nos équipes adaptent le cahier à vos contenus jusqu''à 120+ pages."}, {"question": "Quels formats sont disponibles en brochure piquée ?", "answer": "Les formats standards proposés : A6, A5, A4 et formats personnalisés. Chaque format peut être décliné en portrait ou paysage selon votre maquette. Consultez notre sélecteur pour vérifier les combinaisons possibles."}, {"question": "Qu''est-ce que la quadrichromie et pourquoi c''est important pour ma brochure ?", "answer": "La quadrichromie (CMJN : Cyan, Magenta, Jaune, Noir) est l''impression couleur standard. Elle restitue l''intégralité de la palette chromatique à partir de 4 encres. Idéale pour catalogues et magazines, elle offre le meilleur rapport qualité/coût en impression offset."}, {"question": "Quelle différence entre papier couché et offset pour ma brochure ?", "answer": "Le papier **couché** a un revêtement lisse qui amplifie les couleurs et crée un rendu brillant naturel (idéal quadrichromie). L''**offset** est non-revêtu, plus texturé, offrant une toucher plus naturel et réduisant les reflets. Choisissez selon votre univers : premium/coloré → couché ; sobre/éditorial → offset."}, {"question": "Puis-je ajouter du pelliculage (vernis) sur la couverture ?", "answer": "Oui, nous proposons trois finitions : pelliculage **brillant** (protection maximum, couleurs éclatantes), **mat** (antireflet, toucher premium), et **soft-touch** (velouté haut de gamme). Ces finitions s''appliquent recto et/ou verso de la couverture uniquement, renforçant durabilité et présentation."}, {"question": "Vos brochures sont-elles écologiques (FSC/PEFC) ?", "answer": "Oui, nous imprimons sur papiers certifiés **FSC** (Forest Stewardship Council) ou **PEFC** (Programme for the Endorsement of Forest Certification), garantissant une gestion forestière responsable. Tous nos papiers respectent la traçabilité environnementale. Précisez votre préférence en devis."}, {"question": "Quel est le délai de production et livraison ?", "answer": "Délai moyen : 5 à 10 jours ouvrés selon quantité, format et finitions. Pour quantités importantes (>10 000 ex.) ou spécifications techniques, prévoir 2-3 semaines. Livraison : France en 48-72h après production, EU sur devis. Nous proposons aussi des délais express (48h) sur certains produits."}, {"question": "La reliure piquée 2 points est-elle assez solide ?", "answer": "Oui, l''agraçage 2 points offre une excellente tenue mécanique, recommandée pour brochures jusqu''à 60-80 pages. Au-delà, nous proposons des reliures alternatives (dos carré collé, spirale). L''agrafage est invisible/discret et crée un produit fini très professionnel."}, {"question": "Puis-je combiner recto seul et recto-verso dans une même brochure ?", "answer": "Oui, c''est courant. Par exemple : couverture 4 couleurs recto-verso, intérieur 2 couleurs recto-verso. Chaque cahier se configure indépendamment pour adapter vos coûts aux zones prioritaires (couverture impactante, intérieurs informatifs)."}, {"question": "Acceptez-vous mes fichiers PDF/AI ? Quels fichiers fournir ?", "answer": "Oui, nous acceptons PDF (haute résolution 300 dpi), AI (Illustrator), PSD (Photoshop) et InDesign. Les fichiers doivent être aux bonnes dimensions (avec traits de coupe), polices intégrées ou vectorisées, couleurs en CMJN. Une épreuve numérique vous est proposée avant impression."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'brochure_spirale', '{}'::jsonb, 'fr',
  'Brochure WireO - Définition générique',
  ARRAY['brochure spirale','brochure wireo','reliure spirale métallique','brochure reliée spirale','impression brochure spirale','brochure piqûre spirale','brochure reliure à anneaux','brochure professionnelle spirale','wireo impression','spirale métallique impression']::text[],
  'Brochure Spirale {{format}} {{pages}} pages - {{grammage}} {{papier}} - {{finition}}',
  'Brochure spirale {{format}} avec reliure WireO métallique. {{pages}} pages en {{papier}} {{grammage}}. Finition {{finition}} pour un rendu premium.',
  '# Brochure Spirale WireO Professionnelle

Votre brochure {{format}} bénéficie d''une **reliure spirale WireO métallique** robuste et élégante. Cette technique de reliure offre une tenue exceptionnelle et permet une ouverture à 360°, idéale pour les catalogues, manuels techniques, portfolios et présentations professionnelles. Imprimée en {{pages}} pages sur papier {{papier}} {{grammage}}, elle garantit une qualité de rendu optimale en quadrichromie (CMJN) avec une finition {{finition}} pour un effet {{finition == ''mat'' ? ''discret et haut de gamme'' : finition == ''brillant'' ? ''éclatant et dynamique'' : ''velouté et tactile''}}.

## Caractéristiques techniques

- **Format** : {{format}}
- **Reliure** : Spirale WireO métallique (disponible en noir, argent ou couleur)
- **Pages** : {{pages}} pages
- **Papier** : {{papier}} {{grammage}} g/m²
- **Impression** : {{impression_recto && impression_verso ? ''Recto-verso intégral'' : ''Selon vos besoins''}}
- **Finition** : {{finition}} (anti-reflet ou haute brillance)
- **Quantité** : À partir de {{quantite}} exemplaires

## Avantages de la reliure spirale

La spirale WireO confère à votre brochure une **présentation professionnelle** tout en facilitant la consultation. Les pages restent parfaitement alignées, la reliure ne s''use pas et chaque feuillet peut être tourné indépendamment. Disponible en papiers certifiés FSC ou PEFC pour une démarche éco-responsable, cette solution s''adapte à tous les secteurs : immobilier, consulting, formation, marketing, technique.

## Options de personnalisation

Combinez la reliure spirale avec des finitions premium : pelliculage brillant pour un rendu glossy, mat pour l''élégance, ou soft-touch pour une sensation veloutée. Ajoutez une couverture renforcée ou des surcharges sélectives pour renforcer l''impact visuel.',
  'Brochure Spirale {{format}} WireO Métallique {{pages}} Pages | Impression {{papier}} {{grammage}}',
  'Brochure Spirale WireO | Reliure Métallique Professionnelle',
  'Brochure spirale WireO : reliure robuste et élégante pour catalogues, manuels et portfolios. Impression qualité quadrichromie. Devis gratuit.',
  'Product',
  '[{"title": "Catalogue produits professionnel", "description": "Présentez votre gamme en brochure spirale WireO format A4 : chaque produit sur une page indépendante, facilement consultable et durable. Idéal pour les salons, présentations clients et showrooms."}, {"title": "Manuel technique et formation", "description": "Les manuels d''utilisation, guides de maintenance ou supports de formation bénéficient de la solidité de la spirale WireO. Les utilisateurs peuvent laisser une page ouverte pendant la consultation, sans crainte que le document se ferme."}, {"title": "Portfolio et book créatif", "description": "Designers, photographes et agences utilisent la brochure spirale pour présenter leurs réalisations avec un effet premium. La reliure métallique renforce la perception de qualité et de professionnalisme."}, {"title": "Dossier de présentation commercial", "description": "Impressionnez vos prospects avec un dossier spiralé format A5 ou A4 : pages certifiées FSC, finition pelliculée brillante ou soft-touch, et reliure métallique personnalisée aux couleurs de votre marque."}]'::jsonb,
  '[{"question": "Quel est le délai de fabrication pour une brochure spirale WireO ?", "answer": "Le délai standard est de 5 à 7 jours ouvrables après validation du BAT, selon la complexité du fichier et la quantité commandée. Des délais express (48h) peuvent être proposés sur devis. Contactez-nous pour vos besoins urgents."}, {"question": "Quels formats sont disponibles pour une reliure WireO ?", "answer": "Nous proposons tous les formats standard : A6, A5, A4, A3 et formats personnalisés. Le format influe sur la longueur et le coût de la spirale. Plus le format est grand, plus la spirale doit être longue et robuste."}, {"question": "Puis-je imprimer en couleur (quadrichromie) sur une brochure spirale ?", "answer": "Bien sûr ! Toutes nos brochures spirales sont imprimées en quadrichromie CMJN recto-verso, offrant des couleurs vives et des contrastes optimaux. Vous pouvez utiliser des pantones supplémentaires selon vos besoins spécifiques."}, {"question": "Quels papiers sont recommandés pour une brochure spirale ?", "answer": "Nous proposons papier offset (90-150 g/m²) pour un rendu naturel, papier couché (135-300 g/m²) pour un effet lisse et brillant, et papiers certifiés FSC/PEFC pour une démarche écologique. Demandez un échantillon pour tester la toucher et l''épaisseur."}, {"question": "Peut-on ajouter une finition (pelliculage, vernis) sur une brochure spirale ?", "answer": "Oui ! Nous proposons pelliculage brillant (haute brillance), mat (discrétion), et soft-touch (velours). Ces finitions s''appliquent à la couverture ou à l''intégralité de la brochure. Elles renforcent la protection et l''esthétique de votre produit."}, {"question": "Quelle est la quantité minimale de commande pour une brochure WireO ?", "answer": "La quantité minimale dépend du format et des options. En général, nous acceptons des commandes à partir de 25 à 100 exemplaires. Contactez-nous pour les petites quantités : nous étudions chaque projet individuellement."}, {"question": "Les brochures spirales sont-elles écologiques ?", "answer": "Oui ! Nous utilisons des papiers certifiés FSC (Forest Stewardship Council) ou PEFC (Programme for the Endorsement of Forest Certification), garantissant une gestion responsable des forêts. Les encres utilisées sont à base végétale et les spirales sont recyclables."}, {"question": "Puis-je personnaliser la couleur de la spirale WireO ?", "answer": "Absolument ! Les spirales WireO sont disponibles en noir (standard), argent, blanc, or, bleu, rouge et d''autres teintes. Cette personnalisation renforce l''identité visuelle de votre brochure et s''adapte à vos codes couleur de marque."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

insert into public.product_definitions
  (gamme_slug, variation_filter, locale, name, keywords, title_template,
   short_description_template, description_template, h1_template,
   seo_title, seo_description, schema_org_type, usage_examples, faq,
   generated_by, validated_by)
values (
  'brochure_cousue', '{}'::jsonb, 'fr',
  'Brochure Cousue - Définition Produit',
  ARRAY['brochure cousue','brochure reliure cousue','brochure piqûre fil','brochure dos carré cousu','impression brochure','brochure couleur','brochure FSC','brochure PEFC','brochure professionnelle','brochure catalogue','brochure quadrichromie','brochure pelliculée','brochure papier couché','brochure pages multiples','imprimerie brochure','commander brochure en ligne','brochure personnalisée']::text[],
  'Brochure Cousue {{pages}} Pages {{format}} {{grammage}}g/m² | {{papier}} {{finition}}',
  'Brochure {{pages}} pages {{format}} en {{papier}} {{grammage}}g/m² reliure cousue. Impression {{impression_recto}} {{finition}}. Qualité premium pour vos projets de communication.',
  '# Brochure Cousue Professionnelle

La brochure cousue {{format}} est la solution de communication idéale pour les projets exigeant une **présentation premium et une durabilité optimale**. Avec sa reliure cousue (également appelée piqûre fil ou dos carré cousu), cette brochure offre une tenue exceptionnelle et un rendu professionnel qui se distingue clairement des brochures agrafées standards.

## Caractéristiques Techniques

Votre brochure est composée de **{{pages}} pages** imprimées en {{impression_recto}} sur papier **{{papier}} {{grammage}}g/m²**, garantissant à la fois lisibilité et prestige. La reliure cousue assure une ouverture fluide et une longévité accrue, même avec une consultation intensive. Disponible en {{finition}} pour adapter l''esthétique à votre image de marque : brillant pour l''impact visuel, mat pour l''élégance épurée, ou soft-touch pour un toucher premium.

## Qualité et Responsabilité Écologique

Nos brochures cousues peuvent être produites sur papiers certifiés **FSC ou PEFC**, répondant aux critères de gestion durable des forêts. Cette démarche écologique renforce votre engagement corporate sans compromis sur la qualité d''impression en quadrichromie (CMJN).

## Idéale Pour

Catalogues produits haut de gamme, rapports annuels, plaquettes commerciales, présentations d''établissements (écoles, hôtels, immobilier), portfolios créatifs, guides de marque et tous projets de communication demandant professionnalisme et pérennité.',
  'Brochure Cousue {{pages}} Pages en {{format}} | Impression {{papier}} {{grammage}}g/m² {{finition}}',
  'Brochure Cousue Professionnelle | Fiable & Premium',
  'Brochure cousue de qualité avec reliure fil robuste. Formats personnalisables, papiers FSC/PEFC, finitions brillant/mat. Impression couleur CMJN.',
  'Product',
  '[{"title": "Catalogue Produits Luxe", "description": "Présenter votre offre premium avec une brochure cousue {{pages}} pages en papier couché brillant {{grammage}}g/m². La reliure cousue garantit une consultation confortable et prolongée, idéale pour mettre en avant des produits haut de gamme ou des collections saisonnières."}, {"title": "Rapport Annuel Entreprise", "description": "Communiquer transparence et solidité financière via une brochure professionnelle au toucher premium. La reliure cousue et le pelliculage {{finition}} renforcent l''image corporate et facilitent l''archivage sans usure."}, {"title": "Plaquette Institutionnelle", "description": "Établissements scolaires, hôtels, agences immobilières : exploitez les {{pages}} pages pour raconter votre histoire. Impression quadrichromie sur papier {{papier}}, finition {{finition}} pour une perception haut de gamme."}, {"title": "Portfolio & Lookbook Créatif", "description": "Photographes, designers, agences : présentez vos créations dans une brochure cousue {{format}} qui valorise vos travaux. Le papier couché offre un rendu couleur éclatant et la reliure fiable facilite la manipulation."}]'::jsonb,
  '[{"question": "Qu''est-ce qu''une brochure cousue et comment diffère-t-elle d''une brochure agrafée ?", "answer": "La brochure cousue utilise une reliure fil (piqûre fil ou dos carré cousu) qui traverse les signatures du cahier, contrairement à l''agraçage qui ne lie que les feuillets extérieurs. Avantages : meilleure durabilité, ouverture à plat fluide, aspect plus premium, et tenue dans le temps. Idéale pour catalogues, rapports et communication haut de gamme."}, {"question": "Quels grammages et papiers sont recommandés pour une brochure cousue ?", "answer": "Nous proposons papiers offset et couchés de 80 à 350g/m² selon vos besoins. Pour intérieurs : 80-170g/m² (économique, fluide). Pour couvertures : 200-350g/m² (impact, rigidité). Le papier couché (mat, brillant ou soft-touch) rehausse les couleurs CMJN et fera forte impression."}, {"question": "Quel est le délai de production d''une brochure cousue personnalisée ?", "answer": "Les délais varient selon la quantité et la complexité du projet. Comptez généralement 10-15 jours ouvrés pour une commande standard. Les délais express (3-5 jours) sont disponibles pour certains paramètres. Consultez-nous pour un devis précis."}, {"question": "Puis-je obtenir une brochure cousue certifiée FSC ou PEFC ?", "answer": "Oui, toutes nos brochures cousues peuvent être produites sur papiers FSC ou PEFC selon votre engagement écologique. Ces certifications attestent d''une gestion responsable des forêts et renforcent votre démarche développement durable."}, {"question": "Quelles finitions sont disponibles pour ma brochure cousue ?", "answer": "Nous proposons pelliculage brillant (impact, élégant), mat (discrétion, antireflet), ou soft-touch (toucher premium, chaleureux). Le pelliculage protège l''impression et améliore la durabilité. Sans pelliculage est également possible pour un style épuré."}, {"question": "Quelle quantité minimale pour commander une brochure cousue ?", "answer": "Les quantités minimales dépendent de la configuration (format, pages, grammages). En général, comptez 100-250 exemplaires pour les petites commandes. Contactez-nous pour explorer options et tarifs selon votre budget."}]'::jsonb,
  'llm',
  'pending'
)
on conflict (gamme_slug, variation_filter, locale) do update set
  name = excluded.name,
  keywords = excluded.keywords,
  title_template = excluded.title_template,
  short_description_template = excluded.short_description_template,
  description_template = excluded.description_template,
  h1_template = excluded.h1_template,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  usage_examples = excluded.usage_examples,
  faq = excluded.faq,
  generated_by = 'llm',
  version = product_definitions.version + 1;

commit;
