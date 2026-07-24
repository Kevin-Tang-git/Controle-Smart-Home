import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

/**
 * O GitHub Pages serve o site dentro de /nome-do-repositorio/, entao o
 * build precisa desse prefixo. Em desenvolvimento a raiz continua sendo /,
 * senao localhost:5173 daria 404.
 */
const CAMINHO_PAGES = "/Controle-Smart-Home/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? CAMINHO_PAGES : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "Controle da Fita LED",
        short_name: "Fita LED",
        description: "Controle da fita LED por Bluetooth, sem nuvem e sem assistente.",
        lang: "pt-BR",
        dir: "ltr",
        theme_color: "#08090d",
        background_color: "#08090d",
        display: "standalone",
        orientation: "portrait",
        // Explicito de proposito: com "." o Chrome resolve pelo endereco do
        // manifest, o que funciona mas ja deu problema em versoes antigas
        // do Android. Caminho absoluto nao deixa margem.
        start_url: CAMINHO_PAGES,
        scope: CAMINHO_PAGES,
        icons: [
          { src: "icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icone-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icone-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // O app inteiro roda no dispositivo e nao busca nada na rede, entao
        // guardar tudo em cache faz ele abrir offline, que e o normal para
        // quem so quer acender a luz do quarto.
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
  server: {
    host: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
}));
