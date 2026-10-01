import { readFile } from "node:fs/promises";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import CotizacionPdf, { type DatosCotizacionPdf } from "@/lib/pdf/CotizacionPdf";
import { calcularTotales, leyendaDolar, nombreArchivo, numeroComprobante, tipoAnexo } from "@/lib/cotizacion-pdf";
import { CONDICIONES_FISCALES } from "@/lib/constants";
import { cuitProlijo } from "@/lib/datos-cotizar";
import type { SupabaseServidor } from "@/lib/actions/comun";
import type { CotizacionVersion } from "@/lib/types";

/**
 * Arma el PDF de una cotización (v1.8): la cotización dibujada con
 * @react-pdf/renderer y, al final, las fichas (PDF o imagen) cargadas en el
 * catálogo para cada producto cotizado, unidas con pdf-lib.
 * Todo con la sesión del usuario: si no puede ver la cotización, no hay PDF.
 */

let fuentesListas: Promise<void> | null = null;

/** Manrope (la tipografía del sistema), leída del disco una sola vez. */
function registrarFuentes() {
  fuentesListas ??= (async () => {
    const pesos = [400, 600, 700, 800] as const;
    const archivos = await Promise.all(
      pesos.map((p) => readFile(path.join(process.cwd(), "lib", "pdf", "fuentes", `manrope-${p}.woff`)))
    );
    Font.register({
      family: "Manrope",
      fonts: pesos.map((p, i) => ({ src: `data:font/woff;base64,${archivos[i].toString("base64")}`, fontWeight: p })),
    });
    // Sin cortar palabras con guiones
    Font.registerHyphenationCallback((palabra) => [palabra]);
  })().catch((e) => {
    fuentesListas = null;
    throw e;
  });
  return fuentesListas;
}

const CLAVES = [
  "empresa_razon_social",
  "empresa_telefono",
  "empresa_direccion",
  "empresa_localidad",
  "empresa_email",
  "empresa_condicion_iva",
  "empresa_cuit",
  "empresa_iibb",
  "empresa_inicio_actividades",
  "cotizacion_punto_venta",
  "cotizacion_leyenda_usd",
  "logo_url",
] as const;

/** Ficha a anexar: del Catálogo (bucket documentos) o de Material (bucket material, v1.11). */
type Anexo = { nombre: string; path: string; producto: string; bucket: "documentos" | "material" };

export type ResultadoCargaPdf =
  | { ok: true; datos: DatosCotizacionPdf; anexos: Anexo[]; archivo: string }
  | { ok: false; motivo: "no_encontrada" | "aprobacion"; version?: number };

const fechaAR = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

