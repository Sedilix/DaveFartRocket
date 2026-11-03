export type Mood = 'neutral' | 'worried' | 'delighted' | 'horrified' | 'deadpan' | 'smug';

export interface Line {
  who: string;
  text: string;
  whisper?: boolean;
  shout?: boolean;
  mood?: Mood;
  sfx?: string;
  action?: () => void;
}

export const S1_SCRIPT: Record<string, Line[]> = {
  intro: [
    { who: 'Narrator', text: 'Dave had been rescued from low Earth orbit. Throughout the entire event, he had been completely fine.' },
    { who: 'Narrator', text: 'The Quell are an ancient, delicate species who consider whispering a raised voice. They had prepared a formal welcome.' },
    { who: 'Captain Murmur', text: 'Welcome aboard the Whisper. Please... do not... make any sudden vibrations.', whisper: true, mood: 'worried' },
    { who: 'Dave', text: 'Hi! Thanks for picking me up. Real shame about Earth. My landlord is going to be furious.', mood: 'delighted' },
    { who: 'Narrator', text: 'Dave delivered this condolence with his whole chest, which immediately triggered his diaphragm.', mood: 'deadpan' },
    { who: 'Captain Murmur', text: 'Oh heavens. The acoustic integrity—', whisper: true, mood: 'horrified' },
    { who: 'Narrator', text: 'The Hush Field held. Captain Murmur did not.' },
    { who: 'Pim', text: 'I am Pim. I am your assigned liaison. For the record, I was chosen via lottery because I was looking out the window.', whisper: true, mood: 'deadpan' },
    { who: 'Pim', text: 'We must proceed to the briefing room. Your gastrointestinal events will continue. I will hum to sustain the field.', whisper: true, mood: 'worried' },
    { who: 'Narrator', text: 'The corridor was lined with priceless, brittle cultural relics.' },
    { who: 'Pim', text: 'Follow the bioluminescent lanterns. Hold H and I will hum. Do not let the meter empty, or our history will shatter.', whisper: true, mood: 'worried' }
  ],
  fail: [
    { who: 'Narrator', text: 'The Hush Field failed. The four-thousand-year-old Heirloom Vase of Quiet dissolved into acoustic powder.' },
    { who: 'Pim', text: 'That vase survived three planetary wars. Never mind. Let us take a deep breath and resume from the doorway.', whisper: true, mood: 'deadpan' }
  ],
  briefing: [
    { who: 'Pim', text: 'This is the briefing chamber. It is lined with sound-deadening felt from extinct void-sheep.', whisper: true, mood: 'worried' },
    { who: 'Pim', text: 'Before your homeworld underwent involuntary orbital re-entry... did you consume anything uncertified?', whisper: true, mood: 'deadpan' },
    { who: 'Dave', text: 'Just the Tuesday brunch special down at Gary’s Deli. The "Galactic Bean Skillet". Extra spicy.', mood: 'delighted' },
    { who: 'Pim', text: 'By the Ancestors. A Doubling Bean. It does not pass through biology; it takes root in spacetime.', whisper: true, mood: 'horrified' },
    { who: 'Narrator', text: 'Dave remembered Gary’s Deli. Gary had not been wearing hairnets, which in hindsight was the least of his sins.' },
    { who: 'Pim', text: 'Every release doubles in acoustic amplitude. Our technology can dampen the shockwave, but the output doubles exponentially.', whisper: true, mood: 'worried' },
    { who: 'Dave', text: 'So... does Gary have a refund policy, or is there a cure?', mood: 'neutral' },
    { who: 'Pim', text: 'There is only an ancient prophecy. On the Moon of Nom, where the inhabitants worship seismic flatulence.', whisper: true, mood: 'worried' },
    { who: 'Narrator', text: 'And so, at precisely the speed of a polite cough, the cosmic pilgrimage began.' }
  ]
};

