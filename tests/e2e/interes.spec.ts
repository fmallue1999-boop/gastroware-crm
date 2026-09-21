import { test, expect, type Page } from "@playwright/test";

/**
 * Flujo crítico: un comercial carga un interés por un producto sin stock para
 * alguien que no está en la base y lo pone en lista de espera; un gestor
 * carga un ingreso previsto de ese producto y toca "Llegó"; el interés
 * aparece en Hoy del comercial con "Llegó stock".
 *
 * Necesita usuarios reales (no se crean solos):
 *   E2E_EMAIL / E2E_PASSWORD               → usuario con rol comercial
 *   E2E_GESTOR_EMAIL / E2E_GESTOR_PASSWORD → usuario dirección/administración
 * y al menos un producto activo sin stock. Deja un contacto de prueba
 * ("E2E Prueba <fecha>") que conviene borrar después desde Administración.
 */
const comercial = { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD };
const gestor = { email: process.env.E2E_GESTOR_EMAIL, password: process.env.E2E_GESTOR_PASSWORD };

async function entrar(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
}

test.describe("interés sin stock → lista de espera → llegó stock", () => {
  test.skip(!comercial.email || !comercial.password, "Definí E2E_EMAIL y E2E_PASSWORD para correrlo");

  test("una pantalla, contacto creado y asignado, y el aviso al llegar el stock", async ({ page, browser }) => {
    test.setTimeout(120_000);
    await entrar(page, comercial.email!, comercial.password!);

    await page.goto("/alta");
    const producto = page.getByRole("button", { name: /Sin stock/ }).first();
    await expect(producto).toBeVisible();
    const nombreProducto = (await producto.locator("span span").first().textContent())?.trim() ?? "";
    await producto.click();
    await page.getByRole("button", { name: "Muy interesado" }).click();

    const nombre = `E2E Prueba ${Date.now()}`;
    await page.getByRole("button", { name: /Es alguien nuevo, cargarlo/ }).click();
    await page.getByPlaceholder("Nombre de la persona").fill(nombre);
    await page.getByPlaceholder(/Teléfono/).fill(`11 4${String(Date.now()).slice(-7)}`);
    await page.getByRole("button", { name: /Poner en lista de espera/ }).click();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]+/, { timeout: 20_000 });
    await expect(page.getByText("Interés cargado")).toBeVisible();
    await expect(page.getByText("Lista de espera").first()).toBeVisible();

    test.skip(!gestor.email || !gestor.password, "Sin E2E_GESTOR_EMAIL / E2E_GESTOR_PASSWORD no se prueba Llegó");
    const contexto = await browser.newContext();
    const admin = await contexto.newPage();
    await entrar(admin, gestor.email!, gestor.password!);
    await admin.goto("/stock");
    const fila = admin.locator("div.border-b", { hasText: nombreProducto }).first();
    await fila.getByRole("button", { name: /Cargar ingreso previsto/ }).click();
    await fila.getByPlaceholder("Cant.").fill("1");
    await fila.getByRole("button", { name: "Guardar" }).click();
    await fila.getByRole("button", { name: "Llegó" }).first().click();
    await expect(fila.getByRole("button", { name: "Llegó" })).toHaveCount(0, { timeout: 20_000 });
    await contexto.close();

    await page.goto("/hoy");
    await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Llegó stock").first()).toBeVisible();
  });
});
