import { createClient } from "@/lib/supabase/server";
import { infoStockPorProducto } from "@/lib/stock";
import InteresNuevoForm from "@/components/InteresNuevoForm";
import { iaConfigurada } from "@/lib/core/ia";
import AyudaLink from "@/components/guia/AyudaLink";
import type { Producto } from "@/lib/types";

/**
 * + Interés: la acción principal, en tres pantallas. Primero qué quiere,
 * después quién, y al final (opcional) una nota y cuándo volver a contactar.
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
  const [{ data }, stockInfo] = await Promise.all([
    supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .eq("es_consumible", false)
      .order("nombre"),
    infoStockPorProducto(supabase),
  ]);

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
      />
    </div>
  );
}
