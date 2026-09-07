import { redirect } from "next/navigation";

/** La pantalla de inicio ahora es la lista de contactos. */
export default function HoyPage() {
  redirect("/clientes");
}
