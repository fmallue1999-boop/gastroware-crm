"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search } from "lucide-react";
import { buscarClientes, registrarVentaConsumibles, sucursalesDe } from "@/lib/actions";
import { ANTICIPACION_POR_DEFECTO, fechaContacto, UNIDADES } from "@/lib/consumibles";
import { dinero, fechaCorta, telefonoProlijo } from "@/lib/format";
import { precioEn } from "@/lib/precios";
import ClienteNuevoRapido from "@/components/ClienteNuevoRapido";
import type { Cliente } from "@/lib/types";

export type ProductoConsumible = {
  id: string;
  nombre: string;
  frecuencia_recompra_dias: number | null;
  precio_referencia?: number | null;
  moneda?: string | null;
  precio_ars?: number | null;
  precio_usd?: number | null;
};
export type PlanExistente = { producto_id: string; sucursal_id: string | null; frecuencia_dias: number | null; anticipacion_dias: number; responsable_id: string | null };
type Sucursal = { id: string; nombre: string; ciudad: string | null };
type Item = { cantidad: string; unidad: string; frecuencia: string; anticipacion: string; sinTiempo: boolean; fechaContacto: string };

const cls = "min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-[15px] outline-none focus:border-marino";
const seccion = "text-xs font-bold uppercase tracking-wide text-piedra";

/**
 * Venta de consumibles: cliente, productos con cantidad y, para cada uno,
 * cada cuánto repone (viene del producto o de lo que ya se ajustó para este
 * cliente) y cuántos días antes contactarlo. El plazo se reinicia desde la
 * fecha de compra; se muestra cuándo se lo va a contactar.
 */
