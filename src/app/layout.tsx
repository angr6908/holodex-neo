import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { Noto_Sans_JP } from "next/font/google";
import localFont from "next/font/local";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { AppProviders } from "@/components/app/AppProviders";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  APP_BOOT_COOKIE,
  decodeAppBootCookie,
  decodeHomeStateCookie,
  HOME_STATE_COOKIE,
} from "@/lib/cookie-codec";
import { LEGACY_THEME_COLOR } from "@/lib/themes";
import { cn } from "@/lib/utils";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff2",
  variable: "--font-geist",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});
// Video-card title typeface. Noto Sans JP covers Latin + CJK, so titles render consistently in every UI language.
// preload disabled — the glyph set is large and only needed for the title.
const notoSansJp = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  variable: "--font-noto-jp",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.holodex.net"),
  title: "Holodex",
  description:
    "Catch collabs and streams with Multiview, find clips, and listen to music, karaoke, and covers from your favorite VTubers.",
  applicationName: "Holodex",
  appleWebApp: { capable: true, title: "Holodex", statusBarStyle: "default" },
  icons: { icon: "/favicon.ico", apple: "/img/icons/apple-touch-icon-152x152.png" },
  openGraph: {
    type: "website",
    title: "Holodex",
    description:
      "Catch collabs and streams with Multiview, find clips, and listen to music, karaoke, and covers from your favorite VTubers.",
    images: ["/img/intro-promo.jpg"],
    siteName: "HOLODEX",
  },
  twitter: {
    card: "summary_large_image",
    site: "@holodex",
    title: "Holodex",
    description:
      "Catch collabs and streams with Multiview, find clips, and listen to music, karaoke, and covers from your favorite VTubers.",
    images: ["/img/intro-promo.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: LEGACY_THEME_COLOR,
};

// Minified theme-palette injector — must stay in sync with buildThemeCss() in themes.ts.
// Key points:
//   • Tints are PROPORTIONAL to brand chroma (_C) so vivid colours like Sora's
//     blue saturate surfaces visibly, while near-grey colours stay neutral.
//   • Selectors use :root[data-theme] / .dark[data-theme] (specificity 0-2-0)
//     which beats the plain :root / .dark in globals.css (0-1-0) regardless of
//     stylesheet injection order (including Next.js dev-mode HMR re-injections).
const themeBootSnippet = `try{
var tc=localStorage.getItem('theme-color');
if(tc&&/^#[0-9a-f]{6}$/i.test(tc)){
var _r=parseInt(tc.slice(1,3),16)/255,_g=parseInt(tc.slice(3,5),16)/255,_b=parseInt(tc.slice(5,7),16)/255;
var _lin=function(c){return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
var _lr=_lin(_r),_lg=_lin(_g),_lb=_lin(_b);
var _l=Math.cbrt(0.4122214708*_lr+0.5363325363*_lg+0.0514459929*_lb);
var _m=Math.cbrt(0.2119034982*_lr+0.6806995451*_lg+0.1073969566*_lb);
var _s=Math.cbrt(0.0883024619*_lr+0.2817188376*_lg+0.6299787005*_lb);
var _L=0.2104542553*_l+0.793617785*_m-0.0040720468*_s;
var _A=1.9779984951*_l-2.428592205*_m+0.4505937099*_s;
var _B=0.0259040371*_l+0.7827717662*_m-0.808675766*_s;
var _C=Math.sqrt(_A*_A+_B*_B);
var _H=((Math.atan2(_B,_A)*180/Math.PI)+360)%360;
var f=function(l,c){return'oklch('+l.toFixed(3)+' '+c.toFixed(4)+' '+_H.toFixed(1)+')'};
var tc2=function(fr,cap){return Math.min(_C*fr,cap)};
var surfT=tc2(0.15,0.045),subT=tc2(0.12,0.036),fgT=tc2(0.10,0.025),mutFgT=tc2(0.25,0.060),bdrT=tc2(0.10,0.028),secLT=tc2(0.07,0.020),sidLT=tc2(0.05,0.015);
var lp=f(Math.max(0.28,Math.min(0.50,_L)),_C);
var dp=f(Math.max(0.62,Math.min(0.82,_L+0.28)),_C);
var lFg=f(0.145,fgT),lSec=f(0.970,secLT),lSFg=f(0.205,fgT),lMFg=f(0.556,mutFgT),lBdr=f(0.922,bdrT),lSid=f(0.985,sidLT);
var dBg=f(0.145,surfT),dFg=f(0.985,fgT),dCd=f(0.205,surfT),dSec=f(0.269,subT),dMFg=f(0.708,mutFgT);
var css=':root[data-theme]{'
+'--background:oklch(1 0 0);--foreground:'+lFg+';'
+'--card:oklch(1 0 0);--card-foreground:'+lFg+';'
+'--popover:oklch(1 0 0);--popover-foreground:'+lFg+';'
+'--primary:'+lp+';--primary-foreground:oklch(0.985 0 0);'
+'--secondary:'+lSec+';--secondary-foreground:'+lSFg+';'
+'--muted:'+lSec+';--muted-foreground:'+lMFg+';'
+'--accent:'+lSec+';--accent-foreground:'+lSFg+';'
+'--border:'+lBdr+';--input:'+lBdr+';--ring:'+lp+';'
+'--sidebar:'+lSid+';--sidebar-foreground:'+lFg+';'
+'--sidebar-primary:'+lp+';--sidebar-primary-foreground:oklch(0.985 0 0);'
+'--sidebar-accent:'+lSec+';--sidebar-accent-foreground:'+lSFg+';'
+'--sidebar-border:'+lBdr+';--sidebar-ring:'+lp
+'}.dark[data-theme]{'
+'--background:'+dBg+';--foreground:'+dFg+';'
+'--card:'+dCd+';--card-foreground:'+dFg+';'
+'--popover:'+dCd+';--popover-foreground:'+dFg+';'
+'--primary:'+dp+';--primary-foreground:oklch(0.145 0 0);'
+'--secondary:'+dSec+';--secondary-foreground:'+dFg+';'
+'--muted:'+dSec+';--muted-foreground:'+dMFg+';'
+'--accent:'+dSec+';--accent-foreground:'+dFg+';'
+'--border:oklch(1 0 0/10%);--input:oklch(1 0 0/15%);--ring:'+dp+';'
+'--sidebar:'+dCd+';--sidebar-foreground:'+dFg+';'
+'--sidebar-primary:'+dp+';--sidebar-primary-foreground:oklch(0.145 0 0);'
+'--sidebar-accent:'+dSec+';--sidebar-accent-foreground:'+dFg+';'
+'--sidebar-border:oklch(1 0 0/10%);--sidebar-ring:'+dp
+'}';
var st=document.getElementById('holodex-theme-vars');
if(!st){st=document.createElement('style');st.id='holodex-theme-vars';document.head.appendChild(st);}
st.textContent=css;
}
}catch(e){}`;

const bootInit = `
(function(){
try{
var h=document.documentElement;
var parse=function(raw,fallback){try{return raw?JSON.parse(raw):fallback}catch(e){return fallback}};
var settings=parse(localStorage.getItem('holodex-v2-settings'),{});
if(settings.lang){document.cookie='locale='+encodeURIComponent(settings.lang)+'; Path=/; Max-Age=31536000; SameSite=Lax';}
var homeStateRaw=localStorage.getItem('holodex-home-state');
if(homeStateRaw){try{var homeState=JSON.parse(homeStateRaw);var cleanHomeState=JSON.stringify({viewMode:homeState.viewMode,isFavPage:homeState.isFavPage,tab:homeState.tab});localStorage.setItem('holodex-home-state',cleanHomeState);document.cookie='${HOME_STATE_COOKIE}='+encodeURIComponent(cleanHomeState)+'; Path=/; SameSite=Lax';}catch(e){}}
var app=parse(localStorage.getItem('holodex-v2-app'),{});
var home=parse(localStorage.getItem('holodex-v2-home'),{}),fav=parse(localStorage.getItem('holodex-v2-favorites'),{});
var homeLive=home.live||[],favLive=fav.live||[];
var countLive=function(a){return(a||[]).filter(function(v){return v&&v.status==='live'}).length};
try{var vw=window.innerWidth||1440;var boot={isMobile:vw<960,windowWidth:vw,currentOrg:app.currentOrg,selectedHomeOrgs:app.selectedHomeOrgs,orgFavorites:app.orgFavorites,currentGridSize:app.currentGridSize,homeLiveCount:countLive(homeLive),favoritesLiveCount:countLive(favLive),settings:{lang:settings.lang,defaultOpen:settings.defaultOpen,homeViewMode:settings.homeViewMode,scrollMode:settings.scrollMode,hideUpcoming:settings.hideUpcoming,hideLive:settings.hideLive,darkMode:settings.darkMode,followSystemTheme:settings.followSystemTheme}};document.cookie='${APP_BOOT_COOKIE}='+encodeURIComponent(JSON.stringify(boot))+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch(e){}
var path=location.pathname||'/';
var showTopBar=!(new RegExp('^/(multiview|tlclient|scripteditor|watch)(/|$)').test(path));
if(showTopBar){h.style.setProperty('--nav-header-height','52px');h.style.setProperty('--nav-total-height','56px');h.style.setProperty('--nav-h','52px');}else{h.style.setProperty('--nav-header-height','0px');h.style.setProperty('--nav-total-height','0px');h.style.setProperty('--nav-h','0px');}
var dark=settings.darkMode!==false;
if(settings.followSystemTheme){try{dark=window.matchMedia('(prefers-color-scheme: dark)').matches;}catch(e){}}
if(dark){h.classList.add('dark');h.style.colorScheme='dark';}else{h.classList.remove('dark');h.style.colorScheme='light';}
${themeBootSnippet}
}catch(e){}
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const cookieBootState = decodeAppBootCookie(cookieStore.get(APP_BOOT_COOKIE)?.value);
  const initialHomeState = decodeHomeStateCookie(cookieStore.get(HOME_STATE_COOKIE)?.value);
  const requestIsMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(
    requestHeaders.get("user-agent") || "",
  );
  const initialBootState = {
    ...(cookieBootState || {}),
    isMobile: cookieBootState?.isMobile ?? requestIsMobile,
    windowWidth: cookieBootState?.windowWidth ?? (requestIsMobile ? 390 : 1440),
  };
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-theme="holodex"
      className={cn(
        geistSans.variable,
        geistMono.variable,
        notoSansJp.variable,
        "dark font-sans [color-scheme:dark]",
      )}
    >
      <head suppressHydrationWarning>
        <link rel="preconnect" href="https://holodex.net" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://yt3.ggpht.com" />
        <link rel="dns-prefetch" href="https://static-cdn.jtvnw.net" />
        <Script
          id="holodex-boot-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: bootInit }}
        />
        <Script src="/config.js" strategy="beforeInteractive" />
      </head>
      <body
        className="group/ptr bg-background pt-[env(safe-area-inset-top)] text-foreground"
        suppressHydrationWarning
      >
        <noscript>
          <Alert>
            <AlertDescription>
              This site requires JavaScript. Enable JavaScript to continue.
            </AlertDescription>
          </Alert>
        </noscript>
        <TooltipProvider>
          <NextIntlClientProvider>
            <AppProviders initialBootState={initialBootState} initialHomeState={initialHomeState}>
              {children}
              <Toaster />
            </AppProviders>
          </NextIntlClientProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
