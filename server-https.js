/**
 * Custom HTTPS dev server for Next.js so Meta/Facebook Login (FB.login) works locally.
 * FB.login requires HTTPS (see https://developers.facebook.com/blog/post/2018/06/08/enforce-https-facebook-login/).
 *
 * Run: npm run dev:https
 * Then open https://localhost:3000 (accept the self-signed cert warning once).
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const next = require('next');

// Use 3001 so HTTPS doesn't conflict with "npm run dev" (HTTP on 3000)
const port = parseInt(process.env.PORT || '3001', 10);
const dev = process.env.NODE_ENV !== 'production';
const certDir = path.join(__dirname, '.cert');

function getHttpsOptions() {
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8'),
    };
  }

  // Generate self-signed cert for localhost
  try {
    const selfsigned = require('selfsigned');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const opts = { days: 365, algorithm: 'sha256', keySize: 2048 };
    const pems = selfsigned.generate(attrs, opts);

    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    console.log('Generated self-signed certificate in .cert/');
    return { key: pems.private, cert: pems.cert };
  } catch (e) {
    console.error('Failed to generate certificate. Run: npm install');
    console.error(e.message);
    process.exit(1);
  }
}

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpsOptions = getHttpsOptions();
  const server = https.createServer(httpsOptions, (req, res) => {
    handle(req, res);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> HTTPS dev server ready at https://localhost:${port}`);
    console.log('  Open that URL in your browser (not port 3000). Accept the certificate warning once.');
  });
});
