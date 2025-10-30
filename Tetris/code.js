// Tetris implementation - single file
'use strict';

const COLS = 10; const ROWS = 20;
const BLOCK_SIZE = 30; // base pixel size, canvas will scale with CSS
const LINES_PER_LEVEL = 10;

// Tetromino shapes + color palette (neon)
const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
  O: [[1,1],[1,1]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]]
};
const COLORS = {
  I: '#8be9fd', J:'#bd93f9', L:'#ffb86c', O:'#f1fa8c', S:'#50fa7b', T:'#ff79c6', Z:'#8bd6ff'
};
const PIECES = Object.keys(SHAPES);

// Canvas & scaling
const boardCanvas = document.getElementById('board');
const nextCanvas = document.getElementById('next');
const ctx = boardCanvas.getContext('2d');
const nctx = nextCanvas.getContext('2d');

// Responsive scaling: compute scale to fit available width while keeping aspect
function resizeCanvas(){
  const containerWidth = boardCanvas.parentElement.clientWidth; // 320 default
  const scale = Math.min(1, containerWidth / (COLS * BLOCK_SIZE));
  boardCanvas.style.width = (COLS * BLOCK_SIZE * scale) + 'px';
  boardCanvas.style.height = (ROWS * BLOCK_SIZE * scale) + 'px';
  // maintain internal resolution for sharp drawing
  boardCanvas.width = COLS * BLOCK_SIZE; boardCanvas.height = ROWS * BLOCK_SIZE;
  nextCanvas.width = 4 * BLOCK_SIZE; nextCanvas.height = 4 * BLOCK_SIZE;
  draw();
}
window.addEventListener('resize', resizeCanvas);

// Game state
let grid, current, nextPiece, score=0, level=1, lines=0, dropInterval=800, dropCounter=0, lastTime=0, requestId=null, isPaused=false, isGameOver=false;
let audioEnabled=true, musicEnabled=true;

function createGrid(){
  const g = Array.from({length:ROWS}, ()=>Array(COLS).fill(0));
  return g;
}

function randomPiece(){
  const type = PIECES[Math.floor(Math.random()*PIECES.length)];
  return {type, shape:cloneMatrix(SHAPES[type]), x: Math.floor((COLS - SHAPES[type][0].length)/2), y: -1};
}

function cloneMatrix(m){ return m.map(r=>r.slice()); }

function rotate(matrix){
  const N = matrix.length; const res = Array.from({length:N},()=>Array(N).fill(0));
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) res[x][N-1-y] = matrix[y][x];
  return res;
}

function collide(grid, piece){
  const m = piece.shape;
  for(let y=0;y<m.length;y++){
    for(let x=0;x<m[y].length;x++){
      if(m[y][x]){
        const gx = piece.x + x; const gy = piece.y + y;
        if(gx<0 || gx>=COLS || gy>=ROWS) return true;
        if(gy>=0 && grid[gy][gx]) return true;
      }
    }
  }
  return false;
}

function merge(grid, piece){
  const m = piece.shape;
  for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++){
    if(m[y][x]){
      const gx = piece.x + x; const gy = piece.y + y;
      if(gy>=0 && gy<ROWS && gx>=0 && gx<COLS) grid[gy][gx] = piece.type;
    }
  }
}

function clearLines(){
  let cleared=0;
  outer: for(let y=ROWS-1;y>=0;y--){
    for(let x=0;x<COLS;x++) if(!grid[y][x]) continue outer;
    // full line
    grid.splice(y,1); grid.unshift(Array(COLS).fill(0));
    cleared++; y++; // re-check this row index because rows shifted
  }
  if(cleared>0){
    lines += cleared; score += (cleared*100) * level; playSound('clear');
    if(lines >= level * LINES_PER_LEVEL){ level++; dropInterval = Math.max(100, dropInterval - 80); }
  }
}

function spawn(){
  current = nextPiece || randomPiece();
  current.x = Math.floor((COLS - current.shape[0].length)/2); current.y = -1;
  nextPiece = randomPiece();
  if(collide(grid, current)){
    // Game over
    isGameOver = true; cancelAnimationFrame(requestId); playSound('gameover'); if(musicEnabled) stopMusic(); draw();
  }
}

function hardDrop(){
  while(!collide(grid, {...current, y:current.y+1})) current.y++;
  lockPiece(); playSound('drop');
}

function lockPiece(){
  merge(grid, current); clearLines(); spawn();
}

function move(dir){
  if(!current) return;
  current.x += dir;
  if(collide(grid, current)) current.x -= dir; else playSound('move');
}

function rotatePiece(){
  const before = current.shape; current.shape = rotate(current.shape);
  // wall kicks simple
  if(collide(grid, current)){
    current.x += 1; if(collide(grid,current)){ current.x -=2; if(collide(grid,current)){ current.x +=1; current.shape=before; return; }}
  }
  playSound('rotate');
}

