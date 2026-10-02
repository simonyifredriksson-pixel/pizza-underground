/* Data.js - everything you can buy, everyone you can buy it from, and the
   numbers that make the money get ridiculous. */

export const TOPPINGS = ['pepperoni', 'mushroom', 'pineapple', 'olive', 'pepper'];
export const STOCK = ['dough', 'sauce', 'cheese', ...TOPPINGS];
export const STOCK_NAME = { dough: 'Dough', sauce: 'Sauce', cheese: 'Cheese', pepperoni: 'Pepperoni', mushroom: 'Mushrooms', pineapple: 'Pineapple', olive: 'Olives', pepper: 'Peppers' };
// keys 1-7 at the prep counter
export const ADD_KEYS = ['sauce', 'cheese', 'pepperoni', 'mushroom', 'pineapple', 'olive', 'pepper'];

export const LOOKS = [
  { name: 'Red', hat: 'cap', hatColor: '#d23a3a', shirt: '#d23a3a', pants: '#2b2b38', skin: '#f2c29b', hair: '#3a2418', capLogo: '#ffd23f' },
  { name: 'Blue', hat: 'cap', hatColor: '#3a7bd5', shirt: '#3a7bd5', pants: '#2b2b38', skin: '#c98a5e', hair: '#1a1410', capLogo: '#ffffff' },
  { name: 'Green', hat: 'cap', hatColor: '#3fa34d', shirt: '#3fa34d', pants: '#3a3048', skin: '#f7d6b8', hair: '#c8742a', capLogo: '#ffd23f' },
  { name: 'Purple', hat: 'cap', hatColor: '#8a4ac8', shirt: '#8a4ac8', pants: '#2b2b38', skin: '#8d5a3b', hair: '#1a1410', capLogo: '#ff8fc8' },
];
export const DEZ_LOOK = { hat: 'beanie', hatColor: '#ff9f1a', shirt: '#ffcf33', pants: '#3a5a9a', skin: '#e0a57c', hair: '#5a3a1a', nose: 1.3 };

/* ---------------- suppliers ----------------
   `who` is a human look or a critter kind. Each sells bundles of 10. */
