// Typechecks every workspace member with its *own* tsconfig, so each package's `lib`
// dial is honoured: the domain compiles without the DOM, the service worker compiles
// against the WebWorker lib, the elements against the DOM. One tsc run per project.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const projects = [
  'platform/kernel',
  'platform/kernel/tsconfig.context.json',
  'platform/commons',
  'domain/contract',
  'domain/core',
  'design-system',
  'user-side/elements',
  'infra/storage-indexeddb',
  'infra/reminders-browser',
  'infra/install-browser',
  'application/pwa',
  'application/pwa/tsconfig.sw.json',
  'tsconfig.tests.json',
];

let failed = false;
for (const project of projects) {
  process.stdout.write(`tsc -p ${project} … `);
  try {
    execFileSync('npx', ['tsc', '-p', project], { cwd: root, stdio: 'pipe' });
    process.stdout.write('ok\n');
  } catch (error) {
    failed = true;
    process.stdout.write('FAILED\n');
    process.stdout.write(String(error.stdout ?? ''));
    process.stdout.write(String(error.stderr ?? ''));
  }
}
process.exit(failed ? 1 : 0);
