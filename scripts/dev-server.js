const os = require('os');
const { spawn } = require('child_process');

// 检测 IPv4 地址
function getLanIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family !== 'IPv4' || iface.internal) continue;

      const ip = iface.address;

      // 跳过
      if (ip.startsWith('169.254.')) continue;
      if (ip === '127.0.0.1') continue;

      // 局域网优先
      if (isPrivateLAN(ip)) {
        return ip;
      }
    }
  }

  return null;
}

// 判断
function isPrivateLAN(ip) {
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

const ip = getLanIP();

if (!ip) {
  console.error('！！！无法获取有效的局域网 IP 地址！！！');
  console.error('！！！请检查网络连接是否正常！！！');
  process.exit(1);
}

console.log(`检测到局域网 IP: ${ip}`);
console.log(`局域网访问地址: http://${ip}:1313`);
console.log('');

const hugo = spawn('hugo', [
  'server', '-D',
  '--bind', '0.0.0.0',
  '--baseURL', `http://${ip}:1313`,
  '--disableFastRender',
  '--noHTTPCache'
], { stdio: 'inherit' });

hugo.on('close', (code) => {
  process.exit(code);
});