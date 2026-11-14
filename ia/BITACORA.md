# Bitácora de IA — API

Formato por entrada: **propósito**, **evidencia**, **validación**, **decisión**.
Se agregan las entradas de cada sesión real; no se borran las correcciones.

## 2026-11-14 — Configuración inicial

- **Propósito**: crear el primer commit con reglas de IA, permisos, sandbox,
  hook, scripts de calidad y CI antes de generar código de la API.
- **Evidencia**: `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`,
  `.claude/hooks/protect.mjs`, `eslint.config.mjs`, `tsconfig.json`,
  `vitest.config.ts`, `.github/workflows/ci.yml`, `ia/`.
- **Validación**: `node --test .claude/hooks/protect.test.mjs` (10 pruebas) y
  revisión manual de la sintaxis contra la documentación de Claude Code.
- **Decisión**: se versiona todo en el primer commit. Las dependencias de la
  API se instalan después, con permiso, para no inventar versiones.

## 2026-11-14 — Caso rechazado 1: `next lint`

- **Propósito**: definir el script de lint.
- **Evidencia**: la documentación de Next.js 16 indica que `next lint` se
  eliminó y que se usa el CLI de ESLint.
- **Validación**: `eslint.config.mjs` con `eslint-config-next/core-web-vitals`
  y `eslint-config-next/typescript`.
- **Decisión**: se rechazó `next lint`; el script es `eslint .`.

## 2026-11-14 — Caso rechazado 2: `.claudeignore`

- **Propósito**: impedir que la IA leyera `.env`.
- **Evidencia**: la documentación de Claude Code dice que `.claudeignore` no
  tiene efecto; las reglas `Read` son las que bloquean.
- **Validación**: `permissions.deny` con `Read(**/.env*)` y la excepción
  `Read(!.env.example)`.
- **Decisión**: se rechazó `.claudeignore`; se usan permisos + sandbox + hook.

## 2026-11-14 — Caso rechazado 3: SDK web de Firebase en la API

- **Propósito**: autenticar desde la API con el SDK web (`firebase/app` +
  `firebase/auth`).
- **Evidencia**: el SDK web está pensado para clientes y expone una
  configuración pública; la API necesita `firebase-admin` y verificar el ID
  token en el servidor.
- **Validación**: la hoja del proyecto exige `getAuth().verifyIdToken()` con
  el Admin SDK y prohíbe `firebaseConfig` en el repositorio.
- **Decisión**: el SDK web no entra. La API usa `firebase-admin` y llama a la
  API REST de Firebase Auth solo con `FIREBASE_WEB_API_KEY`, que vive en
  Vercel.

## 2026-11-14 — Formato de error único

- **Propósito**: que todas las rutas respondan el mismo formato
  `{ error, detalles? }` sin filtrar datos internos.
- **Evidencia**: `lib/errors.ts` y `tests/errors.test.ts`.
- **Validación**: las pruebas cubren 400, 401, 404, 409, 500 y el error
  desconocido; el 500 siempre responde `Error interno`.
- **Decisión**: las rutas lanzan `ApiError` y un único `respuestaError` arma
  la respuesta; nunca se devuelve `error.message` de un error no controlado.

## 2026-11-14 — Base de la API verificada

- **Propósito**: comprobar que la base de la API compila y pasa la puerta de
  calidad antes de escribir autenticación y sincronización.
- **Evidencia**: `app/api/salud/route.ts`, `lib/errors.ts`,
  `tests/errors.test.ts`, `tests/salud.test.ts`, `firestore.rules`,
  `firestore.indexes.json` y `firebase.json`.
- **Validación**: `npm run check` (typecheck, lint, formato y 5 pruebas; 100 %
  de cobertura en `lib/errors.ts`) y `npm run build` con Next.js 16.
- **Decisión**: se sigue con `/api/auth/*` en la próxima sesión. Las reglas de
  Firestore ya niegan todo a los clientes para que la API sea la única puerta.
