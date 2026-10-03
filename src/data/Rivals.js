/* Rivals.js - the other three pizza gangs in Crumbville. Who they are, what
   they say, how they grow, what they do to you, and what you can do back.
   Everything is goofy: nobody gets hurt on screen. */

export const GANGS = {
  italian: {
    name: 'The Italian Guys', short: 'Italian Guys', color: '#2f8a4a', color2: '#d6232a',
    place: 'Nonna\'s Garage', sign: ['NONNA\'S', 'GARAGE'], signBg: '#2f8a4a', signFg: '#ffffff',
    boss: 'Don Vincenzo', bossLook: { hat: 'fedora', hatColor: '#1b1b24', coat: '#1b1b24', glasses: 'sun', skin: '#e0a57c', mustache: '#1a1410', tie: '#d6232a', belly: 1.4, headSize: 1.05 },
    crew: { hat: 'fedora', hatColor: '#3a3a48', shirt: '#f6f1e6', sleeve: '#f6f1e6', pants: '#1b1b24', tie: '#2f8a4a', skin: '#c98a5e', mustache: true },
    desc: 'Run a tiny restaurant out of a garage that is falling apart. Act like the most powerful criminal organization in the world.',
    speed: 0.8,   // how fast they deliver (they argue in the van)
    levels: ['a garage with a hot plate', 'a garage with a real oven', 'a garage with a NEON sign', 'a garage with an ANNEX', 'the GARAGE EMPIRE'],
    hi: ['You come into my garage. On the day of my daughter\'s pizza.', 'Sit. Don\'t sit there. That\'s the oil stain. Sit THERE.', 'In this family, we respect the dough.', 'My cousin Frank is here. Frank, say hi. ...Frank.'],
    spot: ['HEY! Who let this guy in the GARAGE?!', 'Vincenzo! There\'s somebody in the garage!', 'You\'re not family! FAMILY ONLY!'],
  },
  delivery: {
    name: 'The Delivery Boys', short: 'Delivery Boys', color: '#ff9f1a', color2: '#1b1b24',
    place: 'Speedy Depot', sign: ['SPEEDY', 'DEPOT'], signBg: '#ff9f1a', signFg: '#1b1b24',
    boss: 'Turbo Tony', bossLook: { hat: 'cap', hatColor: '#ff9f1a', capLogo: '#1b1b24', shirt: '#ff9f1a', pants: '#1b1b24', glasses: 'sun', skin: '#f2c29b', hair: '#c8742a', belly: 0.95 },
    crew: { hat: 'cap', hatColor: '#ff9f1a', capLogo: '#1b1b24', shirt: '#1b1b24', pants: '#ff9f1a', skin: '#8d5a3b' },
    desc: 'Own a fleet of very fast vans. Obsessed with delivering faster than you. The pizza is bad. The pizza is very fast.',
    speed: 1.5,
    levels: ['two vans and a dream', 'four vans and a stopwatch', 'a depot with a RACE TRACK', 'a depot with a HELIPAD (no helicopter)', 'SPEEDY INTERNATIONAL'],
    hi: ['You\'re slow. I timed you. 4 minutes 12 seconds. Pathetic.', 'Speed is life. Pizza is... also there.', 'Talk fast. Every second you talk, a pizza gets cold somewhere.', 'Our record is 38 seconds. The customer is still in shock.'],
    spot: ['INTRUDER! And he\'s SLOW!', 'Somebody in the depot! Stopwatch says... 12 seconds too long!', 'Hey! You! Clock in or get out!'],
  },
  frozen: {
    name: 'The Frozen Pizza Gang', short: 'Frozen Gang', color: '#43c0ff', color2: '#ffffff',
    place: 'Cold Cuts Freezer Co.', sign: ['COLD CUTS', 'FREEZER CO.'], signBg: '#43c0ff', signFg: '#ffffff',
    boss: 'Mister Freeze-Dried', bossLook: { hat: 'beanie', hatColor: '#ffffff', coat: '#cfe8ff', glasses: 'round', skin: '#f7d6b8', mustache: '#e0e0e0', hair: '#e0e0e0', belly: 1.25 },
    crew: { hat: 'beanie', hatColor: '#43c0ff', shirt: '#cfe8ff', pants: '#3a5a9a', skin: '#e0a57c', glasses: 'round' },
    desc: 'Don\'t make pizza. Buy frozen pizza at the supermarket, put it in a nicer box and sell it for $40. It works. Nobody knows why.',
    speed: 1.0,
    levels: ['one chest freezer', 'three chest freezers', 'a WALK-IN freezer', 'a freezer WAREHOUSE', 'COLD CUTS GLOBAL'],
    hi: ['Fresh? Pfft. Fresh is a marketing word.', 'Our pizza is ARTISAN. The artisan is a factory in another country.', 'I haven\'t been warm since 2009. It\'s a lifestyle.', 'Want a slice? I can have it ready in... (checks box) ...25 minutes at 425 degrees.'],
    spot: ['Somebody\'s in the freezer! ...Again! Close the DOOR!', 'Hey! You\'re letting the cold out!', 'INTRUDER! Everybody look serious and frozen!'],
  },
};
export const GANG_KEYS = ['italian', 'delivery', 'frozen'];

