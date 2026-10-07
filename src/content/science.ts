// "How it works" science cards: one short, accurate explanation per physics concept, plus which
// concepts each part type demonstrates. Pure data, no DOM. Shown in the properties panel for the
// selected part, on the results card ("Physics in your machine") and in Physics Lab intros.
//
// House rules for the text: every statement must be true of real physics. Where the workshop
// simplifies (it is 2D, its pulleys are all fixed, dominoes get a helping hand, wires have no
// return path, motors never run out of strength), the card says so in `inGame` instead of
// pretending otherwise. Keep `body` to 2-4 sentences.

export type ConceptId =
  | 'gravity'
  | 'energy'
  | 'momentum'
  | 'bounce'
  | 'friction'
  | 'lever'
  | 'pulley'
  | 'gears'
  | 'spring'
  | 'air'
  | 'buoyancy'
  | 'heat'
  | 'reaction'
  | 'pressure'
  | 'circuit'
  | 'logic'
  | 'electromagnet'
  | 'robot'
  | 'chain'
  | 'light'
  | 'reflection'
  | 'refraction'
  | 'lens'
  | 'colour'
  | 'light_sensor'
  | 'sound'
  | 'steam'
  | 'balance';

export interface ConceptCard {
  id: ConceptId;
  title: string;
  /** 2-4 sentences. */
  body: string[];
  /** One "try this in the game" line. */
  tryIt: string;
  /** Optional tiny formula, in words. */
  formula?: string;
  /** Optional real-world example. */
  realWorld?: string;
  /** Where the workshop simplifies real physics, said plainly. */
  inGame?: string;
}

const card = (c: ConceptCard) => c;

