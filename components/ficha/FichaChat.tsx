import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, ChevronLeft, Mail, MessageCircle, Phone, Wrench, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { firmarUrl, firmarUrls } from "@/lib/core/storage";
import { iaConfigurada } from "@/lib/core/ia";
import { infoStockPorProducto, textoStock } from "@/lib/stock";
import {
  fechaCorta,
  haceCuanto,
  linkWhatsApp,
  dinero,
  diasDesde,
  hoyISO,
  rellenarPlantilla,
  telefonoProlijo,
} from "@/lib/format";
import { ESTADOS_OT, ETAPAS_ABIERTAS } from "@/lib/constants";
import Compositor from "@/components/ficha/Compositor";
import InteresFijado, { type Guion, type MaterialLite, type VersionCot } from "@/components/ficha/InteresFijado";
import PanelesFicha from "@/components/ficha/PanelesFicha";
import InteresAgregar from "@/components/InteresAgregar";
import AsignarVendedor from "@/components/AsignarVendedor";
import IAResumenCliente from "@/components/IAResumenCliente";
import VentaPaso, { type FacturaDatos } from "@/components/VentaPaso";
import NotaForm from "@/components/NotaForm";
import EquipoForm from "@/components/EquipoForm";
import DatosClienteForm from "@/components/DatosClienteForm";
import BorrarCliente from "@/components/BorrarCliente";
import SucursalesCliente from "@/components/SucursalesCliente";
import DocumentosEntidad from "@/components/DocumentosEntidad";
import type {
  Actividad,
  Cliente,
  Cotizacion,
  Equipo,
  Oportunidad,
  Plantilla,
  Producto,
  Recurrencia,
  Sucursal,
} from "@/lib/types";

const TIPO_OT: Record<string, string> = {
  correctivo: "Reparación",
  preventivo: "Mantenimiento",
  instalacion: "Instalación",
  garantia: "Garantía",
};

type OT = {
  id: string;
  numero: number;
  estado: string;
  tipo: string;
  equipo_id: string | null;
  fecha_programada: string | null;
  created_at: string;
  trabajo_realizado: string | null;
  cerrada_tecnico_at: string | null;
};

/** Momento actual (fuera del render: la regla de pureza de React no deja llamar a Date.now() adentro). */
const ahora = () => Date.now();

/** Qué movimientos se muestran como "del sistema" (centrados, en ámbar) y cuáles como burbuja de persona. */
const DE_PERSONA = new Set(["nota", "feria"]);

/**
 * La ficha del contacto como un chat (rediseño aprobado por Franco):
 * cabecera con WhatsApp / Llamar / Email y desplegables (Equipos, Services,
 * Cotizaciones, Datos); arriba, fijos, los intereses abiertos y las ventas
 * en curso; después todo lo que pasó, en orden; abajo, la caja para anotar.
 * Se usa como página completa (celular) y como panel al costado (PC).
 */
