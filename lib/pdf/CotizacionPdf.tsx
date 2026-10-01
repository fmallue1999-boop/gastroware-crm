import { Document, G, Image, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { LOGO_PARTES, LOGO_VIEWBOX } from "@/lib/pdf/logo";
import { diasEnLetras, montoPdf, porcentaje, type TotalesCotizacion } from "@/lib/cotizacion-pdf";

/**
 * La cotización en PDF (v1.8) con la estética de GastroWare: Manrope, negro
 * y celeste de la marca. Sin hooks: la dibuja @react-pdf/renderer en el
 * servidor (lib/servidor/cotizacion-pdf.tsx registra la tipografía).
 */

export type DatosCotizacionPdf = {
  empresa: {
    razonSocial: string;
    telefono: string;
    direccion: string;
    localidad: string;
    email: string;
    condicionIva: string;
    cuit: string;
    iibb: string;
    inicioActividades: string;
  };
  /** Logo de los impresos (PNG/JPG) si está cargado; si no, el de la marca en vectores. */
  logoUrl: string | null;
  numero: string;
  version: number;
  fecha: string;
  cliente: { nombre: string; cuit: string | null; domicilio: string | null; localidad: string | null; condicionIva: string | null };
  vendedor: string | null;
  formaPago: string | null;
  moneda: string;
  items: { codigo: string | null; descripcion: string; detalle: string | null; cantidad: number; precio: number; total: number }[];
  totales: TotalesCotizacion;
  vigenciaDias: number | null;
  plazoEntrega: string | null;
  condicionEntrega: string | null;
  /** v1.14: sucursal / punto de entrega elegido (nombre, dirección, quién recibe, horario). */
  lugarEntrega?: string | null;
  observaciones: string | null;
  leyendaDolar: string | null;
  tipoCambio: number | null;
};

const C = {
  negro: "#111111",
  tinta: "#17181c",
  piedra: "#6b6f76",
  borde: "#dcd9d1",
  crema: "#f1efe7",
  celeste: "#a4daee",
  celesteSoft: "#e3f2f9",
};

const s = StyleSheet.create({
  pagina: { fontFamily: "Manrope", fontSize: 8.5, color: C.tinta, paddingTop: 30, paddingBottom: 58, paddingHorizontal: 34 },
  // Encabezado
  encabezado: { flexDirection: "row", alignItems: "flex-start" },
  colEmpresa: { flex: 1 },
  colComprobante: { width: 205, alignItems: "flex-end" },
  cajaCot: { width: 50, height: 50, marginTop: 4, marginHorizontal: 14, borderRadius: 10, backgroundColor: C.negro, alignItems: "center", justifyContent: "center" },
  cot: { color: "#ffffff", fontSize: 15, fontWeight: 800, letterSpacing: 1 },
  etiquetaCot: { fontSize: 7.5, fontWeight: 700, color: C.piedra, letterSpacing: 2.5 },
  numero: { fontSize: 15, fontWeight: 800, marginTop: 2 },
  fecha: { fontSize: 9, marginTop: 3 },
  razonSocial: { fontSize: 10, fontWeight: 800, marginTop: 8, marginBottom: 3 },
  dato: { flexDirection: "row", marginTop: 2.2 },
  datoEtiqueta: { width: 52, color: C.piedra, fontSize: 7.5 },
  datoEtiquetaDer: { color: C.piedra, fontSize: 7.5, marginRight: 4 },
  datoValor: { fontSize: 7.8 },
  condIva: { marginTop: 4, fontSize: 7.8, fontWeight: 700 },
  franja: { flexDirection: "row", marginTop: 12, marginBottom: 12, height: 3 },
  // Cliente
  cliente: { flexDirection: "row", backgroundColor: C.crema, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  clienteCol: { flex: 1 },
  campo: { flexDirection: "row", marginBottom: 3.5 },
  campoEtiqueta: { width: 66, fontSize: 7, fontWeight: 700, color: C.piedra, letterSpacing: 0.6, paddingTop: 1 },
  campoValor: { flex: 1, fontSize: 8.8 },
  clienteNombre: { flex: 1, fontSize: 10, fontWeight: 800 },
  // Tabla
  tabla: { marginTop: 14 },
  filaCab: { flexDirection: "row", backgroundColor: C.negro, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8 },
  cab: { color: "#ffffff", fontSize: 7, fontWeight: 700, letterSpacing: 0.8 },
  fila: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 8, borderBottomWidth: 0.7, borderBottomColor: C.borde },
  cCodigo: { width: 62 },
  cDesc: { flex: 1, paddingRight: 8 },
  cCant: { width: 48, textAlign: "right" },
  cPrecio: { width: 82, textAlign: "right" },
  cTotal: { width: 86, textAlign: "right" },
  codigo: { fontSize: 7.8, color: C.piedra },
  descripcion: { fontSize: 8.8, fontWeight: 700 },
  detalle: { fontSize: 7.3, color: C.piedra, marginTop: 2 },
  num: { fontSize: 8.5 },
  numFuerte: { fontSize: 8.5, fontWeight: 700 },
  // Pie de la cotización
  cierre: { flexDirection: "row", marginTop: 16 },
  notas: { flex: 1, marginRight: 16 },
  notasTitulo: { fontSize: 7, fontWeight: 800, color: C.piedra, letterSpacing: 1.5, marginBottom: 5 },
  nota: { flexDirection: "row", marginBottom: 3.5 },
  notaEtiqueta: { fontSize: 7.8, fontWeight: 700, marginRight: 3 },
  notaValor: { flex: 1, fontSize: 7.8 },
  leyenda: { marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: C.celesteSoft, fontSize: 7, lineHeight: 1.45, color: C.tinta },
  tipoCambio: { marginTop: 5, fontSize: 7.3, color: C.tinta },
  totales: { width: 215 },
  totalFila: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 10, borderBottomWidth: 0.7, borderBottomColor: C.borde },
  totalEtiqueta: { fontSize: 7.3, fontWeight: 700, color: C.piedra, letterSpacing: 0.8 },
  totalValor: { fontSize: 8.8 },
  totalFinal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.negro },
  totalFinalEtiqueta: { color: C.celeste, fontSize: 8, fontWeight: 800, letterSpacing: 1.5 },
  totalFinalValor: { color: "#ffffff", fontSize: 13, fontWeight: 800 },
  aclaracionIva: { marginTop: 4, fontSize: 6.8, color: C.piedra, textAlign: "right" },
  // Pie de página
  pie: { position: "absolute", left: 34, right: 34, bottom: 22, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1.5, borderTopColor: C.celeste, paddingTop: 6 },
  pieTexto: { fontSize: 6.8, color: C.piedra },
});

