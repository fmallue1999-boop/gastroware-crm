import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient, supabaseConfigurado } from "@/lib/supabase/server";
import { ETAPAS_ABIERTAS } from "@/lib/constants";
import { hoyISO } from "@/lib/format";
import { filtroQuien } from "@/lib/quien";
import BottomNav from "@/components/BottomNav";
import BotonFlotante from "@/components/BotonFlotante";
import Rail from "@/components/Rail";
import EstiloMarca from "@/components/marca/EstiloMarca";
import LogoSistema from "@/components/marca/LogoSistema";
import { cargarMarca } from "@/lib/servidor/marca";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigurado()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: yo }, notifRes, marca] = await Promise.all([
    supabase.from("usuarios").select("rol, nombre").eq("id", user.id).single(),
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

  // Quien vende: cuántos hay para contactar hoy (atrasados, de hoy y "llegó stock")
  let paraHoy = 0;
  if (["comercial", "direccion", "distribuidor"].includes(rol)) {
    const { comercialId } = await filtroQuien(user.id, esGestor);
    let q = supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .in("etapa", [...ETAPAS_ABIERTAS])
      .lte("proximo_contacto", hoyISO());
    if (comercialId) q = q.eq("comercial_id", comercialId);
    paraHoy = (await q).count ?? 0;
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
      <EstiloMarca marca={marca} />
      <Rail rol={rol} nombre={yo?.nombre} email={user.email} noLeidas={noLeidas} paraHoy={paraHoy} marca={marca} />

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

        <main className="w-full flex-1 px-4 pt-4 pb-28 lg:px-7 lg:pt-6 lg:pb-12">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>

        <div className="lg:hidden">
          <BotonFlotante rol={rol} />
          <BottomNav rol={rol} paraHoy={paraHoy} />
        </div>
      </div>
    </div>
  );
}
