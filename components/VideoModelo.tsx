"use client";

import { useState, useTransition } from "react";
import { PlayCircle } from "lucide-react";
import { guardarVideoProducto } from "@/lib/actions";

/** Link al video instructivo de un modelo (se manda al cliente con el despacho). */
export default function VideoModelo({ productoId, inicial }: { productoId: string; inicial?: string | null }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState(inicial ?? "");
  const [msg, setMsg] = useState<{ texto: string; error?: boolean } | null>(null);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const r = await guardarVideoProducto(productoId, url);
          setMsg(r && "error" in r && r.error ? { texto: r.error, error: true } : { texto: "✓" });
        });
      }}
    >
      <PlayCircle className={`h-4 w-4 shrink-0 ${url ? "text-verde" : "text-piedra"}`} />
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Link del video instructivo (YouTube, Drive…)"
        className="min-h-10 min-w-0 flex-1 rounded-xl border border-borde bg-white px-3 text-[14px] outline-none focus:border-marino"
      />
      <button disabled={pending} className="min-h-10 rounded-xl bg-marino px-3 text-[14px] font-bold text-white disabled:opacity-50">
        {pending ? "…" : "Guardar"}
      </button>
      {msg && <span className={`text-[14px] font-bold ${msg.error ? "text-red-600" : "text-verde"}`}>{msg.texto}</span>}
    </form>
  );
}
