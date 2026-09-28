import { textoMontos } from "@/lib/dinero";
import type { Periodo, Tablero } from "@/lib/tablero";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const comparar = (actual: number, anterior: number) => {
  if (anterior === 0) return actual === 0 ? "igual que la semana anterior" : `la semana anterior: 0`;
  const v = Math.round(((actual - anterior) / anterior) * 100);
  if (v === 0) return "igual que la semana anterior";
  return `${v > 0 ? "+" : ""}${v} % vs la semana anterior (${anterior})`;
};

/**
 * Email del resumen semanal a dirección (Etapa 2, 2.5). HTML simple con
 * tablas y estilos en línea, para que se vea bien en Gmail y en el celular.
 */
export function htmlResumenSemanal(t: Tablero, per: Periodo, urlBase: string): { asunto: string; html: string } {
  const n = t.negocio;
  const asunto = `Resumen semanal GastroWare · ${per.etiqueta.toLowerCase()}`;
  const celda = "padding:10px 12px;border-bottom:1px solid #e9e6de;font-size:14px;";
  const titulo = (s: string) =>
    `<p style="margin:22px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6b6f76;font-weight:700">${s}</p>`;
  const cuadro = (etiqueta: string, valor: string, detalle: string) => `
    <td style="width:50%;padding:6px;vertical-align:top">
      <div style="background:#ffffff;border-radius:12px;padding:12px 14px">
        <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6b6f76;font-weight:700">${etiqueta}</div>
        <div style="font-size:22px;font-weight:800;color:#17181c;margin-top:2px">${valor}</div>
        <div style="font-size:13px;color:#6b6f76;margin-top:2px">${detalle}</div>
      </div>
    </td>`;

  const filasVendedor = t.vendedores
    .map(
      (f) => `<tr>
        <td style="${celda}font-weight:700">${esc(f.nombre)}</td>
        <td style="${celda}text-align:right">${f.atendidos}</td>
        <td style="${celda}text-align:right">${f.vendidos ? esc(textoMontos(f.vendido)) : "—"}<br><span style="color:#6b6f76;font-size:12px">${f.vendidos} venta${f.vendidos === 1 ? "" : "s"}</span></td>
        <td style="${celda}text-align:right;${f.atrasados ? "color:#c67c10;font-weight:700" : ""}">${f.atrasados}</td>
      </tr>`
    )
    .join("");

  const alertas = t.alertas.length
    ? t.alertas
        .slice(0, 8)
        .map((a) => `<li style="margin:0 0 6px">${esc(a.texto)}</li>`)
        .join("")
    : `<li style="margin:0;color:#1f9d5b;font-weight:700">Sin alertas.</li>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f2ec;font-family:Arial,Helvetica,sans-serif;color:#17181c">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ec"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
    <tr><td style="background:#17233a;border-radius:14px;padding:18px 20px;color:#ffffff">
      <div style="font-size:13px;color:#a4daee;font-weight:700">GastroWare OS · Resumen semanal</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px">${esc(per.etiqueta)}</div>
      <div style="font-size:13px;color:#c9d3e6;margin-top:2px">Del lunes al domingo, comparado con la semana anterior</div>
    </td></tr>
    <tr><td>
      ${titulo("La semana")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${cuadro("Vendido", esc(textoMontos(n.vendido)), `${n.vendidos} venta${n.vendidos === 1 ? "" : "s"} · ${comparar(n.vendidos, n.vendidosAnt)}`)}
        ${cuadro("Intereses nuevos", String(n.nuevos), comparar(n.nuevos, n.nuevosAnt))}
      </tr><tr>
        ${cuadro("Cotizaciones", String(n.cotizaciones), comparar(n.cotizaciones, n.cotizacionesAnt))}
        ${cuadro("No se dieron", String(n.perdidas), n.tasaCierre === null ? "sin cierres" : `tasa de cierre ${Math.round(n.tasaCierre * 100)} %`)}
      </tr></table>
      ${titulo("Cómo está hoy")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${cuadro("Intereses abiertos", String(n.abiertos), `${esc(Object.keys(n.montoAbierto).length ? textoMontos(n.montoAbierto) : "sin montos cotizados")} · ponderado ${esc(Object.keys(n.ponderado).length ? textoMontos(n.ponderado) : "—")}`)}
        ${cuadro("Atrasados", String(n.atrasados), n.atrasados ? `en ${n.vendedoresConAtrasados} vendedor${n.vendedoresConAtrasados === 1 ? "" : "es"}` : "nadie tiene atrasados")}
      </tr></table>
      ${titulo("Alertas")}
      <div style="background:#fbeed2;border-radius:12px;padding:12px 14px 6px"><ul style="margin:0;padding-left:18px;font-size:14px">${alertas}</ul></div>
      ${
        t.vendedores.length
          ? `${titulo("Por vendedor")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px">
        <tr style="color:#6b6f76;font-size:11px;text-transform:uppercase;letter-spacing:.05em">
          <td style="${celda}">Vendedor</td><td style="${celda}text-align:right">Atendidos</td><td style="${celda}text-align:right">Vendido</td><td style="${celda}text-align:right">Atrasados</td>
        </tr>${filasVendedor}
      </table>`
          : ""
      }
      <p style="margin:24px 0 8px;text-align:center">
        <a href="${urlBase}/tablero" style="display:inline-block;background:#1f9d5b;color:#ffffff;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:12px">Abrir el tablero</a>
      </p>
      <p style="margin:8px 0 0;text-align:center;font-size:12px;color:#6b6f76">Llega los lunes a la mañana a dirección. Los números salen del CRM en el momento del envío.</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
  return { asunto, html };
}
