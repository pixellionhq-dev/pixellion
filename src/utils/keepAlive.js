export function startKeepAlive() {
  const BACKEND_URL = import.meta.env.VITE_API_URL ||
    'https://pixellion-ilos.onrender.com';

  const ping = async () => {
    try {
      await fetch(`${BACKEND_URL}/pixels`);
    } catch (e) {
      // silent fail
    }
  };

  // Ping immediately on load
  ping();

  // Ping backend every 4 minutes to prevent sleep
  setInterval(ping, 4 * 60 * 1000);
}