export default function VentaConsumiblesForm({
  productos,
  usuarios,
  hoy,
  yo,
  clienteInicial,
  sucursalesIniciales = [],
  sucursalInicial,
  planes = [],
  productosIniciales = [],
}: {
  productos: ProductoConsumible[];
  usuarios: { id: string; nombre: string; rol: string }[];
  hoy: string;
  yo: string;
  clienteInicial?: { id: string; nombre: string } | null;
  sucursalesIniciales?: Sucursal[];
  sucursalInicial?: string | null;
  planes?: PlanExistente[];
  productosIniciales?: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cliente, setCliente] = useState<{ id: string; nombre: string } | null>(clienteInicial ?? null);
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>(sucursalesIniciales);
  const [sucursalId, setSucursalId] = useState<string>(sucursalInicial ?? "");
  const [fecha, setFecha] = useState(hoy);
  const planDe = (productoId: string, suc: string) => planes.find((p) => p.producto_id === productoId && (p.sucursal_id ?? "") === suc);
  const itemNuevo = (productoId: string, suc = sucursalId): Item => {
    const plan = planDe(productoId, suc);
    const prod = productos.find((p) => p.id === productoId);
    const frec = plan?.frecuencia_dias ?? prod?.frecuencia_recompra_dias ?? null;
    return {
      cantidad: "1",
      unidad: "unidades",
      frecuencia: frec ? String(frec) : "",
      anticipacion: String(plan?.anticipacion_dias ?? ANTICIPACION_POR_DEFECTO),
      sinTiempo: !frec,
      fechaContacto: "",
    };
  };
  const [items, setItems] = useState<Record<string, Item>>(() =>
    Object.fromEntries(productosIniciales.filter((id) => productos.some((p) => p.id === id)).map((id) => [id, itemNuevo(id, sucursalInicial ?? "")]))
  );
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<"ARS" | "USD">("ARS");
  const responsablePlan = planes.find((p) => p.responsable_id)?.responsable_id;
  const administrativa = usuarios.find((u) => u.rol === "administrativa")?.id;
  const [responsable, setResponsable] = useState<string>(responsablePlan ?? administrativa ?? yo);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buscar(texto: string) {
    setQ(texto);
    if (timer.current) clearTimeout(timer.current);
    if (texto.trim().length < 2) return setResultados([]);
    timer.current = setTimeout(async () => setResultados(await buscarClientes(texto)), 250);
  }

  async function elegirCliente(c: { id: string; nombre: string }) {
    setCliente(c);
    setResultados([]);
    setQ("");
    setNuevo(false);
    const s = await sucursalesDe(c.id);
    setSucursales(s);
    setSucursalId("");
  }

  function alternar(id: string) {
    setItems((actual) => {
      const copia = { ...actual };
      if (copia[id]) delete copia[id];
      else copia[id] = itemNuevo(id);
      return copia;
    });
  }

  const cambiar = (id: string, campo: Partial<Item>) => setItems((a) => ({ ...a, [id]: { ...a[id], ...campo } }));

  const contactoDe = (it: Item) =>
    it.sinTiempo ? it.fechaContacto || "" : fechaContacto(fecha, it.frecuencia ? Number(it.frecuencia) : null, Number(it.anticipacion || 0));

  const elegidos = Object.keys(items);
  // Total de lista en la moneda elegida (si todos tienen precio en esa moneda)
  const conPrecio = elegidos.map((id) => precioEn(productos.find((p) => p.id === id), moneda));
  const totalLista = conPrecio.every((x) => x != null)
    ? elegidos.reduce((s, id, i) => s + (conPrecio[i] ?? 0) * (Number(items[id].cantidad.replace(",", ".")) || 0), 0)
    : null;
  const listo = Boolean(cliente) && elegidos.length > 0 && elegidos.every((id) => Number(items[id].cantidad) > 0);

  function guardar() {
    if (!cliente) return;
    setError(null);
    startTransition(async () => {
      const r = await registrarVentaConsumibles({
        clienteId: cliente.id,
        sucursalId: sucursalId || null,
        fecha,
        items: elegidos.map((id) => {
          const it = items[id];
          return {
            productoId: id,
            cantidad: Number(it.cantidad.replace(",", ".")),
            unidad: it.unidad,
            frecuencia: it.sinTiempo ? null : it.frecuencia ? Number(it.frecuencia) : null,
            anticipacion: Number(it.anticipacion || 0),
            fechaContacto: it.sinTiempo ? it.fechaContacto || null : null,
          };
        }),
        monto: monto.trim() ? Number(monto.replace(/\./g, "").replace(",", ".")) : null,
        moneda,
        responsableId: responsable || null,
        nota,
      });
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      router.push(`/clientes/${cliente.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Cliente */}
      <section className="space-y-2">
        <p className={seccion}>Cliente</p>
        {cliente ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-white p-3.5 shadow-sm">
            <p className="text-[16px] font-extrabold">{cliente.nombre}</p>
            {!clienteInicial && (
              <button type="button" onClick={() => setCliente(null)} className="text-sm text-azul underline">
                Cambiar
              </button>
            )}
          </div>
        ) : nuevo ? (
          <ClienteNuevoRapido onElegido={elegirCliente} onCancelar={() => setNuevo(false)} />
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
              <input type="search" value={q} onChange={(e) => buscar(e.target.value)} placeholder="Nombre, empresa o teléfono" className={`${cls} pl-10`} autoFocus />
            </div>
            {resultados.map((c) => (
              <button key={c.id} type="button" onClick={() => elegirCliente({ id: c.id, nombre: c.nombre_comercial })} className="flex min-h-12 w-full items-center rounded-2xl bg-white px-4 text-left shadow-sm">
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">{c.nombre_comercial}</span>
                  <span className="block text-xs text-piedra">{[c.ciudad, c.telefono ? telefonoProlijo(c.telefono) : null].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            ))}
            <button type="button" onClick={() => setNuevo(true)} className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-marino/40 bg-white px-4 text-[15px] font-bold text-marino">
              <Plus className="h-4 w-4" /> Cliente nuevo: cargarlo acá
            </button>
          </>
        )}
        {cliente && sucursales.length > 1 && (
          <select value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} className={cls}>
            <option value="">Sucursal: la de siempre</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
                {s.ciudad ? ` · ${s.ciudad}` : ""}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* Qué compró */}
      <section className="space-y-2">
        <p className={seccion}>¿Qué compró?</p>
        {productos.length === 0 && <p className="text-[15px] text-piedra">No hay consumibles en el catálogo (Administración → Catálogo).</p>}
        {productos.map((p) => {
          const it = items[p.id];
          const contacto = it ? contactoDe(it) : "";
          return (
            <div key={p.id} className={`rounded-2xl border p-3 ${it ? "border-marino bg-white" : "border-borde bg-white"}`}>
              <button type="button" onClick={() => alternar(p.id)} className="flex w-full items-center justify-between gap-2 text-left">
                <span className="text-[15px] font-bold">{p.nombre}</span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${it ? "bg-marino text-white" : "border border-borde"}`}>{it && <Check className="h-4 w-4" />}</span>
              </button>
              {it && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input inputMode="decimal" value={it.cantidad} onChange={(e) => cambiar(p.id, { cantidad: e.target.value })} placeholder="Cantidad" className={cls} aria-label="Cantidad" />
                    <select value={it.unidad} onChange={(e) => cambiar(p.id, { unidad: e.target.value })} className={cls} aria-label="Unidad">
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  {it.sinTiempo ? (
                    <div className="space-y-1.5">
                      <label className="block text-[14px] font-bold">
                        Todavía no se sabe cada cuánto repone: contactar el
                        <input type="date" min={hoy} value={it.fechaContacto} onChange={(e) => cambiar(p.id, { fechaContacto: e.target.value })} className={cls} />
                      </label>
                      <button type="button" onClick={() => cambiar(p.id, { sinTiempo: false })} className="text-[14px] text-azul underline">
                        Poner cada cuántos días repone
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[14px] font-bold">
                        Repone cada (días)
                        <input type="number" min={1} max={730} value={it.frecuencia} onChange={(e) => cambiar(p.id, { frecuencia: e.target.value })} className={cls} />
                      </label>
                      <label className="text-[14px] font-bold">
                        Contactar antes (días)
                        <input type="number" min={0} max={90} value={it.anticipacion} onChange={(e) => cambiar(p.id, { anticipacion: e.target.value })} className={cls} />
                      </label>
                    </div>
                  )}
                  <p className="text-[14px] font-bold text-verde">
                    {contacto ? `Próximo contacto: ${fechaCorta(contacto)}` : "Elegí la fecha de contacto"}
                    {!it.sinTiempo && it.frecuencia ? <span className="font-normal text-piedra"> · el plazo se reinicia desde esta compra</span> : null}
                  </p>
                  {!it.sinTiempo && (
                    <button type="button" onClick={() => cambiar(p.id, { sinTiempo: true })} className="text-[14px] text-azul underline">
                      No sé cada cuánto: poner la fecha a mano
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Datos de la venta */}
      <section className="space-y-2">
        <p className={seccion}>La venta</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="text-[14px] font-bold">
            Fecha de compra
            <input type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={cls} />
          </label>
          <label className="text-[14px] font-bold">
            Monto (opcional)
            <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} className={cls} />
          </label>
          <label className="text-[14px] font-bold">
            Moneda
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as "ARS" | "USD")} className={cls}>
              <option value="ARS">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
          </label>
        </div>
        <label className="block text-[14px] font-bold">
          A cargo del seguimiento de la reposición
          <select value={responsable} onChange={(e) => setResponsable(e.target.value)} className={cls}>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === yo ? `${u.nombre} (vos)` : u.nombre}
              </option>
            ))}
          </select>
        </label>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" className={cls} />
        {elegidos.length > 0 && (
          <p className="text-[14px] text-piedra">
            {totalLista != null ? (
              <>
                Lista: <span className="font-bold text-tinta">{dinero(totalLista, moneda)}</span>{" "}
                <button type="button" onClick={() => setMonto(String(Math.round(totalLista * 100) / 100))} className="font-bold text-marino underline">
                  Usar
                </button>
              </>
            ) : (
              `Algún producto no tiene precio de lista en ${moneda === "USD" ? "dólares" : "pesos"}: poné el monto a mano.`
            )}
          </p>
        )}
        <p className="text-xs text-piedra">
          La venta sigue el circuito de siempre (facturar, cobrar, entregar). El aviso de reposición no manda nada al cliente: le avisa a quien
          está a cargo cuándo contactarlo.
        </p>
      </section>

      {error && <p className="text-[15px] font-bold text-red-600">{error}</p>}
      <button type="button" disabled={!listo || pending} onClick={guardar} className="min-h-12 w-full rounded-2xl bg-verde text-[16px] font-extrabold text-white disabled:opacity-50">
        {pending ? "Guardando…" : "Registrar venta"}
      </button>
    </div>
  );
}
