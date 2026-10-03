/* Mafia.js - the goofy pizza mafia: reputation tiers, debts and the people
   who owe you money. Nobody gets hurt. People lose their lawn flamingos. */

/** Mafia Reputation tiers. Each one unlocks situations, not just power. */
export const TIERS = [
  { at: 0, name: 'Who?', desc: 'An unknown pizza operation. Nobody looks twice.' },
  { at: 10, name: 'Those Pizza Guys', desc: 'Businesses start running tabs with you. Some forget to pay.' },
  { at: 25, name: 'The Crust Family', desc: 'Customers get nervous (and tip more). A man named Knuckles wants a job. The Suspicious Suit is in stock.' },
  { at: 45, name: 'Made Men (of Dough)', desc: 'Businesses want deals. Honest Hank sells you the Family Sedan. VIP customers call. A rival gang shows up.' },
  { at: 70, name: 'The Pizza Mafia', desc: 'The Sit-Down with City Hall. The secret safe holds more. The heat cools off faster.' },
  { at: 90, name: 'Legends of the Underground', desc: 'The Pizza Summit. Every topping in town bows to you.' },
];
export function tierOf(r) { let t = 0; TIERS.forEach((x, i) => { if (r >= x.at) t = i; }); return t; }

/** businesses that can run a tab with you (key -> name, town.biz key) */
export const BUSINESSES = {
  gas: "Gas 'N' Sad", oleg: "Oleg's Appliances", mustache: 'Mustache Emporium', shoes: "Shoes 'R' Shoes", laundry: 'Spin Cycle Laundromat', tattoo: 'Ink & Regret', hank: "Honest Hank's",
};
export const BIZ_TAB = [
  'ordered 8 pizzas for the staff party and "will pay Friday". It is not Friday. It is never Friday.',
  'catered a birthday with your pizza and said "put it on the tab". What tab? There was no tab. There is now.',
  'took 5 pizzas "on credit" and then said "what is credit".',
  'ordered pizza for a "business meeting". The meeting was just him. Eating pizza. Not paying.',
];

/** the excuses a customer gives when they put it on the tab at the door */
export const TAB_LINES = [
  'Can you put it on my tab? I\'ll pay you next week. Probably. Definitely. Probably.',
  'Oh no, my wallet is in my other pants. And my other pants are in my other house.',
  'I\'ll pay you double! Later! Much later!',
  'I left my money in the oven. Ha ha. Kidding. I don\'t have money.',
];

/** confronting a debtor at their door: [opening, outcome] scenes. pay: the chance they pay at once */
export const ENCOUNTERS = [
  { lines: [['debtor', 'Uh... I thought you guys forgot.'], ['you', 'We did.'], ['narr', '(A long, uncomfortable pause.)'], ['debtor', '...I\'ll get my checkbook.']], pay: 1 },
  { lines: [['debtor', 'Oh hey! Do you take quarters?'], ['you', '...How many quarters.'], ['debtor', 'All of them.'], ['narr', '(He hands you a bucket. It is VERY heavy.)']], pay: 1 },
  { lines: [['debtor', '(from inside) Nobody\'s home!'], ['you', 'You just talked.'], ['debtor', 'No I didn\'t.'], ['you', '...']], pay: 0.15 },
  { lines: [['debtor', 'I can explain. So there\'s this guy, right, and he owes ME money, and his cousin owes HIM money, and-'], ['you', 'Do you have the money.'], ['debtor', 'Not in a technical sense.']], pay: 0.2 },
  { lines: [['debtor', 'Can I pay you in pizza?'], ['you', 'We MAKE the pizza.'], ['debtor', 'Right. Right right right. Can I pay you in... compliments? Your hat is great.']], pay: 0.25 },
  { lines: [['debtor', 'Young man, I am 94 years old. Do you know how much money I have?'], ['you', 'How much?'], ['debtor', 'Exactly enough. Here. And take a cookie. You look thin.']], pay: 1 },
  { lines: [['debtor', 'Oh! The pizza people! Look, honey, it\'s the pizza people!'], ['narr', '(Somewhere inside, someone screams and a back door slams.)'], ['debtor', 'That was... the wind.']], pay: 0.3 },
  { lines: [['debtor', 'I spent the money on a jet ski.'], ['you', 'You live in a town with no water.'], ['debtor', 'I am aware of that now.']], pay: 0.2 },
  { lines: [['narr', '(The dog answers the door. It is holding an envelope in its mouth.)'], ['you', '...Good boy.'], ['narr', '(The envelope has the exact amount in it. Plus a dog treat.)']], pay: 1 },
  { lines: [['debtor', 'Is this about the pizza? Because I was just about to- I was literally about to- okay I wasn\'t.']], pay: 0.35 },
];
export const PAY_LINES = ['Fine! FINE! Here! Take it!', 'Okay okay okay. Here. All of it. Please go away.', 'Here. I\'m sorry. I\'m so sorry. Your pizza was really good.', 'You people are terrifying. And delicious. Here.'];
export const REFUSE_LINES = ['I don\'t have it! I swear! Look, I\'ll have it tomorrow!', 'Can\'t pay. Won\'t pay. Okay, can\'t AND won\'t.', 'You\'ll never get your money! ...Unless you wait a bit. Then maybe.'];
export const DEADLINE_LINES = ['Tomorrow. First thing. You have my word. My word is not worth much, but you have it.', 'Okay! Okay. I\'ll have it. Don\'t look at me like that. What are you looking at? My flamingo?'];
export const SEIZE_LINES = ['NOT THE {X}! ANYTHING BUT THE {X}!', 'You can\'t just take my {X}! ...You can, can\'t you.', 'Fine! Take the {X}! See if I care! (he cares)', 'My {X}... I\'ll pay! I\'ll pay as soon as I can! Be gentle with it!'];
export const RETURN_LINES = ['{N} paid up. Their {X} is going home. It missed them.', '{N} paid! The {X} goes back. It was honestly getting weird keeping it.'];
export const FORGIVE_LINES = ['You... you\'re forgiving me? You\'re a saint! A pizza saint!', 'I will tell everyone how kind you are! ...Wait, is this a trick?'];
export const BIZ_SEIZE = ['NOT OUR SIGN! How will people know where the shoes are?!', 'You took our SIGN? We\'re just a building now! A nameless building!'];

