/* The Tell-Tale Heart: an interactive investigation
   All game logic lives here: room objects, the interview, progression,
   endings, restarting and sound.

   The investigation follows six clues in a fixed order: door, lantern, eye,
   shutters, bed, floorboards. Only the outlined clue can be clicked. After
   each of the man's answers the player chooses to believe him or confront
   him. Confront him enough and the floorboards give him away. Believe him
   too often, or leave the house, and the case goes unsolved. */

// The clues in the only order they can be examined
const LEADS = [`door`, `lantern`, `eye`, `shutters`, `bed`, `floorboards`];
const INTERVIEW_LEADS = 5; // every clue before the floorboards has a question
const CONFRONTATIONS_TO_SOLVE = 3;
const LETTERS = [`A`, `B`]; // labels for the options in a choice

// Everything the game remembers. Nothing is saved between visits:
// refreshing the page starts a new game.
function freshState() {
  return {
    scene: `arrival`,
    lead: 0,            // index in LEADS of the clue to examine next
    clues: [],          // objects examined
    asked: [],          // clues whose question has been asked
    answers: {},        // clue id: "believe" or "confront"
    floorboardsOpened: false,
    heartbeat: 0,       // heartbeat steps completed
    heartbeatAsks: 0,   // times you asked him what he hears
    confessed: false,
    moodShown: ``       // the last mood line shown, so it is not repeated
  };
}

let state = freshState();
let lastPanel = null;

/* ---------- Story content ---------- */

// "thought" is what your character makes of each clue.
const OBJECTS = {
  door: {
    name: `The Bedroom Door`,
    shortName: `the bedroom door`,
    description: [
      `The latch turns without a sound. Someone has oiled the hinges, and recently. The man watches you while you examine it.`
    ],
    thought: `Someone wanted to come and go from this room at night without waking the old man.`
  },
  lantern: {
    name: `The Lantern`,
    shortName: `the lantern`,
    description: [
      `A dark lantern rests on a stool by the wall. Its tin shutter is almost closed, so only a narrow beam of light can escape.`,
      `The metal is still warm, though the man says the whole house has been asleep.`
    ],
    thought: `Someone has been using this lantern tonight, and keeping its light very small.`
  },
  eye: {
    name: `The Painted Eye`,
    shortName: `the painted eye`,
    description: [
      `A painting of a single eye hangs on the wall near the bed. The eye is pale blue and clouded over with a thin film, like a vulture's.`,
      `It was painted with great care, as if by someone who had stared at it for a long time. The man will not turn to look at it.`
    ],
    thought: `Someone was fixated on this one eye, and the man is afraid of it.`
  },
  shutters: {
    name: `The Shutters`,
    shortName: `the shutters`,
    description: [
      `The shutters are fastened with a heavy iron bar. No light from the street can get in. Even with your own lamp, the corners of the room stay dark.`
    ],
    thought: `With these shut, no one outside could have seen what happened in this room at night.`
  },
  bed: {
    name: `The Bed`,
    shortName: `the bed`,
    description: [
      `The bed has been made with great care. The blanket is pulled tight and the pillow is smooth.`,
      `Its heavy frame has scraped pale lines into the floor, as if it was dragged away and pushed back.`
    ],
    thought: `The bed was moved tonight and carefully put back. Something happened here.`
  },
  floorboards: {
    name: `The Floorboards`,
    shortName: `the floorboards`,
    description: [
      `Three of the boards near the bed sit a little higher than the rest. Their nails look new.`
    ],
    thought: `These boards were lifted and nailed back down, and not long ago.`
  }
};

