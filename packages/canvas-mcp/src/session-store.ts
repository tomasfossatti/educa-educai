import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Interfaz para los datos de sesión almacenados de forma segura
 */
export interface SecureSessionData {
  sessionCookies: string;
  userAgent: string;
  updatedAt: string;
  expiresAt?: string;
  userProfile?: {
    id: number;
    name: string;
    email?: string;
  };
}

interface EncryptedPayload {
  version: number;
  iv: string; // Hex
  authTag: string; // Hex
  encryptedData: string; // Hex
}

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 1;

/**
 * Obtiene el directorio de configuración del sistema operativo para Educai MCP.
 * - Windows: %APPDATA%/educai-mcp
 * - macOS: ~/Library/Application Support/educai-mcp (o ~/.config/educai-mcp)
 * - Linux: $XDG_CONFIG_HOME/educai-mcp (o ~/.config/educai-mcp)
 */
export function getSecureStorageDir(): string {
  const home = os.homedir();
  let baseDir: string;

  if (process.platform === 'win32') {
    baseDir = process.env.APPDATA
      ? path.join(process.env.APPDATA, 'educai-mcp')
      : path.join(home, 'AppData', 'Roaming', 'educai-mcp');
  } else if (process.platform === 'darwin') {
    baseDir = path.join(home, 'Library', 'Application Support', 'educai-mcp');
  } else {
    baseDir = path.join(
      process.env.XDG_CONFIG_HOME || path.join(home, '.config'),
      'educai-mcp'
    );
  }

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true, mode: 0o700 });
  }

  return baseDir;
}

/**
 * Obtiene o inicializa la clave de cifrado local protegida para la máquina actual.
 * La clave se genera criptográficamente y se almacena con permisos de lectura exclusivos para el usuario (0o600).
 */
function getOrCreateMasterKey(): Buffer {
  const dir = getSecureStorageDir();
  const keyPath = path.join(dir, '.master.key');

  if (fs.existsSync(keyPath)) {
    try {
      const raw = fs.readFileSync(keyPath, 'utf8').trim();
      const key = Buffer.from(raw, 'hex');
      if (key.length === 32) {
        return key;
      }
    } catch {
      // Re-generar si está corrupta
    }
  }

  // Generar clave aleatoria de 256 bits vinculada a la entropía de la máquina
  const randomBytes = crypto.randomBytes(32);
  const salt = crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest();
  const key = crypto.pbkdf2Sync(randomBytes, salt, 100000, 32, 'sha256');

  fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600, encoding: 'utf8' });
  return key;
}

const SESSION_FILE_NAME = 'canvas_session.enc';

/**
 * Guarda las cookies de sesión y User-Agent cifradas con AES-256-GCM.
 * NUNCA almacena contraseñas maestras, únicamente credenciales efímeras.
 */
export function saveSecureSession(data: SecureSessionData): void {
  try {
    const dir = getSecureStorageDir();
    const filePath = path.join(dir, SESSION_FILE_NAME);
    const key = getOrCreateMasterKey();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const plaintext = JSON.stringify(data);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      version: KEY_VERSION,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encryptedData: encrypted,
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), {
      mode: 0o600,
      encoding: 'utf8',
    });
  } catch (err) {
    console.error(
      `[SessionStore] Error al guardar la sesión segura: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Carga y descifra la sesión segura almacenada localmente.
 * Retorna null si no existe o si las credenciales no pueden descifrarse.
 */
export function loadSecureSession(): SecureSessionData | null {
  try {
    const dir = getSecureStorageDir();
    const filePath = path.join(dir, SESSION_FILE_NAME);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const payload = JSON.parse(raw) as EncryptedPayload;

    if (!payload.iv || !payload.authTag || !payload.encryptedData) {
      return null;
    }

    const key = getOrCreateMasterKey();
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as SecureSessionData;
  } catch (err) {
    console.error(
      `[SessionStore] Advertencia: No se pudo descifrar la sesión local: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return null;
  }
}

/**
 * Elimina la sesión guardada
 */
export function clearSecureSession(): void {
  try {
    const dir = getSecureStorageDir();
    const filePath = path.join(dir, SESSION_FILE_NAME);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignorar si no existe
  }
}