/** Knuckles, the debt collector. He carries a foam bat. He has never once used it. */
export const KNUCKLES = {
  intro: [['knuckles', 'Hey. Name\'s Knuckles. I collect things.'], ['you', 'Like... debts?'], ['knuckles', 'Debts. Stamps. Bottle caps. Mostly debts.'], ['knuckles', 'Hire me on the laptop and I\'ll go knock on doors for ya. Politely. I\'m very polite.']],
  win: ['Knuckles: "Collected {A} from {N}. They gave me a lemonade too. Nice people."', 'Knuckles: "{N} paid up. I just stood there. Standing is my skill."'],
  seize: ['Knuckles: "{N} didn\'t pay, so I took their {X}. I said please."', 'Knuckles: "No money, so I brought back their {X}. It\'s in the storage room. Don\'t sit on it."'],
};

export const NERVOUS = ['Oh god, it\'s them. Act normal, Linda.', 'I paid! I definitely paid! ...Did I pay?', 'N-nice suit, sir.', 'Please don\'t take my flamingo.', 'I love pizza. I LOVE pizza. Big fan. Huge.', 'Hey there, pal! Buddy! Friend! Please don\'t remember my face.'];

/** one-time story events when a reputation tier is reached */
export const TIER_EVENTS = [
  null,
  [['dez', 'Dude. People are calling us "those pizza guys". Like it\'s a THING.'], ['you', 'It IS a thing.'], ['dez', 'Businesses keep asking if they can "run a tab". I said yes to all of them. Was that bad?'], ['narr', 'MAFIA REP: Those Pizza Guys. Businesses can now owe you money. Check DEBTS on your phone.']],
  [['narr', 'A florist delivered flowers to the hideout. The card says: "Please don\'t hurt us. Love, The Florist."'], ['dez', 'Nobody\'s hurting anybody! We make PIZZA!'], ['you', 'People are scared of us.'], ['dez', '...Cool. Is that cool? That feels cool.'], ['narr', 'MAFIA REP: The Crust Family. Knuckles wants a job (laptop). The Suspicious Suit is in at the Mustache Emporium.']],
  [['narr', 'Honest Hank called: "I got a car for ya. Black. Shiny. Very serious. I call it the Family Sedan."'], ['narr', 'Oleg called: "Oleg will repair your ovens for free. Oleg respects the family."'], ['narr', 'NEWS: A rival gang, the Calzone Cartel, has been seen in the park. "Calzones are just folded pizzas," says local expert.'], ['narr', 'MAFIA REP: Made Men (of Dough). VIP customers, the Family Sedan, free oven repairs, rivals.']],
  [['narr', 'A man in a tiny hat knocks on the hideout door. He is from City Hall.'], ['inspector', 'The city would like to... make an arrangement. Fewer inspections. In exchange for... you know.'], ['you', 'Pizza.'], ['inspector', 'We never had this conversation. (He takes a slice.)'], ['narr', 'MAFIA REP: The Pizza Mafia. Heat cools off much faster.']],
  [['narr', 'THE PIZZA SUMMIT. Every supplier in town arrives at the hideout at once.'], ['cheese', 'We have gathered, partner.'], ['pete', 'The toppings have voted. Pineapple voted twice. Nobody stopped me.'], ['tony', 'You\'re the Don now. Don Pepperoni. It\'s official. We made a hat.'], ['narr', 'MAFIA REP: Legends of the Underground. +$250,000 from the Summit. Every supplier gives you 50% extra.']],
];

export const RIVAL = {
  meet: [['rival', 'Well well well. The famous pizza people.'], ['rival', 'We are the Calzone Cartel. We fold our pizzas. Because we are SOPHISTICATED.'], ['you', 'You fold them because you can\'t make them flat.'], ['rival', '...How dare you. Settle it like gentlemen.']],
  win: [['rival', 'NOOO! Rock beats... how did you know I would pick scissors?!'], ['rival', 'Fine! Take our money! And our dignity! We will FOLD AGAIN!']],
  lose: [['rival', 'HA! Paper covers rock! Just like crust covers... calzone stuff!'], ['rival', 'Today the town belongs to the FOLD. (They strut away.)']],
};
