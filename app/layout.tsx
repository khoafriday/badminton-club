import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Badminton Club",
  description: "Quản lý thành viên, lịch đánh và thu chi của CLB cầu lông",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-white shadow-sm">{children}</div>
      </body>
    </html>
  );
}
