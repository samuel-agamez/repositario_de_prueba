import { describe, expect, it } from 'vitest';
import { GET as salud } from '../app/api/salud/route';
import { GET as health } from '../app/api/health/route';

describe('GET /api/salud', () => {
  it('responde ok con el nombre del servicio', async () => {
    const response = await salud();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, servicio: 'tarjetas-api' });
  });
});

describe('GET /api/health', () => {
  it('es un alias de la ruta de salud', async () => {
    const response = await health();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, servicio: 'tarjetas-api' });
  });
});
