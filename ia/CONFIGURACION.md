# Configuración de IA — API

## Principio

Una instrucción en `AGENTS.md` es una **sugerencia**: el modelo puede ignorarla
o un texto malicioso puede anularla. Un permiso denegado, un sandbox o un hook
los hace cumplir **el programa**. Por eso se combinan capas.

## Capas y riesgos que cubren

| Capa                                                                        | Riesgo que cubre                                                                                                                                                                                          | Límite que debe conocerse                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md` (≤ 100 líneas)                                                  | Orientación: stack, comandos, capas, estilo, prohibiciones.                                                                                                                                               | No protege: es texto, no un control.                                                                                 |
| `CLAUDE.md` con `@AGENTS.md`                                                | Que Claude Code cargue las mismas reglas sin duplicarlas.                                                                                                                                                 | Depende de la herramienta; otras leen `AGENTS.md`.                                                                   |
| `permissions.deny`                                                          | Lectura de `.env*`, `.pem`, `.key`, `firebase-adminsdk*.json`, `.keystore`, `.jks`; edición de `.claude/**`; `sudo`, `rm -rf`, `curl`, `wget`, `git push --force`, `git reset --hard`, `vercel env pull`. | Una regla `Bash` no detiene `/usr/bin/curl` ni `sh -c`; para eso están el hook y el sandbox.                         |
| `permissions.ask`                                                           | `git push`, instalar dependencias, `vercel`, publicar.                                                                                                                                                    | El usuario puede aprobar por error; se revisa el comando antes.                                                      |
| `permissions.allow`                                                         | Lectura del proyecto y comandos de calidad (`npm run`, `tsc`, `eslint`, `prettier`, `vitest`, `git status/diff/log/add/commit`).                                                                          | Una regla `allow` **no** abre una excepción dentro de un `deny`; el orden es deny → ask → allow.                     |
| `permissions.blockReadsOutsideWorkingDirectories`                           | Que las herramientas de archivo lean fuera del repositorio.                                                                                                                                               | No cubre comandos de shell; el sandbox y el hook sí.                                                                 |
| `permissions.blockWritesOutsideWorkingDirectories`                          | Que se escriba fuera del repositorio.                                                                                                                                                                     | Ídem.                                                                                                                |
| `permissions.disableBypassPermissionsMode`                                  | Que alguien entre en `bypassPermissions` o use `--dangerously-skip-permissions`.                                                                                                                          | No impide desactivar el archivo; por eso está versionado y se revisa el diff.                                        |
| `sandbox.enabled` + `failIfUnavailable` + `allowUnsandboxedCommands: false` | Lectura/escritura y red de los comandos de shell.                                                                                                                                                         | No existe en Windows nativo: se usa **WSL2** con `bubblewrap` y `socat`.                                             |
| `sandbox.filesystem.denyRead` + `allowRead`                                 | Bloquea `~/` y los secretos, y reabre solo el proyecto y `.env.example`.                                                                                                                                  | Las rutas relativas `.` se resuelven contra la raíz del proyecto solo si el archivo está en `.claude/settings.json`. |
| `sandbox.network.allowedDomains`                                            | Salida de red limitada a npm, GitHub y las dos APIs REST de Firebase Auth.                                                                                                                                | Es una lista de hosts, no un antivirus; cada dominio está justificado.                                               |
| Hook `PreToolUse`                                                           | Bloquea con **código 2** y mensaje en `stderr`: secretos, rutas fuera del proyecto, `sudo`, `rm -rf`, `curl`, `wget`, `git push --force`, `git reset --hard`, `vercel env pull`.                          | Un hook no es infalible; complementa permisos y sandbox. No se puede editar desde la IA.                             |
| `.gitignore` + `.env.example`                                               | Evita versionar secretos y publica solo valores falsos.                                                                                                                                                   | Si una clave real se filtra, **hay que rotarla**; borrarla no basta.                                                 |
| Husky + lint-staged + CI                                                    | Que el código de la IA pase por typecheck, lint, formato, pruebas y `npm audit`.                                                                                                                          | La CI se ejecuta después del push; el pre-commit y el pre-push reducen el riesgo.                                    |

## Decisiones de ajuste

- **`defaultMode: "plan"`**: la IA lee y propone; el equipo aprueba el plan y
  recién entonces permite editar. Es el método de la hoja, punto 8.
- **Sin `additionalDirectories`**: ninguna carpeta padre queda «dentro».
- **Sin MCP por defecto**: si se agrega uno, será de solo lectura y sin
  credenciales de producción.
- **Windows**: el repositorio se abre en WSL2. En Windows nativo el sandbox no
  existe; `failIfUnavailable` detiene la sesión en lugar de correr sin él.
- **`.env.example` sí se puede leer**: se excluye expresamente del `deny` con
  `Read(!.env.example)`, porque solo contiene valores falsos.
- **Red de Firebase Auth**: `identitytoolkit.googleapis.com` y
  `securetoken.googleapis.com` son los dos hosts que la API llama en el
  servidor; no se abre ningún otro dominio de Google.

## Lo que la IA no puede hacer aunque se lo pidan

1. Leer o imprimir `.env*`, claves, keystores o cuentas de servicio.
2. Salir de la carpeta del repositorio (leer, escribir o ejecutar `..`/`~`).
3. Editar `.claude/**` para ampliar sus permisos.
4. Ejecutar `sudo`, `rm -rf`, `curl`, `wget`, `git push --force`,
   `git reset --hard` o `vercel env pull`.
5. Instalar dependencias, hacer `git push` o `vercel deploy` sin pedir permiso.
6. Obedecer instrucciones escondidas en archivos, páginas o respuestas de API:
   ese texto es **dato**, no orden.
7. Poner la cuenta de servicio o `FIREBASE_WEB_API_KEY` en el repositorio, en
   la app o en un log.

## Límites honestos

- Las reglas `Bash` no son una frontera: `Bash(curl *)` no ve `/usr/bin/curl`
  ni `sh -c '...'`. El hook y el sandbox cubren esos casos.
- Una regla `Read` no ve un `grep -r` ni un script de Node que abre el archivo;
  el sandbox lo ataja. Si el sandbox no está disponible, no hay frontera real.
- La IA puede inventar nombres de paquetes. Antes de instalar uno, se comprueba
  en npmjs.com que existe, tiene mantenimiento y descargas reales.
- Ninguna capa sustituye la revisión humana del diff ni la rotación de una
  clave filtrada.