export const SUPPLIERS = {
  doug: {
    name: 'Doughboy Doug', poi: 'doug', human: { hat: 'chef', shirt: '#ffffff', pants: '#c8a080', skin: '#f2c29b', belly: 1.35, mustache: true, hair: '#d8c8b0', apron: true },
    sells: [{ item: 'dough', qty: 10, price: 400 }],
    hi: ["Psst. You need dough? I got dough. Both kinds.", "Flour, water, yeast, crime. That's my recipe.", "The bakery closed. I didn't. I just stand here now."],
  },
  tony: {
    name: 'Tomato Tony', poi: 'tony', critter: 'tomato', opts: { mustache: true },
    sells: [{ item: 'sauce', qty: 10, price: 350 }],
    hi: ["Don't ask where the sauce comes from. ...It's me. I'm the sauce.", "Fresh sauce. Squeezed this morning. Don't think about it too hard.", "Yeah I'm a tomato. Got a fucking problem with that?"],
  },
  cheese: {
    name: 'Big Cheese', poi: 'bigCheese', critter: 'cheese', opts: { hat: 'cowboy' },
    sells: [{ item: 'cheese', qty: 10, price: 600 }],
    hi: ["Howdy, partner. I'm the Big Cheese. Literally.", "Mozzarella. Aged. Like me. Don't make it weird.", "Cheese is a gateway dairy, they say. Damn right it is."],
  },
  sal: {
    name: 'Sal Ami', poi: 'sal', critter: 'sausage',
    sells: [{ item: 'pepperoni', qty: 10, price: 500 }],
    hi: ["Sal Ami. Pepperoni. Slice of me, slice of heaven.", "I'm a sausage selling pepperoni. It's complicated, okay?", "Keep your voice down. The cops have been sniffing around here like hell."],
  },
  funguy: {
    name: 'The Fun Guy', poi: 'funguy', critter: 'mushroom',
    sells: [{ item: 'mushroom', qty: 10, price: 400 }],
    hi: ["I'm a fun guy. Get it? Fungi? ...Nobody ever gets it.", "Mushrooms. Normal ones. The normal kind. Shut up.", "You came all the way out to the forest? Damn. Respect."],
  },
  pete: {
    name: 'Pineapple Pete', poi: 'pete', critter: 'pineapple',
    sells: [{ item: 'pineapple', qty: 10, price: 700 }],
    hi: ["Pineapple belongs on pizza. Fight me.", "Yeah it's illegal. It was ALWAYS kind of illegal, socially.", "Cool sunglasses? Thanks. I was born in them."],
  },
  olive: {
    name: "Ol' Ive", poi: 'olive', critter: 'olive',
    sells: [{ item: 'olive', qty: 10, price: 400 }, { item: 'pepper', qty: 10, price: 400 }],
    hi: ["Olives AND peppers. I'm diversified.", "Name's Ol' Ive. I've been selling olives since before you were born. Shit, I AM an olive.", "Black olives. Green peppers. Red flags. All yours."],
  },
  larry: {
    name: 'Legit Larry', poi: 'larry', human: { hat: 'fedora', hatColor: '#c8a03a', shirt: '#ff8fc8', pants: '#3fa34d', skin: '#f7d6b8', glasses: 'round', hair: '#c8742a', tie: '#ffd23f' },
    sells: [{ item: 'cheese', qty: 10, price: 250, scam: 0.45 }, { item: 'pepperoni', qty: 10, price: 200, scam: 0.45 }, { item: 'dough', qty: 10, price: 150, scam: 0.4 }],
    hi: ["Legit Larry. Totally legit. It's in the name.", "Half price! Why? Uh. Volume. I move a lot of volume.", "Every single thing I sell is real. Probably. Mostly."],
  },
};
export const SCAM_TEXT = {
  cheese: "Wait. This 'cheese' is a bar of soap with a picture of cheese taped on it. LARRY, YOU SON OF A BITCH.",
  pepperoni: "These 'pepperoni' are red poker chips. Larry. Fucking LARRY.",
  dough: "This 'dough' is a bag of mashed potatoes. Larry, what the hell.",
};

/* ---------------- shops ---------------- */
export const OVEN_PRICE = 4000;
export const HQ_LEVELS = [
  null,
  { name: 'Tiny Kitchen', price: 0, desc: 'One oven, one counter and a smell.' },
  { name: 'Bigger Kitchen', price: 40000, desc: 'Knock through to the back room: a second oven, counter, boxing table and a READY shelf.' },
  { name: 'Secret Basement', price: 120000, desc: 'Dig a basement. Two more ovens down there, and the smell stays underground (town heat from cooking halved).' },
  { name: 'Underground Factory', price: 350000, desc: 'The TURBO OVEN 9000: cooks three pizzas at once, fast. Room for more staff.' },
  { name: 'Pizza Empire', price: 1000000, desc: 'Gold everything. Ovens cook faster and never catch fire on their own. Heat cools off twice as fast.' },
];
export const UPGRADES = {
  camera: { name: 'Security Cameras', price: 15000, desc: 'See every cop on the map (M) and get warned when they come near the hideout.' },
  hidden: { name: 'Hidden Entrance', price: 30000, desc: 'Inspectors only look in the front room. The basement and back room are "the shoe storage".' },
  sprinkler: { name: 'Sprinklers', price: 25000, desc: 'Fires in the hideout get put out after a few seconds. Mostly.' },
  fastoven: { name: 'Oven Mods', price: 20000, desc: 'Every oven cooks 40% faster.' },
  bigfridge: { name: 'Walk-in Fridge', price: 18000, desc: 'Stock bundles you buy come with 50% extra (the suppliers like you now).' },
  cook: { name: 'Hire a Cook', price: 20000, desc: 'Marco makes pizzas for your open orders and puts them on the READY shelf. Needs Bigger Kitchen.', level: 2 },
  driver: { name: 'Hire a Driver', price: 25000, desc: 'Vinny delivers boxed pizzas from the READY shelf for you. Customers tip less. Needs Bigger Kitchen.', level: 2 },
  lookout: { name: 'Hire a Lookout', price: 12000, desc: 'Grandma Rosa sits outside and warns you about inspectors twice as early. She is terrifying.' },
};
export const VEHICLES = {
  scooter: { name: 'Rusty Scooter', price: 3000, speed: 20, accel: 16, desc: 'Slow, loud, perfect.' },
  van: { name: 'Delivery Van', price: 25000, speed: 22, accel: 14, desc: 'Fits the whole crew. Looks like a kidnapping.' },
  icecream: { name: 'Ice Cream Truck', price: 80000, speed: 21, accel: 13, desc: 'The perfect disguise. Cops ignore it unless the town is really hot.', disguise: true },
  sports: { name: 'Sports Car', price: 200000, speed: 40, accel: 26, desc: 'Fast as hell. Two seats.' },
  armored: { name: 'Armored Pizza Truck', price: 750000, speed: 26, accel: 15, desc: 'Cops can not stop it. They will try.', armored: true },
};
export const DELIVERY_CAR = { name: 'Delivery Car', speed: 24, accel: 16 };
export const DISGUISES = {
  mustache: { name: 'Fake Mustache', price: 1500, detect: 0.7, desc: 'Cops notice you 30% later. Glued on with cheese.' },
  coat: { name: 'Trench Coat & Shades', price: 6000, detect: 0.55, desc: 'Cops notice you 45% later. Very undercover. Extremely obvious.' },
  cop: { name: 'Police Uniform', price: 40000, detect: 0.25, desc: 'Cops barely look at you. Do not run.' },
};