/** the boss meeting: the classic */
export const MEETING = (G) => [
  ['boss', 'Sit down.'],
  ['narr', '(He sits behind a desk that is way too big for the room. Two bodyguards stand behind him, not blinking.)'],
  ['boss', 'We have a problem.'],
  ['narr', '...'],
  ['boss', 'You sell pizza.'],
  ['narr', '...'],
  ['boss', 'We sell pizza.'],
  ['narr', '(He leans forward. Slowly. The chair creaks for a long time.)'],
  ['boss', 'This town ain\'t big enough for two pizza businesses.'],
  ['narr', '(Somewhere in the back, somebody drops a pizza. SPLAT.)'],
  ['narr', '(The boss turns his head. Very slowly.)'],
  ['boss', '...Frank.'],
  ['frank', 'Sorry, boss.'],
  ['boss', 'So. ' + G.short + ' and your little operation. What are we gonna do about this?'],
];

/** the caught scene: they drag you into the back room and argue */
export const CAUGHT = [
  [['crew1', 'You seriously thought we wouldn\'t notice?'], ['crew2', 'He\'s been in here for five minutes.'], ['crew1', 'I know.'], ['crew2', 'FIVE minutes.'], ['crew1', 'I KNOW, Frank.'], ['crew2', 'I\'m just saying, the cameras-'], ['crew1', 'Frank. Get the thing.']],
  [['crew1', 'Look who it is.'], ['crew2', 'Should we call the boss?'], ['crew1', 'The boss is at his pilates.'], ['crew2', 'Oh. Then we handle it.'], ['crew1', 'We handle it.'], ['crew2', '...How do we handle it?'], ['crew1', 'Get. The. Thing.']],
  [['crew1', 'Breaking into our place. In broad daylight.'], ['crew2', 'It\'s night.'], ['crew1', 'In broad NIGHTLIGHT.'], ['crew2', 'That\'s not a-'], ['crew1', 'Frank, I swear to God.'], ['crew2', '...I\'ll get the thing.']],
];

/** what's gone when you get home after being caught */
export const RETALIATE = {
  cash: (n) => 'The register is lighter. ' + n + ' gone. They left a sticky note: "TOLL."',
  stock: (n, s) => n + ' ' + s + ' gone from the fridge. In its place: one sad frozen pizza.',
  boxes: 'Every pizza box in the place has been moved. To the roof. How.',
  oven: 'The oven is wrecked. Somebody put a whole frozen pizza in it. In the box.',
  car: (c) => 'Your ' + c + ' is gone. ...It\'s parked on the other side of town. With a parking ticket.',
  mess: 'The kitchen is a mess. Flour everywhere. Someone wrote "LOSERS" in the sauce.',
  cams: 'One of your cameras is pointing at the wall now. It has a mustache drawn on it.',
};

/** things the Rivals do to the town (host picks them) */
export const EVENT_TEXT = {
  popup: (G) => G.name.toUpperCase() + ' HAVE OPENED A PIZZA STAND TWO BLOCKS AWAY!',
  cheese: (G) => G.name.toUpperCase() + ' STOLE YOUR CHEESE SUPPLY!',
  deal: (G) => G.name.toUpperCase() + ' WANT TO MAKE A DEAL.',
  secret: () => 'RUMOR: SOMEBODY IS RUNNING A SECRET KITCHEN IN TOWN.',
  meeting: (G) => G.boss.toUpperCase() + ' WANTS A MEETING.',
  grow: (G, lvl) => G.name + ' grew: now ' + G.levels[lvl - 1] + '.',
  steal: (G, name) => G.name + ' got to ' + name + ' first. The customer is eating THEIR pizza now.',
};

/** missions: short, chaotic, replayable. Offered by bosses (and on the phone). */
export const MISSIONS = {
  race: { name: 'Delivery Race', who: 'delivery', desc: 'Turbo Tony bets you $3,000 you can\'t deliver this pizza before his van does. Their van leaves when you do.', reward: 3000, t: 90 },
  record: { name: 'Beat the Record', who: 'delivery', desc: 'The Speedy Depot record for this address is 45 seconds. Beat it. Win a trophy and their respect.', reward: 2500, t: 45 },
  shipment: { name: 'The Missing Shipment', who: 'frozen', desc: 'A pallet of frozen pizza boxes fell off a truck somewhere in town. Find the crates first. Mister Freeze-Dried wants them back. So do you.', reward: 2000, t: 150 },
  takeover: { name: 'Take Over the Old Pizzeria', who: 'italian', desc: 'The closed MAMMA MIA\'S is up for grabs. The Italian Guys want it. Hold your claim on it longer than they do.', reward: 4000, t: 75 },
  bigorder: { name: 'The Huge Order', who: 'delivery', desc: 'The mayor\'s secret party: 4 pizzas. The Delivery Boys are going for it too. Whoever delivers first gets paid.', reward: 8000, t: 180 },
  inspection: { name: 'Hide It From the Government', who: 'italian', desc: 'Inspectors are coming to Nonna\'s Garage! Carry their 3 crates of "tomatoes" out the back to your car before the inspection. They will owe you.', reward: 3500, t: 70 },
  kitchen: { name: 'The Secret Kitchen', who: null, desc: 'Somebody is cooking in one of the dead pizzerias. Find the secret kitchen. Then wreck it or report it.', reward: 2500, t: 200 },
};
