import { Suspense } from "react";
import FichaChat from "@/components/ficha/FichaChat";
import AvisoFlash from "@/components/AvisoFlash";

/** La ficha del contacto, como un chat, a pantalla completa. */
// Resumen y ayuda de casos con IA pueden tardar unos segundos
export const maxDuration = 60;

export default async function ContactoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ interes?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { interes, tab } = await searchParams;
  return (
    <>
      <Suspense fallback={null}>
        <AvisoFlash />
      </Suspense>
      <FichaChat clienteId={id} modo="pagina" interesAbierto={interes ?? null} pestana={tab ?? null} />
    </>
  );
}
