import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

/**
 * Sincroniza los clientes contactables (email válido, sin baja) hacia una
 * audiencia de Resend, para diseñar y enviar campañas desde Resend Broadcasts.
 * Protegido con CRON_SECRET. Procesa un lote por llamada (cursor en config):
 * se invoca repetidas veces hasta terminar. Idempotente: los emails que ya
 * están en la audiencia se saltean.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const apiKey = process.env.RESEND_API_KEY?.replace(/\s+/g, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\s+/g, "");
  if (!apiKey || !serviceKey)
    return NextResponse.json({ error: "Faltan claves" }, { status: 500 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const resend = (ruta: string, init?: RequestInit) =>
    fetch(`https://api.resend.com${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  const url = new URL(request.url);
  // Audiencia destino y rango opcional de ids (para partir la base en tandas)
  const nombreAudiencia = url.searchParams.get("nombre")?.trim() || "Clientes GastroWare";
  const desdeId = url.searchParams.get("desde")?.trim() || "";
  const hastaId = url.searchParams.get("hasta")?.trim() || "";
  const slug = nombreAudiencia.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
  const claveAud = `resend_aud_${slug}`;
  const claveCursor = `resend_cur_${slug}`;

  const { data: cfgAud } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", claveAud)
    .maybeSingle();
  let audienceId = cfgAud?.valor?.trim();
  if (!audienceId) {
    // Reusar si ya existe (una corrida anterior pudo crearla sin llegar a guardarla)
    const rLista = await resend("/audiences");
    if (rLista.ok) {
      const lista = (await rLista.json()) as { data?: { id: string; name: string }[] };
      audienceId = lista.data?.find((a) => a.name === nombreAudiencia)?.id;
    }
    if (!audienceId) {
      const r = await resend("/audiences", {
        method: "POST",
        body: JSON.stringify({ name: nombreAudiencia }),
      });
      if (!r.ok)
        return NextResponse.json(
          { error: `No se pudo crear la audiencia: ${await r.text()}` },
          { status: 500 }
        );
      audienceId = ((await r.json()) as { id: string }).id;
    }
    await supabase
      .from("config")
      .upsert({ clave: claveAud, valor: audienceId }, { onConflict: "clave" });
  }

  // Cursor de avance (id del último cliente procesado) por audiencia
  const { data: cfgCur } = await supabase
    .from("config")
    .select("valor")
    .eq("clave", claveCursor)
    .maybeSingle();
  const cursor = cfgCur?.valor?.trim() || "";

  const lote = Math.min(
    Math.max(parseInt(url.searchParams.get("lote") ?? "40", 10) || 40, 1),
    50
  );

  let q = supabase
    .from("clientes")
    .select("id, nombre_comercial, email")
    .is("deleted_at", null)
    .eq("no_contactar", false)
    .not("email", "is", null)
    .neq("email", "")
    .order("id")
    .limit(lote);
  const piso = cursor || desdeId;
  if (piso) q = q.gt("id", piso);
  if (hastaId) q = q.lte("id", hastaId);
  const { data: clientes } = await q;
  const lista = clientes ?? [];

  let agregados = 0;
  let yaEstaban = 0;
  let invalidos = 0;
  let limiteAlcanzado = false;
  let ultimoOk = cursor;
  const arranque = Date.now();
  let sinGuardar = 0;

  const guardarCursor = async () => {
    if (ultimoOk !== cursor && sinGuardar > 0) {
      await supabase
        .from("config")
        .upsert({ clave: claveCursor, valor: ultimoOk }, { onConflict: "clave" });
      sinGuardar = 0;
    }
  };

  for (const c of lista) {
    // Presupuesto de tiempo: cortar prolijo antes del timeout de la función
    if (Date.now() - arranque > 42000) break;
    const email = (c.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      invalidos++;
      ultimoOk = c.id;
      continue;
    }
    const r = await resend(`/audiences/${audienceId}/contacts`, {
      method: "POST",
      body: JSON.stringify({
        email,
        first_name: c.nombre_comercial?.slice(0, 50) ?? "",
        unsubscribed: false,
      }),
    });
    if (r.ok) {
      agregados++;
      ultimoOk = c.id;
      sinGuardar++;
    } else {
      const detalle = await r.text();
      if (r.status === 409 || detalle.includes("already exists")) {
        yaEstaban++;
        ultimoOk = c.id;
        sinGuardar++;
      } else if (r.status === 422) {
        // Email que Resend considera inválido: saltear y seguir
        invalidos++;
        ultimoOk = c.id;
        sinGuardar++;
      } else if (r.status === 403 || detalle.includes("limit")) {
        // Tope del plan gratis de Resend: cortar sin avanzar el cursor
        limiteAlcanzado = true;
        break;
      } else {
        await guardarCursor();
        return NextResponse.json(
          { error: `Resend ${r.status}: ${detalle.slice(0, 200)}`, ultimoOk },
          { status: 500 }
        );
      }
    }
    // Guardar el avance seguido: si la función muere, no se pierde
    if (sinGuardar >= 10) await guardarCursor();
    // Límite de Resend: 2 requests por segundo
    await new Promise((res) => setTimeout(res, 510));
  }

  await guardarCursor();

  let qRestantes = supabase
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("no_contactar", false)
    .not("email", "is", null)
    .neq("email", "")
    .gt("id", ultimoOk || desdeId || "00000000-0000-0000-0000-000000000000");
  if (hastaId) qRestantes = qRestantes.lte("id", hastaId);
  const { count: restantes } = await qRestantes;

  return NextResponse.json({
    audiencia: nombreAudiencia,
    audienceId,
    procesados: lista.length,
    agregados,
    yaEstaban,
    invalidos,
    limiteAlcanzado,
    restantes: restantes ?? 0,
    terminado: !limiteAlcanzado && lista.length < lote,
  });
}
