/**
 * Service applicatif du module Gabarits PDF de documents (story E10.10b-4a).
 *
 * Orchestration pure : aucune dependance a Supabase ni au HTTP. Les erreurs
 * metier sont des types dedies ; c est la route qui les traduit en Problem
 * RFC 7807, avec le request_id qu elle seule connait.
 */
import type { TenantId, UserId } from '../../../kernel/ids/index.ts';
import type {
  ConfirmDocumentPdfTemplateUploadCommand,
  CreateDocumentPdfTemplateCommand,
  DocumentPdfTemplateCreatedDto,
  DocumentPdfTemplateDetailDto,
  DocumentPdfTemplateDto,
  DocumentPdfTemplateFieldMapDto,
  DocumentPdfTemplateStatus,
  DocumentPdfTemplateUploadTicketDto,
  DocumentType,
  ReplaceDocumentPdfTemplateFieldsCommand,
  UpdateDocumentPdfTemplateCommand,
} from '../api/contracts.ts';
import {
  DocumentPdfTemplateAccessDeniedError,
  DocumentPdfTemplateInvalidFieldMapError,
  DocumentPdfTemplateNotFoundError,
  DocumentPdfTemplateUploadRequiredError,
  type DocumentTemplatesRepository,
} from './document-templates-repository.ts';
import { validateDocumentFieldMap } from './document-field-map-validator.ts';

/** Droit metier exige par toute ecriture du referentiel (contrat §8.18 §4). */
const CAN_MANAGE_DOCUMENT_TEMPLATES = 'can_manage_document_templates';

export type ListDocumentPdfTemplatesQuery = Readonly<{
  documentType: DocumentType | null;
  status: DocumentPdfTemplateStatus | null;
}>;

export type DocumentTemplatesServiceDependencies = Readonly<{
  repository: DocumentTemplatesRepository;
}>;

export class DocumentTemplatesService {
  private readonly repository: DocumentTemplatesRepository;

  constructor(dependencies: DocumentTemplatesServiceDependencies) {
    this.repository = dependencies.repository;
  }

  /** Lecture OUVERTE a tout membre du tenant (contrat : ne conditionne pas la lecture). */
  async list(
    tenantId: TenantId,
    query: ListDocumentPdfTemplatesQuery,
  ): Promise<readonly DocumentPdfTemplateDto[]> {
    return this.repository.list(tenantId, { documentType: query.documentType, status: query.status });
  }

  async getById(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateDetailDto> {
    const template = await this.repository.findById(tenantId, templateId);
    if (!template) throw new DocumentPdfTemplateNotFoundError();
    return template;
  }

  async create(
    tenantId: TenantId,
    actor: UserId,
    command: CreateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateCreatedDto> {
    await this.assertCanManageDocumentTemplates(tenantId, actor);
    return this.repository.create(tenantId, actor, command);
  }

  async update(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
    command: UpdateDocumentPdfTemplateCommand,
  ): Promise<DocumentPdfTemplateDetailDto> {
    await this.assertCanManageDocumentTemplates(tenantId, actor);
    return this.repository.update(tenantId, templateId, command);
  }

  async remove(tenantId: TenantId, actor: UserId, templateId: string): Promise<void> {
    await this.assertCanManageDocumentTemplates(tenantId, actor);
    await this.repository.remove(tenantId, templateId);
  }

  async issueUploadUrl(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
  ): Promise<DocumentPdfTemplateUploadTicketDto> {
    await this.assertCanManageDocumentTemplates(tenantId, actor);
    return this.repository.issueUploadUrl(tenantId, templateId);
  }

  async confirmUpload(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
    command: ConfirmDocumentPdfTemplateUploadCommand,
  ): Promise<DocumentPdfTemplateDetailDto> {
    await this.assertCanManageDocumentTemplates(tenantId, actor);
    return this.repository.confirmUpload(tenantId, templateId, command);
  }

  /**
   * Garde d ecriture (403 `identity.role_required` si refuse), verifiee
   * AVANT toute autre validation — meme discipline que
   * `ProductionStepsService.assertCanManageProductionSteps` (E10.13) : un
   * acteur sans le droit ne doit pas apprendre par la forme du refus
   * (404/409) que sa commande aurait par ailleurs ete acceptee.
   */
  async assertCanManageDocumentTemplates(tenantId: TenantId, actor: UserId): Promise<void> {
    const authorized = await this.repository.actorHasCapability(
      tenantId,
      actor,
      CAN_MANAGE_DOCUMENT_TEMPLATES,
    );
    if (!authorized) throw new DocumentPdfTemplateAccessDeniedError();
  }

  /** Lecture OUVERTE a tout membre du tenant (contrat : "ne conditionne pas la lecture"). */
  async getFields(tenantId: TenantId, templateId: string): Promise<DocumentPdfTemplateFieldMapDto> {
    const fields = await this.repository.getFields(tenantId, templateId);
    if (!fields) throw new DocumentPdfTemplateNotFoundError();
    return fields;
  }

  /**
   * `PUT .../fields` (E10.10b-4b). Ordre delibere, meme discipline que
   * `update()` : (1) garde de capability, (2) existence + geometrie du
   * gabarit (404/409), (3) validation SEMANTIQUE de la carte proposee contre
   * cette geometrie (422 `invalid_field_map`), (4) ecriture. La route appelle
   * `getFields()` a part pour l `ETag` AVANT cette methode — inchange ici.
   */
  async replaceFields(
    tenantId: TenantId,
    actor: UserId,
    templateId: string,
    command: ReplaceDocumentPdfTemplateFieldsCommand,
  ): Promise<DocumentPdfTemplateFieldMapDto> {
    await this.assertCanManageDocumentTemplates(tenantId, actor);

    const template = await this.repository.findById(tenantId, templateId);
    if (!template) throw new DocumentPdfTemplateNotFoundError();
    if (template.status !== 'ready') throw new DocumentPdfTemplateUploadRequiredError();

    const errors = validateDocumentFieldMap(template.pages, command);
    if (errors.length > 0) throw new DocumentPdfTemplateInvalidFieldMapError(errors);

    return this.repository.replaceFields(tenantId, templateId, command);
  }
}
