import { NextResponse } from 'next/server';
import { usuarioDe } from '../../../../lib/auth';
import { leerJson, responderError, validar } from '../../../../lib/http';
import { mazoSchema, validarIdRecurso } from '../../../../lib/schemas';
import { despublicar, publicar } from '../../../../lib/services/publicos';
import { borrar, guardar } from '../../../../lib/services/sincronizacion';

export const runtime = 'nodejs';

type ContextoRuta = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: ContextoRuta) {
  try {
    const usuario = await usuarioDe(request);
    const { id } = await params;
    validarIdRecurso(id);
    const campos = validar(mazoSchema, await leerJson(request));
    const item = await guardar(usuario.id, 'mazo', id, campos);
    if (campos.publico) {
      await publicar(usuario.id, id, campos.nombre);
    } else {
      await despublicar(id);
    }
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
    await borrar(usuario.id, 'mazo', id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return responderError(error);
  }
}
