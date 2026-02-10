
# 🛠️ Especificaciones Técnicas de FiscalBot MX

Este documento detalla el funcionamiento interno, la lógica de búsqueda y el procesamiento de datos del sistema FiscalBot MX.

## 1. Arquitectura del Sistema
FiscalBot es una **Single Page Application (SPA)** construida con:
- **Frontend:** React 19 + Tailwind CSS.
- **Motor de IA:** Google Gemini API (`@google/genai`).
- **Persistencia:** LocalStorage para configuraciones y estado de última ejecución.
- **Entorno:** 100% Client-side (Browser-based).

## 2. Mecanismo de Búsqueda y "Grounding"
La búsqueda de información no se basa en el conocimiento pre-entrenado de la IA, sino en datos en tiempo real.

### Implementación:
Se utiliza el modelo `gemini-3-flash-preview` configurado con la herramienta `googleSearch`. 
```typescript
const response = await ai.models.generateContent({
  model: 'gemini-3-flash-preview',
  config: {
    tools: [{ googleSearch: {} }], // Habilita la búsqueda en vivo
  },
  // ...
});
```
La IA actúa como un agente que:
1. Analiza los temas seleccionados (SAT, IMSS, etc.).
2. Genera consultas de búsqueda optimizadas.
3. Filtra resultados de dominios específicos (`.gob.mx`).
4. Extrae los `groundingChunks` para obtener las URLs originales que se muestran en el reporte.

## 3. Lógica de Priorización (Prompt Engineering)
La jerarquización de las noticias se logra mediante una técnica de **Chain-of-Thought Prompting**. El sistema instruye a la IA para que evalúe cada noticia encontrada bajo una matriz de impacto legal:

| Nivel | Criterio de Selección | Fuentes Primarias |
|-------|-----------------------|-------------------|
| **1. Crítico** | Reformas de Ley, Decretos | DOF (Diario Oficial) |
| **2. Urgente** | Prórrogas, Vencimientos | SAT, IMSS |
| **3. Relevante** | Cambios en Tasas o UMA | Comunicados Oficiales |
| **4. General** | Análisis de expertos | Sitios especializados |

Si la IA detecta una publicación en el **DOF**, el sistema de prompt le obliga a colocarla en la sección `🚨 ALERTAS DE ALTO IMPACTO` antes que cualquier otro resumen.

## 4. Algoritmo de Formateo para Google Chat
Google Chat utiliza un subconjunto de Markdown muy específico. Para evitar que el mensaje se rompa o muestre caracteres extraños, el código implementa la función `formatForGoogleChat` mediante expresiones regulares:

```typescript
const formatForGoogleChat = (text: string): string => {
  return text
    // Convierte encabezados de cualquier nivel (#, ##, ###) a negritas simples
    .replace(/^#{1,6}\s*(.*?)$/gm, '*$1*')
    
    // Transpila negritas de Markdown (**text**) a negritas de Chat (*text*)
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    
    // Normaliza viñetas e indentaciones (soporta tabs y espacios)
    .replace(/^[\t ]*[-*]\s/gm, '• ')
    
    // Limpia decoradores de código (```) que Chat no siempre renderiza bien
    .replace(/```[\w]*\n?/g, '')
    
    // Inserta líneas divisorias visuales para legibilidad
    .replace(/^[-_*]{3,}$/gm, '──────────────────');
};
```

## 5. Sistema de Automatización (Scheduler)
El programador de tareas funciona mediante un `useEffect` con un intervalo de verificación de 30 segundos.

### Lógica de Re-ejecución:
1. El sistema calcula los "slots" de tiempo basados en la `startTime` y `timesPerDay`.
2. Compara el `lastRun` almacenado en LocalStorage con el slot de tiempo actual.
3. Si el tiempo actual es mayor al slot esperado y `lastRun` es menor a ese slot, se dispara la tarea automáticamente.
4. Esto permite que si el usuario abre la aplicación tarde, el bot identifique que hay un reporte pendiente por enviar.

## 6. Manejo de Red (CORS)
Para el envío a Google Chat, se utiliza el modo `no-cors` en la petición `fetch`. Esto es necesario porque los webhooks de Google Chat no envían cabeceras de acceso permisivas para navegadores, permitiendo que el mensaje se entregue aunque el navegador no pueda leer la respuesta de confirmación.
