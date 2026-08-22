const isProd = import.meta.env.PROD;

const getLocalApiUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:3001';
  }
  return 'http://localhost:3001';
};

export const API_BASE_URL = import.meta.env.VITE_API_URL || getLocalApiUrl();

export const WS_BASE_URL = import.meta.env.VITE_WS_URL || (
  API_BASE_URL.startsWith('http')
    ? API_BASE_URL.replace(/^http/, 'ws')
    : (isProd
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
        : 'ws://localhost:3001')
);
