import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { armarPdfCotizacion } from "@/lib/servidor/cotizacion-pdf";
import { calcularTotales } from "@/lib/cotizacion-pdf";
import type { DatosCotizacionPdf } from "@/lib/pdf/CotizacionPdf";

const items = [
  { codigo: "10216-G", descripcion: "VERSATILE PRO - ORANGE", detalle: "DIM. 480X550X890MM - PROD. 28 FRUTAS X MINUTO - POT. 380W-220V", cantidad: 1, precio: 6611, total: 6611 },
  { codigo: "11845", descripcion: "VERSATILE STAR - BLACK", detalle: "DIM. 480X550X1734MM - PROD. 40 FRUTAS X MINUTO - POT. 360W-220V", cantidad: 1, precio: 8077.6, total: 8077.6 },
];

const datos: DatosCotizacionPdf = {
  empresa: {
    razonSocial: "EMPRESA DE PRUEBA S.A.",
    telefono: "0000000000",
    direccion: "CALLE 123",
    localidad: "CIUDAD",
    email: "info@ejemplo.com",
    condicionIva: "Responsable Inscripto",
    cuit: "30-00000000-0",
    iibb: "30-00000000-0",
    inicioActividades: "01/01/2025",
  },
  logoUrl: null,
  numero: "0007 - 00000315",
  version: 1,
  fecha: "15/05/2026",
  cliente: { nombre: "CLIENTE DE PRUEBA S.A.", cuit: "30-11111111-1", domicilio: "CALLE 566", localidad: "Ciudad, Provincia", condicionIva: "Responsable Inscripto" },
  vendedor: "Comercial",
  formaPago: "Contado",
  moneda: "USD",
  items,
  totales: calcularTotales(items.map((i) => ({ cantidad: i.cantidad, precio_unit: i.precio })), { total: 14688.6, iva_pct: 10.5 }),
  vigenciaDias: 7,
  plazoEntrega: "A revisar",
  condicionEntrega: "A cargo del cliente",
  observaciones: null,
  leyendaDolar: "El monto de los ítems equivale a US$16.230,90. El cliente podrá abonar los ítems en pesos argentinos.",
  tipoCambio: 1405,
};

/** Storage falso: devuelve la ficha que le pasen. */
const storage = (ficha: Uint8Array | null) =>
  ({ storage: { from: () => ({ download: async () => ({ data: ficha ? new Blob([ficha as BlobPart]) : null }) }) } }) as never;

describe("PDF de la cotización", () => {
  it("dibuja la cotización y anexa las fichas", async () => {
    const sola = await armarPdfCotizacion(storage(null), datos, []);
    expect(new TextDecoder().decode(sola.slice(0, 5))).toBe("%PDF-");
    expect((await PDFDocument.load(sola)).getPageCount()).toBe(1);
    if (process.env.PDF_SALIDA) writeFileSync(process.env.PDF_SALIDA, sola);

    // Una ficha en PDF de 2 hojas: se suman al final
    const ficha = await PDFDocument.create();
    ficha.addPage();
    ficha.addPage();
    const conFicha = await armarPdfCotizacion(storage(await ficha.save()), datos, [{ nombre: "ficha.pdf", path: "producto/x/ficha.pdf", producto: "VERSATILE PRO", bucket: "documentos" }]);
    expect((await PDFDocument.load(conFicha)).getPageCount()).toBe(3);

    // Una ficha rota se saltea sin romper la cotización
    const rota = await armarPdfCotizacion(storage(new Uint8Array([1, 2, 3])), datos, [{ nombre: "rota.pdf", path: "producto/x/rota.pdf", producto: "X", bucket: "material" }]);
    expect((await PDFDocument.load(rota)).getPageCount()).toBe(1);
  }, 30_000);
});
