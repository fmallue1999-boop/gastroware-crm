import { createClient } from "@/lib/supabase/server";
import { infoStockPorProducto } from "@/lib/stock";
import InteresNuevoForm from "@/components/InteresNuevoForm";
import type { Producto } from "@/lib/types";

/**
 * Nuevo interés: la acción principal. Primero qué quiere, después quién.
 * Recibe también texto compartido desde WhatsApp (PWA share target).
 */
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
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Nuevo interés</h1>
      <p className="mb-5 text-sm text-piedra">
        Qué le interesa y a quién. Si no está en la base, lo cargás ahí mismo.
      </p>
      <InteresNuevoForm
        productos={(data ?? []) as Producto[]}
        stockInfo={stockInfo}
        telefonoInicial={telefonoDetectado}
        notaInicial={
          compartido ? compartido.replace(telefonoDetectado, "").trim() : ""
        }
      />
    </div>
  );
}