export const CONCEPTS: Record<ConceptId, ConceptCard> = {
  gravity: card({
    id: 'gravity',
    title: 'Gravity & falling',
    body: [
      'The Earth pulls everything towards its centre, so dropped things speed up as they fall: about 9.8 metres per second faster every second.',
      'Without air in the way, heavy and light things fall at exactly the same rate. Air resistance slows light, spread-out things like feathers the most.',
      'Falling and moving sideways happen independently: a ball knocked off a table hits the floor at the same moment as one that simply drops, just further away.',
    ],
    formula: 'speed gained = g × time   (g ≈ 9.8 m/s²)',
    realWorld: 'In 1971 astronaut David Scott dropped a hammer and a feather on the airless Moon. They landed together.',
    tryIt: 'Drop a rubber ball and a bowling ball side by side from the same height and watch them land almost together.',
  }),
  energy: card({
    id: 'energy',
    title: 'Height, speed & energy',
    body: [
      'Lifting something stores energy in it (potential energy). Let it go and that energy turns into motion (kinetic energy); roll it uphill and the motion turns back into height.',
      'Energy is never made or destroyed, only changed from one form to another. Friction and bumps turn a little of it into heat and sound, so a rolling ball never climbs higher than where it started.',
    ],
    formula: 'height energy = m × g × h      motion energy = ½ × m × v²',
    realWorld: 'A roller coaster’s first hill is its tallest: every later hill has to be lower, because the ride only loses energy on the way.',
    tryIt: 'Start a ball high on a ramp and see how far up a ramp on the other side it climbs.',
  }),
  momentum: card({
    id: 'momentum',
    title: 'Momentum & collisions',
    body: [
      'Momentum is mass times velocity: how much “oomph” a moving thing carries. In a collision the total momentum stays the same, so whatever one object loses, the other gains.',
      'That is why a heavy, fast object is hard to stop and shoves light things aside, while a light object bounces off a heavy one and hardly moves it.',
    ],
    formula: 'momentum = mass × velocity',
    realWorld: 'In a Newton’s cradle, the ball that swings in stops dead and the ball at the far end flies out, carrying the same momentum on.',
    tryIt: 'Roll a rubber ball and then a bowling ball down the same ramp into a crate, and compare how far the crate goes.',
  }),
  bounce: card({
    id: 'bounce',
    title: 'Bouncing & elastic energy',
    body: [
      'When a ball hits the floor it squashes for a split second, storing energy like a spring, then springs back into shape and pushes off.',
      'Some of that energy always turns into heat and sound, so each bounce is lower than the last. How much comes back depends on the material: rubber gives back a lot, a lump of clay almost none.',
    ],
    formula: 'bounce height = e² × drop height   (e = how much of its speed it keeps)',
    realWorld: 'Squash players warm the ball up before a match: a warm squash ball is much bouncier than a cold one.',
    tryIt: 'Drop a rubber ball from high up and watch each bounce come back a little lower, then try the bowling ball.',
  }),
  friction: card({
    id: 'friction',
    title: 'Friction & ramps',
    body: [
      'Friction is the grip between two surfaces that resists sliding. On a slope (an inclined plane), part of an object’s weight pulls it downhill, and the steeper the slope, the bigger that part.',
      'An object stays put until the downhill pull beats friction’s grip. Balls and wheels roll instead of sliding, so they lose very little to friction and roll down slopes a box would sit still on.',
    ],
    formula: 'it slides when tan(slope angle) > μ   (μ = the surfaces’ grip)',
    realWorld: 'Ice has very little grip, which is why cars need much longer to stop on an icy road.',
    inGame: 'Workshop crates can creep slowly down a fairly steep plank before they properly slide, and a hard knock can set one going sooner.',
    tryIt: 'Tilt a plank under a crate a few degrees at a time and find the angle where it starts to slide.',
  }),
  lever: card({
    id: 'lever',
    title: 'Levers & torque',
    body: [
      'A lever is a bar that turns about a pivot, called the fulcrum. How strongly a force turns it is its torque: the force times its distance from the pivot.',
      'A seesaw balances when the torques on its two sides are equal, so a small weight far from the pivot can balance or lift a big weight close to it. The catch is that the small weight has to move a longer way.',
    ],
    formula: 'torque = force × distance from the pivot',
    realWorld: 'A crowbar, a bottle opener and a pair of scissors are all levers that turn a small push into a big one.',
    tryIt: 'Put a heavy crate near the middle of a seesaw and a light ball right at the far end.',
  }),
  pulley: card({
    id: 'pulley',
    title: 'Pulleys & mechanical advantage',
    body: [
      'A rope pulls with the same tension all along its length. A single fixed pulley just changes the direction of that pull: you still pull with the load’s full weight, but you can pull down instead of up, or let a counterweight do it.',
      'Movable pulleys add mechanical advantage. If the rope loops under a pulley fixed to the load, two lengths of rope hold it up, so each pulls with half the weight, but you have to haul twice as much rope.',
    ],
    formula: 'mechanical advantage = number of rope lengths holding up the load',
    realWorld: 'Lifts hang a heavy counterweight on the other side of the wheel from the cabin, so the motor only has to make up the difference.',
    inGame: 'Workshop pulleys are all fixed in place, so here they redirect pulls rather than multiply them.',
    tryIt: 'Rope a crate over a pulley to a bucket and add balls to the bucket until its side wins.',
  }),
  gears: card({
    id: 'gears',
    title: 'Gears & ratios',
    body: [
      'Meshed gears push on each other at their teeth, so their rims move at the same speed: a small gear has to spin faster to keep up with a big one, and every mesh reverses the direction.',
      'A gear driving one three times bigger turns it at a third of the speed, but with three times the turning force. Belts link wheels the same way without reversing them.',
      'In a simple chain of gears, the ones in between only pass the motion on, so just the first and last sizes set the speed.',
    ],
    formula: 'speed ratio = driving gear size ÷ driven gear size',
    realWorld: 'A bicycle’s gears change how many times the back wheel turns for each turn of the pedals.',
    inGame: 'Workshop motors never run out of strength, so here you see the speed change but not the trade in turning force.',
    tryIt: 'Mesh a small gear with a large one and watch which spins faster, and which way each one turns.',
  }),
  spring: card({
    id: 'spring',
    title: 'Springs & trampolines',
    body: [
      'A spring stores energy when you squash or stretch it, and pushes back harder the further it is deformed. Let go and the stored energy comes out as motion, all at once.',
      'A trampoline’s mat and springs stretch as you land, catching you gently, then push you back up. On its own it can only give back the energy you brought (a little less, in fact): jumpers go higher by pushing with their legs at the bottom of each bounce.',
    ],
    formula: 'spring force = stiffness × stretch   (Hooke’s law)',
    realWorld: 'Car suspension, pogo sticks and mattresses all use springs to store and give back energy.',
    inGame: 'The workshop trampoline is helped along: its Springiness setting gives everything at least a set upward kick, like a jumper pushing with their legs.',
    tryIt: 'Drop a ball onto a trampoline from a few different heights and compare the bounces.',
  }),
  air: card({
    id: 'air',
    title: 'Air pressure & fans',
    body: [
      'Air is made of tiny molecules constantly bumping into everything; all those bumps together are air pressure. A fan’s tilted blades shove air forward into a stream that pushes on whatever is in its way.',
      'The same push gives a light thing a big acceleration and a heavy thing a tiny one, so balloons fly off while bowling balls barely notice.',
    ],
    formula: 'acceleration = force ÷ mass   (Newton’s second law)',
    realWorld: 'Sailing boats and wind turbines are pushed by moving air in just the same way.',
    tryIt: 'Point a fan at a balloon, then at a bowling ball, and compare what happens.',
  }),
  buoyancy: card({
    id: 'buoyancy',
    title: 'Buoyancy & balloons',
    body: [
      'Anything in air or water is pushed up by a force equal to the weight of the air or water it pushes aside (Archimedes’ principle).',
      'A helium balloon weighs less than the air it displaces, so the upward push wins and it floats, tugging on its string. Hot-air balloons work the same way: heating the air inside makes it spread out and become lighter than the cooler air around it.',
    ],
    formula: 'upward push = weight of the air (or water) pushed aside',
    realWorld: 'A steel ship floats because its hollow hull pushes aside a lot of water, which weighs more than the ship.',
    tryIt: 'Tie a balloon to a rubber ball, then turn up its Lift until it can carry the ball up.',
  }),
  heat: card({
    id: 'heat',
    title: 'Heat & combustion',
    body: [
      'Burning is a fast chemical reaction: fuel combines with oxygen from the air and gives out energy as heat and light.',
      'A fire needs heat, fuel and oxygen (the fire triangle) and goes out if you take any one away. Heat flows from hot things to cooler ones, which is how a flame lights a fuse, burns through a rope or pops a balloon.',
      'An explosive burns so fast that the hot gas it makes shoves everything nearby away at once.',
    ],
    formula: 'fuel + oxygen → heat + light + gases',
    realWorld: 'Blowing out a candle works by sweeping the flame away from the wick and cooling it down.',
    tryIt: 'Let a candle burn through a rope that is holding something up.',
  }),
  reaction: card({
    id: 'reaction',
    title: 'Action & reaction',
    body: [
      'Every push comes with an equal push back the other way (Newton’s third law).',
      'A rocket shoves hot exhaust out of its tail, and the exhaust shoves the rocket forward. It doesn’t need anything to push against, which is why rockets work in space.',
      'A cannon pushes its ball out and the ball pushes the cannon back: that kick is called recoil.',
    ],
    formula: 'push of A on B = push of B on A, in the opposite direction',
    realWorld: 'Let go of a blown-up balloon without tying it: air rushes out of the neck one way and the balloon zooms off the other.',
    inGame: 'The workshop cannon is bolted down, so you won’t see it recoil.',
    tryIt: 'Light a rocket and watch it fly nose-first, away from its flame.',
  }),
  pressure: card({
    id: 'pressure',
    title: 'Pressure & sharp points',
    body: [
      'Pressure is a force spread over an area. The same push on a tiny point makes an enormous pressure, which is why a cactus spine pops a balloon that a gentle hand could press without bursting.',
      'Spreading a force out does the opposite: snowshoes spread your weight over a big area so you don’t sink.',
    ],
    formula: 'pressure = force ÷ area',
    realWorld: 'A drawing pin is blunt at the end you press and sharp at the end that goes into the wall.',
    tryIt: 'Let a balloon drift into the cactus.',
  }),
  circuit: card({
    id: 'circuit',
    title: 'Electric circuits',
    body: [
      'Electricity is a flow of tiny charged particles (electrons) pushed along by a battery. It only flows round a complete loop: from the battery, through the device, and back again.',
      'Break the loop anywhere and everything stops. A switch is simply a gap you can open and close on purpose.',
    ],
    formula: 'current = voltage ÷ resistance   (Ohm’s law)',
    realWorld: 'A torch is a battery, a switch and a bulb in one loop. Press the switch and you close the gap.',
    inGame: 'Workshop wiring is simplified: one wire carries the power and the return path back to the battery is taken for granted.',
    tryIt: 'Wire a battery to a bulb, then put a pressure plate in between and press it.',
  }),
  logic: card({
    id: 'logic',
    title: 'Switches & logic gates',
    body: [
      'A logic gate turns on/off inputs into an on/off output by a fixed rule. AND is on only when both inputs are on, OR when either is, and NOT flips its input.',
      'Two switches one after the other on the same wire act like AND; two switches side by side act like OR. Computers are built from billions of tiny gates made of transistors.',
    ],
    formula: 'A AND B is on only when A and B are both on',
    realWorld: 'A microwave runs only when the door is shut AND the start button has been pressed.',
    tryIt: 'Wire two pressure plates into a Logic Box set to AND, then press one, and then both.',
  }),
  electromagnet: card({
    id: 'electromagnet',
    title: 'Electromagnets',
    body: [
      'Electric current flowing through a coil of wire makes a magnetic field, and an iron core inside the coil makes it far stronger. Unlike a fridge magnet, it can be switched off.',
      'It pulls iron and steel but ignores rubber, wood, plastic and most other metals, such as aluminium. Electric motors use the same effect: magnets pushing on coils that carry a current make them spin.',
    ],
    formula: 'more turns of wire, or more current = a stronger magnet',
    realWorld: 'Scrapyard cranes lift old cars with a huge electromagnet, then switch it off to drop them.',
    tryIt: 'Power an electromagnet near a bowling ball and a rubber ball, and see which one it grabs.',
  }),
  robot: card({
    id: 'robot',
    title: 'Simple robots & feedback',
    body: [
      'A robot senses something, decides what to do, and acts, over and over again. When the result of what it just did changes what it does next, that loop is called feedback.',
      'Bolt has one very simple rule: walk forward, and if you bump into something solid, turn around.',
    ],
    formula: 'sense → decide → act → repeat',
    realWorld: 'A robot vacuum cleaner bumps into a wall, turns and tries another way. A thermostat switches the heating on when it is cold and off when it is warm.',
    tryIt: 'Put a wall in Bolt’s path and watch him turn round when he reaches it.',
  }),
  chain: card({
    id: 'chain',
    title: 'Chain reactions & energy transfer',
    body: [
      'In a chain reaction, each event sets off the next. Energy stored at each stage (in height, a squashed spring, fuel or a battery) is released when it is triggered, so a tiny nudge at the start can set off something big at the end.',
      'Dominoes are the classic example: each one falls by releasing the energy that was stored when it was stood up, and passes a nudge to the next.',
    ],
    formula: 'small trigger + stored energy → bigger result',
    realWorld: 'A falling domino can knock over one about one and a half times its own size, so a row of growing dominoes can topple a giant.',
    inGame: 'The workshop gives toppling dominoes a small helping hand so chains don’t stall. Real dominoes manage on their own when they are closer together than their height.',
    tryIt: 'Build a long chain of different parts, then count its stages on the results card.',
  }),
  light: card({
    id: 'light',
    title: 'Light travels in straight lines',
    body: [
      'Light travels in straight lines, astonishingly fast (about 300,000 km every second), until something reflects it, bends it or absorbs it.',
      'A laser makes a narrow, tidy beam of a single colour, so you can see exactly where the line goes.',
    ],
    formula: 'speed of light ≈ 300,000 km per second',
    realWorld: 'Shadows form because light can’t curve round the object in its way.',
    tryIt: 'Aim the laser and follow its beam until it hits something.',
  }),
  reflection: card({
    id: 'reflection',
    title: 'Reflection',
    body: [
      'When light hits a smooth, shiny surface it bounces off like a ball off a wall: it leaves at the same angle it arrived at.',
      'Rough surfaces reflect light too, but scatter it every which way, which is why paper isn’t a mirror. A beam splitter is a half-silvered mirror: it reflects some of the light and lets the rest straight through.',
    ],
    formula: 'angle in = angle out',
    realWorld: 'A periscope uses two angled mirrors to see over a wall.',
    tryIt: 'Tilt a mirror a little at a time and watch where the reflected beam goes.',
  }),
  refraction: card({
    id: 'refraction',
    title: 'Refraction & prisms',
    body: [
      'Light slows down when it passes from air into glass or water, and if it goes in at an angle it bends.',
      'Different colours bend by slightly different amounts, so a prism fans white light out into a rainbow.',
    ],
    formula: 'the bigger the change in speed, the bigger the bend   (Snell’s law)',
    realWorld: 'A straw in a glass of water looks broken at the surface, and raindrops act as tiny prisms to make rainbows.',
    tryIt: 'Shine a beam into a prism at different angles and watch how much it bends.',
  }),
  lens: card({
    id: 'lens',
    title: 'Lenses',
    body: [
      'A lens is a piece of curved glass that bends light by different amounts across its surface.',
      'A convex lens (thicker in the middle) brings parallel rays together at a focal point; a concave lens (thinner in the middle) spreads them apart.',
    ],
    formula: '1/f = 1/(object distance) + 1/(image distance)   (f = focal length)',
    realWorld: 'Glasses, cameras and magnifying glasses all use lenses. A magnifying glass can focus sunlight into a spot hot enough to scorch paper.',
    tryIt: 'Put a lens in a beam and find where the light comes together.',
  }),
  colour: card({
    id: 'colour',
    title: 'Colour & filters',
    body: [
      'White light is a mix of all the colours. A coloured filter lets its own colour through and absorbs the rest.',
      'So a red filter passes red light, but a blue beam barely gets through it at all.',
    ],
    formula: 'what you see = the colours that get through',
    realWorld: 'Stage lights use coloured filters called gels to tint a white lamp.',
    tryIt: 'Put a filter in a beam and see which colours make it through.',
  }),
  light_sensor: card({
    id: 'light_sensor',
    title: 'Light sensors',
    body: [
      'A light sensor turns light into an electrical signal. In a photodiode or a solar cell, light frees electrons in the material so a current can flow: the brighter the light, the bigger the current.',
      'Feed that signal into a switch or a logic gate and light can control a machine.',
    ],
    formula: 'more light → more current',
    realWorld: 'Street lights switch on by themselves at dusk, and burglar alarms trip when someone breaks an invisible beam.',
    tryIt: 'Point a beam at a light sensor and wire the sensor to a bulb.',
  }),
  sound: card({
    id: 'sound',
    title: 'Sound',
    body: [
      'Sound is a vibration that travels through the air as a wave of squashed and stretched air. In air it covers about 343 metres every second.',
      'Faster vibrations sound higher in pitch and bigger ones sound louder. Sound spreads out as it travels, so it gets quieter the further away you are.',
    ],
    formula: 'speed of sound in air ≈ 343 m/s',
    realWorld: 'Count the seconds between a lightning flash and its thunder, then divide by three: that is roughly how many kilometres away the storm is.',
    inGame: 'In the workshop a sound reaches everything within earshot at once, and each noisy part has a fixed earshot.',
    tryIt: 'Drop a rubber chicken near a sleeping cat, then move the cat further away and try again.',
  }),
  steam: card({
    id: 'steam',
    title: 'Boiling & steam',
    body: [
      'Heat water to 100 °C (at sea level) and it boils into steam, an invisible gas that takes up about 1,700 times more room than the water did.',
      'All that extra gas has to go somewhere. Squeezed through a narrow spout it rushes out fast enough to whistle and push things.',
    ],
    formula: '1 cup of water → about 1,700 cups of steam',
    realWorld: 'A kettle whistle is just steam forced through a small hole, and the same push once drove steam trains and ships.',
    inGame: 'The teapot boils after about a second and a half over a flame and keeps steaming for a few seconds after the heat goes. A real kettle takes minutes.',
    tryIt: 'Set a teapot over a candle and put a balloon in front of its spout.',
  }),
  balance: card({
    id: 'balance',
    title: 'Balance & toppling',
    body: [
      'Every object acts as if all its weight sits at one point, its centre of gravity.',
      'It stays upright while that point is above its base. Tip it far enough that the point passes beyond the edge of the base and it falls over.',
      'Tall, narrow things like bowling pins need only a small tip to topple.',
    ],
    formula: 'stays up while the centre of gravity is over the base',
    realWorld: 'Racing cars are built low and wide so they do not roll over in fast corners.',
    inGame: 'Pins get a small helping nudge, so a struck row topples like real pins instead of sliding along as one block.',
    tryIt: 'Roll a bowling ball into a row of bowling pins.',
  }),
};

