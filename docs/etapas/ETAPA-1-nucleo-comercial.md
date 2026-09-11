# Etapa 1 — Núcleo comercial que empuja

> Especificación para ejecutar en Claude Code sobre `gastroware-crm`, después de terminar la Etapa 0.
> Contexto: este documento, `docs/PLAN-OS.md` y `ETAPA-0`. Rama `etapa-1`. Un commit por punto.
> Antes de escribir código, leer `AGENTS.md`, `lib/constants.ts`, `lib/actions.ts` (secciones de tareas, oportunidades y cotizaciones), `app/(app)/clientes/page.tsx`, `app/(app)/clientes/[id]/page.tsx`, `app/(app)/oportunidades/[id]/page.tsx` y los componentes `InteresNuevoForm`, `InteresControl`, `EtapaControl`, `AnotarContacto`, `SeguimientoItem`, `TareaItem`, `PosponerPanel`, `CotizacionForm`, `VentaPaso`.

## Objetivo

Que un vendedor abra la app y no necesite pensar a quién llamar. Que no exista ningún interés abierto sin fecha. Que una cotización enviada tenga seguimiento sin que nadie lo cargue. Que las mejores herramientas de venta estén a un toque desde la ficha.

## Vocabulario (aplica a toda la interfaz)

| Se dice | No se dice más | Tabla |
|---|---|---|
| Contacto | cliente / lead / prospecto (como sustantivo en UI) | `clientes` |
| Interés | oportunidad / consulta | `oportunidades` (etapas abiertas) |
| Venta | pedido | `oportunidades` (etapa `ganada`, con `pedido_estado`) |
| Seguimiento | tarea | `tareas` |

"Cliente" e "interesado" se mantienen como **estado** del contacto (chip), no como nombre de la entidad.

---

## 1.1 Motor de seguimiento asistido

### Regla central: una tarea automática viva por contacto

Crear en `lib/seguimiento.ts` (funciones puras, testeables) y en `lib/actions/seguimiento.ts` (server actions):

```ts
// lib/seguimiento.ts
export type Disparador =
  | { tipo: "interes_nuevo"; temperatura: "caliente" | "tibio" | "frio" }
  | { tipo: "seguimiento_cerrado"; resultado: "hablamos" | "no_atendio" | "quedo_en_avisar" | "le_mande_info" }
  | { tipo: "cotizacion_enviada"; vigenciaDias: number | null }
  | { tipo: "cotizacion_por_vencer" }
  | { tipo: "perdida"; motivo: string }
  | { tipo: "entregado"; tieneConsumible: boolean };

export type Propuesta = { dias: number; titulo: string; tipo: TareaTipo; prioridad: "alta" | "normal" | "baja" } | null;

export function proponerSiguiente(d: Disparador): Propuesta
```

Tabla de propuestas (implementar exactamente así; los textos van en `lib/constants.ts` como `PROPUESTAS_SEGUIMIENTO`):

| Disparador | Días | Título | Tipo | Prioridad |
|---|---|---|---|---|
| interés nuevo, caliente | 1 | Volver a contactar | seguimiento | alta |
| interés nuevo, tibio | 3 | Volver a contactar | seguimiento | normal |
| interés nuevo, frío | 14 | Volver a contactar | seguimiento | baja |
| cerrado: no atendió | 1 | Volver a llamar (no atendió) | seguimiento | alta |
| cerrado: quedó en avisar | 7 | Preguntar si decidió | seguimiento | normal |
| cerrado: le mandé info | 3 | Preguntar qué le pareció | seguimiento | normal |
| cerrado: hablamos | *pide fecha* (chips 1/3/7/14/30, preseleccionado 7) | Próximo contacto | seguimiento | normal |
| cotización enviada | 3 | Seguir la cotización N° X | seguimiento | alta |
| cotización por vencer | vigencia − 2 | Vence la cotización N° X | seguimiento | alta |
| perdida, motivo "más adelante" | 45 | Reactivar: dijo más adelante | reactivacion | baja |
| perdida, motivo "precio" | 90 | Reactivar: precio | reactivacion | baja |
| perdida, otros motivos | — | ninguna | — | — |
| entregado | 7 | Preguntar cómo anda el equipo | postventa | normal |
| entregado con consumible | (ya lo hace `recurrencias`) | — | recompra | normal |

