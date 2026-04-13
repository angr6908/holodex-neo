import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import visualizer from "rollup-plugin-visualizer";
import yaml from "@rollup/plugin-yaml";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default ({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, process.cwd()) };
    const API_BASE_URL = env.API_BASE_URL ?? "https://holodex.net";
    const REWRITE_API_ROUTES = `${env.REWRITE_API_ROUTES || ""}`.toLowerCase() === "true";
    // API key removed — reverse proxy handles auth-free access to holodex.net

    return defineConfig({
        plugins: [
            yaml(),
            tailwindcss(),
            vue(),
            VitePWA({
                includeAssets: [
                    "favicon.ico",
                    "robots.txt",
                    "img/icons/safari-pinned-tab.svg",
                ],
                manifest: {
                    display: "standalone",
                    theme_color: "#42a5f5",
                    name: "Holodex",
                    background_color: "#42a5f5",
                    scope: "/",
                    start_url: "/",
                    icons: [
                        {
                            src: "img/icons/android-chrome-192x192.png",
                            sizes: "192x192",
                            type: "image/png",
                        },
                        {
                            src: "img/icons/android-chrome-512x512.png",
                            sizes: "512x512",
                            type: "image/png",
                        },
                    ],
                },
                workbox: {
                    swDest: "./dist/sw.js",
                    navigateFallbackDenylist: [
                        /^\/api/,
                        /^\/assets/,
                        /^\/img/,
                        /^\/sitemap-.*/,
                        /^\/statics.*/,
                        /^.*\.js(\.map)?/,
                        /^.*\.css/,
                        /^.*\.webmanifest/,
                    ],
                    runtimeCaching: [
                        {
                            urlPattern: new RegExp(
                                "https://fonts.(?:googleapis|gstatic).com/(.*)",
                            ),
                            handler: "CacheFirst",
                            options: {
                                cacheName: "google-fonts",
                                expiration: {
                                    maxEntries: 30,
                                },
                                cacheableResponse: {
                                    statuses: [0, 200],
                                },
                            },
                        },
                        {
                            urlPattern: new RegExp("https://yt3.ggpht.com/ytc/(.*)"),
                            handler: "CacheFirst",
                            options: {
                                cacheName: "channel-photo",
                                expiration: {
                                    maxAgeSeconds: 86400,
                                    purgeOnQuotaError: true,
                                },
                                cacheableResponse: {
                                    statuses: [0, 200],
                                },
                            },
                        },
                        {
                            urlPattern: new RegExp("https://www.youtube.com/player_api"),
                            handler: "CacheFirst",
                            options: {
                                cacheName: "youtube-player",
                                expiration: {
                                    maxAgeSeconds: 10800,
                                    maxEntries: 1,
                                },
                                cacheableResponse: {
                                    statuses: [0, 200],
                                },
                            },
                        },
                        {
                            urlPattern: new RegExp(`${API_BASE_URL}/(stats|orgs).json$`),
                            handler: "CacheFirst",
                            options: {
                                cacheName: "holodex-statics",
                                expiration: {
                                    maxAgeSeconds: 10800,
                                },
                                cacheableResponse: {
                                    statuses: [0, 200],
                                },
                            },
                        },
                        {
                            urlPattern: new RegExp(`${API_BASE_URL}/statics/.*$`),
                            handler: "CacheFirst",
                            options: {
                                cacheName: "holodex-statics-route",
                                expiration: {
                                    maxAgeSeconds: 86400,
                                    purgeOnQuotaError: true,
                                },
                                cacheableResponse: {
                                    statuses: [0, 200],
                                },
                            },
                        },
                    ],
                    importScripts: ["./sw-add.js"],
                },
            }),
            visualizer({ gzipSize: true }),
        ],
        resolve: {
            alias: [
                {
                    find: "@",
                    replacement: path.resolve(__dirname, "src"),
                },
            ],
        },
        build: {
            target: "es2022",
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, "index.html"),
                    seo: path.resolve(__dirname, "seo.html"),
                },
                output: {
                    compact: true,
                    manualChunks: {
                        "vendor-vue": ["vue", "vue-router", "pinia", "vue-i18n"],
                        "vendor-ui": ["reka-ui", "clsx", "class-variance-authority", "tailwind-merge"],
                        "vendor-utils": ["axios", "dayjs", "lodash-es"],
                    },
                },
            },
        },
        server: {
            port: 8080,
            strictPort: true,
            proxy: {
                "/api": {
                    target: API_BASE_URL,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                    rewrite: (url) => (REWRITE_API_ROUTES ? url.replace(/^\/api/, "") : url),
                    configure: (proxy) => {
                        proxy.on("proxyReq", (proxyReq) => {
                            proxyReq.setHeader("Origin", API_BASE_URL);
                            proxyReq.setHeader("Referer", `${API_BASE_URL}/`);
                        });
                    },
                },
                "^/(stats|orgs).json$": {
                    target: API_BASE_URL,
                    changeOrigin: true,
                    secure: false,
                },
                "/statics": {
                    target: API_BASE_URL,
                    changeOrigin: true,
                    secure: false,
                },
                "/twitch-gql": {
                    target: "https://gql.twitch.tv",
                    changeOrigin: true,
                    secure: true,
                    rewrite: () => "/gql",
                    configure: (proxy) => {
                        proxy.on("proxyReq", (proxyReq) => {
                            proxyReq.setHeader("Origin", "https://www.twitch.tv");
                            proxyReq.setHeader("Referer", "https://www.twitch.tv/");
                        });
                    },
                },
            },
        },
    });
};
