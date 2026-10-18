import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
const local = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const child = spawn(existsSync(local) ? local : (process.platform === 'win32' ? 'python' : 'python3'), process.argv.slice(2), { stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
child.on('error', error => { console.error(error.message); process.exit(1); });
