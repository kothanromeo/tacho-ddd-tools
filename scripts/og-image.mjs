// Génère public/og.png (1200×630), l'image affichée quand on partage le site
// sur LinkedIn, Slack, X… Usage : node scripts/og-image.mjs
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b3a57"/>
      <stop offset="1" stop-color="#0b5c8c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(860 120)">
    <circle cx="125" cy="150" r="140" fill="#ffffff"/>
    <circle cx="125" cy="150" r="118" fill="#0f1720"/>
    <path d="M40 185a88 88 0 0 1 170 0" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
    <path d="M125 185l52-62" stroke="#7fd1ff" stroke-width="12" stroke-linecap="round"/>
    <circle cx="125" cy="185" r="14" fill="#ffffff"/>
    <rect x="70" y="215" width="110" height="26" rx="6" fill="#1a7f4b"/>
    <text x="125" y="235" text-anchor="middle" font-family="Consolas, monospace" font-size="20" fill="#ffffff">.DDD</text>
    <rect x="-50" y="300" width="300" height="56" rx="12" fill="#0f1720" stroke="#ffffff" stroke-opacity="0.25"/>
    <text x="-30" y="336" font-family="Consolas, monospace" font-size="22" fill="#7fd1ff">conduite 8 h 42</text>
  </g>
  <text x="80" y="200" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="700" fill="#ffffff">Tacho DDD Tools</text>
  <text x="80" y="275" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#d5e7f3">Lire une carte conducteur</text>
  <text x="80" y="325" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#d5e7f3">et ses temps de conduite</text>
  <g font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="600">
    <rect x="80" y="400" width="300" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="104" y="435" fill="#ffffff">100 % navigateur</text>
    <rect x="400" y="400" width="200" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="424" y="435" fill="#ffffff">Gratuit</text>
    <rect x="620" y="400" width="200" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="644" y="435" fill="#ffffff">Open source</text>
  </g>
  <text x="80" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#9fc3da">Fichiers .DDD · carte G1 et G2 · règlement 561/2006</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og.png');
console.log('public/og.png généré');
