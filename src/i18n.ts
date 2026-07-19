export type Lang = 'es' | 'en';

export const t = {
  es: {
    appTitle: 'Todo-OSINT',
    appSubtitle: 'Captura ideas al vuelo. Conecta conocimiento. Sin dependencias externas.',
    tabs: { capture: 'Capturar', entries: 'Entradas', calendar: 'Calendario', workspace: 'Workspace', pomodoro: 'Pomodoro', knowledge: 'Knowledge', about: 'About' },
    capture: { title: 'Captura al vuelo', subtitle: 'Apareció una idea? Anótala antes de que se escape.', placeholder: 'Título de la idea...', details: 'Detalles (opcional)...', project: 'Proyecto', tags: 'tags, separados', priority: 'Prioridad:', submit: 'Capturar' },
    entries: { search: 'Buscar...', type: 'Tipo', all: 'Todos', status: 'Estado', allStatus: 'Todas', active: '🟢 Activas', completed: '✓ Completadas', empty: 'No hay entradas aún. Captura tu primera idea!', ideas: '💡 Ideas', tasks: '✅ Tareas', notes: '📝 Notas', insights: '🧠 Insights' },
    calendar: { title: 'Calendario', subtitle: 'Visualiza tus entradas con fecha.' },
    pomodoro: { title: 'Pomodoro', subtitle: 'Enfócate.', deepWork: 'minutos de trabajo profundo.', start: 'Iniciar', pause: 'Pausar', reset: 'Reset', completed: 'Completados', focusTime: 'Tiempo enfocado', today: 'Hoy', total: 'Total' },
    knowledge: { title: 'Knowledge Engine', subtitle: 'Análisis automático de tus entradas: conexiones, temas y recomendaciones.', project: 'Proyecto (opcional)', analyze: 'Analizar', analyzing: 'Analizando...', empty: 'No hay entradas para analizar.' },
    workspace: { title: 'Workspace', subtitle: 'Outline + Kanban + Notas enlazadas + Graph.', outline: 'Outline', kanban: 'Kanban', linked: 'Enlazadas', graph: 'Graph', empty: 'No hay entradas aún.' },
    about: { title: 'Todo-OSINT', subtitle: 'Captura ideas al vuelo. Conecta conocimiento. Sin dependencias externas.', pwaTitle: '📱 PWA — Tu app, sin app store', pwaDesc: 'Todo-OSINT es una Progressive Web App. Se instala en tu dispositivo como una app nativa, funciona offline, y no pasa por ninguna tienda.', installClick: 'Instalación 1 click', offline: 'Funciona offline', noStore: 'Sin app store', methodology: 'Metodología', howTo: 'How To', faq: 'FAQ', monetization: '💰 Modelo de Negocio', free: 'Free', pro: 'Pro', team: 'Team', entriesUnlimited: 'Todo el core: CRUD, Workspace, Pomodoro, PWA, Export', aiUnlimited: 'AI analysis, cloud sync, export PDF, custom themes', workspace: 'Shared workspaces, team members, admin dashboard', aboutProject: 'Sobre el proyecto', aboutDesc: 'Todo-OSINT nace de una necesidad real: las mejores ideas aparecen cuando no estás buscando. Captúralas con mínima fricción, conéctalas con backlinks automáticos, y ejecútalas con Kanban + Pomodoro. Sin APIs externas, sin costes ocultos, 100% offline-capable.' },
    auth: { login: 'Login', register: 'Registro', email: 'Email', password: 'Password (min 6 chars)', enter: 'Entrar', createAccount: 'Crear cuenta', install: 'Instalar', installDesc: 'Instala Todo-OSINT en tu dispositivo', installSub: 'Acceso instantáneo, funciona offline, sin app store' },
    types: { idea: 'idea', task: 'tarea', note: 'nota', insight: 'insight' },
    faqs: [
      { q: 'Es viable monetizar?', a: 'Sí. Modelo SaaS freemium probado. Target: knowledge workers, founders, investigadores.' },
      { q: 'Donde se guardan los datos?', a: 'SQLite en el servidor. Cada usuario solo ve sus entradas. Auth con JWT.' },
      { q: 'Necesito API key de IA?', a: 'No. Todo funciona sin IA: conexiones automáticas por tags/proyectos, outline jerárquico, Kanban, graph view y análisis de conocimiento. La IA es opcional.' },
      { q: 'Puedo usarlo offline?', a: 'Como PWA sí. Se instala en tu dispositivo y funciona sin conexión.' },
      { q: 'Cómo instalo la PWA?', a: 'En Chrome/Edge: icono de instalación en la barra URL. En móvil: "Add to Home Screen".' },
      { q: 'Anti-fraude?', a: 'Rate limiting por IP + device fingerprint. Máx 3 cuentas por dispositivo.' },
    ]
  },
  en: {
    appTitle: 'Todo-OSINT',
    appSubtitle: 'Capture ideas on the fly. Connect knowledge. No external dependencies.',
    tabs: { capture: 'Capture', entries: 'Entries', calendar: 'Calendar', workspace: 'Workspace', pomodoro: 'Pomodoro', knowledge: 'Knowledge', about: 'About' },
    capture: { title: 'Capture on the fly', subtitle: 'Got an idea? Write it down before it escapes.', placeholder: 'Idea title...', details: 'Details (optional)...', project: 'Project', tags: 'tags, separated', priority: 'Priority:', submit: 'Capture' },
    entries: { search: 'Search...', type: 'Type', all: 'All', status: 'Status', allStatus: 'All', active: '🟢 Active', completed: '✓ Completed', empty: 'No entries yet. Capture your first idea!', ideas: '💡 Ideas', tasks: '✅ Tasks', notes: '📝 Notes', insights: '🧠 Insights' },
    calendar: { title: 'Calendar', subtitle: 'View your dated entries.' },
    pomodoro: { title: 'Pomodoro', subtitle: 'Focus.', deepWork: 'minutes of deep work.', start: 'Start', pause: 'Pause', reset: 'Reset', completed: 'Completed', focusTime: 'Focus time', today: 'Today', total: 'Total' },
    knowledge: { title: 'Knowledge Engine', subtitle: 'Automatic analysis: connections, themes, and recommendations from your entries.', project: 'Project (optional)', analyze: 'Analyze', analyzing: 'Analyzing...', empty: 'No entries to analyze.' },
    workspace: { title: 'Workspace', subtitle: 'Outline + Kanban + Linked Notes + Graph.', outline: 'Outline', kanban: 'Kanban', linked: 'Linked', graph: 'Graph', empty: 'No entries yet.' },
    about: { title: 'Todo-OSINT', subtitle: 'Capture ideas on the fly. Connect knowledge. No external dependencies.', pwaTitle: '📱 PWA — Your app, no app store', pwaDesc: 'Todo-OSINT is a Progressive Web App. Installs on your device like a native app, works offline, and bypasses all app stores.', installClick: '1-click install', offline: 'Works offline', noStore: 'No app store', methodology: 'Methodology', howTo: 'How To', faq: 'FAQ', monetization: '💰 Business Model', free: 'Free', pro: 'Pro', team: 'Team', entriesUnlimited: 'Full core: CRUD, Workspace, Pomodoro, PWA, Export', aiUnlimited: 'AI analysis, cloud sync, export PDF, custom themes', workspace: 'Shared workspaces, team members, admin dashboard', aboutProject: 'About the project', aboutDesc: 'Todo-OSINT was born from a real need: the best ideas come when you\'re not looking. Capture them with minimal friction, connect them with automatic backlinks, and execute with Kanban + Pomodoro. No external APIs, no hidden costs, 100% offline-capable.' },
    auth: { login: 'Login', register: 'Register', email: 'Email', password: 'Password (min 6 chars)', enter: 'Sign In', createAccount: 'Create Account', install: 'Install', installDesc: 'Install Todo-OSINT on your device', installSub: 'Instant access, works offline, no app store' },
    types: { idea: 'idea', task: 'task', note: 'note', insight: 'insight' },
    faqs: [
      { q: 'Is monetization viable?', a: 'Yes. Proven freemium SaaS model. Target: knowledge workers, founders, researchers.' },
      { q: 'Where is data stored?', a: 'SQLite on the server. Each user only sees their entries. JWT auth.' },
      { q: 'Do I need an AI API key?', a: 'No. Everything works without AI: automatic connections by tags/projects, hierarchical outline, Kanban, graph view, and knowledge analysis. AI is optional.' },
      { q: 'Can I use it offline?', a: 'As a PWA yes. It installs on your device and works without connection.' },
      { q: 'How do I install the PWA?', a: 'On Chrome/Edge: install icon in the URL bar. On mobile: "Add to Home Screen".' },
      { q: 'Anti-fraud?', a: 'Rate limiting per IP + device fingerprint. Max 3 accounts per device.' },
    ]
  }
};
