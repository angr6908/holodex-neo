import type { Metadata, Viewport } from "next";
import "./globals.css";
import { cookies, headers } from "next/headers";
import { AppProviders } from "@/components/common/AppShell";
import { APP_BOOT_COOKIE, decodeBootCookie } from "@/lib/persist-cookie";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.holodex.net"),
  title: "Holodex",
  description: "Catch multiple collabs and streams using our multiview tool, find clips and listen to music/karaoke/covers from your favorite vtubers.",
  applicationName: "Holodex",
  appleWebApp: { capable: true, title: "Holodex", statusBarStyle: "default" },
  icons: { icon: "/favicon.ico", apple: "/img/icons/apple-touch-icon-152x152.png" },
  openGraph: { type: "website", title: "Holodex", description: "Catch multiple collabs and streams using our multiview tool, find clips and listen to music/karaoke/covers from your favorite vtubers.", images: ["/img/intro-promo.jpg"], siteName: "HOLODEX" },
  twitter: { card: "summary_large_image", site: "@holodex", title: "Holodex", description: "Catch multiple collabs and streams using our multiview tool, find clips and listen to music/karaoke/covers from your favorite vtubers.", images: ["/img/intro-promo.jpg"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover", themeColor: "#42a5f5" };

const themeInit = `
(function(){
try{
var h=document.documentElement;
h.classList.add('theme-switching');
var s=localStorage.getItem('holodex-v2-settings');
var settings=s?JSON.parse(s):{};
var appRaw=localStorage.getItem('holodex-v2-app');
var app=appRaw?JSON.parse(appRaw):{};
try{var vw=window.innerWidth||1440;var boot={isMobile:vw<960,windowWidth:vw,currentOrg:app.currentOrg,selectedHomeOrgs:app.selectedHomeOrgs,orgFavorites:app.orgFavorites,currentGridSize:app.currentGridSize,settings:{lang:settings.lang,defaultOpen:settings.defaultOpen,homeViewMode:settings.homeViewMode,scrollMode:settings.scrollMode,hideUpcoming:settings.hideUpcoming,darkMode:settings.darkMode,followSystemTheme:settings.followSystemTheme}};document.cookie='${APP_BOOT_COOKIE}='+encodeURIComponent(JSON.stringify(boot))+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch(e){}
var isDark=true;
if(settings.followSystemTheme){isDark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)').matches:true;}else if(typeof settings.darkMode==='boolean'){isDark=settings.darkMode;}
var mode=isDark?'dark':'light';
h.setAttribute('data-theme',mode);
h.style.colorScheme=mode;
var cachedBg=localStorage.getItem('holodex-theme-bg');
if(cachedBg){h.style.setProperty('--colorbg',cachedBg);h.style.backgroundColor=cachedBg;}else if(!isDark){h.style.setProperty('--colorbg','#eef2f7');h.style.backgroundColor='#eef2f7';}
var path=location.pathname||'/';
var showTopBar=!(new RegExp('^/(multiview|tlclient|scripteditor)(/|$)').test(path));
if(showTopBar){var mobile=window.innerWidth<960;var homeTabs=mobile&&path==='/';h.style.setProperty('--nav-header-height','65px');h.style.setProperty('--nav-total-height',homeTabs?'127px':'81px');}else{h.style.setProperty('--nav-header-height','0px');h.style.setProperty('--nav-total-height','0px');}
}catch(e){}
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'){var root=document.documentElement;root.classList.add('theme-switching');requestAnimationFrame(function(){requestAnimationFrame(function(){requestAnimationFrame(function(){root.classList.remove('theme-switching');});});});}});
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const cookieBootState = decodeBootCookie(cookieStore.get(APP_BOOT_COOKIE)?.value);
  const requestIsMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(requestHeaders.get("user-agent") || "");
  const initialBootState = {
    ...(cookieBootState || {}),
    isMobile: cookieBootState?.isMobile ?? requestIsMobile,
    windowWidth: cookieBootState?.windowWidth ?? (requestIsMobile ? 390 : 1440),
  };
  return <html lang="en" suppressHydrationWarning style={{ backgroundColor: "var(--colorbg, #111827)" }}><head suppressHydrationWarning><script id="holodex-theme-init" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInit }} /><script src="/config.js" defer suppressHydrationWarning /></head><body className="scroll-bar" suppressHydrationWarning style={{ paddingTop: "env(safe-area-inset-top)", backgroundColor: "var(--colorbg, #111827)" }}><noscript><strong>We're sorry but this site doesn't work properly without JavaScript enabled. Please enable it to continue.</strong></noscript><AppProviders initialBootState={initialBootState}>{children}</AppProviders></body></html>;
}
