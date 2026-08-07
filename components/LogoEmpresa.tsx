import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/Logo";

/**
 * Logo de la empresa para membretes de documentos (cotización, comprobante,
 * inspección, financiación). Usa el archivo subido en Administración; si no
 * hay ninguno, cae al logo "G" por defecto.
 */
export default async function LogoEmpresa() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", "logo_url")
    .maybeSingle();
  const url = data?.valor?.trim();

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Logo" className="h-14 w-auto object-contain" />;
  }
  return <Logo tamano="lg" />;
}
