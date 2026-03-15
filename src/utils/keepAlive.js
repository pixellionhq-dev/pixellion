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

  const warmStats = async () => {
    try {
      await fetch(`${BACKEND_URL}/stats`);
    } catch (e) {
      // silent fail
    }
  };

  // Ping immediately on load
  ping();
  warmStats();

  // Ping backend every 4 minutes to prevent sleep
  setInterval(ping, 4 * 60 * 1000);
  setInterval(warmStats, 4 * 60 * 1000);
}
