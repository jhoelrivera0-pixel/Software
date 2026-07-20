const fs = require('fs');
let css = fs.readFileSync('public/css/styles.css', 'utf8');

// Define variables
const rootVars = 
  --bg-glass-01: rgba(255, 255, 255, 0.01);
  --bg-glass-02: rgba(255, 255, 255, 0.02);
  --bg-glass-03: rgba(255, 255, 255, 0.03);
  --bg-glass-04: rgba(255, 255, 255, 0.04);
  --bg-glass-05: rgba(255, 255, 255, 0.05);
  --bg-glass-06: rgba(255, 255, 255, 0.06);
  --bg-glass-08: rgba(255, 255, 255, 0.08);
  --bg-glass-10: rgba(255, 255, 255, 0.1);
  --bg-glass-12: rgba(255, 255, 255, 0.12);
  --bg-glass-15: rgba(255, 255, 255, 0.15);
;

// Insert variables in :root
css = css.replace(/:root \{/, ':root {\n' + rootVars);

// Append light theme
const lightTheme = 
:root.theme-light {
  --bg-main: #f3f4f6;
  --bg-sidebar: #ffffff;
  --bg-card: rgba(255, 255, 255, 0.95);
  --bg-card-hover: #ffffff;
  
  --border-color: rgba(0, 0, 0, 0.08);
  --border-color-hover: rgba(0, 0, 0, 0.15);
  
  --text-main: #111827;
  --text-muted: #6b7280;
  --text-dark: #374151;
  --text-inverse: #ffffff;

  --bg-glass-01: rgba(0, 0, 0, 0.01);
  --bg-glass-02: rgba(0, 0, 0, 0.02);
  --bg-glass-03: rgba(0, 0, 0, 0.03);
  --bg-glass-04: rgba(0, 0, 0, 0.04);
  --bg-glass-05: rgba(0, 0, 0, 0.05);
  --bg-glass-06: rgba(0, 0, 0, 0.06);
  --bg-glass-08: rgba(0, 0, 0, 0.08);
  --bg-glass-10: rgba(0, 0, 0, 0.1);
  --bg-glass-12: rgba(0, 0, 0, 0.12);
  --bg-glass-15: rgba(0, 0, 0, 0.15);
}
;
css += lightTheme;

// Replace all rgba(255, 255, 255, X) with var(--bg-glass-XX)
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.01\s*\)/g, 'var(--bg-glass-01)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.02\s*\)/g, 'var(--bg-glass-02)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.03\s*\)/g, 'var(--bg-glass-03)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.04\s*\)/g, 'var(--bg-glass-04)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.05\s*\)/g, 'var(--bg-glass-05)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.06\s*\)/g, 'var(--bg-glass-06)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.08\s*\)/g, 'var(--bg-glass-08)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.1\s*\)/g, 'var(--bg-glass-10)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.12\s*\)/g, 'var(--bg-glass-12)');
css = css.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.15\s*\)/g, 'var(--bg-glass-15)');
css = css.replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.2\s*\)/g, 'var(--bg-glass-08)');

fs.writeFileSync('public/css/styles.css', css);
console.log('CSS updated successfully');
