/**
 * Selecteur de client de la grille des commandes (E10.18e-1), COMPOSANT
 * LOCAL au module — docs/api/CONVENTIONS.md §8.24 point (iii) :
 * "un SELECTEUR A RECHERCHE sur `GET /customers?q=`... Composant local au
 * module (`commercial-orders/ui/components/`), pas de composant partage
 * cree dans ce lot."
 *
 * qa-review round 2 (2026-09-14), condition (b1) de l architecte — ce
 * composant est desormais une COQUILLE autour de
 * `createCustomerSearchController()` (`customer-filter-select.helpers.ts`) :
 * toute la machine d etat de la recherche (texte, chargement, resultats,
 * troncature, erreur — round 1 gerait deja ces cas, mais dans le composant
 * lui-meme, donc non testable) vit dans le controleur, et
 * `buildCustomerFilterOptions()` construit la liste d options affichees,
 * "Tous les clients" compris. Ce composant ne fait plus que :
 * - creer le controleur une fois, PARESSEUSEMENT (round 3, mineur :
 *   `useRef` seul evalue quand meme son argument a CHAQUE rendu, meme s il
 *   ne le conserve qu au premier — l initialisation paresseuse evite de
 *   construire un controleur/debounce jetable a chaque rendu) et miroiter
 *   son etat (`useState`) ;
 * - transmettre chaque frappe (`controller.setQuery`) ;
 * - parcourir les options rendues par `buildCustomerFilterOptions()` et
 *   appeler `onSelect`/`onClear` au clic.
 *
 * Round 2 (b1) — CE QUI RESTE NON PROUVE PAR UN TEST, EXPLICITEMENT : la
 * liaison generique du clic sur une option (est-ce bien `onSelect`/
 * `onClear` qui est appele, avec les bonnes valeurs, au bon clic) reste du
 * cablage React pur — ce depot n a aucun outil de rendu React. C est la
 * recette navigateur, jouee par le coordinateur, qui la verifie (mutations
 * R34/R35 de la campagne qa).
 */
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/ui/command';
import { customerDisplayName } from '../workspace/order-detail.helpers.ts';
import {
  buildCustomerFilterOptions,
  createCustomerSearchController,
  CUSTOMER_SEARCH_PAGE_SIZE,
  INITIAL_CUSTOMER_SEARCH_STATE,
  type CustomerSearchController,
  type CustomerSearchResult,
  type CustomerSearchState,
} from './customer-filter-select.helpers.ts';

const SEARCH_DEBOUNCE_MS = 300;
/** Borne du contrat sur `GET /customers?q=` (1 a 200 caracteres) — au-dela, le serveur repond 400. */
const CUSTOMER_SEARCH_QUERY_MAX_LENGTH = 200;

export type CustomerFilterSelectProps = Readonly<{
  testId: string;
  /** Testid des options de la liste — declare par l appelant, jamais derive de `testId` (qa-review round 1, m4). */
  optionTestId: string;
  /** `Customer.id` selectionne, ou chaine vide (aucun filtre client). */
  value: string;
  /** Libelle du client selectionne (deja connu de l appelant, aucun appel supplementaire). */
  selectedLabel: string;
  search: (query: string) => Promise<CustomerSearchResult>;
  onSelect: (customerId: string, label: string) => void;
  onClear: () => void;
}>;

export function CustomerFilterSelect({
  testId,
  optionTestId,
  value,
  selectedLabel,
  search,
  onSelect,
  onClear,
}: CustomerFilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchState, setSearchState] = useState<CustomerSearchState>(INITIAL_CUSTOMER_SEARCH_STATE);

  // Une seule instance de controleur par montage du composant, creee
  // PARESSEUSEMENT (round 3) : `useRef(createCustomerSearchController(...))`
  // evaluerait l appel — donc construirait un controleur/debounce jetable —
  // a CHAQUE rendu, meme si seul le premier est conserve.
  const controllerRef = useRef<CustomerSearchController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createCustomerSearchController(search, SEARCH_DEBOUNCE_MS, setSearchState);
  }

  useEffect(() => {
    const controller = controllerRef.current;
    return () => controller?.dispose();
  }, []);

  const triggerLabel = value ? selectedLabel : 'Tous les clients';
  const options = buildCustomerFilterOptions(searchState, Boolean(value), customerDisplayName);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testId}
          className="inline-flex items-center justify-between gap-2 px-2.5 py-1 rounded-md border border-line bg-paper text-ink hover:border-line-2 transition-colors min-w-[180px]"
          style={{ fontSize: '12.5px' }}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="w-3.5 h-3.5 text-ink-mute-2 shrink-0" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher un client…"
            value={searchState.query}
            onValueChange={(q) => controllerRef.current!.setQuery(q)}
            maxLength={CUSTOMER_SEARCH_QUERY_MAX_LENGTH}
          />
          <CommandList>
            {searchState.loading ? (
              <div className="py-4 text-center text-ink-muted" style={{ fontSize: '12.5px' }}>
                Recherche…
              </div>
            ) : searchState.error ? (
              <div className="py-4 text-center text-err-fg" style={{ fontSize: '12.5px' }}>
                {searchState.error}
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {searchState.query.trim() ? 'Aucun client trouvé.' : 'Tapez pour rechercher un client.'}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.kind === 'all' ? '__all__' : option.id}
                      data-testid={option.kind === 'customer' ? optionTestId : undefined}
                      data-customer-id={option.kind === 'customer' ? option.id : undefined}
                      onSelect={() => {
                        if (option.kind === 'all') onClear();
                        else onSelect(option.id, option.label);
                        setOpen(false);
                      }}
                    >
                      {option.kind === 'customer' && (
                        <Check
                          className={`w-3.5 h-3.5 mr-1.5 ${value === option.id ? 'opacity-100' : 'opacity-0'}`}
                          strokeWidth={1.5}
                        />
                      )}
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {searchState.truncated && (
                  <div className="py-2 px-3 text-center text-ink-muted border-t border-line" style={{ fontSize: '11.5px' }}>
                    Plus de {CUSTOMER_SEARCH_PAGE_SIZE} résultats, affinez la recherche.
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
