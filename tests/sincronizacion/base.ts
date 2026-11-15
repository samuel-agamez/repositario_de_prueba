import { vi, type Mock } from 'vitest';

export type Campos = Record<string, unknown>;

export type Consulta = { campo: string; operador: string; valor: unknown; limite: number };

export type Escritura = {
  tipo: 'set' | 'update' | 'delete' | 'batch-set' | 'batch-delete';
  ruta: string;
  datos: Campos;
};

export type Base = {
  db: unknown;
  documentos: Map<string, Campos>;
  consultas: Consulta[];
  escrituras: Escritura[];
};

export type MocksSincronizacion = { verifyIdToken: Mock; getAuth: Mock; getDb: Mock };

type Almacen = Omit<Base, 'db'>;
type Filtro = { campo: string; operador: string; valor: unknown };

export const EPOCH = '1970-01-01T00:00:00.000Z';

const AUTORIZACION = { authorization: 'Bearer token-prueba' };

function segmentoFinal(ruta: string): string {
  const partes = ruta.split('/');
  return partes[partes.length - 1] ?? ruta;
}

function documento(rutaDoc: string, almacen: Almacen) {
  const { documentos, escrituras } = almacen;
  return {
    __ruta: rutaDoc,
    collection: (sub: string) => coleccion(`${rutaDoc}/${sub}`, almacen),
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
    delete: async () => {
      escrituras.push({ tipo: 'delete', ruta: rutaDoc, datos: {} });
      documentos.delete(rutaDoc);
    },
  };
}

function lote(almacen: Almacen) {
  const operaciones: { ruta: string; datos: Campos | null }[] = [];
  return {
    set: (ref: { __ruta: string }, datos: Campos) => {
      operaciones.push({ ruta: ref.__ruta, datos });
    },
    delete: (ref: { __ruta: string }) => {
      operaciones.push({ ruta: ref.__ruta, datos: null });
    },
    commit: async () => {
      for (const op of operaciones) {
        if (op.datos === null) {
          almacen.escrituras.push({ tipo: 'batch-delete', ruta: op.ruta, datos: {} });
          almacen.documentos.delete(op.ruta);
        } else {
          almacen.escrituras.push({ tipo: 'batch-set', ruta: op.ruta, datos: op.datos });
          almacen.documentos.set(op.ruta, op.datos);
        }
      }
    },
  };
}

function coleccion(ruta: string, almacen: Almacen) {
  function consulta(filtro: Filtro | null) {
    return {
      orderBy: (campoOrden: string) => ({
        limit: (limite: number) => ({
          get: async () => {
            if (filtro) {
              almacen.consultas.push({
                campo: filtro.campo,
                operador: filtro.operador,
                valor: filtro.valor,
                limite,
              });
            }
            const docs = [...almacen.documentos.entries()]
              .filter(([clave]) => clave.startsWith(`${ruta}/`))
              .filter(([, datos]) => coincide(datos, filtro, campoOrden))
              .sort((a, b) => String(a[1][campoOrden]).localeCompare(String(b[1][campoOrden])))
              .slice(0, limite)
              .map(([clave, datos]) => ({ id: segmentoFinal(clave), data: () => datos }));
            return { docs };
          },
        }),
      }),
    };
  }

  return {
    doc: (id: string) => documento(`${ruta}/${id}`, almacen),
    where: (campo: string, operador: string, valor: unknown) =>
      consulta({ campo, operador, valor }),
    orderBy: (campoOrden: string) => consulta(null).orderBy(campoOrden),
  };
}

function coincide(datos: Campos, filtro: Filtro | null, campoOrden: string): boolean {
  if (!filtro) {
    return true;
  }
  if (filtro.operador === '==') {
    return datos[filtro.campo] === filtro.valor;
  }
  return String(datos[campoOrden]) > String(filtro.valor);
}

function crearBase(): Base {
  const almacen: Almacen = { documentos: new Map(), consultas: [], escrituras: [] };
  const db = {
    collection: (ruta: string) => coleccion(ruta, almacen),
    batch: () => lote(almacen),
  };
  return { db, ...almacen };
}

/** Prepara una base nueva y los mocks comunes de las suites. */
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

export function peticionPost(url: string): Request {
  return new Request(url, { method: 'POST', headers: AUTORIZACION });
}

export function peticionDelete(url: string): Request {
  return new Request(url, { method: 'DELETE', headers: AUTORIZACION });
}
