import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const FILE_TOOLS = new Set(['Read', 'Edit', 'Write', 'NotebookEdit', 'Grep', 'Glob']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

function normalize(value) {
  return String(value ?? '').replaceAll('\\', '/');
}

export function isSecretPath(filePath) {
  const value = normalize(filePath);
  if (/(^|\/)\.env\.example$/i.test(value)) return false;
  return (
    /(^|\/)\.env(\.|$)/i.test(value) ||
    /\.(pem|key|keystore|jks)$/i.test(value) ||
    /firebase-adminsdk[^/]*\.json$/i.test(value)
  );
}

function isOutside(projectDir, filePath) {
  if (!filePath || filePath === '.' || filePath === './') return false;
  const absolute = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(projectDir, filePath);
  const relative = path.relative(path.resolve(projectDir), absolute);
  return relative.startsWith('..') || path.isAbsolute(relative);
}

function mentionsSecret(command) {
  const clean = normalize(command).replaceAll('.env.example', '');
  return (
    /(^|[\s"'=:(])\.env(?![\w])/i.test(clean) ||
    /\.(pem|key|keystore|jks)(\s|["'`]|$)/i.test(clean) ||
    /firebase-adminsdk[^\s"'`]*\.json/i.test(clean)
  );
}

function mentionsOutside(command) {
  return (
    /(^|[\s;&|("'=])\.\.(?=[/\\\s;&|)"']|$)/.test(command) ||
    /(^|[\s;&|("'=])~(?=[/\\\s;&|)"']|$)/.test(command)
  );
}

function decidePath(tool, filePath, projectDir) {
  const value = normalize(filePath);
  if (isSecretPath(value)) {
    return { permissionDecision: 'deny', reason: `archivo secreto bloqueado: ${value}` };
  }
  if (EDIT_TOOLS.has(tool) && /(^|\/)\.claude\//i.test(value)) {
    return { permissionDecision: 'deny', reason: 'no se edita la configuración de la IA' };
  }
  if (isOutside(projectDir, value)) {
    return { permissionDecision: 'deny', reason: `ruta fuera del proyecto: ${value}` };
  }
  return { permissionDecision: 'allow' };
}

function decideBash(command) {
  if (mentionsSecret(command)) {
    return { permissionDecision: 'deny', reason: 'el comando intenta leer un secreto' };
  }
  if (mentionsOutside(command)) {
    return { permissionDecision: 'deny', reason: 'el comando sale de la carpeta del proyecto' };
  }
  if (/(^|[\s;&|])sudo(\s|$)/i.test(command)) {
    return { permissionDecision: 'deny', reason: 'sudo está prohibido' };
  }
  if (/(^|[\s;&|])rm\s+-(rf|fr)(\s|$)/i.test(command)) {
    return { permissionDecision: 'deny', reason: 'rm -rf está prohibido' };
  }
  if (/git\s+push\s+.*(--force|-f)(\s|$)/i.test(command)) {
    return { permissionDecision: 'deny', reason: 'git push --force está prohibido' };
  }
  if (/git\s+reset\s+--hard/i.test(command)) {
    return { permissionDecision: 'deny', reason: 'git reset --hard está prohibido' };
  }
  if (/vercel\s+env\s+pull/i.test(command)) {
    return { permissionDecision: 'deny', reason: 'vercel env pull baja secretos al disco' };
  }
  if (/(^|[\s;&|])(curl|wget)(\s|$)/i.test(command) || /\/usr\/bin\/(curl|wget)/i.test(command)) {
    return { permissionDecision: 'deny', reason: 'curl y wget están prohibidos' };
  }
  return { permissionDecision: 'allow' };
}

export function decide(input, projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()) {
  const tool = String(input?.tool_name ?? '');
  const toolInput = input?.tool_input ?? {};

  if (tool === 'Bash') return decideBash(String(toolInput.command ?? ''));
  if (FILE_TOOLS.has(tool)) {
    const filePath = toolInput.file_path ?? toolInput.notebook_path ?? toolInput.path ?? '.';
    return decidePath(tool, String(filePath), projectDir);
  }
  return { permissionDecision: 'allow' };
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      process.exit(0);
    }
    const result = decide(input, process.env.CLAUDE_PROJECT_DIR || process.cwd());
    if (result.permissionDecision === 'deny') {
      process.stderr.write(`[protect] ${result.reason}\n`);
      process.exit(2);
    }
    process.exit(0);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
