import { redirect } from "next/navigation";

/** La biblioteca vieja (vacía) quedó reemplazada por Material (v1.11). */
export default function BibliotecaPage() {
  redirect("/material");
}
