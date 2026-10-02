import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { archivosDe, puedeGestionarMaterial, type EspacioPropio } from "@/lib/servidor/material";
import { MigasMaterial } from "@/components/material/Navegacion";
import EspacioArchivos from "@/components/material/EspacioArchivos";
import { CabeceraEspacio } from "@/components/material/EspaciosPropios";

/**
 * Un espacio general de Material (v1.23): lo crea marketing para subir
 * contenido de cualquier tipo (presentaciones, redes, banners…). Todos lo
 * ven y descargan; marketing y dirección suben, mueven y borran.
 */
export default async function EspacioMaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, gestiona] = await Promise.all([
    supabase.from("material_espacios").select("id, ambito, ambito_id, nombre, descripcion, orden").eq("id", id).maybeSingle(),
    puedeGestionarMaterial(supabase),
  ]);
  if (!data) notFound();
  const espacio = data as Omit<EspacioPropio, "cantidad">;
  const archivos = await archivosDe(supabase, "espacio", espacio.id);

  return (
    <div className="space-y-4">
      <MigasMaterial partes={[{ texto: "MATERIAL", href: "/material" }, { texto: espacio.nombre }]} />
      <CabeceraEspacio espacio={{ ...espacio, cantidad: archivos.length }} puedeGestionar={gestiona} grande alBorrarIr="/material" />
      <section className="space-y-2 rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <EspacioArchivos dueno="espacio" duenoId={espacio.id} espacio="propio" archivos={archivos} puedeGestionar={gestiona} vacio="Este espacio está vacío. Subí lo que quieras: imágenes, videos, PDF, presentaciones…" />
      </section>
    </div>
  );
}
