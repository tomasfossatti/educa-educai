/** Levanta el LMS de mentira para los tests de punta a punta: npx tsx tests/e2e/fake-lms-server.ts 4310 */
import { startFakeLms } from "../support/fake-lms";

const port = Number(process.argv[2] ?? 4310);
startFakeLms(port).then(({ url }) => console.log(`LMS de mentira en ${url}`));
