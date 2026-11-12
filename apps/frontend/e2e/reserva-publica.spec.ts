import { expect, test } from '@playwright/test';
import { hoyEnZonaNegocio } from '../src/lib/fecha-negocio';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3000';

interface RespuestaRegistro {
  usuario: { idUsuario: string; idNegocio: string };
  tokens: { accessToken: string };
}

interface Reserva {
  cliente?: { correoElectronico: string };
  estado: string;
}

/**
 * E2E completo del wizard de reserva pública (punto 6/19 del brief):
 * un visitante SIN sesión completa las 4 etapas contra el frontend y el
 * backend reales (nunca mocks), y al final se verifica contra la propia
 * API que la reserva quedó persistida de verdad — no solo que la
 * pantalla mostró "confirmada".
 *
 * El negocio/servicio/disponibilidad se crean vía API al vuelo (no
 * dependen de datos de seed compartidos como el negocio demo) para que
 * el test sea repetible y aislado en cualquier corrida. La
 * disponibilidad cubre de 00:00 a 23:00 los 7 días de la semana, y el
 * wizard se lleva a la fecha de MAÑANA (en la zona del negocio): así el
 * test no depende de la hora en que corre. Con la fecha de hoy fallaba
 * entre las 22:30 y la medianoche de Costa Rica, porque `listarHorarios`
 * excluye los horarios ya pasados del día actual y no quedaba ninguno.
 */
test('un visitante sin sesión completa el wizard y la reserva queda creada de verdad en el backend', async ({
  page,
  request,
}) => {
  const sufijo = Date.now();
  const correoAdmin = `e2e-admin-${sufijo}@example.com`;
  const correoNegocio = `e2e-negocio-${sufijo}@example.com`;
  const correoCliente = `e2e-cliente-${sufijo}@example.com`;

  const registro = await request.post(`${API_URL}/auth/registro`, {
    data: {
      nombreNegocio: `Negocio E2E ${sufijo}`,
      tipoNegocio: 'barberia',
      correoNegocio,
      nombreCompletoAdmin: 'Admin E2E',
      correoAdmin,
      contrasena: 'Turnify-Pruebas-2026!',
    },
  });
  expect(registro.ok(), `registro falló: ${await registro.text()}`).toBeTruthy();
  const { usuario, tokens }: RespuestaRegistro = await registro.json();
  const headers = { Authorization: `Bearer ${tokens.accessToken}` };

  const servicioResp = await request.post(`${API_URL}/servicios`, {
    headers,
    data: { nombre: 'Corte E2E', duracionMinutos: 30, precio: 5000 },
  });
  expect(servicioResp.ok(), `crear servicio falló: ${await servicioResp.text()}`).toBeTruthy();

  for (let diaSemana = 0; diaSemana <= 6; diaSemana++) {
    const disponibilidadResp = await request.post(`${API_URL}/disponibilidad`, {
      headers,
      data: { idUsuario: usuario.idUsuario, diaSemana, horaInicio: '00:00', horaFin: '23:00' },
    });
    expect(
      disponibilidadResp.ok(),
      `crear disponibilidad (día ${diaSemana}) falló: ${await disponibilidadResp.text()}`,
    ).toBeTruthy();
  }

  await page.goto(`/reservar/${usuario.idNegocio}`);
  await expect(page.getByRole('heading', { name: /Reservar en/ })).toBeVisible();

  // Paso 1: elegir servicio
  await page.getByRole('button', { name: /Corte E2E/ }).click();

  // Paso 2: elegir el primer horario disponible
  await expect(page.getByText(/Elige un horario/)).toBeVisible();
  // Costa Rica no tiene horario de verano: sumar 24 h da siempre el día siguiente.
  const manana = hoyEnZonaNegocio(new Date(Date.now() + 24 * 60 * 60 * 1000));
  await page.getByLabel('Fecha').fill(manana);
  const primerHorario = page.getByRole('button', { name: /^\d{1,2}:\d{2}/ }).first();
  await expect(primerHorario).toBeVisible({ timeout: 10_000 });
  await primerHorario.click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 3: datos del cliente
  await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible();
  await page.getByLabel('Nombre completo').fill('Cliente Prueba Playwright');
  await page.getByLabel('Correo electrónico').fill(correoCliente);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 4: confirmar
  await expect(page.getByRole('heading', { name: 'Confirma tu reserva' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();
  await expect(page.getByText('¡Reserva confirmada!')).toBeVisible({ timeout: 10_000 });

  // Verificación real: la reserva existe de verdad en el backend, no solo la pantalla de éxito.
  const reservasResp = await request.get(`${API_URL}/reservas?limit=100`, { headers });
  expect(reservasResp.ok()).toBeTruthy();
  const { data: reservas }: { data: Reserva[] } = await reservasResp.json();
  const creada = reservas.find((r) => r.cliente?.correoElectronico === correoCliente);

  expect(creada, 'la reserva creada por el wizard no aparece en GET /reservas').toBeTruthy();
  expect(creada?.estado).not.toBe('cancelada');
});
