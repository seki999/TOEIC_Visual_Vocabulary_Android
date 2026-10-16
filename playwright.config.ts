import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  use: { baseURL: "http://127.0.0.1:5173", headless: true },
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "phone-portrait",
      use: {
        viewport: { width: 393, height: 851 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-landscape",
      use: {
        viewport: { width: 851, height: 393 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-portrait",
      use: {
        viewport: { width: 800, height: 1280 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-landscape",
      use: {
        viewport: { width: 1280, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
