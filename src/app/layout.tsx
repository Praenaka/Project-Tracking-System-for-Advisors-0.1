import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ระบบติดตามโครงงานสำหรับอาจารย์ที่ปรึกษา (LINE Thesis Tracker)",
  description: "ระบบติดตามและตรวจความคืบหน้าโครงงานผ่าน LINE Messaging API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
