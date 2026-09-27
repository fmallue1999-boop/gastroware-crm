import { hoyISO } from "@/lib/format";
import { RELEVAMIENTO_INSTALACION } from "@/lib/constants";
import { atrasoMaximo } from "@/lib/ventas";
import { avisar, regla, usuariosDePuesto, type SupabaseServidor } from "@/lib/actions/comun";

/**
 * Pasos internos del circuito de la venta que NO son acciones del
 * servidor (no se pueden llamar desde el navegador): los usan Cobranzas y
 * Ventas después de validar quién puede hacer cada cosa.
 */

/**
 * Paso 6 → 7: con el cobro acreditado (o la condición aprobada por
 * dirección) la venta pasa a "a preparar", se avisa al depósito y, si lleva
 * instalación, se abre el trabajo de instalación con el relevamiento.
 * Si el cliente tiene facturas vencidas hace más de lo que dice la regla, no
 * se libera sola: hace falta la condición aprobada.
 */
export async function liberarVenta(
  supabase: SupabaseServidor,
  oportunidadId: string,
  opciones: { porCondicion: boolean; userId?: string | null }
): Promise<{ movida: boolean; aviso?: string }> {
  const { data } = await supabase
    .from("oportunidades")
    .select(
      "id, cliente_id, comercial_id, pedido_estado, lleva_instalacion, relevamiento, direccion_entrega, sucursal_id, cliente:clientes(nombre_comercial), producto:productos(nombre)"
    )
    .eq("id", oportunidadId)
    .maybeSingle();
  const v = data as unknown as {
    id: string;
    cliente_id: string;
    comercial_id: string | null;
    pedido_estado: string | null;
    lleva_instalacion: boolean;
    relevamiento: Record<string, string> | null;
    direccion_entrega: string | null;
    sucursal_id: string | null;
    cliente: { nombre_comercial: string } | null;
    producto: { nombre: string } | null;
  } | null;
  if (!v || v.pedido_estado !== "facturado") return { movida: false };
  const nombre = `${v.producto?.nombre ?? "venta"} · ${v.cliente?.nombre_comercial ?? "cliente"}`;

  if (!opciones.porCondicion) {
    const { data: impagas } = await supabase
      .from("facturas")
      .select("vencimiento, cobro_estado")
      .eq("cliente_id", v.cliente_id)
      .neq("cobro_estado", "cobrado");
    const dias = atrasoMaximo((impagas ?? []) as { vencimiento: string | null; cobro_estado: string }[], hoyISO());
    const limite = Number(await regla(supabase, "dias_atraso_frena_despacho")) || 30;
    if (dias > limite) {
      const direccion = await usuariosDePuesto(supabase, ["admin", "direccion"]);
      await avisar(
        supabase,
        direccion,
        {
          tipo: "despacho_frenado",
          titulo: `Despacho frenado por atraso (${dias} días): ${nombre}`,
          url: "/cobranzas",
        },
        opciones.userId
      );
      return {
        movida: false,
        aviso: `El cliente tiene facturas vencidas hace ${dias} días (la regla frena a los ${limite}). La venta no pasa a preparar hasta que dirección apruebe la condición.`,
      };
    }
  }

  const { error } = await supabase
    .from("oportunidades")
    .update({ pedido_estado: "preparar_envio" })
    .eq("id", oportunidadId);
  if (error) return { movida: false, aviso: error.message };

  let notaInstalacion = "";
  if (v.lleva_instalacion) {
    const { count } = await supabase
      .from("ordenes_trabajo")
      .select("id", { count: "exact", head: true })
      .eq("oportunidad_id", oportunidadId)
      .eq("tipo", "instalacion")
      .is("deleted_at", null);
    if (!count) {
      const { data: equipo } = await supabase
        .from("equipos")
        .select("id")
        .eq("oportunidad_id", oportunidadId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      const relevamiento = RELEVAMIENTO_INSTALACION.map(
        (r) => `${r.label}: ${v.relevamiento?.[r.key] ?? "—"}`
      ).join("\n");
      const { data: ot } = await supabase
        .from("ordenes_trabajo")
        .insert({
          cliente_id: v.cliente_id,
          sucursal_id: v.sucursal_id,
          equipo_id: equipo?.id ?? null,
          oportunidad_id: oportunidadId,
          creado_por: opciones.userId ?? null,
          estado: "solicitud_recibida",
          tipo: "instalacion",
          prioridad: "normal",
          cobertura: "contrato",
          fecha_solicitada: hoyISO(),
          problema: `Instalación de la venta (${v.producto?.nombre ?? "equipo"}). Entrega: ${v.direccion_entrega ?? "—"}\n\nRelevamiento del lugar:\n${relevamiento}`,
        })
        .select("numero")
        .single();
      if (ot) notaInstalacion = ` · se abrió la instalación (service ${ot.numero})`;
    }
  }

  await supabase.from("actividades").insert({
    cliente_id: v.cliente_id,
    oportunidad_id: oportunidadId,
    tipo: "pedido",
    contenido: `Pasa a preparar (${opciones.porCondicion ? "condición aprobada por dirección" : "cobro acreditado"})${notaInstalacion}`,
    created_by: opciones.userId ?? null,
  });
  const deposito = await usuariosDePuesto(supabase, ["tecnico", "administrativa"]);
  const servicio = v.lleva_instalacion ? await usuariosDePuesto(supabase, ["servicio", "admin"]) : [];
  await avisar(
    supabase,
    [...deposito, ...servicio, v.comercial_id],
    { tipo: "venta_para_preparar", titulo: `Para preparar: ${nombre}`, url: "/pedidos" },
    opciones.userId
  );
  return { movida: true };
}
