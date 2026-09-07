import { redirect } from "next/navigation";

/** El alta de clientes y de interesados es una sola: Nuevo contacto. */
export default function NuevoClientePage() {
  redirect("/alta");
}
