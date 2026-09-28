import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "GastroWare OS", template: "%s · GastroWare OS" },
  description: "El sistema operativo de GastroWare: ventas, servicio técnico, administración y clientes en un solo lugar",
  applicationName: "GastroWare OS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full bg-crema text-tinta">{children}</body>
    </html>
  );
}
