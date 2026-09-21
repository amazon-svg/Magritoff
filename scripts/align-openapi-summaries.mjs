#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const contractPath = 'openapi/magrit-core.v1.yaml';
const lines = readFileSync(contractPath, 'utf8').split('\n');
const output = [];
let changed = 0;
let currentOperationId = null;

const summaries = {
  listCustomers: 'Liste les clients',
  createCustomer: 'Crée un client',
  getCustomer: 'Récupère un client',
  updateCustomer: 'Modifie un client',
  listCustomerContacts: 'Liste les interlocuteurs d’un client',
  createCustomerContact: 'Ajoute un interlocuteur à un client',
  getCustomerContact: 'Récupère un interlocuteur',
  updateCustomerContact: 'Modifie un interlocuteur',
  openCustomerContactShopAccess: 'Ouvre l’accès boutique d’un interlocuteur',
  revokeCustomerContactShopAccess: 'Révoque l’accès boutique d’un interlocuteur',
  verifyCustomerSiret: 'Vérifie le SIRET d’un client',
  listProjects: 'Liste les projets',
  createProject: 'Crée un projet',
  getProject: 'Récupère un projet',
  updateProject: 'Modifie un projet',
  addProjectItem: 'Ajoute un élément à un projet',
  importHopeStudioBasketItem: 'Importe un article HopeStudio dans un projet',
  removeProjectItem: 'Retire un élément d’un projet',
  replaceProjectTags: 'Remplace les tags d’un projet',
  listProjectTags: 'Liste les tags de projet',
  createProjectTag: 'Crée un tag de projet',
  deleteProjectTag: 'Supprime un tag de projet',
  listQuotes: 'Liste les devis',
  createQuoteFromProject: 'Crée un devis depuis un projet',
  getQuote: 'Récupère un devis',
  updateQuote: 'Modifie un devis',
  deleteQuote: 'Supprime un devis',
  addQuoteLine: 'Ajoute une ligne à un devis',
  getQuoteLine: 'Récupère une ligne de devis',
  updateQuoteLine: 'Modifie une ligne de devis',
  deleteQuoteLine: 'Supprime une ligne de devis',
  reorderQuoteLines: 'Réordonne les lignes d’un devis',
  listQuoteAuditEntries: 'Liste l’audit des lignes d’un devis',
  sendQuote: 'Envoie un devis',
  duplicateQuote: 'Duplique un devis',
  getCommercialSettings: 'Récupère les réglages commerciaux',
  updateCommercialSettings: 'Modifie les réglages commerciaux',
  listQuoteHeaderAuditEntries: 'Liste l’audit d’un devis',
  listPriceRules: 'Liste les règles de prix',
  createPriceRule: 'Crée une règle de prix',
  resolvePriceRule: 'Résout une règle de prix',
  getPriceRule: 'Récupère une règle de prix',
  updatePriceRule: 'Modifie une règle de prix',
  getProductRangeDefaultMargin: 'Récupère la marge par défaut d’une gamme',
  setProductRangeDefaultMargin: 'Définit la marge par défaut d’une gamme',
  listStorefrontQuotes: 'Liste les devis côté boutique',
  getStorefrontQuote: 'Récupère un devis côté boutique',
  decideStorefrontQuote: 'Enregistre la décision sur un devis',
  convertQuote: 'Convertit un devis en commande',
  listCommercialOrders: 'Liste les commandes commerciales',
  getCommercialOrder: 'Récupère une commande commerciale',
  listProductionSteps: 'Liste les étapes de production',
  createProductionStep: 'Crée une étape de production',
  getProductionStep: 'Récupère une étape de production',
  updateProductionStep: 'Modifie une étape de production',
  deleteProductionStep: 'Supprime une étape de production',
  reorderProductionSteps: 'Réordonne les étapes de production',
  listOrderStepChanges: 'Liste les changements d’étape',
  changeOrderProductionStep: 'Change l’étape d’une commande',
  issueOrderFileUploadUrl: 'Émet une URL de dépôt de fichier',
  listOrderFiles: 'Liste les fichiers d’une commande',
  confirmOrderFileUpload: 'Confirme le dépôt d’un fichier',
  getOrderFile: 'Récupère un fichier de commande',
  updateOrderFile: 'Modifie la visibilité d’un fichier',
  deleteOrderFile: 'Supprime un fichier de commande',
  listDocumentPdfTemplates: 'Liste les modèles PDF',
  createDocumentPdfTemplate: 'Crée un modèle PDF',
  getDocumentPdfTemplate: 'Récupère un modèle PDF',
  updateDocumentPdfTemplate: 'Modifie un modèle PDF',
  deleteDocumentPdfTemplate: 'Supprime un modèle PDF',
  issueDocumentPdfTemplateUploadUrl: 'Émet une URL de dépôt de modèle PDF',
  confirmDocumentPdfTemplateUpload: 'Confirme le dépôt d’un modèle PDF',
  getDocumentPdfTemplateFields: 'Récupère les champs d’un modèle PDF',
  replaceDocumentPdfTemplateFields: 'Remplace les champs d’un modèle PDF',
  getQuoteDocument: 'Récupère le document d’un devis',
  getStorefrontQuoteDocument: 'Récupère le document d’un devis côté boutique',
  getOrderDocument: 'Récupère le document d’une commande',
  generateOrderDocument: 'Génère le document d’une commande',
  createOrderUploadLink: 'Crée un lien de dépôt de fichiers',
  listOrderUploadLinks: 'Liste les liens de dépôt de fichiers',
  revokeOrderUploadLink: 'Révoque un lien de dépôt de fichiers',
  getOrderUploadLinkContext: 'Récupère le contexte d’un lien de dépôt',
  issueOrderUploadLinkFileUrl: 'Émet une URL de dépôt via un lien',
  confirmOrderUploadLinkFile: 'Confirme un dépôt via un lien',
  listNotificationEvents: 'Liste les événements notifiables',
  listNotificationTemplates: 'Liste les modèles de notification',
  createNotificationTemplate: 'Crée un modèle de notification',
  getNotificationTemplate: 'Récupère un modèle de notification',
  updateNotificationTemplate: 'Modifie un modèle de notification',
  previewNotificationTemplate: 'Prévisualise un modèle de notification',
  listNotificationLogs: 'Liste les journaux de notification',
  listCommercialOrderExports: 'Liste les exports de commandes',
  requestCommercialOrderExport: 'Demande un export de commandes',
  getCommercialOrderExport: 'Récupère un export de commandes',
  onQuoteConverted: 'Notifie la conversion d’un devis',
  onOrderStepChanged: 'Notifie le changement d’étape d’une commande',
  onOrderFilesSubmitted: 'Notifie le dépôt de fichiers client',
  onOrderFilesPurgeScheduled: 'Notifie la purge planifiée de fichiers',
  onOrderFilesPurged: 'Notifie la purge de fichiers',
  onCustomerCreated: 'Notifie la création d’un client',
  onProjectCreated: 'Notifie la création d’un projet',
  onQuoteCreated: 'Notifie la création d’un devis',
  onQuoteSent: 'Notifie l’envoi d’un devis',
  onQuoteAccepted: 'Notifie l’acceptation d’un devis',
  onQuoteRejected: 'Notifie le refus d’un devis',
  onQuoteLineChanged: 'Notifie la modification d’une ligne de devis',
  onPriceRuleChanged: 'Notifie la modification d’une règle de prix',
};

