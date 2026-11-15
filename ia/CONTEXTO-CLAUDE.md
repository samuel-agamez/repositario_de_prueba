# Contexto de traspaso — API de tarjetas

Importado por `CLAUDE.md`. Actualízalo al terminar cada sesión.

## Reglas vigentes

Leer `AGENTS.md` antes de trabajar. Sin `git push`, `vercel`, `eas` ni
instalaciones sin permiso. No leer `.env*`, claves ni
`firebase-adminsdk*.json`. Firestore cerrado a los clientes: la API es la
única puerta. No añadir funcionalidades fuera del contrato del README.

## Estado al 2026-11-14

### Terminado

- Firebase `finalmovil-f14ba`: Authentication con correo/contraseña y
  Firestore Standard en `southamerica-east1`.
- `firestore.rules` niega todo a los clientes (probado con `403`).
- Índices `tarjeta`: `mazo_id, updated_at` y `deleted_at, updated_at`
  (`Habilitado`).
- App web `API Tarjetas` creada; la clave web se probó contra
  `signInWithPassword`.
- Cuenta de servicio y clave privada descargadas; el contenido nunca se leyó
  ni se versionó.
- Autenticación implementada: `/api/auth/registro`, `/api/auth/login`,
  `/api/auth/refresh` y `/api/auth/yo`.
- Sincronización implementada: `GET ?since=`, `PUT` y `DELETE` en
  `/api/mazos` y `/api/tarjetas`.
- Mazos públicos: `PUT` con `publico: true` publica en `mazos_publicos`,
  `GET /api/mazos/publicos` lista y `POST /api/mazos/:id/copiar` copia.
  `npm run check` y `npm run build` pasan; 61 pruebas; cobertura 98,47 %
  statements, 86,90 % ramas y 97,72 % funciones.

### Pendiente inmediato

1. Vercel: `vercel link`, variables de entorno y previsualización (con
   autorización) para probar los endpoints reales.
2. Recrear este archivo si vuelve a faltar: ya se perdió una vez después de
   crearlo.

### Vercel (requiere autorización)

- CLI autenticada como `samuel-agamez`, equipo `samuel-vg`; falta
  `vercel link --repo --scope samuel-vg` (no hay `.vercel/`).
- Variables en Preview y Production: `FIREBASE_PROJECT_ID`
  (`finalmovil-f14ba`), `FIREBASE_CLIENT_EMAIL`, `FIREBASE_WEB_API_KEY` y
  `FIREBASE_PRIVATE_KEY`. La clave privada la pega el usuario a mano; nunca
  se lee ni se versiona.
- Despliegue de previsualización y pruebas: `/api/salud` 200, registro 201,
  login 200, refresh 200, `yo` 200 y 401 sin token.

### App móvil (repositorio hermano, cambios sin confirmar)

`10-tarjetas-de-estudio-app`: `M package.json`, `M package-lock.json`,
`?? app.json`. No restaurar ni sobrescribir antes de revisar el diff.

Pendientes: directorio `app/` con `_layout.tsx` y rutas Expo; `scheme`,
`android.package` e `ios.bundleIdentifier` en `app.json`; plugins
`expo-sensors` y `expo-notifications` si se usan; `react-native-worklets`
como dependencia directa; `react-native-web` a `~0.21.4`. La app sin
credenciales Firebase: solo consume la API. Nada de EAS sin autorización.

### API terminada

Las 10 funcionalidades del contrato están implementadas y con pruebas.
Solo queda desplegar en Vercel y probar los endpoints reales.

## Git

- API: `origin/main` en `11caad0`; autenticación, sincronización y mazos
  públicos van como commits locales sin push (autorización pendiente).
  Remote: `https://github.com/samuel-agamez/repositario_de_prueba.git`.
- App móvil: `https://github.com/samuel-agamez/finalmovil.tdea.git`.
- Sin paquetes npm instalados desde GitHub; las dependencias vienen de npm y
  están fijas en `package-lock.json`.