Server action `agendarPropuesta({ clienteId, oportunidadId?, propuesta, confirmadaPor })`:

1. Cancela (`cancelada = true`) cualquier tarea `auto = true` pendiente del mismo `cliente_id`. **Una sola automática viva por contacto.**
2. Inserta la nueva con `auto = true`, `usuario_id` = comercial responsable de la oportunidad (o del cliente), `vence_el = hoy + dias`, `prioridad`.
3. Registra actividad "Se agendó: {titulo} para {fecha}".

La UI siempre muestra la propuesta como chip preseleccionado y el usuario confirma con un toque (o cambia la fecha, o elige "Sin fecha por ahora", que deja el interés marcado en ámbar). Nunca se agenda sin que el usuario vea la propuesta, salvo "cotización por vencer" y "recompra", que son de sistema.

### Dónde se dispara

| Pantalla / acción | Cambio |
|---|---|
| `InteresNuevoForm` → `crearInteres` | Al elegir nivel de interés, el chip de fecha se preselecciona según la tabla. Al guardar, llama `agendarPropuesta`. |
| `SeguimientoItem` → `cerrarSeguimiento` | Al elegir resultado, aparece la propuesta con chip preseleccionado y botón "Listo". No se cierra la tarea sin pasar por esa pantalla (salvo "Sin fecha por ahora"). |
| `CotizacionForm` → `registrarCotizacion` | Al guardar: propuesta a 3 días (confirmable) + tarea de sistema "por vencer" si hay `vigencia_dias`. |
| `EtapaControl` "No se dio" → `cambiarEtapa("perdida")` | Según motivo, propuesta de reactivación (confirmable). |
| `VentaPaso` "Entregado" → `avanzarPedido` | Propuesta postventa a 7 días (confirmable). |
| `PosponerPanel` | Se mantiene; posponer nunca crea una segunda tarea. |

### Corregir la invisibilidad de las automáticas

- `app/(app)/clientes/page.tsx` líneas ~86 y ~218: quitar `.eq("auto", false)`.
- `app/api/cron/resumen/route.ts` línea ~47: quitar `.eq("auto", false)`.
- El push matutino incluye recompras, garantías y leads web. Ordenar por `prioridad` y `vence_el`.

---

## 1.2 Inicio del vendedor (`/`)

Nueva página `app/(app)/page.tsx` (hoy redirige a `/clientes`). Para rol `comercial`; para `direccion`/`admin` se mantiene la redirección a `/clientes` hasta la Etapa 2; para `tecnico`, a `/servicio`.

Estructura (Server Component, una sola consulta por bloque, todo filtrado por `usuario_id = yo` salvo donde se indica):

1. **Encabezado**: "Hola, {nombre}" + fecha. Botón **+ Interés** fijo (ya existe como FAB).
2. **Vencidos** (rojo): tareas pendientes con `vence_el < hoy`, ordenadas por más atrasada primero. Cada fila: nombre del contacto, título de la tarea, "hace N días", botones WhatsApp / Llamar / Hecho / Posponer. Si no hay: no se muestra el bloque.
3. **Hoy**: `vence_el = hoy`, ordenadas por prioridad.
4. **Sin responder** (ámbar): oportunidades con `origen in ('Web','Feria','WhatsApp')`, `etapa = 'nueva'`, sin ninguna actividad del vendedor, asignadas a mí, creadas hace más de 2 horas. Muestra "hace N horas". Acción: Abrir / WhatsApp.
5. **Cotizaciones por vencer**: versiones con `created_at + vigencia_dias` entre hoy y hoy+2, de mis oportunidades abiertas. Acción: Abrir / Reenviar por WhatsApp.
6. **Sin próxima acción** (ámbar): mis oportunidades en etapa abierta que no tienen ninguna tarea pendiente. Acción: Abrir → la ficha abre con el panel de propuesta.
7. **Próximos 7 días** plegado.

Reglas:
- Cada bloque muestra el conteo en el título ("Vencidos · 4").
- Si todos los bloques 2 a 6 están vacíos: mensaje "Al día. Nada pendiente para hoy." y el bloque de próximos 7 días abierto.
- Chip "Ver de todo el equipo" solo para gestores (Etapa 2).
- Reutilizar `TareaItem`, `SeguimientoItem`, `PosponerPanel` y `linkWhatsApp`. No crear componentes nuevos si uno existente sirve.
- `BottomNav`: primer ítem pasa a ser "Inicio" (`/`), luego Contactos, +Interés, Ventas, Más. `Sidebar` igual.

