import CalculadoraZumex from "@/components/CalculadoraZumex";

export default function CalculadoraPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Calculadora Zumex</h1>
      <p className="text-sm text-piedra mb-5">
        La cuenta que convierte “exprimidora cara” en “unidad de negocio”.
      </p>
      <CalculadoraZumex />
    </div>
  );
}
