/* Story.js - quest steps and every scripted conversation.
   A line is [who, text]; `who` is a speaker key (see SPEAKERS) or 'you',
   which is the local player. Deadpan characters, ridiculous situations. */

export const SPEAKERS = {
  you: { name: 'You', color: '#ffd23f' },
  dez: { name: 'Dez', color: '#ff9f1a' },
  doc: { name: 'Doctor', color: '#9ad8e8' },
  nurse: { name: 'Nurse', color: '#ff8fc8' },
  man: { name: 'Suspicious Man', color: '#c8a080' },
  oleg: { name: 'Oleg', color: '#8fc1e3' },
  hank: { name: 'Honest Hank', color: '#ffcf33' },
  stache: { name: 'Madame Moustache', color: '#f7a8c8' },
  guard: { name: 'Guard', color: '#aaaaaa' },
  mayor: { name: 'Mayor Crumb', color: '#e8c45a' },
  inspector: { name: 'Inspector Gristle', color: '#c8c8d8' },
  cop: { name: 'Cop', color: '#6f8fd8' },
  narr: { name: '', color: '#ffffff' },
  phone: { name: 'Phone', color: '#43e07a' },
};

export const QUEST = [
  'Survive the delivery',                                   // 0 intro
  'Wake up',                                                // 1 hospital
  'Leave the hospital',                                     // 2
  'Look around town',                                       // 3 meet the man
  'Find the old shoe repair shop on Anchovy Road',          // 4
  'Clean up the place',                                     // 5
  'Get the power working (the fuse box)',                   // 6
  'Buy a pizza oven at the Crumb Mall',                     // 7
  'Get flour, sauce and cheese into the hideout fridge',    // 8
  'Make a pizza',                                           // 9
  'Deliver the pizza to the Suspicious Man',                // 10
  'Run the business. Find out why pizza was banned.',       // 11
  "Deliver the mayor's birthday pizza to City Hall",        // 12
  'Build a pizza empire',                                   // 13
];
export const Q = { INTRO: 0, HOSPITAL: 1, LEAVE: 2, TOWN: 3, FIND: 4, CLEAN: 5, POWER: 6, OVEN: 7, STOCK: 8, MAKE: 9, FIRST: 10, BIZ: 11, FINALE: 12, EMPIRE: 13 };

export const INTRO_CAR = [
  [1.5, 'dez', "Dude, we're gonna be late."],
  [4.2, 'you', "It's literally a three-minute delivery."],
  [7.0, 'dez', "Yeah. We're already two minutes late."],
  [9.8, 'you', 'How the hell are we already late?'],
  [12.4, 'dez', 'I stopped for gas. And a snack. And a second snack.'],
  [15.4, 'you', 'Who orders extra cheese to City Hall anyway?'],
  [18.2, 'dez', "Some big shot. It's his birthday. He called four times."],
  [21.2, 'dez', "He said, quote, 'if this pizza is late I will END you.'"],
  [24.4, 'you', "Relax. Nothing's gonna happen. It's a pizza."],
  [27.0, 'dez', '...Is that limo doing a hundred?'],
  [28.6, 'you', 'OH SHIIIIIIT-'],
];
export const CRASH_T = 29.4;

export const HOSPITAL = [
  ['doc', "Good news. You're alive."],
  ['narr', '...'],
  ['doc', 'Bad news. Your pizza is dead.'],
  ['you', 'My WHAT?'],
  ['doc', 'The pizza.'],
  ['narr', '(The doctor walks away.)'],
  ['dez', "Guys? I'm fine. I'm stuck in a wall, but I'm fine."],
  ['you', 'How the fuck did you get in the wall?'],
  ['dez', 'Honestly? No idea. The doctors had a meeting about it.'],
  ['nurse', "Oh, you're awake! You've been in a coma for three weeks."],
  ['you', 'THREE WEEKS?'],
  ['nurse', "Three weeks. You slept through a lot. Anyway! You're fine. Off you go."],
  ['you', 'What did we sleep through?'],
  ['nurse', '(She is already gone.)'],
  ['nurse', '(From the hallway) Your bill is in your pocket! It\'s huge!'],
  ['dez', "Go ahead, I'll catch up. I just need to... unstick."],
];

