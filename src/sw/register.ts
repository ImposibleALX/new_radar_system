export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return;

  window.addEventListener("load", async () => {
    try {
      const swUrl = import.meta.env.DEV
        ? "/sw.js"
        : new URL(/* @vite-ignore */ "../sw.js", import.meta.url).toString();
      const registration = await navigator.serviceWorker.register(swUrl);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed") return;
          if (!navigator.serviceWorker.controller) return;
          const toast = document.getElementById("app-update-toast");
          const reloadBtn = document.getElementById("btn-reload-app");
          if (!toast || !reloadBtn) return;
          toast.hidden = false;
          reloadBtn.addEventListener("click", () => window.location.reload(), { once: true });
        });
      });
    } catch (error) {
      console.error("Service worker registration failed", error);
    }
  });
}
