const isProd = import.meta.env.PROD;

const getLocalApiUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.port === '3001') {
      return window.location.origin;
    }
    return `${window.location.protocol}//${window.location.hostname || 'localhost'}:3001`;
  }
  return 'http://localhost:3001';
};

export const API_BASE_URL = import.meta.env.VITE_API_URL || getLocalApiUrl();

export const WS_BASE_URL = import.meta.env.VITE_WS_URL || (
  API_BASE_URL.startsWith('http')
    ? API_BASE_URL.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
);