export const MAN_MEET = [
  ['man', 'Hey... you.'],
  ['you', 'Me?'],
  ['man', '(looks left) (looks right) (looks left again, for longer)'],
  ['man', 'You ever make pizza?'],
  ['you', 'I deliver pizza. Delivered. I was a pizza guy. I made them too, before the... car thing.'],
  ['man', '(his face changes completely) ...You MAKE pizza?'],
  ['narr', '(A very long pause.)'],
  ['man', 'You know pizza is illegal now, right?'],
  ['you', '...WHAT?'],
  ['man', 'Shhh! SHHH! Three weeks ago. The mayor banned it. Overnight. No reason. Every pizzeria in town: closed. Ovens: confiscated.'],
  ['man', 'People are going crazy. I\'m going crazy. I had a dream about a breadstick and I woke up crying.'],
  ['you', 'Pizza is ILLEGAL? How the hell is pizza illegal?!'],
  ['man', 'Nobody knows. That\'s the scary part.'],
  ['man', '(leans in) $15,000. One pizza.'],
  ['you', '...Fifteen THOUSAND?'],
  ['man', 'Cash. Do I look like a man who negotiates with carbohydrates?'],
  ['man', "Here. All of it, up front. I trust you. I'm desperate as hell."],
  ['narr', '+$15,000. Pizza is banned... and people will pay ANYTHING for it.'],
  ['man', "There's an old shoe repair shop on Anchovy Road. East side of town. Nobody's been in there since the incident."],
  ['you', 'What incident?'],
  ['man', "Nobody knows. That's what makes it an incident. Go. Make pizza. I'll be right here. I'm always right here."],
];
export const MAN_WAIT = [
  ['man', 'Pizza. Pizza pizza pizza. Is it done? Is it pizza yet?'],
  ['man', "The shoe shop on Anchovy Road. East. Go. I'm starving over here."],
  ['man', "Don't look at me. Look normal. Look at that wall. Good. Now go make pizza."],
];
export const MAN_DELIVER = [
  ['man', '(opens the box) (inhales for nine seconds)'],
  ['man', '...Oh my god.'],
  ['man', 'OH MY GOD.'],
  ['man', '(takes a bite) This is the best thing that has ever happened to me. And I was at my own wedding.'],
  ['man', "Listen. People are desperate. I'm gonna tell everyone. Keep your phone on."],
  ['man', "And kid? Watch out for the cops. They're sniffing for cheese everywhere. Act natural."],
];
export const MAN_BAD = [
  ['man', '(opens the box) ...What the hell is this?'],
  ['man', "That's not pizza. That's a crime against pizza. And pizza is ALREADY a crime."],
  ['man', 'Make me a real one. Dough, sauce, cheese. Cooked. Not burnt. I believe in you. Barely.'],
];

export const HQ_ARRIVE = [
  ['you', 'Holy shit, this place is disgusting.'],
  ['dez', "FOUND YOU! I got out of the wall. Took a while. Whoa, this place is a dump."],
  ['you', "We're gonna make pizza here."],
  ['dez', 'Illegally?'],
  ['you', 'Very illegally.'],
  ['dez', 'Hell yeah.'],
];
export const HQ_CLEAN = [
  ['dez', "Clean enough. Mostly. There's a raccoon living in the vent, but he seems cool."],
  ['dez', 'Now the lights. The fuse box is on the wall by the door. I think you just hit it.'],
];
export const HQ_POWER = [
  ['narr', 'You hit the fuse box until it worked. Electricians hate this one trick.'],
  ['dez', "Power! Now we need an oven. The new Crumb Mall has an equipment store. EQUIP-O-RAMA. They sell 'bread ovens'."],
];
export const HQ_STOCK = [
  ['dez', 'Oven, check. Now ingredients. Flour, sauce, cheese are still legal, weirdly. Just not all of them together, round, in a box.'],
  ['dez', 'The Crumb Mall grocery sells everything in crates. Carry them here (or drive them) and unload them into the STOCK fridge.'],
  ['dez', 'And if the grocery runs out, there\'s a whole underground: Doughboy Doug, Tomato Tony, Big Cheese... The map (M) knows.'],
];
export const HQ_MAKE = [
  ['dez', "Okay, we have everything. Here's how this works, I watched a video once:"],
  ['dez', 'Grab dough from the tub. Put it on the counter. Hold E to flatten it.'],
  ['dez', 'Then press 1 for sauce and 2 for cheese. Toppings are 3 to 7. Too much cheese and it EXPLODES, apparently.'],
  ['dez', "Pick it up, put it in the oven. Take it out when it's golden. Not black. Black is bad. Then box it."],
];

