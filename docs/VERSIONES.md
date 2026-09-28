# Versiones de GastroWare OS

Desde el 27 de septiembre de 2026 cada actualización que se publica es una
versión numerada. La versión actual se ve en la barra lateral, en Más y en el
ingreso; la lista de cambios, en la pantalla **Novedades** (`/novedades`).

## Cómo se numera: X.Y.Z

| Cambio | Ejemplo | Cuándo |
|---|---|---|
| Z | 1.0.0 → 1.0.1 | Arreglos, sin cambios en la forma de usarlo. |
| Y | 1.0.1 → 1.1.0 | Funciones nuevas o cambios que el equipo nota. |
| X | 1.4.0 → 2.0.0 | Cambios grandes en la forma de trabajar. |

## Qué se hace en cada actualización

1. Trabajar en una rama (`vX.Y.Z` o el nombre de la función).
2. Sumar la versión nueva arriba de todo en `lib/novedades.ts` (fecha, título
   y cambios contados en palabras del equipo) y subir `version` en
   `package.json`. El test `tests/unit/version.test.ts` falla si no coinciden.
3. Anotar la versión en `CHANGELOG.md`.
4. Tipos, lint, tests y build en verde.
5. Si hay migración, aplicarla en producción antes de publicar.
6. Merge a `main`, tag `vX.Y.Z` y push (`git push origin main --tags`).
7. Al entrar, cada persona ve el aviso "GastroWare OS se actualizó" en Mi día.
