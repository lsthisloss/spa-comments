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
      `Speedrunning life like I speedrun Mario 64 - lots of glitches and crying 🏃‍♂️💨`
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
      `Zoom calls: professional from waist up, pajamas from waist down 👔🩲`
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
      `Wine tasting: "Mmm yes, this tastes like... grape juice but expensive" 🍷🤔`
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
      `Sleep schedule more messed up than my life choices 😴🎢`
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
      `Rubber duck debugging: having deeper conversations with toys than humans 🦆`
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
      `Reality is often disappointing. That's why I live in denial 🙈`
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
      `Online shopping cart: $200. After applying logic: empty cart 🛒`
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
      `New Year resolution: get fit. By March: what's a gym? 📅❓`
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
      `Coming home from vacation: reverse culture shock in your own country 🏠😵`
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