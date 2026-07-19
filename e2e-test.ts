// E2E test scenario: simulated real user (founder / knowledge worker)
// Captures varied entries over a "week", then exercises AI connect, mindmap, summarize.
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';

// Simulated raw captures a real user would make (messy, real-world)
const CAPTURES = [
  { type: 'idea', title: 'Build a habit tracker mobile app', content: 'React Native, daily streaks, widgets', project: 'HabitTracker', tags: ['mobile', 'product'], priority: 3 },
  { type: 'note', title: 'Atomic Habits: habit stacking', content: 'Link new habit to existing one, e.g. after coffee', project: 'HabitTracker', tags: ['books', 'psychology'], priority: 0 },
  { type: 'insight', title: 'Streaks cause churn when broken', content: 'Users quit after missing 1 day. Need grace period.', project: 'HabitTracker', tags: ['retention', 'psychology'], priority: 2 },
  { type: 'task', title: 'Sketch onboarding flow', content: '3 screens: welcome, first habit, reminder setup', project: 'HabitTracker', tags: ['design', 'ux'], priority: 1 },
  { type: 'idea', title: 'Pomodoro for deep work blocks', content: 'Use 25/5 cycles to ship features faster', project: 'Productivity', tags: ['focus', 'method'], priority: 1 },
  { type: 'note', title: 'Cal Newport deep work definition', content: 'Professional activities performed in a state of distraction-free concentration', project: 'Productivity', tags: ['books', 'focus'], priority: 0 },
  { type: 'insight', title: 'Our app overlaps with note-taking tools', content: 'Differentiator must be AI auto-connections, not capture', project: 'Strategy', tags: ['competition', 'strategy'], priority: 3 },
  { type: 'task', title: 'Research competitors: Notion Obsidian Roam', content: 'Compare friction of capture', project: 'Strategy', tags: ['competition', 'research'], priority: 2 },
  { type: 'idea', title: 'Voice capture for shower thoughts', content: 'Speech to text, 1-tap, zero friction', project: 'HabitTracker', tags: ['mobile', 'ux'], priority: 2 },
  { type: 'note', title: 'Gemini free tier is generous', content: '1M context, rate-limited, no card. Good for MVP AI', project: 'Strategy', tags: ['ai', 'cost'], priority: 0 },
];

async function post(path: string, body: any) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
async function get(path: string) {
  const r = await fetch(BASE + path);
  return r.json();
}

(async () => {
  console.log('=== SIMULATED USER: 1 week of captures ===\n');
  const ids: number[] = [];
  for (const c of CAPTURES) {
    const e = await post('/api/entries', c);
    ids.push(e.id);
    console.log(`+ [${c.type}] ${c.title} (id ${e.id})`);
  }

  console.log('\n=== AI CONNECT (per entry, enriches related_ids) ===');
  for (const id of ids.slice(0, 3)) {
    const r = await post('/api/ai/connect', { entryId: id });
    console.log(`\nEntry ${id}: ${r.connections?.length || 0} local connections`);
    if (r.aiInsight) console.log(`  🤖 AI insight: ${r.aiInsight.slice(0, 200)}...`);
  }

  console.log('\n=== AI MINDMAP (clustered by Gemini) ===');
  const mm = await post('/api/ai/mindmap', {});
  const groups = new Map<string, number>();
  for (const n of mm.nodes) if (n.level === 1) groups.set(n.label, 0);
  for (const n of mm.nodes) if (n.level === 2) groups.set(n.group, (groups.get(n.group) || 0) + 1);
  for (const [g, c] of groups) console.log(`  📂 ${g}: ${c} entries`);
  console.log(`  Total nodes: ${mm.nodes.length}, edges: ${mm.edges.length}`);

  console.log('\n=== AI SUMMARIZE (knowledge report) ===');
  const sum = await post('/api/ai/summarize', {});
  console.log(sum.summary.slice(0, 1200));

  console.log('\n=== STATS ===');
  const stats = await get('/api/stats');
  console.log(JSON.stringify(stats, null, 2));

  const out = { ids, mindmap: mm, summary: sum.summary, stats };
  fs.writeFileSync(path.join(process.cwd(), 'data', 'e2e-result.json'), JSON.stringify(out, null, 2));
  console.log('\n✅ E2E scenario saved to data/e2e-result.json');
})();
