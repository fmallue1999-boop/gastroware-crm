import { notFound } from "next/navigation";
import { Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { archivosDe, cargarArbol, puedeGestionarMaterial } from "@/lib/servidor/material";
import { MigasMaterial } from "@/components/material/Navegacion";
import EspacioArchivos from "@/components/material/EspacioArchivos";

/**
 * Página de un producto (v1.11): VIDEOS | IMÁGENES | FICHA. La misma
 * estructura para todos los productos y accesorios de las tres marcas.
 */
export default async function ProductoMaterialPage({ params }: { params: Promise<{ marca: string; producto: string }> }) {
  const { marca: slugMarca, producto: slugProducto } = await params;
  const supabase = await createClient();
  const [arbol, gestiona] = await Promise.all([cargarArbol(supabase), puedeGestionarMaterial(supabase)]);
  const marca = arbol.marcas.find((m) => m.slug === slugMarca);
  const producto = arbol.productos.find((p) => p.slug === slugProducto);
  const categoria = producto ? arbol.categorias.find((c) => c.id === producto.categoria_id) : null;
  if (!marca || !producto || !categoria || categoria.marca_id !== marca.id) notFound();

  const [archivos, { data: delCatalogo }] = await Promise.all([
    archivosDe(supabase, "producto", producto.id),
    producto.producto_id ? supabase.from("productos").select("nombre").eq("id", producto.producto_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const videos = archivos.filter((a) => a.espacio === "videos");
  const imagenes = archivos.filter((a) => a.espacio === "imagenes");
  const ficha = archivos.filter((a) => a.espacio === "ficha");
  const nombreCategoria = categoria.nombre.charAt(0) + categoria.nombre.slice(1).toLowerCase();

  const espacios = [
    { id: "videos", titulo: "VIDEOS", cuenta: videos.length },
    { id: "imagenes", titulo: "IMÁGENES", cuenta: imagenes.length },
    { id: "ficha", titulo: "FICHA", cuenta: ficha.length },
  ];

  return (
    <div className="space-y-4">
      <MigasMaterial
        partes={[
          { texto: "MATERIAL", href: "/material" },
          { texto: marca.nombre, href: `/material/${marca.slug}` },
          { texto: nombreCategoria, href: `/material/${marca.slug}#cat-${categoria.id}` },
          { texto: producto.nombre },
        ]}
      />
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{producto.nombre}</h1>
        {delCatalogo && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-piedra">
            <Link2 className="h-3.5 w-3.5" /> Vinculado al Catálogo ({(delCatalogo as { nombre: string }).nombre}): la ficha también se anexa a sus cotizaciones.
          </p>
        )}
      </div>

      {/* Saltos rápidos (en el celular, las tres secciones van una abajo de la otra) */}
      <nav className="sticky top-14 z-[5] -mx-4 flex gap-1.5 overflow-x-auto border-b border-borde bg-crema/95 px-4 py-2 backdrop-blur lg:top-0 lg:mx-0 lg:rounded-2xl lg:border lg:px-2">
        {espacios.map((e) => (
          <a key={e.id} href={`#${e.id}`} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-borde bg-white px-3.5 text-[14px] font-extrabold tracking-wide">
            {e.titulo}
            <span className="rounded-full bg-crema-deep px-1.5 text-xs text-piedra">{e.cuenta}</span>
          </a>
        ))}
      </nav>

      <section id="videos" className="scroll-mt-32 space-y-2 rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <h2 className="text-xs font-extrabold tracking-[0.15em] text-piedra">VIDEOS</h2>
        <EspacioArchivos dueno="producto" duenoId={producto.id} espacio="videos" archivos={videos} puedeGestionar={gestiona} vacio="Todavía no hay videos de este producto." />
      </section>

      <section id="imagenes" className="scroll-mt-32 space-y-2 rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <h2 className="text-xs font-extrabold tracking-[0.15em] text-piedra">IMÁGENES</h2>
        <EspacioArchivos
          dueno="producto"
          duenoId={producto.id}
          espacio="imagenes"
          archivos={imagenes}
          puedeGestionar={gestiona}
          zipHref={`/material/${marca.slug}/${producto.slug}/imagenes`}
          vacio="Todavía no hay imágenes de este producto."
        />
      </section>

      <section id="ficha" className="scroll-mt-32 space-y-2 rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <h2 className="text-xs font-extrabold tracking-[0.15em] text-piedra">FICHA</h2>
        <EspacioArchivos dueno="producto" duenoId={producto.id} espacio="ficha" archivos={ficha} puedeGestionar={gestiona} vacio="Todavía no hay ficha de este producto." />
      </section>
    </div>
  );
}
