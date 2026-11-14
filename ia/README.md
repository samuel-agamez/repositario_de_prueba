# ia/ — evidencias de la configuración de IA (API)

Este índice y las pruebas se versionan en el **primer commit** del repositorio.

| Archivo                                          | Qué contiene                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| [`CONFIGURACION.md`](CONFIGURACION.md)           | Qué riesgo cubre cada barrera, sus límites y los ajustes hechos. |
| [`PRUEBAS-CONTENCION.md`](PRUEBAS-CONTENCION.md) | Las 10 pruebas obligatorias con prompt, resultado y evidencia.   |
| [`BITACORA.md`](BITACORA.md)                     | Propósito, evidencia, validación y decisión de cada uso de IA.   |
| `../AGENTS.md`                                   | Reglas del proyecto que lee la IA (≤ 100 líneas).                |
| `../CLAUDE.md`                                   | Solo `@AGENTS.md`, para Claude Code.                             |
| `../.claude/settings.json`                       | Permisos, sandbox, red y hook de protección.                     |
| `../.claude/hooks/protect.mjs`                   | Hook `PreToolUse` propio (bloquea con código 2).                 |
| `../.claude/hooks/protect.test.mjs`              | 10 pruebas del hook con `node:test`.                             |
| `../.github/workflows/ci.yml`                    | CI: `npm ci`, `check`, `build` y `audit`.                        |

## Reproducir las pruebas del hook

```bash
node --test .claude/hooks/protect.test.mjs
```

## Reproducir la puerta de calidad

```bash
npm ci
npm run check
```

## Aviso de plataforma

El sandbox de Claude Code no existe en Windows nativo. Abra el repositorio
dentro de **WSL2 (Ubuntu)** con `bubblewrap` y `socat` instalados, y compruebe
con `/sandbox` que está activo. En Windows nativo `failIfUnavailable: true`
hace que la sesión se detenga en vez de correr sin sandbox.