function softDrop(){
  current.y++;
  if(collide(grid,current)){ current.y--; lockPiece(); }
}

function lockAndNextIfNeeded(){ if(!isGameOver) spawn(); }

// Draw
function draw(){
  // clear
  ctx.clearRect(0,0,boardCanvas.width,boardCanvas.height);
  // draw grid background as subtle lines
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  for(let x=0;x<=COLS;x++){ ctx.beginPath(); ctx.moveTo(x*BLOCK_SIZE,0); ctx.lineTo(x*BLOCK_SIZE,ROWS*BLOCK_SIZE); ctx.stroke(); }
  for(let y=0;y<=ROWS;y++){ ctx.beginPath(); ctx.moveTo(0,y*BLOCK_SIZE); ctx.lineTo(COLS*BLOCK_SIZE,y*BLOCK_SIZE); ctx.stroke(); }
  // draw placed blocks
  for(let y=0;y<ROWS;y++){
    for(let x=0;x<COLS;x++){
      const cell = grid[y][x];
      if(cell){ drawBlock(x,y,COLORS[cell]); }
    }
  }
  // draw current
  if(current){
    const m = current.shape; for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++) if(m[y][x]) drawBlock(current.x + x, current.y + y, COLORS[current.type], true);
  }
  // overlay game over
  if(isGameOver){ ctx.fillStyle='rgba(3,6,14,0.8)'; ctx.fillRect(0,0,boardCanvas.width,boardCanvas.height);
    ctx.fillStyle='white'; ctx.font='28px system-ui'; ctx.textAlign='center'; ctx.fillText('GAME OVER', boardCanvas.width/2, boardCanvas.height/2 - 10);
    ctx.font='14px system-ui'; ctx.fillText('Presiona R para reiniciar', boardCanvas.width/2, boardCanvas.height/2 + 18);
  }
}

function drawBlock(gx, gy, color, neon=false){
  if(gy<0) return; // above board
  const x = gx * BLOCK_SIZE; const y = gy * BLOCK_SIZE;
  // main rect
  ctx.fillStyle = color; ctx.fillRect(x+1,y+1,BLOCK_SIZE-2,BLOCK_SIZE-2);
  // inner sheen
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x+4,y+4,BLOCK_SIZE-8,(BLOCK_SIZE-8)/2);
  // neon stroke
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.strokeRect(x+0.5,y+0.5,BLOCK_SIZE-1,BLOCK_SIZE-1);
  // glow
  if(neon){ ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillRect(x+1,y+1,BLOCK_SIZE-2,BLOCK_SIZE-2); ctx.shadowBlur = 0; }
}

function drawNext(){
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  if(!nextPiece) return;
  const m = nextPiece.shape; const size = BLOCK_SIZE; const offsetX = Math.floor((4 - m[0].length)/2)*size; const offsetY = Math.floor((4 - m.length)/2)*size;
  for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++) if(m[y][x]){
    nctx.fillStyle = COLORS[nextPiece.type]; nctx.fillRect(offsetX + x*size + 2, offsetY + y*size + 2, size-4, size-4);
    nctx.fillStyle='rgba(255,255,255,0.12)'; nctx.fillRect(offsetX + x*size + 6, offsetY + y*size + 6, size-8, (size-8)/2);
  }
}

// Game loop
function update(time=0){
  if(!lastTime) lastTime = time; const delta = time - lastTime; lastTime = time;
  if(!isPaused && !isGameOver){ dropCounter += delta; if(dropCounter > dropInterval){ current.y++; if(collide(grid,current)){ current.y--; lockPiece(); } dropCounter = 0; } }
  draw(); drawNext();
  document.getElementById('score').textContent = score;
  document.getElementById('level').textContent = level;
  document.getElementById('lines').textContent = lines;
  if(!isGameOver) requestId = requestAnimationFrame(update);
}

// Controls
window.addEventListener('keydown', e=>{
  if(e.key === 'ArrowLeft'){ move(-1); draw(); }
  else if(e.key === 'ArrowRight'){ move(1); draw(); }
  else if(e.key === 'ArrowUp'){ rotatePiece(); draw(); }
  else if(e.key === 'ArrowDown'){ softDrop(); draw(); }
  else if(e.key === ' '){ e.preventDefault(); hardDrop(); draw(); }
  else if(e.key.toLowerCase() === 'r'){ if(isGameOver){ reset(); start(); } }
  else if(e.key.toLowerCase() === 'p'){ togglePause(); }
});

// Touch buttons
const leftTouch = document.getElementById('leftTouch'); const rightTouch = document.getElementById('rightTouch'); const rotateTouch = document.getElementById('rotateTouch'); const downTouch = document.getElementById('downTouch'); const dropTouch = document.getElementById('dropTouch');
leftTouch?.addEventListener('touchstart', e=>{ e.preventDefault(); move(-1); draw(); });
rightTouch?.addEventListener('touchstart', e=>{ e.preventDefault(); move(1); draw(); });
rotateTouch?.addEventListener('touchstart', e=>{ e.preventDefault(); rotatePiece(); draw(); });
downTouch?.addEventListener('touchstart', e=>{ e.preventDefault(); softDrop(); draw(); });
dropTouch?.addEventListener('touchstart', e=>{ e.preventDefault(); hardDrop(); draw(); });