// One question per clue. A reply mixes the man's spoken lines ("him")
// with what you observe ("p"). Confronting him uses what the clue revealed.
const INTERVIEWS = {
  door: {
    question: `Why does this door need to open so quietly?`,
    reply: [
      { type: `him`, text: `He is a light sleeper. I look in on him, that is all. Every morning I go in and ask how he passed the night.` }
    ],
    believe: [
      { type: `p`, text: `You nod and make a note. A careful man, looking after an old one. He smiles, relieved.` }
    ],
    confrontLabel: `Confront him: "Then why oil the hinges?"`,
    confront: [
      { type: `you`, text: `If you only visit in the morning, why oil the hinges? Oiled hinges are for the night.` },
      { type: `him`, text: `He complained of the creak. That is all.` },
      { type: `p`, text: `He answered too quickly.` }
    ]
  },
  lantern: {
    question: `Why would you need a lantern in this room?`,
    reply: [
      { type: `him`, text: `For the stairs.` },
      { type: `him`, text: `And for him. I open it only a little. A single thin ray is enough to see by.` }
    ],
    believe: [
      { type: `p`, text: `It is a dark house, after all. He smiles, as if that should settle things.` }
    ],
    confrontLabel: `Confront him: "Who was using it tonight?"`,
    confront: [
      { type: `you`, text: `The metal is still warm. Who was using this lantern tonight?` },
      { type: `him`, text: `I was. I looked in on him. Only a thin ray, so as not to wake him.` },
      { type: `p`, text: `He has just admitted to standing over a sleeping man in the dark.` }
    ]
  },
  eye: {
    question: `Whose eye is in this painting?`,
    reply: [
      { type: `p`, text: `He will not turn around.` },
      { type: `him`, text: `Nobody's. It is only a painting. The old man had weak eyes, that is all.` },
      { type: `p`, text: `He hears his own words and corrects himself.` },
      { type: `him`, text: `Has. He has weak eyes.` }
    ],
    believe: [
      { type: `p`, text: `A slip of the tongue. Anyone could make one. He lets out a long breath.` }
    ],
    confrontLabel: `Confront him: "Why did you say 'had'?"`,
    confront: [
      { type: `you`, text: `You said he had weak eyes. Why talk about him as if he were gone?` },
      { type: `him`, text: `A slip. He is in the country. I told you.` },
      { type: `p`, text: `His hands are shaking. He still will not look at the painting.` }
    ]
  },
  shutters: {
    question: `Why are the shutters barred from inside?`,
    reply: [
      { type: `him`, text: `Robbers. He has always been afraid of robbers. He likes the room as black as pitch.` },
      { type: `p`, text: `He glances at the window, and then, for no reason you can see, at the floor.` }
    ],
    believe: [
      { type: `p`, text: `An old man afraid of thieves. It is common enough. You make a note.` }
    ],
    confrontLabel: `Confront him: "Then who barred them tonight?"`,
    confront: [
      { type: `you`, text: `The old man has gone to the country, you said. Then who barred these shutters from the inside tonight?` },
      { type: `him`, text: `I did. I always do. Robbers, as I told you.` },
      { type: `p`, text: `So he was alone in this room tonight, in the dark, with the shutters barred.` }
    ]
  },
  bed: {
    question: `When did you last see the old man?`,
    reply: [
      { type: `him`, text: `Last evening. He has gone to the country. He goes every year about this time.` },
      { type: `p`, text: `He reaches over and smooths the blanket, though it is already smooth.` }
    ],
    believe: [
      { type: `p`, text: `It is a simple enough story. You write it down.` }
    ],
    confrontLabel: `Confront him: "Then who screamed?"`,
    confront: [
      { type: `you`, text: `If the old man left last evening, whose scream did the neighbour hear?` },
      { type: `him`, text: `Mine. I had a dream. I have terrible dreams.` },
      { type: `p`, text: `He laughs, and keeps laughing a moment too long.` }
    ]
  }
};

// The heartbeat: what he does and says each time you wait or ask
const HEARTBEAT = [
  {
    scene: `He presses a hand to his ear. His breathing is quick and shallow.`,
    line: `A low, dull, quick sound. Like a watch wrapped in cotton. Surely you hear it.`
  },
  {
    scene: `He is pacing now, with heavy steps over the boards, talking faster and louder to drown the sound out.`,
    line: `Louder! It is getting louder! Why do you stand there smiling?`
  },
  {
    scene: `He is shouting now. To him the sound is deafening. To you, the room is completely silent.`,
    line: `You hear it. You must! You are only pretending, to torment me!`
  }
];

// The ask option changes each time so it never reads as the same choice twice
const ASK_LABELS = [`Ask what he hears`, `Ask what he hears again`, `Ask what he hears a third time`];

const ENDINGS = {
  solved: {
    heading: `Case Closed`,
    opening: [
      `It is still dark when they lead him out of the house. Even now, he insists he is not mad. The care he took, he says, proves it.`
    ],
    closing: `No one else ever heard that heartbeat. It was enough to make him confess.`
  },
  unsolved: {
    heading: `Case Unsolved`,
    opening: [
      `You thank him for his time and step out into the dark street. The door closes softly behind you. Your report will say that nothing was found.`,
      `Upstairs, beneath the floor of the old man's room, something is still waiting to be found.`
    ],
    closing: `This time, you left before the sound grew loud enough to break him.`
  }
};

