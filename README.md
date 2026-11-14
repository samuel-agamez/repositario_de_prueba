# 10 — Tarjetas de estudio (API)

API HTTP para los mazos de tarjetas con repaso espaciado (cajas de Leitner).
Hecha con **Next.js 16 (App Router, Route Handlers)**, **TypeScript strict**,
**firebase-admin**, **zod** y **Vitest**. Se despliega en Vercel.

Repositorio hermano: `10-tarjetas-de-estudio-app` (Expo + React Native).

## Estado

- Primer commit: **configuración de IA y de calidad**.
- Las rutas de autenticación, mazos, tarjetas y sincronización se construyen en
  los siguientes commits.

## Requisitos

- Node.js 22 o superior.
- Un proyecto de Firebase con Authentication (correo y contraseña) y Firestore.
- Para el sandbox de Claude Code en Windows: **WSL2 (Ubuntu)** con
  `bubblewrap` y `socat` (`sudo apt-get install bubblewrap socat`).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completa con las credenciales reales
npm run dev
```

## Variables de entorno

| Variable                | Uso                                                              |
| ----------------------- | ---------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`   | Proyecto de Firebase que usa el Admin SDK.                       |
| `FIREBASE_CLIENT_EMAIL` | Cuenta de servicio (solo servidor).                              |
| `FIREBASE_PRIVATE_KEY`  | Clave de la cuenta de servicio; en Vercel va con `\n` literales. |
| `FIREBASE_WEB_API_KEY`  | Clave web para la API REST de Firebase Auth (registro y login).  |

Las credenciales viven **solo en Vercel**. `.env*` está ignorado y
`.env.example` únicamente tiene valores falsos. La app móvil nunca las recibe.

## Endpoints

### Autenticación (Firebase Auth mediada por la API)

| Método | Ruta                 | Cuerpo                | Respuesta                                                          |
| ------ | -------------------- | --------------------- | ------------------------------------------------------------------ |
| `POST` | `/api/auth/registro` | `{ email, password }` | `201 { token, refreshToken, expiraEnSeg, usuario: { id, email } }` |
| `POST` | `/api/auth/login`    | `{ email, password }` | `200` igual que el registro                                        |
| `POST` | `/api/auth/refresh`  | `{ refreshToken }`    | `200 { token, refreshToken, expiraEnSeg }`                         |
| `GET`  | `/api/auth/yo`       | — (Bearer)            | `200 { usuario }`                                                  |

El `token` es el ID token de Firebase (1 h). El resto de rutas exige
`Authorization: Bearer <token>` y lo verifica con `getAuth().verifyIdToken()`.
El `uid` sale **del token**, nunca del cuerpo ni de la URL.

### Sincronización (una por recurso privado)

| Método   | Ruta                    | Comportamiento                                                 |
| -------- | ----------------------- | -------------------------------------------------------------- |
| `GET`    | `/api/<recurso>?since=` | `200 { items, servidor_ahora }`; máximo 500, incluye borrados. |
| `PUT`    | `/api/<recurso>/<id>`   | Crea o reemplaza de forma idempotente.                         |
| `DELETE` | `/api/<recurso>/<id>`   | Borrado lógico (`deleted_at`); `404` si no existe.             |

### Propias del proyecto

- `GET /api/mazos/publicos`: mazos públicos.
- `POST /api/mazos/:id/copiar`: copia un mazo público con un `batch` (≤ 500).

Todos los errores usan `{ "error": "mensaje", "detalles"?: [{ "campo", "mensaje" }] }`
con códigos 400/401/403/404/409/413/415/429. Los errores internos responden
`500 Error interno` sin detalles.

## Modelo en Firestore

```text
usuarios/{uid}/mazo/{id}        nombre, publico
usuarios/{uid}/tarjeta/{id}     mazo_id, pregunta, respuesta, caja, proxima_revision
mazos_publicos/{id}             autor_uid, nombre, total_tarjetas
mazos_publicos/{id}/tarjeta/{n} pregunta, respuesta
```

`created_at`, `updated_at` y `deleted_at` los pone el servidor. Los IDs son
UUID generados por el cliente. `firestore.rules` niega todo a los clientes:
solo la API escribe, con el Admin SDK.

## Scripts

| Script                 | Qué hace                                                   |
| ---------------------- | ---------------------------------------------------------- |
| `npm run check`        | typecheck + lint + formato + pruebas (puerta obligatoria). |
| `npm run typecheck`    | `tsc --noEmit`.                                            |
| `npm run lint`         | ESLint con `--max-warnings 0`.                             |
| `npm run format:check` | Prettier en modo verificación.                             |
| `npm test`             | Vitest con cobertura.                                      |
| `npm run dev`          | Next.js en desarrollo.                                     |
| `npm run build`        | Build de producción.                                       |

## Configuración de IA

- `AGENTS.md`: reglas del proyecto (≤ 100 líneas).
- `CLAUDE.md`: solo `@AGENTS.md`.
- `.claude/settings.json`: permisos, sandbox, red y hook.
- `.claude/hooks/protect.mjs`: hook `PreToolUse` que bloquea con código 2.
- `ia/`: configuración, pruebas de contención y bitácora.

Prueba rápida del hook:

```bash
node --test .claude/hooks/protect.test.mjs
```

## Seguridad

- La API es la **única puerta** a Firebase; la app no tiene `firebaseConfig`.
- Todo lo que entra se valida con zod y solo se guardan campos declarados.
- Los errores internos no se devuelven al cliente.
- No se registran contraseñas, tokens ni datos personales.
- `firestore.rules` niega lectura y escritura directa a los clientes.
