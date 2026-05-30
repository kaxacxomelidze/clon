const targetOrigin = "https://www.fighty.com";
const MEDIA_EXT = 'mp4|webm|ogg|ogv|mov|m4v|mp3|wav|m4a|flac|jpg|jpeg|png|gif|svg|webp|avif|ico|bmp|woff2?|ttf|eot|otf|pdf|css';
const attrRe = new RegExp(
  `(\\b(?:src|href|poster|data-src|data-lazy-src|data-original|data-bg|data-image)\\s*=\\s*["'])(/(?!_assets/|api/|/)[^"'?#\\s]*\\.(?:${MEDIA_EXT}))`,
  'gi',
);
const cases = [
  [`<video src="/websitefighty.mp4">`, true],
  [`<img src="/figma/logo.svg">`, true],
  [`<img src="/api/asset?path=_assets/x.png">`, false],
  [`<link href="/_assets/abc.css">`, false],
  [`<a href="/about">About</a>`, false],
  [`<a href="/pricing.html">Pricing</a>`, false],
  [`<img src="//cdn.com/x.png">`, false],
  [`<img src="https://other.com/y.jpg">`, false],
  [`<source src="/media/promo.webm">`, true],
];
let pass = 0;
for (const [c, shouldRewrite] of cases) {
  const out = c.replace(attrRe, (_m, attr, path) => `${attr}${targetOrigin}${path}`);
  const didRewrite = out !== c;
  const ok = didRewrite === shouldRewrite;
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'} [${shouldRewrite ? 'rewrite' : 'keep   '}] ${out}`);
}
console.log(`\n${pass}/${cases.length} passed`);
