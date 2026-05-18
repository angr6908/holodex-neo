import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { AppProviders } from "@/components/app/AppProviders";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_BOOT_COOKIE, decodeAppBootCookie } from "@/lib/cookie-codec";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { LEGACY_THEME_COLOR } from "@/lib/themes";
const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.holodex.net"),
  title: "Holodex",
  description: "Catch collabs and streams with Multiview, find clips, and listen to music, karaoke, and covers from your favorite VTubers.",
  applicationName: "Holodex",
  appleWebApp: { capable: true, title: "Holodex", statusBarStyle: "default" },
  icons: { icon: "/favicon.ico", apple: "/img/icons/apple-touch-icon-152x152.png" },
  openGraph: { type: "website", title: "Holodex", description: "Catch collabs and streams with Multiview, find clips, and listen to music, karaoke, and covers from your favorite VTubers.", images: ["/img/intro-promo.jpg"], siteName: "HOLODEX" },
  twitter: { card: "summary_large_image", site: "@holodex", title: "Holodex", description: "Catch collabs and streams with Multiview, find clips, and listen to music, karaoke, and covers from your favorite VTubers.", images: ["/img/intro-promo.jpg"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover", themeColor: LEGACY_THEME_COLOR };

const bootInit = `
(function(){
try{
var h=document.documentElement;
var s=localStorage.getItem('holodex-v2-settings');
var settings=s?JSON.parse(s):{};
if(settings.lang){document.cookie='locale='+encodeURIComponent(settings.lang)+'; Path=/; Max-Age=31536000; SameSite=Lax';}
var appRaw=localStorage.getItem('holodex-v2-app');
var app=appRaw?JSON.parse(appRaw):{};
try{var vw=window.innerWidth||1440;var boot={isMobile:vw<960,windowWidth:vw,currentOrg:app.currentOrg,selectedHomeOrgs:app.selectedHomeOrgs,orgFavorites:app.orgFavorites,currentGridSize:app.currentGridSize,settings:{lang:settings.lang,defaultOpen:settings.defaultOpen,homeViewMode:settings.homeViewMode,scrollMode:settings.scrollMode,hideUpcoming:settings.hideUpcoming,darkMode:settings.darkMode,followSystemTheme:settings.followSystemTheme}};document.cookie='${APP_BOOT_COOKIE}='+encodeURIComponent(JSON.stringify(boot))+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch(e){}
var path=location.pathname||'/';
var showTopBar=!(new RegExp('^/(multiview|tlclient|scripteditor|watch)(/|$)').test(path));
if(showTopBar){h.style.setProperty('--nav-header-height','65px');h.style.setProperty('--nav-total-height','81px');}else{h.style.setProperty('--nav-header-height','0px');h.style.setProperty('--nav-total-height','0px');}
}catch(e){}
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const cookieBootState = decodeAppBootCookie(cookieStore.get(APP_BOOT_COOKIE)?.value);
  const requestIsMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(requestHeaders.get("user-agent") || "");
  const initialBootState = {
    ...(cookieBootState || {}),
    isMobile: cookieBootState?.isMobile ?? requestIsMobile,
    windowWidth: cookieBootState?.windowWidth ?? (requestIsMobile ? 390 : 1440),
  };
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning className={cn("dark font-sans [color-scheme:dark]", geist.variable)}>
      <head suppressHydrationWarning>
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://yt3.ggpht.com" />
        <script id="holodex-boot-init" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: bootInit }} />
        <script src="/config.js" defer suppressHydrationWarning />
      </head>
      <body className="group/ptr bg-background pt-[env(safe-area-inset-top)] text-foreground" suppressHydrationWarning>
        <noscript>
          <Alert>
            <AlertDescription>
              This site requires JavaScript. Enable JavaScript to continue.
            </AlertDescription>
          </Alert>
        </noscript>
        <TooltipProvider>
          <NextIntlClientProvider>
            <AppProviders initialBootState={initialBootState}>
              {children}
              <Toaster />
            </AppProviders>
          </NextIntlClientProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