---

## 1.3 Una sola ficha de venta

Objetivo: todo lo que hoy vive en `app/(app)/oportunidades/[id]/page.tsx` pasa a la ficha del contacto, dentro de cada interés.

En `app/(app)/clientes/[id]/page.tsx`, sección "Le interesa": cada interés abierto se expande (acordeón, uno abierto a la vez, el más reciente por defecto) y muestra pestañas:

| Pestaña | Contenido (mover, no reescribir) |
|---|---|
| Situación | etapa, temperatura, días sin movimiento, próxima tarea, "Sin próxima acción" en ámbar con botón "Agendar" que abre la propuesta |
| Cotizar | `CotizacionForm` + lista de versiones con "Enviar por WhatsApp" y "Ver hoja" |
| Guiones | `AccionAhora`, `PlantillaCopiar`, `ObjecionControl` |
| Diagnóstico | `DiagnosticoForm` + `CalculadoraZumex` (solo si el producto es Zumex) |
| Material | `MaterialItem` del producto |
| IA | `IAMensaje`, `IAResumenCliente` |

Cambios asociados:
- `/oportunidades/[id]` redirige (301) a `/clientes/[cliente_id]?interes=[id]` y se elimina su contenido.
- `/buscar` se elimina; el buscador global (`BuscadorGlobal`) vive en el encabezado de Contactos y en el Sidebar.
- `/hoy` se elimina (Etapa 0 ya corrigió el manifest).
- `pipeline` se mantiene como "Ventas por etapa" dentro de Más, con las tarjetas linkeando a la ficha del contacto con el interés abierto.
- Todo texto de UI que diga "oportunidad" o "consulta" pasa a "interés"; "pedido" pasa a "venta". Buscar con grep en `app/` y `components/`.

Cierre con confirmación: al marcar "Me compró", mostrar un panel de resultado (no solo refresh): "Venta registrada · Equipo {modelo} N° {serie} · Garantía hasta {fecha} · Primera recompra de {consumible} el {fecha}" con botón "Ver venta" que lleva a `/pedidos`.

---

## 1.4 Cotización viva

### Base (migración `026_cotizacion_viva.sql`)

```sql
alter table cotizacion_versiones
  add column if not exists token_publico text unique default encode(gen_random_bytes(18), 'base64url'),
  add column if not exists enviada_at timestamptz,
  add column if not exists enviada_via text check (enviada_via in ('whatsapp','email','impresa')),
  add column if not exists abierta_at timestamptz,
  add column if not exists aperturas int not null default 0;
```

### Página pública `app/c/[token]/page.tsx`

- Sin login (agregar `c/` al `matcher` de exclusión en `proxy.ts`).
- Consulta con service role por `token_publico`; si no existe, 404.
- Renderiza la misma hoja que `app/cotizacion/[id]/page.tsx` (extraer el componente de hoja a `components/HojaCotizacion.tsx` y usarlo en ambas).
- Al cargar, incrementa `aperturas` y setea `abierta_at` si es null (RPC `fn_registrar_apertura(token)` security definer, que solo toca esas dos columnas).
- Sin botones de edición; botón "Descargar PDF" (print) y "Responder por WhatsApp" con el número del vendedor (`usuarios.telefono`; agregar la columna si no existe).

### Enviar por WhatsApp

En la lista de versiones (pestaña Cotizar) y en el bloque "Cotizaciones por vencer" del inicio: botón que abre `linkWhatsApp(cliente.telefono, texto)` con:

```
Hola {nombre}, te paso la cotización N° {numero} de {producto}: {NEXT_PUBLIC_APP_URL}/c/{token}
Válida hasta el {fecha}. Cualquier duda me decís. {vendedor}
```

Al tocar, server action `marcarEnviada(versionId, "whatsapp")` → setea `enviada_at`, `enviada_via`, registra actividad "Cotización N° X enviada por WhatsApp" y dispara la propuesta de seguimiento a 3 días si no existe una viva.

En la ficha, cada versión muestra: "Enviada {fecha} · Abierta {fecha} ({n} veces)" o "No abierta todavía" en gris.

