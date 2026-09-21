import FichaChat from "@/components/ficha/FichaChat";

/**
 * Envuelve una pantalla (Embudo, Hoy, Contactos) para que en la computadora
 * la ficha del contacto tocado se abra al costado, sin salir de donde estás.
 * `c` es el id del contacto (?c=); `cerrarHref` a dónde vuelve la X.
 */
export default function ConPanel({
  c,
  interes,
  cerrarHref,
  children,
}: {
  c?: string | null;
  interes?: string | null;
  cerrarHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className={c ? "lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-4" : ""}>
      <div className="min-w-0">{children}</div>
      {c && (
        <aside className="hidden lg:block">
          <div className="sticky top-6 h-[calc(100dvh-3rem)] overflow-hidden rounded-2xl border border-borde bg-white shadow-xl">
            <FichaChat clienteId={c} modo="panel" interesAbierto={interes ?? null} cerrarHref={cerrarHref} />
          </div>
        </aside>
      )}
    </div>
  );
}
