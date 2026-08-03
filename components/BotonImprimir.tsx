"use client";

export default function BotonImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="mt-6 w-full rounded-xl bg-tinta py-3 font-medium text-white print:hidden"
    >
      Imprimir / guardar PDF
    </button>
  );
}
