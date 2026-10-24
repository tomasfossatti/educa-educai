#!/usr/bin/env node

/**
 * Script de renovación automática de sesión para Canvas LMS (Universidad Siglo 21)
 * Educai Architecture: Manejo seguro de credenciales efímeras con Puppeteer,
 * soporte de Microsoft Azure AD SSO (SAML 243) y almacenamiento cifrado en el OS.
 */

import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

// Importar módulo de almacenamiento seguro compilado
let saveSecureSession;
try {
  const storeModule = await import('./dist/session-store.js');
  saveSecureSession = storeModule.saveSecureSession;
} catch {
  // Fallback si aún no se ha compilado
  saveSecureSession = null;
}

const BASE_URL = (process.env.CANVAS_BASE_URL || 'https://siglo21.instructure.com').replace(/\/+$/, '');

/**
 * Función auxiliar para solicitar texto en terminal (con opción de ocultar contraseña)
 */
function askQuestion(query, hidden = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      process.stdout.write(query);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();

      const onData = (char) => {
        char = char.toString();
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          // Ctrl+C
          process.exit(1);
        } else if (char === '\u0008' || char === '\x7f') {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    } else {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

/**
 * Actualiza el archivo .env guardando cookies efímeras y eliminando la contraseña en texto plano si existía
 */
function updateEnvFile(newCookies, userAgent, scrubPassword = true) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  let envContent = fs.readFileSync(envPath, 'utf8');

  // Actualizar o insertar CANVAS_SESSION_COOKIES
  if (/^CANVAS_SESSION_COOKIES=.*$/m.test(envContent)) {
    envContent = envContent.replace(/^CANVAS_SESSION_COOKIES=.*$/m, `CANVAS_SESSION_COOKIES="${newCookies}"`);
  } else {
    envContent += `\nCANVAS_SESSION_COOKIES="${newCookies}"\n`;
  }

  // Actualizar o insertar CANVAS_USER_AGENT
  if (/^CANVAS_USER_AGENT=.*$/m.test(envContent)) {
    envContent = envContent.replace(/^CANVAS_USER_AGENT=.*$/m, `CANVAS_USER_AGENT="${userAgent}"`);
  } else {
    envContent += `\nCANVAS_USER_AGENT="${userAgent}"\n`;
  }

  // Eliminación segura de la contraseña maestra del archivo .env para proteger la privacidad
  if (scrubPassword && /^CANVAS_PASSWORD=.+$/m.test(envContent)) {
    envContent = envContent.replace(
      /^CANVAS_PASSWORD=.*$/m,
      `# CANVAS_PASSWORD eliminada por seguridad: Las credenciales de sesión se gestionan cifradas en el almacén local.`
    );
    console.error('🛡️ Contraseña en texto plano removida del archivo .env por directriz de seguridad.');
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.error('📝 Archivo .env sincronizado exitosamente con la sesión efímera.');
}

async function verifyNewSession(newCookies, userAgent) {
  try {
    const res = await axios.get(`${BASE_URL}/api/v1/users/self/profile`, {
      headers: {
        Cookie: newCookies,
        'User-Agent': userAgent,
        Accept: 'application/json',
      },
      timeout: 15000,
    });
    console.error(`\n🎉 ¡Sesión verificada exitosamente en Canvas LMS!`);
    console.error(`👤 Estudiante / Usuario: ${res.data.name} (ID: ${res.data.id})`);
    console.error(`📧 Correo institucional: ${res.data.primary_email || res.data.login_id || 'N/A'}`);
    return res.data;
  } catch (err) {
    console.error(`⚠️ Advertencia al verificar el perfil con las nuevas cookies: ${err.message}`);
    return null;
  }
}

async function renewSession() {
  console.error(`=======================================================`);
  console.error(`  Educai: Renovador de Sesión Canvas LMS (Siglo 21)    `);
  console.error(`=======================================================`);
  console.error(`🌐 Instancia: ${BASE_URL}`);

  let username = process.env.CANVAS_USERNAME;
  let password = process.env.CANVAS_PASSWORD;

  // Si no están en variables de entorno, solicitar interactivamente sin exponer contraseñas en disco
  if (!username) {
    username = await askQuestion('👤 Ingresa tu correo institucional (@soysiglo.21.edu.ar): ');
  }
  if (!password) {
    password = await askQuestion('🔑 Ingresa tu contraseña de Microsoft SSO (no se mostrará en pantalla): ', true);
  }

  if (!username || !password) {
    console.error('❌ Error: El usuario y la contraseña son requeridos para la autenticación institucional.');
    process.exit(1);
  }

  console.error(`\n🚀 Iniciando navegador Chromium en segundo plano...`);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    const defaultUserAgent =
      process.env.CANVAS_USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
    await page.setUserAgent(defaultUserAgent);
    await page.setViewport({ width: 1280, height: 800 });

    const samlUrl = `${BASE_URL}/login/saml/243`;
    console.error(`🔗 Conectando al portal institucional SSO de Siglo 21 (SAML 243)...`);
    await page.goto(samlUrl, { waitUntil: 'networkidle2', timeout: 40000 });

    const currentUrl = page.url();

    // 1. Detección de Microsoft Online (Azure AD SSO SAML)
    if (currentUrl.includes('login.microsoftonline.com')) {
      console.error('🔐 Formulario institucional de Microsoft Azure AD detectado.');

      // Ingresar Correo
      await page.waitForSelector('#i0116', { visible: true, timeout: 20000 });
      console.error('✍️  Ingresando usuario institucional...');
      await page.type('#i0116', username, { delay: 30 });
      await page.keyboard.press('Enter');

      // Esperar e Ingresar Contraseña
      console.error('⏳ Esperando verificación de dominio y campo de contraseña...');
      await page.waitForSelector('#i0118', { visible: true, timeout: 20000 });
      await new Promise((r) => setTimeout(r, 800)); // Breve pausa para la animación de MS
      console.error('✍️  Ingresando contraseña efímera...');
      await page.type('#i0118', password, { delay: 25 });
      console.error('📨 Enviando credenciales a Microsoft Identity Platform...');
      await page.keyboard.press('Enter');

      // Esperar respuesta de autenticación o posible desafío MFA
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 35000 }).catch(() => null);

      // Comprobar si se presentó pantalla de segundo factor (MFA / Authenticator)
      const mfaIndicator = await page.$('#idDiv_SAOTCS_Title, #idRichContext_DisplaySign');
      if (mfaIndicator) {
        console.error('📱 Solicitud de verificación en dos pasos (MFA / Authenticator) detectada.');
        console.error('   Por favor aprueba la notificación en tu teléfono (esperando hasta 60s)...');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => null);
      }

      // Detectar pantalla de permanencia "¿Desea mantener la sesión iniciada?" (KMSI)
      const kmsiBtn = await page.$('#idSIButton9');
      if (kmsiBtn) {
        console.error('📌 Confirmando persistencia de sesión institucional (KMSI)...');
        await page.click('#idSIButton9');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 35000 }).catch(() => null);
      }
    } else {
      // 2. Fallback: Formulario nativo directo de Canvas
      console.error('ℹ️ Formulario nativo de Canvas detectado.');
      await page.waitForSelector('#pseudonym_session_unique_id', { timeout: 15000 });
      await page.type('#pseudonym_session_unique_id', username, { delay: 25 });
      await page.type('#pseudonym_session_password', password, { delay: 25 });
      await Promise.all([
        page.click('input[type="submit"], button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 35000 }).catch(() => null),
      ]);
    }

    const finalUrl = page.url();
    console.error(`📍 URL de aterrizaje: ${finalUrl}`);

    if (!finalUrl.includes('instructure.com')) {
      const pageText = await page.evaluate(() => document.body.innerText.slice(0, 300));
      throw new Error(`No se pudo completar el inicio de sesión. Mensaje recibido: "${pageText}"`);
    }

    // Extraer cookies y User-Agent reales
    const cookies = await page.cookies();
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const realUserAgent = await page.evaluate(() => navigator.userAgent);

    console.error(`🍪 Cookies de sesión extraídas con éxito (${cookies.length} cookies detectadas).`);

    // Cerrar navegador
    await browser.close();

    // Verificación de salud y obtención de perfil
    const profile = await verifyNewSession(cookieString, realUserAgent);

    // Guardar en almacén local seguro cifrado con AES-256-GCM
    if (saveSecureSession) {
      saveSecureSession({
        sessionCookies: cookieString,
        userAgent: realUserAgent,
        updatedAt: new Date().toISOString(),
        userProfile: profile
          ? {
              id: profile.id,
              name: profile.name,
              email: profile.primary_email || profile.login_id,
            }
          : undefined,
      });
      console.error('🔒 Sesión guardada de forma cifrada en el almacén de configuración del usuario.');
    }

    // Sincronizar archivo .env sin exponer la contraseña
    updateEnvFile(cookieString, realUserAgent, true);

    console.error('\n✅ ¡Proceso de renovación completado con éxito!');
  } catch (err) {
    await browser.close();
    throw err;
  }
}

renewSession().catch((err) => {
  console.error('\n❌ Error durante la renovación de sesión:', err.message);
  process.exit(1);
});
