import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { iaConfigurada } from "@/lib/core/ia";
import GastoForm from "@/components/viaticos/GastoForm";

/** Cargar un gasto de viáticos (v1.25): primero la foto del comprobante. */
export default async function NuevoGastoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/viaticos" className="inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-piedra hover:text-marino">
        <ChevronLeft className="h-4 w-4" /> Viáticos
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight">Cargar gasto</h1>
      <GastoForm usuarioId={user!.id} hoy={hoy} iaOn={iaConfigurada()} />
    </div>
  );
}
