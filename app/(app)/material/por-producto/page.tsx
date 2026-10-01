import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { normalizar, type VideoTipo } from "@/lib/material";
import { cargarArbol, puedeGestionarMaterial, videosPorTipo } from "@/lib/servidor/material";
import { MigasMaterial } from "@/components/material/Navegacion";
import CeldaVideo from "@/components/material/CeldaVideo";

const COLUMNAS: { tipo: VideoTipo; titulo: string }[] = [
  { tipo: "usar", titulo: "Cómo usar" },
  { tipo: "configurar", titulo: "Cómo configurar" },
  { tipo: "lavar", titulo: "Cómo lavar" },
];

/**
 * Material por producto (v1.11): todos los productos con sus videos de cómo
 * usar, configurar y lavar. Misma fuente que la página del producto.
 */
export default async function MaterialPorProductoPage({ searchParams }: { searchParams: Promise<{ marca?: string; q?: string }> }) {
  const { marca: filtroMarca, q } = await searchParams;
  const busqueda = q?.trim() ?? "";
  const supabase = await createClient();
  const [arbol, videos, gestiona] = await Promise.all([cargarArbol(supabase), videosPorTipo(supabase), puedeGestionarMaterial(supabase)]);

  const marcaDe = new Map(arbol.marcas.map((m) => [m.id, m]));
  const categoriaDe = new Map(arbol.categorias.map((c) => [c.id, c]));
  const ordenMarca = new Map(arbol.marcas.map((m, i) => [m.id, i]));
  // Primero los productos y después los accesorios de cada marca
  const ordenCat = new Map(arbol.categorias.map((c, i) => [c.id, (c.seccion === "accesorios" ? 10000 : 0) + i]));
  const filas = arbol.productos
    .map((p) => {
      const c = categoriaDe.get(p.categoria_id);
      const m = c ? marcaDe.get(c.marca_id) : undefined;
      return c && m ? { p, c, m } : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .filter((x) => !filtroMarca || x.m.slug === filtroMarca)
    .filter((x) => !busqueda || normalizar(x.p.nombre).replace(/\s/g, "").includes(normalizar(busqueda).replace(/\s/g, "")))
    .sort((a, b) => (ordenMarca.get(a.m.id) ?? 0) - (ordenMarca.get(b.m.id) ?? 0) || (ordenCat.get(a.c.id) ?? 0) - (ordenCat.get(b.c.id) ?? 0) || a.p.orden - b.p.orden);

  const link = (marca?: string) => {
    const p = new URLSearchParams();
    if (marca) p.set("marca", marca);
    if (busqueda) p.set("q", busqueda);
    const s = p.toString();
    return s ? `/material/por-producto?${s}` : "/material/por-producto";
  };
  const chip = (on: boolean) => `inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold ${on ? "bg-marino text-white" : "border border-borde bg-white text-tinta"}`;

  return (
    <div className="space-y-4">
      <MigasMaterial partes={[{ texto: "MATERIAL", href: "/material" }, { texto: "Material por producto" }]} />
      <h1 className="text-2xl font-extrabold tracking-tight">Material por producto</h1>

      <form action="/material/por-producto" className="flex gap-2">
        {filtroMarca && <input type="hidden" name="marca" value={filtroMarca} />}
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
          <input
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder="Buscar producto"
            className="min-h-11 w-full rounded-xl border border-borde bg-white pl-10 pr-3 text-[15px] outline-none focus:border-marino"
          />
        </label>
        <button className="min-h-11 rounded-xl bg-marino px-4 text-[15px] font-bold text-white">Buscar</button>
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <Link href={link()} className={chip(!filtroMarca)}>
          Todas las marcas
        </Link>
        {arbol.marcas.map((m) => (
          <Link key={m.id} href={link(m.slug)} className={chip(filtroMarca === m.slug)}>
            {m.nombre}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-borde bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-borde text-xs font-bold uppercase tracking-wide text-piedra">
              <th className="sticky left-0 bg-white px-4 py-3">Producto</th>
              <th className="px-3 py-3">Marca</th>
              {COLUMNAS.map((c) => (
                <th key={c.tipo} className="px-3 py-3">
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(({ p, m }) => (
              <tr key={p.id} className="border-b border-borde/70 last:border-0">
                <td className="sticky left-0 bg-white px-4 py-2.5">
                  <Link href={`/material/${m.slug}/${p.slug}`} className="text-[15px] font-extrabold hover:underline">
                    {p.nombre}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-piedra">{m.nombre}</td>
                {COLUMNAS.map((c) => {
                  const v = videos.get(p.id)?.[c.tipo];
                  return (
                    <td key={c.tipo} className="px-3 py-2.5">
                      <CeldaVideo video={v ? { id: v.id, nombre: v.nombre, mime: v.mime, url: v.url } : null} productoId={p.id} tipo={c.tipo} puedeGestionar={gestiona} />
                    </td>
                  );
                })}
              </tr>
            ))}
            {!filas.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[15px] text-piedra">
                  No hay productos con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
