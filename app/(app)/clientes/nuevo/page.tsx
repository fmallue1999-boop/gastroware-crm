import ClienteNuevoForm from "@/components/ClienteNuevoForm";

export default function NuevoClientePage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Nuevo cliente</h1>
      <p className="mb-5 text-sm text-piedra">
        Cargá un cliente a la cartera (frecuente, viejo o de mostrador), sin
        abrir una consulta.
      </p>
      <ClienteNuevoForm />
    </div>
  );
}
