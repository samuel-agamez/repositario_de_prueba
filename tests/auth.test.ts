import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'content-type': 'application/json' },
  });
}

function peticionJson(cuerpo: unknown, url = 'http://localhost/api/auth'): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('FIREBASE_WEB_API_KEY', 'web-key-prueba');
  mocks.getAuth.mockReturnValue({ verifyIdToken: mocks.verifyIdToken });
});

describe('POST /api/auth/registro', () => {
  it('registra al usuario y devuelve la sesión', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson({
        idToken: 'token-registro',
        refreshToken: 'refresh-registro',
        expiresIn: 3600,
        localId: 'uid-registro',
        email: 'ana@example.com',
      }),
    );

    const response = await registrar(
      peticionJson({ email: 'ana@example.com', password: 'ClaveSegura123' }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      token: 'token-registro',
      refreshToken: 'refresh-registro',
      expiraEnSeg: 3600,
      usuario: { id: 'uid-registro', email: 'ana@example.com' },
    });

    const llamada = fetchMock.mock.calls[0];
    expect(llamada).toBeDefined();
    const [url, opciones] = llamada!;
    expect(String(url)).toContain('accounts:signUp');
    expect(String(url)).toContain('key=web-key-prueba');
    expect(JSON.parse(String(opciones?.body))).toEqual({
      email: 'ana@example.com',
      password: 'ClaveSegura123',
      returnSecureToken: true,
    });
  });

  it('rechaza datos inválidos sin llamar a Firebase', async () => {
    const response = await registrar(peticionJson({ email: 'no-es-correo', password: '123' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Datos inválidos',
      detalles: [
        { campo: 'email', mensaje: 'Debe ser un correo electrónico válido' },
        { campo: 'password', mensaje: 'Debe tener al menos 6 caracteres' },
      ],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve conflicto cuando el correo ya existe', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson({ error: { message: 'EMAIL_EXISTS : ya existe' } }, 400),
    );

    const response = await registrar(
      peticionJson({ email: 'ana@example.com', password: 'ClaveSegura123' }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'El correo ya está registrado' });
  });
});

describe('POST /api/auth/login', () => {
  it('inicia sesión y devuelve la sesión', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson({
        idToken: 'token-login',
        refreshToken: 'refresh-login',
        expiresIn: '3600',
        localId: 'uid-login',
        email: 'ana@example.com',
      }),
    );

    const response = await iniciarSesion(
      peticionJson({ email: 'ana@example.com', password: 'ClaveSegura123' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: 'token-login',
      refreshToken: 'refresh-login',
      expiraEnSeg: 3600,
      usuario: { id: 'uid-login', email: 'ana@example.com' },
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('accounts:signInWithPassword');
  });

  it('oculta el detalle de Firebase cuando las credenciales no coinciden', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson({ error: { code: 'INVALID_LOGIN_CREDENTIALS' } }, 400),
    );

    const response = await iniciarSesion(
      peticionJson({ email: 'ana@example.com', password: 'ClaveIncorrecta123' }),
    );

    expect(response.status).toBe(401);
    const cuerpo = await response.json();
    expect(cuerpo).toEqual({ error: 'Credenciales inválidas' });
    expect(JSON.stringify(cuerpo)).not.toContain('INVALID_LOGIN_CREDENTIALS');
  });
});

describe('POST /api/auth/refresh', () => {
  it('renueva el token', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson({
        user_id: 'uid-refresh',
        id_token: 'token-refresh',
        refresh_token: 'refresh-nuevo',
        expires_in: '3600',
      }),
    );

    const response = await renovar(peticionJson({ refreshToken: 'refresh-antiguo' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      token: 'token-refresh',
      refreshToken: 'refresh-nuevo',
      expiraEnSeg: 3600,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('securetoken.googleapis.com');
  });

  it('devuelve 401 cuando el refresh token no es válido', async () => {
    fetchMock.mockResolvedValueOnce(
      respuestaJson({ error: 'invalid_grant', error_description: 'TOKEN_EXPIRED' }, 400),
    );

    const response = await renovar(peticionJson({ refreshToken: 'refresh-invalido' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Token de actualización inválido' });
  });
});

describe('GET /api/auth/yo', () => {
  it('devuelve el usuario del token verificado e ignora cualquier uid externo', async () => {
    mocks.verifyIdToken.mockResolvedValueOnce({
      uid: 'uid-verificado',
      email: 'ana@example.com',
    });

    const response = await yo(
      new Request('http://localhost/api/auth/yo?uid=uid-ajeno', {
        headers: { authorization: 'Bearer token-verificado' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      usuario: { id: 'uid-verificado', email: 'ana@example.com' },
    });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith('token-verificado');
  });

  it('exige un encabezado Bearer', async () => {
    const response = await yo(new Request('http://localhost/api/auth/yo'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Token de acceso requerido' });
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it('rechaza un token que Firebase no puede verificar', async () => {
    mocks.verifyIdToken.mockRejectedValueOnce({ code: 'invalid-id-token' });

    const response = await yo(
      new Request('http://localhost/api/auth/yo', {
        headers: { authorization: 'Bearer token-invalido' },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Token de acceso inválido' });
  });
});