export async function cargarCotizacionPdf(supabase: SupabaseServidor, id: string, versionPedida: number | null): Promise<ResultadoCargaPdf> {
  const { data: cot } = await supabase
    .from("cotizaciones")
    .select(
      "id, numero, oportunidad:oportunidades(id, cliente_id, cliente:clientes(razon_social, nombre_comercial, cuit, condicion_fiscal), comercial:usuarios!oportunidades_comercial_id_fkey(nombre))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!cot) return { ok: false, motivo: "no_encontrada" };

  let qVer = supabase.from("cotizacion_versiones").select("*").eq("cotizacion_id", id);
  qVer = versionPedida ? qVer.eq("version", versionPedida) : qVer.order("version", { ascending: false });
  const { data: versiones } = await qVer.limit(1);
  const version = (versiones?.[0] ?? null) as CotizacionVersion | null;
  if (!version) return { ok: false, motivo: "no_encontrada" };
  // Fuera de lista: no sale hasta que dirección la apruebe
  if (version.aprobacion === "pendiente" || version.aprobacion === "rechazada") return { ok: false, motivo: "aprobacion", version: version.version };

  const opp = cot.oportunidad as unknown as {
    cliente_id: string;
    cliente: { razon_social: string | null; nombre_comercial: string; cuit: string | null; condicion_fiscal: string | null } | null;
    comercial: { nombre: string } | null;
  } | null;

  const [{ data: itemsData }, { data: cfg }, { data: sucursales }] = await Promise.all([
    supabase.from("cotizacion_items").select("*, producto:productos(*)").eq("version_id", version.id).order("id"),
    supabase.from("config").select("clave, valor").in("clave", [...CLAVES]),
    opp?.cliente_id
      ? supabase.from("sucursales").select("direccion, ciudad, provincia, es_principal").eq("cliente_id", opp.cliente_id).order("es_principal", { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as { direccion: string | null; ciudad: string | null; provincia: string | null }[] }),
  ]);
  const conf = new Map((cfg ?? []).map((c) => [c.clave as string, ((c.valor as string | null) ?? "").trim()]));
  const c = (k: (typeof CLAVES)[number]) => conf.get(k) ?? "";

  type ItemFila = {
    producto_id: string | null;
    descripcion: string;
    cantidad: number;
    precio_unit: number;
    codigo?: string | null;
    detalle?: string | null;
    producto: { nombre: string; codigo?: string | null; detalle_tecnico?: string | null } | null;
  };
  const items = (itemsData ?? []) as ItemFila[];
  const totales = calcularTotales(items, version);
  const moneda = version.moneda === "USD" ? "USD" : "ARS";
  const numero = numeroComprobante(c("cotizacion_punto_venta"), cot.numero as number);
  const suc = sucursales?.[0];
  const cliente = opp?.cliente ?? null;
  const nombreCliente = cliente?.razon_social?.trim() || cliente?.nombre_comercial || "Cliente";
  const logo = c("logo_url");

  const datos: DatosCotizacionPdf = {
    empresa: {
      razonSocial: c("empresa_razon_social") || "GastroWare",
      telefono: c("empresa_telefono"),
      direccion: c("empresa_direccion"),
      localidad: c("empresa_localidad"),
      email: c("empresa_email"),
      condicionIva: c("empresa_condicion_iva"),
      cuit: c("empresa_cuit"),
      iibb: c("empresa_iibb"),
      inicioActividades: c("empresa_inicio_actividades"),
    },
    // Solo PNG/JPG (el PDF no dibuja un SVG externo; sin logo propio va el de la marca)
    logoUrl: /^https:\/\/\S+\.(png|jpe?g)(\?\S*)?$/i.test(logo) ? logo : null,
    numero,
    version: version.version,
    fecha: fechaAR(version.created_at),
    cliente: {
      nombre: nombreCliente,
      cuit: cliente?.cuit ? cuitProlijo(cliente.cuit) : null,
      domicilio: suc?.direccion ?? null,
      localidad: [suc?.ciudad, suc?.provincia].filter(Boolean).join(", ") || null,
      condicionIva: CONDICIONES_FISCALES.find((f) => f.value === cliente?.condicion_fiscal)?.label ?? null,
    },
    vendedor: opp?.comercial?.nombre ?? null,
    formaPago: version.forma_pago,
    moneda,
    items: items.map((i) => ({
      codigo: i.codigo ?? i.producto?.codigo ?? null,
      descripcion: i.descripcion,
      detalle: i.detalle ?? i.producto?.detalle_tecnico ?? null,
      cantidad: Number(i.cantidad),
      precio: Number(i.precio_unit),
      total: Math.round(Number(i.cantidad) * Number(i.precio_unit) * 100) / 100,
    })),
    totales,
    vigenciaDias: version.vigencia_dias,
    plazoEntrega: version.plazo_entrega ?? null,
    condicionEntrega: version.condicion_entrega ?? null,
    observaciones: version.condiciones,
    leyendaDolar: moneda === "USD" ? leyendaDolar(c("cotizacion_leyenda_usd"), totales.total) || null : null,
    tipoCambio: version.tipo_cambio != null ? Number(version.tipo_cambio) : null,
  };

  // Fichas de los productos cotizados, en el orden de las líneas y sin repetir
  const idsProductos = [...new Set(items.map((i) => i.producto_id).filter(Boolean))] as string[];
  const [{ data: docs }, { data: vinculados }] = idsProductos.length
    ? await Promise.all([
        supabase
          .from("documentos")
          .select("entidad_id, nombre, path, created_at")
          .eq("entidad", "producto")
          .eq("tipo", "ficha")
          .in("entidad_id", idsProductos)
          .order("created_at"),
        supabase.from("material_productos").select("id, producto_id").in("producto_id", idsProductos),
      ])
    : [{ data: [] }, { data: [] }];
  // La ficha cargada en Material para el producto vinculado también va
  const materialDe = new Map(((vinculados ?? []) as { id: string; producto_id: string }[]).map((v) => [v.id, v.producto_id]));
  const { data: fichasMaterial } = materialDe.size
    ? await supabase
        .from("material_archivos")
        .select("dueno_id, nombre, path")
        .eq("dueno", "producto")
        .eq("espacio", "ficha")
        .in("dueno_id", [...materialDe.keys()])
    : { data: [] };
  const nombreProducto = new Map(items.filter((i) => i.producto_id).map((i) => [i.producto_id as string, i.producto?.nombre ?? i.descripcion]));
  const anexos: Anexo[] = idsProductos.flatMap((pid) => {
    const delCatalogo = (docs ?? [])
      .filter((d) => d.entidad_id === pid && tipoAnexo(d.path as string))
      .map((d) => ({ nombre: d.nombre as string, path: d.path as string, producto: nombreProducto.get(pid) ?? "", bucket: "documentos" as const }));
    const deMaterial = ((fichasMaterial ?? []) as { dueno_id: string; nombre: string; path: string }[])
      .filter((f) => materialDe.get(f.dueno_id) === pid && tipoAnexo(f.path))
      .map((f) => ({ nombre: f.nombre, path: f.path, producto: nombreProducto.get(pid) ?? "", bucket: "material" as const }));
    // Si la misma ficha está cargada en los dos lados, va una sola vez
    const nombres = new Set(delCatalogo.map((a) => a.nombre.toLowerCase()));
    return [...delCatalogo, ...deMaterial.filter((a) => !nombres.has(a.nombre.toLowerCase()))];
  });

  return { ok: true, datos, anexos, archivo: nombreArchivo(numero, nombreCliente, version.version) };
}

const A4 = { ancho: 595.28, alto: 841.89 };

/** Dibuja la cotización y le agrega las fichas al final. Una ficha que no se puede leer se saltea. */
export async function armarPdfCotizacion(supabase: SupabaseServidor, datos: DatosCotizacionPdf, anexos: Anexo[]): Promise<Uint8Array> {
  await registrarFuentes();
  const base = await renderToBuffer(<CotizacionPdf d={datos} />);
  if (!anexos.length) return new Uint8Array(base);

  const pdf = await PDFDocument.load(base);
  const bajadas = await Promise.all(
    anexos.map(async (a) => {
      const { data } = await supabase.storage.from(a.bucket).download(a.path);
      return data ? new Uint8Array(await data.arrayBuffer()) : null;
    })
  );
  let fuente: Awaited<ReturnType<typeof pdf.embedFont>> | null = null;
  for (let k = 0; k < anexos.length; k++) {
    const bytes = bajadas[k];
    const tipo = tipoAnexo(anexos[k].path);
    if (!bytes || !tipo) continue;
    try {
      if (tipo === "pdf") {
        const ficha = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await pdf.copyPages(ficha, ficha.getPageIndices());
        paginas.forEach((p) => pdf.addPage(p));
      } else {
        // Imagen: una hoja A4 con el nombre del producto arriba y la imagen entera
        const img = tipo === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const hoja = pdf.addPage([A4.ancho, A4.alto]);
        fuente ??= await pdf.embedFont(StandardFonts.HelveticaBold);
        hoja.drawText(anexos[k].producto.slice(0, 80), { x: 34, y: A4.alto - 44, size: 11, font: fuente, color: rgb(0.07, 0.07, 0.07) });
        hoja.drawRectangle({ x: 34, y: A4.alto - 54, width: A4.ancho - 68, height: 2, color: rgb(0.643, 0.855, 0.933) });
        const caja = { ancho: A4.ancho - 68, alto: A4.alto - 110 };
        const escala = Math.min(caja.ancho / img.width, caja.alto / img.height, 1);
        const w = img.width * escala;
        const h = img.height * escala;
        hoja.drawImage(img, { x: (A4.ancho - w) / 2, y: 40 + (caja.alto - h) / 2, width: w, height: h });
      }
    } catch (e) {
      console.error("[cotizacion-pdf] ficha no se pudo anexar:", anexos[k].path, e instanceof Error ? e.message : e);
    }
  }
  return pdf.save();
}
