        'use strict';
        // Floating heart physics adapted from the supplied background.
        // Canvas Setup
        const canvas = document.getElementById('heartCanvas');
        const ctx = canvas.getContext('2d');

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        // Configuration State
        const config = {
            count: 80,
            repulsionRadius: 120,
            speed: 1.2,
            baseSize: 20,
            palette: 'romantic',
            darkMode: false, motion: !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        };

        // Color Palettes (Soft semi-transparent combinations like user image)
        const colorPalettes = {
            romantic: [
                'rgba(255, 105, 180, 0.65)', // Hot Pink
                'rgba(255, 182, 193, 0.75)', // Light Pink
                'rgba(244, 63, 94, 0.6)',    // Rose Red
                'rgba(251, 113, 133, 0.7)',  // Soft Crimson
                'rgba(253, 164, 175, 0.8)'   // Pastel Pink
            ],
            lavender: [
                'rgba(216, 180, 254, 0.7)', // Soft Violet
                'rgba(244, 114, 182, 0.65)', // Warm Pink
                'rgba(192, 132, 252, 0.6)',  // Purple
                'rgba(251, 207, 232, 0.8)',  // Light Pink
                'rgba(168, 85, 247, 0.55)'   // Deep Lavender
            ],
            vibrant: [
                'rgba(225, 29, 72, 0.8)',   // Rich Red
                'rgba(244, 63, 94, 0.75)',   // Rose
                'rgba(236, 72, 153, 0.75)',  // Deep Pink
                'rgba(255, 0, 128, 0.7)',    // Neon Pink
                'rgba(255, 150, 180, 0.85)'  // High-Contrast Light
            ]
        };

        // Track Mouse Position
        const mouse = {
            x: -1000,
            y: -1000,
            active: false
        };

        // Update canvas sizing dynamically
        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            initHearts();
        });

        // Track mouse movement
        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            mouse.active = true;
        });

        // Mobile touch support
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                mouse.x = e.touches[0].clientX;
                mouse.y = e.touches[0].clientY;
                mouse.active = true;
            }
        }, { passive: true });

        window.addEventListener('mouseleave', () => {
            mouse.active = false;
        });

        window.addEventListener('touchend', () => {
            mouse.active = false;
        });

        // Heart Particle Class
        class Heart {
            constructor() {
                this.reset(true);
            }

            reset(initial = false) {
                this.size = (Math.random() * 0.6 + 0.7) * config.baseSize;
                
                // Position
                this.x = Math.random() * width;
                this.y = initial ? Math.random() * height : -this.size - Math.random() * 50;
                
                // Base Floating Velocity
                this.vx = (Math.random() - 0.5) * 0.6;
                this.vy = (Math.random() * 0.6 + 0.4) * config.speed;
                
                // Extra Repulsion Displacement Velocities
                this.fx = 0;
                this.fy = 0;
                
                // Rotation & Wobble
                this.rotation = (Math.random() - 0.5) * 0.4;
                this.wobbleSpeed = Math.random() * 0.03 + 0.01;
                this.wobbleAmp = Math.random() * 0.8 + 0.2;
                this.step = Math.random() * 100;
                
                // Color selection
                const colors = colorPalettes[config.palette];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                // Swaying motion calculation
                this.step += this.wobbleSpeed;
                const sway = Math.sin(this.step) * this.wobbleAmp;

                // Mouse Repulsion Physics
                if (mouse.active && this !== gameHeart) {
                    const dx = this.x - mouse.x;
                    const dy = this.y - mouse.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = config.repulsionRadius;

                    if (dist < minDist && dist > 0) {
                        // Calculate force strength (stronger when closer)
                        const force = (1 - dist / minDist) * 8;
                        const angle = Math.atan2(dy, dx);
                        
                        // Push velocity outwards
                        this.fx += Math.cos(angle) * force;
                        this.fy += Math.sin(angle) * force;
                    }
                }

                // Apply velocity & friction/damping
                this.x += this.vx + sway + this.fx;
                this.y += this.vy + this.fy;

                // Damping for push force (smooth deceleration)
                this.fx *= 0.88;
                this.fy *= 0.88;

                // Respawn when off screen bottom or sides
                if (this.y > height + this.size + 20) {
                    this.reset(false);
                }
                if (this.x < -50) this.x = width + 40;
                if (this.x > width + 50) this.x = -40;
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation + Math.sin(this.step) * 0.1);
                
                ctx.fillStyle = this.color;
                ctx.beginPath();
                
                // Drawing smooth standard vector heart path
                const s = this.size / 15;
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(-10 * s, -10 * s, -18 * s, 5 * s, 0, 15 * s);
                ctx.bezierCurveTo(18 * s, 5 * s, 10 * s, -10 * s, 0, 0);
                
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        // Particle System Array
        let hearts = [];
        let gameHeart = null;

        function initHearts() {
            hearts = [];
            for (let i = 0; i < config.count; i++) {
                hearts.push(new Heart());
            }
            if (gameHeart) placeGameHeart();
            drawFrame();
        }

const defaults = { ...config };
const storageKey = 'mysite-hearts-v1';
const ranges = {
    repulsionRange: ['repulsionRadius', 30, 300, 'repulsionVal', ''],
    countRange: ['count', 0, 250, 'countVal', ''],
    speedRange: ['speed', 0.2, 4, 'speedVal', ''],
    sizeRange: ['baseSize', 8, 45, 'sizeVal', SiteText.get('настройки.единица_размера')]
};
try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved === 'object') {
        for (const [key, min, max] of Object.values(ranges)) {
            if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) {
                config[key] = Math.max(min, Math.min(max, key === 'speed' ? Math.round(saved[key] * 10) / 10 : Math.round(saved[key])));
            }
        }
        if (Object.hasOwn(colorPalettes, saved.palette)) config.palette = saved.palette;
        for (const key of ['darkMode', 'motion']) if (typeof saved[key] === 'boolean') config[key] = saved[key];
    }
} catch { /* Settings also work when browser storage is unavailable. */ }

