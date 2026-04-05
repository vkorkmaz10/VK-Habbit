const sharp = require('sharp');
async function slice() {
  const w = Math.floor(2528 / 3);
  const h = Math.floor(1684 / 2);
  let idx = 0;
  for(let r=0; r<2; r++){
    for(let c=0; c<3; c++){
      await sharp('kas_grup_icons.png').extract({ left: c*w, top: r*h, width: w, height: h }).toFile(`public/muscle_${idx}.png`);
      idx++;
    }
  }
}
slice();
