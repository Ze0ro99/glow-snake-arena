import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import cyberBanner from "@/assets/images/cyber_grid_banner.jpg.asset.json";
import snakeIcon from "@/assets/images/neon_snake_icon.jpg.asset.json";
import gameplay1 from "@/assets/images/snake_gameplay.jpg.asset.json";
import gameplay2 from "@/assets/images/snake_gameplay_2.jpg.asset.json";
import gameplay3 from "@/assets/images/snake_gameplay_3.jpg.asset.json";
import tournamentBanner from "@/assets/images/tournament_banner.jpg.asset.json";
import { PiAuth } from "@/components/PiAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Slither 4D — Cyberpunk Snake Arena" },
      { name: "description", content: "A premium neon cyberpunk snake.io style arena with parallax depth, AI snakes, and glow effects." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { property: "og:title", content: "Neon Slither 4D" },
      { property: "og:description", content: "Eat. Grow. Survive. Enter the neon realm." },
    ],
  }),
  component: NeonSlither,
});

type Vec = { x: number; y: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Food = { x: number; y: number; size: number; color: string; phase: number; value: number };

let WORLD = 4000;
const NEON_PALETTES = [
  ["#00f9ff", "#0066ff"],
  ["#ff00aa", "#ff0066"],
  ["#00ff9f", "#00cc66"],
  ["#ffaa00", "#ff5500"],
  ["#aa00ff", "#6600ff"],
  ["#ff3366", "#ff0033"],
  ["#33ff66", "#00ff33"],
  ["#ffee00", "#ffaa00"],
  ["#ff66ff", "#cc00ff"],
  ["#00ffff", "#00aaff"],
  ["#ff9900", "#ff3300"],
  ["#66ff00", "#33cc00"],
  ["#ff0099", "#cc0066"],
  ["#9900ff", "#6600cc"],
  ["#00ffcc", "#00ccaa"],
];

// Player skins (cosmetic). Free + unlockable.
type Skin = { id: string; name: string; palette: [string, string]; cost: number; tier: "common" | "rare" | "legendary" };
const SKINS: Skin[] = [
  { id: "cyan",      name: "Neon Cyan",     palette: ["#00f9ff", "#0066ff"], cost: 0,   tier: "common" },
  { id: "magenta",   name: "Magenta Pulse", palette: ["#ff00cc", "#ff0066"], cost: 0,   tier: "common" },
  { id: "lime",      name: "Acid Lime",     palette: ["#a3ff00", "#33aa00"], cost: 50,  tier: "rare" },
  { id: "sunset",    name: "Sunset Coral",  palette: ["#ff8a3d", "#ff2d55"], cost: 75,  tier: "rare" },
  { id: "violet",    name: "Void Violet",   palette: ["#b388ff", "#6200ea"], cost: 100, tier: "rare" },
  { id: "gold",      name: "Aurum Gold",    palette: ["#ffd700", "#ff8c00"], cost: 250, tier: "legendary" },
  { id: "ice",       name: "Glacier Ice",   palette: ["#a0f0ff", "#0099ff"], cost: 250, tier: "legendary" },
  { id: "rainbow",   name: "Prism Apex",    palette: ["#ff00ff", "#00ffff"], cost: 500, tier: "legendary" },
];

// Selectable maps. Each map tweaks world size, AI count and food density.
type MapDef = { id: string; name: string; world: number; aiCount: number; foodCount: number; bg: string; accent: string };
const MAPS: MapDef[] = [
  { id: "grid",   name: "Cyber Grid",      world: 4000, aiCount: 14, foodCount: 400, bg: "#06021a", accent: "#00f9ff" },
  { id: "arena",  name: "Tournament Arena", world: 3000, aiCount: 18, foodCount: 350, bg: "#1a0410", accent: "#ff00aa" },
  { id: "void",   name: "Endless Void",    world: 6000, aiCount: 22, foodCount: 600, bg: "#000010", accent: "#aa00ff" },
];

// Movement settings (tunable by player).
type MoveSettings = { baseSpeed: number; boostMultiplier: number; turnRate: number };
const DEFAULT_SETTINGS: MoveSettings = { baseSpeed: 2.8, boostMultiplier: 2.8, turnRate: 0.12 };

class Snake {
  segments: Vec[] = [];
  targetAngle = 0;
  angle = 0;
  speed = 2.2;
  baseSpeed = 2.2;
  length = 20;
  radius = 9;
  color: string;
  glow: string;
  isPlayer: boolean;
  alive = true;
  boost = false;
  boostMult = 1.9;
  turnRate = 0.12;
  aiTimer = 0;
  aiTarget: Vec | null = null;
  aggression: number;
  hue: number;

  constructor(x: number, y: number, palette: string[], isPlayer = false, length = 20) {
    this.color = palette[0];
    this.glow = palette[1];
    this.isPlayer = isPlayer;
    this.length = length;
    this.radius = isPlayer ? 10 : 8 + Math.random() * 4;
    this.hue = Math.random() * 360;
    this.aggression = Math.random();
    const a = Math.random() * Math.PI * 2;
    this.angle = a;
    this.targetAngle = a;
    for (let i = 0; i < length; i++) {
      this.segments.push({ x: x - Math.cos(a) * i * this.radius * 0.55, y: y - Math.sin(a) * i * this.radius * 0.55 });
    }
  }

  head() {
    return this.segments[0];
  }

  steerTo(tx: number, ty: number) {
    const h = this.head();
    this.targetAngle = Math.atan2(ty - h.y, tx - h.x);
  }

  update(dt: number) {
    // smooth angle
    let diff = this.targetAngle - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.min(Math.abs(diff), this.turnRate) * Math.sign(diff);
    this.angle += turn;

    const sp = (this.boost ? this.baseSpeed * this.boostMult : this.baseSpeed) * dt * 60;
    const h = this.head();
    const nx = h.x + Math.cos(this.angle) * sp;
    const ny = h.y + Math.sin(this.angle) * sp;

    // wall bounce by killing nothing - clamp inside world
    const margin = 50;
    let hit = false;
    let cx = nx, cy = ny;
    if (cx < margin) { cx = margin; hit = true; }
    if (cy < margin) { cy = margin; hit = true; }
    if (cx > WORLD - margin) { cx = WORLD - margin; hit = true; }
    if (cy > WORLD - margin) { cy = WORLD - margin; hit = true; }
    if (hit && !this.isPlayer) {
      this.targetAngle = Math.atan2(WORLD/2 - cy, WORLD/2 - cx);
    }

    this.segments.unshift({ x: cx, y: cy });
    const targetLen = Math.floor(this.length);
    while (this.segments.length > targetLen) this.segments.pop();
  }
}

function NeonSlither() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<{
    player: Snake | null;
    ais: Snake[];
    foods: Food[];
    particles: Particle[];
    stars: { x: number; y: number; z: number; c: string }[];
    pointer: Vec;
    boost: boolean;
    running: boolean;
    paused: boolean;
    cam: Vec;
    shake: number;
    last: number;
    audio: AudioContext | null;
  }>({
    player: null, ais: [], foods: [], particles: [], stars: [],
    pointer: { x: 0, y: 0 }, boost: false, running: false, paused: false,
    cam: { x: WORLD/2, y: WORLD/2 }, shake: 0, last: 0, audio: null,
  });

  const [screen, setScreen] = useState<"start" | "playing" | "over">("start");
  const [score, setScore] = useState(20);
  const [best, setBest] = useState(0);
  const [paused, setPaused] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ score: number; date: number; name: string }[]>([]);
  const [playerName, setPlayerName] = useState<string>("PLAYER");
  const [precisionMode, setPrecisionMode] = useState(false);
  const [settings, setSettings] = useState<MoveSettings>(DEFAULT_SETTINGS);
  const [selectedSkin, setSelectedSkin] = useState<string>("cyan");
  const [ownedSkins, setOwnedSkins] = useState<string[]>(["cyan", "magenta"]);
  const [coins, setCoins] = useState<number>(0);
  const [selectedMap, setSelectedMap] = useState<string>("grid");
  const [panel, setPanel] = useState<"none" | "settings" | "skins" | "maps">("none");

  useEffect(() => {
    const stored = parseInt(localStorage.getItem("neonSlither4DBest") || "0");
    setBest(stored);
    try {
      const lb = JSON.parse(localStorage.getItem("neonSlither4DLeaderboard") || "[]");
      if (Array.isArray(lb)) setLeaderboard(lb);
    } catch {}
    const n = localStorage.getItem("neonSlither4DName");
    if (n) setPlayerName(n);
    try {
      const st = JSON.parse(localStorage.getItem("neonSlither4DSettings") || "null");
      if (st && typeof st === "object") setSettings({ ...DEFAULT_SETTINGS, ...st });
    } catch {}
    const sk = localStorage.getItem("neonSlither4DSkin");
    if (sk) setSelectedSkin(sk);
    try {
      const ow = JSON.parse(localStorage.getItem("neonSlither4DOwned") || "null");
      if (Array.isArray(ow)) setOwnedSkins(Array.from(new Set([...ow, "cyan", "magenta"])));
    } catch {}
    const c = parseInt(localStorage.getItem("neonSlither4DCoins") || "0");
    if (!isNaN(c)) setCoins(c);
    const mp = localStorage.getItem("neonSlither4DMap");
    if (mp) setSelectedMap(mp);
  }, []);

  // Persist settings/skin/map
  useEffect(() => { localStorage.setItem("neonSlither4DSettings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem("neonSlither4DSkin", selectedSkin); }, [selectedSkin]);
  useEffect(() => { localStorage.setItem("neonSlither4DOwned", JSON.stringify(ownedSkins)); }, [ownedSkins]);
  useEffect(() => { localStorage.setItem("neonSlither4DCoins", String(coins)); }, [coins]);
  useEffect(() => { localStorage.setItem("neonSlither4DMap", selectedMap); }, [selectedMap]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const playSound = (type: "eat" | "boost" | "death") => {
    const s = stateRef.current;
    try {
      if (!s.audio) s.audio = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = s.audio;
      const t = ctx.currentTime;
      if (type === "eat") {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(1760, t + 0.08);
        g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.13);
      } else if (type === "boost") {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.2);
        g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.22);
      } else {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
        g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.55);
      }
    } catch {}
  };

  const spawnFood = (x?: number, y?: number, color?: string, value = 1) => {
    const palette = NEON_PALETTES[Math.floor(Math.random() * NEON_PALETTES.length)];
    stateRef.current.foods.push({
      x: x ?? Math.random() * WORLD,
      y: y ?? Math.random() * WORLD,
      size: 4 + Math.random() * 3 + value,
      color: color ?? palette[0],
      phase: Math.random() * Math.PI * 2,
      value,
    });
  };

  const spawnAI = () => {
    const palette = NEON_PALETTES[1 + Math.floor(Math.random() * (NEON_PALETTES.length - 1))];
    const ang = Math.random() * Math.PI * 2;
    const r = 400 + Math.random() * (WORLD / 2 - 500);
    const x = WORLD/2 + Math.cos(ang) * r;
    const y = WORLD/2 + Math.sin(ang) * r;
    const s = new Snake(x, y, palette, false, 15 + Math.floor(Math.random() * 20));
    s.baseSpeed = 1.8 + Math.random() * 0.8;
    stateRef.current.ais.push(s);
  };

  const explode = (x: number, y: number, color: string, count = 30) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 5;
      stateRef.current.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0, max: 40 + Math.random() * 30, color, size: 2 + Math.random() * 3,
      });
    }
  };

  const startGame = () => {
    const s = stateRef.current;
    const map = MAPS.find(m => m.id === selectedMap) || MAPS[0];
    WORLD = map.world;
    const skin = SKINS.find(sk => sk.id === selectedSkin) || SKINS[0];
    s.player = new Snake(WORLD/2, WORLD/2, skin.palette, true, 20);
    s.player.baseSpeed = settings.baseSpeed;
    s.player.boostMult = settings.boostMultiplier;
    s.player.turnRate = settings.turnRate;
    s.ais = [];
    for (let i = 0; i < map.aiCount; i++) spawnAI();
    s.foods = [];
    for (let i = 0; i < map.foodCount; i++) spawnFood();
    s.particles = [];
    s.stars = [];
    for (let i = 0; i < 240; i++) {
      s.stars.push({
        x: Math.random() * WORLD, y: Math.random() * WORLD,
        z: 0.2 + Math.random() * 0.8,
        c: NEON_PALETTES[Math.floor(Math.random()*NEON_PALETTES.length)][0],
      });
    }
    s.cam = { x: WORLD/2, y: WORLD/2 };
    s.shake = 0;
    s.running = true;
    s.paused = false;
    s.last = performance.now();
    setScore(20);
    setNewBest(false);
    setPaused(false);
    setScreen("playing");
  };

  const endGame = () => {
    const s = stateRef.current;
    if (!s.player) return;
    s.running = false;
    explode(s.player.head().x, s.player.head().y, s.player.color, 80);
    playSound("death");
    s.shake = 30;
    const finalLen = Math.floor(s.player.length);
    setScore(finalLen);
    // Reward credits: 1 credit per 4 length earned
    const earned = Math.max(0, Math.floor((finalLen - 20) / 4));
    if (earned > 0) setCoins(c => c + earned);
    if (finalLen > best) {
      setBest(finalLen);
      localStorage.setItem("neonSlither4DBest", String(finalLen));
      setNewBest(true);
    }
    // Update leaderboard (top 10)
    try {
      const name = (playerName || "PLAYER").slice(0, 12).toUpperCase();
      const next = [...leaderboard, { score: finalLen, date: Date.now(), name }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      setLeaderboard(next);
      localStorage.setItem("neonSlither4DLeaderboard", JSON.stringify(next));
    } catch {}
    setTimeout(() => setScreen("over"), 800);
  };

  // Input
  useEffect(() => {
    const canvas = canvasRef.current!;
    const onMove = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect();
      stateRef.current.pointer.x = cx - rect.left;
      stateRef.current.pointer.y = cy - rect.top;
    };
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const md = () => { stateRef.current.boost = true; if (stateRef.current.running) playSound("boost"); };
    const mu = () => { stateRef.current.boost = false; };

    // Touch state: first finger = instant boost + coarse steer.
    // Second finger = precision joystick (relative offset from its anchor),
    // giving fine-grained heading control while the first finger keeps boost on.
    let precisionId: number | null = null;
    let precisionAnchor: { x: number; y: number } | null = null;
    let primaryId: number | null = null;

    const ts = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (primaryId === null) {
          primaryId = t.identifier;
          // First touch: activate boost immediately and steer toward touch point
          onMove(t.clientX, t.clientY);
          stateRef.current.boost = true;
          if (stateRef.current.running) playSound("boost");
        } else if (precisionId === null) {
          // Second touch: lock precision anchor at this finger's position
          precisionId = t.identifier;
          precisionAnchor = { x: t.clientX - rect.left, y: t.clientY - rect.top };
          setPrecisionMode(true);
        }
      }
    };
    const tm = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.identifier === precisionId && precisionAnchor && stateRef.current.player) {
          // Precision steering: small offsets from anchor map to heading,
          // amplified around the player head for sub-pixel-accurate aiming.
          const dx = (t.clientX - rect.left) - precisionAnchor.x;
          const dy = (t.clientY - rect.top) - precisionAnchor.y;
          if (dx * dx + dy * dy > 4) {
            const w = window.innerWidth, h = window.innerHeight;
            // Project a target far in the heading direction, centered on screen
            const len = Math.hypot(dx, dy) || 1;
            stateRef.current.pointer.x = w / 2 + (dx / len) * 400;
            stateRef.current.pointer.y = h / 2 + (dy / len) * 400;
          }
        } else if (t.identifier === primaryId && precisionId === null) {
          // Single finger drag still steers coarsely
          onMove(t.clientX, t.clientY);
        }
      }
    };
    const te = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === precisionId) {
          precisionId = null;
          precisionAnchor = null;
          setPrecisionMode(false);
        }
        if (t.identifier === primaryId) {
          primaryId = null;
          stateRef.current.boost = false;
        }
      }
      // If primary lifted but precision still down, promote precision to primary boost
      if (primaryId === null && precisionId !== null) {
        stateRef.current.boost = true;
      }
    };

    window.addEventListener("mousemove", mm);
    window.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    canvas.addEventListener("touchmove", tm, { passive: false });
    canvas.addEventListener("touchstart", ts, { passive: false });
    canvas.addEventListener("touchend", te, { passive: false });
    canvas.addEventListener("touchcancel", te, { passive: false });
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
      canvas.removeEventListener("touchmove", tm);
      canvas.removeEventListener("touchstart", ts);
      canvas.removeEventListener("touchend", te);
      canvas.removeEventListener("touchcancel", te);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let raf = 0;

    const tick = (now: number) => {
      const s = stateRef.current;
      const w = window.innerWidth, h = window.innerHeight;
      const dtRaw = (now - s.last) / 1000;
      const dt = Math.min(dtRaw, 0.05);
      s.last = now;

      // background
      const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h));
      grad.addColorStop(0, "#0a0420");
      grad.addColorStop(0.5, "#06021a");
      grad.addColorStop(1, "#000010");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      if (s.player && s.running && !s.paused) {
        // steer player
        const dx = s.pointer.x - w/2;
        const dy = s.pointer.y - h/2;
        s.player.targetAngle = Math.atan2(dy, dx);
        s.player.boost = s.boost && s.player.length > 12;
        if (s.player.boost) {
          s.player.length = Math.max(8, s.player.length - dt * 4);
          // drop trail food occasionally
          if (Math.random() < 0.3) {
            const tail = s.player.segments[s.player.segments.length - 1];
            spawnFood(tail.x + (Math.random()-0.5)*10, tail.y + (Math.random()-0.5)*10, s.player.color, 0.5);
          }
        }
        s.player.update(dt);

        // AI logic
        for (const ai of s.ais) {
          ai.aiTimer -= dt;
          if (ai.aiTimer <= 0 || !ai.aiTarget) {
            ai.aiTimer = 0.5 + Math.random() * 1.5;
            // find nearest food or target player if aggressive
            const h2 = ai.head();
            let best: Vec | null = null;
            let bd = Infinity;
            const range = 600;
            for (const f of s.foods) {
              const d = (f.x - h2.x) ** 2 + (f.y - h2.y) ** 2;
              if (d < bd && d < range * range) { bd = d; best = f; }
            }
            if (ai.aggression > 0.7 && s.player) {
              const ph = s.player.head();
              const pd = (ph.x - h2.x) ** 2 + (ph.y - h2.y) ** 2;
              if (pd < 300 * 300) {
                // aim ahead of player
                best = { x: ph.x + Math.cos(s.player.angle) * 60, y: ph.y + Math.sin(s.player.angle) * 60 };
              }
            }
            ai.aiTarget = best || { x: Math.random() * WORLD, y: Math.random() * WORLD };
          }
          ai.steerTo(ai.aiTarget.x, ai.aiTarget.y);
          ai.update(dt);
        }

        // collisions: player head vs AI bodies
        const ph = s.player.head();
        for (const ai of s.ais) {
          for (let i = 2; i < ai.segments.length; i++) {
            const seg = ai.segments[i];
            const r = ai.radius + s.player.radius * 0.6;
            if ((seg.x - ph.x) ** 2 + (seg.y - ph.y) ** 2 < r * r) {
              endGame();
              break;
            }
          }
          if (!s.running) break;
        }

        // AI head vs player body -> AI dies
        if (s.running) {
          for (let ai of s.ais) {
            const ah = ai.head();
            for (let i = 2; i < s.player.segments.length; i++) {
              const seg = s.player.segments[i];
              const r = s.player.radius + ai.radius * 0.6;
              if ((seg.x - ah.x) ** 2 + (seg.y - ah.y) ** 2 < r * r) {
                ai.alive = false;
                break;
              }
            }
            // AI vs AI
            if (ai.alive) {
              for (const other of s.ais) {
                if (other === ai || !other.alive) continue;
                for (let i = 2; i < other.segments.length; i += 2) {
                  const seg = other.segments[i];
                  const r = other.radius + ai.radius * 0.6;
                  if ((seg.x - ah.x) ** 2 + (seg.y - ah.y) ** 2 < r * r) {
                    ai.alive = false; break;
                  }
                }
                if (!ai.alive) break;
              }
            }
          }
        }

        // dead AIs drop food and respawn
        s.ais = s.ais.filter(ai => {
          if (!ai.alive) {
            for (let i = 0; i < ai.segments.length; i += 2) {
              spawnFood(ai.segments[i].x + (Math.random()-0.5)*20, ai.segments[i].y + (Math.random()-0.5)*20, ai.color, 1.5);
            }
            explode(ai.head().x, ai.head().y, ai.color, 25);
            setTimeout(() => { if (stateRef.current.running) spawnAI(); }, 1500);
            return false;
          }
          return true;
        });

        // food collisions player
        for (let i = s.foods.length - 1; i >= 0; i--) {
          const f = s.foods[i];
          const d2 = (f.x - ph.x) ** 2 + (f.y - ph.y) ** 2;
          const r = s.player.radius + f.size + 8;
          if (d2 < r * r) {
            s.player.length += f.value;
            s.foods.splice(i, 1);
            explode(f.x, f.y, f.color, 6);
            playSound("eat");
            setScore(Math.floor(s.player.length));
            if (s.foods.length < 400) spawnFood();
          }
        }

        // AI food collisions
        for (const ai of s.ais) {
          const ah = ai.head();
          for (let i = s.foods.length - 1; i >= 0; i--) {
            const f = s.foods[i];
            const r = ai.radius + f.size + 6;
            if ((f.x - ah.x) ** 2 + (f.y - ah.y) ** 2 < r * r) {
              ai.length += f.value;
              s.foods.splice(i, 1);
              if (s.foods.length < 400) spawnFood();
            }
          }
        }

        // camera follow with slight lead
        const lead = 40;
        const tx = ph.x + Math.cos(s.player.angle) * lead;
        const ty = ph.y + Math.sin(s.player.angle) * lead;
        s.cam.x += (tx - s.cam.x) * 0.08;
        s.cam.y += (ty - s.cam.y) * 0.08;
      }

      // particles
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.96; p.vy *= 0.96;
        p.life++;
        if (p.life >= p.max) s.particles.splice(i, 1);
      }

      // shake
      const sx = (Math.random() - 0.5) * s.shake;
      const sy = (Math.random() - 0.5) * s.shake;
      s.shake *= 0.9;

      // render world
      ctx.save();
      ctx.translate(w/2 + sx, h/2 + sy);
      const cam = s.cam;

      // parallax stars (3 layers)
      for (const star of s.stars) {
        const layerScale = 0.3 + star.z * 0.7;
        const px = (star.x - cam.x) * layerScale;
        const py = (star.y - cam.y) * layerScale;
        if (px < -w || px > w || py < -h || py > h) continue;
        ctx.globalAlpha = 0.3 + star.z * 0.5;
        ctx.fillStyle = star.c;
        ctx.fillRect(px, py, star.z * 2, star.z * 2);
      }
      ctx.globalAlpha = 1;

      // grid
      ctx.strokeStyle = "rgba(0, 200, 255, 0.06)";
      ctx.lineWidth = 1;
      const gridSize = 100;
      const gx0 = Math.floor((cam.x - w/2) / gridSize) * gridSize;
      const gy0 = Math.floor((cam.y - h/2) / gridSize) * gridSize;
      ctx.beginPath();
      for (let x = gx0; x < cam.x + w/2 + gridSize; x += gridSize) {
        ctx.moveTo(x - cam.x, -h/2); ctx.lineTo(x - cam.x, h/2);
      }
      for (let y = gy0; y < cam.y + h/2 + gridSize; y += gridSize) {
        ctx.moveTo(-w/2, y - cam.y); ctx.lineTo(w/2, y - cam.y);
      }
      ctx.stroke();

      // world border glow
      ctx.strokeStyle = "#ff00ff";
      ctx.shadowColor = "#ff00ff";
      ctx.shadowBlur = 30;
      ctx.lineWidth = 4;
      ctx.strokeRect(-cam.x, -cam.y, WORLD, WORLD);
      ctx.shadowBlur = 0;

      // foods
      for (const f of s.foods) {
        const px = f.x - cam.x, py = f.y - cam.y;
        if (px < -w/2 - 20 || px > w/2 + 20 || py < -h/2 - 20 || py > h/2 + 20) continue;
        f.phase += 0.08;
        const pulse = 1 + Math.sin(f.phase) * 0.2;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(px, py, f.size * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, f.size * pulse * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // draw snake helper
      const drawSnake = (snake: Snake) => {
        const segs = snake.segments;
        if (!segs.length) return;
        // outer glow pass
        ctx.shadowColor = snake.glow;
        ctx.shadowBlur = snake.isPlayer ? 28 : 18;
        ctx.strokeStyle = snake.color;
        ctx.lineWidth = snake.radius * 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(segs[0].x - cam.x, segs[0].y - cam.y);
        for (let i = 1; i < segs.length; i++) {
          ctx.lineTo(segs[i].x - cam.x, segs[i].y - cam.y);
        }
        ctx.stroke();

        // inner highlight
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = snake.radius * 0.7;
        ctx.beginPath();
        ctx.moveTo(segs[0].x - cam.x, segs[0].y - cam.y);
        for (let i = 1; i < segs.length; i++) {
          ctx.lineTo(segs[i].x - cam.x, segs[i].y - cam.y);
        }
        ctx.stroke();

        // head
        const head = segs[0];
        ctx.shadowColor = snake.glow;
        ctx.shadowBlur = 25;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(head.x - cam.x, head.y - cam.y, snake.radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        // eyes
        ctx.shadowBlur = 0;
        const ex1 = head.x + Math.cos(snake.angle + 0.6) * snake.radius * 0.7;
        const ey1 = head.y + Math.sin(snake.angle + 0.6) * snake.radius * 0.7;
        const ex2 = head.x + Math.cos(snake.angle - 0.6) * snake.radius * 0.7;
        const ey2 = head.y + Math.sin(snake.angle - 0.6) * snake.radius * 0.7;
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(ex1 - cam.x, ey1 - cam.y, snake.radius * 0.4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2 - cam.x, ey2 - cam.y, snake.radius * 0.4, 0, Math.PI*2); ctx.fill();

        // boost trail
        if (snake.boost) {
          for (let i = 0; i < segs.length; i += 3) {
            ctx.fillStyle = snake.color;
            ctx.globalAlpha = 0.3 * (1 - i/segs.length);
            ctx.beginPath();
            ctx.arc(segs[i].x - cam.x + (Math.random()-0.5)*8, segs[i].y - cam.y + (Math.random()-0.5)*8, snake.radius * 1.5, 0, Math.PI*2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      };

      // depth sort: draw AIs first then player on top
      for (const ai of s.ais) drawSnake(ai);
      if (s.player && s.running) drawSnake(s.player);
      ctx.shadowBlur = 0;

      // particles
      for (const p of s.particles) {
        const px = p.x - cam.x, py = p.y - cam.y;
        const a = 1 - p.life / p.max;
        ctx.globalAlpha = a;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size * a, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();

      // minimap
      if (s.player && s.running) {
        const mw = 120, mh = 120;
        const mx = w - mw - 16, my = h - mh - 16;
        ctx.fillStyle = "rgba(0,10,30,0.7)";
        ctx.strokeStyle = "rgba(0,249,255,0.5)";
        ctx.lineWidth = 1;
        ctx.fillRect(mx, my, mw, mh);
        ctx.strokeRect(mx, my, mw, mh);
        const sc = mw / WORLD;
        for (const ai of s.ais) {
          ctx.fillStyle = ai.color;
          ctx.fillRect(mx + ai.head().x * sc - 1, my + ai.head().y * sc - 1, 2, 2);
        }
        ctx.fillStyle = "#00f9ff";
        ctx.fillRect(mx + s.player.head().x * sc - 2, my + s.player.head().y * sc - 2, 4, 4);
      }

      // boost indicator
      if (s.player && s.running && s.boost) {
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = () => {
    const s = stateRef.current;
    if (!s.running) return;
    s.paused = !s.paused;
    if (!s.paused) s.last = performance.now();
    setPaused(s.paused);
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white select-none" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />

      {/* HUD */}
      {screen === "playing" && (
        <>
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-start pointer-events-none z-10">
            <div className="flex gap-3 sm:gap-6">
              <div className="bg-black/40 backdrop-blur-md border border-cyan-400/30 rounded-2xl px-3 py-2 sm:px-5 sm:py-3" style={{ boxShadow: "0 0 20px rgba(0,249,255,0.3)" }}>
                <div className="text-[10px] sm:text-xs uppercase tracking-widest text-cyan-300/80">Length</div>
                <div className="text-2xl sm:text-4xl font-black tabular-nums" style={{ color: "#00f9ff", textShadow: "0 0 12px #00f9ff" }}>{score}</div>
              </div>
              <div className="bg-black/40 backdrop-blur-md border border-fuchsia-400/30 rounded-2xl px-3 py-2 sm:px-5 sm:py-3" style={{ boxShadow: "0 0 20px rgba(255,0,200,0.3)" }}>
                <div className="text-[10px] sm:text-xs uppercase tracking-widest text-fuchsia-300/80">Best</div>
                <div className="text-2xl sm:text-4xl font-black tabular-nums" style={{ color: "#ff00cc", textShadow: "0 0 12px #ff00cc" }}>{best}</div>
              </div>
            </div>
            <button
              onClick={togglePause}
              className="pointer-events-auto bg-black/50 backdrop-blur border border-white/20 hover:border-cyan-400 hover:text-cyan-300 rounded-full px-4 py-2 text-xs sm:text-sm font-bold tracking-wider transition-all"
            >
              {paused ? "▶ RESUME" : "❚❚ PAUSE"}
            </button>
          </div>

          {paused && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="text-center">
                <div className="text-6xl sm:text-8xl font-black tracking-tighter mb-2" style={{ color: "#00f9ff", textShadow: "0 0 30px #00f9ff" }}>PAUSED</div>
                <button onClick={togglePause} className="mt-4 px-8 py-3 bg-cyan-400 text-black font-bold rounded-full hover:bg-white transition">RESUME</button>
              </div>
            </div>
          )}

          {precisionMode && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none bg-black/50 border border-fuchsia-400/50 rounded-full px-4 py-1.5 text-[10px] tracking-[0.3em] font-bold text-fuchsia-200" style={{ boxShadow: "0 0 20px rgba(255,0,200,0.4)" }}>
              ◎ PRECISION LOCK
            </div>
          )}

          {/* On-screen BOOST button (hold to dash) */}
          <button
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              stateRef.current.boost = true;
              if (stateRef.current.running) playSound("boost");
            }}
            onPointerUp={() => { stateRef.current.boost = false; }}
            onPointerCancel={() => { stateRef.current.boost = false; }}
            onPointerLeave={() => { stateRef.current.boost = false; }}
            onContextMenu={(e) => e.preventDefault()}
            className="absolute bottom-6 left-6 z-10 select-none w-20 h-20 sm:w-24 sm:h-24 rounded-full font-black text-xs tracking-[0.2em] text-black active:scale-90 transition-transform"
            style={{
              background: "radial-gradient(circle at 30% 30%, #fff, #00f9ff 40%, #ff00cc 100%)",
              boxShadow: "0 0 30px rgba(0,249,255,0.7), 0 0 60px rgba(255,0,200,0.4), inset 0 0 20px rgba(255,255,255,0.4)",
              touchAction: "none",
            }}
          >
            BOOST
          </button>
        </>
      )}

      {/* Start Screen */}
      {screen === "start" && (
        <div className="absolute inset-0 overflow-y-auto z-20" style={{ background: "radial-gradient(ellipse at center, rgba(10,4,32,0.85) 0%, rgba(0,0,0,0.97) 100%)" }}>
          <div className="min-h-full flex items-center justify-center p-4">
          <div className="text-center max-w-md w-full">
            {/* Hero banner with icon overlay */}
            <div className="relative mb-6 rounded-3xl overflow-hidden border border-cyan-400/30" style={{ boxShadow: "0 0 40px rgba(0,249,255,0.35), inset 0 0 40px rgba(0,0,0,0.6)" }}>
              <img src={cyberBanner.url} alt="Cyber grid arena" className="w-full h-40 sm:h-48 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
                <img src={snakeIcon.url} alt="" className="w-12 h-12 rounded-full border-2 border-cyan-300" style={{ boxShadow: "0 0 24px rgba(0,249,255,0.8)" }} />
                <div className="text-left">
                  <div className="text-[9px] tracking-[0.4em] text-cyan-300/90">CYBERPUNK ARENA</div>
                  <div className="text-[10px] tracking-widest text-fuchsia-300/80">SEASON · 4D</div>
                </div>
              </div>
            </div>
            <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-none mb-2" style={{ color: "#00f9ff", textShadow: "0 0 20px #00f9ff, 0 0 40px #00f9ff, 0 0 60px rgba(0,249,255,0.5)" }}>
              NEON
            </h1>
            <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-none mb-6" style={{ color: "#ff00cc", textShadow: "0 0 20px #ff00cc, 0 0 40px #ff00cc, 0 0 60px rgba(255,0,200,0.5)" }}>
              SLITHER 4D
            </h1>
            <p className="text-base sm:text-lg text-gray-300 mb-6 leading-relaxed">
              Devour glowing energy. Out-slither 14 rivals.<br/>Become the apex serpent.
            </p>
            <PiAuth />
            <input
              value={playerName}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().slice(0, 12);
                setPlayerName(v);
                localStorage.setItem("neonSlither4DName", v);
              }}
              placeholder="YOUR HANDLE"
              className="w-full mb-4 px-4 py-3 bg-black/40 border border-cyan-400/30 rounded-xl text-center font-bold tracking-widest text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-300"
            />
            <button
              onClick={startGame}
              className="w-full px-8 py-5 bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black font-black text-lg sm:text-xl rounded-2xl tracking-wider hover:scale-105 active:scale-95 transition-transform"
              style={{ boxShadow: "0 0 40px rgba(0,249,255,0.6), 0 0 80px rgba(255,0,200,0.3)" }}
            >
              ENTER THE NEON REALM
            </button>

            {/* Loadout toolbar: Skins / Maps / Settings */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => setPanel("skins")} className="px-3 py-3 bg-black/40 border border-cyan-400/30 rounded-xl text-xs font-bold tracking-widest text-cyan-200 hover:border-cyan-300 transition">
                <div className="text-base mb-0.5">◈</div>SKINS
              </button>
              <button onClick={() => setPanel("maps")} className="px-3 py-3 bg-black/40 border border-fuchsia-400/30 rounded-xl text-xs font-bold tracking-widest text-fuchsia-200 hover:border-fuchsia-300 transition">
                <div className="text-base mb-0.5">⬢</div>MAPS
              </button>
              <button onClick={() => setPanel("settings")} className="px-3 py-3 bg-black/40 border border-yellow-400/30 rounded-xl text-xs font-bold tracking-widest text-yellow-200 hover:border-yellow-300 transition">
                <div className="text-base mb-0.5">⚙</div>TUNE
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] tracking-widest text-gray-400">
              <span>SKIN · <span className="text-cyan-300">{(SKINS.find(s=>s.id===selectedSkin)?.name||"").toUpperCase()}</span></span>
              <span>MAP · <span className="text-fuchsia-300">{(MAPS.find(m=>m.id===selectedMap)?.name||"").toUpperCase()}</span></span>
              <span>◎ {coins}</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] tracking-widest text-cyan-300/70 mb-1">STEER</div>
                <div className="text-xs text-gray-300">Drag finger / move mouse</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-[10px] tracking-widest text-fuchsia-300/70 mb-1">BOOST</div>
                <div className="text-xs text-gray-300">First tap = instant burst</div>
              </div>
              <div className="col-span-2 bg-white/5 border border-fuchsia-400/20 rounded-xl p-3">
                <div className="text-[10px] tracking-widest text-fuchsia-300/70 mb-1">PRECISION</div>
                <div className="text-xs text-gray-300">Second finger acts as a fine-tune joystick for surgical turns</div>
              </div>
            </div>

            {leaderboard.length > 0 && (
              <div className="mt-6 bg-black/40 border border-cyan-400/20 rounded-2xl p-4 text-left" style={{ boxShadow: "0 0 24px rgba(0,249,255,0.15)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-[0.3em] text-cyan-300/80">SCORE LOG · TOP 10</div>
                  <button
                    onClick={() => { setLeaderboard([]); localStorage.removeItem("neonSlither4DLeaderboard"); }}
                    className="text-[10px] tracking-widest text-gray-500 hover:text-red-400"
                  >
                    CLEAR
                  </button>
                </div>
                <ol className="space-y-1 max-h-44 overflow-y-auto">
                  {leaderboard.map((row, i) => (
                    <li key={row.date + "-" + i} className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className={`w-6 ${i === 0 ? "text-yellow-300" : i < 3 ? "text-cyan-300" : "text-gray-500"}`}>#{i + 1}</span>
                      <span className="flex-1 truncate text-gray-200 px-2">{row.name}</span>
                      <span className="text-fuchsia-300 font-bold">{row.score}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {/* Gameplay preview strip */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[gameplay1, gameplay2, gameplay3].map((g, i) => (
                <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-fuchsia-400/20" style={{ boxShadow: "0 0 16px rgba(255,0,200,0.2)" }}>
                  <img src={g.url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
              ))}
            </div>
            <div className="text-[10px] tracking-widest text-gray-500 mt-4">BEST · {best}</div>
          </div>
          </div>
        </div>
      )}

      {/* Loadout Panel Modal */}
      {panel !== "none" && screen === "start" && (
        <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md overflow-y-auto" onClick={() => setPanel("none")}>
          <div className="min-h-full flex items-start sm:items-center justify-center p-4 pt-10">
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-gradient-to-b from-[#0a0a1f] to-[#06010f] border border-cyan-400/30 rounded-3xl p-5 sm:p-6" style={{ boxShadow: "0 0 60px rgba(0,249,255,0.3)" }}>
              <div className="flex items-center justify-between mb-5">
                <div className="text-xs tracking-[0.3em] text-cyan-300">
                  {panel === "skins" ? "SKIN STORE" : panel === "maps" ? "ARENA SELECT" : "MOVEMENT TUNING"}
                </div>
                <button onClick={() => setPanel("none")} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
              </div>

              {panel === "skins" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                    <span>Earn ◎ credits by playing. Reach length to unlock rewards.</span>
                    <span className="text-yellow-300 font-bold">◎ {coins}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {SKINS.map(sk => {
                      const owned = ownedSkins.includes(sk.id);
                      const active = selectedSkin === sk.id;
                      const canBuy = !owned && coins >= sk.cost;
                      return (
                        <div key={sk.id} className={`relative rounded-2xl p-3 border transition ${active ? "border-cyan-300 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}>
                          <div className="h-14 rounded-xl mb-2 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${sk.palette[0]}, ${sk.palette[1]})`, boxShadow: `0 0 18px ${sk.palette[0]}` }}>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                          </div>
                          <div className="text-xs font-bold text-white truncate">{sk.name}</div>
                          <div className={`text-[9px] tracking-widest uppercase ${sk.tier === "legendary" ? "text-yellow-300" : sk.tier === "rare" ? "text-fuchsia-300" : "text-gray-400"}`}>{sk.tier}</div>
                          {owned ? (
                            <button
                              onClick={() => setSelectedSkin(sk.id)}
                              className={`mt-2 w-full py-1.5 rounded-lg text-[10px] font-black tracking-widest ${active ? "bg-cyan-300 text-black" : "bg-white/10 text-cyan-200 hover:bg-white/20"}`}
                            >
                              {active ? "EQUIPPED" : "EQUIP"}
                            </button>
                          ) : (
                            <button
                              disabled={!canBuy}
                              onClick={() => {
                                if (!canBuy) return;
                                setCoins(c => c - sk.cost);
                                setOwnedSkins(o => [...o, sk.id]);
                                setSelectedSkin(sk.id);
                              }}
                              className={`mt-2 w-full py-1.5 rounded-lg text-[10px] font-black tracking-widest ${canBuy ? "bg-gradient-to-r from-yellow-400 to-fuchsia-400 text-black" : "bg-white/5 text-gray-500 cursor-not-allowed"}`}
                            >
                              ◎ {sk.cost}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {panel === "maps" && (
                <div className="space-y-3">
                  {MAPS.map(m => {
                    const active = selectedMap === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMap(m.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition ${active ? "border-fuchsia-300 bg-fuchsia-400/10" : "border-white/10 bg-white/5 hover:border-fuchsia-400/40"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-black text-base" style={{ color: m.accent, textShadow: `0 0 10px ${m.accent}` }}>{m.name}</div>
                          {active && <span className="text-[10px] tracking-widest text-cyan-300">SELECTED</span>}
                        </div>
                        <div className="mt-1 text-[10px] tracking-widest text-gray-400 grid grid-cols-3 gap-2">
                          <span>WORLD · {m.world}</span>
                          <span>AI · {m.aiCount}</span>
                          <span>FOOD · {m.foodCount}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {panel === "settings" && (
                <div className="space-y-5">
                  {[
                    { key: "baseSpeed" as const,       label: "Base Speed",       min: 1.5, max: 4.5, step: 0.1 },
                    { key: "boostMultiplier" as const, label: "Boost Multiplier", min: 1.2, max: 3.0, step: 0.1 },
                    { key: "turnRate" as const,        label: "Turn Rate",        min: 0.05, max: 0.25, step: 0.01 },
                  ].map(cfg => (
                    <div key={cfg.key}>
                      <div className="flex items-center justify-between text-xs tracking-widest mb-2">
                        <span className="text-cyan-200">{cfg.label.toUpperCase()}</span>
                        <span className="text-yellow-300 font-mono">{settings[cfg.key].toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={cfg.min}
                        max={cfg.max}
                        step={cfg.step}
                        value={settings[cfg.key]}
                        onChange={(e) => setSettings(s => ({ ...s, [cfg.key]: parseFloat(e.target.value) }))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setSettings(DEFAULT_SETTINGS)}
                    className="w-full py-2.5 border border-white/20 rounded-xl text-xs tracking-widest font-bold text-gray-300 hover:bg-white/5"
                  >
                    RESET TO DEFAULT
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Game Over Screen */}
      {screen === "over" && (
        <div className="absolute inset-0 overflow-y-auto z-20 bg-black/80 backdrop-blur-sm">
          <div className="min-h-full flex items-center justify-center p-4">
          <div className="text-center max-w-md w-full">
            <div className="relative mb-5 rounded-2xl overflow-hidden border border-red-500/40" style={{ boxShadow: "0 0 30px rgba(255,0,68,0.4)" }}>
              <img src={tournamentBanner.url} alt="Tournament" className="w-full h-32 object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute bottom-2 left-0 right-0 text-[10px] tracking-[0.4em] text-red-300">SYSTEM TERMINATED</div>
            </div>
            <h2 className="text-5xl sm:text-7xl font-black tracking-tighter mb-6" style={{ color: "#ff0044", textShadow: "0 0 20px #ff0044, 0 0 40px #ff0044" }}>
              GAME OVER
            </h2>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
              <div className="text-xs tracking-widest text-gray-400 mb-1">FINAL LENGTH</div>
              <div className="text-7xl font-black tabular-nums" style={{ color: "#00f9ff", textShadow: "0 0 20px #00f9ff" }}>{score}</div>
            </div>
            {newBest && (
              <div className="mb-4 py-3 bg-gradient-to-r from-yellow-400/20 to-fuchsia-500/20 border border-yellow-400/50 rounded-xl">
                <div className="text-yellow-300 font-bold tracking-wider">★ NEW HIGH SCORE ★</div>
              </div>
            )}
            {leaderboard.length > 0 && (
              <div className="mb-4 bg-black/40 border border-cyan-400/20 rounded-2xl p-4 text-left">
                <div className="text-[10px] tracking-[0.3em] text-cyan-300/80 mb-2">SCORE LOG</div>
                <ol className="space-y-1 max-h-40 overflow-y-auto">
                  {leaderboard.slice(0, 5).map((row, i) => {
                    const mine = row.score === score && Math.abs(Date.now() - row.date) < 5000;
                    return (
                      <li key={row.date + "-" + i} className={`flex items-center justify-between text-xs font-mono tabular-nums ${mine ? "text-yellow-300" : ""}`}>
                        <span className="w-6 text-gray-500">#{i + 1}</span>
                        <span className="flex-1 truncate px-2">{row.name}</span>
                        <span className="font-bold">{row.score}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={startGame} className="flex-1 px-6 py-4 bg-cyan-400 hover:bg-white text-black font-black rounded-2xl tracking-wider transition" style={{ boxShadow: "0 0 30px rgba(0,249,255,0.5)" }}>
                PLAY AGAIN
              </button>
              <button onClick={() => setScreen("start")} className="flex-1 px-6 py-4 border border-white/30 hover:bg-white/10 font-bold rounded-2xl tracking-wider transition">
                MENU
              </button>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
