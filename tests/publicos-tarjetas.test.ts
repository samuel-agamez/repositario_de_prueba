import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as borrarTarjeta, PUT as guardarTarjeta } from '../app/api/tarjetas/[id]/route';
import { preparar, peticionDelete, peticionPut, type Base } from './sincronizacion/base';

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
const RUTA_PUBLICA = `mazos_publicos/${UUID_MAZO}`;

const TARJETA = {
  mazo_id: UUID_MAZO,
  pregunta: '¿Qué es una célula?',
  respuesta: 'Unidad básica de la vida',
  caja: 1,
  proxima_revision: null,
};

function sembrarMazoPublico(total: number): void {
  base.documentos.set(RUTA_PUBLICA, {
    autor_uid: 'uid-prueba',
    nombre: 'Biología',
    total_tarjetas: total,
    created_at: '2026-11-14T09:00:00.000Z',
    updated_at: '2026-11-14T10:00:00.000Z',
    deleted_at: null,
  });
}

function sembrarUsuario(): void {
  base.documentos.set(`usuarios/uid-prueba/tarjeta/${UUID_TARJETA}`, {
    ...TARJETA,
    created_at: '2026-11-14T09:00:00.000Z',
    updated_at: '2026-11-14T10:00:00.000Z',
    deleted_at: null,
  });
}

let base: Base;

beforeEach(() => {
  base = preparar(mocks);
});

describe('tarjetas de un mazo publicado', () => {
  it('crea la copia y suma el total al guardar', async () => {
    sembrarMazoPublico(1);

    const response = await guardarTarjeta(peticionPut('http://localhost/api/tarjetas/x', TARJETA), {
      params: Promise.resolve({ id: UUID_TARJETA }),
    });

    expect(response.status).toBe(200);
    expect(base.documentos.get(`${RUTA_PUBLICA}/tarjeta/${UUID_TARJETA}`)).toMatchObject({
      pregunta: TARJETA.pregunta,
      respuesta: TARJETA.respuesta,
      deleted_at: null,
    });
    expect(base.documentos.get(RUTA_PUBLICA)?.total_tarjetas).toBe(2);
  });

  it('actualiza la copia sin duplicar el total si ya existía', async () => {
    sembrarMazoPublico(1);
    base.documentos.set(`${RUTA_PUBLICA}/tarjeta/${UUID_TARJETA}`, {
      pregunta: 'Vieja',
      respuesta: 'Vieja',
      created_at: '2026-11-14T08:00:00.000Z',
      updated_at: '2026-11-14T08:00:00.000Z',
      deleted_at: null,
    });

    const response = await guardarTarjeta(peticionPut('http://localhost/api/tarjetas/x', TARJETA), {
      params: Promise.resolve({ id: UUID_TARJETA }),
    });

    expect(response.status).toBe(200);
    expect(base.documentos.get(`${RUTA_PUBLICA}/tarjeta/${UUID_TARJETA}`)).toMatchObject({
      pregunta: TARJETA.pregunta,
      created_at: '2026-11-14T08:00:00.000Z',
    });
    expect(base.documentos.get(RUTA_PUBLICA)?.total_tarjetas).toBe(1);
  });

  it('retira la copia y resta el total al borrar', async () => {
    sembrarMazoPublico(1);
    sembrarUsuario();
    base.documentos.set(`${RUTA_PUBLICA}/tarjeta/${UUID_TARJETA}`, {
      pregunta: TARJETA.pregunta,
      respuesta: TARJETA.respuesta,
      created_at: '2026-11-14T08:00:00.000Z',
      updated_at: '2026-11-14T08:00:00.000Z',
      deleted_at: null,
    });

    const response = await borrarTarjeta(peticionDelete('http://localhost/api/tarjetas/x'), {
      params: Promise.resolve({ id: UUID_TARJETA }),
    });

    expect(response.status).toBe(200);
    expect(base.documentos.has(`${RUTA_PUBLICA}/tarjeta/${UUID_TARJETA}`)).toBe(false);
    expect(base.documentos.get(RUTA_PUBLICA)?.total_tarjetas).toBe(0);
  });

  it('no deja el total por debajo de cero', async () => {
    sembrarMazoPublico(0);
    sembrarUsuario();
    base.documentos.set(`${RUTA_PUBLICA}/tarjeta/${UUID_TARJETA}`, {
      pregunta: TARJETA.pregunta,
      respuesta: TARJETA.respuesta,
      created_at: '2026-11-14T08:00:00.000Z',
      updated_at: '2026-11-14T08:00:00.000Z',
      deleted_at: null,
    });

    const response = await borrarTarjeta(peticionDelete('http://localhost/api/tarjetas/x'), {
      params: Promise.resolve({ id: UUID_TARJETA }),
    });

    expect(response.status).toBe(200);
    expect(base.documentos.get(RUTA_PUBLICA)?.total_tarjetas).toBe(0);
  });
});

describe('tarjetas de un mazo no publicado', () => {
  it('no escribe en mazos_publicos al guardar', async () => {
    const response = await guardarTarjeta(peticionPut('http://localhost/api/tarjetas/x', TARJETA), {
      params: Promise.resolve({ id: UUID_TARJETA }),
    });

    expect(response.status).toBe(200);
    expect(base.escrituras.some((escritura) => escritura.ruta.startsWith('mazos_publicos'))).toBe(
      false,
    );
  });

  it('no escribe en mazos_publicos al borrar', async () => {
    sembrarUsuario();

    const response = await borrarTarjeta(peticionDelete('http://localhost/api/tarjetas/x'), {
      params: Promise.resolve({ id: UUID_TARJETA }),
    });

    expect(response.status).toBe(200);
    expect(base.escrituras.some((escritura) => escritura.ruta.startsWith('mazos_publicos'))).toBe(
      false,
    );
  });
});
