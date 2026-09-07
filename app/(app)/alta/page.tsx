import { createClient } from "@/lib/supabase/server";
import ContactoNuevoForm from "@/components/ContactoNuevoForm";
import type { Producto } from "@/lib/types";

/** Alta de contacto. Recibe también texto compartido desde WhatsApp (PWA). */
export default async function NuevoContactoPage({
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
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Nuevo contacto</h1>
      <p className="mb-5 text-sm text-piedra">
        Nombre y teléfono alcanzan. Lo demás se completa después.
      </p>
      <ContactoNuevoForm
        productos={(data ?? []) as Producto[]}
        telefonoInicial={telefonoDetectado}
        notaInicial={
          compartido ? compartido.replace(telefonoDetectado, "").trim() : ""
        }
      />
    </div>
  );
}
