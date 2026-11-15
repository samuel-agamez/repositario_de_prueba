import { NextResponse } from 'next/server';
import { tokenBearer, verificarToken } from '../../../../lib/auth';
import { responderError } from '../../../../lib/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const token = tokenBearer(request.headers.get('authorization'));
    const usuario = await verificarToken(token);
    return NextResponse.json({ usuario });
  } catch (error) {
    return responderError(error);
  }
}
