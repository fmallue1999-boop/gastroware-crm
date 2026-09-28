import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { icsDe, type LinkAgenda } from "@/lib/agenda";

/** Archivo de calendario (.ics) de una tarea, para iPhone u Outlook. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda")
    .select("id, titulo, fecha, hora, hora_fin, descripcion, lugar, links, aviso_dias")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const ics = icsDe({ ...data, links: (data.links ?? []) as LinkAgenda[] } as Parameters<typeof icsDe>[0]);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agenda-${data.fecha}.ics"`,
    },
  });
}
