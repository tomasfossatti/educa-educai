import dotenv from 'dotenv';
import { loadSecureSession } from './session-store.js';

dotenv.config();

export interface ServerConfig {
  baseUrl: string;
  sessionCookies: string;
  userAgent: string;
  apiToken?: string;
  sessionSource: 'environment' | 'secure_store' | 'none';
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const DEFAULT_BASE_URL = 'https://siglo21.instructure.com';

function isPlaceholder(value?: string): boolean {
  if (!value) return true;
  const v = value.toLowerCase();
  return (
    v.includes('tu_cookie') ||
    v.includes('tu_token') ||
    v.includes('tu_password') ||
    v.trim() === ''
  );
}

export function loadConfig(): ServerConfig {
  let rawBaseUrl = process.env.CANVAS_BASE_URL || DEFAULT_BASE_URL;
  // Remove trailing slashes
  rawBaseUrl = rawBaseUrl.replace(/\/+$/, '');

  const envCookies = process.env.CANVAS_SESSION_COOKIES || process.env.CANVAS_COOKIES || '';
  const envUserAgent = process.env.CANVAS_USER_AGENT || '';
  const apiToken = process.env.CANVAS_API_TOKEN || undefined;

  let sessionCookies = '';
  let userAgent = DEFAULT_USER_AGENT;
  let sessionSource: 'environment' | 'secure_store' | 'none' = 'none';

  // 1. Probar credenciales de variables de entorno si no son placeholders
  if (envCookies && !isPlaceholder(envCookies)) {
    sessionCookies = envCookies.trim();
    userAgent = envUserAgent ? envUserAgent.trim() : DEFAULT_USER_AGENT;
    sessionSource = 'environment';
  } else {
    // 2. Si no están en .env o son placeholders, intentar cargar desde el almacén seguro cifrado
    const secureSession = loadSecureSession();
    if (secureSession && secureSession.sessionCookies) {
      sessionCookies = secureSession.sessionCookies;
      userAgent = secureSession.userAgent || DEFAULT_USER_AGENT;
      sessionSource = 'secure_store';
    }
  }

  return {
    baseUrl: rawBaseUrl,
    sessionCookies,
    userAgent,
    apiToken: isPlaceholder(apiToken) ? undefined : apiToken?.trim(),
    sessionSource,
  };
}
