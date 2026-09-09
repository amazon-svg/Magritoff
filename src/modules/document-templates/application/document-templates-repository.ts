import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  ConfirmDocumentPdfTemplateUploadCommand,
  CreateDocumentPdfTemplateCommand,
  DocumentFieldPlacementDto,
  DocumentPdfTemplateCreatedDto,
  DocumentPdfTemplateDetailDto,
  DocumentPdfTemplateDto,
  DocumentPdfTemplateFieldMapDto,
  DocumentPdfTemplatePageDto,
  DocumentPdfTemplateStatus,
  DocumentPdfTemplateUploadTicketDto,
  DocumentType,
  ReplaceDocumentPdfTemplateFieldsCommand,
  UpdateDocumentPdfTemplateCommand,
} from '../api/contracts.ts';
import type { FieldMapValidationError } from './document-field-map-validator.ts';

/** Le gabarit n existe pas dans le tenant du jeton (404 `document_pdf_template.not_found`). */
export class DocumentPdfTemplateNotFoundError extends Error {
  constructor(message = 'Gabarit PDF introuvable dans ce tenant.') {
    super(message);
    this.name = 'DocumentPdfTemplateNotFoundError';
  }
}

/** Nom deja porte (forme normalisee) par un autre gabarit du MEME type de document (409 `document_pdf_template.name_conflict`). */
export class DocumentPdfTemplateNameConflictError extends Error {
  constructor(message = 'Un gabarit porte deja ce nom pour ce type de document.') {
    super(message);
    this.name = 'DocumentPdfTemplateNameConflictError';
  }
}

/** Le tenant porte deja 20 gabarits pour ce type de document (422 `document_pdf_template.limit_reached`). */
export class DocumentPdfTemplateLimitReachedError extends Error {
  constructor(message = 'Plafond de 20 gabarits atteint pour ce type de document.') {
    super(message);
    this.name = 'DocumentPdfTemplateLimitReachedError';
  }
}

/** `is_default: true` refuse : le gabarit n est ni `ready` ni actif (409 `document_pdf_template.default_requires_ready`). */
export class DocumentPdfTemplateDefaultRequiresReadyError extends Error {
  constructor(message = 'Le gabarit doit etre pret et actif pour devenir le defaut.') {
    super(message);
    this.name = 'DocumentPdfTemplateDefaultRequiresReadyError';
  }
}

/**
 * Au moins un document a ete genere avec ce gabarit (409 `document_pdf_template.in_use`).
 * Tenu EN BASE par `quote_documents.template_id on delete restrict` (E10.10b-4c) :
 * INATTEIGNABLE tant que cette table n existe pas (voir migration 20260909020000).
 */
export class DocumentPdfTemplateInUseError extends Error {
  constructor(message = 'Gabarit encore porte par au moins un document genere.') {
    super(message);
    this.name = 'DocumentPdfTemplateInUseError';
  }
}

/**
 * Le nouveau fond n a pas la geometrie de l ancien alors que la carte de
 * champs n est pas vide et que `reset_fields` n a pas ete pose (409
 * `document_pdf_template.geometry_changed`).
 */
export class DocumentPdfTemplateGeometryChangedError extends Error {
  constructor(message = 'La geometrie du fond a change ; reset_fields est requis pour confirmer.') {
    super(message);
    this.name = 'DocumentPdfTemplateGeometryChangedError';
  }
}

/**
 * `confirmDocumentPdfTemplateUpload` appele sans qu un depot ait reussi au
 * chemin attendu (404 `document_pdf_template.upload_missing`).
 */
export class DocumentPdfTemplateUploadMissingError extends Error {
  constructor(message = 'Aucun fichier depose au chemin attendu ; redemander un billet d import.') {
    super(message);
    this.name = 'DocumentPdfTemplateUploadMissingError';
  }
}

/**
 * Le fichier depose n est pas un PDF exploitable (422 `document_pdf_template.invalid_pdf`) :
 * illisible, chiffre, ou au-dela de 10 pages.
 */
export class DocumentPdfTemplateInvalidPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentPdfTemplateInvalidPdfError';
  }
}

