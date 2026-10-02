import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { esGestor } from "@/lib/puestos";
import { fechaCorta } from "@/lib/format";
import { firmarLote } from "@/lib/core/storage";
import { ordenNatural } from "@/lib/contenidos";
import { ESTADOS_PEDIDO, estadoDe, sePuedeTrabajar } from "@/lib/pedidos-contenido";
import { cargarArbol, type ArchivoMaterial } from "@/lib/servidor/material";
import EspacioArchivos from "@/components/material/EspacioArchivos";
import AccionesPedido from "@/components/marketing/AccionesPedido";

type Pedido = {
  id: string;
  titulo: string;
  detalle: string | null;
  para_fecha: string | null;
  estado: string;
  fecha_comprometida: string | null;
  entregado_at: string | null;
  created_at: string;
  pedido_por: string | null;
  tomado_por: string | null;
  enviado_at: string | null;
  correccion: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  espacio_destino_id: string | null;
};

/**
 * Un pedido de contenido a marketing (v1.23): qué se pidió, lo que entregó
 * marketing, la aprobación de dirección y dónde quedó en Material.
 */
export default async function PedidoContenidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data }, { data: rol }, { data: usuarios }, { data: espaciosData }, arbol] = await Promise.all([
    supabase.from("pedidos_material").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("fn_rol"),
    supabase.from("usuarios").select("id, nombre"),
    supabase.from("material_espacios").select("id, ambito, ambito_id, nombre").order("ambito").order("orden").order("nombre"),
    cargarArbol(supabase),
  ]);
  if (!data) notFound();
  const p = data as Pedido;
  const estado = estadoDe(p.estado);
  const e = ESTADOS_PEDIDO[estado];
  const nombres = new Map(((usuarios ?? []) as { id: string; nombre: string }[]).map((u) => [u.id, u.nombre]));
  const puesto = (rol as string) ?? "comercial";
  const hacePedidos = puesto === "marketing" || esGestor(puesto);

  // Lo entregado: mientras se trabaja es del pedido; aprobado, sigue donde lo haya puesto marketing
  const { data: filas } = await supabase
    .from("material_archivos")
    .select("id, dueno, dueno_id, espacio, video_tipo, nombre, mime, tamano, path")
    .or(`and(dueno.eq.pedido,dueno_id.eq.${p.id}),pedido_id.eq.${p.id}`);
  const lista = ordenNatural((filas ?? []) as Omit<ArchivoMaterial, "url">[]);
  const urls = await firmarLote("material", lista.map((a) => a.path));
  const archivos: ArchivoMaterial[] = lista.map((a) => ({ ...a, url: urls.get(a.path) ?? null }));
  const entregados = archivos.filter((a) => a.dueno === "pedido");

  // Dónde está cada espacio (para elegir el destino y para el link después de aprobar)
  const marcaDeCat = new Map(arbol.categorias.map((c) => [c.id, c.marca_id]));
  const marcaPorId = new Map(arbol.marcas.map((m) => [m.id, m]));
  const prodPorId = new Map(arbol.productos.map((x) => [x.id, x]));
  const espacios = ((espaciosData ?? []) as { id: string; ambito: string; ambito_id: string | null; nombre: string }[]).map((s) => {
    if (s.ambito === "general") return { id: s.id, etiqueta: s.nombre, href: `/material/espacio/${s.id}` };
    if (s.ambito === "marca") {
      const m = marcaPorId.get(s.ambito_id ?? "");
      return { id: s.id, etiqueta: `${s.nombre} · ${m?.nombre ?? "marca"}`, href: m ? `/material/${m.slug}#espacio-${s.id}` : "/material" };
    }
    const prod = prodPorId.get(s.ambito_id ?? "");
    const m = prod ? marcaPorId.get(marcaDeCat.get(prod.categoria_id) ?? "") : undefined;
    return { id: s.id, etiqueta: `${s.nombre} · ${prod?.nombre ?? "producto"}`, href: prod && m ? `/material/${m.slug}/${prod.slug}#espacio-${s.id}` : "/material" };
  });
  const destino = espacios.find((s) => s.id === p.espacio_destino_id) ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/marketing/pedidos" className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-piedra hover:text-marino">
        <ChevronLeft className="h-4 w-4" /> Pedidos a marketing
      </Link>

      <div className="space-y-1.5 rounded-2xl bg-white p-4 shadow-sm">
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold ${e.clase}`}>{e.label}</span>
        <h1 className="text-2xl font-extrabold tracking-tight">{p.titulo}</h1>
        {p.detalle && <p className="whitespace-pre-wrap text-[15px] text-tinta/85">{p.detalle}</p>}
        <p className="text-sm text-piedra">
          {p.pedido_por ? `Lo pidió ${nombres.get(p.pedido_por) ?? "—"}` : "Pedido"} el {fechaCorta(p.created_at)}
          {p.para_fecha ? ` · lo necesita para el ${fechaCorta(p.para_fecha)}` : ""}
          {p.tomado_por ? ` · lo hace ${nombres.get(p.tomado_por) ?? "marketing"}` : ""}
          {p.fecha_comprometida ? ` · lo da el ${fechaCorta(p.fecha_comprometida)}` : ""}
        </p>
        <p className="text-xs text-piedra">{e.detalle}</p>
      </div>

      {estado === "cambios" && p.correccion && (
        <div className="rounded-2xl border border-naranja/30 bg-naranja-soft p-4">
          <p className="text-[14px] font-extrabold text-naranja">
            Dirección pidió cambios{p.revisado_por ? ` (${nombres.get(p.revisado_por) ?? ""}` : ""}
            {p.revisado_at ? `, ${fechaCorta(p.revisado_at)})` : p.revisado_por ? ")" : ""}:
          </p>
          <p className="whitespace-pre-wrap text-[15px]">{p.correccion}</p>
        </div>
      )}
      {estado === "aprobado" && (
        <div className="space-y-1 rounded-2xl border border-verde/30 bg-verde-soft p-4">
          <p className="text-[15px] font-extrabold text-verde">
            ✓ Aprobado{p.revisado_por ? ` por ${nombres.get(p.revisado_por) ?? "dirección"}` : ""}
            {p.revisado_at ? ` el ${fechaCorta(p.revisado_at)}` : ""}
          </p>
          {destino && (
            <Link href={destino.href} className="inline-flex min-h-10 items-center gap-1.5 text-[15px] font-bold text-marino underline">
              <FolderOpen className="h-4 w-4" /> Quedó en Material: {destino.etiqueta}
            </Link>
          )}
        </div>
      )}

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-xs font-extrabold tracking-[0.15em] text-piedra">LO QUE HIZO MARKETING</h2>
        {estado === "aprobado" || estado === "entregado" ? (
          archivos.length ? (
            <EspacioArchivos dueno="espacio" duenoId={p.espacio_destino_id ?? p.id} espacio="propio" archivos={archivos} puedeGestionar={false} />
          ) : (
            <p className="text-[15px] text-piedra">{estado === "entregado" ? "Se entregó antes de que hubiera archivos en el pedido." : "Sin archivos."}</p>
          )
        ) : (
          <EspacioArchivos
            dueno="pedido"
            duenoId={p.id}
            espacio="entrega"
            archivos={entregados}
            puedeGestionar={hacePedidos && sePuedeTrabajar(p.estado)}
            vacio={hacePedidos ? "Subí acá lo que hiciste (imágenes, videos, PDF…)." : "Marketing todavía no subió nada."}
          />
        )}
      </section>

      <AccionesPedido
        pedido={p}
        hacePedidos={hacePedidos}
        esDireccion={puesto === "direccion"}
        esMio={p.pedido_por === user?.id}
        archivos={entregados.length}
        espacios={espacios.map(({ id: espId, etiqueta }) => ({ id: espId, etiqueta }))}
      />
    </div>
  );
}
