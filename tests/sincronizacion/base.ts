import { vi, type Mock } from 'vitest';

export type Campos = Record<string, unknown>;

export type Base = {
  db: unknown;
  documentos: Map<string, Campos>;
  consultas: { campo: string; operador: string; valor: unknown; limite: number }[];
  escrituras: { tipo: 'set' | 'update'; ruta: string; datos: Campos }[];
};

export type MocksSincronizacion = { verifyIdToken: Mock; getAuth: Mock; getDb: Mock };

export const EPOCH = '1970-01-01T00:00:00.000Z';

const AUTORIZACION = { authorization: 'Bearer token-prueba' };

function segmentoFinal(ruta: string): string {
  const partes = ruta.split('/');
  return partes[partes.length - 1] ?? ruta;
}

function crearBase(): Base {
  const documentos = new Map<string, Campos>();
  const consultas: Base['consultas'] = [];
  const escrituras: Base['escrituras'] = [];

  const db = {
    collection(ruta: string) {
      return {
        doc(id: string) {
          const rutaDoc = `${ruta}/${id}`;
          return {
            get: async () => {
              const datos = documentos.get(rutaDoc);
              return { id: segmentoFinal(rutaDoc), exists: datos !== undefined, data: () => datos };
            },
            set: async (datos: Campos) => {
              escrituras.push({ tipo: 'set', ruta: rutaDoc, datos });
              documentos.set(rutaDoc, datos);
            },
            update: async (parcial: Campos) => {
              escrituras.push({ tipo: 'update', ruta: rutaDoc, datos: parcial });
              documentos.set(rutaDoc, { ...(documentos.get(rutaDoc) ?? {}), ...parcial });
            },
          };
        },
        where(campo: string, operador: string, valor: unknown) {
          return {
            orderBy: (campoOrden: string) => ({
              limit: (limite: number) => ({
                get: async () => {
                  consultas.push({ campo, operador, valor, limite });
                  const docs = [...documentos.entries()]
                    .filter(([clave]) => clave.startsWith(`${ruta}/`))
                    .filter(([, datos]) => String(datos[campoOrden]) > String(valor))
                    .sort((a, b) =>
                      String(a[1][campoOrden]).localeCompare(String(b[1][campoOrden])),
                    )
                    .slice(0, limite)
                    .map(([clave, datos]) => ({ id: segmentoFinal(clave), data: () => datos }));
                  return { docs };
                },
              }),
            }),
          };
        },
      };
    },
  };

  return { db, documentos, consultas, escrituras };
}

/** Prepara una base nueva y los mocks comunes de las tres suites. */
export function preparar(mocks: MocksSincronizacion): Base {
  vi.clearAllMocks();
  const base = crearBase();
  mocks.getAuth.mockReturnValue({ verifyIdToken: mocks.verifyIdToken });
  mocks.verifyIdToken.mockResolvedValue({ uid: 'uid-prueba', email: 'ana@example.com' });
  mocks.getDb.mockImplementation(() => base.db);
  return base;
}

export function peticion(url: string): Request {
  return new Request(url, { headers: AUTORIZACION });
}

export function peticionPut(url: string, cuerpo: unknown): Request {
  return new Request(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...AUTORIZACION },
    body: JSON.stringify(cuerpo),
  });
}

export function peticionDelete(url: string): Request {
  return new Request(url, { method: 'DELETE', headers: AUTORIZACION });
}