export const S2_SCRIPT: Record<string, Line[]> = {
  intro: [
    { who: 'Narrator', text: 'The Moon of Nom was lush, humid, and loud, in the way a place is loud when nobody in it is afraid of noise.' },
    { who: 'Pim', text: 'The humidity is dreadful for my antennae. Also I have been told to ride on your shoulder. I did not agree to this.', whisper: true, mood: 'deadpan' },
    { who: 'Big Toot', text: 'BEHOLD! THE PROPHET ARRIVES WITH THE WIND IN HIS BELLY!', shout: true, mood: 'delighted' },
    { who: 'Dave', text: 'Oh. Hi. I am just looking for a cure, honestly.', mood: 'neutral' },
    { who: 'Big Toot', text: 'THE CURE LIES ACROSS THE GULCH! THE BRIDGE IS BROKEN! IT WAS BROKEN BY THE LAST PROPHET!', shout: true, mood: 'delighted' },
    { who: 'Narrator', text: 'This was, by the village\'s count, the third prophet that decade.' },
    { who: 'Pim', text: 'Dave. They want you to fart across it.', whisper: true, mood: 'worried' },
    { who: 'Dave', text: 'Is that safe?', mood: 'worried' },
    { who: 'Pim', text: 'Define safe.', whisper: true, mood: 'deadpan' },
    { who: 'Narrator', text: 'Each fart in a quick chain is twice the last, so the Nomads call it "building a gust".' }
  ],
  plaza: [
    { who: 'Big Toot', text: 'HE HAS CROSSED THE GULCH! THE FESTIVAL OF THE GREAT GUST CAN BEGIN!', shout: true, mood: 'delighted' },
    { who: 'Pim', text: 'Please do not do the thing they want you to do.', whisper: true, mood: 'worried' },
    { who: 'Dave', text: 'I think I have to do the thing they want me to do.', mood: 'smug' },
    { who: 'Narrator', text: 'This was, historically, how most of Dave\'s problems began.' }
  ],
  finale: [
    { who: 'Narrator', text: 'Dave stood before the Gust Horn, a sacred instrument older than the moon\'s oldest joke.' },
    { who: 'Narrator', text: 'The Hush Field swallowed the blast. The Nomads, who had never heard of one, were thrilled by the lack of consequences.' },
    { who: 'Nomads', text: 'THE GREAT GUST HAS BEEN OPENED!', shout: true, mood: 'delighted' },
    { who: 'Big Toot', text: 'THE PROPHET HAS BLESSED US! YOU MAY APPROACH THE SACRED DRUM!', shout: true, mood: 'delighted' },
    { who: 'Pim', text: 'The drum has a recipe carved into it. The bean. And a name: the one who planted it.', whisper: true, mood: 'worried' },
    { who: 'Big Toot', text: 'HE NOW RUNS A HOTEL! ON THE ICE MOON! IT IS TERRIBLE! GO WITH OUR BLESSING!', shout: true, mood: 'delighted' },
    { who: 'Narrator', text: 'Somewhere behind them, the broken bridge fixed itself out of embarrassment.' },
    { who: 'Dave', text: 'Okay. Hotel on the ice moon. I can do that.', mood: 'delighted' },
    { who: 'Narrator', text: 'Dave could not, in fact, do that. But he went anyway.' }
  ]
};

