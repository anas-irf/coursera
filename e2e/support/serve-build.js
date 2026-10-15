// Serves the production build of the frontend with the single-page-app fallback.
// Dependency free on purpose: it only has to exist while the specs run.
//
//   node support/serve-build.js [build-directory]      (PORT=3000 by default)
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'frontend', 'build'));
const port = Number(process.env.PORT || 3000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error(`no build found in ${root}: run "pnpm run build" in frontend/ first`);
  process.exit(1);
}

http
  .createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    let file = path.join(root, decodeURIComponent(pathname));
    if (!file.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) file = path.join(root, 'index.html');
      response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(response);
    });
  })
  .listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://localhost:${port}`));
