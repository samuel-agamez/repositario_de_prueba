import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT as guardarMazo } from '../app/api/mazos/[id]/route';
import { PUT as guardarTarjeta } from '../app/api/tarjetas/[id]/route';
import { preparar, peticionPut, type Base } from './sincronizacion/base';

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

describe('PUT /api/mazos/[id] y /api/tarjetas/[id]', () => {
  it('responde 401 sin token', async () => {
    const response = await guardarMazo(
      new Request('http://localhost/api/mazos/uuid', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: 'Biología', publico: false }),
      }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(401);
  });

  it('crea un mazo con los tiempos del servidor', async () => {
    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/no-importa', { nombre: 'Biología', publico: false }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(200);
    const cuerpo = await response.json();
    expect(cuerpo.item).toMatchObject({
      id: UUID_MAZO,
      nombre: 'Biología',
      publico: false,
      deleted_at: null,
    });
    expect(cuerpo.item.created_at).toBe(cuerpo.item.updated_at);
    expect(base.escrituras[0]).toMatchObject({
      tipo: 'set',
      ruta: `usuarios/uid-prueba/mazo/${UUID_MAZO}`,
    });
  });

  it('reemplaza sin perder created_at y borra marcas previas', async () => {
    base.documentos.set(`usuarios/uid-prueba/mazo/${UUID_MAZO}`, {
      nombre: 'Viejo nombre',
      publico: true,
      created_at: '2020-01-01T00:00:00.000Z',
      updated_at: '2020-01-02T00:00:00.000Z',
      deleted_at: '2020-01-03T00:00:00.000Z',
    });

    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/x', { nombre: 'Nuevo nombre', publico: false }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(200);
    const cuerpo = await response.json();
    expect(cuerpo.item.created_at).toBe('2020-01-01T00:00:00.000Z');
    expect(cuerpo.item.updated_at).not.toBe('2020-01-02T00:00:00.000Z');
    expect(cuerpo.item.deleted_at).toBeNull();
  });

  it('ignora los campos de tiempo enviados por el cliente', async () => {
    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/x', {
        nombre: 'Biología',
        publico: false,
        created_at: '2000-01-01T00:00:00.000Z',
        updated_at: '2000-01-02T00:00:00.000Z',
        deleted_at: '2000-01-03T00:00:00.000Z',
      }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(200);
    const cuerpo = await response.json();
    expect(cuerpo.item.created_at).not.toBe('2000-01-01T00:00:00.000Z');
    expect(cuerpo.item.deleted_at).toBeNull();
  });

  it('rechaza un id que no sea UUID', async () => {
    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/x', { nombre: 'Biología', publico: false }),
      { params: Promise.resolve({ id: 'no-uuid' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Datos inválidos',
      detalles: [{ campo: 'id', mensaje: 'Debe ser un UUID' }],
    });
    expect(base.escrituras).toHaveLength(0);
  });

  it('valida los campos del mazo', async () => {
    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/x', { nombre: '', publico: 'si' }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(400);
    const cuerpo = await response.json();
    expect(cuerpo.error).toBe('Datos inválidos');
    expect(cuerpo.detalles.map((detalle: { campo: string }) => detalle.campo)).toEqual([
      'nombre',
      'publico',
    ]);
  });

  it('responde 413 cuando el documento supera 1 MiB', async () => {
    const gigante = 'x'.repeat(1024 * 1024 + 10);
    const response = await guardarMazo(
      peticionPut('http://localhost/api/mazos/x', { nombre: gigante, publico: false }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: 'El documento supera el límite de 1 MiB',
    });
  });

  it('crea una tarjeta válida en la colección del usuario', async () => {
    const response = await guardarTarjeta(
      peticionPut('http://localhost/api/tarjetas/x', {
        mazo_id: UUID_MAZO,
        pregunta: '¿Qué es una célula?',
        respuesta: 'Unidad básica de la vida',
        caja: 1,
        proxima_revision: '2026-11-15T10:00:00.000Z',
      }),
      { params: Promise.resolve({ id: UUID_TARJETA }) },
    );

    expect(response.status).toBe(200);
    const cuerpo = await response.json();
    expect(cuerpo.item).toMatchObject({
      id: UUID_TARJETA,
      pregunta: '¿Qué es una célula?',
      caja: 1,
      deleted_at: null,
    });
    expect(base.escrituras[0]).toMatchObject({
      tipo: 'set',
      ruta: `usuarios/uid-prueba/tarjeta/${UUID_TARJETA}`,
    });
  });

  it('rechaza una pregunta de más de 300 caracteres', async () => {
    const response = await guardarTarjeta(
      peticionPut('http://localhost/api/tarjetas/x', {
        mazo_id: UUID_MAZO,
        pregunta: 'x'.repeat(301),
        respuesta: 'Unidad básica de la vida',
        caja: 1,
        proxima_revision: null,
      }),
      { params: Promise.resolve({ id: UUID_TARJETA }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Datos inválidos',
      detalles: [{ campo: 'pregunta', mensaje: 'La pregunta debe tener máximo 300 caracteres' }],
    });
  });

  it('rechaza una respuesta de más de 300 caracteres', async () => {
    const response = await guardarTarjeta(
      peticionPut('http://localhost/api/tarjetas/x', {
        mazo_id: UUID_MAZO,
        pregunta: '¿Qué es una célula?',
        respuesta: 'y'.repeat(301),
        caja: 1,
        proxima_revision: null,
      }),
      { params: Promise.resolve({ id: UUID_TARJETA }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Datos inválidos',
      detalles: [{ campo: 'respuesta', mensaje: 'La respuesta debe tener máximo 300 caracteres' }],
    });
  });

  it('admite proxima_revision nula', async () => {
    const response = await guardarTarjeta(
      peticionPut('http://localhost/api/tarjetas/x', {
        mazo_id: UUID_MAZO,
        pregunta: '¿Qué es una célula?',
        respuesta: 'Unidad básica de la vida',
        caja: 1,
        proxima_revision: null,
      }),
      { params: Promise.resolve({ id: UUID_TARJETA }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ item: { proxima_revision: null } });
  });
});
