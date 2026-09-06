const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nodeExe = path.join(root, '.tools', 'node-v22.22.0-win-x64', 'node.exe');
const tscBin = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const serverFile = path.join(root, 'dist', 'server.js');
const srcDir = path.join(root, 'src');

let server = null;
let buildQueued = false;
let building = false;
let restartTimer = null;

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => resolve(code ?? 1));
  });
}

function stopServer() {
  if (!server || server.exitCode !== null) return Promise.resolve();

  return new Promise((resolve) => {
    server.once('close', resolve);
    server.kill();
  });
}

async function buildAndRestart() {
  if (building) {
    buildQueued = true;
    return;
  }

  building = true;
  buildQueued = false;

  const code = await run(nodeExe, [tscBin]);
  if (code === 0) {
    await stopServer();
    server = spawn(nodeExe, [serverFile], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });
  } else {
    console.error(`[dev] TypeScript build failed with exit code ${code}`);
  }

  building = false;

  if (buildQueued) {
    buildAndRestart();
  }
}

function scheduleBuild() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(buildAndRestart, 150);
}

process.on('SIGINT', async () => {
  await stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopServer();
  process.exit(0);
});

console.log('[dev] using Node ' + process.version);
buildAndRestart();

fs.watch(srcDir, { recursive: true }, (_eventType, filename) => {
  if (!filename || !filename.endsWith('.ts')) return;
  scheduleBuild();
});
