import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { nombreCategoria, nombreMedio, rangoMes } from "@/lib/viaticos";
import { gastosDelMes } from "@/lib/servidor/viaticos";

const ESTADO_GASTO = (decision: string | null, rendido: boolean) =>
  decision === "aprobado" ? "Aprobado" : decision === "rechazado" ? "Rechazado" : rendido ? "Para aprobar" : "Sin rendir";

/** Una celda que empieza con = + - @ Excel la toma como fórmula: queda como texto. */
const texto = (s: string | null | undefined) => {
  const v = s ?? "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
};

/**
 * Excel de viáticos del mes (v1.25): un renglón por gasto. Dirección y
 * administración bajan los de todos; el resto, los suyos.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const mesParam = new URL(request.url).searchParams.get("mes") ?? "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7);
  const { data: rol } = await supabase.rpc("fn_rol");
  const todos = ["direccion", "admin", "administrativa"].includes((rol as string) ?? "");
  const { desde, hasta } = rangoMes(mes);
  const gastos = await gastosDelMes(supabase, desde, hasta, todos ? undefined : user.id);

  const filas = gastos.map((g) => ({
    Fecha: g.fecha.split("-").reverse().join("/"),
    Persona: texto(g.usuario?.nombre),
    Tipo: nombreCategoria(g.categoria),
    Importe: Number(g.importe),
    Moneda: g.moneda,
    "Cómo se pagó": nombreMedio(g.medio_pago),
    Comercio: texto(g.comercio),
    CUIT: texto(g.cuit),
    Comprobante: texto([g.tipo_comprobante, g.numero_comprobante].filter(Boolean).join(" ")),
    IVA: g.iva == null ? "" : Number(g.iva),
    Cliente: texto(g.cliente?.nombre_comercial),
    Detalle: texto(g.detalle),
    Estado: ESTADO_GASTO(g.decision, Boolean(g.rendicion_id)),
    "Motivo del rechazo": texto(g.motivo_rechazo),
    Rendición: g.rendicion ? g.rendicion.numero : "",
    Reintegrado: g.rendicion?.reintegro_fecha ? g.rendicion.reintegro_fecha.split("-").reverse().join("/") : "",
    "Con comprobante": g.archivo_path ? "Sí" : "No",
  }));

  const hoja = XLSX.utils.json_to_sheet(filas, {
    header: ["Fecha", "Persona", "Tipo", "Importe", "Moneda", "Cómo se pagó", "Comercio", "CUIT", "Comprobante", "IVA", "Cliente", "Detalle", "Estado", "Motivo del rechazo", "Rendición", "Reintegrado", "Con comprobante"],
  });
  hoja["!cols"] = [10, 18, 14, 12, 7, 20, 24, 15, 20, 10, 24, 30, 13, 24, 10, 11, 10].map((wch) => ({ wch }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Viáticos");
  const buffer = XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="viaticos-${mes}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
