/**
 * Коллекция контента для генерации тестовых постов
 */

export interface ContentTheme {
  name: string;
  emoji: string;
  texts: string[];
}

export const CONTENT_THEMES: ContentTheme[] = [
 {
    name: 'Gaming & Esports',
    emoji: '🎮',
    texts: [
      `gg ez 🎮`,
      `Купил RTX 4090 за почку 💸`,
      `200 часов в Baldur's Gate 3... да я в порядке 😅`,
      `Just rage quit after dying to the same boss 47 times 🤬`,
      `Why do I keep buying games on Steam sale when I have 500 unplayed games? 🤔`,
      `Друг сказал "просто одну катку в Dota" 6 часов назад... я все еще играю 🎯`,
      `Finally beat Elden Ring! Now time for NG+7 because I hate myself 💀`,
      `Playing Among Us in 2024 hits different when you're sus of everyone irl too 👀`,
      `Minecraft is not just a game, it's a lifestyle. Built a replica of my house to escape reality 🏗️`,
      `Speedrunning life like I speedrun Mario 64 - lots of glitches and crying 🏃‍♂️💨`,
      `Just spent 14 hours straight playing Cyberpunk 2077 and honestly my real life has more bugs than Night City. My back hurts, my eyes are bleeding RGB pixels, and I'm pretty sure I've forgotten how to interact with actual humans. Worth it though because I finally got that legendary katana that does 0.3% more damage than my previous one. Mom says dinner's ready but I told her I'm in the middle of a crucial side quest about finding someone's lost cat in a dystopian future. Gaming priorities, you know? 🎮💀🌃`,
      `Organizing my Steam library by completion percentage and it's more depressing than my dating life. I have 847 games, completed 23, and I'm still buying more because "this time will be different." It's like digital hoarding but with more RGB lighting. My wallet cries every Steam sale but my heart sings when I see those sweet, sweet discount percentages. Currently debating whether to start that 100-hour JRPG or just stare at my library for another 3 hours wondering what to play. The struggle is real when you have too many choices and zero motivation 🎮💸📚`
    ]
  },

  {
    name: 'Internet Culture',
    emoji: '💻',
    texts: [
      `LOL 😂`,
      `This meme hits different at 3am 🌙`,
      `POV: you're scrolling instead of sleeping 👁️`,
      `Touch grass? I prefer touching screens 📱`,
      `WiFi is down = apocalypse mode activated 📡💀`,
      `When the video buffers right at the best part 🤡`,
      `NFT stands for "No Fucking Thanks" 🖼️❌`,
      `Deleted my search history like I'm hiding war crimes 🕵️‍♂️`,
      `Online shopping at 2am: "Do I really need a banana hammock?" 🍌`,
      `Zoom calls: professional from waist up, pajamas from waist down 👔🩲`,
      `Internet culture in 2024 is basically everyone pretending they understand TikTok trends while secretly googling what "bussin" means. We've gone from "ROFL" to skull emojis and somehow that's evolution. My FYP algorithm knows me better than my therapist at this point - it serves me exactly the content I need to procrastinate effectively. Meanwhile I'm out here explaining to my parents why their Facebook posts about minions aren't actually funny and yes, that email from a Nigerian prince is probably a scam. Technology connected the world but somehow made us all more confused than ever 💻🤡🌍`,
      `Scrolling through social media at 3am hits different when you realize you're watching someone's breakfast from 6 months ago while your own life falls apart in real time. The internet promised us connection but delivered anxiety with a side of FOMO and a sprinkle of digital depression. Everyone's living their best life according to their stories while I'm here in my pajamas eating cereal for the third meal today wondering if this is what adulthood was supposed to feel like. But hey, at least the memes are fire and I know way too much about strangers' pets 📱🌙💭`
    ]
  },

  {
    name: 'Food Adventures',
    emoji: '🍕',
    texts: [
      `Pizza = life 🍕`,
      `Burnt water again 🔥💧`,
      `Gordon Ramsay would cry seeing my cooking 👨‍🍳😢`,
      `Tried making sourdough starter, created sentient blob instead 🧪`,
      `Adult life: getting excited about buying expensive cheese 🧀✨`,
      `Cereal for dinner because I'm a sophisticated adult 🥣`,
      `Found a restaurant that serves breakfast all day - true love exists 🥞❤️`,
      `Spent $50 on ingredients to make a $3 dish. Math checks out 📊`,
      `My cooking skills peaked at instant ramen with an egg 🍜🥚`,
      `Wine tasting: "Mmm yes, this tastes like... grape juice but expensive" 🍷🤔`,
      `Decided to become a foodie and spent my entire paycheck at Whole Foods buying organic everything, only to realize I still don't know how to cook and everything expired while I ordered takeout for two weeks straight. My fridge is a graveyard of good intentions: wilted kale, moldy berries, and mysterious containers with science experiments I'm too afraid to open. I follow 47 cooking channels on YouTube but somehow still burn scrambled eggs. The irony is real when you have $200 worth of spices but still can't make anything that doesn't taste like sadness 🍕💸🥬`,
      `My relationship with food delivery apps is more committed than any romantic relationship I've ever had. I know every driver by name, they know my order preferences, and we've reached a level of intimacy where they don't even ring the doorbell anymore - just leave it at the door like a shameful secret. I've spent more money on DoorDash fees than most people spend on rent, but hey, at least I'm supporting local businesses while slowly destroying my bank account and digestive system one overpriced burrito at a time 🚗🍔💳`
    ]
  },

  {
    name: 'Life Struggles',
    emoji: '😤',
    texts: [
      `Monday again? No thanks 📅`,
      `Adult responsibilities are like subscription services - they never end 💳`,
      `My back hurts and I'm only 25. What sorcery is this? 🧙‍♂️`,
      `Bought plants to feel responsible. They're all dead now 🪴💀`,
      `Why do weekends have only 2 days but weeks have 5 work days? Conspiracy! 🕵️‍♂️`,
      `Alarm clock is my biggest enemy and morning coffee is my only ally ☕⚔️`,
      `Laundry pile reached Mount Everest status 🏔️👕`,
      `Procrastination level: writing a to-do list instead of doing tasks 📝`,
      `Bank account balance and my self-esteem have a lot in common - both are low 📉`,
      `Sleep schedule more messed up than my life choices 😴🎢`,
      `Adult life is basically just googling "how to adult" while pretending you have your shit together in front of other adults who are also googling "how to adult." We're all just winging it with varying degrees of success and anxiety. I thought by 25 I'd have a 5-year plan, a retirement fund, and maybe know how to change a tire. Instead, I'm celebrating small victories like remembering to buy toilet paper before running out and successfully cooking pasta without setting off the smoke alarm. The bar is so low it's practically underground at this point 😤📚🤷‍♂️`,
      `Tried to get my life together by buying a planner, fancy pens, and color-coding everything like some productivity guru. Two weeks later, the planner is buried under a pile of unfolded laundry, the pens are lost in the void that is my couch cushions, and my color-coding system has devolved into "red for panic, blue for sadness." The only thing I've consistently maintained is my ability to overthink every decision and still somehow make the wrong choice. But hey, at least I'm consistent in my inconsistency 📅✏️🌪️`
    ]
  },

  {
    name: 'Tech Chaos',
    emoji: '💻',
    texts: [
      `Bug fixed! 🐛➡️✅`,
      `Git commit message: "fixed stuff" 💬`,
      `Stack Overflow saved my life again 🆘`,
      `Code works on my machine ¯\\_(ツ)_/¯`,
      `sudo apt install coffee ☕`,
      `My code has more issues than Vogue magazine 📖`,
      `Debugging: being detective for your own crimes 🕵️‍♂️`,
      `HTML is not a programming language but my heart is broken anyway 💔`,
      `When you fix one bug and create three new ones - it's called progress 📈`,
      `Rubber duck debugging: having deeper conversations with toys than humans 🦆`,
      `Spent 6 hours debugging a critical production issue only to discover I had a typo in a variable name. Not just any typo - I had written "sucess" instead of "success" and somehow this single missing 'c' brought down our entire authentication system affecting 10,000 users. The error logs were more cryptic than ancient hieroglyphics and I went through the five stages of grief twice before finding it. Now I have trust issues with the English language and my IDE's autocomplete feature. Technology is amazing until one tiny human mistake reminds you how fragile everything really is 💻🔥💀`,
      `My relationship with technology is like a toxic romance - I can't live without it but it constantly disappoints me. My computer crashes at the worst possible moments, my phone dies when I need GPS most, and don't even get me started on IoT devices that are "smart" but can't figure out basic commands. I've become an expert at turning things off and on again because apparently that fixes 90% of technical problems. Modern life is just troubleshooting with extra steps and occasional existential crises about whether we're too dependent on machines that clearly hate us 📱💻🤖`
    ]
  },

  {
    name: 'Random Wisdom',
    emoji: '🧠',
    texts: [
      `Life hack: pretend to be busy 💼`,
      `Why do we park in driveways and drive on parkways? 🤯`,
      `Socks disappear in washing machine to parallel universe of single socks 🧦🌌`,
      `Conspiracy theory: alarm clocks can sense when you're comfortable 😴`,
      `Scientists say universe is expanding. So is my waistline. Coincidence? 🌌🍔`,
      `Time flies when you're having fun. Time crawls when you're in meetings ⏰`,
      `Money can't buy happiness but poverty can't buy anything 💰`,
      `I'm not lazy, I'm in energy saving mode 🔋`,
      `Life is like WiFi - stronger when you're closer to the source ✨`,
      `Reality is often disappointing. That's why I live in denial 🙈`,
      `The universe is constantly expanding, which means everything is getting farther apart, including my motivation and my responsibilities. Scientists say space is infinite but somehow I still can't find enough space in my apartment for all my stuff. We're literally floating on a rock through space at thousands of miles per hour but I still get motion sickness on elevators. The more I learn about quantum physics, the more I realize I understand absolutely nothing and somehow that's both terrifying and comforting at the same time 🌌🤯🚀`,
      `Life's greatest mysteries: why hot dogs come in packs of 10 but buns come in packs of 8, why we say "after dark" when it's actually after light, and why abbreviated is such a long word. We live in a world where we have wireless everything except for phone chargers, where we can video call someone on the other side of the planet but can't figure out why our WiFi stops working when it rains. The universe has a twisted sense of humor and we're all just trying to get the joke 🧠🎭🌍`
    ]
  },

  {
    name: 'Modern Problems',
    emoji: '🤡',
    texts: [
      `First world problems 🌍`,
      `Phone battery dies faster than my motivation 🔋💀`,
      `Autocorrect thinks it knows me better than I know myself 📱🤖`,
      `Password must contain: 1 capital letter, 1 number, 1 symbol, and your childhood trauma 🔒`,
      `Social media algorithm knows my taste better than my mother 👩‍👧‍👦`,
      `Trying to skip ads but accidentally clicking on them - capitalism wins again 💸`,
      `Email inbox: 47,392 unread emails. I'm basically digital hoarder 📧`,
      `GPS: "Turn left" Me: "But there's a wall" GPS: "I SAID TURN LEFT" 🗺️`,
      `Spotify knows I'm sad before I do 🎵😢`,
      `Online shopping cart: $200. After applying logic: empty cart 🛒`,
      `Modern problems require modern solutions, which apparently means having 47 different apps for 47 different things that used to be solved by one person with common sense. Need to order food? That's 3 apps. Want to date? 12 apps. Looking for an apartment? 27 apps and a blood sacrifice. My phone storage is fuller than my actual life and I spend more time managing notifications than actually living. We've created convenience so complex it's become inconvenient and I'm too invested in the ecosystem to escape now 🤡📱💻`,
      `The paradox of choice in 2024: we have infinite options for everything but somehow can't decide what to watch on Netflix for 45 minutes before settling on The Office again. We can order any cuisine delivered in 30 minutes but spend 2 hours scrolling through menus. Dating apps give us access to millions of people but we swipe through them like we're shopping for socks. Having too many choices is the modern equivalent of starving in a fully stocked grocery store - analysis paralysis with a side of existential dread 🛒🎬📱`
    ]
  },

  {
    name: 'Fitness Fantasy',
    emoji: '💪',
    texts: [
      `Gym membership = expensive guilt 💳`,
      `Ran for 5 minutes, rewarded myself with pizza 🏃‍♂️🍕`,
      `Yoga class: trying to look zen while internally screaming 🧘‍♀️😱`,
      `My fitness tracker congratulates me for walking to the fridge 🏃‍♂️❄️`,
      `Protein shake tastes like disappointment mixed with hope 🥤`,
      `Before gym selfie vs after gym reality - two different people 📸`,
      `Personal trainer: "Feel the burn!" Me: "That's just my soul dying" 🔥👻`,
      `Crossfit: paying money to feel like you're dying in group setting 💀`,
      `Rest day turned into rest week turned into rest month 😴`,
      `New Year resolution: get fit. By March: what's a gym? 📅❓`,
      `Joined a gym in January with the confidence of someone who definitely won't give up by February. Bought all the gear: moisture-wicking everything, protein powder that costs more than my rent, and a water bottle that's apparently revolutionary. Three months later, my gym membership is the most expensive way to feel guilty about my life choices. I drive past the gym daily while eating fast food, which is probably some form of psychological torture. The equipment knows my name but not my face at this point 💪🏋️‍♂️💸`,
      `Fitness influencers make working out look so easy and aesthetic while I'm over here struggling to touch my toes and looking like I'm having an existential crisis in downward dog. They're all "just move your body!" while posting from their $5 million home gyms with perfect lighting. Meanwhile, I'm doing yoga in my living room, getting tangled in my own limbs while my cat judges my form. The gap between fitness reality and Instagram fitness is wider than my inability to do a proper push-up 🧘‍♀️📸😵‍💫`
    ]
  },

  {
    name: 'Travel Dreams',
    emoji: '✈️',
    texts: [
      `Wanderlust activated 🗺️`,
      `Plane WiFi: $20 for 2MB. Highway robbery at 30,000 feet ✈️💸`,
      `Packing: bringing 5 outfits for 2-day trip "just in case" 🧳`,
      `Airport security: taking shoes off like some weird ritual 👠🔍`,
      `Google Translate making me sound like confused robot in foreign countries 🤖`,
      `Instagram vs reality: angle is everything 📸✨`,
      `Jet lag: body clock stuck in different time zone, brain in limbo ⏰🌍`,
      `Hostel life: making friends through shared suffering of snoring roommates 🏨`,
      `Local food adventure: either best meal ever or digestive roulette 🎲🍜`,
      `Coming home from vacation: reverse culture shock in your own country 🏠😵`,
      `Travel planning in 2024: spending 6 months researching the perfect trip, reading 847 travel blogs, watching 23 YouTube vlogs, and saving Pinterest boards like my life depends on it, only to arrive and realize nothing prepared me for the reality of tourist crowds, overpriced everything, and the fact that "authentic local experience" apparently means paying $30 for street food. But that one perfect sunset moment makes all the planning, stress, and credit card debt totally worth it until you get home and start planning the next trip ✈️📱💸`,
      `The modern travel paradox: we document everything so thoroughly that we forget to actually experience it. Spent more time trying to get the perfect Instagram shot than actually appreciating the view, but hey, at least my story looks amazing even if my actual memories are just of fighting with phone camera angles. Travel used to be about discovery and adventure; now it's about proving you were there with the right hashtags and geo-tags. Still worth it though because wanderlust is a real addiction and airplane wifi is getting better 📸🌍✨`
    ]
  },

  {
    name: 'Coffee Philosophy',
    emoji: '☕',
    texts: [
      `Coffee = liquid motivation ☕`,
      `Espresso yourself ☕💬`,
      `Life before coffee: error 404 motivation not found ❌`,
      `Decaf is just sad bean water 😢`,
      `Coffee shop WiFi password: probably "coffee123" 📶`,
      `Barista: "Name for order?" Me: *existential crisis* 🤔`,
      `Cold brew in winter because addiction doesn't follow seasons ❄️☕`,
      `Latte art looking better than my actual art 🎨`,
      `Third cup of coffee today. Body is 90% caffeine now ⚡`,
      `Coffee machine broken = declare national emergency 🚨`
    ]
  }
];

