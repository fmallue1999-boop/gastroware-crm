export default function Logo({ tamano = "md" }: { tamano?: "md" | "lg" }) {
  const caja = tamano === "lg" ? "h-14 w-14 rounded-2xl text-2xl" : "h-8 w-8 rounded-2xl text-base";
  return (
    <span
      className={`inline-flex items-center justify-center bg-tinta font-bold text-white ${caja}`}
      aria-hidden
    >
      G
    </span>
  );
}
