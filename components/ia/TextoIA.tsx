import Link from "next/link";
import { Fragment } from "react";

/**
 * Muestra la respuesta del asistente: párrafos, listas con guiones o
 * números, **negritas** y links [texto](/ruta) solo a pantallas del sistema.
 * No interpreta HTML: todo es texto.
 */
function enLinea(texto: string, clave: string) {
  const partes = texto.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return partes.map((p, i) => {
    const k = `${clave}-${i}`;
    const negrita = p.match(/^\*\*([^*]+)\*\*$/);
    if (negrita) return <strong key={k}>{negrita[1]}</strong>;
    const link = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = link[2];
      return href.startsWith("/") && !href.startsWith("//") ? (
        <Link key={k} href={href} className="font-bold text-marino underline">
          {link[1]}
        </Link>
      ) : (
        <Fragment key={k}>{link[1]}</Fragment>
      );
    }
    return <Fragment key={k}>{p.replace(/`/g, "")}</Fragment>;
  });
}

export default function TextoIA({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  const bloques: React.ReactNode[] = [];
  let lista: { tipo: "ul" | "ol"; items: string[] } | null = null;
  const cerrarLista = (i: number) => {
    if (!lista) return;
    const items = lista.items.map((it, j) => (
      <li key={j} className="pl-1">
        {enLinea(it, `l${i}-${j}`)}
      </li>
    ));
    bloques.push(
      lista.tipo === "ul" ? (
        <ul key={`ul${i}`} className="ml-5 list-disc space-y-1">
          {items}
        </ul>
      ) : (
        <ol key={`ol${i}`} className="ml-5 list-decimal space-y-1">
          {items}
        </ol>
      )
    );
    lista = null;
  };
  lineas.forEach((linea, i) => {
    const t = linea.trim();
    const vineta = t.match(/^[-*•]\s+(.*)$/);
    const numero = t.match(/^\d+[.)]\s+(.*)$/);
    if (vineta || numero) {
      const tipo = vineta ? "ul" : "ol";
      if (lista && lista.tipo !== tipo) cerrarLista(i);
      if (!lista) lista = { tipo, items: [] };
      lista.items.push((vineta ?? numero)![1]);
      return;
    }
    cerrarLista(i);
    if (!t) return;
    const titulo = t.match(/^#{1,4}\s+(.*)$/);
    bloques.push(
      titulo ? (
        <p key={i} className="font-extrabold">
          {enLinea(titulo[1], `t${i}`)}
        </p>
      ) : (
        <p key={i}>{enLinea(t, `p${i}`)}</p>
      )
    );
  });
  cerrarLista(lineas.length);
  return <div className="space-y-2 text-[15px] leading-relaxed">{bloques}</div>;
}
