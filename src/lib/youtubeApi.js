// Loads YouTube's IFrame Player API once, on demand, and resolves with the
// global `YT` namespace. Nothing is fetched until something actually asks
// for it -- people who never turn on focus music never load a byte of it.
//
// Safe to call from many places at once: every caller shares one promise,
// and if some other code on the page already defined
// window.onYouTubeIframeAPIReady we chain it instead of clobbering it.

let apiPromise = null;

export function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { if (typeof prev === "function") prev(); } catch { /* not ours */ }
      resolve(window.YT);
    };

    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const script = existing || document.createElement("script");
    if (!existing) {
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("error", () => {
      // Let the next caller try again (offline -> back online) instead of
      // caching a permanently-rejected promise.
      apiPromise = null;
      reject(new Error("YouTube player failed to load"));
    });
  });
  return apiPromise;
}
