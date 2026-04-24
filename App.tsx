
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Settings as SettingsIcon, 
  Send, 
  Bell, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Trash2,
  Filter,
  Newspaper,
  Clock,
  Zap,
  Calendar,
  Activity,
  BookOpen,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  History,
  Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { NewsItem, AppSettings, TOPICS_LIST, ScheduleSettings, Topic } from './types';
import { fetchFiscalNews, sendToGoogleChat } from './services/geminiService';

const DEFAULT_SCHEDULE: ScheduleSettings = {
  enabled: false,
  startTime: "09:00",
  timesPerDay: 1,
  daysOfWeek: [1, 2, 3, 4, 5], // Lunes a Viernes por defecto
  lastRun: null
};

const DAYS_NAME = [
  { label: 'D', value: 0 },
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'M', value: 3 },
  { label: 'J', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
];

const getFriendlyDomainName = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    let clean = hostname
      .replace('www.', '')
      .replace(/\.(com|org|mx|gob|edu|net)$/g, '')
      .replace(/\.(com|org|mx|gob|edu|net)$/g, ''); 
    clean = clean.replace(/\./g, ' ');
    return clean.split(' ').map(word => {
      if (word.length <= 4) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  } catch {
    return "Fuente Externa";
  }
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedWebhook = localStorage.getItem('google_chat_webhook') || '';
    const savedTopics = JSON.parse(localStorage.getItem('selected_topics') || '["DOF", "SAT CFDI", "IMSS IDSE", "Infonavit"]');
    const savedSchedule = JSON.parse(localStorage.getItem('schedule_settings') || JSON.stringify(DEFAULT_SCHEDULE));
    const savedLastReport = localStorage.getItem('last_report_text') || '';
    return {
      googleChatWebhook: savedWebhook,
      selectedTopics: savedTopics,
      schedule: savedSchedule,
      lastReportText: savedLastReport
    };
  });

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [nextExecution, setNextExecution] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<string>("Esperando configuración...");
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [history, setHistory] = useState<NewsItem[]>(() => {
    return JSON.parse(localStorage.getItem('reports_history') || '[]');
  });

  useEffect(() => {
    localStorage.setItem('reports_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('google_chat_webhook', settings.googleChatWebhook);
    localStorage.setItem('selected_topics', JSON.stringify(settings.selectedTopics));
    localStorage.setItem('schedule_settings', JSON.stringify(settings.schedule));
    localStorage.setItem('last_report_text', settings.lastReportText);
  }, [settings]);

  const runAutomationTask = useCallback(async (isAuto = false) => {
    if (settings.selectedTopics.length === 0) {
      if (!isAuto) setError("Por favor selecciona al menos un tema.");
      return;
    }

    setIsLoading(true);
    if (isAuto) setAutoStatus("Analizando diferencias...");
    setError(null);
    
    try {
      const news = await fetchFiscalNews(settings.selectedTopics, settings.lastReportText);
      setResults(news);
      
      if (news.length > 0) {
        const currentReportText = news[0].fullText;
        
        // Guardar en historial
        setHistory(prev => {
          const exists = prev.some(h => h.fullText === currentReportText);
          if (exists) return prev;
          return [news[0], ...prev].slice(0, 50); // Mantener últimos 50
        });

        if (isAuto && settings.googleChatWebhook) {
          await sendToGoogleChat(settings.googleChatWebhook, news[0]);
          setSuccessMsg(`Automatización: Diferencial enviado.`);
          setTimeout(() => setSuccessMsg(null), 5000);
        }

        setSettings(prev => ({
          ...prev,
          lastReportText: currentReportText,
          schedule: { ...prev.schedule, lastRun: new Date().toISOString() }
        }));
      }

      if (isAuto) setAutoStatus("Completado. Esperando próximo ciclo.");

    } catch (err: any) {
      const msg = err.message || "Error en la automatización.";
      if (!isAuto) setError(msg);
      if (isAuto) setAutoStatus(`Error: ${msg}`);
      console.error("Auto Error:", msg);
    } finally {
      setIsLoading(false);
    }
  }, [settings.selectedTopics, settings.googleChatWebhook, settings.lastReportText]);

  useEffect(() => {
    const checkSchedule = () => {
      if (!settings.schedule.enabled) {
        setNextExecution(null);
        setAutoStatus("Programación desactivada");
        return;
      }

      const now = new Date();
      const currentDay = now.getDay();
      
      // Si el día de hoy no está en la lista de días seleccionados, buscar el próximo día válido
      if (!settings.schedule.daysOfWeek.includes(currentDay)) {
        setAutoStatus("Hoy no es día de ejecución");
        setNextExecution("Próximo día programado");
        return;
      }

      const [startH, startM] = settings.schedule.startTime.split(':').map(Number);
      const intervalHours = 24 / settings.schedule.timesPerDay;
      
      const slots: Date[] = [];
      for (let i = 0; i < settings.schedule.timesPerDay; i++) {
        const slot = new Date();
        slot.setHours(startH + Math.floor(i * intervalHours), startM + ( (i * intervalHours) % 1 * 60), 0, 0);
        slots.push(slot);
      }

      slots.sort((a, b) => a.getTime() - b.getTime());

      let targetSlot = slots.find(s => s > now);
      if (!targetSlot) {
        // Buscar el próximo día válido en la semana
        let nextDayOffset = 1;
        while (!settings.schedule.daysOfWeek.includes((currentDay + nextDayOffset) % 7)) {
          nextDayOffset++;
        }
        targetSlot = new Date(slots[0]);
        targetSlot.setDate(targetSlot.getDate() + nextDayOffset);
      }

      setNextExecution(targetSlot.toLocaleTimeString('es-MX', { 
        hour: '2-digit', 
        minute: '2-digit',
        day: targetSlot.getDate() !== now.getDate() ? '2-digit' : undefined,
        month: targetSlot.getDate() !== now.getDate() ? 'short' : undefined
      }));

      const lastRunDate = settings.schedule.lastRun ? new Date(settings.schedule.lastRun) : new Date(0);
      const pastSlots = [...slots].reverse().filter(s => s <= now);
      let mostRecentSlot: Date;
      if (pastSlots.length > 0) {
        mostRecentSlot = pastSlots[0];
      } else {
        // Caso de ayer (o último día válido previo)
        let prevDayOffset = 1;
        while (!settings.schedule.daysOfWeek.includes((currentDay - prevDayOffset + 7) % 7)) {
          prevDayOffset++;
        }
        mostRecentSlot = new Date(slots[slots.length - 1]);
        mostRecentSlot.setDate(mostRecentSlot.getDate() - prevDayOffset);
      }

      const shouldRun = mostRecentSlot > lastRunDate && !isLoading;

      if (shouldRun) {
        runAutomationTask(true);
      } else if (!isLoading) {
        setAutoStatus(`Próximo ciclo: ${targetSlot.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
      }
    };

    const interval = setInterval(checkSchedule, 30000); 
    checkSchedule(); 

    return () => clearInterval(interval);
  }, [settings.schedule, isLoading, runAutomationTask]);

  const toggleTopic = (topic: string) => {
    setSettings(prev => ({
      ...prev,
      selectedTopics: prev.selectedTopics.includes(topic)
        ? prev.selectedTopics.filter(t => t !== topic)
        : [...prev.selectedTopics, topic]
    }));
  };

  const toggleDay = (day: number) => {
    setSettings(prev => {
      const currentDays = prev.schedule.daysOfWeek;
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day].sort((a, b) => a - b);
      
      return {
        ...prev,
        schedule: { ...prev.schedule, daysOfWeek: newDays.length > 0 ? newDays : [day] }
      };
    });
  };

  const updateSchedule = (key: keyof ScheduleSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [key]: value }
    }));
  };

  const resetHistory = () => {
    if (confirm("¿Limpiar la memoria del último reporte?")) {
      setSettings(prev => ({ ...prev, lastReportText: "" }));
    }
  };

  const deleteFromHistory = (id: string) => {
    if (confirm("¿Eliminar este reporte del historial?")) {
      setHistory(prev => prev.filter(h => h.id !== id));
    }
  };

  const clearHistory = () => {
    if (confirm("¿Eliminar TODO el historial de reportes?")) {
      setHistory([]);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50/50">
      <header className="bg-white border-b sticky top-0 z-40 px-4 md:px-8 py-4 glass">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-600 p-2.5 rounded-xl shadow-lg shadow-emerald-100 transform -rotate-3">
                <Newspaper className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1">FiscalBot MX</h1>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Inteligencia Diferencial</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-6 px-6 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Tarea Automática</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Activity size={12} className={isLoading ? "text-amber-500 animate-spin" : "text-emerald-500"} /> 
                    {autoStatus}
                  </span>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Contexto</span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <History size={12} /> {settings.lastReportText ? "En Memoria" : "Limpio"}
                  </span>
                </div>
              </div>

              <button onClick={() => setShowSettings(true)} className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                <SettingsIcon size={20} />
              </button>
              
              <button onClick={() => runAutomationTask(false)} disabled={isLoading} className="bg-slate-900 hover:bg-black disabled:bg-slate-400 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-slate-200 transition-all active:scale-95">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={18} />}
                <span className="hidden sm:inline">Ejecutar Ahora</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl w-fit">
            <button 
              onClick={() => setActiveTab('current')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'current' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Zap size={14} /> Análisis Actual
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Clock size={14} /> Historial
              {history.length > 0 && <span className="bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">{history.length}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-3xl flex items-center gap-4 shadow-sm">
           <div className="bg-emerald-500 p-2.5 rounded-2xl text-white shadow-lg shadow-emerald-100">
              <ShieldAlert size={24} />
           </div>
           <div>
              <p className="text-emerald-900 font-black text-sm uppercase tracking-tight">Optimización Fiscal Activa</p>
              <p className="text-emerald-700 text-xs font-medium italic">"Se comparan cambios vs reporte previo y se ignora la UMA fuera de su periodo de actualización anual."</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-4 space-y-6">
            <section className="bg-emerald-600 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
              <div className="absolute -right-10 -bottom-10 text-white/10 group-hover:scale-110 transition-transform duration-700"><Clock size={200} /></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg"><Bell size={20} className="text-white" /></div>
                    <h2 className="text-xl font-black">Programación</h2>
                  </div>
                  <button onClick={() => updateSchedule('enabled', !settings.schedule.enabled)} className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${settings.schedule.enabled ? 'bg-white' : 'bg-emerald-800'}`}>
                    <div className={`absolute w-5 h-5 rounded-full transition-all shadow-md ${settings.schedule.enabled ? 'left-6 bg-emerald-600' : 'left-1 bg-white'}`} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-2">Días de ejecución</label>
                    <div className="flex justify-between gap-1">
                      {DAYS_NAME.map(day => (
                        <button 
                          key={day.value} 
                          onClick={() => toggleDay(day.value)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all border ${settings.schedule.daysOfWeek.includes(day.value) ? 'bg-white text-emerald-700 border-white' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-2">Hora inicio</label>
                      <input type="time" value={settings.schedule.startTime} onChange={(e) => updateSchedule('startTime', e.target.value)} className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm w-full font-bold text-white focus:ring-2 focus:ring-white outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-white/60 uppercase tracking-widest block mb-2">Reportes/día</label>
                      <select value={settings.schedule.timesPerDay} onChange={(e) => updateSchedule('timesPerDay', parseInt(e.target.value))} className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm w-full font-bold text-white focus:ring-2 focus:ring-white outline-none appearance-none">
                        <option value="1" className="text-slate-800">1 reporte</option>
                        <option value="2" className="text-slate-800">2 reportes</option>
                        <option value="4" className="text-slate-800">4 reportes</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 text-slate-800 font-black">
                  <Filter size={20} className="text-emerald-600" />
                  <h2>Temas de Interés</h2>
                </div>
                {settings.lastReportText && (
                  <button onClick={resetHistory} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Limpiar historial">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {TOPICS_LIST.map(topic => (
                  <button key={topic} onClick={() => toggleTopic(topic)} className={`px-4 py-3 rounded-xl text-xs font-black transition-all border ${settings.selectedTopics.includes(topic) ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}>{topic}</button>
                ))}
              </div>
            </section>
          </aside>

          <div className="lg:col-span-8 space-y-6">
            {activeTab === 'current' ? (
              <>
                {isLoading && results.length === 0 ? (
                  <div className="space-y-6 animate-pulse">
                    {[1, 2].map(i => (
                      <div key={i} className="bg-white p-10 rounded-[2.5rem] border border-slate-100">
                        <div className="h-4 bg-slate-100 rounded w-24 mb-6"></div>
                        <div className="h-8 bg-slate-200 rounded w-3/4 mb-4"></div>
                        <div className="h-20 bg-slate-50 rounded w-full"></div>
                      </div>
                    ))}
                  </div>
                ) : results.length > 0 ? (
                  results.map(item => (
                    <article key={item.id} className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden group transition-all duration-500">
                      <div className="p-10">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
                          <span className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-2">
                            <Layers size={12} /> {item.topic}
                          </span>
                          <span className="text-slate-400 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={14} className="text-slate-300" /> {item.date}
                          </span>
                        </div>
                        
                        <div className="prose prose-slate max-w-none text-slate-600 mb-10 prose-headings:text-slate-900 prose-headings:font-black">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.fullText}</ReactMarkdown>
                        </div>

                        {item.links.length > 0 && (
                          <div className="border-t border-slate-100 pt-10">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                              <BookOpen size={16} /> Fuentes de Verificación
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {item.links.map((link, idx) => (
                                <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-emerald-600 hover:text-white transition-all group/link">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <ExternalLink size={14} className="text-emerald-600 group-hover/link:text-white" />
                                    <span className="truncate font-bold text-sm">{link.title || getFriendlyDomainName(link.uri)}</span>
                                  </div>
                                  <ArrowUpRight size={16} className="shrink-0 opacity-40 group-hover/link:opacity-100" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-slate-50/50 px-10 py-6 flex flex-wrap justify-between items-center gap-4 border-t border-slate-100">
                        <button onClick={() => setResults([])} className="text-slate-400 hover:text-red-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors"><Trash2 size={16} /> Descartar</button>
                        <button onClick={() => { if (!settings.googleChatWebhook) { setShowSettings(true); setError("Configura el Webhook."); } else { sendToGoogleChat(settings.googleChatWebhook, item).then(() => setSuccessMsg("¡Reporte enviado!")).catch(() => setError("Error al enviar.")); } }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-emerald-200 transition-all active:scale-95"><Send size={16} /> Enviar a Google Chat</button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm group">
                    <div className="bg-slate-50 p-10 rounded-full mb-8 group-hover:scale-110 transition-transform"><Search className="text-slate-200" size={80} /></div>
                    <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Reporte de Diferencias</h2>
                    <p className="text-slate-400 max-w-sm mb-10 leading-relaxed font-medium">Pulsa el botón superior para realizar un análisis comparativo con lo último que reportaste.</p>
                    <button onClick={() => runAutomationTask(false)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:bg-black transition-all">Ejecutar Análisis</button>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-4">
                  <h3 className="text-lg font-black text-slate-800 tracking-tight">Reportes Anteriores</h3>
                  {history.length > 0 && (
                    <button onClick={clearHistory} className="text-xs font-black text-red-500 hover:text-red-600 uppercase tracking-widest flex items-center gap-2">
                      <Trash2 size={14} /> Limpiar Historial
                    </button>
                  )}
                </div>

                {history.length > 0 ? (
                  history.map(item => (
                    <article key={item.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden group transition-all">
                      <div className="p-8">
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                          <div className="flex items-center gap-3">
                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200">
                              {item.topic}
                            </span>
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                              <Calendar size={12} /> {item.date}
                            </span>
                          </div>
                          <button onClick={() => deleteFromHistory(item.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        
                        <div className="prose prose-slate prose-sm max-w-none text-slate-600 mb-6 line-clamp-3 overflow-hidden relative">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.fullText}</ReactMarkdown>
                          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent"></div>
                        </div>

                        <div className="flex justify-between items-center">
                          <button 
                            onClick={() => {
                              setResults([item]);
                              setActiveTab('current');
                            }}
                            className="text-emerald-600 hover:text-emerald-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                          >
                            <BookOpen size={14} /> Ver Reporte Completo
                          </button>
                          
                          <button 
                            onClick={() => { 
                              if (!settings.googleChatWebhook) { 
                                setShowSettings(true); 
                                setError("Configura el Webhook."); 
                              } else { 
                                sendToGoogleChat(settings.googleChatWebhook, item)
                                  .then(() => setSuccessMsg("¡Reporte reenviado!"))
                                  .catch(() => setError("Error al enviar.")); 
                              } 
                            }} 
                            className="text-slate-400 hover:text-emerald-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
                          >
                            <Send size={14} /> Reenviar a Chat
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="bg-slate-50 p-8 rounded-full mb-6"><Clock className="text-slate-200" size={60} /></div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Historial Vacío</h2>
                    <p className="text-slate-400 max-w-xs leading-relaxed font-medium text-sm">Aún no se han guardado reportes anteriores. Los reportes nuevos aparecerán aquí automáticamente.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {successMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="text-emerald-500" size={18} /> {successMsg}
        </div>
      )}

      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <AlertCircle size={18} /> {error}
          <button onClick={() => setError(null)} className="ml-4 opacity-50 hover:opacity-100">&times;</button>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-lg">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-12 border-b border-slate-50">
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Ajustes</h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-300 hover:text-slate-900 text-4xl">&times;</button>
              </div>
              <div className="space-y-10">
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-4 uppercase tracking-widest">Webhook de Google Chat</label>
                  <input type="text" value={settings.googleChatWebhook} onChange={(e) => setSettings(prev => ({ ...prev, googleChatWebhook: e.target.value }))} placeholder="https://chat.googleapis.com/v1/spaces/..." className="w-full px-6 py-5 rounded-[1.5rem] border-2 border-slate-100 focus:border-emerald-500 outline-none transition-all font-mono text-xs" />
                </div>
              </div>
            </div>
            <div className="p-12 bg-slate-50 flex justify-end">
              <button onClick={() => setShowSettings(false)} className="bg-slate-900 text-white px-12 py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-xs">Guardar Configuración</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
