import { noEncontrado } from '../errors';
import { getDb } from '../firebase';
import { creadoEn, LIMITE_PAGINA } from './sincronizacion';

export const COLECCION_PUBLICOS = 'mazos_publicos';

type CopiaTarjeta = { pregunta: unknown; respuesta: unknown };

function colecciónDe(db: ReturnType<typeof getDb>, mazoId: string) {
  return db.collection(COLECCION_PUBLICOS).doc(mazoId);
}

/** Lista los mazos publicados (máximo 500). */
export async function listarPublicos() {
  const consulta = await getDb()
    .collection(COLECCION_PUBLICOS)
    .orderBy('updated_at')
    .limit(LIMITE_PAGINA)
    .get();
  const items = consulta.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return { items };
}

/** Publica (o república) el mazo: metadatos + copia de las tarjetas activas. */
export async function publicar(uid: string, mazoId: string, nombre: string): Promise<void> {
  const db = getDb();
  const tarjetas = await db
    .collection(`usuarios/${uid}/tarjeta`)
    .where('mazo_id', '==', mazoId)
    .orderBy('updated_at')
    .limit(LIMITE_PAGINA)
    .get();
  const activas = tarjetas.docs.filter((doc) => !doc.data().deleted_at);
  const publico = colecciónDe(db, mazoId);
  const copia = publico.collection('tarjeta');
  const previas = await copia.orderBy('updated_at').limit(LIMITE_PAGINA).get();
  const ahora = new Date().toISOString();

  const borrado = db.batch();
  previas.docs.forEach((doc) => borrado.delete(copia.doc(doc.id)));
  await borrado.commit();

  const escritura = db.batch();
  activas.forEach((doc) => {
    const campos = doc.data();
    escritura.set(copia.doc(doc.id), {
      pregunta: campos.pregunta,
      respuesta: campos.respuesta,
      created_at: ahora,
      updated_at: ahora,
      deleted_at: null,
    });
  });
  await escritura.commit();

  await publico.set({
    autor_uid: uid,
    nombre,
    total_tarjetas: activas.length,
    created_at: ahora,
    updated_at: ahora,
    deleted_at: null,
  });
}

/** Retira el mazo publicado y todas sus copias de tarjetas. */
export async function despublicar(mazoId: string): Promise<void> {
  const db = getDb();
  const publico = colecciónDe(db, mazoId);
  const existe = await publico.get();
  if (!existe.exists) {
    return;
  }
  const copia = publico.collection('tarjeta');
  const previas = await copia.orderBy('updated_at').limit(LIMITE_PAGINA).get();
  const lote = db.batch();
  previas.docs.forEach((doc) => lote.delete(copia.doc(doc.id)));
  await lote.commit();
  await publico.delete();
}

/** Sincroniza una tarjeta con la copia publicada de su mazo, si existe. */
export async function refrescarTarjetaPublica(
  mazoId: string,
  tarjetaId: string,
  campos: CopiaTarjeta,
): Promise<void> {
  const publico = colecciónDe(getDb(), mazoId);
  const meta = await publico.get();
  if (!meta.exists) {
    return;
  }
  const copia = publico.collection('tarjeta').doc(tarjetaId);
  const previa = await copia.get();
  const ahora = new Date().toISOString();
  await copia.set({
    pregunta: campos.pregunta,
    respuesta: campos.respuesta,
    created_at: creadoEn(previa, ahora),
    updated_at: ahora,
    deleted_at: null,
  });
  if (!previa.exists) {
    await publico.update({ total_tarjetas: totalPublico(meta.data()) + 1, updated_at: ahora });
  }
}

/** Retira la copia publicada de una tarjeta borrada y ajusta el total. */
export async function retirarTarjetaPublica(mazoId: string, tarjetaId: string): Promise<void> {
  const publico = colecciónDe(getDb(), mazoId);
  const meta = await publico.get();
  if (!meta.exists) {
    return;
  }
  const copia = publico.collection('tarjeta').doc(tarjetaId);
  const previa = await copia.get();
  if (!previa.exists) {
    return;
  }
  await copia.delete();
  const total = Math.max(0, totalPublico(meta.data()) - 1);
  await publico.update({ total_tarjetas: total, updated_at: new Date().toISOString() });
}

/** Copia un mazo público al árbol del usuario con UUIDs nuevas. */
export async function copiarMazoPublico(uid: string, mazoId: string) {
  const db = getDb();
  const publico = colecciónDe(db, mazoId);
  const meta = await publico.get();
  if (!meta.exists) {
    throw noEncontrado('Mazo público no encontrado');
  }
  const datos = meta.data() ?? {};
  const tarjetas = await publico
    .collection('tarjeta')
    .orderBy('updated_at')
    .limit(LIMITE_PAGINA)
    .get();
  const ahora = new Date().toISOString();
  const nuevoId = crypto.randomUUID();
  const mazo = {
    nombre: typeof datos.nombre === 'string' ? datos.nombre : 'Mazo copiado',
    publico: false,
    created_at: ahora,
    updated_at: ahora,
    deleted_at: null,
  };
  await db.collection(`usuarios/${uid}/mazo`).doc(nuevoId).set(mazo);

  const lote = db.batch();
  tarjetas.docs.forEach((doc) => {
    const campos = doc.data();
    lote.set(db.collection(`usuarios/${uid}/tarjeta`).doc(crypto.randomUUID()), {
      mazo_id: nuevoId,
      pregunta: campos.pregunta,
      respuesta: campos.respuesta,
      caja: 1,
      proxima_revision: null,
      created_at: ahora,
      updated_at: ahora,
      deleted_at: null,
    });
  });
  await lote.commit();
  return { id: nuevoId, ...mazo };
}

function totalPublico(datos: Record<string, unknown> | undefined): number {
  const total = datos?.total_tarjetas;
  return typeof total === 'number' ? total : 0;
}
