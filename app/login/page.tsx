import type { Metadata } from "next";
import EstiloMarca from "@/components/marca/EstiloMarca";
import LoginForm from "@/components/marca/LoginForm";
import { cargarMarcaPublica } from "@/lib/servidor/marca";

export const metadata: Metadata = { title: "Ingresar" };

/** Ingreso con la marca elegida en Administración → Marca. */
export default async function LoginPage() {
  const marca = await cargarMarcaPublica();
  return (
    <>
      <EstiloMarca marca={marca} />
      <LoginForm marca={marca} />
    </>
  );
}
