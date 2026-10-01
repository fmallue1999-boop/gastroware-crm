import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

/** Buscador general de Material (marca, categoría o producto). */
export function BuscadorMaterial({ q = "", autoFocus = false }: { q?: string; autoFocus?: boolean }) {
  return (
    <form action="/material" className="flex gap-2">
      <label className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-piedra" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus={autoFocus}
          placeholder="Buscar marca, categoría o producto (ej: GX18, Versatile Pro, cafeteras)"
          className="min-h-12 w-full rounded-2xl border border-borde bg-white pl-10 pr-3 text-[15px] shadow-sm outline-none focus:border-marino"
        />
      </label>
      <button className="min-h-12 rounded-2xl bg-marino px-4 text-[15px] font-bold text-white">Buscar</button>
    </form>
  );
}

/** MATERIAL › JETINNO › Cafeteras › JL15 */
export function MigasMaterial({ partes }: { partes: { texto: string; href?: string }[] }) {
  return (
    <nav aria-label="Dónde estás" className="flex flex-wrap items-center gap-1 text-sm font-semibold text-piedra">
      {partes.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {p.href ? (
            <Link href={p.href} className="hover:text-tinta hover:underline">
              {p.texto}
            </Link>
          ) : (
            <span className="text-tinta">{p.texto}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