function blockEnd(start) {
  let index = start + 1;
  while (index < lines.length && (/^        /.test(lines[index]) || lines[index].trim() === '')) {
    index += 1;
  }
  return index;
}

function blockText(block) {
  return block
    .slice(1)
    .map((line) => line.startsWith('        ') ? line.slice(8) : '')
    .join('\n')
    .trim();
}

function renderDescription(text) {
  return ['      description: >-', ...text.split('\n').map((line) => line ? `        ${line}` : '')];
}

function shortSummary(text) {
  const compact = text.replace(/\s+/g, ' ').trim();
  const sentence = compact.match(/^.{1,120}?(?:[.!?](?:\s|$)|$)/)?.[0]?.trim() || compact.slice(0, 117).trimEnd() + '...';
  return sentence.replace(/[.!?]+$/, '');
}

for (let index = 0; index < lines.length;) {
  const operationMatch = lines[index].match(/^      operationId: (.+)$/);
  if (operationMatch) currentOperationId = operationMatch[1];
  const match = lines[index].match(/^      summary:\s*(.*)$/);
  if (!match) {
    output.push(lines[index]);
    index += 1;
    continue;
  }

  const summaryEnd = blockEnd(index);
  const summaryBlock = lines.slice(index, summaryEnd);
  if (match[1] && !/^[>|][+-]?$/.test(match[1].trim())) {
    const rawValue = match[1].trim();
    const currentValue = rawValue.startsWith('"') ? JSON.parse(rawValue) : rawValue;
    const value = summaries[currentOperationId] || currentValue;
    output.push(`      summary: ${JSON.stringify(value)}`);
    if (currentValue !== value || rawValue !== JSON.stringify(value)) changed += 1;
    index = summaryEnd;
    continue;
  }
  const summaryText = match[1] && !/^[>|][+-]?$/.test(match[1].trim())
    ? match[1]
    : blockText(summaryBlock);
  if (summaryText.replace(/\s+/g, ' ').trim().length <= 120) {
    output.push(...summaryBlock);
    index = summaryEnd;
    continue;
  }

  const descriptionStart = summaryEnd;
  const hasDescription = /^      description:/.test(lines[descriptionStart] || '');
  const descriptionEnd = hasDescription ? blockEnd(descriptionStart) : descriptionStart;
  const existingDescription = hasDescription
    ? blockText(lines.slice(descriptionStart, descriptionEnd))
    : '';
  const descriptionText = existingDescription
    ? `${summaryText.trim()}\n\n${existingDescription}`
    : summaryText.trim();

  const alignedSummary = summaries[currentOperationId] || shortSummary(summaryText);
  output.push(`      summary: ${JSON.stringify(alignedSummary)}`);
  output.push(...renderDescription(descriptionText));
  changed += 1;
  index = hasDescription ? descriptionEnd : summaryEnd;
}

writeFileSync(contractPath, output.join('\n'));
console.log(`✅ ${changed} summary(s) réaligné(s) dans ${contractPath}`);
