import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, localeScript, parseLocale } from "@/lib/i18n";
import { LocaleProvider } from "./ui/locale";
import { LIGHT_THEME_COLOR, themeScript } from "./ui/theme";
import "./globals.css";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-app",
});

export const metadata: Metadata = {
  title: "Badminton Club",
  description: "Quản lý thành viên, lịch đánh và thu chi của CLB cầu lông",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The theme script switches it to the dark colour when Tối is picked.
  themeColor: LIGHT_THEME_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Not awaited: only the parts that show translated text wait for the cookie (useLocale).
  const locale = cookies().then((c) => parseLocale(c.get(LOCALE_COOKIE)?.value));
  return (
    // The scripts set data-theme and lang before paint, so the server markup differs on purpose.
    <html lang="vi" data-theme="light" className={`h-full antialiased ${font.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
      </head>
      <body className="min-h-full bg-page font-sans text-ink">
        <LocaleProvider locale={locale}>
          <div className="mx-auto flex min-h-full w-full max-w-md flex-col">{children}</div>
        </LocaleProvider>
      </body>
    </html>
  );
}