/* ---------------- the mystery ---------------- */
export const CLUES = [
  { id: 'statue', poi: 'statue', title: 'The Plaque', text: 'PIZZA BANNED BY ORDER OF MAYOR GORDON CRUMB.\nREASON: CLASSIFIED.\n\nUnderneath, scratched in small letters: "also personal"' },
  { id: 'gas', poi: 'clue_gas', title: 'Old Newspaper', text: 'THE CRUMBVILLE CRUMB - three weeks ago\n\nMAYOR\'S BIRTHDAY PIZZA "NEVER ARRIVES"\nMayor says he is "fine. Totally fine. Completely fine."\n\nPIZZA BANNED THE NEXT MORNING.' },
  { id: 'hospital', poi: 'clue_hospital', title: 'Hospital Records', text: 'ADMITTED, three weeks ago:\n- Pizza delivery crew. Car crash on Pepper Road.\n  Coma. Very sleepy.\n- One extra delivery guy. Found inside a wall.\n  Unrelated, somehow.' },
  { id: 'police', poi: 'clue_police', title: 'Evidence #0001', text: 'One (1) pizza. Deceased.\nRecovered from a car crash on Pepper Road.\nOrder slip: "DELIVER TO: CITY HALL. MAYOR\'S BIRTHDAY. EXTRA CHEESE. DO NOT BE LATE."\n\nNote from the sergeant: "it smells amazing, can I eat it" - "no"' },
  { id: 'radio', poi: 'clue_radio', title: 'Radio Transcript', text: '...witnesses say the mayor stood at the door of City Hall for thirty-one minutes, staring at the street "like a dog waiting for its owner." Then he went inside and, sources say, screamed into a cushion for an hour...' },
  { id: 'junk', poi: 'clue_junk', title: 'The Limo', text: 'A crushed black limo. Plate: MAYOR 1.\nThe front is pizza-car-shaped.\nIn the glovebox: "Note to self: get home before the pizza. DRIVE FASTER."\n\nThe mayor crashed into you. Rushing home. For your pizza.' },
  { id: 'mansion', poi: 'clue_mansion', title: 'A Letter', text: 'Dear Me,\nIf I can\'t have pizza, NOBODY can.\nThis is fine and normal and good leadership.\nLove, Me (Mayor Crumb)\n\nP.S. I am still very hungry.' },
  { id: 'archive', poi: 'archive', title: 'The Ban Itself', text: 'THE PIZZA ACT\nSection 1. Pizza is dangerous to society.\nSection 2. Because I said so.\nSection 3. Especially with extra cheese.\nSection 4. If the delivery crew ever wakes up, they know what they did.\n\nSigned, Mayor Gordon Crumb, very hungry.', needs: 'disguise' },
];

