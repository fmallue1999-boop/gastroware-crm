import { createClient } from "@/lib/supabase/server";
import AltaForm from "@/components/AltaForm";
import type { Producto } from "@/lib/types";

/** Recibe también contenido compartido desde WhatsApp (PWA share target). */
export default async function AltaPage({
  searchParams,
}: {
  searchParams: Promise<{ texto?: string; titulo?: string; url?: string }>;
}) {
  const { texto, titulo } = await searchParams;
  const compartido = [titulo, texto].filter(Boolean).join(" ").trim();

  const supabase = await createClient();
  const { data } = await supabase
    .from("productos")
    .select("*")
    .eq("activo", true)
    .eq("es_consumible", false)
    .order("nombre");

  const telefonoDetectado = compartido
    ? (compartido.match(/(?:\+?54\s?9?[\s\-.]?)?(?:\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]?\d{4}/)?.[0] ?? "")
    : "";

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Nuevo lead</h1>
      <p className="text-sm text-piedra mb-5">
        30 segundos: teléfono, nombre, producto y listo.
      </p>
      <AltaForm
        productos={(data ?? []) as Producto[]}
        telefonoInicial={telefonoDetectado}
        mensajeInicial={
          compartido
            ? compartido.replace(telefonoDetectado, "").trim()
            : undefined
        }
      />
    </div>
  );
}
