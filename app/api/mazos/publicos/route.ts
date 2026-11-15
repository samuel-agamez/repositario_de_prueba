import { NextResponse } from 'next/server';
import { usuarioDe } from '../../../../lib/auth';
import { responderError } from '../../../../lib/http';
import { listarPublicos } from '../../../../lib/services/publicos';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await usuarioDe(request);
    const publicos = await listarPublicos();
    return NextResponse.json(publicos);
  } catch (error) {
    return responderError(error);
  }
}
