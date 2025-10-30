const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width,
    H = canvas.height;

function resize() {
    const ratio = window.devicePixelRatio || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    canvas.width = Math.floor(vw * ratio);
    canvas.height = Math.floor(vh * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    W = canvas.width / ratio;
    H = canvas.height / ratio;
}
window.addEventListener('resize', resize);
resize();

// neon stroke helper
function neonPath(drawFn, color, glow = 8) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    drawFn();
    ctx.restore();
}

// --- Audio: simple ambient + effects using WebAudio ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audio = new AudioCtx();
// ambient pad
const pad = audio.createOscillator();
const padGain = audio.createGain();
const padFilter = audio.createBiquadFilter();
pad.type = 'sine';
pad.frequency.setValueAtTime(80, audio.currentTime);
padGain.gain.value = 0.0009; // subtle
padFilter.type = 'lowpass';
padFilter.frequency.value = 800;
pad.connect(padFilter);
padFilter.connect(padGain);
padGain.connect(audio.destination);
pad.start();

// engine (thrust) noise-ish using oscillator+gain
const engineOsc = audio.createOscillator();
const engineGain = audio.createGain();
engineOsc.type = 'sawtooth';
engineOsc.frequency.value = 90;
engineGain.gain.value = 0;
engineOsc.connect(engineGain);
engineGain.connect(audio.destination);
engineOsc.start();

function shootBeep() {
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = 'square';
    o.frequency.value = 900;
    g.gain.value = 0.0009;
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.07);
}

function explodeSound() {
    const o1 = audio.createOscillator();
    const o2 = audio.createOscillator();
    const g = audio.createGain();
    g.gain.value = 0.002;
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.value = 200;
    o2.frequency.value = 140;
    o1.connect(g);
    o2.connect(g);
    g.connect(audio.destination);
    o1.start();
    o2.start();
    setTimeout(() => { o1.stop();
        o2.stop() }, 120);
}

// resume audio on user gesture
function tryResumeAudio() { if (audio.state === 'suspended') { audio.resume(); } }
window.addEventListener('pointerdown', tryResumeAudio, { once: true });
window.addEventListener('keydown', tryResumeAudio, { once: true });

// --- Game state ---
let keys = {};
let score = 0,
    lives = 3,
    level = 1;
let ship, asteroids = [],
    bullets = [],
    particles = [];
let paused = false;

function rand(min, max) { return Math.random() * (max - min) + min }

// --- Entities ---
function createShip() {
    return {
        x: W / 2,
        y: H / 2,
        r: 14,
        angle: -Math.PI / 2,
        vel: { x: 0, y: 0 },
        thrust: 0,
        invuln: 120
    }
}

function createAsteroid(x, y, size) {
    const s = size || (Math.random() > 0.6 ? 60 : (Math.random() > 0.5 ? 38 : 22));
    return { x: x || rand(0, W), y: y || rand(0, H), r: s, angle: rand(0, Math.PI * 2), vel: { x: rand(-1.2, 1.2), y: rand(-1.2, 1.2) }, verts: Math.floor(rand(6, 10)), offset: [] };
}

function resetLevel() {
    asteroids = [];
    bullets = [];
    particles = [];
    const count = 3 + level;
    for (let i = 0; i < count; i++) {
        let a = createAsteroid();
        // ensure not spawning too close to ship
        if (Math.hypot(a.x - ship.x, a.y - ship.y) < 120) { a.x += 150;
            a.y += 150; }
        asteroids.push(a);
    }
}

function init() { ship = createShip();
    score = 0;
    lives = 3;
    level = 1;
    resetLevel(); }
init();

// --- collisions & helpers ---
function wrap(obj) { if (obj.x < -obj.r) obj.x = W + obj.r; if (obj.x > W + obj.r) obj.x = -obj.r; if (obj.y < -obj.r) obj.y = H + obj.r; if (obj.y > H + obj.r) obj.y = -obj.r; }

