export function startKeepAlive() {
  const BACKEND_URL = import.meta.env.VITE_API_URL ||
    'https://pixellion-ilos.onrender.com';

  // Ping backend every 10 minutes to prevent sleep
  setInterval(async () => {
    try {
      await fetch(`${BACKEND_URL}/pixels`);
    } catch (e) {
      // silent fail
    }
  }, 10 * 60 * 1000);
}