// Buttons
document.getElementById('start').addEventListener('click', ()=>{ if(isGameOver){ reset(); } start(); });
document.getElementById('pause').addEventListener('click', togglePause);
document.getElementById('restart').addEventListener('click', ()=>{ reset(); start(); });
document.getElementById('sound').addEventListener('click', ()=>{ audioEnabled = !audioEnabled; document.getElementById('sound').textContent = audioEnabled ? '🔊 Sonido' : '🔈 Silencio'; });
document.getElementById('music').addEventListener('click', ()=>{ musicEnabled = !musicEnabled; if(musicEnabled) startMusic(); else stopMusic(); document.getElementById('music').textContent = musicEnabled ? '🎵 Tema' : '🎵 Off'; });

function togglePause(){ if(isGameOver) return; isPaused = !isPaused; document.getElementById('pause').textContent = isPaused ? 'Reanudar' : 'Pausar'; if(isPaused) cancelAnimationFrame(requestId); else requestId = requestAnimationFrame(update); }

// Reset
function reset(){ grid = createGrid(); score=0; level=1; lines=0; dropInterval=800; dropCounter=0; lastTime=0; isPaused=false; isGameOver=false; nextPiece = randomPiece(); spawn(); if(musicEnabled) startMusic(); }

function start(){ if(isGameOver) return; if(!grid) reset(); cancelAnimationFrame(requestId); requestId = requestAnimationFrame(update); }

// Audio: small fx via WebAudio + background Korobeiniki simple synth
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null; let musicInterval=null; let musicNow=0;
function ensureAudio(){ if(!audioCtx) audioCtx = new AudioCtx(); }

function playSound(type){ if(!audioEnabled) return; try{ ensureAudio(); const t = audioCtx.currentTime; if(type==='move'){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='sine'; o.frequency.value=600; g.gain.value=0.02; o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.05); }
  else if(type==='rotate'){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='triangle'; o.frequency.value=900; g.gain.value=0.03; o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.07); }
  else if(type==='clear'){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='sawtooth'; o.frequency.value=400; g.gain.value=0.06; o.connect(g); g.connect(audioCtx.destination); o.start(t); o.frequency.linearRampToValueAtTime(900,t+0.12); o.stop(t+0.14); }
  else if(type==='drop'){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='square'; o.frequency.value=200; g.gain.value=0.04; o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t+0.06); }
  else if(type==='gameover'){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='sine'; o.frequency.value=120; g.gain.value=0.1; o.connect(g); g.connect(audioCtx.destination); o.start(t); o.frequency.exponentialRampToValueAtTime(40,t+0.9); g.gain.exponentialRampToValueAtTime(0.0001,t+1.2); o.stop(t+1.2); }
} catch(e){ /* audio may be blocked until user gesture */ }}

// Simple Korobeiniki-ish melody (classic Tetris) - note frequencies
const MELODY = [
  ['E5',8], ['B4',8], ['C5',8], ['D5',8], ['C5',8], ['B4',8], ['A4',8], ['A4',8],
  ['C5',8], ['E5',8], ['D5',8], ['C5',8], ['B4',8], ['C5',8], ['D5',8], ['E5',8]
];
const NOTES = { 'A4':440,'B4':494,'C5':523,'D5':587,'E5':659,'F5':698,'G5':784 };
function startMusic(){ if(!musicEnabled) return; ensureAudio(); stopMusic(); musicNow=0; musicInterval = setInterval(()=>{ playNoteFromMelody(); }, 180); }
function stopMusic(){ if(musicInterval){ clearInterval(musicInterval); musicInterval=null; } }
function playNoteFromMelody(){ if(!audioEnabled) return; if(!musicEnabled) return; if(!audioCtx) return; const pair = MELODY[musicNow % MELODY.length]; const note = pair[0]; const dur = pair[1]; const freq = NOTES[note] || 440; const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='square'; o.frequency.value = freq; g.gain.value = 0.02; o.connect(g); g.connect(audioCtx.destination); const t = audioCtx.currentTime; o.start(t); g.gain.linearRampToValueAtTime(0.02,t+0.08); g.gain.exponentialRampToValueAtTime(0.0001,t+0.28); o.stop(t+0.3); musicNow++; }

// Initialize
resizeCanvas(); reset();

// user gesture to enable audio context on mobile
['touchstart','click'].forEach(evt=> document.addEventListener(evt, function initAudio(){ if(!audioCtx) try{ ensureAudio(); }catch(e){} document.removeEventListener(evt, initAudio); }, {passive:true}));