function splitAsteroid(a) {
    explodeSound();
    score += Math.floor(100 * (60 / a.r));
    if (a.r > 28) {
        for (let i = 0; i < 2; i++) { const na = createAsteroid(a.x + rand(-6, 6), a.y + rand(-6, 6), a.r / 2.0);
            asteroids.push(na); }
    }
}

// --- input ---
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.code === 'Space') e.preventDefault(); if (e.key.toLowerCase() === 'r') restart(); if (e.key.toLowerCase() === 'p') paused = !paused; });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// mobile controls
const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'flex';
    ['left', 'right', 'thrust', 'shoot'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', e => { e.preventDefault();
            keys[id] = true;
            tryResumeAudio(); });
        el.addEventListener('touchend', e => { e.preventDefault();
            keys[id] = false; });
        el.addEventListener('mousedown', e => { keys[id] = true; });
        el.addEventListener('mouseup', e => { keys[id] = false; });
    });
}

function restart() { init(); }

// --- game loop ---
let last = performance.now();

function update(dt) {
    if (paused) return;
    // input
    const left = keys['arrowleft'] || keys['a'] || keys['left'];
    const right = keys['arrowright'] || keys['d'] || keys['right'];
    const thrustKey = keys['w'] || keys['arrowup'] || keys['thrust'] || keys['up'];
    const shootKey = keys[' '] || keys['space'] || keys['shoot'];

    if (left) ship.angle -= 0.004 * dt;
    if (right) ship.angle += 0.004 * dt;
    if (thrustKey) { ship.thrust = Math.min(0.12, ship.thrust + 0.0015 * dt);
        engineGain.gain.value = 0.0012 * Math.min(1, ship.thrust * 6); } else { ship.thrust = Math.max(0, ship.thrust - 0.002 * dt);
        engineGain.gain.value = Math.max(0, 0.0012 * ship.thrust * 6); }
    engineOsc.frequency.value = 70 + ship.thrust * 260;

    // shoot
    if (shootKey && (!ship.lastShot || performance.now() - ship.lastShot > 200)) {
        ship.lastShot = performance.now();
        const bSpeed = 6;
        bullets.push({ x: ship.x + Math.cos(ship.angle) * ship.r, y: ship.y + Math.sin(ship.angle) * ship.r, vx: Math.cos(ship.angle) * bSpeed + ship.vel.x, vy: Math.sin(ship.angle) * bSpeed + ship.vel.y, life: 120 });
        shootBeep();
    }

    // move ship
    ship.vel.x += Math.cos(ship.angle) * ship.thrust * 0.02 * dt;
    ship.vel.y += Math.sin(ship.angle) * ship.thrust * 0.02 * dt;
    ship.x += ship.vel.x;
    ship.y += ship.vel.y;
    ship.vel.x *= 0.998;
    ship.vel.y *= 0.998;
    wrap(ship);
    if (ship.invuln > 0) ship.invuln--;

    // bullets
    bullets.forEach(b => { b.x += b.vx;
        b.y += b.vy;
        b.life--;
        wrap(b); });
    bullets = bullets.filter(b => b.life > 0);

    // asteroids
    asteroids.forEach(a => { a.x += a.vel.x;
        a.y += a.vel.y;
        wrap(a); });

    // collisions bullets-asteroids
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const b = bullets[i],
                a = asteroids[j];
            if (Math.hypot(b.x - a.x, b.y - a.y) < a.r) {
                bullets.splice(i, 1);
                const removed = asteroids.splice(j, 1)[0];
                splitAsteroid(removed); // particle
                for (let p = 0; p < 10; p++) particles.push({ x: removed.x, y: removed.y, vx: rand(-2, 2), vy: rand(-2, 2), life: 60 })
                break;
            }
        }
    }

    // collisions ship-asteroids
    if (ship.invuln <= 0) {
        for (let i = asteroids.length - 1; i >= 0; i--) {
            const a = asteroids[i];
            if (Math.hypot(ship.x - a.x, ship.y - a.y) < a.r + ship.r * 0.6) { // hit
                asteroids.splice(i, 1);
                explodeSound();
                lives--;
                ship = createShip();
                if (lives <= 0) { // game over -> reset
                    // show flash
                    particles.push({ x: W / 2, y: H / 2, vx: 0, vy: 0, life: 180 });
                    score = 0;
                    lives = 3;
                    level = 1;
                    resetLevel();
                }
                break;
            }
        }
    }

    // particles
    particles.forEach(p => { p.x += p.vx;
        p.y += p.vy;
        p.life--; });
    particles = particles.filter(p => p.life > 0);

    // level up if no asteroids
    if (asteroids.length === 0) { level++;
        resetLevel(); }

    // update hud
    document.getElementById('score').textContent = 'Puntuación: ' + score;
    document.getElementById('lives').textContent = 'Vidas: ' + lives;
    document.getElementById('level').textContent = 'Nivel: ' + level;
}

