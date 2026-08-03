"use client";

export default function BotonImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="mt-6 w-full rounded-2xl bg-tinta py-3 font-medium text-white print:hidden"
    >
      Imprimir / guardar PDF
    </button>
  );
}
