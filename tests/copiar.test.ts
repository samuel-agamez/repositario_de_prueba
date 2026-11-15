import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as copiar } from '../app/api/mazos/[id]/copiar/route';
import { preparar, peticionPost, type Base } from './sincronizacion/base';

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
const RUTA_PUBLICA = `mazos_publicos/${UUID_MAZO}`;

function sembrarMazoPublico(): void {
  base.documentos.set(RUTA_PUBLICA, {
    autor_uid: 'otro-uid',
    nombre: 'Álgebra pública',
    total_tarjetas: 2,
    created_at: '2026-11-14T09:00:00.000Z',
    updated_at: '2026-11-14T10:00:00.000Z',
    deleted_at: null,
  });
}

function sembrarTarjetaPublica(id: string): void {
  base.documentos.set(`${RUTA_PUBLICA}/tarjeta/${id}`, {
    pregunta: `Pregunta ${id}`,
    respuesta: `Respuesta ${id}`,
    created_at: '2026-11-14T09:00:00.000Z',
    updated_at: '2026-11-14T10:00:00.000Z',
    deleted_at: null,
  });
}

let base: Base;

beforeEach(() => {
  base = preparar(mocks);
});

describe('POST /api/mazos/[id]/copiar', () => {
  it('responde 401 sin token', async () => {
    const response = await copiar(
      new Request('http://localhost/api/mazos/x/copiar', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: UUID_MAZO }) },
    );

    expect(response.status).toBe(401);
  });

  it('responde 404 si el mazo no está publicado', async () => {
    const response = await copiar(peticionPost('http://localhost/api/mazos/x/copiar'), {
      params: Promise.resolve({ id: UUID_MAZO }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Mazo público no encontrado' });
    expect(base.escrituras).toHaveLength(0);
  });

  it('copia el mazo y sus tarjetas a una nueva UUID privada', async () => {
    sembrarMazoPublico();
    sembrarTarjetaPublica('uuid-t1');
    sembrarTarjetaPublica('uuid-t2');

    const response = await copiar(peticionPost('http://localhost/api/mazos/x/copiar'), {
      params: Promise.resolve({ id: UUID_MAZO }),
    });

    expect(response.status).toBe(201);
    const cuerpo = await response.json();
    expect(cuerpo.item).toMatchObject({
      nombre: 'Álgebra pública',
      publico: false,
      deleted_at: null,
    });
    expect(cuerpo.item.id).not.toBe(UUID_MAZO);
    expect(cuerpo.item.created_at).toBe(cuerpo.item.updated_at);

    const tarjetas = [...base.documentos.entries()].filter(([ruta]) =>
      ruta.startsWith('usuarios/uid-prueba/tarjeta/'),
    );
    expect(tarjetas).toHaveLength(2);
    for (const [, datos] of tarjetas) {
      expect(datos).toMatchObject({
        mazo_id: cuerpo.item.id,
        caja: 1,
        proxima_revision: null,
        deleted_at: null,
      });
    }
    expect(base.escrituras.filter((escritura) => escritura.tipo === 'batch-set')).toHaveLength(2);
    expect(base.documentos.has(RUTA_PUBLICA)).toBe(true);
  });

  it('copia un mazo público sin tarjetas', async () => {
    sembrarMazoPublico();

    const response = await copiar(peticionPost('http://localhost/api/mazos/x/copiar'), {
      params: Promise.resolve({ id: UUID_MAZO }),
    });

    expect(response.status).toBe(201);
    const cuerpo = await response.json();
    expect(base.documentos.has(`usuarios/uid-prueba/mazo/${cuerpo.item.id}`)).toBe(true);
    expect(base.escrituras.filter((escritura) => escritura.tipo === 'batch-set')).toHaveLength(0);
  });
});