function draw() {
    // clear
    ctx.clearRect(0, 0, W, H);

    // stars background
    for (let i = 0; i < 60; i++) {
        const x = (i * 97) % W;
        const y = (i * 53) % H;
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(x, y, 1, 1);
    }

    // draw asteroids
    asteroids.forEach(a => {
        ctx.save();
        ctx.translate(a.x, a.y);
        neonPath(() => {
            ctx.beginPath();
            const pts = Math.max(6, Math.floor(a.r / 8) + 3);
            for (let i = 0; i < pts; i++) { const ang = (Math.PI * 2 / pts) * i; const rad = a.r * (0.75 + Math.random() * 0.5); const px = Math.cos(ang) * rad; const py = Math.sin(ang) * rad; if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py); }
            ctx.closePath();
            ctx.lineWidth = Math.max(2, a.r / 20);
            ctx.strokeStyle = 'rgba(139,92,255,0.95)';
            ctx.stroke();
        }, 'rgba(139,92,255,0.9)', 12);
        ctx.restore();
    });

    // ship
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    if (ship.invuln % 18 < 9) {
        neonPath(() => {
            ctx.beginPath();
            ctx.moveTo(ship.r, 0);
            ctx.lineTo(-ship.r * 0.6, ship.r * 0.8);
            ctx.lineTo(-ship.r * 0.6, -ship.r * 0.8);
            ctx.closePath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(110,240,255,0.95)';
            ctx.stroke();
        }, 'rgba(110,240,255,0.95)', 16);
    }
    // thrust flame
    if (ship.thrust > 0.001) {
        ctx.beginPath();
        ctx.moveTo(-ship.r * 0.6, -ship.r * 0.3);
        ctx.lineTo(-ship.r * 1.4, 0);
        ctx.lineTo(-ship.r * 0.6, ship.r * 0.3);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,110,199,0.08)';
        ctx.fill();
        neonPath(() => { ctx.beginPath();
            ctx.moveTo(-ship.r * 0.6, -ship.r * 0.28);
            ctx.lineTo(-ship.r * 1.2, 0);
            ctx.lineTo(-ship.r * 0.6, ship.r * 0.28);
            ctx.closePath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,110,199,0.9)';
            ctx.stroke(); }, 'rgba(255,110,199,0.9)', 18);
    }
    ctx.restore();

    // bullets
    bullets.forEach(b => {
        neonPath(() => { ctx.beginPath();
            ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(110,240,255,0.95)';
            ctx.fill(); }, 'rgba(110,240,255,0.95)', 8);
    });

    // particles
    particles.forEach(p => {
        const alpha = Math.max(0, p.life / 80);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(255,120,180,0.95)';
        ctx.fillRect(p.x, p.y, 2, 2);
        ctx.globalAlpha = 1;
    });

    // vignette and neon grid subtle
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fill();
    ctx.restore();
}

function loop(now) {
    const dt = Math.min(40, now - last);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// start ambient slowly ramp
setTimeout(() => { padGain.gain.linearRampToValueAtTime(0.0028, audio.currentTime + 2); }, 400);

// expose for debugging
window.game = { canvas, ctx };