### Recotizar sin retroceder

`registrarCotizacion`: si la etapa es `ganada`, crear la versión y **no** cambiar etapa ni `pedido_estado` (ya cubierto en Etapa 0; verificar).

---

## 1.5 Asignación visible

- `DatosClienteForm`: campo "Vendedor responsable" (select de usuarios con rol comercial) que ya soporta `actualizarCliente` (`comercial_id`).
- `InteresNuevoForm` y ficha del interés: mostrar y permitir cambiar `comercial_id` de la oportunidad (solo gestores o el propio responsable).
- Lista de Contactos: para gestores, selección múltiple + acción "Reasignar a…" (server action `reasignarClientes(ids[], comercialId)` que actualiza `clientes.comercial_id` y las oportunidades abiertas de esos clientes, y registra actividad en cada uno).
- Al reasignar, las tareas pendientes de esos clientes pasan al nuevo `usuario_id`.

---

## 1.6 Poda de esta etapa

- Eliminar de la UI el stock numérico manual: `StockAdmin` deja de mostrar el campo `stock` editable y `ingresos_stock`; se conserva únicamente la **lista de espera** (`etapa = 'espera'`) y su bloque en `InteresNuevoForm`. Las columnas quedan en la base hasta la Etapa 4.
- `BottomNav` del vendedor: Inicio · Contactos · +Interés · Ventas · Más. "Stock" sale del nav (la lista de espera se ve desde Contactos, chip "Lista de espera").
- Mover a "Más herramientas": HOTELGA, Financiación, Calculadora, Biblioteca, Instalaciones.

---

## 1.7 Partir `lib/actions.ts`

Antes de tocar lógica, partir el archivo por sus separadores `// ====` en:

```
lib/actions/contactos.ts
lib/actions/intereses.ts      (oportunidades, etapas, cotizaciones)
lib/actions/seguimiento.ts    (tareas, propuestas, posponer)
lib/actions/ventas.ts         (pedidos)
lib/actions/servicio.ts
lib/actions/marketing.ts
lib/actions/admin.ts          (usuarios, catálogo, stock, importador)
lib/actions/index.ts          (re-exporta todo, para no romper imports)
lib/auth.ts                   (usuarioActual, rolActual, exigirGestor)
```

Cada archivo empieza con `"use server"`. Commit propio, sin cambios de lógica, verificado con `tsc`.

---

## 1.8 Tests mínimos de la etapa

- `tests/unit/seguimiento.test.ts`: `proponerSiguiente` para cada fila de la tabla 1.1 (14 casos).
- `tests/unit/dinero.test.ts`: `sumarPorMoneda` con ARS y USD mezclados.
- `tests/e2e/vendedor.spec.ts`: login como comercial → crear interés caliente → aparece en Inicio › Hoy o mañana → cerrar con "no atendió" → aparece mañana en Hoy. Requiere usuario de prueba `comercial` en el proyecto de Supabase de staging (documentar en `.env.example`: `E2E_USER`, `E2E_PASS`).

---

## Definición de terminado

- [ ] Un usuario comercial entra y ve `/` con los bloques Vencidos, Hoy, Sin responder, Por vencer, Sin próxima acción; cada fila tiene WhatsApp, Llamar, Hecho y Posponer.
- [ ] Crear un interés sin tocar la fecha deja una tarea agendada según la temperatura.
- [ ] Cerrar un seguimiento con "no atendió" crea uno para mañana sin cargar nada; nunca hay dos tareas automáticas pendientes para el mismo contacto (verificar con una consulta SQL).
- [ ] Guardar una cotización agenda seguimiento a 3 días y, si tiene vigencia, un aviso a vigencia−2.
- [ ] El link `/c/{token}` abre sin login, registra la apertura y la ficha lo muestra.
- [ ] Recompras, garantías y leads web aparecen en Inicio y en el push matutino.
- [ ] `/oportunidades/[id]` redirige a la ficha; no queda ningún texto "oportunidad" ni "consulta" en la UI.
- [ ] Un gestor reasigna tres contactos a otro vendedor desde la lista y las tareas pendientes cambian de dueño.
- [ ] Tests de 1.8 en verde en CI.
- [ ] Una semana de uso real del equipo sin volver a pedir que se apaguen las tareas automáticas. Si lo piden: revisar prioridades y textos, no apagar el motor.
