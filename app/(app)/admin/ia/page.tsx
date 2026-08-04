import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { iaConfigurada } from "@/lib/core/ia";
import { hoyISO } from "@/lib/format";
import LimiteIA from "@/components/admin/LimiteIA";

// Precios de claude-opus-5 por millón de tokens (USD)
const PRECIO_ENTRADA = 5;
const PRECIO_SALIDA = 25;

const ETIQUETAS_FUNCION: Record<string, string> = {
  mensaje_oportunidad: "Mensajes a medida",
  resumen_cliente: "Resúmenes de cliente",
  informe_ot: "Informes de service",
};

export default async function AdminIAPage() {
  const supabase = await createClient();
  const configurada = iaConfigurada();
  const hoy = hoyISO();
  const inicioMes = hoy.slice(0, 8) + "01";

  const [{ data: cfg }, { data: usosMes }] = await Promise.all([
    supabase.from("config").select("valor").eq("clave", "ia_limite_diario").maybeSingle(),
    supabase
      .from("ia_usos")
      .select("funcion, tokens_entrada, tokens_salida, created_at")
      .gte("created_at", `${inicioMes}T00:00:00-03:00`)
      .limit(5000),
  ]);

  const usos = usosMes ?? [];
  const usosHoy = usos.filter((u) => u.created_at >= `${hoy}T00:00:00-03:00`);
  const entradaMes = usos.reduce((s, u) => s + u.tokens_entrada, 0);
  const salidaMes = usos.reduce((s, u) => s + u.tokens_salida, 0);
  const costoMes =
    (entradaMes / 1_000_000) * PRECIO_ENTRADA +
    (salidaMes / 1_000_000) * PRECIO_SALIDA;

  const porFuncion = new Map<string, number>();
  for (const u of usos)
    porFuncion.set(u.funcion, (porFuncion.get(u.funcion) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-4 shadow-sm ${
          configurada
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4" />
          {configurada ? "IA activa" : "IA sin configurar"}
        </p>
        {configurada ? (
          <p className="mt-1 text-sm text-green-800">
            Las funciones de IA están disponibles en oportunidades (mensajes a
            medida), fichas de cliente (resumen para la llamada) y órdenes de
            servicio (informe prolijo). Todo es borrador: nada se envía ni se
            guarda sin aprobación de una persona.
          </p>
        ) : (
          <div className="mt-1 space-y-1 text-sm text-amber-900">
            <p>Para activarla (una sola vez, ~5 minutos):</p>
            <p>
              1. Entrá a <span className="font-medium">console.anthropic.com</span>,
              creá una cuenta y cargá un método de pago (se paga solo lo que se
              usa; con el límite diario el gasto queda acotado).
            </p>
            <p>
              2. En API Keys creá una clave y copiala (empieza con
              &quot;sk-ant-&quot;).
            </p>
            <p>
              3. En Vercel → Settings → Environment Variables agregá{" "}
              <span className="font-mono text-xs">ANTHROPIC_API_KEY</span> con esa
              clave y hacé Redeploy. Listo: los botones violetas aparecen solos.
            </p>
          </div>
        )}
      </div>

      <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold">Límite de costo</p>
        <LimiteIA actual={cfg?.valor ?? "100"} />
        <p className="mt-1.5 text-xs text-piedra">
          Tope de usos de IA por día para todo el equipo. Cada uso cuesta
          centavos; el límite evita sorpresas.
        </p>
      </section>

      <section className="rounded-2xl border border-borde bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold">Uso del mes</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-crema p-3">
            <p className="text-xl font-bold">{usosHoy.length}</p>
            <p className="text-xs text-piedra">usos hoy</p>
          </div>
          <div className="rounded-xl bg-crema p-3">
            <p className="text-xl font-bold">{usos.length}</p>
            <p className="text-xs text-piedra">usos en el mes</p>
          </div>
          <div className="rounded-xl bg-crema p-3">
            <p className="text-xl font-bold">
              {costoMes < 0.01 && usos.length > 0
                ? "<0.01"
                : costoMes.toFixed(2)}
            </p>
            <p className="text-xs text-piedra">USD estimados</p>
          </div>
        </div>
        {porFuncion.size > 0 && (
          <div className="mt-3 space-y-1 text-sm">
            {Array.from(porFuncion.entries()).map(([f, n]) => (
              <p key={f} className="flex justify-between">
                <span className="text-piedra">{ETIQUETAS_FUNCION[f] ?? f}</span>
                <span className="font-medium">{n}</span>
              </p>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-piedra">
        Reglas fijas: la IA solo ve los datos que el usuario que la usa ya puede
        ver, cita en qué se basó, y jamás inventa precios, series ni
        diagnósticos — si un dato falta, deja un marcador para completar.
      </p>
    </div>
  );
}
