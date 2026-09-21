/** Mientras carga cualquier pantalla: tres bloques grises, sin saltos. */
export default function Cargando() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-40 animate-pulse rounded-xl bg-crema-deep" />
      <div className="h-12 animate-pulse rounded-2xl bg-crema-deep" />
      <div className="h-28 animate-pulse rounded-2xl bg-crema-deep" />
      <div className="h-28 animate-pulse rounded-2xl bg-crema-deep" />
      <p className="text-[15px] text-piedra">Cargando…</p>
    </div>
  );
}
