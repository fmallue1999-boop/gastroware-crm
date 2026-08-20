import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fechaCorta } from "@/lib/format";

type CampaniaFila = {
  id: string;
  nombre: string;
  estado: string;
  created_at: string;
  destinatarios: { estado: string }[];
};

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!["direccion", "admin", "marketing"].includes(rol ?? ""))
    redirect("/hoy");

  const { data } = await supabase
    .from("campanias")
    .select("id, nombre, estado, created_at, destinatarios:campania_destinatarios(estado)")
    .order("created_at", { ascending: false })
    .limit(50);

  const campanias = (data ?? []) as CampaniaFila[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
        <Link
          href="/marketing/nueva"
          className="inline-flex items-center gap-1.5 rounded-2xl bg-tinta px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> Nueva campaña
        </Link>
      </div>

      <p className="mb-4 text-sm text-piedra">
        Elegís a quién (segmento), escribís el mensaje una vez, y el CRM te arma
        la cola: un toque por cliente y sale por tu WhatsApp de siempre.
      </p>

      {campanias.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde p-10 text-center text-sm text-piedra">
          <Megaphone className="mx-auto mb-2 h-6 w-6" />
          Todavía no hay campañas. Creá la primera: por ejemplo, recompra de
          pastillas para todos los que tienen Rational.
        </p>
      ) : (
        <div className="space-y-2">
          {campanias.map((c) => {
            const total = c.destinatarios.length;
            const enviados = c.destinatarios.filter((d) => d.estado === "enviado").length;
            const pendientes = c.destinatarios.filter((d) => d.estado === "pendiente").length;
            const pct = total ? Math.round((enviados / total) * 100) : 0;
            return (
              <Link
                key={c.id}
                href={`/marketing/${c.id}`}
                className="block rounded-2xl border border-borde bg-white p-4 shadow-sm transition-colors hover:border-celeste"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{c.nombre}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.estado === "terminada"
                        ? "bg-green-100 text-green-700"
                        : c.estado === "borrador"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-celeste-soft text-sky-800"
                    }`}
                  >
                    {c.estado === "terminada"
                      ? "Terminada"
                      : c.estado === "borrador"
                        ? "Borrador"
                        : `${pendientes} pendientes`}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-crema-deep">
                  <div
                    className="h-full rounded-full bg-celeste-deep"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-piedra">
                  {enviados} de {total} enviados · {fechaCorta(c.created_at)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
