# GastroWare OS — plan maestro

> Documento índice del plan por etapas. Las especificaciones ejecutables de
> cada etapa viven en `docs/etapas/`. Los planes anteriores (PLAN.md,
> PLAN-V2.md, IMPLEMENTATION_PLAN.md) quedaron en `docs/archive/` como
> historia: describen un sistema con cadencias automáticas y `/hoy` como
> centro, que ya no es el que está en producción.
>
> Este archivo se generó a partir de las especificaciones de Etapa 0 y 1.
> Si existe una versión más completa del plan maestro, reemplazar este
> contenido por esa versión.

## Qué es hoy el sistema (septiembre 2026)

CRM simple para el equipo de GastroWare Argentina (dirección, vendedores,
técnicos). Filosofía: cargar rápido primero, completar después; mínimos
obligatorios; sin recordatorios automáticos; todo lo que pasa con un
contacto queda en su ficha y en Movimientos.

| Pantalla | Ruta | Para qué |
|---|---|---|
| Contactos (inicio) | `/clientes` | Buscar, ver cómo contactar a cada uno, qué le interesa, último movimiento, próxima fecha |
| Ficha | `/clientes/[id]` | Anotar qué pasó, agendar volver a contactar, intereses, ventas, equipos, services, historial |
| Nuevo interés | `/alta` | Acción principal: primero qué quiere, después quién (de la base o nuevo) |
| Ventas | `/pedidos` | Vendido → Preparar → Facturar → Entregado, un botón por paso |
| Stock | `/stock` | Qué hay, qué llega y cuándo, quiénes esperan |
| Services | `/servicio` | Próximos, hechos, revisar y cobrar; cargar un service hecho en un paso |
| HOTELGA | `/hotelga` | Seguimiento de los contactos de la feria: estado, quién contactó, estrellas, asignación |
| Movimientos | `/movimientos` | Todo lo que hizo el equipo, por día |
| Más | `/mas` | Herramientas (financiación, calculadora, biblioteca, reportes, marketing, administración) |

Vocabulario de la interfaz: **contacto** (tabla `clientes`), **interés**
(`oportunidades` en etapas abiertas), **venta** (`oportunidades` ganadas con
`pedido_estado`), **seguimiento** (`tareas`). "Cliente" e "interesado" son
estados del contacto, no nombres de entidad.

## Etapas

| Etapa | Objetivo | Especificación |
|---|---|---|
| 0 — Sanear y asegurar | Sistema seguro y con cifras confiables: RLS de storage por entidad, facturación y aprobación solo para gestores, transacciones en los flujos críticos, totales por moneda, entorno documentado, CI | [`docs/etapas/ETAPA-0-sanear-y-asegurar.md`](etapas/ETAPA-0-sanear-y-asegurar.md) |
| 1 — Núcleo comercial que empuja | Que un vendedor no necesite pensar a quién llamar: seguimiento asistido con una tarea viva por contacto, cotizaciones con vencimiento, herramientas de venta a un toque | [`docs/etapas/ETAPA-1-nucleo-comercial.md`](etapas/ETAPA-1-nucleo-comercial.md) |

Reglas de trabajo por etapa: rama propia (`etapa-N`), un commit por punto,
sin funcionalidad nueva fuera de lo especificado, leer `AGENTS.md` antes de
tocar código (la versión de Next.js tiene cambios), migraciones en
`supabase/migrations/` aplicadas a mano en el SQL Editor y verificadas con
una consulta.

## Documentos de referencia

- `docs/DATA_MODEL.md` — modelo de datos.
- `docs/PERMISSIONS_MATRIX.md` — qué puede hacer cada rol.
- `docs/TARGET_ARCHITECTURE.md`, `docs/AI_AND_INTEGRATIONS.md`, `docs/FORMULARIO_WEB.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/CURRENT_STATE_AUDIT.md`.
