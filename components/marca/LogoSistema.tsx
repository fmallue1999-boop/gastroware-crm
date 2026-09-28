import type { Marca } from "@/lib/marca";

/**
 * El logo del sistema con su etiqueta ("OS"): la versión clara para fondos
 * oscuros (barra lateral) o la oscura para fondos claros (ingreso, celular).
 */
export default function LogoSistema({
  marca,
  fondo,
  tamano = "md",
}: {
  marca: Pick<Marca, "nombre" | "etiqueta" | "logoOscuro" | "logoClaro">;
  fondo: "oscuro" | "claro";
  tamano?: "sm" | "md" | "lg";
}) {
  const alto = tamano === "lg" ? "h-16" : tamano === "sm" ? "h-7" : "h-9";
  const etiqueta = tamano === "lg" ? "px-2.5 py-1 text-[15px]" : "px-1.5 py-0.5 text-[11px]";
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fondo === "oscuro" ? marca.logoOscuro : marca.logoClaro} alt={marca.nombre} className={`${alto} w-auto object-contain`} />
      {marca.etiqueta && (
        <span
          className={`rounded-md font-extrabold tracking-wide ${etiqueta} ${
            fondo === "oscuro" ? "bg-celeste text-marino" : "bg-marino text-celeste"
          }`}
        >
          {marca.etiqueta}
        </span>
      )}
    </span>
  );
}
