import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { ApiError, noEncontrado } from '../errors';
import { getDb } from '../firebase';
import type { MazoCampos, TarjetaCampos } from '../schemas';

export const LIMITE_PAGINA = 500;
const LIMITE_DOCUMENTO_BYTES = 1024 * 1024;

export type ColeccionUsuario = 'mazo' | 'tarjeta';

type CamposGuardables = MazoCampos | TarjetaCampos;

const MENSAJES_NO_ENCONTRADO: Record<ColeccionUsuario, string> = {
  mazo: 'Mazo no encontrado',
  tarjeta: 'Tarjeta no encontrada',
};

function ruta(uid: string, coleccion: ColeccionUsuario): string {
  return `usuarios/${uid}/${coleccion}`;
}

function creadoEn(actual: DocumentSnapshot, ahora: string): string {
  const guardado = actual.exists ? actual.data() : undefined;
  return typeof guardado?.created_at === 'string' ? guardado.created_at : ahora;
}

function exigirLimiteDeDocumento(documento: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify(documento), 'utf8');
  if (bytes > LIMITE_DOCUMENTO_BYTES) {
    throw new ApiError(413, 'El documento supera el límite de 1 MiB');
  }
}

/** Devuelve los ítems con `updated_at` posterior a `since`, sin filtrar borrados. */
export async function listarDesde(uid: string, coleccion: ColeccionUsuario, since: string) {
  const consulta = await getDb()
    .collection(ruta(uid, coleccion))
    .where('updated_at', '>', since)
    .orderBy('updated_at')
    .limit(LIMITE_PAGINA)
    .get();
  const items = consulta.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { items, servidor_ahora: new Date().toISOString() };
}

/** PUT idempotente: crea o reemplaza; los tiempos siempre los pone el servidor. */
export async function guardar(
  uid: string,
  coleccion: ColeccionUsuario,
  id: string,
  campos: CamposGuardables,
) {
  const ref = getDb().collection(ruta(uid, coleccion)).doc(id);
  const actual = await ref.get();
  const ahora = new Date().toISOString();
  const documento = {
    ...campos,
    created_at: creadoEn(actual, ahora),
    updated_at: ahora,
    deleted_at: null,
  };
  exigirLimiteDeDocumento(documento);
  await ref.set(documento);
  return { id, ...documento };
}

/** DELETE con borrado lógico; no repite la escritura si ya estaba borrado. */
export async function borrar(uid: string, coleccion: ColeccionUsuario, id: string): Promise<void> {
  const ref = getDb().collection(ruta(uid, coleccion)).doc(id);
  const actual = await ref.get();
  if (!actual.exists) {
    throw noEncontrado(MENSAJES_NO_ENCONTRADO[coleccion]);
  }
  if (actual.data()?.deleted_at) {
    return;
  }
  const ahora = new Date().toISOString();
  await ref.update({ deleted_at: ahora, updated_at: ahora });
}
