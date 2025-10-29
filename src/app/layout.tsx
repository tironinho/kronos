import type { Metadata } from "next";
import "./globals.css";

// Inicializa o sistema Kronos-X Avançado
import '../system/init';

export const metadata: Metadata = {
  title: "Kronos-X Engine V2",
  description: "Sistema avançado de trading automatizado com IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}