const fs = require('fs');
const path = require('path');

// Create a simple SVG favicon with INNOQUEST branding
const svgFavicon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <!-- Dark navy background -->
  <rect width="256" height="256" fill="#0a1628"/>
  
  <!-- Cyan accent circle -->
  <circle cx="128" cy="128" r="120" fill="none" stroke="#06b6d4" stroke-width="8"/>
  
  <!-- QR-inspired grid pattern -->
  <g fill="#06b6d4">
    <!-- Top-left corner (like QR position marker) -->
    <rect x="30" y="30" width="40" height="40" fill="#06b6d4"/>
    <rect x="35" y="35" width="30" height="30" fill="#0a1628"/>
    <rect x="40" y="40" width="20" height="20" fill="#06b6d4"/>
    
    <!-- Top-right corner -->
    <rect x="186" y="30" width="40" height="40" fill="#06b6d4"/>
    <rect x="191" y="35" width="30" height="30" fill="#0a1628"/>
    <rect x="196" y="40" width="20" height="20" fill="#06b6d4"/>
    
    <!-- Bottom-left corner -->
    <rect x="30" y="186" width="40" height="40" fill="#06b6d4"/>
    <rect x="35" y="191" width="30" height="30" fill="#0a1628"/>
    <rect x="40" y="196" width="20" height="20" fill="#06b6d4"/>
    
    <!-- Center "IQ" indication -->
    <rect x="110" y="115" width="8" height="28" fill="#06b6d4"/>
    <rect x="138" y="115" width="8" height="28" fill="#06b6d4"/>
    <rect x="110" y="143" width="36" height="8" fill="#06b6d4"/>
  </g>
</svg>`;

// Write SVG file
fs.writeFileSync(path.join(__dirname, 'favicon.svg'), svgFavicon);
console.log('✓ Created favicon.svg');

// Create a simple PNG version using canvas or jimp if available
try {
  const canvas = require('canvas');
  const canvasObj = canvas.createCanvas(256, 256);
  const ctx = canvasObj.getContext('2d');
  
  // Draw background
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, 256, 256);
  
  // Draw circle border
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw QR-style pattern
  ctx.fillStyle = '#06b6d4';
  
  // Top-left corner
  ctx.fillRect(30, 30, 40, 40);
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(35, 35, 30, 30);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(40, 40, 20, 20);
  
  // Top-right corner
  ctx.fillRect(186, 30, 40, 40);
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(191, 35, 30, 30);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(196, 40, 20, 20);
  
  // Bottom-left corner
  ctx.fillRect(30, 186, 40, 40);
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(35, 191, 30, 30);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(40, 196, 20, 20);
  
  // Center pattern
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(110, 115, 8, 28);
  ctx.fillRect(138, 115, 8, 28);
  ctx.fillRect(110, 143, 36, 8);
  
  // Save PNG
  const buffer = canvasObj.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, 'client', 'public', 'favicon.png'), buffer);
  console.log('✓ Created favicon.png with canvas');
} catch (e) {
  console.log('Canvas not available, trying jimp...');
  try {
    const Jimp = require('jimp');
    const image = new Jimp(256, 256, 0x0a1628ff);
    
    // This is simplified - full implementation would need more jimp calls
    image.write(path.join(__dirname, 'client', 'public', 'favicon.png'));
    console.log('✓ Created favicon.png with jimp');
  } catch (e2) {
    console.log('⚠ Could not create PNG - please use an online favicon generator');
    console.log('  Upload favicon.svg to https://convertio.co/svg-png/ or similar');
  }
}
