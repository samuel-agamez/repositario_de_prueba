import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as registrar } from '../app/api/auth/registro/route';
import { POST as iniciarSesion } from '../app/api/auth/login/route';
import { POST as renovar } from '../app/api/auth/refresh/route';
import { GET as yo } from '../app/api/auth/yo/route';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: mocks.getAuth,
}));

vi.mock('../lib/firebase', () => ({
  getFirebaseApp: vi.fn(() => ({ name: 'firebase-prueba' })),
}));

const fetchMock = vi.fn<typeof fetch>();
const credenciales = { email: 'ana@example.com', password: 'ClaveSegura123' };

function peticionJson(cuerpo: unknown): Request {
  return new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('FIREBASE_WEB_API_KEY', 'web-key-prueba');
  mocks.getAuth.mockReturnValue({ verifyIdToken: mocks.verifyIdToken });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('errores de Firebase Auth', () => {
  it('devuelve 400 cuando Firebase rechaza la contraseña', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson({ error: { message: 'WEAK_PASSWORD : contraseña débil' } }, 400),
    );

    const response = await registrar(peticionJson(credenciales));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Datos inválidos',
      detalles: [{ campo: 'password', mensaje: 'La contraseña no cumple la política' }],
    });
  });

  it('devuelve 400 cuando Firebase rechaza el correo', async () => {
    fetchMock.mockResolvedValueOnce(respuestaJson({ error: { message: 'INVALID_EMAIL' } }, 400));

    const response = await registrar(peticionJson(credenciales));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Datos inválidos',
      detalles: [{ campo: 'email', mensaje: 'Debe ser un correo electrónico válido' }],
    });
  });

  it('oculta errores desconocidos de las tres operaciones', async () => {
    const casos = [
      { ruta: registrar, cuerpo: credenciales },
      { ruta: iniciarSesion, cuerpo: credenciales },
      { ruta: renovar, cuerpo: { refreshToken: 'refresh-prueba' } },
    ];

    for (const { ruta, cuerpo } of casos) {
      fetchMock.mockResolvedValueOnce(
        respuestaJson({ error: { message: 'UNKNOWN_UPSTREAM' } }, 500),
      );
      const response = await ruta(peticionJson(cuerpo));
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: 'Error interno' });
    }
  });

  it('devuelve 500 si falta la clave web de Firebase', async () => {
    vi.stubEnv('FIREBASE_WEB_API_KEY', '');

    const response = await registrar(peticionJson(credenciales));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Error interno' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve 500 si no puede contactar Firebase', async () => {
    fetchMock.mockRejectedValueOnce(new Error('detalle interno de red'));

    const response = await iniciarSesion(peticionJson(credenciales));

    expect(response.status).toBe(500);
    const cuerpo = await response.json();
    expect(cuerpo).toEqual({ error: 'Error interno' });
    expect(JSON.stringify(cuerpo)).not.toContain('detalle interno');
  });

  it('devuelve 500 si Firebase responde con un cuerpo no JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('no-json', { status: 502 }));

    const response = await registrar(peticionJson(credenciales));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Error interno' });
  });

  it('devuelve 500 si una respuesta exitosa tiene una forma inesperada', async () => {
    fetchMock.mockResolvedValueOnce(respuestaJson({ idToken: 'token-incompleto' }));

    const response = await registrar(peticionJson(credenciales));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Error interno' });
  });
});

describe('errores de entrada y token', () => {
  it('devuelve 400 si el cuerpo de entrada no es JSON', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'no-json',
    });

    const response = await registrar(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Cuerpo JSON inválido' });
  });

  it('rechaza un encabezado que no sea Bearer', async () => {
    const response = await yo(
      new Request('http://localhost/api/auth/yo', {
        headers: { authorization: 'Basic credencial' },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Token de acceso inválido' });
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it('rechaza un token expirado', async () => {
    mocks.verifyIdToken.mockRejectedValueOnce({ code: 'id-token-expired' });

    const response = await yo(
      new Request('http://localhost/api/auth/yo', {
        headers: { authorization: 'Bearer token-expirado' },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Token de acceso inválido' });
  });

  it('admite un token válido sin correo', async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({ uid: 'uid-sin-correo' });

    const response = await yo(
      new Request('http://localhost/api/auth/yo', {
        headers: { authorization: 'Bearer token-valido' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      usuario: { id: 'uid-sin-correo', email: null },
    });
  });
});
