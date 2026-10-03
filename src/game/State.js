/* State.js - the world state W. The host owns it; in co-op it is sent to
   everyone several times a second. Everything in it is plain JSON so it can
   be saved to localStorage and sent over the wire unchanged. */
import { STOCK } from '../data/Data.js';
import { TRASH } from '../data/Hideout.js';

export const SAVE_KEY = 'pizzaunderground-save-v1';
export const PROFILE_KEY = 'pizzaunderground-profile-v1';

export function newWorld() {
  return {
    v: 1,
    money: 0, heat: 0, rep: 0, level: 1,
    quest: 0,                 // story step, see Story.js
    stock: Object.fromEntries(STOCK.map(k => [k, 0])),
    trash: TRASH.map(() => true),
    power: false, oven1: false,
    st: {},                   // station id -> { item, items[], cook, grease, fire, burnt }
    hold: {},                 // player id -> [items], top of the stack last
    orders: [], orderSeq: 1, orderT: 20,
    owned: { veh: [], disg: [], up: {} },
    wear: {},                 // player id -> disguise key
    clues: [],
    event: null,              // { k, t, ... }
    law: null,                // { k, t }
    eventT: 150,
    cars: [],                 // { id, kind, x, z, yaw, drv, pas: [] }
    carSeq: 1,
    fires: 0,                 // how long the kitchen has been seriously on fire
    stats: { made: 0, delivered: 0, burnt: 0, fires: 0, busted: 0, earned: 0, explosions: 0 },
    sign: 'closed',
    newsT: 0, news: '',
    dezT: 200,
    time: 0,
    ending: 0,               // 1 = the mayor has his pizza
    debts: [], debtSeq: 0,   // who owes you money (see Debts.js)
    mrep: 0, tierSeen: 0,    // Mafia Reputation 0..100
    safe: 0,                 // cash in the secret safe: can't be fined
    kn: null, rival: null,   // Knuckles on a job; the Calzone Cartel in the park
  };
}

export function loadWorld() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    const w = JSON.parse(s);
    if (!w || w.v !== 1) return null;
    return Object.assign(newWorld(), w);
  } catch (e) { return null; }
}
export function saveWorld(w) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(w)); } catch (e) { /* private mode */ }
}
export function wipeWorld() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ } }

export function loadProfile() {
  const d = { name: 'Pizza Guy', look: 0, bleep: false, vol: 0.8, music: 0.45, sens: 1, invert: false, key: Math.random().toString(36).slice(2, 12) };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')); } catch (e) { return d; }
}
export function saveProfile(p) { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) { /* */ } }

/** is this item evidence of a pizza crime */
export const isContraband = it => it && (it.k === 'pizza' || it.k === 'box' || it.k === 'base' || it.k === 'dough' || it.k === 'bag');
export const isPizza = it => it && (it.k === 'pizza' || it.k === 'box');
