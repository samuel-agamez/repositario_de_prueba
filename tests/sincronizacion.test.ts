import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listarMazos } from '../app/api/mazos/route';
import { GET as listarTarjetas } from '../app/api/tarjetas/route';
import { EPOCH, preparar, peticion, type Base } from './sincronizacion/base';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getAuth: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: mocks.getAuth,
}));

vi.mock('../lib/firebase', () => ({
  getDb: mocks.getDb,
  getFirebaseApp: vi.fn(() => ({ name: 'firebase-prueba' })),
}));

let base: Base;

beforeEach(() => {
  base = preparar(mocks);
});

describe('GET /api/mazos y /api/tarjetas (sincronización)', () => {
  it('responde 401 sin token', async () => {
    const response = await listarMazos(new Request('http://localhost/api/mazos'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Token de acceso requerido' });
  });

  it('lista desde el inicio con límite 500 e incluye borrados', async () => {
    base.documentos.set('usuarios/uid-prueba/mazo/uuid-a', {
      nombre: 'Biología',
      publico: false,
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });
    base.documentos.set('usuarios/uid-prueba/mazo/uuid-b', {
      nombre: 'Historia',
      publico: true,
      created_at: '2026-11-13T09:00:00.000Z',
      updated_at: '2026-11-14T12:00:00.000Z',
      deleted_at: '2026-11-14T12:30:00.000Z',
    });
    base.documentos.set('usuarios/otro-uid/mazo/uuid-ajeno', {
      nombre: 'Ajeno',
      publico: false,
      created_at: '2026-11-13T09:00:00.000Z',
      updated_at: '2026-11-14T13:00:00.000Z',
      deleted_at: null,
    });

    const response = await listarMazos(peticion('http://localhost/api/mazos'));

    expect(response.status).toBe(200);
    const cuerpo = await response.json();
    expect(cuerpo.items.map((item: { id: string }) => item.id)).toEqual(['uuid-a', 'uuid-b']);
    expect(cuerpo.items[1].deleted_at).toBe('2026-11-14T12:30:00.000Z');
    expect(cuerpo.servidor_ahora).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*Z$/);
    expect(base.consultas[0]).toEqual({
      campo: 'updated_at',
      operador: '>',
      valor: EPOCH,
      limite: 500,
    });
  });

  it('aplica el parámetro since', async () => {
    base.documentos.set('usuarios/uid-prueba/mazo/uuid-viejo', {
      nombre: 'Viejo',
      publico: false,
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });
    base.documentos.set('usuarios/uid-prueba/mazo/uuid-nuevo', {
      nombre: 'Nuevo',
      publico: false,
      created_at: '2026-11-14T11:00:00.000Z',
      updated_at: '2026-11-14T12:00:00.000Z',
      deleted_at: null,
    });

    const response = await listarMazos(
      peticion('http://localhost/api/mazos?since=2026-11-14T11:00:00.000Z'),
    );

    expect(response.status).toBe(200);
    const cuerpo = await response.json();
    expect(cuerpo.items.map((item: { id: string }) => item.id)).toEqual(['uuid-nuevo']);
    expect(base.consultas[0]?.valor).toBe('2026-11-14T11:00:00.000Z');
  });

  it('rechaza un since que no sea ISO 8601 UTC', async () => {
    const response = await listarMazos(peticion('http://localhost/api/mazos?since=ayer'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Datos inválidos',
      detalles: [{ campo: 'since', mensaje: 'Debe ser una fecha ISO 8601 UTC' }],
    });
    expect(base.consultas).toHaveLength(0);
  });

  it('lista tarjetas del usuario autenticado', async () => {
    base.documentos.set('usuarios/uid-prueba/tarjeta/uuid-t', {
      mazo_id: 'uuid-mazo',
      pregunta: '¿Qué es una célula?',
      respuesta: 'Unidad básica de la vida',
      caja: 2,
      proxima_revision: '2026-11-15T10:00:00.000Z',
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });

    const response = await listarTarjetas(peticion('http://localhost/api/tarjetas'));

    expect(response.status).toBe(200);
    const cuerpo = await response.json();
    expect(cuerpo.items).toHaveLength(1);
    expect(cuerpo.items[0]).toMatchObject({ id: 'uuid-t', mazo_id: 'uuid-mazo', caja: 2 });
  });
});
