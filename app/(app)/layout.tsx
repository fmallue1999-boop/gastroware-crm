import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient, supabaseConfigurado } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { hoyISO } from "@/lib/format";
import { filtroQuien } from "@/lib/quien";
import BottomNav from "@/components/BottomNav";
import BotonFlotante from "@/components/BotonFlotante";
import TecladoAbierto from "@/components/TecladoAbierto";
import AvisoVersion from "@/components/AvisoVersion";
import { VERSIONES } from "@/lib/novedades";
import Rail from "@/components/Rail";
import EstiloMarca from "@/components/marca/EstiloMarca";
import LogoSistema from "@/components/marca/LogoSistema";
import { cargarMarca } from "@/lib/servidor/marca";
import { contarAgendaHoy } from "@/lib/servidor/agenda";
import { mandarAvisosPendientes } from "@/lib/servidor/push";
import { after } from "next/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigurado()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: yo }, notifRes, marca] = await Promise.all([
    supabase.from("usuarios").select("rol, nombre, ve_contenidos").eq("id", user.id).single(),
    supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .is("leida_at", null),
    cargarMarca(supabase),
  ]);
  const rol = yo?.rol ?? "comercial";
  const esGestor = ["direccion", "admin"].includes(rol);
  const noLeidas = notifRes.count ?? 0;

  // Quien vende: cuántos hay para contactar hoy (atrasados, de hoy y "llegó stock"),
  // más lo de la agenda para hoy (tareas, reuniones, pagos). En paralelo.
  const contarInteresesHoy = async () => {
    if (!["comercial", "direccion", "distribuidor"].includes(rol)) return 0;
    const { comercialId } = await filtroQuien(user.id, esGestor);
    let q = supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .in("etapa", [...ETAPAS_ABIERTAS])
      .lte("proximo_contacto", hoyISO());
    if (comercialId) q = q.eq("comercial_id", comercialId);
    return (await q).count ?? 0;
  };
  // Dirección general: lo que espera su aprobación (propuestas, contenidos del calendario, pedidos a marketing y viáticos)
  const contarParaAprobar = async () => {
    if (rol !== "direccion") return 0;
    const [p, c, m, v] = await Promise.all([
      supabase.from("cotizacion_versiones").select("id", { count: "exact", head: true }).eq("aprobacion", "pendiente"),
      supabase.from("contenidos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
      supabase.from("pedidos_material").select("id", { count: "exact", head: true }).eq("estado", "para_aprobar"),
      supabase.from("rendiciones").select("id", { count: "exact", head: true }).eq("estado", "enviada"),
    ]);
    return (p.count ?? 0) + (c.count ?? 0) + (m.count ?? 0) + (v.count ?? 0);
  };
  const [interesesHoy, agendaHoy, paraAprobar] = await Promise.all([
    contarInteresesHoy(),
    contarAgendaHoy(supabase, user.id, hoyISO()),
    contarParaAprobar(),
  ]);
  const paraHoy = interesesHoy + agendaHoy;

  // Avisos creados por la base (consultas web, asignaciones) que falten mandar al celular
  after(async () => {
    await mandarAvisosPendientes();
  });

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <EstiloMarca marca={marca} />
      <Rail rol={rol} nombre={yo?.nombre} email={user.email} noLeidas={noLeidas} paraHoy={paraHoy} paraAprobar={paraAprobar} marca={marca} veContenidos={Boolean(yo?.ve_contenidos)} />

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-borde bg-crema/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link href="/" className="flex items-center" aria-label={marca.nombre}>
            <LogoSistema marca={marca} fondo="claro" tamano="sm" />
          </Link>
          <Link
            href="/notificaciones"
            aria-label="Avisos"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-borde bg-white text-tinta/70"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {noLeidas > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ambar px-1 text-[10px] font-bold text-white">
                {noLeidas > 9 ? "9+" : noLeidas}
              </span>
            )}
          </Link>
        </header>

        <AvisoVersion version={VERSIONES[0].version} />

        <main className="w-full flex-1 px-4 pt-4 pb-28 lg:px-7 lg:pt-6 lg:pb-12">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>

        <div className="lg:hidden">
          <TecladoAbierto />
          <BotonFlotante rol={rol} />
          <BottomNav rol={rol} paraHoy={paraHoy} />
        </div>
      </div>
    </div>
  );
}
