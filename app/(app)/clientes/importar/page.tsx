import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ImportadorClientes from "@/components/ImportadorClientes";

export default async function ImportarClientesPage() {
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (!["direccion", "admin"].includes(rol ?? "")) redirect("/clientes");

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">
        Importar clientes
      </h1>
      <p className="text-sm text-piedra mb-5">
        Subí tu listado viejo (Excel o CSV) y lo cargamos de una, sin
        duplicados.
      </p>
      <ImportadorClientes />
    </div>
  );
}
