# Pizza Underground

Pizza has been banned. Nobody knows why. You and your friends decide to become the town's biggest illegal pizza business.

A low-poly co-op comedy for 1-4 players, in the browser.

- It starts in the car: a crappy delivery car, Dez riding shotgun, a pizza for City Hall, two minutes late. Then a limo. Then the hospital, where the doctor has good news and bad news, and Dez is stuck in a wall.
- Crumbville: a town square with a statue of the mayor, City Hall, the hospital, the police station, a gas station, shops, dead pizzerias, back alleys, houses, a cardboard factory, a junkyard, a park and a forest. Signs everywhere: PIZZA IS ILLEGAL. REPORT SUSPICIOUS CHEESE ACTIVITY.
- A suspicious man in a trench coat pays you $15,000 for one pizza. Find the abandoned shoe repair shop, clean it, hit the fuse box until it works, buy an oven from Oleg ("for bread"), buy ingredients from underground suppliers (half of them are toppings: Tomato Tony, Big Cheese, Sal Ami, Pineapple Pete...) and watch out for Legit Larry.
- Cook for real: dough from the tub, flatten it (hold E), sauce/cheese/toppings with 1-7, bake it, take it out when it's golden, box it. Burn it, over-cheese it until it explodes, let the grease build up until the oven catches fire, and watch the fire spread across the kitchen while another order waits.
- Orders arrive on your phone (TAB). Some customers are undercover cops. Their messages are not subtle.
- The police patrol the sidewalks and drive the streets. Get seen with pizza and their suspicion meter fills. Run, break line of sight, hide in a dumpster, or hold X to act natural. Inspectors raid the hideout - hide the evidence in the "DEFINITELY SHOES" fridge.
- Random events: THE INSPECTOR IS COMING, YOUR OVEN IS ON FIRE, A CUSTOMER ORDERED 100 PIZZAS, THE CHEESE SUPPLIER IS MISSING, A POLICE CAR IS OUTSIDE, SOME IDIOT POSTED YOUR LOCATION ONLINE, and new pizza laws nobody understands.
- Grow the hideout from a tiny kitchen to a secret basement, an underground factory and a pizza empire. Hire a cook and a driver, buy cameras, sprinklers, a hidden entrance, disguises and better vehicles (an ice cream truck is the perfect cover).
- Find the eight clues and work out why pizza was banned. It's worse than you think. And stupider.
- Co-op for up to four players over WebRTC (PeerJS): host a room, share the five-letter code. One kitchen, one purse, one heat meter.
- The dialogue swears (it's for teenagers). Tick "Bleep the swearing" on the title screen or in the pause menu to turn it into #$%&!.

Everything - the town, the characters, the toppings, the cars, the signs and every sound - is generated in code. No asset files.

Controls: WASD move, Shift run, Space jump, mouse look, wheel zoom, E interact (hold for some things), R second action, Q throw away, X act natural, 1-7 toppings, F car, H honk, TAB phone, M map, T chat, ESC pause, LMB spray an extinguisher.

Run it: serve the folder with any static server (`python -m http.server`) and open it. After changing any .js file run `node tools/stamp.mjs` so browsers fetch the new code.

Tests: `/?script=all`, `/?script=input` (results drawn on screen), `/_nettest.html` (two players in one page), `/?skip=11&shot=hideout` (jump into the story).
