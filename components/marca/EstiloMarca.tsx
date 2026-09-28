import { cssDeMarca, type Marca } from "@/lib/marca";

/** Pisa los colores del tema con los de la marca elegida en Administración. */
export default function EstiloMarca({ marca }: { marca: Marca }) {
  return <style dangerouslySetInnerHTML={{ __html: cssDeMarca(marca) }} />;
}
