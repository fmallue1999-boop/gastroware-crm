import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { iaConfigurada, modeloIA, MODELOS_IA } from "@/lib/core/ia";
import { hoyISO } from "@/lib/format";
import LimiteIA from "@/components/admin/LimiteIA";
import ModeloIA from "@/components/admin/ModeloIA";

const ETIQUETAS_FUNCION: Record<string, string> = {
  asistente: "Asistente (preguntas)",
  leer_consulta: "Consultas cargadas desde un mensaje",
  borrador_informe: "Borradores de informe",
  ayuda_caso: "Ayuda en casos",
  mensaje_oportunidad: "Mensajes a medida",
  resumen_cliente: "Resúmenes de cliente",
  informe_ot: "Informes de service",
  campania_marketing: "Campañas de marketing",
  campania_diseno: "Diseño de campañas",
  leer_credencial: "Lectura de credenciales de feria",
};

/** Tokens en formato corto: 12.345 → "12 mil", 2.300.000 → "2,3 M". */
function tokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${Math.round(n / 1_000).toLocaleString("es-AR")} mil`;
  return String(n);
}

export default async function AdminIAPage() {
  const supabase = await createClient();
  const configurada = iaConfigurada();
  const hoy = hoyISO();
  const inicioMes = hoy.slice(0, 8) + "01";

  const [{ data: cfg }, { data: usosMes }, modelo] = await Promise.all([
    supabase.from("config").select("valor").eq("clave", "ia_limite_diario").maybeSingle(),
    supabase
      .from("ia_usos")
      .select("funcion, tokens_entrada, tokens_salida, created_at")
      .gte("created_at", `${inicioMes}T00:00:00-03:00`)
      .limit(5000),
    modeloIA(supabase),
  ]);

  const usos = usosMes ?? [];
  const usosHoy = usos.filter((u) => u.created_at >= `${hoy}T00:00:00-03:00`);
  const entradaMes = usos.reduce((s, u) => s + u.tokens_entrada, 0);
  const salidaMes = usos.reduce((s, u) => s + u.tokens_salida, 0);

  const porFuncion = new Map<string, number>();
  for (const u of usos)
    porFuncion.set(u.funcion, (porFuncion.get(u.funcion) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-4 shadow-sm ${
          configurada
            ? "border-verde-soft bg-verde-soft"
            : "border-ambar-soft bg-ambar-soft"
        }`}
      >
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4" />
          {configurada ? "IA activa" : "IA sin configurar"}
        </p>
        {configurada ? (
          <p className="mt-1 text-sm text-verde">
            Todos tienen el Asistente en el menú (preguntas con sus datos,
            cómo se hace cada cosa, mensajes). Además: cargar una consulta desde
            un mensaje o captura, borrador del informe de los lunes, ayuda para
            resolver casos, resumen del contacto, mensajes a medida e informes
            de service. Todo es borrador o consulta: la IA no guarda, no cambia
            ni envía nada sola.
          </p>
        ) : (
          <div className="mt-1 space-y-1 text-sm text-ambar">
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
        <p className="mb-2 text-sm font-semibold">Modelo de IA</p>
        <ModeloIA actual={modelo} opciones={MODELOS_IA.map((m) => ({ id: m.id, nombre: m.nombre, detalle: m.detalle }))} />
        <p className="mt-1.5 text-xs text-piedra">
          Lo usa todo el sistema. El más capaz responde mejor; el más económico gasta menos.
        </p>
      </section>

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
            <p className="text-xl font-bold">{tokens(entradaMes + salidaMes)}</p>
            <p className="text-xs text-piedra">tokens en el mes</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-piedra">
          Leídos {tokens(entradaMes)} · escritos {tokens(salidaMes)}. El costo real en dólares se ve en
          console.anthropic.com → Usage.
        </p>
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