export default async function FichaChat({
  clienteId,
  modo = "pagina",
  interesAbierto,
  cerrarHref,
}: {
  clienteId: string;
  modo?: "pagina" | "panel";
  interesAbierto?: string | null;
  cerrarHref?: string;
}) {
  const id = clienteId;
  const hoy = hoyISO();
  const supabase = await createClient();

  const [{ data: cliente }, { data: rol }, { data: auth }] = await Promise.all([
    supabase.from("clientes").select("*, sucursales(*)").eq("id", id).maybeSingle(),
    supabase.rpc("fn_rol"),
    supabase.auth.getUser(),
  ]);
  const miId = auth?.user?.id ?? "";
  const ahoraMs = ahora();
  if (!cliente) {
    if (modo === "panel")
      return <p className="p-4 text-[15px] text-piedra">Ese contacto no está o no lo podés ver.</p>;
    notFound();
  }
  const esGestor = ["direccion", "admin"].includes((rol as string) ?? "");
  const esTecnico = rol === "tecnico";
  const { sucursales: sucursalesData, ...restoCliente } = cliente as Cliente & { sucursales?: Sucursal[] };
  const sucursales = (sucursalesData ?? []).filter(
    (s) => !("deleted_at" in s) || !(s as { deleted_at?: string | null }).deleted_at
  );
  const principal = sucursales.find((s) => s.es_principal) ?? sucursales[0];
  const c: Cliente = { ...restoCliente, ciudad: principal?.ciudad ?? null };

  const [
    equiposRes,
    recurrenciasRes,
    oportunidadesRes,
    actividadesRes,
    productosRes,
    documentosRes,
    otsRes,
    usuariosRes,
    stockInfo,
    plantillasRes,
    materialesRes,
    facturasRes,
  ] = await Promise.all([
    supabase.from("equipos").select("*, producto:productos(*)").eq("cliente_id", id).is("deleted_at", null).order("fecha_venta", { ascending: false }),
    supabase.from("recurrencias").select("*, producto:productos(*)").eq("cliente_id", id).eq("activa", true),
    supabase.from("oportunidades").select("*, producto:productos(*)").eq("cliente_id", id).order("created_at", { ascending: false }),
    supabase.from("actividades").select("*").eq("cliente_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    supabase.from("documentos").select("*").eq("entidad", "cliente").eq("entidad_id", id).order("created_at", { ascending: false }),
    supabase
      .from("ordenes_trabajo")
      .select("id, numero, estado, tipo, equipo_id, fecha_programada, created_at, trabajo_realizado, cerrada_tecnico_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("usuarios").select("id, nombre, rol, activo"),
    infoStockPorProducto(supabase),
    supabase.from("plantillas").select("*"),
    supabase.from("materiales").select("id, nombre, tipo, url, producto_id").order("nombre"),
    supabase
      .from("facturas")
      .select("id, oportunidad_id, numero, vencimiento, monto, moneda, cobro_estado, promesa_fecha, condicion_aprobada_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const equipos = (equiposRes.data ?? []) as unknown as Equipo[];
  const recurrencias = (recurrenciasRes.data ?? []) as unknown as Recurrencia[];
  const oportunidades = (oportunidadesRes.data ?? []) as unknown as Oportunidad[];
  const actividades = (actividadesRes.data ?? []) as unknown as Actividad[];
  const productos = (productosRes.data ?? []) as Producto[];
  const plantillas = (plantillasRes.data ?? []) as Plantilla[];
  const materiales = (materialesRes.data ?? []) as (MaterialLite & { producto_id: string | null })[];
  const usuarios = (usuariosRes.data ?? []) as { id: string; nombre: string; rol: string; activo: boolean }[];
  const nombres = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const vendedores = usuarios
    .filter((u) => u.activo && ["comercial", "direccion", "admin"].includes(u.rol))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const ots = (otsRes.data ?? []) as OT[];

  const abiertas = oportunidades.filter((o) => (ETAPAS_ABIERTAS as readonly string[]).includes(o.etapa));
  const ventas = oportunidades.filter((o) => o.etapa === "ganada");
  const ventasEnCurso = ventas.filter((o) => o.pedido_estado !== "entregado");
  const facturaDe = new Map<string, FacturaDatos>();
  for (const f of (facturasRes.data ?? []) as (FacturaDatos & { oportunidad_id: string | null })[])
    if (f.oportunidad_id && !facturaDe.has(f.oportunidad_id)) facturaDe.set(f.oportunidad_id, f);
  const perdidas = oportunidades.filter((o) => o.etapa === "perdida");
  const esCliente = c.estado === "cliente_activo" || ventas.length > 0 || equipos.length > 0;
  const serieFaltante = new Set(equipos.filter((e) => e.oportunidad_id && !e.numero_serie).map((e) => e.oportunidad_id));
  const nombreProductos = (o: Oportunidad) => {
    const extra = (o.productos_extra ?? [])
      .map((pid) => productos.find((p) => p.id === pid)?.nombre)
      .filter(Boolean) as string[];
    return [o.producto?.nombre, ...extra].filter(Boolean).join(", ") || o.mensaje_inicial || "Interés";
  };

  // Cotizaciones de todos los intereses (con PDF firmado si hay)
  const oppIds = oportunidades.map((o) => o.id);
  const { data: cotData } = oppIds.length
    ? await supabase.from("cotizaciones").select("*, versiones:cotizacion_versiones(*)").in("oportunidad_id", oppIds)
    : { data: [] };
  const versionesPlanas = ((cotData ?? []) as Cotizacion[])
    .flatMap((cot) => (cot.versiones ?? []).map((v) => ({ ...v, oportunidad_id: cot.oportunidad_id, numeroCot: cot.numero })))
    .sort((a, b) => (b.created_at < a.created_at ? -1 : 1));
  const urlsVersiones = await Promise.all(versionesPlanas.map((v) => firmarUrl("documentos", v.archivo_path)));
  const versionesPor = new Map<string, VersionCot[]>();
  versionesPlanas.forEach((v, i) => {
    const lista = versionesPor.get(v.oportunidad_id) ?? [];
    lista.push({
      id: v.id,
      cotizacion_id: v.cotizacion_id,
      numeroCot: v.numeroCot,
      version: v.version,
      total: v.total,
      moneda: v.moneda,
      forma_pago: v.forma_pago,
      created_at: v.created_at,
      archivoUrl: urlsVersiones[i],
    });
    versionesPor.set(v.oportunidad_id, lista);
  });

  const guionesDe = (o: Oportunidad): Guion[] => {
    const cat = o.producto?.categoria ?? "otro";
    const usos = cat === "exprimidora" ? ["diagnostico:zumex", "precio:zumex"] : cat === "licuadora" ? ["diagnostico:gx", "precio:gx"] : [];
    const vars = {
      nombre: c.nombre_comercial,
      producto: o.producto?.nombre ?? "el producto",
      monto: o.monto_estimado ? dinero(o.monto_estimado, o.moneda) : "$X",
    };
    return plantillas
      .filter((p) => usos.includes(p.uso) || p.uso === "objecion:precio")
      .map((p) => ({ id: p.id, nombre: p.nombre, texto: rellenarPlantilla(p.contenido, vars) }));
  };
  const materialesDe = (o: Oportunidad): MaterialLite[] =>
    materiales
      .filter((m) => !m.producto_id || m.producto_id === o.producto_id || (o.productos_extra ?? []).includes(m.producto_id))
      .map(({ id, nombre, tipo, url }) => ({ id, nombre, tipo, url }));

  const docs = (documentosRes.data ?? []) as { id: string; tipo: string; nombre: string; path: string; created_at: string }[];
  const urlsDocs = await firmarUrls("documentos", docs.map((d) => d.path));
  const documentos = docs.map((d, i) => ({ id: d.id, tipo: d.tipo, nombre: d.nombre, created_at: d.created_at, url: urlsDocs[i] }));

  const ultimoServicePorEquipo = new Map<string, OT>();
  for (const ot of ots) if (ot.equipo_id && !ultimoServicePorEquipo.has(ot.equipo_id)) ultimoServicePorEquipo.set(ot.equipo_id, ot);

  const atiende = c.comercial_id ? nombres.get(c.comercial_id) : null;
  const empresa =
    c.razon_social && c.razon_social.trim().toLowerCase() !== c.nombre_comercial.trim().toLowerCase() ? c.razon_social : null;
  const interesesResumen = abiertas.map((o) => ({ id: o.id, texto: nombreProductos(o) }));
  const interesPreseleccionado = abiertas.some((o) => o.id === interesAbierto) ? interesAbierto : null;

  // El chat: lo más viejo arriba, lo último cerca de la caja. Los primeros 30 a la vista.
  const cronologico = [...actividades].reverse();
  const anteriores = cronologico.length > 30 ? cronologico.slice(0, cronologico.length - 30) : [];
  const recientes = cronologico.slice(anteriores.length);
  const burbuja = (a: Actividad) => {
    const persona = DE_PERSONA.has(a.tipo);
    const quien = a.created_by ? nombres.get(a.created_by) : null;
    const cuando = `${haceCuanto(a.created_at)} · ${fechaCorta(a.created_at)}`;
    return persona ? (
      <div key={a.id} className="max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[15px] shadow-sm">
        <p className="whitespace-pre-wrap">{a.contenido}</p>
        <p className="mt-0.5 text-xs text-piedra">
          {quien ? `${quien} · ` : ""}
          {cuando}
        </p>
      </div>
    ) : (
      <div key={a.id} className="self-center rounded-2xl bg-ambar-soft px-3.5 py-1.5 text-center text-sm text-tinta/80">
        {a.contenido}
        <span className="text-piedra"> · {fechaCorta(a.created_at)}</span>
      </div>
    );
  };

  const botonContacto = "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[15px] font-bold";

  const paneles = [
    {
      key: "equipos",
      label: "Equipos",
      badge: equipos.length,
      contenido: (
        <div className="space-y-2">
          {equipos.map((e) => {
            const vigente = e.garantia_hasta && e.garantia_hasta >= hoy;
            const ultimo = ultimoServicePorEquipo.get(e.id);
            return (
              <Link key={e.id} href={`/equipos/${e.id}`} className="block text-[15px]">
                <p className="font-semibold hover:underline">
                  {e.producto?.nombre ?? e.marca_modelo_libre}
                  {e.origen === "externo" && (
                    <span className="ml-1.5 rounded-full border border-borde px-2 py-0.5 text-xs font-normal text-piedra">otra marca</span>
                  )}
                </p>
                <p className="text-xs text-piedra">
                  {e.numero_serie ? `Serie ${e.numero_serie}` : "Sin número de serie"}
                  {e.garantia_hasta && (
                    <span className={vigente ? "text-verde" : "text-piedra"}>
                      {" "}· garantía {vigente ? "vigente" : "vencida"} ({fechaCorta(e.garantia_hasta)})
                    </span>
                  )}
                  {ultimo ? ` · último service ${fechaCorta(ultimo.cerrada_tecnico_at ?? ultimo.fecha_programada ?? ultimo.created_at)}` : " · sin services"}
                </p>
              </Link>
            );
          })}
          {recurrencias.map((r) => (
            <p key={r.id} className="text-sm text-ambar">
              <Bell className="mr-1 -mt-0.5 inline h-3.5 w-3.5" />
              {r.producto?.nombre}: recompra cada {r.frecuencia_dias} días, próximo aviso {fechaCorta(r.proxima_alerta)}
              {r.ultima_compra ? ` (última hace ${diasDesde(r.ultima_compra)} días)` : ""}
            </p>
          ))}
          {equipos.length === 0 && recurrencias.length === 0 && <p className="text-[15px] text-piedra">Ningún equipo cargado todavía.</p>}
          <details className="pt-1">
            <summary className="cursor-pointer list-none text-sm text-azul underline [&::-webkit-details-marker]:hidden">+ Agregar un equipo que tiene</summary>
            <div className="mt-2">
              <EquipoForm clienteId={c.id} productos={productos} />
            </div>
          </details>
        </div>
      ),
    },
    {
      key: "services",
      label: "Services",
      badge: ots.length,
      contenido: (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {(esTecnico || esGestor) && (
              <Link href={`/servicio/cargar?cliente=${c.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-bold text-white">
                <Wrench className="h-4 w-4" /> Cargar service hecho
              </Link>
            )}
            <Link href={`/servicio/nueva?cliente=${c.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-borde bg-white px-4 text-[15px] font-bold">
              Programar service
            </Link>
          </div>
          {ots.slice(0, 10).map((o) => {
            const est = ESTADOS_OT.find((e) => e.value === o.estado);
            return (
              <Link key={o.id} href={`/servicio/${o.id}`} className="block rounded-xl bg-crema px-3 py-2.5 text-[15px]">
                <p className="font-semibold">
                  {TIPO_OT[o.tipo] ?? o.tipo}{" "}
                  <span className="font-normal text-piedra">
                    · {fechaCorta(o.cerrada_tecnico_at ?? o.fecha_programada ?? o.created_at)} · {est?.label ?? o.estado}
                  </span>
                </p>
                {o.trabajo_realizado && <p className="truncate text-xs text-piedra">{o.trabajo_realizado}</p>}
              </Link>
            );
          })}
          {ots.length === 0 && <p className="text-[15px] text-piedra">Sin services todavía.</p>}
        </div>
      ),
    },
    {
      key: "cotizaciones",
      label: "Cotizaciones",
      badge: versionesPlanas.length,
      contenido: (
        <div className="space-y-1.5">
          {versionesPlanas.map((v, i) => (
            <p key={v.id} className="text-[15px]">
              Cotización N° {v.numeroCot}
              {v.version > 1 ? ` v${v.version}` : ""} · {dinero(v.total ?? 0, v.moneda)} · {fechaCorta(v.created_at)} ·{" "}
              <Link href={`/cotizacion/${v.cotizacion_id}?v=${v.version}`} className="text-azul underline">
                Imprimir
              </Link>
              {urlsVersiones[i] && (
                <>
                  {" · "}
                  <a href={urlsVersiones[i]!} target="_blank" rel="noopener noreferrer" className="text-azul underline">
                    PDF
                  </a>
                </>
              )}
            </p>
          ))}
          {versionesPlanas.length === 0 && (
            <p className="text-[15px] text-piedra">Todavía no hay cotizaciones. Se arman desde el interés, con “Más”.</p>
          )}
        </div>
      ),
    },
    {
      key: "datos",
      label: "Datos",
      contenido: (
        <div className="space-y-3">
          <DatosClienteForm cliente={c} />
          <div className="grid gap-3 lg:grid-cols-2">
            <SucursalesCliente clienteId={c.id} sucursales={sucursales} />
            <DocumentosEntidad entidad="cliente" entidadId={c.id} documentos={documentos} puedeBorrar />
          </div>
          {perdidas.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-piedra">Intereses que no se dieron</h3>
              {perdidas.map((o) => (
                <p key={o.id} className="text-[15px] text-piedra">
                  {nombreProductos(o)} · {fechaCorta(o.closed_at ?? o.created_at)}
                  {o.motivo_perdida ? ` · ${o.motivo_perdida}` : ""}
                </p>
              ))}
            </div>
          )}
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-piedra">Nota interna</h3>
            <NotaForm clienteId={c.id} />
          </div>
          {esGestor && <BorrarCliente clienteId={c.id} nombre={c.nombre_comercial} />}
        </div>
      ),
    },
  ];

  const contenido = (
    <>
      {!esTecnico && (
        <div className="space-y-2">
          {abiertas.map((o) => (
            <InteresFijado
              key={o.id}
              interes={o}
              nombre={nombreProductos(o)}
              productos={productos}
              stockTexto={o.producto_id && stockInfo[o.producto_id] ? textoStock(stockInfo[o.producto_id], fechaCorta) : null}
              versiones={versionesPor.get(o.id) ?? []}
              guiones={guionesDe(o)}
              materiales={materialesDe(o)}
              telefono={c.telefono}
              iaOn={iaConfigurada()}
              abierta={o.id === interesAbierto}
              hoy={hoy}
              rol={(rol as string) ?? "comercial"}
              miId={miId}
              responsableNombre={o.comercial_id ? nombres.get(o.comercial_id) ?? null : null}
              ahoraMs={ahoraMs}
            />
          ))}
          {ventasEnCurso.map((o) => (
            <div key={o.id} className="rounded-2xl bg-verde-soft p-3.5">
              <p className="text-[16px] font-extrabold">Venta: {nombreProductos(o)}</p>
              <p className="mb-2 text-xs text-piedra">
                {o.monto_estimado ? `${dinero(o.monto_estimado, o.moneda)} · ` : ""}
                vendido {fechaCorta(o.closed_at ?? o.created_at)}
                {o.nro_factura ? ` · factura ${o.nro_factura}` : ""}
              </p>
              <VentaPaso
                venta={o}
                rol={(rol as string) ?? "comercial"}
                hoy={hoy}
                factura={facturaDe.get(o.id) ?? null}
                pedirSerie={serieFaltante.has(o.id)}
                videoUrl={o.producto?.video_url ?? null}
                sucursales={sucursales}
                direccionSugerida={[principal?.direccion, principal?.ciudad].filter(Boolean).join(", ")}
                compacto
              />
            </div>
          ))}
          <InteresAgregar clienteId={c.id} productos={productos} stockInfo={stockInfo} />
        </div>
      )}

      {iaConfigurada() && !esTecnico && <IAResumenCliente clienteId={c.id} />}

      <div className="flex flex-col gap-2">
        {anteriores.length > 0 && (
          <details className="group">
            <summary className="min-h-10 cursor-pointer list-none self-center text-center text-sm text-azul underline [&::-webkit-details-marker]:hidden">
              Ver los {anteriores.length} movimientos anteriores
            </summary>
            <div className="mt-2 flex flex-col gap-2">{anteriores.map(burbuja)}</div>
          </details>
        )}
        {recientes.map(burbuja)}
        {actividades.length === 0 && <p className="self-center text-[15px] text-piedra">Todavía no pasó nada. Escribí abajo qué hablaron.</p>}
        {actividades.length >= 200 && <p className="self-center text-xs text-piedra">Se muestran los últimos 200 movimientos.</p>}
      </div>
    </>
  );

  const cabecera = (
    <header className="space-y-2.5">
      <div className="flex items-start gap-2">
        {modo === "pagina" ? (
          <Link href="/clientes" aria-label="Volver" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde bg-white">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight">{c.nombre_comercial}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${esCliente ? "bg-verde-soft text-verde" : "bg-azul-soft text-azul"}`}>
              {esCliente ? "Cliente" : "Interesado"}
            </span>
          </div>
          <p className="text-sm text-piedra">
            {[empresa, c.rubro !== "Otro" ? c.rubro : null, c.ciudad, c.telefono ? telefonoProlijo(c.telefono) : null].filter(Boolean).join(" · ") ||
              "Sin más datos por ahora"}
          </p>
          <div className="mt-0.5">
            {esGestor ? (
              <AsignarVendedor clienteId={c.id} actual={c.comercial_id} vendedores={vendedores} />
            ) : atiende ? (
              <p className="text-sm text-piedra">Lo atiende {atiende}</p>
            ) : null}
          </div>
        </div>
        {modo === "panel" && cerrarHref ? (
          <Link href={cerrarHref} scroll={false} aria-label="Cerrar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-borde bg-white">
            <X className="h-5 w-5" />
          </Link>
        ) : null}
      </div>
      {c.notas && <p className="text-[15px] text-tinta/70">{c.notas}</p>}
      <div className="flex gap-2">
        {c.telefono ? (
          <>
            <a href={linkWhatsApp(c.telefono)} target="_blank" rel="noopener noreferrer" className={`${botonContacto} bg-verde text-white`}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            <a href={`tel:${c.telefono}`} className={`${botonContacto} border border-borde bg-white`}>
              <Phone className="h-4 w-4" /> Llamar
            </a>
          </>
        ) : (
          <p className="flex-1 text-[15px] text-ambar">Sin teléfono: cargalo en Datos.</p>
        )}
        {c.email ? (
          <a href={`mailto:${c.email}`} className={`${botonContacto} border border-borde bg-white`}>
            <Mail className="h-4 w-4" /> Email
          </a>
        ) : null}
      </div>
      <PanelesFicha paneles={paneles} />
    </header>
  );

  const compositor = (
    <Compositor clienteId={c.id} intereses={interesesResumen} oportunidadId={interesPreseleccionado} />
  );

  if (modo === "panel") {
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-borde bg-white px-4 py-3">{cabecera}</div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">{contenido}</div>
        <div className="shrink-0 border-t border-borde bg-white px-4 py-3">{compositor}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {cabecera}
      {contenido}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-borde bg-crema/95 px-4 py-2.5 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-2xl lg:border">
        {compositor}
      </div>
    </div>
  );
}
