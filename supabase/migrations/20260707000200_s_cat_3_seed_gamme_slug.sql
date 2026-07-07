-- S-CAT-3 (ADR-4.17) — SEED gamme_slug au niveau RACINE (famille), sans format.
-- Corrige suite retour Arnaud 2026-07-07. A appliquer APRES 20260707000100.

BEGIN;
UPDATE public.product_library SET gamme_slug='etiquette' WHERE id='3fb937d0-de68-4754-9d01-c77a6f583a51'; -- Autocollants vitrine A5
UPDATE public.product_library SET gamme_slug='affiche' WHERE id='f3990281-33bc-4ae4-af86-8c890dca85fe'; -- Affiches A2 brillantes
UPDATE public.product_library SET gamme_slug='affiche' WHERE id='fc904dea-1c66-469c-89b4-08a3ec9ffa99'; -- Affiches A1 offset
UPDATE public.product_library SET gamme_slug='packaging' WHERE id='3fae0ec9-7cf5-4c0a-8d88-fde1e460b257'; -- Packaging ultra-premium - Finitions combinées
UPDATE public.product_library SET gamme_slug='packaging' WHERE id='0d9eea45-3be5-4b23-9057-3c3b8437ef00'; -- Packaging premium - Dorure à chaud
UPDATE public.product_library SET gamme_slug='packaging' WHERE id='63d5d611-b558-49d1-8cc9-c6591a3687aa'; -- Packaging premium - Vernis sélectif UV
UPDATE public.product_library SET gamme_slug='packaging' WHERE id='bf9893d4-22cf-472f-8742-5d030fa78578'; -- Packaging ultra-premium - Finitions combinées
UPDATE public.product_library SET gamme_slug='flyer' WHERE id='b2d5b98a-b4eb-4917-b9d6-4b0127db7780'; -- Flyers A5 ouverture
UPDATE public.product_library SET gamme_slug='carterie' WHERE id='8b97574b-b116-4f8d-b703-22000ad8f945'; -- Cartes de visite
UPDATE public.product_library SET gamme_slug='affiche' WHERE id='8cd518eb-cc1d-4e06-b58b-300f831a83c7'; -- Affiches vitrine A3
UPDATE public.product_library SET gamme_slug='depliant' WHERE id='50653217-d9ad-41b6-8700-9556d261cabc'; -- Dépliant 3 volets présentation
UPDATE public.product_library SET gamme_slug='flyer' WHERE id='b2903e1f-c0dc-4f97-a6eb-01d941059aed'; -- Flyers présentation A5
UPDATE public.product_library SET gamme_slug='carterie' WHERE id='32f1545c-2012-4600-8356-32c88ebf4eeb'; -- Cartes de visite premium
UPDATE public.product_library SET gamme_slug='affiche' WHERE id='132cd73d-3e1e-4f71-8385-7455b20d34d7'; -- Affiches vitrine A2
UPDATE public.product_library SET gamme_slug='kakemono' WHERE id='92afb017-b4e5-423c-ba4d-832a53ddee00'; -- Kakémonos roll-up 85×200cm
UPDATE public.product_library SET gamme_slug='depliant' WHERE id='6715c6e9-57fe-43a6-a650-a210cf0ee8cf'; -- Dépliant 3 volets A4
UPDATE public.product_library SET gamme_slug='carterie' WHERE id='0f38dbf6-a878-40a8-a086-6fa4543909c1'; -- Cartes de visite premium
UPDATE public.product_library SET gamme_slug='flyer' WHERE id='7898d44a-8c7b-483e-9259-94d069be0ee1'; -- Flyers A5 recto-verso
UPDATE public.product_library SET gamme_slug='kakemono' WHERE id='ef45145c-2204-4399-9d77-e9c0aa158dad'; -- Kakémono 85×200 cm
UPDATE public.product_library SET gamme_slug='brochure' WHERE id='152ffd82-f850-4ec6-82bd-e22e4751264b'; -- Brochure A4 8 pages
UPDATE public.product_library SET gamme_slug='carterie' WHERE id='09b17a75-cb04-43dd-9074-da8ac4710acb'; -- Cartes de visite pelliculage mat recto-verso
UPDATE public.product_library SET gamme_slug='carterie' WHERE id='9c60726b-2d32-428b-91ab-db3c1819459e'; -- Cartes de visite pelliculage mat recto-verso
UPDATE public.product_library SET gamme_slug='affiche' WHERE id='39c67b33-84ab-4be8-8a50-c2579912fba9'; -- Affiches vitrine A2
UPDATE public.product_library SET gamme_slug='flyer' WHERE id='38081f72-e839-416a-a7f7-2e0ab9c9f0c2'; -- Flyers promotionnels A5
UPDATE public.product_library SET gamme_slug='carterie' WHERE id='74d37f14-457b-45a7-be29-d6d2c4fb104a'; -- Cartes de visite équipe
UPDATE public.product_library SET gamme_slug='depliant' WHERE id='477af866-558b-4201-879f-8c3fcd2db48c'; -- Dépliant 3 volets présentation
UPDATE public.product_library SET gamme_slug='banderole' WHERE id='33b3619a-bdd9-4aa5-a5b7-e9f7d3394364'; -- Banderole d''ouverture
UPDATE public.product_library SET gamme_slug='carterie' WHERE id='dfa5a705-ab39-46e1-a42d-7af9220c4461'; -- Cartes de visite recto-verso
UPDATE public.product_library SET gamme_slug='carterie' WHERE id='19a05d7b-6bc8-4fda-8961-d58546903c83'; -- Cartes de visite pelliculage mat
UPDATE public.product_library SET gamme_slug='affiche' WHERE id='79d5da22-521f-47de-b603-aea8888e458c'; -- Affiches A2 brillantes
COMMIT;
