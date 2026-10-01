/**
 * Material, la biblioteca comercial (v1.11): espacios de archivos, tipos
 * de video, buscador (sin tildes ni mayúsculas) y validación. Funciones puras.
 */

export type EspacioMarca = "catalogo" | "logo" | "tipografias";
export type EspacioProducto = "videos" | "imagenes" | "ficha";
export type Espacio = EspacioMarca | EspacioProducto;
export type VideoTipo = "usar" | "configurar" | "lavar" | "otro";

export const ESPACIOS_MARCA: { value: EspacioMarca; label: string; detalle: string }[] = [
  { value: "catalogo", label: "Catálogo general", detalle: "PDF o imágenes del catálogo de la marca" },
  { value: "logo", label: "Logo", detalle: "Versiones del logo (PNG, SVG, PDF…)" },
  { value: "tipografias", label: "Tipografías", detalle: "Las fuentes de la marca" },
];

export const VIDEO_TIPOS: { value: VideoTipo; label: string }[] = [
  { value: "usar", label: "Cómo usar" },
  { value: "configurar", label: "Cómo configurar" },
  { value: "lavar", label: "Cómo lavar" },
  { value: "otro", label: "Otro" },
];

export const videoTipoDe = (t: string | null | undefined) => VIDEO_TIPOS.find((v) => v.value === t) ?? VIDEO_TIPOS[3];
export const esVideoTipo = (t: string | null | undefined): t is VideoTipo => VIDEO_TIPOS.some((v) => v.value === t);
export const esEspacio = (e: string | null | undefined): e is Espacio =>
  ["catalogo", "logo", "tipografias", "videos", "imagenes", "ficha"].includes(e ?? "");
export const esEspacioMarca = (e: string): e is EspacioMarca => ["catalogo", "logo", "tipografias"].includes(e);

/** Qué archivos acepta cada espacio (null = cualquiera). */
export function aceptaArchivo(espacio: Espacio, archivo: { name: string; type: string }): string | null {
  const nombre = archivo.name.toLowerCase();
  if (espacio === "videos" && !archivo.type.startsWith("video/")) return `“${archivo.name}” no es un video.`;
  if (espacio === "imagenes" && !archivo.type.startsWith("image/")) return `“${archivo.name}” no es una imagen.`;
  if (espacio === "ficha" && !(archivo.type === "application/pdf" || nombre.endsWith(".pdf"))) return "La ficha tiene que ser un PDF.";
  return null;
}

export const acceptDe = (espacio: Espacio): string | undefined =>
  espacio === "videos" ? "video/*" : espacio === "imagenes" ? "image/*" : espacio === "ficha" ? "application/pdf,.pdf" : undefined;

/** Texto para comparar: sin tildes, sin mayúsculas, espacios simples. */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();

/** "Speed S+Plus Tank" → "speed-s-plus-tank" */
export const slugDe = (s: string) =>
  normalizar(s)
    .replace(/\+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "producto";

export type NodoMarca = { id: string; nombre: string; slug: string };
export type NodoCategoria = { id: string; marca_id: string; nombre: string; seccion: string };
export type NodoProducto = { id: string; categoria_id: string; nombre: string; slug: string };

export type ResultadoBusqueda = { tipo: "marca" | "categoria" | "producto"; titulo: string; ruta: string[]; href: string };

/** Busca marca, categoría y producto sin distinguir mayúsculas ni tildes. Productos primero. */
export function buscarMaterial(
  q: string,
  datos: { marcas: NodoMarca[]; categorias: NodoCategoria[]; productos: NodoProducto[] }
): ResultadoBusqueda[] {
  const t = normalizar(q);
  if (!t) return [];
  const coincide = (s: string) => normalizar(s).includes(t) || normalizar(s).replace(/\s/g, "").includes(t.replace(/\s/g, ""));
  const marca = new Map(datos.marcas.map((m) => [m.id, m]));
  const categoria = new Map(datos.categorias.map((c) => [c.id, c]));
  const out: ResultadoBusqueda[] = [];
  for (const p of datos.productos) {
    const c = categoria.get(p.categoria_id);
    const m = c ? marca.get(c.marca_id) : undefined;
    if (!c || !m) continue;
    if (coincide(p.nombre)) out.push({ tipo: "producto", titulo: p.nombre, ruta: [m.nombre, c.nombre, p.nombre], href: `/material/${m.slug}/${p.slug}` });
  }
  for (const c of datos.categorias) {
    const m = marca.get(c.marca_id);
    if (m && coincide(c.nombre)) out.push({ tipo: "categoria", titulo: c.nombre, ruta: [m.nombre, c.nombre], href: `/material/${m.slug}#cat-${c.id}` });
  }
  for (const m of datos.marcas) if (coincide(m.nombre)) out.push({ tipo: "marca", titulo: m.nombre, ruta: [m.nombre], href: `/material/${m.slug}` });
  return out.slice(0, 40);
}
