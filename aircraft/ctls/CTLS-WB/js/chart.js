function drawChart(tow, arm_cg) {
 const c = document.getElementById('cgChart');
 const ctx = c.getContext('2d');
 const W = c.width, H = c.height;
 const ml = 38, mr = 10, mt = 10, mb = 28;
 const pw = W - ml - mr, ph = H - mt - mb;

 ctx.clearRect(0, 0, W, H);

 const xMin = 80, xMax = 300, yMin = 300, yMax = 625;
 const x = mm => ml + (mm - xMin) / (xMax - xMin) * pw;
 const y = kg => mt + (1 - (kg - yMin) / (yMax - yMin)) * ph;
 const mFwd = kg => CG_FWD * kg;
 const mAft = kg => CG_AFT * kg;

 ctx.strokeStyle = '#e5edf5'; ctx.lineWidth = 0.5;
 ctx.fillStyle = '#8a97a5'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
 for (let mm = 80; mm <= 300; mm += 20) {
  ctx.beginPath(); ctx.moveTo(x(mm), mt); ctx.lineTo(x(mm), H - mb); ctx.stroke();
  if (mm % 40 === 0) ctx.fillText(mm, x(mm), H - 18);
 }
 ctx.textAlign = 'right';
 for (let kg = 300; kg <= 625; kg += 25) {
  ctx.beginPath(); ctx.moveTo(ml, y(kg)); ctx.lineTo(W - mr, y(kg)); ctx.stroke();
  if (kg % 50 === 0 || kg === 625) ctx.fillText(kg, ml - 3, y(kg) + 3);
 }

 ctx.fillStyle = '#2b3a48'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
 ctx.fillText('Moment (kg·m)', W / 2, H - 6);
 ctx.save(); ctx.translate(8, mt + ph / 2); ctx.rotate(-Math.PI / 2);
 ctx.fillText('Mass (kg)', 0, 0); ctx.restore();

 const P = [
  [mFwd(MIN_MASS), MIN_MASS],
  [mFwd(MAX_MASS), MAX_MASS],
  [mAft(MAX_MASS), MAX_MASS],
  [mAft(MIN_MASS), MIN_MASS]
 ];
 ctx.beginPath();
 ctx.moveTo(x(P[0][0]), y(P[0][1]));
 for (let i = 1; i < P.length; i++) ctx.lineTo(x(P[i][0]), y(P[i][1]));
 ctx.closePath();
 ctx.fillStyle = 'rgba(35,120,4,0.12)'; ctx.fill();
 ctx.strokeStyle = '#237804'; ctx.lineWidth = 2; ctx.stroke();

 ctx.strokeStyle = '#fa8c16'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
 ctx.beginPath(); ctx.moveTo(ml, y(MAX_MASS)); ctx.lineTo(W - mr, y(MAX_MASS)); ctx.stroke();
 ctx.setLineDash([]);
 ctx.fillStyle = '#d46b08'; ctx.font = '8px sans-serif'; ctx.textAlign = 'left';
 ctx.fillText('MTOW ' + MAX_MASS + ' kg', ml + 3, y(MAX_MASS) - 3);

 if (tow > 0) {
  const curMoment = tow * arm_cg;
  const inEnv = arm_cg >= CG_FWD && arm_cg <= CG_AFT && tow <= MAX_MASS;
  ctx.beginPath();
  ctx.arc(x(curMoment), y(tow), 5, 0, Math.PI * 2);
  ctx.fillStyle = inEnv ? '#237804' : '#cf1322';
  ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#0d3b66'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left';
  const lx = curMoment > 250 ? x(curMoment) - 58 : x(curMoment) + 7;
  ctx.fillText(tow.toFixed(0) + 'kg · ' + curMoment.toFixed(0) + 'kg·m', lx, y(tow) - 7);
  ctx.textAlign = 'center';
 }
}