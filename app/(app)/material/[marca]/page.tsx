import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileCheck2, ImageIcon, Pencil, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ESPACIOS_MARCA } from "@/lib/material";
import { archivosDe, archivosDeEspacios, cargarArbol, espaciosDe, puedeGestionarMaterial, resumenPorProducto, type Categoria, type ProductoMaterial, type Resumen } from "@/lib/servidor/material";
import EspaciosPropios from "@/components/material/EspaciosPropios";
import { BuscadorMaterial, MigasMaterial } from "@/components/material/Navegacion";
import EspacioArchivos from "@/components/material/EspacioArchivos";
import { EditorCategoria, EditorProducto, NuevaCategoria, NuevoProducto } from "@/components/material/EditorEstructura";

/**
 * Página de una marca (v1.11): columnas que se arman según los datos.
 * IDENTIDAD DE MARCA siempre; PRODUCTOS con sus categorías; ACCESORIOS solo
 * si la marca tiene. Las categorías se ven siempre y se pliegan.
 * ?editar=1: marketing y dirección agregan, renombran y ordenan.
 */
export default async function MarcaMaterialPage({ params, searchParams }: { params: Promise<{ marca: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { marca: slug } = await params;
  const { editar } = await searchParams;
  const supabase = await createClient();
  const [arbol, gestiona] = await Promise.all([cargarArbol(supabase), puedeGestionarMaterial(supabase)]);
  const marca = arbol.marcas.find((m) => m.slug === slug);
  if (!marca) notFound();
  const editando = gestiona && editar === "1";

  const categorias = arbol.categorias.filter((c) => c.marca_id === marca.id);
  const idsCat = new Set(categorias.map((c) => c.id));
  const productos = arbol.productos.filter((p) => idsCat.has(p.categoria_id));
  const [resumen, archivosMarca, { data: catalogo }, espaciosMarca] = await Promise.all([
    resumenPorProducto(supabase, productos.map((p) => p.id)),
    archivosDe(supabase, "marca", marca.id),
    editando ? supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre") : Promise.resolve({ data: [] }),
    espaciosDe(supabase, "marca", marca.id),
  ]);
  const archivosEspacios = Object.fromEntries(await archivosDeEspacios(supabase, espaciosMarca.map((e) => e.id)));

  const deSeccion = (s: string) => categorias.filter((c) => c.seccion === s);
  const columnas: { titulo: string; seccion: "productos" | "accesorios" }[] = [{ titulo: "PRODUCTOS", seccion: "productos" }];
  if (deSeccion("accesorios").length || editando) columnas.push({ titulo: "ACCESORIOS", seccion: "accesorios" });
  const opcionesCat = categorias.map((c) => ({ id: c.id, nombre: `${c.seccion === "accesorios" ? "Accesorios › " : ""}${c.nombre}` }));

  return (
    <div className="space-y-4">
      <MigasMaterial partes={[{ texto: "MATERIAL", href: "/material" }, { texto: marca.nombre }]} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{marca.nombre}</h1>
        {gestiona && (
          <Link
            href={editando ? `/material/${slug}` : `/material/${slug}?editar=1`}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 text-[14px] font-bold ${editando ? "bg-marino text-white" : "border border-borde bg-white"}`}
          >
            <Pencil className="h-4 w-4" /> {editando ? "Listo, dejar de editar" : "Editar categorías y productos"}
          </Link>
        )}
      </div>
      <BuscadorMaterial />

      <div className={`grid items-start gap-4 ${columnas.length > 1 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        {/* Identidad de marca */}
        <section className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm">
          <h2 className="text-xs font-extrabold tracking-[0.15em] text-piedra">IDENTIDAD DE MARCA</h2>
          {ESPACIOS_MARCA.map((e) => (
            <div key={e.value} className="space-y-1.5">
              <p className="text-[15px] font-extrabold">{e.label}</p>
              <EspacioArchivos
                dueno="marca"
                duenoId={marca.id}
                espacio={e.value}
                archivos={archivosMarca.filter((a) => a.espacio === e.value)}
                puedeGestionar={gestiona}
                vacio={`Sin ${e.label.toLowerCase()} todavía.`}
              />
            </div>
          ))}
          <EspaciosPropios ambito="marca" ambitoId={marca.id} espacios={espaciosMarca} archivos={archivosEspacios} puedeGestionar={gestiona} />
        </section>

        {columnas.map((col) => {
          const cats = deSeccion(col.seccion);
          return (
            <section key={col.seccion} className="space-y-3 rounded-2xl border border-borde bg-white p-4 shadow-sm">
              <h2 className="text-xs font-extrabold tracking-[0.15em] text-piedra">{col.titulo}</h2>
              {cats.map((c, i) => (
                <BloqueCategoria
                  key={c.id}
                  categoria={c}
                  productos={productos.filter((p) => p.categoria_id === c.id)}
                  resumen={resumen}
                  marcaSlug={slug}
                  marcaId={marca.id}
                  editando={editando}
                  primera={i === 0}
                  ultima={i === cats.length - 1}
                  opcionesCat={opcionesCat}
                  catalogo={(catalogo ?? []) as { id: string; nombre: string }[]}
                />
              ))}
              {!cats.length && !editando && <p className="text-[15px] text-piedra">Todavía no hay categorías.</p>}
              {editando && <NuevaCategoria marcaId={marca.id} seccion={col.seccion} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Indicadores({ r }: { r?: Resumen }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-piedra">
      <span className={`inline-flex items-center gap-0.5 ${r?.videos ? "text-tinta" : "opacity-40"}`} title="Videos">
        <PlayCircle className="h-3.5 w-3.5" /> {r?.videos ?? 0}
      </span>
      <span className={`inline-flex items-center gap-0.5 ${r?.imagenes ? "text-tinta" : "opacity-40"}`} title="Imágenes">
        <ImageIcon className="h-3.5 w-3.5" /> {r?.imagenes ?? 0}
      </span>
      <span className={`inline-flex items-center gap-0.5 ${r?.ficha ? "text-verde" : "opacity-40"}`} title={r?.ficha ? "Tiene ficha" : "Sin ficha"}>
        <FileCheck2 className="h-3.5 w-3.5" /> Ficha
      </span>
    </span>
  );
}

function BloqueCategoria({
  categoria,
  productos,
  resumen,
  marcaSlug,
  marcaId,
  editando,
  primera,
  ultima,
  opcionesCat,
  catalogo,
}: {
  categoria: Categoria;
  productos: ProductoMaterial[];
  resumen: Map<string, Resumen>;
  marcaSlug: string;
  marcaId: string;
  editando: boolean;
  primera: boolean;
  ultima: boolean;
  opcionesCat: { id: string; nombre: string }[];
  catalogo: { id: string; nombre: string }[];
}) {
  if (editando)
    return (
      <div id={`cat-${categoria.id}`} className="space-y-2 rounded-xl bg-crema p-2.5">
        <EditorCategoria id={categoria.id} marcaId={marcaId} nombre={categoria.nombre} seccion={categoria.seccion as "productos" | "accesorios"} primera={primera} ultima={ultima} />
        {productos.map((p, i) => (
          <EditorProducto
            key={p.id}
            id={p.id}
            nombre={p.nombre}
            categoriaId={p.categoria_id}
            productoId={p.producto_id}
            categorias={opcionesCat}
            catalogo={catalogo}
            primero={i === 0}
            ultimo={i === productos.length - 1}
          />
        ))}
        <NuevoProducto categoriaId={categoria.id} />
      </div>
    );
  return (
    <details id={`cat-${categoria.id}`} open className="group scroll-mt-20 rounded-xl border border-borde">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-xl bg-crema px-3 text-[15px] font-extrabold [&::-webkit-details-marker]:hidden">
        <span>
          {categoria.nombre} <span className="font-semibold text-piedra">· {productos.length}</span>
        </span>
        <ChevronRight className="h-4 w-4 text-piedra transition-transform group-open:rotate-90" />
      </summary>
      <div className="divide-y divide-borde/70">
        {productos.map((p) => (
          <Link key={p.id} href={`/material/${marcaSlug}/${p.slug}`} className="flex min-h-12 items-center gap-2 px-3 py-2 hover:bg-crema">
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{p.nombre}</span>
            <Indicadores r={resumen.get(p.id)} />
            <ChevronRight className="h-4 w-4 shrink-0 text-piedra" />
          </Link>
        ))}
        {!productos.length && <p className="px-3 py-3 text-sm text-piedra">Todavía no hay productos en {categoria.nombre}. Cuando se sumen, van a aparecer acá.</p>}
      </div>
    </details>
  );
}
