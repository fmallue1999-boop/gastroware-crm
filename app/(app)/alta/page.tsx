import { createClient } from "@/lib/supabase/server";
import { infoStockPorProducto } from "@/lib/stock";
import InteresNuevoForm from "@/components/InteresNuevoForm";
import { iaConfigurada } from "@/lib/core/ia";
import AyudaLink from "@/components/guia/AyudaLink";
import { datosDeRuteo, elegirResponsable } from "@/lib/servidor/ruteo";
import { ZONAS_ENTREGA } from "@/lib/territorios";
import type { Producto } from "@/lib/types";

/**
 * + Interés: la acción principal, en una pantalla: qué quiere (y cuántos),
 * quién, dónde se entrega y quién lo atiende.
 * Recibe también texto compartido desde WhatsApp (PWA share target).
 */
// Leer el mensaje con IA puede tardar unos segundos
export const maxDuration = 60;

export default async function NuevoInteresPage({
  searchParams,
}: {
  searchParams: Promise<{ texto?: string; titulo?: string; url?: string }>;
}) {
  const { texto, titulo } = await searchParams;
  const compartido = [titulo, texto].filter(Boolean).join(" ").trim();

  const supabase = await createClient();
  const [{ data }, stockInfo, ruteo, { data: auth }] = await Promise.all([
    supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .eq("es_consumible", false)
      // Solo equipos: consumibles y repuestos tienen su apartado
      .not("categoria", "in", "(repuesto,refaccion)")
      .order("nombre"),
    infoStockPorProducto(supabase),
    datosDeRuteo(supabase),
    supabase.auth.getUser(),
  ]);
  // A quién va sola cada zona (y quién la puede atender si se elige a mano)
  const yo = auth.user?.id ?? null;
  const automatico: Record<string, string | null> = Object.fromEntries(
    [...ZONAS_ENTREGA, ""].map((z) => [z, elegirResponsable({ zona: z || null, creadorId: yo }, ruteo.territorios, ruteo.usuarios).responsableNombre])
  );
  const vendedores = ruteo.usuarios
    .filter((u) => u.activo && ["comercial", "direccion", "distribuidor"].includes(u.rol))
    .map((u) => ({ id: u.id, nombre: u.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const telefonoDetectado = compartido
    ? (compartido.match(/(?:\+?54\s?9?[\s\-.]?)?(?:\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]?\d{4}/)?.[0] ?? "")
    : "";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 flex flex-wrap items-center gap-x-2 text-2xl font-bold tracking-tight">
        Nueva consulta <AyudaLink tarea="nueva-consulta" />
      </h1>
      <p className="mb-4 text-[15px] text-piedra">
        Qué le interesa, a quién y dónde se entrega. O pegá el mensaje y que la IA lo complete.
      </p>
      <InteresNuevoForm
        productos={(data ?? []) as Producto[]}
        stockInfo={stockInfo}
        telefonoInicial={telefonoDetectado}
        notaInicial={
          compartido ? compartido.replace(telefonoDetectado, "").trim() : ""
        }
        iaOn={iaConfigurada()}
        compartido={compartido}
        vendedores={vendedores}
        automatico={automatico}
      />
    </div>
  );
}
