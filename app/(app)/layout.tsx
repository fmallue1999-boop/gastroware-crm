import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { createClient, supabaseConfigurado } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";
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

  const [{ data: yo }, notifRes] = await Promise.all([
    supabase.from("usuarios").select("rol, nombre").eq("id", user.id).single(),
    supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", user.id)
      .is("leida_at", null),
  ]);
  const rol = yo?.rol ?? "comercial";
  const noLeidas = notifRes.count ?? 0;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <Sidebar
        rol={rol}
        nombre={yo?.nombre}
        email={user.email}
        noLeidas={noLeidas}
      />

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-borde bg-crema/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link href="/hoy" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-bold tracking-tight">
              GastroWare <span className="font-medium text-piedra">CRM</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/notificaciones"
              aria-label="Notificaciones"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-borde bg-white text-tinta/70 shadow-sm transition-colors hover:text-tinta"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {noLeidas > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {noLeidas > 9 ? "9+" : noLeidas}
                </span>
              )}
            </Link>
            <Link
              href="/buscar"
              aria-label="Buscar cliente o número de serie"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-borde bg-white text-tinta/70 shadow-sm transition-colors hover:text-tinta"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </Link>
          </div>
        </header>

        <main className="w-full flex-1 px-4 pt-4 pb-24 lg:px-8 lg:pt-7 lg:pb-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <div className="lg:hidden">
          <BottomNav rol={rol} />
        </div>
      </div>
    </div>
  );
}
