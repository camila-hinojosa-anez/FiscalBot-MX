
# 🏛️ FiscalBot MX - Automatización de Inteligencia Fiscal

FiscalBot MX es una herramienta de monitoreo y síntesis de noticias fiscales y laborales diseñada para contadores, despachos legales y departamentos de RH en México. Utiliza inteligencia artificial para transformar la saturación de información en reportes accionables.

## 🚀 ¿Cómo funciona?

El bot opera bajo un flujo de tres etapas: **Búsqueda**, **Priorización** y **Distribución**.

### 1. Búsqueda con "Grounding" (Google Search)
A diferencia de un chat tradicional que tiene información estática, FiscalBot utiliza el modelo `gemini-3-flash-preview` con la herramienta `googleSearch` habilitada. Esto permite realizar consultas en tiempo real sobre la web y fuentes oficiales.

### 2. Lógica de Priorización Legal
El bot jerarquiza la información aplicando un filtro de riesgo jurídico que pone en primer lugar las publicaciones del **DOF** y plazos del **SAT**.

### 3. Distribución (Google Chat)
El reporte se envía automáticamente a través de un Webhook de Google Chat con un formato optimizado para la plataforma.

---

## Documentación Adicional
Para más detalles técnicos sobre el código y la lógica interna, consulta:
**[TECHNICAL_DETAILS.md](./TECHNICAL_DETAILS.md)**

---

## Automatización y Resiliencia
El bot es resiliente: detecta si hubo una ejecución pendiente y la realiza al momento de abrir la pestaña.

## 🛠️ Configuración
### Requisitos
1. **Gemini API Key:** Necesaria para el procesamiento de IA y búsqueda.
2. **Webhook de Google Chat:** Se obtiene en la configuración del espacio de Google Chat.

---
*Desarrollado con enfoque en la eficiencia del cumplimiento fiscal en México.*
