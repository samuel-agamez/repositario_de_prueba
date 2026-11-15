import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as borrarMazo } from '../app/api/mazos/[id]/route';
import { DELETE as borrarTarjeta } from '../app/api/tarjetas/[id]/route';
import { preparar, peticionDelete, type Base } from './sincronizacion/base';

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

const UUID_MAZO = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';
const UUID_TARJETA = '1f1e2b78-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

let base: Base;

beforeEach(() => {
  base = preparar(mocks);
});

describe('DELETE /api/mazos/[id] y /api/tarjetas/[id]', () => {
  it('responde 401 sin token', async () => {
    const response = await borrarMazo(
      new Request('http://localhost/api/mazos/uuid', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(401);
  });

  it('responde 404 si el mazo no existe', async () => {
    const response = await borrarMazo(peticionDelete('http://localhost/api/mazos/x'), {
      params: Promise.resolve({ id: UUID_MAZO }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Mazo no encontrado' });
    expect(base.escrituras).toHaveLength(0);
  });

  it('borra de forma lógica', async () => {
    base.documentos.set(`usuarios/uid-prueba/mazo/${UUID_MAZO}`, {
      nombre: 'Biología',
      publico: false,
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });

    const response = await borrarMazo(peticionDelete('http://localhost/api/mazos/x'), {
      params: Promise.resolve({ id: UUID_MAZO }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(base.escrituras[0]?.tipo).toBe('update');
    expect(base.escrituras[0]?.datos).toMatchObject({
      deleted_at: expect.stringMatching(/Z$/),
      updated_at: expect.stringMatching(/Z$/),
    });
    expect(base.documentos.get(`usuarios/uid-prueba/mazo/${UUID_MAZO}`)?.deleted_at).toBeTruthy();
  });

  it('no repite la escritura si ya estaba borrado', async () => {
    base.documentos.set(`usuarios/uid-prueba/mazo/${UUID_MAZO}`, {
      nombre: 'Biología',
      publico: false,
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: '2026-11-14T11:00:00.000Z',
    });

    const response = await borrarMazo(peticionDelete('http://localhost/api/mazos/x'), {
      params: Promise.resolve({ id: UUID_MAZO }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(base.escrituras).toHaveLength(0);
  });

  it('borra una tarjeta de forma lógica', async () => {
    base.documentos.set(`usuarios/uid-prueba/tarjeta/${UUID_TARJETA}`, {
      mazo_id: UUID_MAZO,
      pregunta: '¿Qué es una célula?',
      respuesta: 'Unidad básica de la vida',
      caja: 1,
      proxima_revision: null,
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });

    const response = await borrarTarjeta(peticionDelete('http://localhost/api/tarjetas/x'), {
      params: Promise.resolve({ id: UUID_TARJETA }),
    });

    expect(response.status).toBe(200);
    expect(base.escrituras[0]?.ruta).toBe(`usuarios/uid-prueba/tarjeta/${UUID_TARJETA}`);
  });

  it('responde 404 si la tarjeta no existe', async () => {
    const response = await borrarTarjeta(peticionDelete('http://localhost/api/tarjetas/x'), {
      params: Promise.resolve({ id: UUID_TARJETA }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Tarjeta no encontrada' });
  });
});