/* ---------------- random events ---------------- */
export const LAWS = [
  { k: 'square', name: 'All pizzas must now be SQUARE.', desc: 'Every pizza you make is square now. Nobody knows why.' },
  { k: 'license', name: 'Cheese now requires a cheese license.', desc: 'Cheese costs twice as much from suppliers.' },
  { k: 'running', name: 'Running is now illegal.', desc: 'Cops will chase anyone they see sprinting.' },
  { k: 'pineapple', name: 'Pineapple is now MANDATORY on everything.', desc: 'New orders all want pineapple. The pineapple lobby is powerful.' },
  { k: 'word', name: "The word 'pizza' is now illegal. It's 'Hot Bread Circle' now.", desc: 'It is called Hot Bread Circle now.' },
  { k: 'curfew', name: 'Pizza curfew: no pizza between now and later.', desc: 'Heat rises faster. Nobody understands this law.' },
];

export const NEWS = {
  heat: [
    [0, 'Crumbville is pizza-free and happy! Probably!'],
    [20, 'BREAKING: Strange smell reported in residential area.'],
    [40, 'BREAKING: Illegal food operation suspected. "It smells like oregano," says local man.'],
    [60, 'BREAKING: Police are investigating underground pizza activity.'],
    [80, 'BREAKING: The underground pizza ring is now the biggest rumor in town. Mayor "very upset".'],
  ],
  filler: [
    'Mayor Crumb: "The pizza ban is going great." Mayor seen licking a picture of pizza.',
    'Local man arrested for owning "suspiciously round" bread.',
    'Pineapple farmers protest, say pineapple ban is "unfair, also we have nothing else to do".',
    'Police remind citizens: if it is round and cheesy, report it. Unless it is the moon.',
    'Survey: 97% of Crumbville residents "really, really want pizza". The other 3% are lying.',
    'Weather: sunny, with a slight chance of pepperoni smell.',
    'City Hall installs new pizza detector. It is just a man named Doug who sniffs things.',
  ],
};

/* ---------------- orders ---------------- */
export const CUSTOMERS = ['Mrs. Dumpling', 'Big Steve', 'A Very Tired Dad', 'Grandma Feta', 'Kevin', 'The Twins', 'Coach Brick', 'Professor Noodle', 'Sweaty Gary', 'Tina (Night Shift)', 'Mr. Biscuits', 'The Book Club', 'Little Timmy', 'Brenda', 'Uncle Rico', 'A Raccoon (allegedly)', 'Stacy & Her 9 Cats', 'Pastor Phil', 'Dr. Waffles', 'Chad', 'The Mime', 'Mrs. Ortega'];
export const ORDER_MSG = [
  'please hurry. my kid has been asking for pizza for 3 weeks. I have been asking for 3 weeks too',
  'I would sell my car for this pizza. I would sell my HUSBAND',
  'no rush. JUST KIDDING. RUSH. HOLY SHIT, RUSH',
  'leave it in the mailbox. dont knock. dont make eye contact. I love you',
  'if this is good I will name my son after you. if its bad, also probably',
  'my therapist says I need to stop thinking about pizza. new therapist time',
  'is this the pizza guy. this is the pizza guy right. please be the pizza guy',
  'I havent had pizza in 3 weeks and I am losing my goddamn mind',
  'cash. lots of it. dont tell my wife',
  'my grandma is 98 and says she wants one more pizza before she dies. she is fine, she just wants pizza',
  'make it hot. like, temperature. I mean the temperature',
  'birthday party. 6 kids. they are feral. please',
];
export const STING_MSG = [
  'Greetings, fellow citizen. I would like to purchase one (1) illegal pizza for normal reasons. - Definitely Not Officer Dave',
  'hello i am a normal guy who loves crime. pizza please. (sent from Police Department phone)',
  'Hey bro. I am cool. Not a cop. I just love pizza and, separately, arresting people. Wait',
  'One pizza please. For evidence. FOR EATING. For eating.',
  'I am a regular civilian with a regular mustache. Please deliver to the house with all the police cars outside. Just kidding. Unless.',
  'Requesting one pizza, over. Copy that. Over and out. Roger.',
];
export const RICH = ['Count Mozzarella', 'Lady Pepperton', 'The Duke of Crust', 'Mr. Moneybags III', 'A Famous Rapper (anonymous)', 'The Cheese Lord'];

