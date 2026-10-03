/* BlackMarket.js - the Underground Market under Pages & Pages Used Books.
   Gear is comedic and fictional: foam, cardboard, rubber chickens. Each
   item has one clear job. `grip` says how a hand holds it (see Gear.js),
   `anim` which use animation it plays, `uses` that it is used up. */

export const GEAR = {
  foambat: { label: 'Big Foam Bat', price: 2500, grip: 'up', anim: 'swing', bonus: 0.1, desc: 'Click: BONK. A cop you bonk forgets why he was chasing you (stunned 4s). Debtors find you a bit more convincing.' },
  mallet: { label: 'Comically Huge Mallet', price: 9000, grip: 'up', anim: 'slam', bonus: 0.25, desc: 'Click: a big slow BONK. Cops go flat as a pancake for 7s. Debtors find you MUCH more convincing.' },
  toolbox: { label: 'Heavy Toolbox', price: 3000, grip: 'hang', anim: 'thrust', desc: 'Click at a wrecked or greasy oven: fixed and scrubbed, free. Nobody knows what is inside. Not even you.' },
  cutout: { label: 'Cardboard Knuckles', price: 4500, grip: 'stick', anim: 'raise', desc: 'A life-size cardboard Knuckles on a stick. Click at a debtor\'s door: they see "Knuckles" and usually pay right away. Once per debtor.' },
  smoke: { label: 'Party Smoke Machine', price: 6000, grip: 'hang', anim: 'thrust', desc: 'Click in the hideout during an inspection: the officers can\'t see a thing (-3 evidence). Also great at parties.' },
  lockpick: { label: 'Lock-Breaking Kit', price: 3500, grip: 'hang', anim: 'jiggle', desc: 'A ring of keys and a rubber chicken. Click at a late debtor\'s door: skip the deadline, take their stuff now.' },
  disguise: { label: 'Instant Disguise Kit', price: 1200, grip: 'up', anim: 'raise', uses: true, desc: 'Click: glasses, nose, mustache. Cops ignore your pizzas for 45 seconds. One use per kit.' },
  airhorn: { label: 'Air Horn', price: 800, grip: 'up', anim: 'raise', desc: 'Click: HOOOONK. Cops within 15m freeze for 3 seconds. Citizens run in circles.' },
  flashlight: { label: 'Very Bright Flashlight', price: 1500, grip: 'along', anim: 'thrust', light: true, desc: 'Lights the way. Click: it points you at the nearest clue. Shine it at a chasing cop up close: blinded 2s.' },
  decoy: { label: 'Decoy Pizza Box', price: 1000, grip: 'up', anim: 'throw', uses: true, desc: 'Click: throw it. Cops chasing you go after the box instead. It is empty. They will be furious.' },
  docs: { label: 'Fake Documents', price: 5000, grip: 'up', anim: 'raise', uses: true, desc: 'Very official. Click near a cop: he reads, salutes and leaves you alone. During an inspection: -4 evidence.' },
  briefcase: { label: 'Suspicious Briefcase', price: 7500, grip: 'hang', anim: 'thrust', desc: 'Click at a chasing cop up close: you open it ($2,000 and a muffin). The chase ends. Heat -10.' },
};
export const GEAR_ORDER = ['foambat', 'mallet', 'toolbox', 'cutout', 'smoke', 'lockpick', 'disguise', 'airhorn', 'flashlight', 'decoy', 'docs', 'briefcase'];

/** Vito Pages, of Pages & Pages Used Books. He sells books. Only books. */
export const VITO = {
  hi: [
    'Books! We sell books here. Normal books. For reading. With the eyes.',
    'Welcome to Pages & Pages. Everything here is a book. Even me. I\'m a... no. I\'m a man.',
    'Can I help you? Don\'t look at that shelf. Look at THIS shelf. It has a book about birds.',
    'We have books about everything. Except basements. We definitely don\'t have a basement.',
  ],
  hint: [
    'You know what I could really go for? A... book. A round book. With cheese on it. Hot from the oven.',
    'Business is slow. I\'m so hungry I\'m thinking about eating a cookbook. A PIZZA cookbook. Hint hint. No hint. Forget it.',
    'If someone brought me a pizza - hypothetically - I might show them our... reading room. Hypothetically.',
  ],
  reveal: [
    ['vito', '...Is that... a pizza? A REAL pizza?'],
    ['vito', '(sniff) Pepperoni. Oh, that\'s the good stuff.'],
    ['vito', 'Nobody followed you? No cops? No inspectors? No birds? Birds are snitches.'],
    ['you', 'Uh... no?'],
    ['vito', 'Good. GOOD. Wait here. Act like you are reading.'],
  ],
  reveal2: [
    ['vito', 'Welcome... to the UNDERGROUND MARKET.'],
    ['vito', 'Down the stairs. Don\'t touch the cheese wheel. It bites. And don\'t tell ANYONE. Especially not the birds.'],
  ],
  after: [
    'The reading room is open. Down the stairs, past the shelf. Mind the cheese wheel.',
    'Shh! Books! We sell books! ...Oh, it\'s you. Go on down.',
    'Back again? Bring me another pizza sometime. I\'ve been thinking about it every day.',
  ],
};

/** the market's broker and the regulars */
export const BROKER = {
  hi: ['Welcome to the Underground Market. Everything is fictional and nothing is a refund.', 'Look but don\'t touch. Actually, touch. Then buy.', 'Psst. New stock. Fell off a truck. A very small truck. A toy truck.'],
};
export const MARKET_BARKS = [
  'I\'ll trade you three rubber chickens for one fake mustache.',
  'Is that cheese wheel looking at me?',
  'This briefcase? Documents. Very important. Don\'t ask what kind.',
  'Shh. We whisper down here. WHISPER. Sorry.',
  'Two foam bats, please. One for me, one for my other personality.',
  'My cousin knows a guy who knows a guy. I\'m the guy.',
  'Don\'t look at the back room. Nobody looks at the back room.',
  'These documents say I\'m a duke now. A DUKE.',
  'Pssst. Wanna buy a stolen... loaf of bread? It\'s just bread. It\'s really good bread.',
  'If anyone asks, I was at the library. Which is technically true.',
];
