
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Topic, NewsItem } from "../types";

const API_KEY = process.env.API_KEY || '';

export const fetchFiscalNews = async (topics: string[], lastReportText: string = ""): Promise<NewsItem[]> => {
  if (!API_KEY) {
    throw new Error("API Key no configurada.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = 'gemini-3-flash-preview';

  const today = new Date().toLocaleDateString('es-MX', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });

  const topicsStr = topics.join(', ');
  
  const monitoringUrls = [
    "https://www.dof.gob.mx/",
    "https://www.sat.gob.mx/portal/public/tramites/complemento-de-nomina",
    "https://www.imss.gob.mx/prensa/archivo",
    "https://portalmx.infonavit.org.mx/wps/portal/infonavitmx/mx2/patrones/centro_ayuda/avisos_eventos",
    "https://www.gob.mx/stps",
    "https://www.gob.mx/conasami",
    "https://wwwnp.sat.gob.mx/minisitio/NormatividadRMFyRGCE/normatividad_rmf_rgce2026.html",
    "https://www.inegi.org.mx/app/saladeprensa/",
    "https://www.dof.gob.mx/nota_detalle.php?codigo=5781417&fecha=03/03/2026"
  ];

  const prompt = `
    Eres un analista de inteligencia fiscal de alto nivel en México, especializado en nómina y cumplimiento patronal.
    Hoy es ${today}. Tu tarea es buscar noticias y actualizaciones críticas sobre: ${topicsStr}.

    FUENTES ESPECÍFICAS A MONITOREAR:
    - DOF (Diario Oficial): Decretos, reformas, resoluciones (SAT, IMSS, STPS, INFONAVIT).
    - SAT CFDI Nómina: Cambios en complemento, guías de llenado, catálogos.
    - IMSS Prensa/IDSE: Cambios operativos, validaciones.
    - SUA: Layouts, reglas de cálculo, actualizaciones de software.
    - INFONAVIT Portal Empresas: Avisos de retención, cambios en descuentos.
    - STPS & JORNADA LABORAL: Reformas a la Ley Federal del Trabajo, cambios en jornadas (ej. Ley de 40 horas), vacaciones, subcontratación.
    - CONASAMI: Salarios mínimos.
    - SAT RMF: Reglas misceláneas 2026.
    - INEGI: Indicadores UMA/UMI.

    URLS DE REFERENCIA:
    ${monitoringUrls.join('\n')}

    CONTEXTO DE COMPARACIÓN:
    El último reporte enviado contenía esta información:
    --- INICIO REPORTE ANTERIOR ---
    ${lastReportText || "No hay reportes anteriores."}
    --- FIN REPORTE ANTERIOR ---

    INSTRUCCIONES DE DIFERENCIACIÓN:
    1. PRIORIZA LO NUEVO: Compara tus hallazgos de hoy con el reporte anterior. Solo resalta como "NOTICIA" aquello que sea una actualización, un cambio de estado o información que no estaba presente antes.
    2. IMPACTO EN NÓMINA Y OPERACIÓN: Para cada hallazgo, explica brevemente el impacto en el cálculo de nómina, costos sociales o la operación de la jornada laboral (ej. pago de horas extra, turnos).
    3. REGLA JORNADA 40 HORAS: Monitorea activamente cualquier mención en el DOF o comunicados de la STPS sobre la reducción de la jornada laboral a 40 horas.
    4. REGLA UMA: La UMA se actualiza en febrero. Si ya pasó febrero y no hay cambios legales nuevos sobre su cálculo, NO la menciones como noticia, a menos que sea el tema principal solicitado y haya algo extraordinario.
    4. EVITA REDUNDANCIA: Si la situación legal de un tema sigue siendo la misma que en el reporte anterior, redúcela a una mención breve en una sección de "Estatus sin cambios".

    ESTRUCTURA DEL REPORTE:
    - # 🆕 NOVEDADES Y CAMBIOS (Solo información detectada hoy que NO estaba en el reporte anterior)
    - # 🚨 ALERTAS CRÍTICAS (DOF, Plazos que vencen pronto)
    - ## Resumen por Tema (Incluye "Impacto en Nómina")
    - ## Acciones Recomendadas

    REGLAS DE FORMATO:
    - Usa **negritas** para fechas y cifras.
    - Si no hay NADA nuevo hoy comparado con el reporte anterior, indícalo claramente: "Sin novedades legislativas desde el último reporte".
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "No se detectaron cambios críticos para los temas seleccionados hoy.";
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let links = chunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        title: chunk.web?.title || 'Fuente oficial',
        uri: chunk.web?.uri || ''
      }));

    const urlRegex = /(https?:\/\/[^\s)\]]+)/g;
    const matches = text.match(urlRegex);
    if (matches) {
      matches.forEach(url => {
        const cleanUrl = url.replace(/[.,;]$/, '');
        if (!links.some(l => l.uri === cleanUrl)) {
          links.push({ title: 'Enlace directo', uri: cleanUrl });
        }
      });
    }

    links = links
      .filter(link => link.uri && link.uri.startsWith('http'))
      .filter((link, index, self) => 
        index === self.findIndex((t) => t.uri === link.uri)
      );
    
    return [{
      id: crypto.randomUUID(),
      topic: topics.length > 3 ? "Resumen Multitemático" : topics.join(', '),
      title: `Inteligencia Fiscal Diaria: ${today}`,
      summary: text.substring(0, 300) + "...",
      fullText: text,
      date: today,
      links: links.slice(0, 10)
    }];

  } catch (error) {
    console.error("Error fetching news:", error);
    throw error;
  }
};

/**
 * Formatea el texto específicamente para las limitaciones de Google Chat Webhooks
 */
const formatForGoogleChat = (text: string): string => {
  return text
    .replace(/^#{1,6}\s*(.*?)$/gm, '*$1*')
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/^[\t ]*[-*]\s/gm, '• ')
    .replace(/```[\w]*\n?/g, '')
    .replace(/^[-_*]{3,}$/gm, '──────────────────')
    .replace(/\n{3,}/g, '\n\n');
};

export const sendToGoogleChat = async (webhookUrl: string, newsItem: NewsItem) => {
  if (!webhookUrl) throw new Error("Webhook URL no configurada.");

  const formattedBody = formatForGoogleChat(newsItem.fullText);
  
  let linksSection = "";
  if (newsItem.links.length > 0) {
    linksSection = `\n\n──────────────────\n*📖 FUENTES OFICIALES:*\n\n`;
    linksSection += newsItem.links
      .map(l => `• *${l.title.trim()}*\n${l.uri}`)
      .join('\n\n');
  }

  const message = {
    text: `🔔 *${newsItem.title.toUpperCase()}*\n\n${formattedBody}${linksSection}\n\n_Diferencial aplicado • FiscalBot MX_`
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });

  return { success: true };
};
