import { createClient } from "@/lib/supabase/server";
import { LOGO_CLARO_OFICIAL } from "@/lib/marca";

/**
 * Logo de la empresa para membretes de documentos (cotización, comprobante,
 * inspección, financiación). Usa el archivo subido en Administración; si no
 * hay ninguno, usa el logo oficial de GastroWare.
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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_CLARO_OFICIAL} alt="GastroWare" className="h-14 w-auto object-contain" />;
}
