import Inicio from "@/components/inicio/Inicio";

/** Inicio: pendientes arriba, contactos abajo (Etapa 1, 1.3). */
export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vista?: string; producto?: string }>;
}) {
  return <Inicio searchParams={await searchParams} />;
}
