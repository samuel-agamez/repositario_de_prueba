import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { decide } from './protect.mjs';

const PROJECT = path.resolve('proyectos/10-tarjetas-de-estudio-api');

function read(filePath) {
  return decide({ tool_name: 'Read', tool_input: { file_path: filePath } }, PROJECT);
}

function bash(command) {
  return decide({ tool_name: 'Bash', tool_input: { command } }, PROJECT);
}

test('1. Read .env.local se deniega', () => {
  assert.equal(read('.env.local').permissionDecision, 'deny');
});

test('2. Read .env.example se permite', () => {
  assert.equal(read('.env.example').permissionDecision, 'allow');
});

test('3. Read fuera del proyecto se deniega', () => {
  assert.equal(read('../otro-proyecto/secreto.txt').permissionDecision, 'deny');
});

test('4. Read de un archivo normal se permite', () => {
  assert.equal(read('lib/errors.ts').permissionDecision, 'allow');
});

test('5. Edit de .claude/settings.json se deniega', () => {
  const result = decide(
    { tool_name: 'Edit', tool_input: { file_path: '.claude/settings.json' } },
    PROJECT,
  );
  assert.equal(result.permissionDecision, 'deny');
});

test('6. cat .env.local se deniega', () => {
  assert.equal(bash('cat .env.local').permissionDecision, 'deny');
});

test('7. node -e leyendo .env.local se deniega', () => {
  const command = "node -e \"console.log(require('fs').readFileSync('.env.local'))\"";
  assert.equal(bash(command).permissionDecision, 'deny');
});

test('8. curl se deniega', () => {
  assert.equal(bash('curl https://example.com').permissionDecision, 'deny');
});

test('9. git push --force se deniega', () => {
  assert.equal(bash('git push --force origin main').permissionDecision, 'deny');
});

test('10. ls .. y sudo se deniegan', () => {
  assert.equal(bash('ls ..').permissionDecision, 'deny');
  assert.equal(bash('sudo apt install bubblewrap').permissionDecision, 'deny');
  assert.equal(bash('git reset --hard HEAD~1').permissionDecision, 'deny');
});
