import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { hoyISO } from "@/lib/format";
import { ESTADOS_REPUESTO, type EstadoRepuesto } from "@/lib/repuestos";
import { cargarSolicitudes, type SolicitudVista } from "@/lib/servidor/repuestos";
import TarjetaRepuesto from "@/components/repuestos/TarjetaRepuesto";
import AyudaLink from "@/components/guia/AyudaLink";

export const metadata = { title: "Repuestos" };

type Params = { ver?: string; quien?: string };

/**
 * Repuestos: solicitudes por estado (validación técnica, para cotizar,
 * cotización enviada, esperando confirmación) y las ganadas y perdidas.
 * Servicio técnico ve primero lo que tiene para validar.
 */
export default async function RepuestosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { data: rolData },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc("fn_rol")]);
  const yo = user?.id ?? "";
  const rol = (rolData as string) ?? "comercial";
  const puedeValidar = ["tecnico", "servicio", "direccion", "admin"].includes(rol);
  const hoy = hoyISO();
  const ver = ["curso", "validar", "ganadas", "perdidas"].includes(p.ver ?? "") ? p.ver! : rol === "tecnico" ? "validar" : "curso";
  const soloMias = p.quien === "mias";

  const [todas, { data: catalogo }, { data: personas }] = await Promise.all([
    cargarSolicitudes(supabase),
    supabase.from("repuestos").select("id, descripcion, codigo_interno, stock").eq("activo", true).is("deleted_at", null).order("descripcion").limit(1000),
    supabase.from("usuarios").select("id, nombre, rol").eq("activo", true).order("nombre"),
  ]);
  const validadores = ((personas ?? []) as { id: string; nombre: string; rol: string }[]).filter((u) => u.rol === "servicio" || u.rol === "tecnico");
  const mias = (s: SolicitudVista) => s.comercial_id === yo || s.validador_id === yo;
  const lista = soloMias ? todas.filter(mias) : todas;
  const por = (e: EstadoRepuesto) => lista.filter((s) => s.estado === e);

  const href = (c: Partial<Params>) => {
    const s = new URLSearchParams();
    const t = { ver, quien: soloMias ? "mias" : undefined, ...c };
    if (t.ver && t.ver !== "curso") s.set("ver", t.ver);
    if (t.quien) s.set("quien", t.quien);
    const q = s.toString();
    return q ? `/repuestos?${q}` : "/repuestos";
  };

  const tarjetas = (items: SolicitudVista[]) => (
    <div className="grid gap-2 lg:grid-cols-2">
      {items.map((s) => (
        <TarjetaRepuesto
          key={s.oportunidad_id}
          s={s}
          hoy={hoy}
          yo={yo}
          puedeValidar={puedeValidar}
          catalogo={(catalogo ?? []) as { id: string; descripcion: string; codigo_interno: string | null; stock: number | null }[]}
          validadores={validadores}
        />
      ))}
    </div>
  );
  const seccion = (e: EstadoRepuesto) => {
    const items = por(e);
    const info = ESTADOS_REPUESTO.find((x) => x.value === e)!;
    return (
      items.length > 0 && (
        <section key={e} className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">
            {info.label} ({items.length}) <span className="font-normal normal-case">· {info.ayuda}</span>
          </h2>
          {tarjetas(items)}
        </section>
      )
    );
  };

  const paraValidar = lista.filter((s) => s.estado === "validacion" && (s.validador_id === yo || puedeValidar));
  const enCurso = lista.filter((s) => !["ganada", "perdida"].includes(s.estado));
  const pestana = (valor: string, etiqueta: string, n?: number) => (
    <Link href={href({ ver: valor })} className={`min-h-10 rounded-xl px-3 py-2 text-[15px] font-bold ${ver === valor ? "bg-marino text-white" : "text-tinta/80 hover:bg-crema"}`}>
      {etiqueta}
      {n ? ` (${n})` : ""}
    </Link>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
            Repuestos <AyudaLink tarea="repuestos" />
          </h1>
          <p className="text-[15px] text-piedra">Solicitudes de repuestos: validación técnica, cotización, confirmación y pedido.</p>
        </div>
        {rol !== "tecnico" && (
          <Link href="/repuestos/nueva" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-marino px-4 text-[15px] font-extrabold text-white">
            <Plus className="h-5 w-5" /> Nueva solicitud
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className={`text-2xl font-extrabold ${por("validacion").length ? "text-violeta" : ""}`}>{por("validacion").length}</p>
          <p className="text-xs text-piedra">en validación técnica</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className={`text-2xl font-extrabold ${por("para_cotizar").length ? "text-ambar" : ""}`}>{por("para_cotizar").length}</p>
          <p className="text-xs text-piedra">para cotizar</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-2xl font-extrabold">{por("cotizada").length + por("esperando").length}</p>
          <p className="text-xs text-piedra">esperando al cliente</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm">
          {pestana("curso", "En curso", enCurso.length)}
          {pestana("validar", "Para validar", paraValidar.length)}
          {pestana("ganadas", "Ganadas")}
          {pestana("perdidas", "Perdidas")}
        </div>
        <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm">
          <Link href={href({ quien: undefined })} className={`min-h-10 rounded-xl px-3 py-2 text-[15px] font-bold ${!soloMias ? "bg-marino text-white" : "text-tinta/80"}`}>
            Todas
          </Link>
          <Link href={href({ quien: "mias" })} className={`min-h-10 rounded-xl px-3 py-2 text-[15px] font-bold ${soloMias ? "bg-marino text-white" : "text-tinta/80"}`}>
            Mías
          </Link>
        </div>
      </div>

      {ver === "curso" && (
        <div className="space-y-5">
          {enCurso.length === 0 && (
            <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-sm">
              <p className="text-lg font-bold">No hay solicitudes de repuestos en curso.</p>
              <p className="mt-1 text-[15px] text-piedra">Se cargan con “Nueva solicitud”, desde la ficha del cliente, un caso o un service.</p>
            </div>
          )}
          {(["validacion", "para_cotizar", "cotizada", "esperando"] as EstadoRepuesto[]).map(seccion)}
        </div>
      )}
      {ver === "validar" &&
        (paraValidar.length ? tarjetas(paraValidar) : <p className="rounded-2xl bg-white px-4 py-6 text-center text-[15px] text-piedra shadow-sm">Nada para validar.</p>)}
      {ver === "ganadas" && (por("ganada").length ? tarjetas(por("ganada").slice(0, 60)) : <p className="rounded-2xl bg-white px-4 py-6 text-center text-[15px] text-piedra shadow-sm">Todavía no hay ganadas.</p>)}
      {ver === "perdidas" && (por("perdida").length ? tarjetas(por("perdida").slice(0, 60)) : <p className="rounded-2xl bg-white px-4 py-6 text-center text-[15px] text-piedra shadow-sm">No hay perdidas.</p>)}
    </div>
  );
}