const panel = document.getElementById('controlsPanel');
const gear = document.getElementById('toggleControlsBtn');
function setPanel(open, focusGear = false) {
    panel.hidden = !open;
    gear.setAttribute('aria-expanded', String(open));
    if (open) document.getElementById('closeBtn').focus();
    else if (focusGear) gear.focus();
}
gear.addEventListener('click', () => setPanel(panel.hidden));
document.getElementById('closeBtn').addEventListener('click', () => setPanel(false, true));
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) setPanel(false, true);
});
document.addEventListener('pointerdown', e => {
    if (!panel.hidden && !panel.contains(e.target) && !gear.contains(e.target)) setPanel(false);
});
document.documentElement.addEventListener('pointerleave', () => { mouse.active = false; });
window.addEventListener('blur', () => { mouse.active = false; });
window.addEventListener('pointermove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.active = !panel.contains(e.target) && !gear.contains(e.target);
});

function syncUI() {
    for (const [id, [key, , , output, suffix]] of Object.entries(ranges)) {
        document.getElementById(id).value = config[key];
        document.getElementById(output).textContent = config[key] + suffix;
    }
    document.body.classList.toggle('dark', config.darkMode);
    document.getElementById('darkMode').checked = config.darkMode;
    document.getElementById('motion').checked = config.motion;
    document.querySelectorAll('.palette-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.palette === config.palette)));
}
function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(config)); }
    catch { document.getElementById('saveHint').textContent = SiteText.get('настройки.не_сохраняется'); }
}
for (const [id, [key]] of Object.entries(ranges)) {
    document.getElementById(id).addEventListener('input', e => {
        config[key] = Number(e.target.value);
        if (key === 'count') initHearts();
        if (key === 'speed') hearts.forEach(h => { h.vy = (Math.random() * 0.6 + 0.4) * config.speed; });
        if (key === 'baseSize') hearts.forEach(h => { h.size = (Math.random() * 0.6 + 0.7) * config.baseSize; });
        syncUI(); drawFrame(); save();
    });
}
document.querySelectorAll('.palette-btn').forEach(b => b.addEventListener('click', () => {
    config.palette = b.dataset.palette;
    const colors = colorPalettes[config.palette];
    hearts.forEach(h => { h.color = colors[Math.floor(Math.random() * colors.length)]; });
    syncUI(); drawFrame(); save();
}));
for (const key of ['darkMode', 'motion']) document.getElementById(key).addEventListener('change', e => {
    config[key] = e.target.checked;
    syncUI(); save();
});
document.getElementById('resetBtn').addEventListener('click', () => {
    Object.assign(config, defaults);
    initHearts(); syncUI(); save();
});
function drawFrame() {
    ctx.clearRect(0, 0, width, height);
    hearts.forEach(h => h.draw());
    if (gameHeart) {
        if (!hearts.includes(gameHeart)) gameHeart.draw();
        // A light outline distinguishes one actual background particle.
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(gameHeart.x, gameHeart.y + gameHeart.size * .35, gameHeart.size * .9, gameHeart.size, 0, 0, Math.PI * 2);
        ctx.strokeStyle = config.darkMode ? 'rgba(255,220,236,.65)' : 'rgba(135,53,91,.45)';
        ctx.lineWidth = 1;
        ctx.stroke(); ctx.restore();
        const target = document.getElementById('catchHeart');
        target.style.left = gameHeart.x + 'px';
        target.style.top = (gameHeart.y + gameHeart.size * .35) + 'px';
    }
}
// Cap updates to 60 Hz so high-refresh monitors do not accelerate the effect.
let previous = 0;
function animate(time) {
    if (config.motion && !document.hidden && time - previous >= 1000 / 60) {
        hearts.forEach(h => h.update());
        if (gameHeart) {
            if (!hearts.includes(gameHeart)) gameHeart.update();
            const bounds = gameBounds();
            if (gameHeart.y < bounds.top || gameHeart.y > bounds.bottom || gameHeart.x < bounds.left || gameHeart.x > bounds.right) placeGameHeart();
        }
        drawFrame();
        previous = time;
    }
    requestAnimationFrame(animate);
}
syncUI();
initHearts();
requestAnimationFrame(animate);

function gameBounds() {
    const hud = document.getElementById('gameHud').getBoundingClientRect();
    const bottom = Math.max(36, height - 64);
    return { left:36, right:Math.max(36,width - 36), top:Math.min(bottom, Math.max(100,hud.bottom + 40)), bottom };
}
function placeGameHeart() {
    const bounds = gameBounds();
    gameHeart.x = bounds.left + Math.random() * Math.max(1,bounds.right - bounds.left);
    gameHeart.y = bounds.top + Math.random() * Math.max(1,bounds.bottom - bounds.top);
    gameHeart.size = Math.max(18, Math.min(28, config.baseSize));
    gameHeart.fx = 0; gameHeart.fy = 0;
}
window.heartGame = {
    next() {
        gameHeart = hearts.length ? hearts[Math.floor(Math.random() * hearts.length)] : new Heart();
        placeGameHeart(); drawFrame();
    },
    stop() { gameHeart = null; drawFrame(); }
};