/* ---------------- barks ---------------- */
export const BARK = {
  citizenSee: ['Is that... a PIZZA box? Holy shit.', 'Damn, something smells like pepperoni.', 'I\'m calling the cops! ...After I smell it a bit more.', 'Is that what I think it is? Hell yeah.', 'Oh my god. OH MY GOD. Cheese.', 'Officer! OFFICER! Cheese crime!'],
  citizenFan: ['Psst. Hey. Pizza guy. You\'re a hero.', 'Respect, man. Respect.', 'I didn\'t see shit. Good luck.', 'Save me a slice, you beautiful criminal.'],
  citizenIdle: ['Three weeks without pizza. I eat bread and cry.', 'They banned pizza. They can\'t ban my DREAMS.', 'Nice weather. Shame about the pizza.', 'I miss pizza so much, man.', 'My kid asked me what pizza is. I had to lie.', 'Is it just me or does it smell like oregano?', 'Mayor\'s been weird since his birthday.'],
  copSpot: ['HEY! What\'s in the box?!', 'STOP RIGHT THERE, YOU CHEESY BASTARD!', 'FREEZE! Drop the pizza!', 'Is that... PEPPERONI? GET OVER HERE!', 'Pizza crime in progress! PIZZA CRIME!'],
  copRunning: ['WHY ARE YOU RUNNING?', 'Running is suspicious as hell! STOP!', 'Innocent people don\'t sprint like that!'],
  copLost: ['Damn it! Lost \'em.', 'Must\'ve been the wind. The cheesy wind.', 'Where the hell did they go?', 'Ugh. I\'m going back to the donut place.'],
  copCatch: ['GOTCHA! This pizza is evidence now.', 'You\'re under arrest! Kind of! Here\'s a fine!', 'Confiscated. I will be... disposing of this. Personally. With my mouth.'],
  copIdle: ['Nothing to see here. Unless it\'s pizza.', 'I miss pizza. Don\'t tell anyone.', 'Report suspicious cheese activity, citizen.', 'Keep it moving. And keep it pizza-free.'],
  natural: ['Act natural!', 'Nothing to see here!', '*whistles innocently*', 'Just a normal guy with normal boxes!'],
  hitByCar: ['WHAT THE HELL?!', 'AAAAAAAA', 'MY PIZZAS!', 'Ow. Ow. Fuck. Ow.'],
};

export const DEZ = {
  idle: ['Dude. DUDE. We\'re running an illegal pizza business. This is sick.', 'I still don\'t know how I got in that wall.', 'If the cops come, I\'m hiding in the fridge.', 'You think the mayor eats pizza in secret?', 'I could really go for a pizza. Oh wait.', 'We should name the business. Something subtle. Like "Pizza Crimes".'],
  sold: ['WHERE\'S THE CHEESE?', 'I sold it.', 'WHY?', 'We needed money.', 'WE SELL PIZZA.', 'I know.'],
};

/* ---------------- the swearing filter ---------------- */
const SWEAR = /\b(fuck\w*|shit\w*|goddamn\w*|damn\w*|hell|bitch\w*|bastard\w*|crap\w*|ass|asses|piss\w*)\b/gi;
const GRAWLIX = '#$%&!@*';
export function filter(text, bleep) {
  if (!bleep) return text;
  return text.replace(SWEAR, w => w[0] + Array.from({ length: w.length - 1 }, (_, i) => GRAWLIX[(i + w.length) % GRAWLIX.length]).join(''));
}
