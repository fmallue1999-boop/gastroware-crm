import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esGestor } from "@/lib/puestos";
import VideoModelo from "@/components/VideoModelo";
import AyudaLink from "@/components/guia/AyudaLink";

/** Videos instructivos por modelo (manual 4.6): se mandan al cliente con el despacho. */
export default async function VideosPage() {
  const supabase = await createClient();
  const { data: rol } = await supabase.rpc("fn_rol");
  if (rol !== "marketing" && !esGestor(rol as string)) redirect("/");
  const { data } = await supabase.from("productos").select("id, nombre, categoria, video_url").eq("activo", true).order("nombre");
  const productos = (data ?? []) as { id: string; nombre: string; categoria: string; video_url: string | null }[];
  const sinVideo = productos.filter((p) => !p.video_url);
  return (
    <div className="space-y-3">
      <div>
        <h1 className="flex flex-wrap items-center gap-x-2 text-2xl font-extrabold tracking-tight">
          Videos por modelo <AyudaLink tarea="videos" />
        </h1>
        <p className="text-[15px] text-piedra">
          {sinVideo.length ? `${sinVideo.length} modelos sin video instructivo.` : "Todos los modelos tienen su video."} Administración los manda con cada despacho.
        </p>
      </div>
      <div className="space-y-2">
        {[...sinVideo, ...productos.filter((p) => p.video_url)].map((p) => (
          <div key={p.id} className="rounded-2xl bg-white p-3 shadow-sm">
            <p className="mb-1.5 text-[15px] font-extrabold">{p.nombre}</p>
            <VideoModelo productoId={p.id} inicial={p.video_url} />
          </div>
        ))}
      </div>
    </div>
  );
}
