import { NextResponse } from 'next/server';
import { usuarioDe } from '../../../../../lib/auth';
import { responderError } from '../../../../../lib/http';
import { validarIdRecurso } from '../../../../../lib/schemas';
import { copiarMazoPublico } from '../../../../../lib/services/publicos';

export const runtime = 'nodejs';

type ContextoRuta = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: ContextoRuta) {
  try {
    const usuario = await usuarioDe(request);
    const { id } = await params;
    validarIdRecurso(id);
    const item = await copiarMazoPublico(usuario.id, id);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return responderError(error);
  }
}
