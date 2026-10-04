/* main.js - boot: renderer, sky, the title screen, the loop. */
import * as THREE from '../lib/three.module.js';
import { Input } from './core/Input.js';
import { Audio } from './core/Audio.js';
import { Net } from './net/Net.js';
import { Game } from './game/Game.js';
import { loadProfile, saveProfile, loadWorld, wipeWorld } from './game/State.js';
import { LOOKS } from './data/Data.js';
import { Q } from './data/Story.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
window.__log = (m) => {
  (window.__logs ||= []).push(m); console.log(m);
  // stuck on the loading screen? say why
  const L = document.getElementById('loading');
  if (L && !L.classList.contains('gone') && /^(ERR|REJ)/.test(m)) { L.style.cssText += ';flex-direction:column;font-size:1rem;text-align:center;padding:20px'; L.insertAdjacentHTML('beforeend', '<div style="font:700 0.9rem monospace;color:#fff;-webkit-text-stroke:0;max-width:90vw;margin-top:12px;white-space:pre-wrap">' + String(m).replace(/</g, '&lt;').slice(0, 600) + '</div>'); }
};
addEventListener('error', e => window.__log('ERR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
addEventListener('unhandledrejection', e => window.__log('REJ ' + (e.reason?.stack || e.reason)));

async function boot() {
  try { await Promise.race([document.fonts.load('40px "Luckiest Guy"'), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* */ }
  const canvas = $('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const HORIZON = '#f0d4f0';
  scene.background = new THREE.Color(HORIZON);
  scene.fog = new THREE.Fog(HORIZON, 110, 420);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 1200);
  scene.add(camera); // first-person hands hang off it

  // lights
  const hemi = new THREE.HemisphereLight('#fff0ff', '#8a64a8', 1.3); scene.add(hemi);
  // a cool fill from the side away from the sun: shaded walls keep their shape instead of going flat
  const fill = new THREE.DirectionalLight('#b8c8ff', 0.55); fill.position.set(-60, 40, -50); scene.add(fill);
  const sun = new THREE.DirectionalLight('#ffe9cc', 2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 260 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // sky: a gradient dome, lavender above and pink at the horizon, and some chunky clouds
  const sky = new THREE.Group();
  const sg = new THREE.SphereGeometry(900, 24, 14);
  const cols = [], top = new THREE.Color('#9a7ae8'), hor = new THREE.Color(HORIZON), pos = sg.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 900; const c = hor.clone().lerp(top, Math.max(0, Math.min(1, y * 1.6))); cols.push(c.r, c.g, c.b); }
  sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  sky.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, fog: false, emissive: 0xf4e8ff, emissiveIntensity: 0.35 });
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group(), a = i / 26 * Math.PI * 2, d = 260 + Math.random() * 280;
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), cloudMat); m.position.set((k - 1.5) * 9, Math.random() * 4, Math.random() * 6); m.scale.set(12 + Math.random() * 8, 6 + Math.random() * 4, 10); c.add(m); }
    c.position.set(Math.sin(a) * d, 110 + Math.random() * 70, Math.cos(a) * d); c.rotation.y = a;
    sky.add(c);
  }
  scene.add(sky);

  const profile = loadProfile();
  const input = new Input(canvas);
  input.sensitivity = profile.sens; input.invertY = profile.invert;
  input.requireLock = true;
  const audio = new Audio();
  audio.setVolume(profile.vol, profile.music);
  const net = new Net();

  const game = new Game({ renderer, scene, camera, input, audio, net, profile });
  game.build();
  game.lights = { sun, hemi, fill };
  game.sky = sky;
  window.__game = game;
  window.__tests = () => import('./debug/Tests.js');
  input.canLock = () => game.phase !== 'title' && game.phase !== 'lobby' && !game.ui.menuOpen && !game.chatOpen && !game.inv?.open;
  input.onLockChange = (locked) => {
    if (!locked && game.phase === 'play' && !game.ui.menuOpen && !game.chatOpen && !game.ui.inDialog && !game.cam.override) game.pause();
  };
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  addEventListener('beforeunload', () => { if (game.isHost && game.phase === 'play') { try { localStorage.setItem('pizzaunderground-save-v1', JSON.stringify(game.W)); } catch (e) { /* */ } } });

  /* ---------------- the title screen ---------------- */
  $('tname').value = profile.name;
  $('tbleep').checked = !!profile.bleep;
  const looks = $('tlooks');
  LOOKS.forEach((l, i) => { const b = document.createElement('button'); b.style.background = l.shirt; b.title = l.name; b.onclick = () => { profile.look = i; game.player.look = i; game.player._mk(); mark(); }; looks.appendChild(b); });
  const mark = () => [...looks.children].forEach((b, i) => b.classList.toggle('on', i === profile.look));
  mark();
  const save = loadWorld();
  if (!save || save.quest <= Q.HOSPITAL) $('bcont').style.display = 'none';
  else $('bnew').classList.remove('big');
  const keep = () => { profile.name = ($('tname').value || 'Pizza Guy').replace(/[<>]/g, '').slice(0, 16); profile.bleep = $('tbleep').checked; saveProfile(profile); audio.unlock(); };
  const go = (fresh) => { keep(); $('title').classList.add('gone'); game.begin(fresh); canvas.requestPointerLock?.(); };
  $('bcont').onclick = () => go(false);
  $('bnew').onclick = () => { if (save && save.quest > Q.HOSPITAL && !confirm('Start over? Your saved pizza empire will be gone.')) return; wipeWorld(); go(true); };
  $('bhost').onclick = async () => {
    keep(); $('tmsg').textContent = 'Opening a room...';
    try { await net.host({ name: profile.name, look: profile.look, key: profile.key }); $('title').classList.add('gone'); game.phase = 'lobby'; game.lobbyMenu(); }
    catch (e) { $('tmsg').textContent = e.message; }
  };
  $('bjoin').onclick = async () => {
    keep(); $('tmsg').textContent = 'Connecting...';
    try { await net.join($('tcode').value, { name: profile.name, look: profile.look, key: profile.key }); $('title').classList.add('gone'); game.phase = 'lobby'; game.lobbyMenu(); }
    catch (e) { $('tmsg').textContent = e.message; }
  };
  $('tcode').addEventListener('keydown', e => { if (e.key === 'Enter') $('bjoin').click(); });

  // test hooks: ?skip=<quest> jumps into the story, ?script=<name> runs a test
  if (params.has('skip')) {
    $('title').classList.add('gone');
    const q = +params.get('skip') || Q.BIZ;
    game.begin(true);
    game.intro.active = null; game.cam.override = null;
    const { setupAt } = await import('./debug/Tests.js');
    setupAt(game, q);
  }
  if (params.has('auto')) go(params.get('auto') === 'new');
  if (params.has('script')) { const T = await import('./debug/Tests.js'); T.run(game, params.get('script')); }

  $('loading').classList.add('gone');
  let last = performance.now();
  const frame = (now) => {
    const dt = (now - last) / 1000; last = now;
    try { if (!game.paused) game.update(dt * (game.timeScale ?? 1)); } catch (e) { if (!game._errN || game._errN < 5) { game._errN = (game._errN || 0) + 1; window.__log('UPDATE ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')); } }
    // (test scripts draw at most once a second while they run: drawing the town in software is slow)
    if (!game.noRender || now - (game._lastDraw || 0) > 1000) { renderer.render(scene, camera); game._lastDraw = now; }
    input.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // tests drive the loop by hand where requestAnimationFrame does not run (headless iframes)
  window.__tick = (dt) => { game.update(dt); input.endFrame(); };
}
boot();
