import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { UndoProvider } from "@/components/UndoProvider";
import { DataProvider } from "@/components/DataProvider";

export const metadata: Metadata = {
  title: "Evereden GTM Planner",
  description: "Go-to-market strategy, planning, and execution hub",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex">
        <DataProvider>
          <Sidebar />
          <main className="flex-1 ml-[240px] min-h-screen">
            {children}
          </main>
          <UndoProvider />
        </DataProvider>
      </body>
    </html>
  );
}
