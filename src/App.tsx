import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Brain, Map as MapIcon, Timer, BookOpen, Info, CheckCircle, MessageCircle, Trash2, Tag, Folder, Zap, CalendarIcon, LogIn, UserPlus, LogOut, User, Download, Smartphone, Globe, Crown, Lock, Sun, Moon, Sparkles, GripVertical, CheckSquare, Square, FileJson, FileText, LayoutGrid, Columns, Link2, ChevronRight, ChevronDown, MoveRight, Mic } from 'lucide-react';
import { Entry, EntryComment } from './types';
import { t, Lang } from './i18n';

type TabType = 'capture' | 'entries' | 'workspace' | 'pomodoro' | 'knowledge' | 'calendar' | 'about';

const API = (path: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, { ...opts, headers });
};

export default function App() {
  const [user, setUser] = useState<{ email: string; userId: number; plan: string } | null>(null);
  const [lang, setLang] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'es');
  const tr = t[lang];
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('theme') as any) || 'dark');
  const [pwaInstallable, setPwaInstallable] = useState(false);
  const [pwaBannerVisible, setPwaBannerVisible] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<TabType>('capture');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [pomodoroStats, setPomodoroStats] = useState<any>(null);
  const [aiUsage, setAiUsage] = useState<any>(null);

  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60);
  const [pomodoroIsRunning, setPomodoroIsRunning] = useState(false);
  const [pomodoroDuration, setPomodoroDuration] = useState(25);

  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [selectedEntry, onSelectEntry] = useState<Entry | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      API('/api/auth/me').then(r => {
        if (r.ok) return r.json();
        localStorage.removeItem('token');
        return null;
      }).then(u => { if (u) setUser(u); });
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleLang = () => {
    const newLang = lang === 'es' ? 'en' : 'es';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'BeforeInstallPromptEvent' in window) {
      window.addEventListener('beforeinstallprompt', (e: any) => {
        e.preventDefault();
        setPwaInstallable(true);
        const dismissed = localStorage.getItem('pwa-banner-dismissed');
        if (!dismissed) setPwaBannerVisible(true);
      });
    }
  }, []);

  const handlePwaInstall = () => {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.prompt();
      e.userChoice.then(() => { setPwaBannerVisible(false); setPwaInstallable(false); });
    });
  };

  const dismissPwaBanner = () => {
    setPwaBannerVisible(false);
    localStorage.setItem('pwa-banner-dismissed', '1');
  };

  useEffect(() => { if (!user) return; fetchEntries(); fetchStats(); fetchPomodoroStats(); fetchAiUsage(); }, [user]);

  useEffect(() => { if (!user) return; fetchCalendar(); }, [user, calendarYear, calendarMonth]);

  useEffect(() => {
    if (!pomodoroIsRunning || pomodoroTimeLeft <= 0) return;
    const timer = setInterval(() => setPomodoroTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [pomodoroIsRunning, pomodoroTimeLeft]);

  const handlePomodoroComplete = useCallback(() => {
    API('/api/pomodoro', {
      method: 'POST',
      body: JSON.stringify({ duration_minutes: pomodoroDuration }),
    }).then(() => fetchPomodoroStats());
  }, [pomodoroDuration]);

  useEffect(() => {
    if (pomodoroTimeLeft === 0 && pomodoroIsRunning) {
      setPomodoroIsRunning(false);
      handlePomodoroComplete();
    }
  }, [pomodoroTimeLeft, pomodoroIsRunning, handlePomodoroComplete]);

  const fetchEntries = async () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (filterType) params.set('type', filterType);
    if (filterStatus) params.set('status', filterStatus);
    const res = await API(`/api/entries?${params}`);
    if (res.ok) setEntries(await res.json());
  };

  const fetchCalendar = async () => {
    const res = await API(`/api/calendar?year=${calendarYear}&month=${calendarMonth}`);
    if (res.ok) setCalendarEntries(await res.json());
  };

  const fetchStats = async () => { const r = await API('/api/stats'); if (r.ok) setStats(await r.json()); };
  const fetchPomodoroStats = async () => { const r = await API('/api/pomodoro/stats'); if (r.ok) setPomodoroStats(await r.json()); };
  const fetchAiUsage = async () => { const r = await API('/api/ai/usage'); if (r.ok) setAiUsage(await r.json()); };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const fingerprint = `${navigator.userAgent}|${navigator.language}|${screen.width}x${screen.height}`;
    const res = await API(endpoint, { method: 'POST', body: JSON.stringify({ email: authEmail, password: authPassword, deviceFingerprint: btoa(fingerprint).slice(0, 32) }) });
    const data = await res.json();
    if (!res.ok) { setAuthError(data.error); return; }
    localStorage.setItem('token', data.token);
    setUser({ email: data.email, userId: data.userId, plan: data.plan || 'free' });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setEntries([]);
    setStats(null);
    setPomodoroStats(null);
    setAiUsage(null);
  };

  const handleAddEntry = async (entry: Partial<Entry>) => {
    const res = await API('/api/entries', { method: 'POST', body: JSON.stringify(entry) });
    if (res.ok) {
      const newEntry = await res.json();
      fetchEntries(); fetchStats();
      try {
        const c = await API('/api/ai/connect', { method: 'POST', body: JSON.stringify({ entryId: newEntry.id }) });
        if (c.ok) {
          const data = await c.json();
          if (data.aiInsight) setAiToast({ title: newEntry.title, insight: data.aiInsight });
        }
      } catch {}
    }
  };

  const [aiToast, setAiToast] = useState<{ title: string; insight: string } | null>(null);

  const handleDeleteEntry = async (id: number) => {
    await API(`/api/entries/${id}`, { method: 'DELETE' });
    fetchEntries(); fetchStats();
  };

  const handleToggleStatus = async (entry: Entry) => {
    const newStatus = entry.status === 'completed' ? 'active' : 'completed';
    await API(`/api/entries/${entry.id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
    fetchEntries(); fetchStats();
  };

  const handleBulkAction = async (ids: number[], action: string) => {
    const res = await API('/api/entries/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) });
    if (res.ok) { fetchEntries(); fetchStats(); }
  };

  const handleExport = async (format: 'json' | 'markdown' | 'pdf') => {
    const token = localStorage.getItem('token');
    const url = `/api/export/${format}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url2 = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url2;
      a.download = format === 'json' ? 'todo-osint-export.json' : format === 'pdf' ? 'todo-osint-export.html' : 'todo-osint-export.md';
      a.click();
      URL.revokeObjectURL(url2);
    } else if (res.status === 403) {
      alert('PDF export requires Pro plan');
    }
  };

  const pomodoroMinutes = Math.floor(pomodoroTimeLeft / 60);
  const pomodoroSeconds = pomodoroTimeLeft % 60;
  const pomodoroDisplay = `${String(pomodoroMinutes).padStart(2, '0')}:${String(pomodoroSeconds).padStart(2, '0')}`;

  const bg = theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-50';
  const text = theme === 'dark' ? 'text-zinc-100' : 'text-gray-900';
  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100';
  const inputBorder = theme === 'dark' ? 'border-zinc-700' : 'border-gray-300';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';
  const subtleText = theme === 'dark' ? 'text-zinc-400' : 'text-gray-600';
  const hoverBg = theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-100';

  if (!user) {
    return (
      <div className={`min-h-screen ${bg} ${text} font-sans flex items-center justify-center`}>
        <div className="max-w-sm w-full space-y-6">
          <div className="text-center space-y-2">
            <Zap size={32} className="text-amber-400 mx-auto" />
            <h1 className="text-2xl font-bold">Todo-OSINT</h1>
            <p className={mutedText}>Captura ideas. Conecta conocimiento.</p>
          </div>
          <div className={`${cardBg} border ${cardBorder} rounded-xl p-6 space-y-4`}>
            <div className="flex gap-2">
              <button onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${authMode === 'login' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : `${inputBg} ${mutedText} ${cardBorder}`}`}>
                <LogIn size={14} className="inline mr-1" /> Login
              </button>
              <button onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition ${authMode === 'register' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : `${inputBg} ${mutedText} ${cardBorder}`}`}>
                <UserPlus size={14} className="inline mr-1" /> Registro
              </button>
            </div>
            <form onSubmit={handleAuth} className="space-y-3">
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="Email" required
                className={`w-full ${inputBg} border ${inputBorder} rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50`} />
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Password (min 6 chars)" required minLength={6}
                className={`w-full ${inputBg} border ${inputBorder} rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50`} />
              {authError && <p className="text-xs text-red-400">{authError}</p>}
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-lg transition text-sm">
                {authMode === 'login' ? 'Entrar' : 'Crear cuenta'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${bg} ${text} font-sans`}>
      <header className={`sticky top-0 z-50 ${cardBg}/90 backdrop-blur border-b ${cardBorder}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-amber-400" />
            <h1 className="text-lg font-bold tracking-tight">Todo-OSINT</h1>
            <span className={`text-[10px] ${theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-200 text-gray-600'} px-1.5 py-0.5 rounded font-mono`}>v1.3</span>
          </div>
          <div className="flex items-center gap-3">
            {stats && <div className={`hidden sm:flex items-center gap-1 text-xs ${subtleText}`}>
              <span>{stats.total?.count || 0} entries</span><span className={mutedText}>|</span><span>{stats.recent?.count || 0} today</span>
            </div>}
            {user?.plan === 'pro' && <span className="hidden sm:flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-medium"><Crown size={10} /> PRO</span>}
            {aiUsage && aiUsage.usage !== 'unlimited' && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 font-medium">
                <Sparkles size={10} /> AI: {aiUsage.usage?.reduce((acc: number, u: any) => acc + Number(u.total), 0) || 0} used
              </span>
            )}
            {pomodoroIsRunning && (
              <button onClick={() => setActiveTab('pomodoro')}
                className="flex items-center gap-1.5 bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border border-amber-500/40 hover:bg-amber-500/30 transition">
                <Timer size={12} />
                {pomodoroDisplay}
              </button>
            )}
            <button onClick={toggleTheme} className={`p-1.5 rounded-lg ${hoverBg} ${subtleText} transition`} title="Toggle theme">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={toggleLang} className={`flex items-center gap-1 text-xs ${subtleText} ${hoverBg} rounded-lg px-2 py-1.5 transition`} title="Toggle language">
              <Globe size={14} />
              <span className="uppercase text-[10px] font-bold">{lang}</span>
            </button>
            <div className={`flex items-center gap-2 text-xs ${subtleText}`}>
              <User size={14} />
              <span className="hidden sm:inline">{user.email}</span>
              <button onClick={handleLogout} className="p-1 hover:text-red-400 transition"><LogOut size={14} /></button>
            </div>
          </div>
        </div>
      </header>

      {pwaBannerVisible && user && (
        <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border-b border-amber-500/20 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Smartphone size={18} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-300">Instala Todo-OSINT en tu dispositivo</p>
                <p className="text-[10px] text-zinc-400">Acceso instantáneo, funciona offline, sin app store</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handlePwaInstall} className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-3 py-1.5 rounded-lg text-xs font-bold transition">
                <Download size={12} /> Instalar
              </button>
              <button onClick={dismissPwaBanner} className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
            </div>
          </div>
        </div>
      )}

      <nav className={`${cardBg} border-b ${cardBorder} sticky top-14 z-40`}>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto py-2">
          {([
            { id: 'capture' as TabType, icon: Plus, label: tr.tabs.capture },
            { id: 'entries' as TabType, icon: BookOpen, label: tr.tabs.entries },
            { id: 'calendar' as TabType, icon: CalendarIcon, label: tr.tabs.calendar },
            { id: 'workspace' as TabType, icon: LayoutGrid, label: tr.tabs.workspace },
            { id: 'pomodoro' as TabType, icon: Timer, label: tr.tabs.pomodoro },
            { id: 'knowledge' as TabType, icon: Brain, label: tr.tabs.knowledge },
            { id: 'about' as TabType, icon: Info, label: tr.tabs.about },
          ]).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition ${activeTab === tab.id ? 'bg-amber-500/20 text-amber-400' : `${subtleText} ${hoverBg}`}`}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'capture' && <CaptureTab onAdd={handleAddEntry} theme={theme} lang={lang} />}
        {activeTab === 'entries' && <EntriesTab entries={entries} searchQuery={searchQuery} setSearchQuery={setSearchQuery} filterType={filterType} setFilterType={setFilterType} filterStatus={filterStatus} setFilterStatus={setFilterStatus} onDelete={handleDeleteEntry} onToggle={handleToggleStatus} onFilter={fetchEntries} onBulk={handleBulkAction} onExport={handleExport} onComment={onSelectEntry} theme={theme} />}
        {activeTab === 'calendar' && <CalendarTab entries={calendarEntries} year={calendarYear} month={calendarMonth} onYearChange={setCalendarYear} onMonthChange={setCalendarMonth} theme={theme} />}
        {activeTab === 'workspace' && <WorkspaceTab entries={entries} selectedEntry={selectedEntry} onSelectEntry={onSelectEntry} onStatusChange={(id, status) => { API(`/api/entries/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }).then(() => fetchEntries()); }} theme={theme} />}
        {activeTab === 'pomodoro' && <PomodoroTab stats={pomodoroStats} timeLeft={pomodoroTimeLeft} setTimeLeft={setPomodoroTimeLeft} isRunning={pomodoroIsRunning} setIsRunning={setPomodoroIsRunning} duration={pomodoroDuration} setDuration={setPomodoroDuration} lang={lang} theme={theme} />}
        {activeTab === 'knowledge' && <KnowledgeTab lang={lang} theme={theme} aiUsage={aiUsage} />}
        {activeTab === 'about' && <AboutTab lang={lang} theme={theme} />}
      </main>

      {aiToast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <div className={`${cardBg} border ${cardBorder} rounded-xl p-4 shadow-2xl border-amber-500/30`}>
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-400 mb-1">Conexión sugerida</p>
                <p className="text-xs text-zinc-300 leading-relaxed">{aiToast.insight}</p>
              </div>
              <button onClick={() => setAiToast(null)} className="text-zinc-500 hover:text-zinc-300"><Trash2 size={14} /></button>
            </div>
          </div>
        </div>
      )}
      {selectedEntry && <EntryCommentsPanel entry={selectedEntry} lang={lang} theme={theme} authEmail={user?.email || ''} onClose={() => onSelectEntry(null)} />}
    </div>
  );
}