/**
 * Which concepts each part (or connection tool) demonstrates, most important first. Unknown or
 * future types simply have no card. The optics ids cover the planned optics family.
 */
export const PART_CONCEPTS: Record<string, ConceptId[]> = {
  ball: ['bounce', 'gravity'],
  bowling_ball: ['momentum', 'gravity'],
  crate: ['friction', 'momentum'],
  domino: ['chain', 'gravity'],
  plank: ['friction'],
  seesaw: ['lever'],
  trampoline: ['spring', 'bounce'],
  bucket: ['gravity', 'pulley'],
  hook: ['pulley'],
  pulley: ['pulley'],
  rope: ['pulley'],
  gear: ['gears'],
  belt: ['gears'],
  motor: ['electromagnet', 'gears'],
  conveyor: ['friction'],
  fan: ['air'],
  balloon: ['buoyancy', 'pressure'],
  magnet: ['electromagnet'],
  candle: ['heat'],
  rocket: ['reaction', 'heat'],
  cannon: ['reaction', 'momentum'],
  cannonball: ['momentum'],
  dynamite: ['heat', 'chain'],
  boxing_glove: ['spring', 'momentum'],
  cactus: ['pressure'],
  battery: ['circuit'],
  wire: ['circuit'],
  light_bulb: ['circuit'],
  toggle_switch: ['circuit', 'logic'],
  pressure_plate: ['circuit', 'logic'],
  timer: ['logic'],
  logic_gate: ['logic'],
  robot: ['robot'],
  // optics family (ids as planned; harmless if absent)
  laser: ['light'],
  mirror: ['reflection'],
  splitter: ['reflection'],
  beam_splitter: ['reflection'],
  prism: ['refraction'],
  lens: ['lens'],
  filter: ['colour'],
  color_filter: ['colour'],
  colour_filter: ['colour'],
  light_sensor: ['light_sensor'],
  basketball: ['bounce', 'gravity'],
  basketball_hoop: ['gravity', 'bounce'],
  rubber_chicken: ['sound', 'bounce'],
  mousetrap: ['spring', 'lever'],
  toaster: ['spring', 'heat', 'circuit'],
  toast: ['heat'],
  teapot: ['steam', 'heat'],
  bowling_pin: ['balance', 'momentum'],
  cat: ['sound'],
  bell: ['sound', 'circuit'],
};

export const conceptsForType = (type: string): ConceptCard[] => (PART_CONCEPTS[type] ?? []).map((id) => CONCEPTS[id]);
export const getConcept = (id: string): ConceptCard | undefined => (id in CONCEPTS ? CONCEPTS[id as ConceptId] : undefined);