const WHAT_HAPPENED = [
  `The man lived in the house and looked after the old man. He says he loved him. The old man had never wronged him, and he did not want his money. The problem was one of the old man's eyes. It was pale blue and clouded over with a thin film, like a vulture's, and whenever it looked at him, his blood ran cold.`,
  `He became obsessed with that eye, and decided to kill the old man so he would never have to see it again. The painting on the bedroom wall is of that same eye.`,
  `For seven nights he crept to the bedroom door at midnight and shone a thin ray of lantern light onto the old man's eye. It was always closed, and he could not bring himself to act. On the eighth night it was open. He killed the old man, hid the body beneath the floorboards, and put everything back in order.`,
  `When you arrived with the police, he was so sure of himself that he led you to the very room. Then he began to hear a heartbeat beneath the floor.`
];

/* ---------- Element references ---------- */

const header = document.getElementById(`site-header`);
const scenes = {
  arrival: document.getElementById(`scene-arrival`),
  room: document.getElementById(`scene-room`),
  ending: document.getElementById(`scene-ending`)
};
const roomFrame = document.getElementById(`room-frame`);
const panel = document.getElementById(`panel`);
const panelBody = document.getElementById(`panel-body`);
const leaveBtn = document.getElementById(`leave-btn`);
const soundBtn = document.getElementById(`sound-btn`);
const restartBtn = document.getElementById(`restart-btn`);
const restartConfirm = document.getElementById(`restart-confirm`);
const howTo = document.getElementById(`how-to`);
const houseFrame = document.querySelector(`.house-frame`);
const houseDoor = document.getElementById(`house-door`);
const hotspots = document.querySelectorAll(`#room-frame .hotspot`);

/* ---------- State helpers ---------- */

function hasClue(id) {
  return state.clues.includes(id);
}

function addClue(id) {
  if (!hasClue(id)) state.clues.push(id);
}

function currentLead() {
  return LEADS[state.lead];
}

function confrontCount() {
  return Object.values(state.answers).filter(answer => answer === `confront`).length;
}

// The man has talked his way out: every question answered, too few confronted
function isDeadEnd() {
  return state.lead >= INTERVIEW_LEADS && confrontCount() < CONFRONTATIONS_TO_SOLVE;
}

// Every questioned clue answered with enough confrontations: the floorboards are next
function floorUnlocked() {
  return state.lead >= INTERVIEW_LEADS && !isDeadEnd();
}

// Called after every change to the state so the room and sound stay in step
function commit() {
  renderRoom();
  updateSound();
}

/* ---------- Scenes ---------- */