function Logo({ url }: { url: string | null }) {
  // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer no usa alt
  if (url) return <Image src={url} style={{ height: 50, objectFit: "contain", objectPosition: "left" }} />;
  const ancho = 138;
  const [, , vw, vh] = LOGO_VIEWBOX.split(" ").map(Number);
  return (
    <Svg viewBox={LOGO_VIEWBOX} width={ancho} height={(ancho * vh) / vw}>
      {LOGO_PARTES.map((p, i) => (
        <G key={i} transform={`translate(${p.x}, ${p.y})`}>
          <Path d={p.d} fill={p.fill} />
        </G>
      ))}
    </Svg>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  if (!valor) return null;
  return (
    <View style={s.dato}>
      <Text style={s.datoEtiqueta}>{etiqueta}</Text>
      <Text style={s.datoValor}>{valor}</Text>
    </View>
  );
}

function DatoDer({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  if (!valor) return null;
  return (
    <View style={s.dato}>
      <Text style={s.datoEtiquetaDer}>{etiqueta}</Text>
      <Text style={s.datoValor}>{valor}</Text>
    </View>
  );
}

function Campo({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string | null; fuerte?: boolean }) {
  return (
    <View style={s.campo}>
      <Text style={s.campoEtiqueta}>{etiqueta}</Text>
      <Text style={fuerte ? s.clienteNombre : s.campoValor}>{valor || "—"}</Text>
    </View>
  );
}

function Nota({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <View style={s.nota}>
      <Text style={s.notaEtiqueta}>{etiqueta}:</Text>
      <Text style={s.notaValor}>{valor}</Text>
    </View>
  );
}

function FilaTotal({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={s.totalFila}>
      <Text style={s.totalEtiqueta}>{etiqueta}</Text>
      <Text style={s.totalValor}>{valor}</Text>
    </View>
  );
}

export default function CotizacionPdf({ d }: { d: DatosCotizacionPdf }) {
  const $ = (n: number) => montoPdf(n, d.moneda);
  const t = d.totales;
  const cant = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return (
    <Document title={`Cotización ${d.numero} — ${d.cliente.nombre}`} author={d.empresa.razonSocial} creator="GastroWare OS" producer="GastroWare OS" language="es-AR">
      <Page size="A4" style={s.pagina}>
        {/* Encabezado: empresa · COT · comprobante */}
        <View style={s.encabezado}>
          <View style={s.colEmpresa}>
            <Logo url={d.logoUrl} />
            <Text style={s.razonSocial}>{d.empresa.razonSocial}</Text>
            <Dato etiqueta="Tel:" valor={d.empresa.telefono} />
            <Dato etiqueta="Dirección:" valor={d.empresa.direccion} />
            <Dato etiqueta="Localidad:" valor={d.empresa.localidad} />
            <Dato etiqueta="E-mail:" valor={d.empresa.email} />
            {d.empresa.condicionIva ? <Text style={s.condIva}>{d.empresa.condicionIva}</Text> : null}
          </View>
          <View style={s.cajaCot}>
            <Text style={s.cot}>COT</Text>
          </View>
          <View style={s.colComprobante}>
            <Text style={s.etiquetaCot}>COTIZACIÓN</Text>
            <Text style={s.numero}>Nº {d.numero}</Text>
            <Text style={s.fecha}>
              Fecha: {d.fecha}
              {d.version > 1 ? `  ·  Versión ${d.version}` : ""}
            </Text>
            <View style={{ marginTop: 14, alignItems: "flex-end" }}>
              <DatoDer etiqueta="C.U.I.T.:" valor={d.empresa.cuit} />
              <DatoDer etiqueta="Ing. Brutos:" valor={d.empresa.iibb} />
              <DatoDer etiqueta="Inicio de Actividades:" valor={d.empresa.inicioActividades} />
            </View>
          </View>
        </View>

        {/* Franja de la marca */}
        <View style={s.franja}>
          <View style={{ flex: 3, backgroundColor: C.negro, borderRadius: 2 }} />
          <View style={{ width: 4 }} />
          <View style={{ flex: 1, backgroundColor: C.celeste, borderRadius: 2 }} />
        </View>

        {/* Cliente */}
        <View style={s.cliente}>
          <View style={[s.clienteCol, { marginRight: 14 }]}>
            <Campo etiqueta="CLIENTE" valor={d.cliente.nombre} fuerte />
            <Campo etiqueta="CUIT" valor={d.cliente.cuit} />
            <Campo etiqueta="DOMICILIO" valor={d.cliente.domicilio} />
            <Campo etiqueta="LOCALIDAD" valor={d.cliente.localidad} />
          </View>
          <View style={[s.clienteCol, { maxWidth: 210 }]}>
            <Campo etiqueta="VENDEDOR" valor={d.vendedor} />
            <Campo etiqueta="CAT. IVA" valor={d.cliente.condicionIva} />
            <Campo etiqueta="COND. VENTA" valor={d.formaPago} />
          </View>
        </View>

        {/* Ítems */}
        <View style={s.tabla}>
          <View style={s.filaCab}>
            <Text style={[s.cab, s.cCodigo]}>CÓDIGO</Text>
            <Text style={[s.cab, s.cDesc]}>DESCRIPCIÓN</Text>
            <Text style={[s.cab, s.cCant]}>CANTIDAD</Text>
            <Text style={[s.cab, s.cPrecio]}>PRECIO</Text>
            <Text style={[s.cab, s.cTotal]}>TOTAL</Text>
          </View>
          {d.items.map((i, k) => (
            <View key={k} style={s.fila} wrap={false}>
              <Text style={[s.codigo, s.cCodigo]}>{i.codigo || "—"}</Text>
              <View style={s.cDesc}>
                <Text style={s.descripcion}>{i.descripcion}</Text>
                {i.detalle ? <Text style={s.detalle}>{i.detalle}</Text> : null}
              </View>
              <Text style={[s.num, s.cCant]}>{cant(i.cantidad)}</Text>
              <Text style={[s.num, s.cPrecio]}>{$(i.precio)}</Text>
              <Text style={[s.numFuerte, s.cTotal]}>{$(i.total)}</Text>
            </View>
          ))}
          {d.items.length === 0 && (
            <View style={s.fila}>
              <Text style={[s.descripcion, s.cDesc]}>Según lo conversado</Text>
            </View>
          )}
        </View>

        {/* Condiciones y totales */}
        <View style={s.cierre} wrap={false}>
          <View style={s.notas}>
            <Text style={s.notasTitulo}>CONDICIONES</Text>
            <Nota etiqueta="Mantenimiento de oferta" valor={d.vigenciaDias ? diasEnLetras(d.vigenciaDias) : null} />
            <Nota etiqueta="Forma de pago" valor={d.formaPago} />
            <Nota etiqueta="Plazo de entrega" valor={d.plazoEntrega} />
            <Nota etiqueta="Condición de entrega" valor={d.condicionEntrega} />
            <Nota etiqueta="Lugar de entrega" valor={d.lugarEntrega ?? null} />
            <Nota etiqueta="Observaciones" valor={d.observaciones} />
            {d.leyendaDolar ? <Text style={s.leyenda}>{d.leyendaDolar}</Text> : null}
            {d.tipoCambio ? (
              <Text style={s.tipoCambio}>
                El tipo de cambio utilizado para emitir este comprobante es de: US$ 1 = {montoPdf(d.tipoCambio, "ARS")}
              </Text>
            ) : null}
          </View>
          <View style={s.totales}>
            <FilaTotal etiqueta="SUBTOTAL" valor={$(t.subtotal)} />
            {t.descuento > 0 ? <FilaTotal etiqueta={`DESCUENTO (${porcentaje(t.descuentoPct)}%)`} valor={`− ${$(t.descuento)}`} /> : null}
            <FilaTotal etiqueta="NETO GRAVADO" valor={$(t.neto)} />
            {t.ivas.map((x) => (
              <FilaTotal key={x.pct} etiqueta={`IVA (${porcentaje(x.pct)}%)`} valor={$(x.monto)} />
            ))}
            <View style={s.totalFinal}>
              <Text style={s.totalFinalEtiqueta}>TOTAL</Text>
              <Text style={s.totalFinalValor}>{$(t.total)}</Text>
            </View>
            {t.ivas.length ? null : <Text style={s.aclaracionIva}>IVA no discriminado</Text>}
          </View>
        </View>

        {/* Pie de cada hoja */}
        <View style={s.pie} fixed>
          <Text style={s.pieTexto}>
            {[d.empresa.razonSocial, d.empresa.telefono && `Tel ${d.empresa.telefono}`, d.empresa.email].filter(Boolean).join("  ·  ")}
          </Text>
          <Text
            style={s.pieTexto}
            render={({ pageNumber, totalPages }) => `Documento no válido como factura  ·  Hoja ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
