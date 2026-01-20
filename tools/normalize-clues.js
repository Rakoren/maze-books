const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webFile = path.join(root, 'web', 'word-themes.json');
const docsFile = path.join(root, 'docs', 'word-themes.json');

function normalizeWord(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function isGenericClue(clue, length) {
  const text = String(clue || '').toLowerCase();
  if (/\bword from\b/.test(text)) return true;
  if (/\bterm\b/.test(text)) return true;
  if (/\bletters\b/.test(text)) return true;
  if (/\bcommon\b.*\bword\b/.test(text)) return true;
  if (text === `${length} letters`) return true;
  return false;
}

function wordInClue(clue, word) {
  const cleanClue = normalizeWord(clue);
  if (!cleanClue) return false;
  if (cleanClue.includes(word)) return true;
  if (word.endsWith('S') && cleanClue.includes(word.slice(0, -1))) return true;
  if (word.endsWith('ES') && cleanClue.includes(word.slice(0, -2))) return true;
  return false;
}

function isValidClue(clue, word, length) {
  if (!clue) return false;
  if (wordInClue(clue, word)) return false;
  if (isGenericClue(clue, length)) return false;
  if (countWords(clue) > 10) return false;
  return true;
}

function getDeterministicIndex(key, mod) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) % mod;
  }
  return hash;
}

function adjustGrammar(text, word) {
  if (!text) return text;
  if (!isPlural(word)) return text;
  return text
    .replace(/\bA\b/g, 'Some')
    .replace(/\ban\b/gi, 'some')
    .replace(/\bis\b/gi, 'are')
    .replace(/\bIt\b/gi, 'They')
    .replace(/\bit\b/gi, 'they');
}

function isPlural(word) {
  return word.length > 2 && word.endsWith('S') && !word.endsWith('SS');
}

function getClueTemplates(tag, length, levelKey, word) {
  const lower = String(tag || 'Theme').toLowerCase();
  const themed = {
    animals: [
      {
        level1: 'A farm animal. A is for ___.',
        level2: 'An animal that can be a pet.',
        level3: 'A type of animal.',
        level4: 'An animal often seen in stories.',
        level5: 'A common creature in folklore.'
      },
      {
        level1: 'A wild animal.',
        level2: 'A creature that lives outdoors.',
        level3: 'A kind of animal.',
        level4: 'A wild creature often studied.',
        level5: 'A creature of lore.'
      }
    ],
    fantasy: [
      {
        level1: 'A magic word.',
        level2: 'Something from a fairy tale.',
        level3: 'A fantasy story word.',
        level4: 'A myth or legend item.',
        level5: 'A mystical or arcane word.'
      },
      {
        level1: 'A magical creature.',
        level2: 'A creature from a fantasy tale.',
        level3: 'A mythical creature.',
        level4: 'A legend creature.',
        level5: 'A creature of lore.'
      }
    ],
    weather: [
      {
        level1: 'A kind of weather.',
        level2: 'Weather you can see outside.',
        level3: 'A weather condition.',
        level4: 'A forecast detail.',
        level5: 'A meteorology term.'
      },
      {
        level1: 'The sky looks this way.',
        level2: 'Sky condition.',
        level3: 'A sky condition word.',
        level4: 'A weather description.',
        level5: 'A sky term.'
      }
    ],
    space: [
      {
        level1: 'Something in space.',
        level2: 'Something seen in the night sky.',
        level3: 'A space object.',
        level4: 'A solar system term.',
        level5: 'A celestial object.'
      },
      {
        level1: 'A starry-sky thing.',
        level2: 'A night-sky object.',
        level3: 'A space-related word.',
        level4: 'An astronomy word.',
        level5: 'A cosmic term.'
      }
    ],
    food: [
      {
        level1: 'Something you can eat.',
        level2: 'A food you might have.',
        level3: 'A type of food.',
        level4: 'A common meal item.',
        level5: 'A culinary word.'
      },
      {
        level1: 'A yummy food.',
        level2: 'A kitchen item to eat.',
        level3: 'A food word.',
        level4: 'A food term.',
        level5: 'A gastronomy word.'
      }
    ],
    vehicles: [
      {
        level1: 'Something you can ride in.',
        level2: 'A way to travel.',
        level3: 'A type of vehicle.',
        level4: 'A transport term.',
        level5: 'A transit word.'
      },
      {
        level1: 'A ride you can take.',
        level2: 'A vehicle you might see.',
        level3: 'A transport word.',
        level4: 'A travel term.',
        level5: 'A mobility word.'
      }
    ],
    ocean: [
      {
        level1: 'Something from the sea.',
        level2: 'A sea or ocean word.',
        level3: 'An ocean-related word.',
        level4: 'A marine term.',
        level5: 'A nautical word.'
      },
      {
        level1: 'A sea creature or thing.',
        level2: 'A thing found in the ocean.',
        level3: 'A marine word.',
        level4: 'A sea-related term.',
        level5: 'An ocean term.'
      }
    ]
  };

  const pool = themed[lower]
    ? themed[lower].map(entry => entry[levelKey] || entry.level3)
    : [
        `A ${length}-letter ${lower} answer`,
        `Related to ${lower}`,
        `Something linked to ${lower}`,
        `Topic: ${tag}`,
        `A ${length}-letter word about ${lower}`
      ];

  return pool
    .map(template => adjustGrammar(template, word))
    .filter(t => t && countWords(t) <= 10);
}

function ensureCluesForItem(item) {
  const normalized = { ...item };
  const word = normalizeWord(normalized.word || normalized.answer || '');
  if (!word) return normalized;
  const length = word.length;
  const tags = Array.isArray(normalized.tags) ? normalized.tags : [];
  const tag = tags.length ? tags[0] : 'Theme';
  const existingClues = normalized.clues && typeof normalized.clues === 'object' ? { ...normalized.clues } : {};
  const legacy = String(normalized.clue || '').trim();

  if (!existingClues.level3 && isValidClue(legacy, word, length)) {
    existingClues.level3 = legacy;
  }

  ['level1', 'level2', 'level3', 'level4', 'level5'].forEach(levelKey => {
    if (existingClues[levelKey] && isValidClue(existingClues[levelKey], word, length)) return;
    const pool = getClueTemplates(tag, length, levelKey, word);
    if (!pool.length) return;
    const pick = getDeterministicIndex(`${word}-${levelKey}`, pool.length);
    existingClues[levelKey] = pool[pick];
  });

  normalized.clues = existingClues;
  return normalized;
}

function rewriteFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const updated = {
    ...data,
    wordDatabase: (data.wordDatabase || []).map(item => ensureCluesForItem(item))
  };
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
}

rewriteFile(webFile);
if (fs.existsSync(docsFile)) {
  rewriteFile(docsFile);
}

console.log('Clues normalized in word-themes.json');
