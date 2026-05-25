# AI Calling Service - DEVPATH

Servicio de llamadas telefónicas outbound con agente de voz conversacional en español para DEVPATH. Conecta Twilio (telefonía) con ElevenLabs Conversational AI (voz en tiempo real) y analiza automáticamente la llamada al finalizar usando Claude.

## Stack

- **Node.js / TypeScript** — servidor Express + WebSocket
- **Twilio** — llamadas outbound, media streams, webhooks
- **ElevenLabs Conversational AI** — agente de voz en tiempo real
- **Anthropic Claude Haiku** — análisis post-llamada y extracción de datos
- **Make.com** — webhook de destino para datos del lead

## Arquitectura

```
POST /calls/outbound
        │
        ▼
  Twilio REST API ──── inicia llamada ────► teléfono del lead
        │
        │  (Twilio llama a /calls/twiml/stream para obtener TwiML)
        │
        ▼
  <Connect><Stream>   ◄──── WebSocket bidireccional ────►  /calls/stream
        │                                                        │
        │                                              mediaStream.handler
        │                                                        │
        │            mulaw 8kHz ◄──► PCM 16kHz                  │
        │                                                        │
        └─────────────────────────────────────────► ElevenLabs ConvAI WS
                                                         (agente en español)

Al finalizar la llamada:
  1. Fetch transcript completo desde ElevenLabs API
  2. Análisis con Claude Haiku → JSON estructurado
  3. POST al webhook de Make con datos del lead + análisis + transcripción
```

## Requisitos previos

- Cuenta [Twilio](https://twilio.com) con número de teléfono
- Cuenta [ElevenLabs](https://elevenlabs.io) con un agente Conversational AI configurado
- Cuenta [Anthropic](https://console.anthropic.com) con API key
- [ngrok](https://ngrok.com) (para desarrollo local)

## Instalación

```bash
git clone <repo>
cd tuhabi
npm install
cp .env.example .env
# editar .env con tus credenciales
```

## Variables de entorno

| Variable | Descripción |
|---|---|
| `TWILIO_ACCOUNT_SID` | Account SID de Twilio (empieza con `AC`) |
| `TWILIO_AUTH_TOKEN` | Auth token de Twilio |
| `TWILIO_PHONE_NUMBER` | Número de teléfono de Twilio (`+1XXXXXXXXXX`) |
| `TWILIO_BASE_URL` | URL pública del servidor (ngrok en desarrollo) |
| `ELEVENLABS_API_KEY` | API key de ElevenLabs |
| `ELEVENLABS_AGENT_ID` | ID del agente conversacional de ElevenLabs |
| `ANTHROPIC_API_KEY` | API key de Anthropic para análisis post-llamada |
| `WEBHOOK_MAKE` | URL del webhook de Make.com (opcional) |
| `PORT` | Puerto del servidor (default: `3000`) |

## Desarrollo

**1. Iniciar el servidor:**
```bash
npm run dev
```

**2. Exponer con ngrok:**
```bash
ngrok http 3000
```

**3. Configurar Twilio:**
- En tu número de Twilio → Voice Configuration → set webhook URL a `https://<tu-ngrok>/calls/inbound`
- Asegúrate de que el método sea **HTTP POST**

**4. Configurar ElevenLabs:**
- En el agente → Tools → agregar tool de sistema **"End call"**
- En el system prompt usar las variables `{{nombre}}`, `{{primer_nombre}}`, `{{correo}}` para datos dinámicos del lead

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor con hot reload (tsx watch) |
| `npm run build` | Compilar TypeScript a `dist/` |
| `npm start` | Correr build de producción |
| `npm run typecheck` | Verificar tipos sin compilar |

## API Reference

### Iniciar llamada outbound

```bash
POST /calls/outbound
```

```bash
curl -X POST http://localhost:3000/calls/outbound \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+529512345674",
    "nombre": "Juan Perez",
    "correo": "juan@ejemplo.com"
  }'
```

**Body:**

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `to` | string | ✅ | Número de destino (formato E.164) |
| `from` | string | — | Número origen (default: `TWILIO_PHONE_NUMBER`) |
| `nombre` | string | — | Nombre del lead (llega al agente como `{{nombre}}` y `{{primer_nombre}}`) |
| `correo` | string | — | Correo del lead (llega al agente como `{{correo}}`) |
| `record` | boolean | — | Grabar la llamada (default: `false`) |

**Respuesta (201):**
```json
{
  "sid": "CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "to": "+52951*******",
  "from": "+19*********",
  "status": "queued",
  "direction": "outbound-api",
  "duration": null,
  "startTime": null,
  "endTime": null,
  "price": null,
  "priceUnit": "USD"
}
```

---

### Obtener estado de una llamada

```bash
GET /calls/:callSid
```

```bash
curl http://localhost:3000/calls/CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### Obtener grabaciones de una llamada

```bash
GET /calls/:callSid/recordings
```

```bash
curl http://localhost:3000/calls/CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/recordings
```

---

### Webhooks internos (usados por Twilio)

| Endpoint | Método | Descripción |
|---|---|---|
| `/calls/inbound` | POST | Recibe llamadas entrantes, devuelve TwiML |
| `/calls/twiml/stream` | GET / POST | Devuelve TwiML con WebSocket stream |
| `/calls/status` | POST | Recibe actualizaciones de estado de la llamada |

---

### WebSocket

```
WS /calls/stream
```

Usado internamente por Twilio para el media stream de audio. No se llama directamente.

---

### Health check

```bash
GET /health
# → { "status": "ok" }
```

## Flujo post-llamada

Al terminar la llamada (evento `stop` de Twilio o `end_call` del agente):

1. **Fetch transcript** — consulta `GET https://api.elevenlabs.io/v1/convai/conversations/{id}` con 3 segundos de espera para que ElevenLabs finalice el procesamiento
2. **Análisis con Claude** — envía la transcripción a `claude-haiku-4-5` y extrae datos estructurados
3. **POST al webhook** — envía el JSON completo a `WEBHOOK_MAKE`

## Payload del webhook (Make.com)

```json
{
  "nombre": "Juan Perez",
  "correo": "juan@ejemplo.com",
  "telefono": "+52951*******",
  "interesado": "sí",
  "presupuesto": "busca financiamiento",
  "cuando_empieza": "1-3 meses",
  "mejor_horario": "noche",
  "notas": "Interesado en bootcamp de programación, busca financiamiento, disponible en las noches.",
  "transcripcion": "Agente: ¡Hola! ¿Hablo con Juan Perez?\nUsuario: Sí, soy yo.\nAgente: ..."
}
```

| Campo | Valores posibles |
|---|---|
| `interesado` | `sí` · `no` · `tal vez` |
| `presupuesto` | `sí` · `busca financiamiento` · `no especificó` |
| `cuando_empieza` | `este mes` · `1-3 meses` · `solo explorando` · `no contestó` |
| `mejor_horario` | horario mencionado o `null` |
| `notas` | resumen libre de la conversación |
| `transcripcion` | conversación completa formateada |

## Variables dinámicas para el agente (ElevenLabs)

El servicio inyecta automáticamente las siguientes variables al system prompt del agente en cada llamada:

| Variable | Valor |
|---|---|
| `{{nombre}}` | Nombre completo del lead (ej. `"Juan Perez"`) |
| `{{primer_nombre}}` | Solo el primer nombre (ej. `"Juan"`) |
| `{{correo}}` | Correo electrónico del lead |
