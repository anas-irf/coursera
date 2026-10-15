// `pnpm dev`: the backend and the frontend together, which is all this file does.
//
//   backend   the Django development server (HTTP and WebSockets)   http://localhost:8000
//   frontend  the Create React App development server              http://localhost:3000
//
// The output of both is shown in this terminal, each line with the name of its source. Ctrl+C
// stops both, and when one of them stops (it crashed, or its port was taken) the other is stopped
// too, so that half a stack is never left running.
//
// What it assumes:
//   * the backend's dependencies are installed in the virtualenv at .venv, or in the Python that
//     comes first on the PATH (an activated virtualenv); $PYTHON overrides both and is an
//     executable (a path, or a command name): it is run as a program, never as a command line,
//   * the frontend's dependencies are installed (`pnpm install` in frontend/).
//
// The frontend is told where the backend is (REACT_APP_API_URL and REACT_APP_WS_URL), so that the
// pair works whatever frontend/.env and the environment say; to use another API run `pnpm start`
// in frontend/ instead.
//
// Two things that are on purpose:
//   * the backend is started by this same file (`node ../scripts/dev.mjs backend`), which runs the
//     interpreter without a shell. concurrently runs its commands through one, and a path inside a
//     command line is a quoting problem: a $PYTHON with a quote in it would run as a command,
//   * both ports are checked before anything starts, so that a taken port is one message and
//     nothing is left running. The backend allows the frontend on :3000 only (CORS): a frontend
//     that moved to another port would be a stack that does not work.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import concurrently from 'concurrently';

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const venvPython = join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = process.env.PYTHON || (existsSync(venvPython) ? venvPython : 'python');

// `node scripts/dev.mjs backend`: the Django server, started as a program and not through a shell
function runBackend() {
  const server = spawn(python, ['manage.py', 'runserver', String(BACKEND_PORT)], { stdio: 'inherit' });
  server.on('error', (error) => {
    console.error(`could not start the backend with "${python}": ${error.message}`);
    process.exit(1);
  });
  server.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

// does something answer on this port of the loopback (IPv4 or IPv6)?
function answers(port, host) {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function isTaken(port) {
  return (await answers(port, '127.0.0.1')) || (await answers(port, '::1'));
}

async function runBoth() {
  const taken = [];
  if (await isTaken(BACKEND_PORT)) taken.push(`the backend (:${BACKEND_PORT})`);
  if (await isTaken(FRONTEND_PORT)) taken.push(`the frontend (:${FRONTEND_PORT})`);
  if (taken.length) {
    console.error(`Something is already running on the port of ${taken.join(' and ')}: stop it, then run \`pnpm dev\` again.`);
    process.exit(1);
  }

  const { result } = concurrently(
    [
      {
        name: 'backend',
        command: 'node ../scripts/dev.mjs backend',
        cwd: join(root, 'backend'),
        prefixColor: 'blue',
      },
      {
        name: 'frontend',
        command: 'pnpm start',
        cwd: join(root, 'frontend'),
        env: {
          PORT: String(FRONTEND_PORT),
          REACT_APP_API_URL: `http://localhost:${BACKEND_PORT}/api/v1`,
          REACT_APP_WS_URL: `ws://localhost:${BACKEND_PORT}`,
        },
        prefixColor: 'green',
      },
    ],
    { prefix: 'name', killOthersOn: ['failure', 'success'] }
  );

  result.then(
    () => process.exit(0),
    () => process.exit(1)
  );
}

if (process.argv[2] === 'backend') {
  runBackend();
} else {
  runBoth().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
