import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "docs/governance-audit/inventory.csv");

const directoryScopes = [
  "quality/specs",
  "docs/spec",
  "_bmad-output/planning-artifacts",
  "_bmad-output/implementation-artifacts",
  "_bmad-output/refacto-artifacts",
  "docs/architecture",
  "docs/api",
];

const fileScopes = [
  "CLAUDE.md",
  "ARCHITECTURE.md",
  "SPRINT_HANDOFF.md",
  "V3_MULTI_TENANT.md",
  "docs/REGLES_ARCHITECTURE.md",
  "docs/project-context.md",
];

const ignoredNames = new Set([".DS_Store"]);
const textExtensions = new Set([".md", ".yaml", ".yml", ".json", ".py", ".html"]);

async function listFiles(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredNames.has(entry.name)) continue;
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(relativePath)));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return {};
  const result = {};
  for (const line of content.slice(4, end).split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function firstHeading(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].replace(/[*_`]/g, "").trim() : "";
}

function notionTableStatus(content) {
  const lines = content.split("\n");
  const headerIndex = lines.findIndex((line) => line.startsWith("|") && line.includes("Statut Notion"));
  if (headerIndex < 0 || !lines[headerIndex + 2]) return "";
  const headers = lines[headerIndex].split("|").slice(1, -1).map((value) => value.trim());
  const values = lines[headerIndex + 2].split("|").slice(1, -1).map((value) => value.trim());
  const statusIndex = headers.indexOf("Statut Notion");
  return statusIndex >= 0 ? values[statusIndex] ?? "" : "";
}

function classify(relativePath) {
  const name = path.posix.basename(relativePath);
  if (relativePath.startsWith("quality/specs/")) {
    if (name === "spec.schema.json") return ["quality-specs", "schema"];
    if (name.startsWith("_template")) return ["quality-specs", "template"];
    if (name.endsWith(".spec.yaml") || name.endsWith(".spec.yml")) return ["quality-specs", "functional-spec"];
    return ["quality-specs", "documentation"];
  }
  if (relativePath.startsWith("docs/spec/")) {
    if (name === "STORY_DOCUMENT_STANDARD.md") return ["docs-spec", "governance-rule"];
    if (name === "backlog.md") return ["docs-spec", "backlog-index"];
    return ["docs-spec", "documentation"];
  }
  if (relativePath.startsWith("_bmad-output/implementation-artifacts/")) {
    if (/^story-.*\.md$/.test(name)) return ["bmad-implementation", "story-document"];
    if (/^TF-.*\.md$/.test(name)) return ["bmad-implementation", "functional-test-case"];
    if (/^sprint-status-.*\.md$/.test(name)) return ["bmad-implementation", "sprint-status"];
    if (/^retrospective-.*\.md$/.test(name)) return ["bmad-implementation", "retrospective"];
    if (/^INDEX-.*\.md$/.test(name)) return ["bmad-implementation", "generated-index"];
    if (/^EPIC-.*\.md$/.test(name)) return ["bmad-implementation", "epic-document"];
    return ["bmad-implementation", "implementation-document"];
  }
  if (relativePath.startsWith("_bmad-output/planning-artifacts/")) {
    if (/^prd.*\.md$/.test(name)) return ["bmad-planning", "prd"];
    if (name === "epics.md") return ["bmad-planning", "epic-catalog"];
    if (name === "architecture.md") return ["bmad-planning", "architecture"];
    if (/^adr-.*\.md$/.test(name)) return ["bmad-planning", "architecture-decision"];
    if (/implementation-readiness/.test(name)) return ["bmad-planning", "readiness-report"];
    if (/^spec-.*\.md$/.test(name) || /regles-fonctionnelles/.test(name)) return ["bmad-planning", "domain-specification"];
    if (/^roadmap-.*\.md$/.test(name)) return ["bmad-planning", "roadmap"];
    if (/^plan-.*\.md$/.test(name)) return ["bmad-planning", "migration-plan"];
    if (/^brief-.*\.md$/.test(name) || /^pitch-.*\.md$/.test(name)) return ["bmad-planning", "brief"];
    if (/ux.*\.md$/.test(name)) return ["bmad-planning", "ux-specification"];
    if (relativePath.includes("/pim-exaprint/")) return ["bmad-planning", "pim-source"];
    return ["bmad-planning", "planning-document"];
  }
  if (relativePath.startsWith("_bmad-output/refacto-artifacts/")) return ["bmad-refacto", "refactoring-document"];
  if (relativePath === "CLAUDE.md") return ["repository-root", "agent-governance"];
  if (relativePath === "SPRINT_HANDOFF.md") return ["repository-root", "handoff-log"];
  if (relativePath === "ARCHITECTURE.md") return ["repository-root", "architecture"];
  if (relativePath === "V3_MULTI_TENANT.md") return ["repository-root", "domain-specification"];
  if (relativePath === "docs/REGLES_ARCHITECTURE.md") return ["docs-architecture", "architecture-governance"];
  if (relativePath.startsWith("docs/architecture/")) return ["docs-architecture", "architecture-document"];
  if (relativePath.startsWith("docs/api/")) return ["docs-api", "api-document"];
  if (relativePath === "docs/project-context.md") return ["docs-context", "project-context"];
  return ["other", "document"];
}

function inferId(relativePath, frontmatter, title, artifactType) {
  if (frontmatter.id) return frontmatter.id;
  const name = path.posix.basename(relativePath).replace(/\.[^.]+$/, "");
  if (artifactType === "story-document") return name.replace(/^story-/, "");
  if (artifactType === "functional-test-case") return name;
  const titleMatch = title.match(/\b((?:E|S|AF|UM|T|TF|BCP|MUX|R|P)\w*[._-]?\d[\w.\/-]*)\b/i);
  return titleMatch ? titleMatch[1] : "";
}

function idFamily(id) {
  if (!id) return "none";
  const normalized = id.toUpperCase();
  const families = ["E10", "AF", "UM", "T01", "T02", "T03", "T04", "T05", "T06", "T07", "T08", "TF", "BCP", "MUX", "S", "R", "P0", "E"];
  return families.find((prefix) => normalized.startsWith(prefix)) ?? normalized.split(/[.\-_]/)[0];
}

function testReferenceCount(content) {
  const refs = new Set();
  const pathRegex = /(?:tests?|src)\/[A-Za-z0-9_./-]+\.(?:test|spec)\.[A-Za-z0-9]+/g;
  for (const match of content.matchAll(pathRegex)) refs.add(match[0]);
  const tfRegex = /\bTF-[A-Za-z0-9._/-]+\b/g;
  for (const match of content.matchAll(tfRegex)) refs.add(match[0]);
  return refs.size;
}

function candidateDestination(artifactType) {
  const mapping = {
    "functional-spec": "canonical-specification-candidate",
    schema: "retain-as-tooling",
    template: "retain-as-tooling",
    "governance-rule": "governance-rule-to-revise",
    "backlog-index": "generated-backlog-view-candidate",
    "story-document": "story-record-to-classify",
    "functional-test-case": "test-specification-to-classify",
    "sprint-status": "sprint-history-or-archive",
    retrospective: "sprint-history",
    "generated-index": "regenerate-from-canonical-data",
    "epic-document": "epic-candidate",
    "implementation-document": "implementation-history-to-classify",
    prd: "prd-consolidation-candidate",
    "epic-catalog": "epic-consolidation-candidate",
    architecture: "architecture-baseline-to-reconcile",
    "architecture-decision": "architecture-decision-candidate",
    "readiness-report": "historical-audit",
    "domain-specification": "domain-specification-candidate",
    roadmap: "roadmap-history-or-current-view",
    "migration-plan": "migration-history",
    brief: "source-material-or-archive",
    "ux-specification": "ux-specification-candidate",
    "pim-source": "domain-data-source",
    "refactoring-document": "technical-history-or-decision-source",
    "agent-governance": "active-governance-to-reconcile",
    "handoff-log": "split-into-history-decisions-and-actions",
    "architecture-governance": "retain-as-active-technical-governance",
    "architecture-document": "architecture-baseline-to-reconcile",
    "api-document": "api-contract-or-guidance-to-retain",
    "project-context": "project-context-to-reconcile",
    documentation: "supporting-documentation",
  };
  return mapping[artifactType] ?? "manual-classification-required";
}

function confidenceFor({ artifactType, id, title, notionMarker, frontmatter }) {
  if (["schema", "template", "architecture-governance", "agent-governance"].includes(artifactType)) return "high";
  if (artifactType === "story-document") {
    if (id && title && notionMarker && Object.keys(frontmatter).length > 0) return "high";
    if (id && title) return "medium";
    return "low";
  }
  if (title) return "medium";
  return "low";
}

function normalizeStatus(value) {
  return String(value ?? "").replace(/^\[|\]$/g, "").trim();
}

function csvValue(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

const relativePaths = [];
for (const directory of directoryScopes) relativePaths.push(...(await listFiles(directory)));
for (const file of fileScopes) relativePaths.push(file);
relativePaths.sort();

const records = [];
for (const relativePath of relativePaths) {
  const extension = path.extname(relativePath).toLowerCase();
  const absolutePath = path.join(root, relativePath);
  const metadata = await stat(absolutePath);
  const content = textExtensions.has(extension) ? await readFile(absolutePath, "utf8") : "";
  const frontmatter = parseFrontmatter(content);
  const title = firstHeading(content);
  const [sourceGroup, artifactType] = classify(relativePath);
  const id = inferId(relativePath, frontmatter, title, artifactType);
  const notionMarker = content.includes("<!-- notion-functional:begin");
  const notionStatus = notionTableStatus(content);
  const documentStatus = normalizeStatus(frontmatter.specStatus ?? frontmatter.status ?? "");
  const deliveryStatus = normalizeStatus(frontmatter.deliveryStatus ?? frontmatter.delivery_status ?? "");
  const epic = normalizeStatus(frontmatter.epic ?? "");
  const source = normalizeStatus(frontmatter.source ?? (notionMarker ? "notion-copy" : "git"));
  const declaresNotionAuthority = /Notion fait foi|Source qui fait foi : Notion/.test(content);
  const implementationPlaceholder = /Aucun story document d.implémentation propre à cette story n.existait/i.test(content);
  const implementationSignal = !implementationPlaceholder && (
    /^##\s+(?:Résultat livré|Implémentation|Implementation|Validation|Dev Agent Record)/m.test(content)
    || Boolean(frontmatter.status)
  );
  const acceptanceCriteriaSignal = /^(?:#{2,6}\s+.*Critères d.acceptation|\s*acceptanceCriteria:)/mi.test(content);
  const notes = [];
  if (artifactType === "story-document" && !notionMarker) notes.push("missing-notion-functional-section");
  if (artifactType === "story-document" && Object.keys(frontmatter).length === 0) notes.push("missing-frontmatter");
  if (artifactType === "story-document" && !documentStatus && !notionStatus) notes.push("missing-status");
  if (artifactType === "functional-spec" && relativePath.includes("_template")) notes.push("template-not-business-spec");
  if (declaresNotionAuthority) notes.push("declares-notion-authority");
  if (relativePath === "SPRINT_HANDOFF.md" && metadata.size > 100_000) notes.push("oversized-handoff-log");
  records.push({
    path: relativePath,
    source_group: sourceGroup,
    artifact_type: artifactType,
    id,
    id_family: idFamily(id),
    title,
    document_status: documentStatus,
    delivery_status: deliveryStatus,
    notion_status: notionStatus,
    source,
    frontmatter_present: Object.keys(frontmatter).length > 0 ? "yes" : "no",
    notion_linked: /notion/i.test(content) ? "yes" : "no",
    functional_marker: notionMarker ? "yes" : "no",
    declares_notion_authority: declaresNotionAuthority ? "yes" : "no",
    implementation_signal: implementationSignal ? "yes" : "no",
    acceptance_criteria_signal: acceptanceCriteriaSignal ? "yes" : "no",
    test_reference_count: testReferenceCount(content),
    epic,
    destination_candidate: candidateDestination(artifactType),
    classification_confidence: confidenceFor({ artifactType, id, title, notionMarker, frontmatter }),
    bytes: metadata.size,
    notes: notes.join(";"),
  });
}

const idCounts = new Map();
for (const record of records) {
  if (!record.id) continue;
  idCounts.set(record.id, (idCounts.get(record.id) ?? 0) + 1);
}
for (const record of records) record.duplicate_id_count = record.id ? idCounts.get(record.id) ?? 1 : 0;

const headers = Object.keys(records[0]);
const csv = [headers.map(csvValue).join(",")];
for (const record of records) csv.push(headers.map((header) => csvValue(record[header])).join(","));
await writeFile(outputPath, `${csv.join("\n")}\n`, "utf8");

const summary = {
  generatedAt: new Date().toISOString(),
  total: records.length,
  bySourceGroup: Object.groupBy(records, (record) => record.source_group),
  byArtifactType: Object.groupBy(records, (record) => record.artifact_type),
};

function countBy(values, field) {
  return Object.fromEntries(
    Object.entries(Object.groupBy(values, (value) => value[field] || "(empty)"))
      .map(([key, groupedValues]) => [key, groupedValues.length])
      .sort((left, right) => right[1] - left[1]),
  );
}

const storyRecords = records.filter((record) => record.artifact_type === "story-document");
const duplicateIds = [...idCounts.entries()]
  .filter(([, count]) => count > 1)
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
const apparentlyImplementedButNotStarted = storyRecords.filter(
  (record) => record.notion_status === "Pas commencé" && record.implementation_signal === "yes",
);

process.stdout.write(`${JSON.stringify({
  generatedAt: summary.generatedAt,
  total: summary.total,
  bySourceGroup: Object.fromEntries(Object.entries(summary.bySourceGroup).map(([key, values]) => [key, values.length])),
  byArtifactType: Object.fromEntries(Object.entries(summary.byArtifactType).map(([key, values]) => [key, values.length])),
  stories: {
    total: storyRecords.length,
    withFrontmatter: storyRecords.filter((record) => record.frontmatter_present === "yes").length,
    withFunctionalMarker: storyRecords.filter((record) => record.functional_marker === "yes").length,
    declaringNotionAuthority: storyRecords.filter((record) => record.declares_notion_authority === "yes").length,
    withImplementationSignal: storyRecords.filter((record) => record.implementation_signal === "yes").length,
    withAcceptanceCriteriaSignal: storyRecords.filter((record) => record.acceptance_criteria_signal === "yes").length,
    withExplicitTestReference: storyRecords.filter((record) => Number(record.test_reference_count) > 0).length,
    notionStatuses: countBy(storyRecords, "notion_status"),
    documentStatuses: countBy(storyRecords, "document_status"),
    documentStatusVariantCount: Object.keys(countBy(storyRecords.filter((record) => record.document_status), "document_status")).length,
    idFamilies: countBy(storyRecords, "id_family"),
    idFamilyCount: Object.keys(countBy(storyRecords, "id_family")).length,
    apparentlyImplementedButNotStartedCount: apparentlyImplementedButNotStarted.length,
    apparentlyImplementedButNotStartedSample: apparentlyImplementedButNotStarted.slice(0, 25).map((record) => record.path),
  },
  duplicateIds: duplicateIds.slice(0, 50),
}, null, 2)}\n`);
