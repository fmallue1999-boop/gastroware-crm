export default function Logo({ tamano = "md" }: { tamano?: "md" | "lg" }) {
  const caja = tamano === "lg" ? "h-14 w-14 rounded-2xl text-2xl" : "h-8 w-8 rounded-2xl text-base";
  return (
    <span
      className={`inline-flex items-center justify-center bg-marino font-extrabold text-[#6fc3e2] ${caja}`}
      aria-hidden
    >
      G
    </span>
  );
}
