
# 🏛️ FiscalBot MX - Automatización de Inteligencia Fiscal

FiscalBot MX es una herramienta avanzada de monitoreo y síntesis de noticias fiscales y laborales diseñada para contadores, despachos legales y departamentos de RH en México. Utiliza inteligencia artificial de última generación para transformar la saturación de información en reportes accionables con un enfoque crítico en el **impacto en nómina**.

## 🚀 ¿Cómo funciona?

El bot opera bajo un flujo de tres etapas: **Búsqueda**, **Priorización** y **Distribución**.

### 1. Búsqueda con "Grounding" (Google Search)
A diferencia de un chat tradicional que tiene información estática, FiscalBot utiliza el modelo `gemini-3-flash-preview` con la herramienta `googleSearch` habilitada. Esto permite realizar consultas en tiempo real sobre la web y fuentes oficiales.

### 2. Fuentes de Monitoreo Crítico
El sistema está configurado para vigilar específicamente:
*   **DOF (Diario Oficial):** Decretos, reformas y resoluciones.
*   **SAT CFDI:** Complemento de nómina, guías de llenado y catálogos.
*   **IMSS (IDSE/SUA):** Cambios operativos y validaciones de cuotas.
*   **INFONAVIT:** Avisos de retención y cambios en descuentos.
*   **STPS & Jornada Laboral:** Reformas a la LFT, reducción a 40 horas, vacaciones y subcontratación.
*   **CONASAMI:** Salarios mínimos.
*   **INEGI:** Actualizaciones de indicadores UMA/UMI.

### 3. Análisis de Impacto en Nómina
Cada hallazgo es evaluado por la IA para determinar su efecto en:
*   Base de cálculo y cumplimiento legal.
*   Operación de la jornada (horas extra, turnos, descansos).
*   Errores de timbrado o rechazo de CFDI.
*   Diferencias de cuotas y movimientos afiliatorios.
*   Ajustes fiscales sin reforma de ley (RMF).

### 4. Distribución (Google Chat)
El reporte se envía automáticamente a través de un Webhook de Google Chat con un formato optimizado para la plataforma.

---

## 📘 Documentación Adicional
Para más detalles técnicos sobre el código y la lógica interna, consulta:
👉 **[TECHNICAL_DETAILS.md](./TECHNICAL_DETAILS.md)**

---

## 📅 Automatización y Resiliencia
El bot es resiliente: detecta si hubo una ejecución pendiente y la realiza al momento de abrir la pestaña, comparando siempre contra el último reporte enviado para evitar redundancias.

## 🛠️ Configuración
### Requisitos
1. **Gemini API Key:** Necesaria para el procesamiento de IA y búsqueda.
2. **Webhook de Google Chat:** Se obtiene en la configuración del espacio de Google Chat.

---
*Desarrollado con enfoque en la eficiencia del cumplimiento fiscal y laboral en México.*