/** L acteur n a pas le droit metier `can_manage_document_templates` requis pour ecrire le referentiel (403 `identity.role_required`). */
export class DocumentPdfTemplateAccessDeniedError extends Error {
  constructor(
    message = 'Le droit can_manage_document_templates est requis pour administrer les gabarits PDF.',
  ) {
    super(message);
    this.name = 'DocumentPdfTemplateAccessDeniedError';
  }
}

/**
 * E10.10b-4b — `replaceDocumentPdfTemplateFields` appele sur un gabarit qui
 * n est pas `ready` (409 `document_pdf_template.upload_required`) : placer
 * des champs sur un fond dont on ignore la geometrie reviendrait a valider
 * des coordonnees contre rien.
 */
export class DocumentPdfTemplateUploadRequiredError extends Error {
  constructor(message = 'Le gabarit doit avoir un fond importe (ready) avant de positionner des champs.') {
    super(message);
    this.name = 'DocumentPdfTemplateUploadRequiredError';
  }
}

/**
 * E10.10b-4b — carte de champs invalide (422 `document_pdf_template.invalid_field_map`) :
 * page inexistante, coordonnee hors page, champ place deux fois, colonne
 * dupliquee, bloc de lignes sans colonne, `rows_per_page` incompatible avec
 * la page. Le detail par champ est porte par `errors` (`Problem.errors`).
 */
export class DocumentPdfTemplateInvalidFieldMapError extends Error {
  readonly errors: readonly FieldMapValidationError[];

  constructor(errors: readonly FieldMapValidationError[]) {
    super(`Carte de champs invalide (${errors.length} erreur(s)).`);
    this.name = 'DocumentPdfTemplateInvalidFieldMapError';
    this.errors = errors;
  }
}

export type ListDocumentPdfTemplatesFilters = Readonly<{
  documentType: DocumentType | null;
  status: DocumentPdfTemplateStatus | null;
}>;

/**
 * E10.10b-4c — gabarit ELIGIBLE a la generation, entierement RESOLU (fond
 * telecharge, geometrie, carte de champs) pour que le moteur PUR
 * (`quote-documents/application/quote-document-renderer.ts`) n ait plus
 * AUCUN acces a Supabase a faire. Renvoye par
 * `findEligibleTemplateForGeneration`, jamais construit ailleurs.
 */
export type EligibleDocumentPdfTemplate = Readonly<{
  templateId: string;
  backgroundBytes: Uint8Array;
  pages: readonly DocumentPdfTemplatePageDto[];
  placements: readonly DocumentFieldPlacementDto[];
  linesBlock: DocumentPdfTemplateFieldMapDto['lines_block'];
}>;

/**
 * Port (interface) du referentiel des gabarits PDF (E10.10b-4a).
 * L implementation Supabase vit dans
 * src/adapters/supabase/document-templates-repository.ts ; ce module n en
 * connait que le contrat.
 */
export interface DocumentTemplatesRepository {
  list(
    tenantId: TenantId,
    filters: ListDocumentPdfTemplatesFilters,
  ): Promise<readonly DocumentPdfTemplateDto[]>;

