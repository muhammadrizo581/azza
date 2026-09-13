import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azza 🤍",
  description: "Faqat ikkimiz uchun maxsus xavfsiz chat",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Azza 🤍",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // iPhone Dynamic Island, Notch va Home indicator uchun to'liq ekran rejimi
  interactiveWidget: "resizes-content", // iPhone/Android klaviatura ochilganda oynani to'g'ri siqish
  themeColor: "#17212b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" className="dark h-full">
      <body className="h-full bg-[#0e1621] text-white">
        {children}
      </body>
    </html>
  );
}