function showScene(name) {
  scenes.arrival.hidden = name !== `arrival`;
  scenes.room.hidden = name !== `room`;
  scenes.ending.hidden = name !== `ending`;
  header.hidden = name === `arrival`;

  // The story opens and closes outside the house: the same illustration
  // moves between the arrival and ending screens, with the door inactive at the end.
  // SVG elements have no .hidden property, so the door's attribute is set directly.
  if (name === `arrival`) {
    scenes.arrival.insertBefore(houseFrame, scenes.arrival.querySelector(`.panel`));
    houseDoor.removeAttribute(`hidden`);
    document.getElementById(`arrival-title`).focus({ preventScroll: true });
  }
  if (name === `ending`) {
    scenes.ending.prepend(houseFrame);
    houseDoor.setAttribute(`hidden`, ``);
    document.getElementById(`ending-title`).focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}

function startGame() {
  howTo.close();
  state.scene = `room`;
  commit();
  showScene(`room`);
  updatePanel({
    heading: `The Old Man's Bedroom`,
    blocks: [
      { type: `p`, text: `The man says he lives here and looks after the old man. He has already walked you through every room in the house. Last of all, he leads you upstairs to the old man's bedroom, to show you that nothing has been taken and nothing is out of place.` },
      { type: `him`, text: `His room, just as he left it. Search well. You will find everything in order.` },
      { type: `p`, text: `The three officers wait downstairs. You decide to take a closer look, starting with the bedroom door you just came through.` }
    ]
  }, `quiet`);
}

/* ---------- Room interactions ---------- */

function inspectObject(id) {
  // Only the outlined object responds; every other object is locked
  if (id !== activeObject()) return;

  if (state.floorboardsOpened) return updatePanel(heartbeatPanel());
  if (id === `floorboards`) return inspectFloorboards();

  addClue(id);
  commit();
  if (state.asked.includes(id)) return showConversation(id, true);
  showClue(id);
}

// The one object that can be clicked right now, or null
function activeObject() {
  if (state.confessed || isDeadEnd()) return null;
  return state.floorboardsOpened ? `floorboards` : currentLead();
}

// Step 1 of a clue: what you notice, and the question you can ask him
function showClue(id) {
  updatePanel({
    heading: OBJECTS[id].name,
    blocks: describe(id),
    actions: [{ label: `Ask: "${INTERVIEWS[id].question}"`, kind: `question`, onClick: () => askQuestion(id) }],
    back: undoIfPossible()
  });
}

// Back from a choice: return to the room without choosing anything
function stepBack(text, hint) {
  updatePanel({
    heading: `The Old Man's Bedroom`,
    blocks: [{ type: `p`, text }],
    hint,
    back: undoIfPossible()
  });
}

function describe(id) {
  const blocks = OBJECTS[id].description.map(text => ({ type: `p`, text }));
  blocks.push({ type: `thought`, text: OBJECTS[id].thought });
  return blocks;
}

function askQuestion(id) {
  if (!state.asked.includes(id)) state.asked.push(id);
  commit();
  showConversation(id);
}

function conversationBlocks(id) {
  const interview = INTERVIEWS[id];
  const blocks = [{ type: `you`, text: interview.question }].concat(interview.reply);

  // About the bed he contradicts what the lantern showed, worded to match how you handled it
  if (id === `bed`) {
    const slip = state.answers.lantern === `confront`
      ? `He slipped again. He told you he looked in on the old man by lantern light tonight. How, if the old man left last evening?`
      : `Something does not fit. The lantern was still warm. Who was he lighting it for tonight, if the old man left last evening?`;
    blocks.push({ type: `thought`, text: slip });
  }
  return blocks;
}

// Step 2 of a clue: his answer on its own. Next unlocks once it has finished appearing.
// still: show it without replaying the lines, e.g. when coming back to it
function showConversation(id, still = false) {
  updatePanel({
    heading: OBJECTS[id].name,
    blocks: conversationBlocks(id),
    back: () => showClue(id),
    next: () => showAnswer(id),
    still
  });
}

// Step 3 of a clue: the same answer, now with the choice to believe or confront him
function showAnswer(id) {
  const interview = INTERVIEWS[id];
  updatePanel({
    heading: OBJECTS[id].name,
    blocks: conversationBlocks(id),
    actions: [
      { label: interview.confrontLabel, kind: `question`, onClick: () => decide(id, `confront`) },
      { label: `Believe him`, kind: `question`, onClick: () => decide(id, `believe`) }
    ],
    back: () => showConversation(id, true),
    choosing: true,
    still: true
  });
}

function decide(id, answer) {
  state.answers[id] = answer;
  state.lead += 1;
  commit();

  const blocks = INTERVIEWS[id][answer].slice(); // a copy, so the story data is not changed
  let actions = [];

  // After the last question: either the floorboards give him away, or he has talked his way out
  if (state.lead === INTERVIEW_LEADS) {
    if (isDeadEnd()) {
      blocks.push(
        { type: `p`, text: `You look around the room once more. His answers mostly hold together, and you have nothing left to question him about.` },
        { type: `him`, text: `You see? Everything in order. I will show you out.` }
      );
      actions = [{ label: `Thank him and leave`, kind: `primary`, onClick: () => endGame(`unsolved`) }];
    } else {
      blocks.push({ type: `p`, text: `As he talks, he shifts his weight and a board near the bed creaks. His eyes drop to it before he can stop himself.` });
    }
  }

  updatePanel({ heading: OBJECTS[id].name, blocks, actions, back: undoIfPossible() });
}

function inspectFloorboards() {
  addClue(`floorboards`);
  commit();
  updatePanel({
    heading: `The Floorboards`,
    blocks: describe(`floorboards`).concat([
      { type: `p`, text: `When you press on the middle plank, it moves under your hand.` },
      { type: `him`, text: `There is nothing there.` },
      { type: `p`, text: `Nobody asked him.` },
      { type: `sound` }
    ]),
    actions: [
      { label: `Lift the loose board`, kind: `question`, onClick: liftBoards },
      { label: `Believe him and leave the boards alone`, kind: `question`, onClick: () => endGame(`unsolved`) }
    ],
    back: () => stepBack(`You step back from the boards. He lets out a slow breath.`),
    choosing: true
  });
}

function liftBoards() {
  state.floorboardsOpened = true;
  commit();
  updatePanel({
    heading: `Beneath the Floor`,
    blocks: [
      { type: `p`, text: `The plank comes up more easily than it should. Beneath it, between the beams, is a narrow dark space and the edge of something wrapped in cloth.` },
      { type: `him`, text: `Mice. He always complained of mice.` },
      { type: `p`, text: `He says it much too loudly. Then he stops and tilts his head.` },
      { type: `him`, text: `Do you hear that?` },
      { type: `p`, text: `You listen. You hear nothing at all.` },
      { type: `thought`, text: `He is hearing something that is not there.` }
    ],
    actions: heartbeatActions(),
    back: backFromHeartbeat,
    choosing: true
  });
}

/* ---------- Heartbeat stage ---------- */

function heartbeatActions() {
  if (state.heartbeat >= HEARTBEAT.length) {
    return [{ label: `Wait for him to speak`, kind: `primary`, onClick: confess }];
  }
  return [
    { label: ASK_LABELS[state.heartbeatAsks], kind: `question`, onClick: () => heartbeatStep(`ask`) },
    { label: `Say nothing and watch him`, kind: `question`, onClick: () => heartbeatStep(`silence`) }
  ];
}

function backFromHeartbeat() {
  stepBack(`You step away from the open boards. He is still listening.`, `Click the floorboards to face him again.`);
}

function heartbeatPanel() {
  const blocks = state.heartbeat > 0
    ? [{ type: `p`, text: HEARTBEAT[state.heartbeat - 1].scene }]
    : [{ type: `p`, text: `The loose board lies beside the gap. He keeps tilting his head, listening.` }];
  return { heading: `The Heartbeat`, blocks, actions: heartbeatActions(), back: backFromHeartbeat, choosing: true };
}

function heartbeatStep(choice) {
  const step = HEARTBEAT[state.heartbeat];
  state.heartbeat += 1;
  if (choice === `ask`) state.heartbeatAsks += 1;
  commit();

  const blocks = choice === `ask`
    ? [{ type: `you`, text: `What do you hear?` }]
    : [{ type: `p`, text: `You say nothing. You only watch him.` }];
  blocks.push({ type: `p`, text: step.scene }, { type: `him`, text: step.line });
  if (state.heartbeat >= HEARTBEAT.length) {
    blocks.push({ type: `p`, text: `He cannot stand still. He looks from the floor to you, and back to the floor.` });
  }
  updatePanel({ heading: `The Heartbeat`, blocks, actions: heartbeatActions(), back: backFromHeartbeat, choosing: true });
}

function confess() {
  state.confessed = true;
  commit();
  updatePanel({
    heading: `The Confession`,
    blocks: [
      { type: `p`, text: `He drops to his knees beside the open boards and screams at you.` },
      { type: `him`, text: `Stop pretending! You can hear it! I admit it, I did it! Tear up the planks! Here, here! It is the beating of his hideous heart!` },
      { type: `p`, text: `The officers come running up the stairs. Together you lift the remaining planks. The old man never went to the country. He has been here, beneath the floor, the whole time.` }
    ],
    actions: [{ label: `Close the case`, kind: `primary`, onClick: () => endGame(`solved`) }]
  });
}

/* ---------- Going back ---------- */

// Back on a screen with no choice waiting undoes the most recent choice
// (lifting the board, or believing or confronting him about a clue), after a
// heads-up screen. Before the first choice there is nothing to undo.
function undoIfPossible() {
  const madeAChoice = state.floorboardsOpened || state.lead > 0;
  return madeAChoice ? confirmUndo : null;
}

function lastChoiceText() {
  if (state.floorboardsOpened) return `you lifted the loose board.`;
  const id = LEADS[state.lead - 1];
  const verb = state.answers[id] === `confront` ? `confronted him` : `believed him`;
  return `you ${verb} about ${OBJECTS[id].shortName}.`;
}

// The heads-up screen; "Stay here" returns to the screen you were on
function confirmUndo() {
  renderPanel({
    heading: `Go Back?`,
    blocks: [
      { type: `p`, text: `This will undo your last choice: ${lastChoiceText()}` },
      { type: `p`, text: `You will return to that moment and can choose again.` }
    ],
    actions: [
      { label: `Yes, go back`, kind: `question`, onClick: undoLastChoice },
      { label: `Stay here`, kind: `question`, onClick: () => renderPanel(lastPanel) }
    ],
    choosing: true
  });
}

function undoLastChoice() {
  if (state.floorboardsOpened) {
    state.floorboardsOpened = false;
    state.heartbeat = 0;
    state.heartbeatAsks = 0;
    inspectFloorboards();
    return;
  }
  const id = LEADS[state.lead - 1];
  delete state.answers[id];
  state.lead -= 1;
  commit();
  showAnswer(id);
}

/* ---------- Leaving and endings ---------- */

function askToLeave() {
  renderPanel({
    heading: `Leave the House?`,
    blocks: [
      { type: `p`, text: `The man is already holding the door for you, smiling.` },
      { type: `him`, text: `I hope you are satisfied. Everything is in order.` }
    ],
    actions: [
      { label: `Thank him and leave`, kind: `question`, onClick: () => endGame(`unsolved`) },
      { label: `Keep searching`, kind: `question`, onClick: () => renderPanel(lastPanel) }
    ],
    choosing: true
  });
}

function endGame(outcome) {
  state.scene = `ending`;
  commit();
  renderEnding(outcome);
  showScene(`ending`);
}

// outcome: "solved" or "unsolved"
function renderEnding(outcome) {
  const ending = ENDINGS[outcome];
  document.getElementById(`ending-title`).textContent = ending.heading;
  const body = document.getElementById(`ending-body`);
  body.innerHTML = ``;
  ending.opening.forEach(text => body.append(makeP(text)));
  const h3 = document.createElement(`h3`);
  h3.textContent = `What Really Happened`;
  body.append(h3);
  WHAT_HAPPENED.forEach(text => body.append(makeP(text)));
  body.append(makeP(ending.closing));
}

/* ---------- Guidance ---------- */

// A sentence of narration that shows the man getting more nervous as you
// confront him, before the heartbeat starts
function getDemeanour() {
  if (state.floorboardsOpened) return ``;
  if (floorUnlocked()) return `He has gone pale, and keeps tilting his head as if listening for something you cannot hear.`;
  if (confrontCount() > 0) return `Now and then, you notice his eyes drift to the floor.`;
  return ``;
}

// Why Next is locked: it only unlocks once you have done what the screen
// asks, and it never moves you on to another object
function nextLockReason(content) {
  if (content.choosing) return `Make a choice first.`;
  const lead = currentLead();
  const name = OBJECTS[lead].shortName;
  if (!hasClue(lead)) return `Click ${name}, outlined in the room.`;
  if (lead === `floorboards`) return `Decide what to do about ${name} first.`;
  return `Ask him about ${name} first.`;
}

/* ---------- Narrative panel ---------- */

// Every screen in the room is described by a content object:
//   heading   the panel title
//   blocks    lines of story: { type, text }, where type is p, him, you, thought or sound
//   actions   buttons: { label, kind, onClick }
//   back      what Back does (leave it out for no Back button)
//   next      what Next does once it unlocks (leave it out to keep Next locked)
//   hint      small guidance text at the bottom
//   choosing  true when the player has to pick one of the actions
//   still     true to show the conversation without replaying it line by line
// focus: "scroll" (the default) moves focus to the heading and scrolls the panel
// into view if it is off screen; "quiet" moves focus without scrolling, for when a scene opens.
// updatePanel remembers the screen so "Stay here" and "Keep searching" can return to it.
// The Go Back and Leave questions call renderPanel directly, so they are not remembered.
function updatePanel(content, focus) {
  lastPanel = content;
  renderPanel(content, focus);
}

function renderPanel(content, focus = `scroll`) {
  panelBody.innerHTML = ``;

  const h2 = document.createElement(`h2`);
  h2.id = `panel-heading`;
  h2.tabIndex = -1;
  h2.textContent = content.heading;
  panelBody.append(h2);

  // The man's mood is part of the story: it joins the narration that ends a
  // screen, never a line in the middle of a conversation or a clue description.
  // Each mood line shows once, on the first screen after his mood changes.
  const blocks = content.blocks.slice();
  const demeanour = content.choosing ? `` : getDemeanour();
  const last = blocks[blocks.length - 1];
  if (demeanour && demeanour !== state.moodShown && last && last.type === `p`) {
    blocks[blocks.length - 1] = { type: `p`, text: `${last.text} ${demeanour}` };
    state.moodShown = demeanour;
  }

  // Once the conversation starts, each line pops in 0.35 seconds after the one before it
  let popping = false;
  let delay = 0;
  blocks.forEach(block => {
    const el = renderBlock(block);
    if (!content.still && (block.type === `him` || block.type === `you`)) popping = true;
    if (popping) {
      el.classList.add(`pop`);
      el.style.animationDelay = `${delay}s`;
      delay += 0.35;
    }
    panelBody.append(el);
  });

  const actions = content.actions || [];
  // Two or more buttons are a decision: label them as lettered options
  const isChoice = actions.length > 1;
  if (isChoice) {
    const prompt = makeP(`What do you do? Choose one:`, `choice-prompt`);
    prompt.id = `choice-prompt`;
    panelBody.append(prompt);
  }
  if (actions.length > 0) {
    const wrap = document.createElement(`div`);
    wrap.className = isChoice ? `actions choices` : `actions`;
    if (isChoice) {
      wrap.setAttribute(`role`, `group`);
      wrap.setAttribute(`aria-labelledby`, `choice-prompt`);
    }
    actions.forEach((action, index) => {
      // Options in a choice all use the plain style, so none gives away the answer
      const className = action.kind === `primary` ? `btn btn-primary` : `btn btn-question`;
      const btn = makeButton(action.label, className, action.onClick);
      if (isChoice) {
        const letter = document.createElement(`span`);
        letter.className = `option-letter`;
        letter.textContent = LETTERS[index];
        btn.prepend(letter);
      }
      wrap.append(btn);
    });
    panelBody.append(wrap);
  }

  // How long the lines take to appear, so Next can wait until they have
  const reduceMotion = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;
  const readingTime = reduceMotion ? 0 : delay * 1000;
  const nav = renderNav(content, readingTime);
  if (nav.children.length > 0) panelBody.append(nav);

  if (content.hint) panelBody.append(makeP(content.hint, `hint`));

  leaveBtn.hidden = state.confessed;

  h2.focus({ preventScroll: true });
  if (focus === `quiet`) return;
  const top = panel.getBoundingClientRect().top;
  if (top > window.innerHeight - 140 || top < 0) {
    panel.scrollIntoView({ behavior: reduceMotion ? `auto` : `smooth`, block: `start` });
  }
}

// The Back / Next row at the bottom of the panel
function renderNav(content, readingTime) {
  const nav = document.createElement(`div`);
  nav.className = `panel-nav`;

  if (content.back) {
    nav.append(makeButton(`Back`, `btn btn-question btn-nav`, content.back));
  }

  // Next is shown until the floorboards are opened or the case reaches a dead end
  const showNext = !state.floorboardsOpened && !isDeadEnd();
  if (showNext) {
    // A locked Next can still be focused, so its tooltip can be read on hover, focus or tap
    const wrap = document.createElement(`span`);
    wrap.className = `next-wrap`;
    const tip = document.createElement(`span`);
    tip.className = `next-tip`;
    tip.id = `next-tip`;
    tip.setAttribute(`role`, `tooltip`);
    tip.hidden = true;
    const btn = makeButton(`Next`, `btn btn-question btn-nav btn-next`, () => {
      if (btn.hasAttribute(`aria-disabled`)) {
        wrap.classList.add(`show-tip`);
        setTimeout(() => wrap.classList.remove(`show-tip`), 2500);
      } else {
        content.next();
      }
    });
    wrap.append(btn, tip);
    nav.append(wrap);

    if (!content.next) {
      lockNext(btn, tip, nextLockReason(content));
    } else if (readingTime > 0) {
      // His answer is still appearing: unlock once the last line is shown
      lockNext(btn, tip, `Read his answer first.`);
      setTimeout(() => unlockNext(btn, tip), readingTime);
    }
  }
  return nav;
}

function lockNext(btn, tip, reason) {
  tip.textContent = reason;
  tip.hidden = false;
  btn.setAttribute(`aria-disabled`, `true`);
  btn.setAttribute(`aria-describedby`, `next-tip`);
}

function unlockNext(btn, tip) {
  tip.hidden = true;
  btn.removeAttribute(`aria-disabled`);
  btn.removeAttribute(`aria-describedby`);
}

function makeButton(label, className, onClick) {
  const btn = document.createElement(`button`);
  btn.type = `button`;
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener(`click`, onClick);
  return btn;
}

function renderBlock(block) {
  if (block.type === `him` || block.type === `you`) {
    const bubble = document.createElement(`div`);
    bubble.className = `bubble bubble-${block.type}`;
    const speaker = document.createElement(`span`);
    speaker.className = `speaker`;
    speaker.textContent = block.type === `you` ? `You` : `The man`;
    bubble.append(speaker, makeP(block.text));
    return bubble;
  }
  // Asks players to keep their volume on just before the heartbeat starts
  if (block.type === `sound`) {
    return makeP(`Keep your volume on for what comes next. You will hear what he hears.`, `hint sound-notice`);
  }
  if (block.type === `thought`) {
    const p = makeP(``, `thought`);
    const label = document.createElement(`span`);
    label.className = `thought-label`;
    label.textContent = `You think: `;
    p.append(label, block.text);
    return p;
  }
  return makeP(block.text);
}

function makeP(text, className) {
  const p = document.createElement(`p`);
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

/* ---------- Room visuals ---------- */

function renderRoom() {
  roomFrame.classList.toggle(`lantern-open`, state.asked.includes(`lantern`));
  roomFrame.classList.toggle(`boards-unlocked`, floorUnlocked());
  roomFrame.classList.toggle(`boards-open`, state.floorboardsOpened);
  roomFrame.classList.toggle(`boards-removed`, state.confessed);
  roomFrame.classList.toggle(`heartbeat`, state.floorboardsOpened && !state.confessed);
  // The red outline pulses at the same speed as the heartbeat sound
  roomFrame.style.setProperty(`--beat`, `${BEAT_SECONDS / HEARTBEAT_SPEEDS[state.heartbeat]}s`);

  // Outline the one clickable object; the rest are skipped by mouse, keyboard and screen readers
  const active = activeObject();
  hotspots.forEach(spot => {
    const isActive = spot.dataset.object === active;
    spot.classList.toggle(`is-lead`, isActive);
    spot.setAttribute(`tabindex`, isActive ? `0` : `-1`);
    spot.setAttribute(`aria-hidden`, String(!isActive));
  });
}

/* ---------- Sound: background music, clicks and the heartbeat recording ---------- */

const ambienceAudio = document.getElementById(`ambience-audio`);
const AMBIENCE_VOLUME = 0.3;
const AMBIENCE_UNDER_HEARTBEAT = 0.1; // quieter so the heartbeat stands out
ambienceAudio.volume = AMBIENCE_VOLUME;

// Browsers block sound until the player clicks or presses a key,
// so the music starts on the first one and loops for the rest of the game
function startAmbience() {
  if (ambienceAudio.paused) ambienceAudio.play();
}

const clickAudio = document.getElementById(`click-audio`);
clickAudio.volume = 0.8; // the recording is already quiet, so this keeps it faint

// A latch click for every button, clue and the front door.
// Rewinding first lets quick clicks each make their own sound.
function playClick() {
  clickAudio.currentTime = 0;
  clickAudio.play();
}

const heartbeatAudio = document.getElementById(`heartbeat-audio`);
const BEAT_SECONDS = 1.5; // time between beats in the recording
// Speed and volume for each heartbeat step: it grows every time you wait or ask
const HEARTBEAT_SPEEDS = [1, 1.25, 1.5, 1.8];
const HEARTBEAT_VOLUMES = [0.5, 0.65, 0.8, 1];

// The heartbeat plays from the moment the board is lifted until he confesses.
// Browsers only allow sound after a click, so this is called from click handlers.
function updateSound() {
  const playing = state.scene === `room` && state.floorboardsOpened && !state.confessed;
  ambienceAudio.volume = playing ? AMBIENCE_UNDER_HEARTBEAT : AMBIENCE_VOLUME;
  if (!playing) {
    heartbeatAudio.pause();
    heartbeatAudio.currentTime = 0;
    return;
  }
  heartbeatAudio.playbackRate = HEARTBEAT_SPEEDS[state.heartbeat];
  heartbeatAudio.volume = HEARTBEAT_VOLUMES[state.heartbeat];
  if (heartbeatAudio.paused) heartbeatAudio.play();
}

// Muting keeps the sounds running silently, so unmuting picks up where they are
function toggleSound() {
  const muted = !ambienceAudio.muted;
  ambienceAudio.muted = muted;
  clickAudio.muted = muted;
  heartbeatAudio.muted = muted;
  soundBtn.textContent = muted ? `Sound: Off` : `Sound: On`;
}

/* ---------- Restart ---------- */

function restartGame() {
  showRestartConfirm(false);
  state = freshState();
  lastPanel = null;
  commit(); // clears the room and stops the heartbeat
  showScene(`arrival`);
}

// The confirmation lives in the header rather than a browser pop-up
function showRestartConfirm(show) {
  restartConfirm.hidden = !show;
  restartBtn.hidden = show;
  soundBtn.hidden = show; // leaves room for the question on small screens
  if (show) document.getElementById(`restart-no`).focus();
}

/* ---------- Event listeners ---------- */

function activateOnKey(el, handler) {
  el.addEventListener(`click`, handler);
  el.addEventListener(`keydown`, event => {
    if (event.key === `Enter` || event.key === ` `) {
      event.preventDefault();
      playClick(); // a key press is not a click, so the sound is played here
      handler();
    }
  });
}

// Any click starts the music; clicks on buttons and clickable drawings also make the latch sound
document.addEventListener(`click`, event => {
  startAmbience();
  if (event.target.closest(`button, [role="button"]`)) playClick();
});
document.addEventListener(`keydown`, startAmbience);
// Clicking the front door shows "How to Play" before the player goes inside
activateOnKey(houseDoor, () => howTo.showModal());
document.getElementById(`how-to-enter`).addEventListener(`click`, startGame);
document.getElementById(`how-to-back`).addEventListener(`click`, () => howTo.close());
hotspots.forEach(spot => {
  activateOnKey(spot, () => inspectObject(spot.dataset.object));
});
leaveBtn.addEventListener(`click`, askToLeave);
soundBtn.addEventListener(`click`, toggleSound);
restartBtn.addEventListener(`click`, () => showRestartConfirm(true));
document.getElementById(`restart-yes`).addEventListener(`click`, restartGame);
document.getElementById(`restart-no`).addEventListener(`click`, () => {
  showRestartConfirm(false);
  restartBtn.focus();
});
document.getElementById(`play-again-btn`).addEventListener(`click`, restartGame);

/* ---------- Start ---------- */

showScene(`arrival`);
