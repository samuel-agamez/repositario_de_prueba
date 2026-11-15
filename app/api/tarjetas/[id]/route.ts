import { NextResponse } from 'next/server';
import { usuarioDe } from '../../../../lib/auth';
import { leerJson, responderError, validar } from '../../../../lib/http';
import { tarjetaSchema, validarIdRecurso } from '../../../../lib/schemas';
import { refrescarTarjetaPublica, retirarTarjetaPublica } from '../../../../lib/services/publicos';
import { borrar, guardar } from '../../../../lib/services/sincronizacion';

export const runtime = 'nodejs';

type ContextoRuta = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: ContextoRuta) {
  try {
    const usuario = await usuarioDe(request);
    const { id } = await params;
    validarIdRecurso(id);
    const campos = validar(tarjetaSchema, await leerJson(request));
    const item = await guardar(usuario.id, 'tarjeta', id, campos);
    await refrescarTarjetaPublica(campos.mazo_id, id, campos);
    return NextResponse.json({ item });
  } catch (error) {
    return responderError(error);
  }
}

export async function DELETE(request: Request, { params }: ContextoRuta) {
  try {
    const usuario = await usuarioDe(request);
    const { id } = await params;
    validarIdRecurso(id);
    const datos = await borrar(usuario.id, 'tarjeta', id);
    if (typeof datos.mazo_id === 'string') {
      await retirarTarjetaPublica(datos.mazo_id, id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return responderError(error);
  }
}
