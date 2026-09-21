import { Suspense } from "react";
import FichaChat from "@/components/ficha/FichaChat";
import AvisoFlash from "@/components/AvisoFlash";

/** La ficha del contacto, como un chat, a pantalla completa. */
export default async function ContactoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ interes?: string }>;
}) {
  const { id } = await params;
  const { interes } = await searchParams;
  return (
    <>
      <Suspense fallback={null}>
        <AvisoFlash />
      </Suspense>
      <FichaChat clienteId={id} modo="pagina" interesAbierto={interes ?? null} />
    </>
  );
}
