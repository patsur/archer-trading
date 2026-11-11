// Produces artifact/archer-desk.html: one file with inlined CSS/JS, React from cdnjs.
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --config vite.artifact.config.ts', { stdio: 'inherit' });
const js = readFileSync('dist-artifact/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist-artifact/app.css', 'utf8');

const html = `<title>Archer Desk</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Syne:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/archer-desk.html', html);
console.log('artifact/archer-desk.html', (html.length / 1024).toFixed(1), 'KB');
