// Centralized API and WebSocket configuration
// Dynamically selects environment variables or defaults to localhost:3001

const isProd = import.meta.env.PROD;

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const WS_BASE_URL = import.meta.env.VITE_WS_URL || (
  isProd
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    : 'ws://localhost:3001'
);