export const S3_SCRIPT: Record<string, Line[]> = {
  intro: [
    { who: 'Narrator', text: 'The Ice Moon of Frostbite: a place so cold that even the wind wore a coat.' },
    { who: 'Pim', text: 'I would like it noted that my antennae have stopped working. I am fine. I am wearing a scarf. I made it myself.', whisper: true, mood: 'deadpan' },
    { who: 'Dave', text: 'Look, a hotel! "The Frostbite Hotel: a quiet stay, guaranteed."', mood: 'delighted' },
    { who: 'Narrator', text: 'The guarantee was, in hindsight, ambitious.' },
    { who: 'Pim', text: 'The drum said the cook who planted the bean runs a hotel. This is the only hotel for four hundred kilometres.', whisper: true, mood: 'worried' }
  ],
  confession: [
    { who: 'Chef Glorb', text: 'Welcome to the Frostbite Hotel! Shh. Please, keep your voice down. And your... everything.', mood: 'worried' },
    { who: 'Dave', text: 'Are you the guy who sold me the bean?', mood: 'neutral' },
    { who: 'Chef Glorb', text: 'No. Yes. It was a limited-time special!', mood: 'horrified' },
    { who: 'Narrator', text: 'Chef Glorb had been practising that line in a mirror for eleven years. It still came out wrong.' },
    { who: 'Chef Glorb', text: 'I only wanted to make the best brunch in the galaxy. The bean was perfect. It just... does not stop.', mood: 'worried' },
    { who: 'Pim', text: 'Is there a cure?', whisper: true, mood: 'worried' },
    { who: 'Chef Glorb', text: 'There is. The Whisper Bean. It only grows at the Source. I have a star map in the observatory. I would show you, but the elevator is out of order.', mood: 'deadpan' },
    { who: 'Narrator', text: 'Glorb sneezed. Somewhere on the roof, a ton of snow slid onto the greenhouse. Nobody mentioned the greenhouse.' },
    { who: 'Dave', text: 'It is always out of order, isn\'t it?', mood: 'deadpan' },
    { who: 'Chef Glorb', text: 'It is part of the hotel\'s charm. The shaft is that way. Mind the ledges.', mood: 'worried' }
  ],
  observatory: [
    { who: 'Narrator', text: 'Dave reached the observatory with the quiet dignity of a man who had cleared a twelve-storey lift shaft by farting at it.' },
    { who: 'Chef Glorb', text: 'Ah. You came up the shaft. Most people take the stairs. There are stairs. Nobody mentions them.', mood: 'deadpan' },
    { who: 'Narrator', text: 'Dave looked at the stairs. The stairs looked back, apologetically.' },
    { who: 'Chef Glorb', text: 'Look through the telescope. The Source is the dead star at the end of the Frostbite Belt. The Whisper Bean grows on the one tree there.', mood: 'worried' },
    { who: 'Pim', text: 'Dave... there is a ship in the sky. A long, silent, white one.', whisper: true, mood: 'worried' },
    { who: 'Pim', text: 'That is Elder Sibilance\'s vault ship. She has come for you.', whisper: true, mood: 'horrified' },
    { who: 'Dave', text: 'Is she angry?', mood: 'worried' },
    { who: 'Pim', text: 'She is never angry. That is what makes it so much worse.', whisper: true, mood: 'deadpan' },
    { who: 'Narrator', text: 'And so, with a polite cough, the second half of the saga began.' }
  ]
};

