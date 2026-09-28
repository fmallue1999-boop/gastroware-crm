/**
 * Marca del sistema ("skin"): nombre, etiqueta junto al logo, tema de color y
 * logos. Se guarda en config (claves marca_*) y lo cambia dirección en
 * Administración → Marca. Los colores pisan los tokens de Tailwind
 * (--color-marino, --color-crema, …), así todo el CRM cambia de una vez.
 */

export type TemaId = "gastroware" | "marino" | "petroleo" | "grafito" | "personalizado";

export type ColoresTema = {
  /** Barra lateral y botones principales. */
  principal: string;
  /** Ítem activo de la barra. */
  principal2: string;
  /** Fondo de página. */
  fondo: string;
  /** Fondos secundarios y hover. */
  fondo2: string;
  /** Acento suave (etiqueta junto al logo, bordes activos). */
  acento: string;
  /** Fondo de acento. */
  acentoSuave: string;
};

export const TEMAS: { id: Exclude<TemaId, "personalizado">; nombre: string; detalle: string; colores: ColoresTema }[] = [
  {
    id: "gastroware",
    nombre: "GastroWare",
    detalle: "Negro, crema y celeste: los colores de la marca.",
    colores: { principal: "#111111", principal2: "#2e2e2e", fondo: "#f1efe7", fondo2: "#e6e2d4", acento: "#a4daee", acentoSuave: "#e3f2f9" },
  },
  {
    id: "marino",
    nombre: "Azul marino",
    detalle: "El de la versión anterior.",
    colores: { principal: "#17233a", principal2: "#2a3d63", fondo: "#f4f2ec", fondo2: "#e9e6de", acento: "#bcd7f5", acentoSuave: "#e4edfb" },
  },
  {
    id: "petroleo",
    nombre: "Petróleo",
    detalle: "Verde azulado profundo, fondo gris claro.",
    colores: { principal: "#0f3b46", principal2: "#1d5a68", fondo: "#f2f4f3", fondo2: "#e3e8e6", acento: "#9fd8d2", acentoSuave: "#e0f3f1" },
  },
  {
    id: "grafito",
    nombre: "Grafito",
    detalle: "Gris oscuro neutro, fondo blanco roto.",
    colores: { principal: "#2b2d31", principal2: "#45484f", fondo: "#f5f5f3", fondo2: "#e8e8e5", acento: "#c9ccd3", acentoSuave: "#eceef2" },
  },
];

export type Marca = {
  nombre: string;
  etiqueta: string;
  tema: TemaId;
  /** Color principal cuando el tema es "personalizado" (#rrggbb). */
  color: string | null;
  /** Logo para fondo oscuro (barra lateral). */
  logoOscuro: string;
  /** Logo para fondo claro (ingreso, celular). */
  logoClaro: string;
};

export const LOGO_OSCURO_OFICIAL = "/marca/logo-oscuro.svg";
export const LOGO_CLARO_OFICIAL = "/marca/logo-claro.svg";

export const MARCA_POR_DEFECTO: Marca = {
  nombre: "GastroWare OS",
  etiqueta: "OS",
  tema: "gastroware",
  color: null,
  logoOscuro: LOGO_OSCURO_OFICIAL,
  logoClaro: LOGO_CLARO_OFICIAL,
};

/** Claves de config donde vive la marca. */
export const CLAVES_MARCA = {
  nombre: "marca_nombre",
  etiqueta: "marca_etiqueta",
  tema: "marca_tema",
  color: "marca_color",
  logoOscuro: "marca_logo_oscuro",
  logoClaro: "marca_logo_claro",
} as const;

const esHex = (s: string | null | undefined): s is string => Boolean(s && /^#[0-9a-fA-F]{6}$/.test(s));

/** Marca a partir de las filas de config (lo que falta, por defecto). */
export function marcaDesdeConfig(config: Record<string, string | null | undefined>): Marca {
  const tema = config[CLAVES_MARCA.tema] as TemaId | undefined;
  const valido: TemaId =
    tema && (tema === "personalizado" || TEMAS.some((t) => t.id === tema)) ? tema : MARCA_POR_DEFECTO.tema;
  const color = esHex(config[CLAVES_MARCA.color]) ? (config[CLAVES_MARCA.color] as string) : null;
  return {
    nombre: config[CLAVES_MARCA.nombre]?.trim() || MARCA_POR_DEFECTO.nombre,
    etiqueta: (config[CLAVES_MARCA.etiqueta] ?? MARCA_POR_DEFECTO.etiqueta).trim(),
    tema: valido === "personalizado" && !color ? MARCA_POR_DEFECTO.tema : valido,
    color,
    logoOscuro: config[CLAVES_MARCA.logoOscuro]?.trim() || LOGO_OSCURO_OFICIAL,
    logoClaro: config[CLAVES_MARCA.logoClaro]?.trim() || LOGO_CLARO_OFICIAL,
  };
}

/** Mezcla un color con blanco (pct 0-1). */
export function aclarar(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => Math.round(c + (255 - c) * pct);
  const r = canal((n >> 16) & 255);
  const g = canal((n >> 8) & 255);
  const b = canal(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Luminancia relativa (WCAG) de un color. */
export function luminancia(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Contraste entre dos colores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Colores efectivos de la marca. */
export function coloresDe(m: Marca): ColoresTema {
  if (m.tema === "personalizado" && esHex(m.color)) {
    const base = TEMAS[0].colores;
    return { ...base, principal: m.color, principal2: aclarar(m.color, 0.18), acento: aclarar(m.color, 0.6), acentoSuave: aclarar(m.color, 0.88) };
  }
  return (TEMAS.find((t) => t.id === m.tema) ?? TEMAS[0]).colores;
}

/** CSS que pisa los tokens del tema (se inyecta en el layout). */
export function cssDeMarca(m: Marca): string {
  const c = coloresDe(m);
  return `:root{--color-marino:${c.principal};--color-marino-2:${c.principal2};--color-crema:${c.fondo};--color-crema-deep:${c.fondo2};--color-celeste:${c.acento};--color-celeste-soft:${c.acentoSuave};--marca-acento:${c.acento}}html,body{background:${c.fondo}}`;
}