function CaptureTab({ onAdd, theme, lang }: { onAdd: (e: Partial<Entry>) => void; theme: string; lang: Lang }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<Entry['type']>('idea');
  const [project, setProject] = useState('');
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [autoTagging, setAutoTagging] = useState(false);
  const [listening, setListening] = useState(false);

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const startVoice = () => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = lang === 'es' ? 'es-ES' : 'en-US';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setTitle(prev => (prev ? prev + ' ' : '') + text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const inputBg = theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100';
  const inputBorder = theme === 'dark' ? 'border-zinc-700' : 'border-gray-300';
  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ type, title: title.trim(), content: content.trim(), project: project.trim(), tags: tags.split(',').map(t => t.trim()).filter(Boolean), priority, due_date: dueDate || undefined });
    setTitle(''); setContent(''); setProject(''); setTags(''); setPriority(0); setDueDate('');
  };

  const handleAutoTag = async () => {
    if (!title.trim()) return;
    setAutoTagging(true);
    try {
      const res = await fetch('/api/ai/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ title, content, type }),
      });
      const data = await res.json();
      if (res.ok && data.tags?.length) {
        setTags(prev => prev ? `${prev}, ${data.tags.join(', ')}` : data.tags.join(', '));
      }
    } catch {}
    setAutoTagging(false);
  };

  const types: { value: Entry['type']; label: string; color: string }[] = [
    { value: 'idea', label: '💡 Idea', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
    { value: 'task', label: '✅ Tarea', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
    { value: 'note', label: '📝 Nota', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
    { value: 'insight', label: '🧠 Insight', color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Captura al vuelo</h2>
        <p className={mutedText}>Apareció una idea? Anótala antes de que se escape.</p>
      </div>
      <form onSubmit={handleSubmit} className={`space-y-4 ${cardBg} border ${cardBorder} rounded-xl p-6`}>
        <div className="flex gap-2">
          {types.map(t => (
            <button key={t.value} type="button" onClick={() => setType(t.value)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition ${type === t.value ? t.color : `${inputBg} ${mutedText} ${cardBorder}`}`}>{t.label}</button>
          ))}
        </div>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título de la idea..."
          className={`w-full ${inputBg} border ${inputBorder} rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50`} autoFocus />
        {SpeechRecognition && (
          <button type="button" onClick={startVoice} disabled={listening}
            className={`mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border transition ${listening ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' : `${inputBg} ${mutedText} ${cardBorder} hover:border-zinc-600`}`}>
            <Mic size={14} />{listening ? 'Escuchando...' : 'Capturar por voz'}
          </button>
        )}
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Detalles (opcional)..." rows={3}
          className={`w-full ${inputBg} border ${inputBorder} rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 resize-none`} />
        <div className="grid grid-cols-2 gap-3">
          <div className={`flex items-center gap-2 ${inputBg} border ${inputBorder} rounded-lg px-3`}>
            <Folder size={14} className={mutedText} />
            <input type="text" value={project} onChange={e => setProject(e.target.value)} placeholder="Proyecto" className="w-full bg-transparent py-2 text-sm focus:outline-none" />
          </div>
          <div className={`flex items-center gap-2 ${inputBg} border ${inputBorder} rounded-lg px-3`}>
            <Tag size={14} className={mutedText} />
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="tags, separados" className="w-full bg-transparent py-2 text-sm focus:outline-none" />
            <button type="button" onClick={handleAutoTag} disabled={autoTagging || !title.trim()} className="p-1 text-amber-400 hover:text-amber-300 disabled:opacity-30 transition" title="Auto-generate tags">
              <Sparkles size={14} className={autoTagging ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3">
            <span className={`text-xs ${mutedText}`}>Prioridad:</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`w-8 h-8 rounded text-xs font-bold transition ${priority === p ? (p >= 3 ? 'bg-red-500/20 text-red-400' : p >= 2 ? 'bg-amber-500/20 text-amber-400' : theme === 'dark' ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-300 text-gray-700') : `${inputBg} ${mutedText}`}`}>{p}</button>
              ))}
            </div>
          </div>
          <div className={`flex items-center gap-2 ${inputBg} border ${inputBorder} rounded-lg px-3`}>
            <CalendarIcon size={14} className={mutedText} />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-transparent py-2 text-sm focus:outline-none" />
          </div>
        </div>
        <button type="submit" disabled={!title.trim()}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-950 font-bold py-3 rounded-lg transition text-sm">Capturar</button>
      </form>
    </div>
  );
}

function EntriesTab({ entries, searchQuery, setSearchQuery, filterType, setFilterType, filterStatus, setFilterStatus, onDelete, onToggle, onFilter, onBulk, onExport, onComment, theme }: any) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const typeColors: Record<string, string> = { idea: 'text-amber-400', task: 'text-emerald-400', note: 'text-blue-400', insight: 'text-purple-400' };
  const typeIcons: Record<string, string> = { idea: '💡', task: '✅', note: '📝', insight: '🧠' };

  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100';
  const inputBorder = theme === 'dark' ? 'border-zinc-700' : 'border-gray-300';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';
  const subtleText = theme === 'dark' ? 'text-zinc-400' : 'text-gray-600';
  const hoverBorder = theme === 'dark' ? 'hover:border-zinc-700' : 'hover:border-zinc-300';

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === entries.length) setSelected(new Set());
    else setSelected(new Set(entries.map((e: Entry) => e.id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <div className={`flex-1 min-w-[150px] flex items-center gap-2 ${cardBg} border ${cardBorder} rounded-lg px-3`}>
          <Search size={14} className={mutedText} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && onFilter()} placeholder="Buscar..." className="w-full bg-transparent py-2 text-sm focus:outline-none" />
        </div>
        <button onClick={onFilter} className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium border border-amber-500/40 hover:bg-amber-500/30 transition">Buscar</button>
        <button onClick={() => onExport('json')} className={`p-2 ${cardBg} border ${cardBorder} rounded-lg ${subtleText} hover:text-amber-400 transition`} title="Export JSON"><FileJson size={16} /></button>
        <button onClick={() => onExport('markdown')} className={`p-2 ${cardBg} border ${cardBorder} rounded-lg ${subtleText} hover:text-amber-400 transition`} title="Export Markdown"><FileText size={16} /></button>
        <button onClick={() => onExport('pdf')} className={`p-2 ${cardBg} border ${cardBorder} rounded-lg ${subtleText} hover:text-amber-400 transition relative`} title="Export PDF (Pro)">
          <Download size={16} />
          <Crown size={8} className="absolute -top-1 -right-1 text-amber-400" />
        </button>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <span className={`text-[10px] ${mutedText} self-center mr-1`}>Tipo:</span>
        {[{ v: '', l: 'Todos' }, { v: 'idea', l: '💡 Ideas' }, { v: 'task', l: '✅ Tareas' }, { v: 'note', l: '📝 Notas' }, { v: 'insight', l: '🧠 Insights' }].map(f => (
          <button key={f.v} onClick={() => { setFilterType(f.v); setTimeout(() => onFilter(), 0); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filterType === f.v ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50' : `${inputBg} ${subtleText} border ${inputBorder} hover:border-zinc-600`}`}>
            {f.l}
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <span className={`text-[10px] ${mutedText} self-center mr-1`}>Estado:</span>
        {[{ v: '', l: 'Todas' }, { v: 'active', l: '🟢 Activas' }, { v: 'completed', l: '✓ Completadas' }].map(f => (
          <button key={f.v} onClick={() => { setFilterStatus(f.v); setTimeout(() => onFilter(), 0); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filterStatus === f.v ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50' : `${inputBg} ${subtleText} border ${inputBorder} hover:border-zinc-600`}`}>
            {f.l}
          </button>
        ))}
      </div>
      {selected.size > 0 && (
        <div className={`flex items-center gap-3 ${cardBg} border ${cardBorder} rounded-lg px-4 py-2`}>
          <span className={`text-xs ${subtleText}`}>{selected.size} selected</span>
          <button onClick={() => onBulk([...selected], 'complete')} className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/40 hover:bg-emerald-500/30 transition">Complete</button>
          <button onClick={() => onBulk([...selected], 'activate')} className={`text-xs ${inputBg} ${subtleText} px-2 py-1 rounded border ${inputBorder} hover:border-zinc-600 transition`}>Activate</button>
          <button onClick={() => onBulk([...selected], 'archive')} className={`text-xs ${inputBg} ${subtleText} px-2 py-1 rounded border ${inputBorder} hover:border-zinc-600 transition`}>Archive</button>
          <button onClick={() => onBulk([...selected], 'delete')} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/40 hover:bg-red-500/30 transition">Delete</button>
          <button onClick={() => setSelected(new Set())} className={`text-xs ${mutedText} ml-auto hover:text-zinc-300 transition`}>Clear</button>
        </div>
      )}
      <div className="space-y-2">
        {entries.length === 0 ? (
          <div className={`text-center py-12 ${mutedText}`}>
            <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No hay entradas aún. Captura tu primera idea!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-2">
              <button onClick={toggleSelectAll} className={`p-1 ${subtleText} hover:text-amber-400 transition`}>
                {selected.size === entries.length ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <span className={`text-[10px] ${mutedText}`}>{entries.length} entries</span>
            </div>
            {entries.map((entry: Entry) => (
              <div
                key={entry.id}
                className={`${cardBg} border ${cardBorder} rounded-lg p-4 transition ${hoverBorder} ${entry.status === 'completed' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleSelect(entry.id)} className={`p-1 mt-0.5 ${subtleText} hover:text-amber-400 transition`}>
                    {selected.has(entry.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm">{typeIcons[entry.type]}</span>
                      <span className={`text-xs font-medium ${typeColors[entry.type]}`}>{entry.type}</span>
                      {entry.project && <span className={`text-[10px] ${inputBg} ${subtleText} px-1.5 py-0.5 rounded font-mono`}>{entry.project}</span>}
                      {entry.priority > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${entry.priority >= 3 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>P{entry.priority}</span>}
                      {entry.status === 'completed' && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-medium">✓ Done</span>}
                    </div>
                    <h3 className={`text-sm font-semibold ${entry.status === 'completed' ? 'line-through text-zinc-500' : theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'}`}>{entry.title}</h3>
                    {entry.content && <p className={`text-xs ${mutedText} mt-1 line-clamp-2`}>{entry.content}</p>}
                    {entry.tags.length > 0 && <div className="flex gap-1 mt-2 flex-wrap">{entry.tags.map((tag, i) => <span key={i} className={`text-[10px] ${inputBg} ${subtleText} px-1.5 py-0.5 rounded`}>#{tag}</span>)}</div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => onComment(entry)} className={`p-1.5 ${mutedText} hover:text-amber-400 transition`} title="Anotar"><MessageCircle size={16} /></button>
                    <button onClick={() => onToggle(entry)} className={`p-1.5 ${mutedText} hover:text-emerald-400 transition`}><CheckCircle size={16} /></button>
                    <button onClick={() => onDelete(entry.id)} className={`p-1.5 ${mutedText} hover:text-red-400 transition`}><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className={`flex items-center gap-3 mt-2 text-[10px] ${mutedText} font-mono`}>
                  <span>{new Date(entry.created_at).toLocaleString()}</span>
                  {entry.due_date && <span className="text-amber-500/70">📅 {entry.due_date}</span>}
                </div>
              </div>
            ))}
          </>
      )}
      </div>
    </div>
  );
}

function CalendarTab({ entries, year, month, onYearChange, onMonthChange, theme }: {
  entries: Entry[]; year: number; month: number;
  onYearChange: (y: number) => void; onMonthChange: (m: number) => void;
  theme: string;
}) {
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDay = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  const entryMap = new Map<string, Entry[]>();
  entries.forEach(e => {
    if (e.due_date) {
      const day = e.due_date.split('-')[2];
      if (!entryMap.has(day)) entryMap.set(day, []);
      entryMap.get(day)!.push(e);
    }
  });

  const prevMonth = () => {
    if (month === 1) { onMonthChange(12); onYearChange(year - 1); }
    else onMonthChange(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { onMonthChange(1); onYearChange(year + 1); }
    else onMonthChange(month + 1);
  };

  const typeDot: Record<string, string> = { idea: 'bg-amber-400', task: 'bg-emerald-400', note: 'bg-blue-400', insight: 'bg-purple-400' };
  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';
  const subtleText = theme === 'dark' ? 'text-zinc-400' : 'text-gray-600';
  const hoverBg = theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-100';
  const cellBg = theme === 'dark' ? 'bg-zinc-800/80' : 'bg-gray-100';
  const cellBorder = theme === 'dark' ? 'border-zinc-700' : 'border-gray-300';

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Calendario</h2>
        <p className={mutedText}>Visualiza tus entradas con fecha.</p>
      </div>
      <div className={`${cardBg} border ${cardBorder} rounded-xl p-6`}>
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className={`p-2 ${hoverBg} rounded-lg transition`}>←</button>
          <h3 className="text-lg font-semibold">{monthNames[month - 1]} {year}</h3>
          <button onClick={nextMonth} className={`p-2 ${hoverBg} rounded-lg transition`}>→</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(d => <div key={d} className={`text-center text-[10px] ${mutedText} font-medium py-1`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;
            const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
            const dayEntries = entryMap.get(String(day)) || [];
            return (
              <div key={day} className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-start text-xs transition ${isToday ? 'bg-amber-500/20 border border-amber-500/40' : dayEntries.length > 0 ? `${cellBg} border ${cellBorder}` : hoverBg}`}>
                <span className={`font-medium ${isToday ? 'text-amber-400' : subtleText}`}>{day}</span>
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {dayEntries.slice(0, 3).map((e, j) => (
                    <span key={j} className={`w-1.5 h-1.5 rounded-full ${typeDot[e.type] || 'bg-zinc-500'}`} title={`${e.type}: ${e.title}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className={`flex gap-4 mt-4 pt-4 border-t ${cardBorder} text-[10px] ${mutedText}`}>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Idea</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Tarea</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Nota</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Insight</span>
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab({ entries, selectedEntry, onSelectEntry, onStatusChange, theme }: { entries: Entry[]; selectedEntry: Entry | null; onSelectEntry: (e: Entry | null) => void; onStatusChange: (id: number, status: Entry['status']) => void; theme: string }) {
  const [view, setView] = useState<'outline' | 'kanban' | 'linked' | 'graph'>('outline');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100';
  const inputBorder = theme === 'dark' ? 'border-zinc-700' : 'border-gray-300';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';
  const subtleText = theme === 'dark' ? 'text-zinc-400' : 'text-gray-600';
  const hoverBg = theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-gray-100';

  const typeColors: Record<string, string> = { idea: 'text-amber-400', task: 'text-emerald-400', note: 'text-blue-400', insight: 'text-purple-400' };
  const typeIcons: Record<string, string> = { idea: '💡', task: '✅', note: '📝', insight: '🧠' };

  const toggleProject = (project: string) => {
    const next = new Set(expandedProjects);
    next.has(project) ? next.delete(project) : next.add(project);
    setExpandedProjects(next);
  };

  const projects = [...new Set(entries.map(e => e.project || '(sin proyecto)'))].sort();
  const grouped = new Map<string, Entry[]>();
  for (const p of projects) {
    grouped.set(p, entries.filter(e => (e.project || '(sin proyecto)') === p));
  }

  const entryMap = new Map<number, Entry>();
  for (const e of entries) entryMap.set(e.id, e);

  const backlinks = new Map<number, Entry[]>();
  for (const e of entries) {
    for (const rid of e.related_ids || []) {
      if (!backlinks.has(rid)) backlinks.set(rid, []);
      backlinks.get(rid)!.push(e);
    }
  }

  const views = [
    { id: 'outline' as const, icon: ChevronRight, label: 'Outline' },
    { id: 'kanban' as const, icon: Columns, label: 'Kanban' },
    { id: 'linked' as const, icon: Link2, label: 'Enlazadas' },
    { id: 'graph' as const, icon: MapIcon, label: 'Graph' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {views.map(v => (
            <button key={v.id} onClick={() => { setView(v.id); onSelectEntry(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition ${view === v.id ? 'bg-amber-500/20 text-amber-400' : `${subtleText} ${hoverBg}`}`}>
              <v.icon size={14} />{v.label}
            </button>
          ))}
        </div>
        <span className={`text-xs ${mutedText}`}>{entries.length} entries</span>
      </div>

      {view === 'outline' && (
        <div className="space-y-2">
          {projects.map(project => {
            const isExpanded = expandedProjects.has(project);
            const projectEntries = grouped.get(project)!;
            const byType = new Map<string, Entry[]>();
            for (const e of projectEntries) {
              if (!byType.has(e.type)) byType.set(e.type, []);
              byType.get(e.type)!.push(e);
            }
            return (
              <div key={project} className={`${cardBg} border ${cardBorder} rounded-lg overflow-hidden`}>
                <button onClick={() => toggleProject(project)}
                  className={`w-full flex items-center gap-2 px-4 py-3 text-left ${hoverBg} transition`}>
                  {isExpanded ? <ChevronDown size={14} className={subtleText} /> : <ChevronRight size={14} className={subtleText} />}
                  <Folder size={14} className="text-amber-400" />
                  <span className="text-sm font-medium flex-1">{project}</span>
                  <span className={`text-xs ${mutedText}`}>{projectEntries.length}</span>
                </button>
                {isExpanded && (
                  <div className={`border-t ${cardBorder}`}>
                    {[...byType.entries()].map(([type, typeEntries]) => (
                      <div key={type} className={`border-t ${cardBorder}`}>
                        <div className={`px-8 py-2 text-xs font-medium ${typeColors[type]} ${inputBg}`}>
                          {typeIcons[type]} {type} ({typeEntries.length})
                        </div>
                        {typeEntries.map(e => (
                          <div key={e.id} className={`px-8 py-2 border-t ${cardBorder} ${hoverBg} cursor-pointer flex items-center gap-2`}
                            onClick={() => onSelectEntry(selectedEntry?.id === e.id ? null : e)}>
                            <span className={`text-xs ${e.status === 'completed' ? 'line-through text-zinc-500' : subtleText} flex-1 truncate`}>{e.title}</span>
                            {e.due_date && <span className="text-[10px] text-amber-500/70">{e.due_date}</span>}
                            {e.priority > 0 && <span className={`text-[10px] font-bold px-1 rounded ${e.priority >= 3 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>P{e.priority}</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {entries.length === 0 && (
            <div className={`text-center py-12 ${mutedText}`}>
              <BookOpen size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No hay entradas aún.</p>
            </div>
          )}
        </div>
      )}

      {view === 'kanban' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { status: 'active' as const, label: 'To Do', color: 'border-amber-500/30' },
            { status: 'completed' as const, label: 'Done', color: 'border-emerald-500/30' },
            { status: 'archived' as const, label: 'Archive', color: `border-zinc-700` },
          ].map(col => {
            const colEntries = entries.filter(e => e.status === col.status);
            return (
              <div key={col.status} className={`${cardBg} border ${col.color} rounded-lg p-3`}>
                <div className={`text-xs font-medium ${subtleText} mb-3 flex items-center justify-between`}>
                  <span>{col.label}</span>
                  <span className={`text-[10px] ${mutedText}`}>{colEntries.length}</span>
                </div>
                <div className="space-y-2">
                  {colEntries.map(e => (
                    <div key={e.id} className={`${inputBg} border ${inputBorder} rounded-lg p-3 cursor-grab active:cursor-grabbing`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs">{typeIcons[e.type]}</span>
                        <span className={`text-[10px] font-medium ${typeColors[e.type]}`}>{e.type}</span>
                        {e.project && <span className={`text-[10px] ${mutedText} truncate`}>{e.project}</span>}
                      </div>
                      <p className={`text-xs font-medium ${e.status === 'completed' ? 'line-through text-zinc-500' : subtleText} line-clamp-2`}>{e.title}</p>
                      {e.due_date && <p className="text-[10px] text-amber-500/70 mt-1">📅 {e.due_date}</p>}
                      <div className="flex gap-1 mt-2">
                        {col.status === 'active' && (
                          <button onClick={() => onStatusChange(e.id, 'completed')} className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 hover:bg-emerald-500/30 transition">Done</button>
                        )}
                        {col.status !== 'active' && (
                          <button onClick={() => onStatusChange(e.id, 'active')} className={`text-[10px] ${inputBg} ${subtleText} px-2 py-0.5 rounded border ${inputBorder} hover:border-zinc-600 transition`}>To Do</button>
                        )}
                        {col.status !== 'archived' && (
                          <button onClick={() => onStatusChange(e.id, 'archived')} className={`text-[10px] ${mutedText} px-2 py-0.5 rounded hover:text-zinc-300 transition`}>Archive</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {colEntries.length === 0 && (
                    <div className={`text-center py-6 text-[10px] ${mutedText}`}>Vacío</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'linked' && (
        <div className="space-y-3">
          {entries.filter(e => (e.related_ids?.length || 0) > 0 || (backlinks.get(e.id)?.length || 0) > 0).length === 0 ? (
            <div className={`text-center py-12 ${mutedText}`}>
              <Link2 size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No hay conexiones aún. Añade entradas con tags o proyectos compartidos.</p>
            </div>
          ) : (
            entries.filter(e => (e.related_ids?.length || 0) > 0 || (backlinks.get(e.id)?.length || 0) > 0).map(e => {
              const outgoing = (e.related_ids || []).map(id => entryMap.get(id)).filter(Boolean) as Entry[];
              const incoming = backlinks.get(e.id) || [];
              return (
                <div key={e.id} className={`${cardBg} border ${cardBorder} rounded-lg p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{typeIcons[e.type]}</span>
                    <span className={`text-sm font-semibold ${e.status === 'completed' ? 'line-through text-zinc-500' : subtleText}`}>{e.title}</span>
                    {e.project && <span className={`text-[10px] ${inputBg} ${mutedText} px-1.5 py-0.5 rounded font-mono`}>{e.project}</span>}
                  </div>
                  {outgoing.length > 0 && (
                    <div className="space-y-1">
                      <span className={`text-[10px] ${mutedText} font-medium`}>Conecta con:</span>
                      {outgoing.map(o => (
                        <div key={o.id} className={`flex items-center gap-1 ml-4 text-xs ${subtleText} ${hoverBg} rounded px-2 py-1 cursor-pointer`}
                          onClick={() => onSelectEntry(selectedEntry?.id === o.id ? null : o)}>
                          <MoveRight size={12} className="text-amber-400" />
                          <span>{typeIcons[o.type]}</span>
                          <span className="truncate">{o.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {incoming.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <span className={`text-[10px] ${mutedText} font-medium`}>Enlazado por:</span>
                      {incoming.map(i => (
                        <div key={i.id} className={`flex items-center gap-1 ml-4 text-xs ${subtleText} ${hoverBg} rounded px-2 py-1 cursor-pointer`}
                          onClick={() => onSelectEntry(selectedEntry?.id === i.id ? null : i)}>
                          <MoveRight size={12} className="text-blue-400 rotate-180" />
                          <span>{typeIcons[i.type]}</span>
                          <span className="truncate">{i.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {view === 'graph' && (
        <div className={`${cardBg} border ${cardBorder} rounded-xl p-4`}>
          {(() => {
            const allIds = new Set<number>();
            for (const e of entries) {
              if (e.related_ids?.length) {
                allIds.add(e.id);
                for (const rid of e.related_ids) allIds.add(rid);
              }
            }
            const connected = entries.filter(e => allIds.has(e.id));
            const relatedMap = new Map<number, number[]>();
            for (const e of entries) {
              if (e.related_ids?.length) relatedMap.set(e.id, e.related_ids);
            }
            if (connected.length === 0) {
              return (
                <div className={`text-center py-12 ${mutedText}`}>
                  <MapIcon size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Sin conexiones para visualizar.</p>
                </div>
              );
            }
            const positions: Record<number, { x: number; y: number }> = {};
            const centerX = 400, centerY = 250;
            const connCount = new Map<number, number>();
            for (const e of connected) {
              const count = (relatedMap.get(e.id)?.length || 0);
              connCount.set(e.id, count);
              for (const rid of (relatedMap.get(e.id) || [])) {
                connCount.set(rid, (connCount.get(rid) || 0) + 1);
              }
            }
            const sorted = [...connected].sort((a, b) => (connCount.get(b.id) || 0) - (connCount.get(a.id) || 0));
            sorted.forEach((e, i) => {
              const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 100 + (connCount.get(e.id) || 0) * 25;
              positions[e.id] = { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
            });
            const edges: { from: number; to: number }[] = [];
            for (const e of connected) {
              for (const rid of (relatedMap.get(e.id) || [])) {
                if (positions[rid]) edges.push({ from: e.id, to: rid });
              }
            }
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs ${mutedText}`}>{connected.length} nodes · {edges.length} connections</span>
                  <div className="flex gap-3 text-[10px]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> idea</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> task</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> note</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> insight</span>
                  </div>
                </div>
                <svg viewBox="0 0 800 500" className="w-full h-[400px] bg-zinc-950 rounded-lg">
                  {edges.map(edge => (
                    <line key={`${edge.from}-${edge.to}`}
                      x1={positions[edge.from].x} y1={positions[edge.from].y}
                      x2={positions[edge.to].x} y2={positions[edge.to].y}
                      stroke="#3f3f46" strokeWidth="1.5" />
                  ))}
                  {connected.map(e => {
                    const pos = positions[e.id];
                    if (!pos) return null;
                    const color = e.type === 'idea' ? '#f59e0b' : e.type === 'task' ? '#10b981' : e.type === 'note' ? '#3b82f6' : '#8b5cf6';
                    const r = 14 + (connCount.get(e.id) || 0) * 2;
                    return (
                      <g key={e.id} className="cursor-pointer" onClick={() => onSelectEntry(selectedEntry?.id === e.id ? null : e)}>
                        <circle cx={pos.x} cy={pos.y} r={r} fill={color} opacity="0.15" />
                        <circle cx={pos.x} cy={pos.y} r={r - 2} fill="#18181b" stroke={color} strokeWidth="2" />
                        <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#e4e4e7" fontSize="9">
                          {e.title.length > 14 ? e.title.slice(0, 14) + '…' : e.title}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </>
            );
          })()}
        </div>
      )}

    </div>
  );
}

function EntryCommentsPanel({ entry, lang, theme, authEmail, onClose }: { entry: Entry; lang: Lang; theme: string; authEmail: string; onClose: () => void }) {
  const tr = t[lang];
  const [comments, setComments] = useState<EntryComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200';
  const subtleText = theme === 'dark' ? 'text-zinc-300' : 'text-gray-700';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';

  const loadComments = () => {
    fetch(`/api/entries/${entry.id}/comments`).then(r => r.json()).then(setComments).catch(() => {});
  };

  useEffect(loadComments, [entry.id]);

  const handleSubmit = async () => {
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ content: newComment.trim() })
      });
      if (res.ok) { setNewComment(''); loadComments(); }
    } finally { setSending(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      if (res.ok) loadComments();
    } catch {}
  };

  const typeIcons: Record<string, string> = { idea: '💡', task: '✅', note: '📝', insight: '🧠' };

  return (
    <div className={`${cardBg} border ${cardBorder} rounded-lg p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeIcons[entry.type] || '📌'}</span>
          <span className={`text-sm font-semibold ${subtleText}`}>{entry.title}</span>
        </div>
        <button onClick={onClose} className={`text-xs ${mutedText} hover:text-zinc-300 transition`}>✕</button>
      </div>
      {entry.content && <p className={`text-xs ${mutedText} mb-3`}>{entry.content}</p>}
      {entry.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-3">
          {entry.tags.map((tag, i) => <span key={i} className={`text-[10px] ${inputBg} ${subtleText} px-1.5 py-0.5 rounded`}>#{tag}</span>)}
        </div>
      )}

      <div className={`border-t ${cardBorder} pt-3 mt-2`}>
        <h4 className={`text-xs font-semibold ${subtleText} mb-2 uppercase tracking-wider`}>{tr.comments.title}</h4>

        {comments.length === 0 && <p className={`text-[11px] ${mutedText} italic mb-2`}>{tr.comments.empty}</p>}

        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className={`text-[11px] ${inputBg} rounded p-2`}>
              <div className={subtleText}>{c.content}</div>
              <div className="flex justify-between items-center mt-1">
                <span className={`text-[9px] ${mutedText}`}>{new Date(c.created_at).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US')}</span>
                <button onClick={() => handleDelete(c.id)} className={`text-[9px] text-red-400 hover:text-red-300 transition`}>{tr.auth.delete || '✕'}</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder={tr.comments.placeholder}
            className={`flex-1 text-xs ${inputBg} ${subtleText} px-2 py-1.5 rounded border-0 outline-none`}
          />
          <button onClick={handleSubmit} disabled={sending || !newComment.trim()}
            className={`text-xs px-3 py-1.5 rounded font-medium transition ${sending || !newComment.trim() ? `${inputBg} ${mutedText}` : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'}`}>
            {tr.comments.submit}
          </button>
        </div>
      </div>
    </div>
  );
}

function PomodoroTab({ stats, timeLeft, setTimeLeft, isRunning, setIsRunning, duration, setDuration, lang, theme }: {
  stats: any;
  timeLeft: number; setTimeLeft: (n: number) => void;
  isRunning: boolean; setIsRunning: (b: boolean) => void;
  duration: number; setDuration: (n: number) => void;
  lang: Lang;
  theme: string;
}) {
  const tr = t[lang];
  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => { setIsRunning(false); setTimeLeft(duration * 60); };
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-zinc-800' : 'bg-gray-200';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2"><h2 className="text-2xl font-bold">{tr.pomodoro.title}</h2><p className={mutedText}>{tr.pomodoro.subtitle} {duration} {tr.pomodoro.deepWork}</p></div>
      <div className={`${cardBg} border ${cardBorder} rounded-xl p-8 text-center space-y-6`}>
        <div className="text-7xl font-mono font-bold tracking-wider"><span className={timeLeft < 60 ? 'text-red-400' : 'text-amber-400'}>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span></div>
        <div className="flex justify-center gap-2">
          {[15, 25, 45, 60].map(d => (
            <button key={d} onClick={() => { setDuration(d); setTimeLeft(d * 60); setIsRunning(false); }}
              className={`px-3 py-1 rounded text-xs font-medium transition ${duration === d ? 'bg-amber-500/20 text-amber-400' : `${inputBg} ${mutedText}`}`}>{d}m</button>
          ))}
        </div>
        <div className="flex justify-center gap-3">
          <button onClick={toggleTimer} className={`px-8 py-3 rounded-lg font-bold text-sm transition ${isRunning ? `${inputBg} ${mutedText}` : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'}`}>{isRunning ? tr.pomodoro.pause : tr.pomodoro.start}</button>
          <button onClick={resetTimer} className={`px-4 py-3 rounded-lg ${inputBg} ${mutedText} text-sm hover:bg-zinc-700 transition`}>{tr.pomodoro.reset}</button>
        </div>
      </div>
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className={`${cardBg} border ${cardBorder} rounded-lg p-4 text-center`}><div className="text-2xl font-bold text-amber-400">{stats.completed?.count || 0}</div><div className={`text-xs ${mutedText} mt-1`}>{tr.pomodoro.completed}</div></div>
          <div className={`${cardBg} border ${cardBorder} rounded-lg p-4 text-center`}><div className="text-2xl font-bold text-emerald-400">{stats.totalMinutes?.total || 0}m</div><div className={`text-xs ${mutedText} mt-1`}>{tr.pomodoro.focusTime}</div></div>
          <div className={`${cardBg} border ${cardBorder} rounded-lg p-4 text-center`}><div className="text-2xl font-bold text-blue-400">{stats.today?.count || 0}</div><div className={`text-xs ${mutedText} mt-1`}>{tr.pomodoro.today}</div></div>
          <div className={`${cardBg} border ${cardBorder} rounded-lg p-4 text-center`}><div className="text-2xl font-bold text-purple-400">{stats.total?.count || 0}</div><div className={`text-xs ${mutedText} mt-1`}>{tr.pomodoro.total}</div></div>
        </div>
      )}
    </div>
  );
}

function KnowledgeTab({ lang, theme, aiUsage }: { lang: Lang; theme: string; aiUsage: any }) {
  const tr = t[lang];
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState('');
  const [error, setError] = useState('');

  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';

  const limits: Record<string, number> = { connect: 5, mindmap: 3, summarize: 3, tags: 10 };
  const used: Record<string, number> = {};
  if (aiUsage && Array.isArray(aiUsage.usage)) {
    for (const u of aiUsage.usage) used[u.endpoint] = Number(u.total) || 0;
  }
  const isUnlimited = aiUsage?.usage === 'unlimited' || aiUsage?.plan === 'pro';

  const generateSummary = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ project: project || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSummary(''); }
      else setSummary(data.summary || 'No analysis available.');
    } catch { setError('Failed to generate analysis'); setSummary(''); }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2"><h2 className="text-2xl font-bold">{tr.knowledge.title}</h2><p className={mutedText}>{tr.knowledge.subtitle}</p></div>

      {!isUnlimited && (
        <div className={`${cardBg} border ${cardBorder} rounded-xl p-4 space-y-3`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400 flex items-center gap-1"><Sparkles size={14} /> AI Usage (Free)</span>
            <span className={`text-[10px] ${mutedText}`}>{Object.values(used).reduce((a, b) => a + b, 0)} used today</span>
          </div>
          {Object.entries(limits).map(([ep, lim]) => {
            const u = used[ep] || 0;
            const pct = Math.min(100, Math.round((u / lim) * 100));
            return (
              <div key={ep}>
                <div className="flex justify-between text-[10px] mb-1"><span className={mutedText}>{ep}</span><span className={pct >= 100 ? 'text-red-400' : mutedText}>{u}/{lim}</span></div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-3">
        <input type="text" value={project} onChange={e => setProject(e.target.value)} placeholder={tr.knowledge.project} className={`flex-1 ${cardBg} border ${cardBorder} rounded-lg px-4 py-2 text-sm focus:outline-none`} />
        <button onClick={generateSummary} disabled={loading} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-zinc-950 font-bold px-4 py-2 rounded-lg text-sm transition">{loading ? tr.knowledge.analyzing : tr.knowledge.analyze}</button>
      </div>
      {error && <div className="text-center text-sm text-red-400 flex items-center justify-center gap-2"><Lock size={14} />{error}</div>}
      {summary && (
        <div className={`${cardBg} border ${cardBorder} rounded-xl p-6`}>
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className={`whitespace-pre-wrap text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'} font-sans leading-relaxed`}>{summary}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function AboutTab({ lang, theme }: { lang: Lang; theme: string }) {
  const tr = t[lang];
  const cardBg = theme === 'dark' ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = theme === 'dark' ? 'border-zinc-800' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-zinc-950' : 'bg-gray-100';
  const mutedText = theme === 'dark' ? 'text-zinc-500' : 'text-gray-500';
  const subtleText = theme === 'dark' ? 'text-zinc-400' : 'text-gray-600';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2"><h2 className="text-2xl font-bold">{tr.about.title}</h2><p className={mutedText}>{tr.about.subtitle}</p></div>

      <div className="bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-amber-500/20 rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-semibold text-amber-400">{tr.about.pwaTitle}</h3>
        <p className={`text-sm ${theme === 'dark' ? 'text-zinc-300' : 'text-gray-700'} leading-relaxed`}>{tr.about.pwaDesc}</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className={`${inputBg}/50 rounded-lg p-3 text-center`}><Smartphone size={20} className="text-amber-400 mx-auto mb-1" /><p className={`text-[10px] ${subtleText}`}>{tr.about.installClick}</p></div>
          <div className={`${inputBg}/50 rounded-lg p-3 text-center`}><Download size={20} className="text-emerald-400 mx-auto mb-1" /><p className={`text-[10px] ${subtleText}`}>{tr.about.offline}</p></div>
          <div className={`${inputBg}/50 rounded-lg p-3 text-center`}><Zap size={20} className="text-blue-400 mx-auto mb-1" /><p className={`text-[10px] ${subtleText}`}>{tr.about.noStore}</p></div>
        </div>
      </div>

      <div className={`${cardBg} border ${cardBorder} rounded-xl p-6 space-y-3`}>
        <h3 className="text-lg font-semibold text-amber-400">{tr.about.aboutProject}</h3>
        <p className={`text-sm ${subtleText} leading-relaxed`}>{tr.about.aboutDesc}</p>
      </div>

      <div className={`${cardBg} border ${cardBorder} rounded-xl p-6 space-y-4`}>
        <h3 className="text-lg font-semibold text-emerald-400">{tr.about.methodology}</h3>
        {[
          { step: '01', title: lang === 'es' ? 'Captura' : 'Capture', desc: lang === 'es' ? 'Aparece una idea? 3 segundos para anotarla.' : 'Got an idea? 3 seconds to write it down.' },
          { step: '02', title: lang === 'es' ? 'Organiza' : 'Organize', desc: lang === 'es' ? 'Tipos: idea, tarea, nota, insight. Proyectos y tags.' : 'Types: idea, task, note, insight. Projects and tags.' },
          { step: '03', title: lang === 'es' ? 'Conecta' : 'Connect', desc: lang === 'es' ? 'Notas enlazadas, backlinks automáticos y graph view.' : 'Linked notes, automatic backlinks and graph view.' },
          { step: '04', title: lang === 'es' ? 'Organiza' : 'Organize', desc: lang === 'es' ? 'Outline jerárquico + Kanban para ejecutar ideas.' : 'Hierarchical outline + Kanban to execute ideas.' },
          { step: '05', title: lang === 'es' ? 'Ejecuta' : 'Execute', desc: lang === 'es' ? 'Pomodoro integrado para convertir ideas en acción.' : 'Integrated Pomodoro to turn ideas into action.' },
        ].map(item => (
          <div key={item.step} className="flex gap-3">
            <span className="text-amber-400 font-mono font-bold shrink-0">{item.step}/</span>
            <div><strong className={theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'} text-sm block>{item.title}</strong><span className={`text-xs ${mutedText}`}>{item.desc}</span></div>
          </div>
        ))}
      </div>

      <div className={`${cardBg} border ${cardBorder} rounded-xl p-6 space-y-3`}>
        <h3 className="text-lg font-semibold text-blue-400">{tr.about.howTo}</h3>
        <pre className={`${inputBg} p-3 rounded text-xs font-mono ${subtleText} whitespace-pre-wrap`}>git clone https://github.com/mcasrom/todo-osint.git
cd todo-osint
npm install
cp .env.example .env
npm run dev</pre>
        <p className={`text-xs ${subtleText} mt-2`}>{lang === 'es' ? 'Funciona 100% sin IA. Opcional: añade GEMINI_API_KEY para análisis con IA.' : 'Works 100% without AI. Optional: add GEMINI_API_KEY for AI analysis.'}</p>
      </div>

      <div className={`${cardBg} border ${cardBorder} rounded-xl p-6 space-y-4`}>
        <h3 className="text-lg font-semibold text-purple-400">{tr.about.faq}</h3>
        {tr.faqs.map((faq, i) => (
          <div key={i} className="space-y-1"><p className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'}`}>{faq.q}</p><p className={`text-xs ${mutedText}`}>{faq.a}</p></div>
        ))}
      </div>

      <div className={`${cardBg} border ${cardBorder} rounded-xl p-6 space-y-4`}>
        <h3 className="text-lg font-semibold text-amber-400">{tr.about.monetization}</h3>
        <p className={`text-xs ${subtleText}`}>{lang === 'es' ? 'SaaS freemium con PWA como ventaja competitiva: sin comisiones de app store, distribución directa, instalación instantánea.' : 'Freemium SaaS with PWA as competitive advantage: no app store fees, direct distribution, instant install.'}</p>
        <div className="grid grid-cols-3 gap-3">
          <div className={`${inputBg} border ${cardBorder} rounded-lg p-4`}><div className={`text-sm font-bold ${theme === 'dark' ? 'text-zinc-200' : 'text-gray-800'}`}>{tr.about.free}</div><div className={`text-[10px] ${mutedText} mt-1`}>{tr.about.entriesUnlimited}</div><div className={`text-lg font-bold ${mutedText} mt-2`}>€0</div></div>
          <div className={`${inputBg} border border-amber-500/30 rounded-lg p-4`}><div className="text-sm font-bold text-amber-400">{tr.about.pro}</div><div className={`text-[10px] ${mutedText} mt-1`}>{tr.about.aiUnlimited}</div><div className="text-lg font-bold text-amber-400 mt-2">€5/mo</div></div>
          <div className={`${inputBg} border border-purple-500/30 rounded-lg p-4`}><div className="text-sm font-bold text-purple-400">{tr.about.team}</div><div className={`text-[10px] ${mutedText} mt-1`}>{tr.about.workspace}</div><div className="text-lg font-bold text-purple-400 mt-2">€15/mo</div></div>
        </div>
      </div>

      <div className={`text-center text-xs ${mutedText} pt-4`}>
        <a href="mailto:todo-osint@viajeinteligencia.com" className="hover:text-zinc-400 transition">todo-osint@viajeinteligencia.com</a> • <a href="https://github.com/mcasrom" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition">github.com/mcasrom</a>
      </div>
    </div>
  );
}