export const S4_SCRIPT: Record<string, Line[]> = {
  intro: [
    { who: 'Narrator', text: 'The desert moon was silent in a way that suggested it had been told to be.' },
    { who: 'Elder Sibilance', text: 'Dave. Thank you for coming. Please... sit. Not on that. On nothing, if possible.', whisper: true, mood: 'deadpan' },
    { who: 'Elder Sibilance', text: 'I will be brief. Each event is twice the last. In time, it will undo a star. I propose a silent vault. Ten thousand years. You will not feel a thing.', whisper: true, mood: 'worried' },
    { who: 'Dave', text: 'Ten thousand years? What about Pim? What about the cure?', mood: 'worried' },
    { who: 'Elder Sibilance', text: 'There is no cure. There is only the vault. It is the reasonable answer.', whisper: true, mood: 'deadpan' },
    { who: 'Narrator', text: 'It was, annoyingly, the reasonable answer.' },
    { who: 'Pim', text: 'No.', whisper: true, mood: 'worried' },
    { who: 'Elder Sibilance', text: 'I beg your pardon?', whisper: true, mood: 'worried' },
    { who: 'Pim', text: 'I said no. Run, Dave. RUN. Quietly. But run.', whisper: true, mood: 'worried' },
    { who: 'Narrator', text: 'Above them, the vault ship unfolded like a very polite avalanche.' }
  ],
  finale: [
    { who: 'Narrator', text: 'Dave reached the oasis arch just ahead of the Silence, which stopped, politely, a metre behind him.' },
    { who: 'Elder Sibilance', text: 'Dave. Please come back. You do not understand what you are.', whisper: true, mood: 'worried' },
    { who: 'Pim', text: 'I understand. He is a person who sneezed on a galaxy and is trying to say sorry.', whisper: true, mood: 'delighted' },
    { who: 'Narrator', text: 'Pim then gave a long speech about friendship, courage, and not being afraid of noise. It was delivered at a whisper to a dune. The dune was moved.' },
    { who: 'Elder Sibilance', text: '...Fine. Go to the Source. But if the silence breaks, it is on you.', whisper: true, mood: 'deadpan' },
    { who: 'Dave', text: 'Thank you. And... I am sorry about the vase.', mood: 'delighted' },
    { who: 'Narrator', text: 'The Elder, who had never been interrupted by an apology, left quietly to think about it.' }
  ]
};

export const S5_SCRIPT: Record<string, Line[]> = {
  intro: [
    { who: 'Narrator', text: 'The Source was a dead star, cooled to a quiet crust, at the very end of everything.' },
    { who: 'Pim', text: 'There is the tree. It is very large. It looks like it has been waiting.', whisper: true, mood: 'worried' },
    { who: 'Dave', text: 'So I just... eat the bean?', mood: 'neutral' },
    { who: 'Pim', text: 'No. The cure is not a thing you eat. Glorb said so. I believe it is something you... do. Quietly.', whisper: true, mood: 'worried' }
  ],
  ritual: [
    { who: 'Narrator', text: 'Beneath the tree, Dave felt it. The familiar, enormous, doubling urge. Fart number sixty-one.' },
    { who: 'Pim', text: 'Dave. Listen. Every fart you have ever done, you pushed. This one you must not.', whisper: true, mood: 'worried' },
    { who: 'Pim', text: 'Hold it. Breathe. When the ring turns green, let it go... gently.', whisper: true, mood: 'worried' },
    { who: 'Dave', text: 'So the whole saga comes down to not doing the thing.', mood: 'deadpan' },
    { who: 'Narrator', text: 'It had always, secretly, come down to that.' },
    { who: 'Pim', text: 'Press F or click only when the ring is green. Too early, and... well. You know.', whisper: true, mood: 'worried' }
  ],
  win: [
    { who: 'Narrator', text: 'Silence. Real silence. Not the Hush Field kind. The kind you get when something finally stops.' },
    { who: 'Narrator', text: 'On the Bean Tree, a single bean turned pale, and then white, and then quietly fell off.' },
    { who: 'Pim', text: 'Dave. The doubling... it has reset. You are back to times one.', whisper: true, mood: 'delighted' },
    { who: 'Dave', text: 'Wait, really? Let me check.', mood: 'delighted' },
    { who: 'Narrator', text: 'It was a small, normal, almost polite noise. It was, scientifically, a fart.' },
    { who: 'Everyone', text: 'A STANDING OVATION!', mood: 'delighted' },
    { who: 'Captain Murmur', text: 'I... did not faint. I would like that noted.', whisper: true, mood: 'delighted' },
    { who: 'Elder Sibilance', text: 'Well. That was... lovely.', whisper: true, mood: 'delighted' },
    { who: 'Dave', text: 'Can you help me rebuild Earth? I owe it an apology.', mood: 'delighted' },
    { who: 'Pim', text: 'Of course. We will do it quietly. Block by block.', whisper: true, mood: 'delighted' },
    { who: 'Narrator', text: 'Dave is fine. Dave would like the toast.' }
  ]
};
