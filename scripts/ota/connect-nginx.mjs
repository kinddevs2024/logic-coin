import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const path = '/etc/nginx/sites-enabled/apps.conf';
const original = readFileSync(path, 'utf8');
const marker = '    server_name logic-coin.online www.logic-coin.online;';
if (!original.includes(marker)) throw new Error('Expected Logic Coin vhost not found');
if (!original.includes('location ^~ /updates')) {
  const backup = `/srv/apps/logic-coin/backups/nginx-before-ota-${Date.now()}.conf`;
  copyFileSync(path, backup);
  const routes = '\n\n    location = /updates { proxy_pass http://127.0.0.1:8099; proxy_set_header Host $host; }\n    location ^~ /updates/ { proxy_pass http://127.0.0.1:8099; proxy_set_header Host $host; }';
  writeFileSync(path, original.replace(marker, marker + routes));
  try { execFileSync('nginx', ['-t'], { stdio: 'inherit' }); }
  catch (error) { writeFileSync(path, original); throw error; }
  execFileSync('systemctl', ['reload', 'nginx']);
}