  /** `null` si absent ou hors du tenant (404 cote route, jamais 403). Porte l URL signee du fond (900 s). */
  findById(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateDetailDto | null>;

  /**
   * `security definer` (`api_create_document_pdf_template`) pour la ligne,
   * puis emission d un billet d import (`createSignedUploadUrl`, service_role).
   * Leve `DocumentPdfTemplateLimitReachedError`/`DocumentPdfTemplateNameConflictError`.
   */
  create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateCreatedDto>;

  /**
   * `security definer` (`api_update_document_pdf_template`) : PATCH partiel,
   * bascule `is_default` transactionnelle. Leve
   * `DocumentPdfTemplateNotFoundError`/`DocumentPdfTemplateNameConflictError`/
   * `DocumentPdfTemplateDefaultRequiresReadyError`.
   */
  update(
    tenantId: TenantId,
    templateId: string,
    command: UpdateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateDetailDto>;

  /**
   * `security definer` (`api_delete_document_pdf_template`) puis retrait de
   * l objet de stockage (service_role). Leve
   * `DocumentPdfTemplateNotFoundError`/`DocumentPdfTemplateInUseError`.
   */
  remove(tenantId: TenantId, templateId: string): Promise<void>;

  /**
   * Emet un billet d import a usage unique (`createSignedUploadUrl`,
   * service_role), sur le chemin impose `<tenant_id>/<templateId>.pdf`. Leve
   * `DocumentPdfTemplateNotFoundError`.
   */
  issueUploadUrl(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateUploadTicketDto>;

  /**
   * TELECHARGE le fichier depose (service_role), l INSPECTE (`pdf-lib`,
   * `pdf-template-inspector.ts`), puis appelle
   * `api_confirm_document_pdf_template_upload` avec la geometrie extraite.
   * Sur fichier invalide, retire l objet du stockage AVANT de lever
   * `DocumentPdfTemplateInvalidPdfError`. Leve aussi
   * `DocumentPdfTemplateNotFoundError`/`DocumentPdfTemplateUploadMissingError`/
   * `DocumentPdfTemplateGeometryChangedError`.
   */
  confirmUpload(
    tenantId: TenantId,
    templateId: string,
    command: ConfirmDocumentPdfTemplateUploadCommand,
  ): Promise<DocumentPdfTemplateDetailDto>;

  /**
   * Evalue le droit metier `can_manage_document_templates` de l acteur dans
   * le tenant, via `public.user_has_capability` — meme mecanisme que
   * `ProductionStepsRepository.actorHasCapability()`.
   */
  actorHasCapability(tenantId: TenantId, actorId: UserId, capability: string): Promise<boolean>;

  /**
   * E10.10b-4b — `GET .../fields`. `null` si le gabarit n existe pas dans le
   * tenant (404 cote route). Carte VIDE (`placements: []`, `lines_block:
   * null`) sur un gabarit fraichement importe — etat legitime, jamais une
   * erreur.
   */
  getFields(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateFieldMapDto | null>;

  /**
   * E10.10b-4b — `PUT .../fields`. REMPLACEMENT INTEGRAL
   * (`api_replace_document_pdf_template_fields`, security definer) : ce qui
   * n est pas dans `command` est supprime. Leve
   * `DocumentPdfTemplateNotFoundError`/`DocumentPdfTemplateUploadRequiredError`.
   * La validation SEMANTIQUE (`document-field-map-validator.ts`) est faite
   * par le SERVICE, avant d appeler cette methode — celle-ci ne revalide que
   * ce qu une contrainte EN BASE exprime.
   */
  replaceFields(
    tenantId: TenantId,
    templateId: string,
    command: ReplaceDocumentPdfTemplateFieldsCommand,
  ): Promise<DocumentPdfTemplateFieldMapDto>;

  /**
   * E10.10b-4c — resout le gabarit qu utiliserait une generation de document
   * pour joindre/produire une piece, SANS jamais generer ni stocker quoi que
   * ce soit : condition d attachement a QUATRE termes (contrat §8.18 §5),
   * tous necessaires — `document_type = documentType`, `status = 'ready'`,
   * `is_active`, `is_default`, ET une carte non vide (`has_field_map`). Rend
   * `null` des que l un des quatre manque (cas NOMINAL "aucun gabarit",
   * arbitrage (a)) — jamais une exception. Quand un gabarit eligible existe,
   * TELECHARGE son fond (service_role) et relit sa carte de champs : le
   * moteur pur en aval (`quote-documents/application/quote-document-renderer.ts`)
   * n a plus rien a demander a Supabase.
   *
   * E10.19a — `documentType` est desormais un PARAMETRE explicite (contrat
   * §0 : "le point de reprise le plus concret du lot"). Avant ce lot, la
   * valeur `'quote'` etait codee EN DUR dans l adaptateur Supabase : un
   * tenant qui aurait importe un gabarit `order` avant que ce parametre
   * n existe aurait pu voir ses DEVIS partir dessus si l ordre de tri
   * l avait designe — regression silencieuse sur une fonctionnalite deja en
   * production. Signature elargie AVANT tout branchement d E10.19b.
   */
  findEligibleTemplateForGeneration(
    tenantId: TenantId,
    documentType: DocumentType,
  ): Promise<EligibleDocumentPdfTemplate | null>;
}
