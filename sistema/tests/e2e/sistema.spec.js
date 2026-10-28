// Recorrido completo con los tres roles contra las bases débil (1523) y endurecida (1522).
// Requiere en .env: E2E_ADMIN_CLAVE (o ADMIN_PASSWORD en el primer arranque) y las claves E2E_CLAVE_* del laboratorio.
const { test, expect } = require('@playwright/test');

const E = process.env;
const SUFIJO = Date.now().toString(36).slice(-5);
const CLAVE_INICIAL = 'Inicial_E2E_Prueba_2026';
const CAPTURAS = 'capturas';
const ANALISTA = `analista${SUFIJO}`;
const ANALISTA2 = `segundo${SUFIJO}`;
const AUDITOR = `auditor${SUFIJO}`;
const REGISTRADO = `registro${SUFIJO}`;
const DEBIL = `Débil E2E ${SUFIJO}`;
const FUERTE = `Endurecido E2E ${SUFIJO}`;

const erroresConsola = [];
const ids = {};

test.describe.configure({ mode: 'serial' });

function vigilarConsola(page) {
  page.on('console', (m) => { if (m.type() === 'error') erroresConsola.push(`${page.url()} → ${m.text()}`); });
  page.on('pageerror', (e) => erroresConsola.push(`${page.url()} → ${e.message}`));
}

