import FinanciacionCalc from "@/components/FinanciacionCalc";

export default function FinanciacionPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">
        Financiación bancaria
      </h1>
      <p className="mb-5 text-sm text-piedra">
        Planes PymeNación / AgroNación del Banco Nación. Cargá el monto y sale
        la hoja con todas las opciones para el cliente.
      </p>
      <FinanciacionCalc tnaDefault={29} />
    </div>
  );
}
