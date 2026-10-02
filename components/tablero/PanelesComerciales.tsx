import Link from "next/link";
import Montos from "@/components/Montos";
import { ESTADOS_REPUESTO } from "@/lib/repuestos";
import type { ReportesComerciales } from "@/lib/servidor/reportes";

const tile = "rounded-2xl bg-white p-4 shadow-sm";
const titulo = "text-[11px] font-bold uppercase tracking-wide text-piedra";
const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);

/**
 * Paneles comerciales del tablero (v1.7): control (lo que necesita atención),
 * actividad (intentos contra conversaciones), agenda, consumibles y
 * repuestos. Los importes siempre por moneda, sin mezclar pesos y dólares.
 */
export default function PanelesComerciales({
  r,
  linea,
  etiqueta,
}: {
  r: ReportesComerciales;
  /** Apartado elegido (null = consolidado). */
  linea: string | null;
  etiqueta: string;
}) {
  const a = r.actividad;
  const verConsumibles = !linea || linea === "consumibles";
  const verRepuestos = !linea || linea === "repuestos";
  return (
    <div className="space-y-5">
      {/* Control */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Control: lo que necesita atención hoy</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Link href="/hoy" className={`${tile} hover:ring-1 hover:ring-borde`}>
            <p className={titulo}>Consultas sin atender</p>
            <p className={`mt-1 text-2xl font-extrabold ${r.control.sinAtender ? "text-red-600" : ""}`}>{r.control.sinAtender}</p>
            <p className="text-xs text-piedra">asignadas sin primer contacto</p>
          </Link>
          <Link href="/hoy" className={`${tile} hover:ring-1 hover:ring-borde`}>
            <p className={titulo}>Sin próximo paso</p>
            <p className={`mt-1 text-2xl font-extrabold ${r.control.sinProximo ? "text-ambar" : ""}`}>{r.control.sinProximo}</p>
            <p className="text-xs text-piedra">operaciones abiertas sin fecha</p>
          </Link>
          <div className={tile}>
            <p className={titulo}>Tareas de la agenda · {etiqueta}</p>
            <p className="mt-1 text-2xl font-extrabold">
              {r.agenda.completadas}
              <span className="text-base font-semibold text-piedra"> / {r.agenda.delPeriodo} hechas</span>
            </p>
            <p className={`text-xs ${r.agenda.vencidas ? "font-bold text-ambar" : "text-piedra"}`}>{r.agenda.vencidas} vencidas sin hacer</p>
          </div>
          <div className={tile}>
            <p className={titulo}>Contacto efectivo · {etiqueta}</p>
            <p className="mt-1 text-2xl font-extrabold">{pct(a.efectividad)}</p>
            <p className="text-xs text-piedra">
              {a.conversaciones} conversaciones de {a.intentos} intentos
            </p>
          </div>
        </div>
        {r.control.porVendedor.length > 0 && (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-piedra">
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2 text-right">Sin atender</th>
                  <th className="px-3 py-2 text-right">Sin próximo paso</th>
                </tr>
              </thead>
              <tbody>
                {r.control.porVendedor.map((v) => (
                  <tr key={v.id} className="border-b border-borde/60 last:border-0">
                    <td className="px-3 py-2 font-semibold">{v.nombre}</td>
                    <td className={`px-3 py-2 text-right ${v.sinAtender ? "font-bold text-red-600" : ""}`}>{v.sinAtender}</td>
                    <td className={`px-3 py-2 text-right ${v.sinProximo ? "font-bold text-ambar" : ""}`}>{v.sinProximo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Actividad comercial */}
      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-piedra">Actividad comercial · {etiqueta}</h2>
        {a.intentos === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-4 text-[15px] text-piedra shadow-sm">
            Todavía no hay contactos registrados con medio y resultado en este período. Se cuentan desde “Registrar actividad” (llamada, WhatsApp, email, visita, demo).
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className={tile}>
              <p className={`${titulo} mb-2`}>Por medio</p>
              <ul className="space-y-1 text-[14px]">
                {a.porMedio.map((m) => (
                  <li key={m.medio} className="flex justify-between gap-2">
                    <span>{m.medio}</span>
                    <span className="text-piedra">
                      <span className="font-bold text-tinta">{m.conversaciones}</span> conversaciones de {m.intentos} intentos
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={tile}>
              <p className={`${titulo} mb-2`}>Por vendedor</p>
              <ul className="space-y-1 text-[14px]">
                {a.porVendedor.map((v) => (
                  <li key={v.id} className="flex justify-between gap-2">
                    <span className="font-semibold">{v.nombre}</span>
                    <span className="text-piedra">
                      {v.intentos} intentos · <span className="font-bold text-tinta">{v.conversaciones}</span> conversaciones ({pct(v.intentos ? v.conversaciones / v.intentos : null)})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <p className="text-xs text-piedra">Un llamado sin respuesta o un mensaje sin contestar es un intento, no una conversación.</p>
      </section>

      {/* Consumibles y repuestos */}
      {(verConsumibles || verRepuestos) && (
        <section className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {verConsumibles && (
            <Link href="/consumibles" className={`${tile} block hover:ring-1 hover:ring-borde`}>
              <p className={titulo}>Consumibles · {etiqueta}</p>
              <p className="mt-1 text-[15px]">
                <span className="text-2xl font-extrabold">{r.consumibles.ventas}</span> ventas
              </p>
              <div className="text-[15px] font-bold">
                {Object.keys(r.consumibles.vendido).length ? <Montos por={r.consumibles.vendido} inline /> : <span className="font-normal text-piedra">sin montos cargados</span>}
              </div>
              <p className="mt-1 text-[14px] text-piedra">
                <span className={r.consumibles.paraContactar ? "font-bold text-ambar" : ""}>{r.consumibles.paraContactar} reposiciones para contactar</span> ·{" "}
                {r.consumibles.proximos30} en los próximos 30 días · {r.consumibles.suspendidos} suspendidas
              </p>
            </Link>
          )}
          {verRepuestos && (
            <Link href="/repuestos" className={`${tile} block hover:ring-1 hover:ring-borde`}>
              <p className={titulo}>Repuestos</p>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 text-[14px]">
                {ESTADOS_REPUESTO.filter((e) => !["ganada", "perdida"].includes(e.value)).map((e) => (
                  <li key={e.value} className="flex justify-between">
                    <span className="text-piedra">{e.label}</span>
                    <span className={`font-bold ${e.value === "validacion" && r.repuestos.porEstado.validacion ? "text-violeta" : ""}`}>{r.repuestos.porEstado[e.value]}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[14px] text-piedra">
                Cotizado esperando al cliente: {Object.keys(r.repuestos.cotizadoAbierto).length ? <Montos por={r.repuestos.cotizadoAbierto} inline /> : "—"}
              </p>
              <p className="text-[14px] text-piedra">
                {etiqueta}: {r.repuestos.ganadas} ganadas · {r.repuestos.perdidas} perdidas
              </p>
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
