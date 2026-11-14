import { describe, expect, it } from 'vitest';
import { GET } from '../app/api/salud/route';

describe('GET /api/salud', () => {
  it('responde ok con el nombre del servicio', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, servicio: 'tarjetas-api' });
  });
});