// Функция для получения случайного текста по теме
export function getRandomText(index: number): string {
  const allTexts: string[] = [];
  CONTENT_THEMES.forEach(theme => {
    allTexts.push(...theme.texts);
  });
  
  // Добавляем рандомизацию для избежания повторов
  const randomOffset = Math.floor(Math.random() * allTexts.length);
  const adjustedIndex = (index + randomOffset) % allTexts.length;
  
  return allTexts[adjustedIndex];
}

// Добавить новую функцию для детерминированного выбора:
export function getTextByIndex(index: number): string {
  const allTexts: string[] = [];
  CONTENT_THEMES.forEach(theme => {
    allTexts.push(...theme.texts);
  });
  return allTexts[index % allTexts.length];
}

// Добавить функцию для случайного текста с семплированием:
export function getRandomTextSampled(index: number, seed?: number): string {
  const allTexts: string[] = [];
  CONTENT_THEMES.forEach(theme => {
    allTexts.push(...theme.texts);
  });
  
  // Используем seed для псевдослучайности или реальный рандом
  const randomIndex = seed ? 
    (index * seed + 31) % allTexts.length : 
    Math.floor(Math.random() * allTexts.length);
  
  return allTexts[randomIndex];
}

// Экспорт названий тем
export const THEME_NAMES = CONTENT_THEMES.map(theme => theme.name);