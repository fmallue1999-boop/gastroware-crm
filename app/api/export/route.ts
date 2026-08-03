import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function aCSV(filas: Record<string, unknown>[], columnas: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [columnas.join(";")];
  for (const f of filas) {
    lineas.push(columnas.map((c) => esc(f[c])).join(";"));
  }
  // BOM para que Excel abra bien los acentos
  return "﻿" + lineas.join("\r\n");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tipo = new URL(request.url).searchParams.get("tipo") ?? "clientes";
  let filas: Record<string, unknown>[] = [];
  let columnas: string[] = [];

  if (tipo === "clientes") {
    const { data } = await supabase
      .from("clientes")
      .select("nombre_comercial, rubro, ciudad, provincia, telefono, email, estado, created_at")
      .order("nombre_comercial")
      .limit(5000);
    filas = data ?? [];
    columnas = ["nombre_comercial", "rubro", "ciudad", "provincia", "telefono", "email", "estado", "created_at"];
  } else if (tipo === "servicio") {
    const { data } = await supabase
      .from("ordenes_trabajo")
      .select(
        "numero, estado, tipo, fecha_programada, horas, total, nro_factura, created_at, cliente:clientes(nombre_comercial), tecnico:usuarios!ordenes_trabajo_tecnico_id_fkey(nombre)"
      )
      .order("numero")
      .limit(5000);
    filas = (data ?? []).map((o) => ({
      ...o,
      cliente: (o.cliente as unknown as { nombre_comercial: string } | null)?.nombre_comercial ?? "",
      tecnico: (o.tecnico as unknown as { nombre: string } | null)?.nombre ?? "",
    }));
    columnas = ["numero", "estado", "tipo", "cliente", "tecnico", "fecha_programada", "horas", "total", "nro_factura", "created_at"];
  } else if (tipo === "oportunidades") {
    const { data } = await supabase
      .from("oportunidades")
      .select(
        "etapa, origen, temperatura, monto_estimado, moneda, objecion_principal, motivo_perdida, created_at, closed_at, cliente:clientes(nombre_comercial), producto:productos(nombre)"
      )
      .order("created_at", { ascending: false })
      .limit(5000);
    filas = (data ?? []).map((o) => ({
      ...o,
      cliente: (o.cliente as unknown as { nombre_comercial: string } | null)?.nombre_comercial ?? "",
      producto: (o.producto as unknown as { nombre: string } | null)?.nombre ?? "",
    }));
    columnas = ["cliente", "producto", "etapa", "origen", "temperatura", "monto_estimado", "moneda", "objecion_principal", "motivo_perdida", "created_at", "closed_at"];
  } else {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  return new NextResponse(aCSV(filas, columnas), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastroware-${tipo}.csv"`,
    },
  });
}
