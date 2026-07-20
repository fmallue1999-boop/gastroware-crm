import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "@/lib/actions";
import PushToggle from "@/components/PushToggle";

function MenuLink({
  href,
  icono,
  titulo,
  detalle,
}: {
  href: string;
  icono: string;
  titulo: string;
  detalle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-borde bg-white p-3.5"
    >
      <span className="text-xl" aria-hidden>
        {icono}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-piedra">{detalle}</span>
      </span>
    </Link>
  );
}

export default async function MasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [clientes, abiertas, ganadas] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .in("etapa", ["nueva", "diagnostico", "cotizada", "seguimiento", "negociacion"]),
    supabase
      .from("oportunidades")
      .select("id", { count: "exact", head: true })
      .eq("etapa", "ganada"),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Más</h1>

      <section className="rounded-xl border border-borde bg-white p-4">
        <p className="text-sm text-piedra">Sesión</p>
        <p className="text-sm font-medium">{user?.email}</p>
        <form action={cerrarSesion} className="mt-3">
          <button className="rounded-xl border border-borde px-4 py-2 text-sm text-tinta/70">
            Cerrar sesión
          </button>
        </form>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-borde bg-white p-3 text-center">
          <p className="text-2xl font-semibold">{clientes.count ?? 0}</p>
          <p className="text-xs text-piedra">Clientes</p>
        </div>
        <div className="rounded-xl border border-borde bg-white p-3 text-center">
          <p className="text-2xl font-semibold">{abiertas.count ?? 0}</p>
          <p className="text-xs text-piedra">Abiertas</p>
        </div>
        <div className="rounded-xl border border-borde bg-white p-3 text-center">
          <p className="text-2xl font-semibold">{ganadas.count ?? 0}</p>
          <p className="text-xs text-piedra">Ganadas</p>
        </div>
      </section>

      <section className="space-y-2">
        <MenuLink
          href="/reportes"
          icono="📈"
          titulo="Reportes"
          detalle="Embudo, canales, rubros, motivos de pérdida y seguimientos vencidos"
        />
        <MenuLink
          href="/calculadora"
          icono="🍊"
          titulo="Calculadora Zumex"
          detalle="La cuenta de recupero, con resumen listo para mandar al cliente"
        />
        <MenuLink
          href="/biblioteca"
          icono="📚"
          titulo="Biblioteca comercial"
          detalle="Fichas, videos, comparativas y casos para cada producto"
        />
      </section>

      <PushToggle />

      <section className="rounded-xl border border-dashed border-borde p-4 text-sm text-piedra">
        <p className="font-medium text-tinta/70 mb-1">
          💡 Instalala en el celular
        </p>
        <p>
          Abrí esta página desde el navegador del teléfono y elegí “Agregar a
          pantalla de inicio”. Queda como una app.
        </p>
      </section>
    </div>
  );
}
