import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listarPublicos } from '../app/api/mazos/publicos/route';
import { PUT as guardarMazo } from '../app/api/mazos/[id]/route';
import { preparar, peticion, peticionPut, type Base } from './sincronizacion/base';

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

function sembrarTarjeta(id: string, borrada: boolean): void {
  base.documentos.set(`usuarios/uid-prueba/tarjeta/${id}`, {
    mazo_id: UUID_MAZO,
    pregunta: `Pregunta ${id}`,
    respuesta: `Respuesta ${id}`,
    caja: 1,
    proxima_revision: null,
    created_at: '2026-11-14T09:00:00.000Z',
    updated_at: '2026-11-14T10:00:00.000Z',
    deleted_at: borrada ? '2026-11-14T11:00:00.000Z' : null,
  });
}

let base: Base;

beforeEach(() => {
  base = preparar(mocks);
});

describe('GET /api/mazos/publicos', () => {
  it('responde 401 sin token', async () => {
    const response = await listarPublicos(new Request('http://localhost/api/mazos/publicos'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Token de acceso requerido' });
  });

  it('lista solo los mazos publicados', async () => {
    base.documentos.set('mazos_publicos/uuid-pub', {
      autor_uid: 'otro-uid',
      nombre: 'Álgebra',
      total_tarjetas: 3,
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });
    base.documentos.set('usuarios/uid-prueba/mazo/uuid-privado', {
      nombre: 'Privado',
      publico: false,
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });

    const response = await listarPublicos(peticion('http://localhost/api/mazos/publicos'));

    expect(response.status).toBe(200);
    const cuerpo = await response.json();
    expect(cuerpo.items).toHaveLength(1);
    expect(cuerpo.items[0]).toMatchObject({ id: 'uuid-pub', nombre: 'Álgebra', total_tarjetas: 3 });
  });
});

describe('PUT /api/mazos/[id] con publico', () => {
  it('publica metadatos y copia solo las tarjetas activas', async () => {
    sembrarTarjeta('uuid-t1', false);
    sembrarTarjeta('uuid-t2', true);

    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/x', { nombre: 'Álgebra', publico: true }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(200);
    expect(base.documentos.get(`mazos_publicos/${UUID_MAZO}`)).toMatchObject({
      autor_uid: 'uid-prueba',
      nombre: 'Álgebra',
      total_tarjetas: 1,
      deleted_at: null,
    });
    expect(base.documentos.get(`mazos_publicos/${UUID_MAZO}/tarjeta/uuid-t1`)).toMatchObject({
      pregunta: 'Pregunta uuid-t1',
      respuesta: 'Respuesta uuid-t1',
    });
    expect(base.documentos.has(`mazos_publicos/${UUID_MAZO}/tarjeta/uuid-t2`)).toBe(false);
    expect(base.escrituras.some((escritura) => escritura.tipo === 'batch-set')).toBe(true);
    expect(base.consultas).toContainEqual(
      expect.objectContaining({ campo: 'mazo_id', operador: '==', valor: UUID_MAZO }),
    );
  });

  it('retira el mazo público cuando publico pasa a false', async () => {
    base.documentos.set(`mazos_publicos/${UUID_MAZO}`, {
      autor_uid: 'uid-prueba',
      nombre: 'Álgebra',
      total_tarjetas: 2,
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });
    base.documentos.set(`mazos_publicos/${UUID_MAZO}/tarjeta/uuid-t1`, {
      pregunta: 'P1',
      respuesta: 'R1',
      created_at: '2026-11-14T09:00:00.000Z',
      updated_at: '2026-11-14T10:00:00.000Z',
      deleted_at: null,
    });

    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/x', { nombre: 'Álgebra', publico: false }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(200);
    expect(base.documentos.has(`mazos_publicos/${UUID_MAZO}`)).toBe(false);
    expect(base.documentos.has(`mazos_publicos/${UUID_MAZO}/tarjeta/uuid-t1`)).toBe(false);
    expect(base.escrituras.some((escritura) => escritura.tipo === 'batch-delete')).toBe(true);
    expect(base.escrituras.some((escritura) => escritura.tipo === 'delete')).toBe(true);
  });

  it('no toca mazos_publicos si el mazo nunca estuvo publicado', async () => {
    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/x', { nombre: 'Privado', publico: false }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(200);
    expect(base.escrituras.every((escritura) => escritura.ruta.startsWith('usuarios/'))).toBe(true);
  });
});
