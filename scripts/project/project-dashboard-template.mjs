const DELIVERY_ORDER = [
  'not-started',
  'ready',
  'in-progress',
  'implemented',
  'verified',
  'released',
  'blocked',
  'cancelled',
];

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');
}

export function renderProjectDashboard(model) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Pilotage projet — Magrit</title>
  <style>
    :root {
      --bg: #09111f;
      --panel: #101b2d;
      --panel-2: #152238;
      --line: #263650;
      --text: #edf3ff;
      --muted: #9cacC4;
      --accent: #67e8f9;
      --accent-2: #a78bfa;
      --good: #4ade80;
      --warn: #fbbf24;
      --bad: #fb7185;
      --radius: 14px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at top left, #152442 0, var(--bg) 34rem); color: var(--text); min-height: 100vh; }
    button, input, select { font: inherit; }
    a { color: inherit; }
    .shell { max-width: 1680px; margin: 0 auto; padding: 28px; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: end; margin-bottom: 22px; }
    .eyebrow { color: var(--accent); font-size: .75rem; letter-spacing: .14em; text-transform: uppercase; font-weight: 800; }
    h1 { font-size: clamp(1.8rem, 4vw, 3.2rem); margin: 5px 0 7px; letter-spacing: -.04em; }
    .subtitle { color: var(--muted); margin: 0; max-width: 780px; line-height: 1.55; }
    .source-pill { border: 1px solid var(--line); background: #0c1728cc; border-radius: 999px; padding: 9px 13px; color: var(--muted); white-space: nowrap; }
    .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
    .tab { border: 1px solid var(--line); background: var(--panel); color: var(--muted); border-radius: 999px; padding: 9px 14px; cursor: pointer; }
    .tab[aria-selected="true"] { background: var(--accent); color: #05202b; border-color: transparent; font-weight: 800; }
    .view[hidden] { display: none; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .metric { padding: 17px; border: 1px solid var(--line); border-radius: var(--radius); background: linear-gradient(145deg, #132139, #0e192a); }
    .metric strong { display: block; font-size: 1.75rem; margin-bottom: 4px; }
    .metric span { color: var(--muted); font-size: .82rem; }
    .grid-2 { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(300px, .8fr); gap: 16px; align-items: start; }
    .panel { border: 1px solid var(--line); background: #0e192af0; border-radius: var(--radius); padding: 18px; min-width: 0; }
    .panel h2 { margin: 0 0 14px; font-size: 1.02rem; }
    .bars { display: grid; gap: 11px; }
    .bar-row { display: grid; grid-template-columns: 130px 1fr 42px; gap: 10px; align-items: center; color: var(--muted); font-size: .82rem; }
    .bar-track { height: 10px; background: #07101e; border-radius: 99px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent-2), var(--accent)); }
    .bar-count { color: var(--text); text-align: right; font-variant-numeric: tabular-nums; }
    .attention { display: grid; gap: 10px; }
    .attention-item { padding: 12px; background: var(--panel-2); border-left: 3px solid var(--warn); border-radius: 8px; }
    .attention-item strong { display: block; margin-bottom: 4px; }
    .attention-item span { color: var(--muted); font-size: .82rem; }
    .filters { display: grid; grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(150px, .7fr)); gap: 10px; margin-bottom: 15px; }
    .control { width: 100%; background: #0b1525; border: 1px solid var(--line); color: var(--text); border-radius: 10px; padding: 10px 12px; }
    .kanban { display: grid; grid-template-columns: repeat(8, minmax(265px, 1fr)); gap: 12px; overflow-x: auto; padding: 2px 2px 14px; align-items: start; }
    .column { background: #0c1727; border: 1px solid var(--line); border-radius: 13px; min-height: 230px; max-height: 70vh; display: flex; flex-direction: column; }
    .column-head { display: flex; justify-content: space-between; align-items: center; padding: 13px; border-bottom: 1px solid var(--line); position: sticky; top: 0; background: #0c1727; z-index: 2; border-radius: 13px 13px 0 0; }
    .column-head strong { font-size: .82rem; text-transform: uppercase; letter-spacing: .06em; }
    .badge { min-width: 25px; text-align: center; padding: 3px 7px; border-radius: 99px; background: #23334d; color: var(--muted); font-size: .75rem; }
    .cards { padding: 9px; overflow-y: auto; display: grid; gap: 8px; }
    .card { display: block; text-decoration: none; background: var(--panel-2); border: 1px solid #2a3b58; padding: 11px; border-radius: 10px; transition: transform .12s, border-color .12s; }
    .card:hover { transform: translateY(-1px); border-color: var(--accent); }
    .card-id { font-size: .7rem; color: var(--accent); font-weight: 800; letter-spacing: .04em; }
    .card-title { margin: 5px 0 9px; line-height: 1.3; font-size: .9rem; }
    .card-meta { display: flex; gap: 5px; flex-wrap: wrap; }
    .tag { color: var(--muted); background: #0a1423; border-radius: 6px; padding: 3px 6px; font-size: .68rem; }
    .tag.bad { color: #fecdd3; background: #4c1826; }
    .empty { color: var(--muted); font-size: .8rem; padding: 10px; }
    .tree { display: grid; gap: 11px; }
    details { border: 1px solid var(--line); background: var(--panel); border-radius: 11px; }
    summary { cursor: pointer; padding: 13px; list-style: none; display: flex; justify-content: space-between; gap: 12px; }
    summary::-webkit-details-marker { display: none; }
    .tree-body { border-top: 1px solid var(--line); padding: 12px; display: grid; gap: 8px; }
    .feature { background: #0a1525; border-radius: 9px; padding: 11px; }
    .feature-title { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 7px; }
    .story-list { color: var(--muted); font-size: .8rem; display: flex; gap: 7px; flex-wrap: wrap; }
    .story-link { padding: 4px 7px; background: #132139; border-radius: 6px; text-decoration: none; }
    .decision-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; }
    .decision-list { display: grid; gap: 9px; }
    .decision-card { border: 1px solid var(--line); background: var(--panel-2); border-radius: 10px; padding: 13px; }
    .decision-card h3 { font-size: .92rem; margin: 5px 0 8px; }
    .decision-card p { color: var(--muted); font-size: .82rem; line-height: 1.45; margin: 0; }
    .decision-card footer { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; color: var(--muted); font-size: .72rem; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--warn); margin-right: 6px; }
    .document-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 11px; }
    .document-card { border: 1px solid var(--line); background: var(--panel-2); border-radius: 10px; padding: 13px; }
    .document-card h3 { margin: 7px 0 10px; font-size: .92rem; line-height: 1.35; }
    .document-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .document-footer { display: flex; justify-content: space-between; gap: 9px; color: var(--muted); font-size: .74rem; }
    .status-draft { color: var(--muted); }
    .status-review { color: var(--warn); }
    .status-done { color: var(--good); }
    .muted { color: var(--muted); }
    @media (max-width: 1050px) { .metrics { grid-template-columns: repeat(3, 1fr); } .grid-2, .decision-layout { grid-template-columns: 1fr; } .filters { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 640px) { .shell { padding: 17px; } .header { align-items: start; flex-direction: column; } .metrics { grid-template-columns: repeat(2, 1fr); } .filters { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="header">
      <div>
        <div class="eyebrow">Source canonique · Git</div>
        <h1>Pilotage du projet Magrit</h1>
        <p class="subtitle">Vue générée depuis les epics, fonctionnalités, stories, décisions, questions ouvertes et suivi des réunions du dépôt. Toute modification se fait dans les sources, jamais dans ce tableau.</p>
      </div>
      <div class="source-pill" id="source-pill"></div>
    </header>

    <nav class="tabs" aria-label="Vues du tableau de bord">
      <button class="tab" data-view="overview" aria-selected="true">Synthèse</button>
      <button class="tab" data-view="kanban" aria-selected="false">Kanban</button>
      <button class="tab" data-view="hierarchy" aria-selected="false">Epics → stories</button>
      <button class="tab" data-view="decisions" aria-selected="false">Décisions</button>
      <button class="tab" data-view="meetings" aria-selected="false">Réunions & reports</button>
    </nav>

    <section class="view" id="view-overview"></section>
    <section class="view" id="view-kanban" hidden></section>
    <section class="view" id="view-hierarchy" hidden></section>
    <section class="view" id="view-decisions" hidden></section>
    <section class="view" id="view-meetings" hidden></section>
  </main>

  <script id="dashboard-data" type="application/json">${safeJson({ ...model, deliveryOrder: DELIVERY_ORDER })}</script>
  <script>
    const data = JSON.parse(document.getElementById('dashboard-data').textContent);
    const sourceUrl = path => 'https://github.com/' + data.repository + '/blob/' + data.reference + '/' + path;
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const link = (className, item, text) => {
      const node = el('a', className, text);
      node.href = sourceUrl(item.sourcePath);
      node.target = '_blank';
      node.rel = 'noreferrer';
      return node;
    };
    const label = value => ({
      'not-started': 'À démarrer', ready: 'Prête', 'in-progress': 'En cours', implemented: 'Implémentée',
      verified: 'Vérifiée', released: 'Livrée', blocked: 'Bloquée', cancelled: 'Annulée',
      draft: 'Brouillon', review: 'En revue', approved: 'Approuvée', contradictory: 'Contradictoire',
      superseded: 'Remplacée', deprecated: 'Dépréciée', adopted: 'Adoptée', proposed: 'Proposée', deferred: 'Différée',
      done: 'Traité', meeting: 'Compte rendu', report: 'Report'
    }[value] || value || 'Non renseigné');

    document.getElementById('source-pill').textContent = data.metrics.epics + ' epics · ' + data.metrics.features + ' fonctionnalités · ' + data.metrics.stories + ' stories';

    function metric(value, title) {
      const node = el('article', 'metric');
      node.append(el('strong', '', String(value)), el('span', '', title));
      return node;
    }

    function barChart(title, values) {
      const panel = el('article', 'panel');
      panel.append(el('h2', '', title));
      const bars = el('div', 'bars');
      const max = Math.max(1, ...Object.values(values));
      for (const [name, count] of Object.entries(values)) {
        const row = el('div', 'bar-row');
        const track = el('div', 'bar-track');
        const fill = el('div', 'bar-fill');
        fill.style.width = (count / max * 100) + '%';
        track.append(fill);
        row.append(el('span', '', label(name)), track, el('span', 'bar-count', String(count)));
        bars.append(row);
      }
      panel.append(bars);
      return panel;
    }

    function renderOverview() {
      const root = document.getElementById('view-overview');
      const metrics = el('div', 'metrics');
      metrics.append(
        metric(data.metrics.epics, 'Epics'), metric(data.metrics.features, 'Fonctionnalités'),
        metric(data.metrics.stories, 'Stories'), metric(data.metrics.openQuestions, 'Questions ouvertes'),
        metric(data.metrics.contradictory, 'Spécifications contradictoires'), metric(data.metrics.blocked, 'Stories bloquées'),
        metric(data.metrics.documentsToProcess, 'Documents à traiter')
      );
      const grid = el('div', 'grid-2');
      const charts = el('div', 'panel');
      charts.style.display = 'grid'; charts.style.gap = '18px';
      charts.append(barChart('État de livraison', data.metrics.deliveryStatuses), barChart('Maturité des spécifications', data.metrics.specStatuses));
      charts.querySelectorAll(':scope > .panel').forEach(node => { node.style.border = '0'; node.style.padding = '0'; node.style.background = 'transparent'; });
      const attention = el('article', 'panel');
      attention.append(el('h2', '', 'À arbitrer en priorité'));
      const list = el('div', 'attention');
      for (const question of data.openQuestions.slice(0, 7)) {
        const item = link('attention-item', question, '');
        item.append(el('strong', '', question.id), el('span', '', question.question));
        list.append(item);
      }
      attention.append(list);
      grid.append(charts, attention);
      root.append(metrics, grid);
    }

    const filterState = { search: '', epic: '', feature: '', spec: '' };
    function selectControl(labelText, values, key) {
      const select = el('select', 'control');
      select.setAttribute('aria-label', labelText);
      select.append(new Option(labelText, ''));
      for (const value of values) select.append(new Option(value, value));
      select.addEventListener('change', event => { filterState[key] = event.target.value; renderKanbanCards(); });
      return select;
    }
    function filteredStories() {
      const query = filterState.search.toLocaleLowerCase('fr');
      return data.stories.filter(story =>
        (!query || (story.id + ' ' + story.title + ' ' + story.summary).toLocaleLowerCase('fr').includes(query)) &&
        (!filterState.epic || story.epic === filterState.epic) &&
        (!filterState.feature || story.feature === filterState.feature) &&
        (!filterState.spec || story.specStatus === filterState.spec)
      );
    }
    function storyCard(story) {
      const node = link('card', story, '');
      node.append(el('div', 'card-id', story.id), el('div', 'card-title', story.title));
      const meta = el('div', 'card-meta');
      meta.append(el('span', 'tag', story.epic || 'sans epic'), el('span', 'tag', story.feature || 'sans fonctionnalité'));
      if (story.specStatus === 'contradictory') meta.append(el('span', 'tag bad', 'contradictoire'));
      node.append(meta);
      return node;
    }
    function renderKanbanCards() {
      const stories = filteredStories();
      for (const status of data.deliveryOrder) {
        const cards = document.querySelector('[data-column="' + status + '"] .cards');
        const count = document.querySelector('[data-column="' + status + '"] .badge');
        cards.replaceChildren();
        const matching = stories.filter(story => story.deliveryStatus === status);
        count.textContent = matching.length;
        if (!matching.length) cards.append(el('div', 'empty', 'Aucune story'));
        else matching.forEach(story => cards.append(storyCard(story)));
      }
    }
    function renderKanban() {
      const root = document.getElementById('view-kanban');
      const filters = el('div', 'filters');
      const search = el('input', 'control');
      search.type = 'search'; search.placeholder = 'Rechercher une story…'; search.setAttribute('aria-label', 'Rechercher une story');
      search.addEventListener('input', event => { filterState.search = event.target.value; renderKanbanCards(); });
      filters.append(
        search,
        selectControl('Tous les epics', data.epics.map(item => item.id), 'epic'),
        selectControl('Toutes les fonctionnalités', data.features.map(item => item.id), 'feature'),
        selectControl('Tous les statuts de spec', Object.keys(data.metrics.specStatuses), 'spec')
      );
      const board = el('div', 'kanban');
      for (const status of data.deliveryOrder) {
        const column = el('section', 'column'); column.dataset.column = status;
        const head = el('header', 'column-head');
        head.append(el('strong', '', label(status)), el('span', 'badge', '0'));
        column.append(head, el('div', 'cards'));
        board.append(column);
      }
      root.append(filters, board);
      renderKanbanCards();
    }

    function renderHierarchy() {
      const root = document.getElementById('view-hierarchy');
      const tree = el('div', 'tree');
      for (const epic of data.epics) {
        const details = el('details');
        const relatedFeatures = data.features.filter(feature => feature.epic === epic.id);
        const relatedStories = data.stories.filter(story => story.epic === epic.id);
        const summary = el('summary');
        const title = el('span'); title.append(el('strong', '', epic.id + ' · '), document.createTextNode(epic.title));
        summary.append(title, el('span', 'badge', relatedFeatures.length + ' fonctionnalités · ' + relatedStories.length + ' stories'));
        const body = el('div', 'tree-body');
        if (epic.summary) body.append(el('p', 'muted', epic.summary));
        for (const feature of relatedFeatures) {
          const featureStories = relatedStories.filter(story => story.feature === feature.id);
          const block = el('div', 'feature');
          const heading = el('div', 'feature-title');
          heading.append(link('', feature, feature.id + ' · ' + feature.title), el('span', 'badge', String(featureStories.length)));
          const stories = el('div', 'story-list');
          featureStories.forEach(story => stories.append(link('story-link', story, story.id)));
          block.append(heading, stories);
          body.append(block);
        }
        details.append(summary, body); tree.append(details);
      }
      root.append(tree);
    }

    function decisionCard(item, isQuestion = false) {
      const node = el('article', 'decision-card');
      const marker = el('div', 'card-id'); marker.append(el('span', 'status-dot'), document.createTextNode(item.id));
      node.append(marker, el('h3', '', isQuestion ? item.question : item.title));
      if (!isQuestion && item.summary) node.append(el('p', '', item.summary));
      const footer = el('footer');
      footer.append(el('span', '', isQuestion ? (item.owner || 'Responsable à nommer') : label(item.decisionStatus)));
      footer.append(link('', item, 'Ouvrir la source ↗'));
      node.append(footer);
      return node;
    }
    function renderDecisions() {
      const root = document.getElementById('view-decisions');
      const layout = el('div', 'decision-layout');
      const questions = el('section', 'panel'); questions.append(el('h2', '', 'Questions ouvertes (' + data.openQuestions.length + ')'));
      const qList = el('div', 'decision-list'); data.openQuestions.forEach(item => qList.append(decisionCard(item, true))); questions.append(qList);
      const decisions = el('section', 'panel'); decisions.append(el('h2', '', 'Décisions enregistrées (' + data.decisions.length + ')'));
      const dList = el('div', 'decision-list'); data.decisions.forEach(item => dList.append(decisionCard(item))); decisions.append(dList);
      layout.append(questions, decisions); root.append(layout);
    }

    function renderMeetings() {
      const root = document.getElementById('view-meetings');
      const metrics = el('div', 'metrics');
      for (const status of ['draft', 'review', 'done']) {
        metrics.append(metric(data.metrics.meetingStatuses[status] || 0, label(status)));
      }
      const panel = el('section', 'panel');
      panel.append(el('h2', '', 'Suivi des comptes rendus et reports'));
      const grid = el('div', 'document-grid');
      for (const item of data.meetingDocuments) {
        const card = el('article', 'document-card');
        const identifier = el('div', 'card-id', item.id);
        const title = link('', item, item.title);
        const heading = el('h3'); heading.append(title);
        const meta = el('div', 'document-meta');
        meta.append(
          el('span', 'tag', label(item.kind)),
          el('span', 'tag status-' + item.processingStatus, label(item.processingStatus)),
          el('span', 'tag', (item.openItemCount || 0) + ' point(s) ouvert(s)')
        );
        const footer = el('div', 'document-footer');
        footer.append(el('span', '', item.owner === 'unassigned' ? 'Responsable à nommer' : item.owner), el('span', '', item.date || 'Date non renseignée'));
        card.append(identifier, heading, meta, footer); grid.append(card);
      }
      panel.append(grid); root.append(metrics, panel);
    }

    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(candidate => candidate.setAttribute('aria-selected', String(candidate === tab)));
      document.querySelectorAll('.view').forEach(view => { view.hidden = view.id !== 'view-' + tab.dataset.view; });
    }));

    renderOverview(); renderKanban(); renderHierarchy(); renderDecisions(); renderMeetings();
  </script>
</body>
</html>\n`;
}
