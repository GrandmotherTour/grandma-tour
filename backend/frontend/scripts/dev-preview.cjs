const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nodeExe = path.resolve(root, '..', '.tools', 'node-v22.22.0-win-x64', 'node.exe');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(nodeExe, [viteBin, ...args], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => resolve(code ?? 1));
  });
}

(async () => {
  const buildCode = await run(['build', '--configLoader', 'native']);
  if (buildCode !== 0) process.exit(buildCode);

  const preview = spawn(nodeExe, [viteBin, 'preview', '--configLoader', 'native', '--host', '0.0.0.0', '--port', '5173'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  preview.on('close', (code) => process.exit(code ?? 0));
})();
