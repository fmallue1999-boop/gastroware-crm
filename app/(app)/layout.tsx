import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, supabaseConfigurado } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";

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

  return (
    <div className="mx-auto max-w-2xl min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-borde bg-crema/95 px-4 py-2.5 backdrop-blur">
        <Link href="/hoy" className="text-sm font-semibold">
          GastroWare <span className="text-piedra font-normal">CRM</span>
        </Link>
        <Link
          href="/buscar"
          aria-label="Buscar cliente"
          className="rounded-full border border-borde bg-white px-3 py-1.5 text-sm text-piedra"
        >
          🔍 Buscar
        </Link>
      </header>
      <main className="flex-1 px-4 pt-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