export const OLEG = {
  hi: ["Oleg sells ovens. For baking bread. Only bread. Round flat bread with cheese is NOT bread, so I would not know about it.", "You want oven? Oleg has oven. Oleg has asked no questions since 1987."],
  sold: ['Oven is delivered out the back. Do not ask how. Oleg has a guy. The guy is also Oleg.'],
};
export const HANK = { hi: ["Honest Hank! Every car on this lot is honest. Ish.", "Need wheels for... legal deliveries? Of legal things? Hank doesn't care, Hank sells cars."] };
export const STACHE = { hi: ["Welcome to the Mustache Emporium, darling. Every disguise you could want. Mostly mustaches.", "Nobody recognises a man with a mustache. It is science, darling."] };

export const GUARD = {
  none: [['guard', 'Staff only. ...Why do you smell like oregano?']],
  mustache: [['guard', 'Nice mustache. Still no.']],
  ok: [['guard', 'Oh! Detective. Go right ahead. The archive is a mess, sorry.']],
};

export const REVEAL = [
  ['you', 'Wait. Wait wait wait.'],
  ['dez', 'What?'],
  ['you', "The mayor's birthday pizza. Pepper Road. Three weeks ago."],
  ['dez', '...That was OUR delivery.'],
  ['you', 'He banned all pizza... because WE never showed up.'],
  ['dez', 'And HE crashed into US! With his stupid limo!'],
  ['you', 'We have to finish the delivery.'],
  ['dez', 'Three weeks late?'],
  ['you', 'Pepperoni. Extra cheese. City Hall. Let\'s finish this shit.'],
];

export const FINALE = [
  ['mayor', 'Who keeps knocking on the- ...'],
  ['mayor', '...Is that...'],
  ['you', 'Pizza delivery. For Mayor Crumb. Pepperoni, extra cheese.'],
  ['mayor', "That's... my birthday order."],
  ['you', "Yeah. Sorry it's late."],
  ['mayor', '...Three weeks late.'],
  ['you', 'There was a crash. You crashed into us, actually.'],
  ['mayor', 'I KNOW! I was rushing home for the pizza! And it never came! So I banned it! ALL OF IT! If I couldn\'t have pizza, NOBODY COULD!'],
  ['dez', "That's the dumbest shit I've ever heard."],
  ['narr', '(The mayor opens the box. Takes a bite. A very long pause.)'],
  ['mayor', "...It's cold."],
  ['you', "It's been three weeks."],
  ['mayor', "...It's PERFECT. (he is crying)"],
  ['mayor', "I'm lifting the ban! Pizza is legal again! Effective immediat-"],
  ['dez', "Whoa whoa whoa. If pizza's legal, anybody can sell it. Our business is gonna be worth shit."],
  ['mayor', '...Hm.'],
  ['mayor', 'New deal. Pizza stays illegal. Officially. The police will look the other way. A little. And I get a free pizza every Friday.'],
  ['you', 'Deal.'],
  ['mayor', 'And nobody hears about this. Especially the part where I cried.'],
  ['dez', "You're still crying."],
  ['mayor', 'SHUT UP. Here. Hush money. For the hush.'],
  ['narr', '+$100,000'],
];
