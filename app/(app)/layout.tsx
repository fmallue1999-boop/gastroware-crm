import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { createClient, supabaseConfigurado } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfigurado()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: yo } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .single();
  const rol = yo?.rol ?? "vendedor";

  return (
    <div className="mx-auto max-w-2xl min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-borde bg-crema/90 px-4 py-2.5 backdrop-blur">
        <Link href="/hoy" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-bold tracking-tight">
            GastroWare{" "}
            <span className="font-medium text-piedra">CRM</span>
          </span>
        </Link>
        <Link
          href="/buscar"
          aria-label="Buscar cliente o número de serie"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-borde bg-white text-tinta/70 shadow-sm transition-colors hover:text-tinta"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </Link>
      </header>
      <main className="flex-1 px-4 pt-4 pb-24">{children}</main>
      <BottomNav rol={rol} />
    </div>
  );
}
