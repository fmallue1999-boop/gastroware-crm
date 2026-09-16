import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

/**
 * Sincroniza los clientes contactables (email válido, sin baja) hacia una
 * audiencia (segmento) de Resend, para diseñar y enviar campañas desde Resend
 * Broadcasts. Protegido con CRON_SECRET. Procesa un lote por llamada (cursor
 * en config): se invoca repetidas veces hasta terminar. Idempotente: los
 * emails que ya están en la audiencia se saltean.
 *
 * Modos:
 * - Sin parámetros: toda la base, opcionalmente partida por rango de ids
 *   (?desde=&hasta=) y con nombre de audiencia (?nombre=).
 * - ?feria=HOTELGA%202026: solo los contactos escaneados en esa feria
 *   (feria_leads), usando el email de la credencial y, si no tiene, el de la
 *   ficha. El nombre de la audiencia es el de la feria salvo ?nombre=.
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
  const feria = url.searchParams.get("feria")?.trim() || "";
  const nombreAudiencia =
    url.searchParams.get("nombre")?.trim() || feria || "Clientes GastroWare";
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

  type Destinatario = {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  const piso = cursor || desdeId;
  let lista: Destinatario[] = [];
  if (feria) {
    // Contactos de la feria: el cursor avanza por cliente_id. El email de la
    // credencial manda; si no tiene, va el de la ficha del contacto.
    type LeadFila = {
      cliente_id: string;
      nombre: string | null;
      email: string | null;
      cliente: { nombre_comercial: string | null; email: string | null } | null;
    };
    let q = supabase
      .from("feria_leads")
      .select(
        "cliente_id, nombre, email, cliente:clientes!inner(nombre_comercial, email, deleted_at, no_contactar)"
      )
      .eq("feria", feria)
      .is("cliente.deleted_at", null)
      .eq("cliente.no_contactar", false)
      .order("cliente_id")
      .limit(lote);
    if (piso) q = q.gt("cliente_id", piso);
    if (hastaId) q = q.lte("cliente_id", hastaId);
    const { data } = await q;
    lista = ((data ?? []) as unknown as LeadFila[]).map((l) => {
      const partes = (l.nombre ?? "").trim().split(/\s+/).filter(Boolean);
      return {
        id: l.cliente_id,
        email: (l.email ?? "").trim() || (l.cliente?.email ?? ""),
        first_name: partes[0] ?? l.cliente?.nombre_comercial ?? "",
        last_name: partes.slice(1).join(" "),
      };
    });
  } else {
    type ClienteFila = { id: string; nombre_comercial: string | null; email: string | null };
    let q = supabase
      .from("clientes")
      .select("id, nombre_comercial, email")
      .is("deleted_at", null)
      .eq("no_contactar", false)
      .not("email", "is", null)
      .neq("email", "")
      .order("id")
      .limit(lote);
    if (piso) q = q.gt("id", piso);
    if (hastaId) q = q.lte("id", hastaId);
    const { data } = await q;
    lista = ((data ?? []) as unknown as ClienteFila[]).map((c) => ({
      id: c.id,
      email: c.email ?? "",
      first_name: c.nombre_comercial ?? "",
      last_name: "",
    }));
  }

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
    const email = c.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      invalidos++;
      ultimoOk = c.id;
      continue;
    }
    const r = await resend(`/audiences/${audienceId}/contacts`, {
      method: "POST",
      body: JSON.stringify({
        email,
        first_name: c.first_name.slice(0, 50),
        ...(c.last_name ? { last_name: c.last_name.slice(0, 50) } : {}),
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

  const pisoRestantes =
    ultimoOk || desdeId || "00000000-0000-0000-0000-000000000000";
  let restantes = 0;
  if (feria) {
    let qr = supabase
      .from("feria_leads")
      .select("cliente_id, cliente:clientes!inner(id)", { count: "exact", head: true })
      .eq("feria", feria)
      .is("cliente.deleted_at", null)
      .eq("cliente.no_contactar", false)
      .gt("cliente_id", pisoRestantes);
    if (hastaId) qr = qr.lte("cliente_id", hastaId);
    restantes = (await qr).count ?? 0;
  } else {
    let qr = supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("no_contactar", false)
      .not("email", "is", null)
      .neq("email", "")
      .gt("id", pisoRestantes);
    if (hastaId) qr = qr.lte("id", hastaId);
    restantes = (await qr).count ?? 0;
  }

  return NextResponse.json({
    audiencia: nombreAudiencia,
    feria: feria || null,
    audienceId,
    procesados: lista.length,
    agregados,
    yaEstaban,
    invalidos,
    limiteAlcanzado,
    restantes,
    terminado: !limiteAlcanzado && lista.length < lote,
  });
}
