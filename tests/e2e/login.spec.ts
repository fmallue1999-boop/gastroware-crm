import { test, expect } from "@playwright/test";

test("la pantalla de login carga con la marca y el formulario", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /GastroWare/ })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Contraseña")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});

test("una ruta protegida redirige a login sin sesión", async ({ page }) => {
  await page.goto("/hoy");
  await expect(page).toHaveURL(/\/login/);
});