async function ingresar(page, usuario, clave) {
  await page.goto('/#/login');
  await page.getByLabel('Usuario').fill(usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

// La contraseña es definitiva: tras ingresar se llega directo al panel, sin cambio obligatorio
async function ingresarYVerPanel(page, usuario, clave) {
  await ingresar(page, usuario, clave);
  await expect(page.getByText('Panel principal')).toBeVisible();
}

async function ingresarAdmin(page) {
  await ingresarYVerPanel(page, E.ADMIN_USER || 'admin', E.E2E_ADMIN_CLAVE || E.ADMIN_PASSWORD);
}

async function api(page, metodo, ruta, datos) {
  return page.evaluate(async ({ metodo, ruta, datos }) => {
    const { csrf } = await (await fetch('/api/auth/csrf')).json();
    const r = await fetch('/api' + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: metodo === 'GET' ? undefined : JSON.stringify(datos || {}) });
    return { estado: r.status, cuerpo: await r.json().catch(() => null) };
  }, { metodo, ruta, datos });
}

async function ejecutar(page, alias, funcional) {
  await page.goto('/#/nueva');
  await page.locator('.opcion-conexion', { hasText: alias }).click();
  await page.getByLabel('Contraseña de la cuenta de auditoría').fill(E.E2E_CLAVE_ISO_AUDIT);
  if (funcional) {
    await page.getByText('Activar pruebas funcionales').click();
    await page.locator('#perfil').selectOption('laboratorio-segconf');
    await expect(page.locator('input[name="u_redaccion"]')).toHaveValue('APP_CONSULTA');
    const claves = { referencia: E.E2E_CLAVE_SEGCONF, redaccion: E.E2E_CLAVE_APP_CONSULTA, vpd: E.E2E_CLAVE_APP_SOPORTE,
      sinAcceso1: E.E2E_CLAVE_APP_REPORTES, sinAcceso2: E.E2E_CLAVE_SEGCONF_DEV, comparacion: E.E2E_CLAVE_SEGCONF_DEV };
    for (const [rol, clave] of Object.entries(claves)) await page.locator(`input[name="k_${rol}"]`).fill(clave);
  }
  await page.getByRole('button', { name: 'Ejecutar auditoría' }).click();
  await page.waitForURL(/#\/ejecucion\/\d+$/);
  const id = Number(page.url().match(/(\d+)$/)[1]);
  await expect(page.locator('.tarjeta-medidor')).toBeVisible({ timeout: 180000 });
  return id;
}

test('administrador: ingreso, alta de usuarios y registro de auditoría', async ({ page }) => {
  vigilarConsola(page);
  await page.goto('/#/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/01-inicio-sesion.png` });
  // error claro con credenciales incorrectas
  await ingresar(page, 'usuario-que-no-existe', 'clave-incorrecta-1234');
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.');

  await ingresarAdmin(page);
  for (const [usuario, rol] of [[ANALISTA, 'analista'], [ANALISTA2, 'analista'], [AUDITOR, 'auditor']]) {
    await page.goto('/#/usuarios');
    await page.locator('#form-usuario input[name="usuario"]').fill(usuario);
    await page.locator('#form-usuario input[name="nombre"]').fill(`Persona ${usuario}`);
    await page.locator(`#form-usuario input[name="rol"][value="${rol}"]`).check();
    await page.locator('#form-usuario input[name="clave"]').fill(CLAVE_INICIAL);
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    await expect(page.getByRole('cell', { name: new RegExp(usuario) })).toBeVisible();
  }
  await page.screenshot({ path: `${CAPTURAS}/09-usuarios.png`, fullPage: true });
});

test('analista: registra conexiones y ejecuta contra las dos bases', async ({ page }) => {
  vigilarConsola(page);
  await ingresarYVerPanel(page, ANALISTA, CLAVE_INICIAL);
  for (const [alias, puerto] of [[DEBIL, 1523], [FUERTE, 1522]]) {
    await page.goto('/#/conexiones');
    const f = page.locator('#form-conexion');
    await f.locator('input[name="alias"]').fill(alias);
    await f.locator('input[name="host"]').fill('host.docker.internal');
    await f.locator('input[name="puerto"]').fill(String(puerto));
    await f.locator('input[name="servicio"]').fill('FREEPDB1');
    await f.locator('input[name="usuario"]').fill('ISO_AUDIT');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.locator('.conexion-tarjeta', { hasText: alias })).toBeVisible();
  }
  // Probar conexión muestra versión, PDB y cifrado
  await page.locator('.conexion-tarjeta', { hasText: FUERTE }).getByRole('button', { name: 'Probar conexión' }).click();
  await page.getByLabel('Contraseña de la base').fill(E.E2E_CLAVE_ISO_AUDIT);
  await page.locator('dialog').getByRole('button', { name: 'Probar conexión' }).click();
  await expect(page.locator('dialog').getByText('Cifrado AES256')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${CAPTURAS}/03-probar-conexion.png` });
  await page.locator('dialog [data-cerrar]').click();

  ids.debil = await ejecutar(page, DEBIL, true);
  const tilesDebil = page.locator('.tile-nocumple strong');
  expect(Number(await tilesDebil.textContent())).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.tile-cumple strong')).toHaveText('0');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${CAPTURAS}/04-resultados-debil.png`, fullPage: true });
  await page.locator('.prioridades').scrollIntoViewIfNeeded();
  await page.locator('.prioridades').screenshot({ path: `${CAPTURAS}/06-prioridades-debil.png` });
  // detalle de un control con el panel de terminal
  await page.locator('.matriz [data-control="A8.12"]').click();
  const dialogo = page.locator('dialog');
  await expect(dialogo.locator('.terminal').first()).toContainText('UTL_FILE');
  await expect(dialogo.getByText('Por qué no cumple').first()).toBeVisible();
  await dialogo.screenshot({ path: `${CAPTURAS}/05-control-terminal.png` });
  await dialogo.locator('[data-cerrar]').click();

  ids.fuerte1 = await ejecutar(page, FUERTE, true);
  expect(Number(await page.locator('.tile-cumple strong').textContent())).toBeGreaterThanOrEqual(10);
  await expect(page.locator('.tile-nocumple strong')).toHaveText('0');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${CAPTURAS}/07-resultados-endurecido.png`, fullPage: true });
  await page.locator('.matriz [data-control="A8.20"]').click();
  await expect(page.locator('dialog .terminal')).toContainText('AES256 Encryption service adapter');
  await page.locator('dialog').screenshot({ path: `${CAPTURAS}/05b-control-cifrado-red.png` });
  await page.locator('dialog [data-cerrar]').click();

  // segunda ejecución sin pruebas funcionales para comparar
  ids.fuerte2 = await ejecutar(page, FUERTE, false);
  await expect(page.locator('.tile-omitida strong')).toHaveText('1'); // A8.33 solo tiene prueba funcional
  await page.goto(`/#/historial`);
  await page.locator(`.sel[value="${ids.fuerte1}"]`).check();
  await page.locator(`.sel[value="${ids.fuerte2}"]`).check();
  await page.screenshot({ path: `${CAPTURAS}/08-historial.png`, fullPage: true });
  await page.getByRole('button', { name: 'Comparar seleccionadas' }).click();
  await expect(page.getByRole('heading', { name: 'Antes y después' })).toBeVisible();
  await expect(page.getByText('Control por control')).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/08b-comparacion.png`, fullPage: true });

  // informe imprimible
  await page.goto(`/#/informe/${ids.debil}`);
  await expect(page.getByRole('heading', { name: 'Informe de auditoría de controles' })).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/11-informe.png` });
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: `${CAPTURAS}/11b-informe-impresion.png` });
  await page.emulateMedia({ media: 'screen' });
});

test('analista: no ve ejecuciones ajenas', async ({ page }) => {
  vigilarConsola(page);
  await ingresarYVerPanel(page, ANALISTA2, CLAVE_INICIAL);
  await page.goto('/#/historial');
  await expect(page.getByText('No hay ejecuciones con esos filtros.')).toBeVisible();
  const r = await api(page, 'GET', `/ejecuciones/${ids.debil}`);
  expect(r.estado).toBe(403);
  await page.goto(`/#/ejecucion/${ids.debil}`);
  await expect(page.getByText('Solo puede ver sus propias ejecuciones.')).toBeVisible();
  erroresConsola.splice(0); // el 403 anterior es esperado
});

test('auditor: solo lectura, ve todo y verifica el registro de auditoría', async ({ page }) => {
  vigilarConsola(page);
  await ingresarYVerPanel(page, AUDITOR, CLAVE_INICIAL);
  await expect(page.getByRole('link', { name: 'Nueva ejecución' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  const r = await api(page, 'POST', '/ejecuciones', { conexionId: 1, clave: 'x' });
  expect(r.estado).toBe(403);
  await page.goto('/#/historial');
  await expect(page.locator(`.sel[value="${ids.debil}"]`)).toHaveCount(1);
  await page.goto(`/#/ejecucion/${ids.debil}`);
  await expect(page.locator('.tarjeta-medidor')).toBeVisible();
  await page.goto('/#/auditoria');
  await expect(page.getByRole('heading', { name: 'Cadena de hashes íntegra' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'EJECUCION_FIN' }).first()).toBeVisible();
  await page.screenshot({ path: `${CAPTURAS}/10-registro-auditoria.png` });
  erroresConsola.splice(0); // el 403 de la llamada directa es esperado
  await page.goto('/#/');
  await page.screenshot({ path: `${CAPTURAS}/02-panel.png` });
});

test('crear cuenta desde el inicio de sesión y mostrar la contraseña con el ojo', async ({ page }) => {
  vigilarConsola(page);
  await page.goto('/#/login');
  // el ojo muestra y oculta lo que se escribe
  const clave = page.getByLabel('Contraseña', { exact: true });
  await clave.fill('texto-de-prueba');
  await expect(clave).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(clave).toHaveAttribute('type', 'text');
  await page.screenshot({ path: `${CAPTURAS}/01b-inicio-sesion-ojo.png` });
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
  await expect(clave).toHaveAttribute('type', 'password');

  await page.getByRole('link', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
  await page.getByLabel('Nombre completo').fill('Persona Registrada');
  await page.getByLabel('Usuario').fill(REGISTRADO);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE_INICIAL);
  await page.getByLabel('Repita la contraseña').fill(CLAVE_INICIAL);
  await page.screenshot({ path: `${CAPTURAS}/01c-crear-cuenta.png` });
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  // entra directo al panel como analista, sin cambiar la contraseña
  await expect(page.getByText('Panel principal')).toBeVisible();
  await expect(page.getByText(`${REGISTRADO} · Analista`)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await ingresarYVerPanel(page, REGISTRADO, CLAVE_INICIAL);
});

test('vista en celular', async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-CR' });
  const page = await contexto.newPage();
  vigilarConsola(page);
  await page.goto('/#/login');
  await page.screenshot({ path: `${CAPTURAS}/12-celular-inicio.png` });
  await ingresar(page, ANALISTA, CLAVE_INICIAL);
  await expect(page.getByText('Panel principal')).toBeVisible();
  await page.goto(`/#/ejecucion/${ids.debil}`);
  await expect(page.locator('.tarjeta-medidor')).toBeVisible();
  // sin desplazamiento horizontal de la página
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(392);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${CAPTURAS}/13-celular-resultados.png` });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.screenshot({ path: `${CAPTURAS}/14-celular-menu.png` });
  await contexto.close();
});

test('sin errores de consola', () => {
  expect(erroresConsola).toEqual([]);
});
