// Golden-standard crossword generator and UI
(function () {
  let currentPuzzle = null;
  let wordDatabase = [];

  const DIRS = [
    { dr: 0, dc: 1 },
    { dr: 1, dc: 0 }
  ];
  const MAX_ATTEMPTS = 60;

  function applyBackground(value) {
    const resolved = value && value !== 'default' ? value : '#ffffff';
    document.documentElement.style.setProperty('--puzzle-bg', resolved);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function makeEmptyGrid(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
  }

  function inBounds(size, r, c) {
    return r >= 0 && c >= 0 && r < size && c < size;
  }

  function canPlace(grid, word, startR, startC, dr, dc) {
    const size = grid.length;
    const endR = startR + dr * (word.length - 1);
    const endC = startC + dc * (word.length - 1);

    if (!inBounds(size, startR, startC) || !inBounds(size, endR, endC)) {
      return false;
    }

    const prevR = startR - dr;
    const prevC = startC - dc;
    const nextR = endR + dr;
    const nextC = endC + dc;

    if (inBounds(size, prevR, prevC) && grid[prevR][prevC]) return false;
    if (inBounds(size, nextR, nextC) && grid[nextR][nextC]) return false;

    for (let i = 0; i < word.length; i++) {
      const rr = startR + dr * i;
      const cc = startC + dc * i;
      const cell = grid[rr][cc];

      if (cell && cell !== word[i]) return false;

      if (!cell) {
        if (dr === 0) {
          if ((inBounds(size, rr - 1, cc) && grid[rr - 1][cc]) || (inBounds(size, rr + 1, cc) && grid[rr + 1][cc])) {
            return false;
          }
        } else {
          if ((inBounds(size, rr, cc - 1) && grid[rr][cc - 1]) || (inBounds(size, rr, cc + 1) && grid[rr][cc + 1])) {
            return false;
          }
        }
      }
    }

    return true;
  }

  function placeWord(grid, word, startR, startC, dr, dc) {
    for (let i = 0; i < word.length; i++) {
      const rr = startR + dr * i;
      const cc = startC + dc * i;
      grid[rr][cc] = word[i];
    }
  }

  function countIntersections(grid, word, startR, startC, dr, dc) {
    let hits = 0;
    for (let i = 0; i < word.length; i++) {
      const rr = startR + dr * i;
      const cc = startC + dc * i;
      if (grid[rr][cc]) hits++;
    }
    return hits;
  }

  function normalizeEntries(entries) {
    return entries
      .map(e => ({
        answer: (e.answer || '').toUpperCase().replace(/[^A-Z]/g, ''),
        clue: e.clue || ''
      }))
      .filter(e => e.answer.length >= 3);
  }

  function computeGridSize(words) {
    const longest = Math.max(6, ...words.map(w => w.answer.length));
    const byCount = Math.ceil(Math.sqrt(words.length)) * 4;
    return Math.max(10, longest + 2, byCount);
  }

  function areaOfBounds(bounds) {
    if (!bounds) return 0;
    const width = bounds.maxC - bounds.minC + 1;
    const height = bounds.maxR - bounds.minR + 1;
    return width * height;
  }

  function extendBounds(bounds, r, c, dr, dc, len) {
    const endR = r + dr * (len - 1);
    const endC = c + dc * (len - 1);
    const base = bounds
      ? { ...bounds }
      : { minR: r, maxR: r, minC: c, maxC: c };

    const next = {
      minR: Math.min(base.minR, r, endR),
      maxR: Math.max(base.maxR, r, endR),
      minC: Math.min(base.minC, c, endC),
      maxC: Math.max(base.maxC, c, endC)
    };
    next.area = areaOfBounds(next);
    return next;
  }

  function trimGrid(grid, bounds) {
    if (!bounds) return grid;
    const height = bounds.maxR - bounds.minR + 1;
    const width = bounds.maxC - bounds.minC + 1;
    const trimmed = Array.from({ length: height }, () => Array(width).fill(null));

    for (let r = bounds.minR; r <= bounds.maxR; r++) {
      for (let c = bounds.minC; c <= bounds.maxC; c++) {
        trimmed[r - bounds.minR][c - bounds.minC] = grid[r][c];
      }
    }
    return trimmed;
  }

  function shiftPlacements(placements, bounds) {
    if (!bounds) return placements.slice();
    const offsetR = bounds.minR;
    const offsetC = bounds.minC;
    return placements.map(p => ({
      answer: p.answer,
      clue: p.clue,
      r: p.r - offsetR,
      c: p.c - offsetC,
      dr: p.dr,
      dc: p.dc
    }));
  }

  function finalizePuzzle(grid, placements, bounds) {
    if (!placements.length || !bounds) return null;
    return {
      grid: trimGrid(grid, bounds),
      placements: shiftPlacements(placements, bounds),
      bounds: { ...bounds }
    };
  }

  function savePuzzleAsPng() {
    if (!currentPuzzle || !currentPuzzle.grid || !currentPuzzle.grid.length) {
      updateStatus('Generate a crossword before saving.', 'error');
      return;
    }

    const grid = currentPuzzle.grid;
    const rows = grid.length;
    const cols = grid[0].length;
    const style = getComputedStyle(document.documentElement);
    const cellVar = (style.getPropertyValue('--cell') || '').trim();
    const cellSize = parseInt(cellVar, 10) || 30;
    const padding = 12;
    const canvas = document.createElement('canvas');
    canvas.width = cols * cellSize + padding * 2;
    canvas.height = rows * cellSize + padding * 2;
    const ctx = canvas.getContext('2d');

    const bgValue = (style.getPropertyValue('--puzzle-bg') || '').trim() || '#ffffff';
    const resolvedBg = bgValue.toLowerCase() === 'transparent' ? null : bgValue;

    if (resolvedBg) {
      ctx.fillStyle = resolvedBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const numbers = currentPuzzle.numbers || [];
    const showAnswers = !!currentPuzzle.showingAnswers;
    const numFont = Math.max(10, Math.floor(cellSize * 0.35));
    const letterFont = Math.floor(cellSize * 0.65);
    const lineWidth = 2;







    const hasLetter = (r, c) => !!(grid[r] && grid[r][c]);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const letter = grid[r][c];
        if (!letter) continue;
        const x = padding + c * cellSize;
        const y = padding + r * cellSize;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }

    ctx.fillStyle = '#111';
    for (let r = 0; r <= rows; r++) {
      const y = padding + r * cellSize;
      for (let c = 0; c < cols; c++) {
        if (hasLetter(r - 1, c) || hasLetter(r, c)) {
          const x = padding + c * cellSize;
          ctx.fillRect(x, y, cellSize, lineWidth);
        }
      }
    }

    for (let c = 0; c <= cols; c++) {
      const x = padding + c * cellSize;
      for (let r = 0; r < rows; r++) {
        if (hasLetter(r, c - 1) || hasLetter(r, c)) {
          const y = padding + r * cellSize;
          ctx.fillRect(x, y, lineWidth, cellSize);
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const letter = grid[r][c];
        if (!letter) continue;
        const x = padding + c * cellSize;
        const y = padding + r * cellSize;

        const num = numbers[r] ? numbers[r][c] : null;
        if (num) {
          ctx.fillStyle = '#111';
          ctx.font = `${numFont}px Segoe UI, Arial, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(String(num), x + 2, y + 1);
        }

        if (showAnswers) {
          ctx.fillStyle = '#111';
          ctx.font = `${letterFont}px Segoe UI, Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(letter, x + cellSize / 2, y + cellSize / 2 + 1);
        }
      }
    }

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'crossword.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  function findBestPlacement(grid, entry, bounds) {
    const size = grid.length;
    const baseArea = areaOfBounds(bounds);
    let best = null;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = grid[r][c];
        if (!cell) continue;
        for (let i = 0; i < entry.answer.length; i++) {
          if (entry.answer[i] !== cell) continue;
          for (const dir of DIRS) {
            const sr = r - dir.dr * i;
            const sc = c - dir.dc * i;
            if (!canPlace(grid, entry.answer, sr, sc, dir.dr, dir.dc)) continue;
            const hits = countIntersections(grid, entry.answer, sr, sc, dir.dr, dir.dc);
            if (hits < 1 || hits > 2) continue;
            const candidateBounds = extendBounds(bounds, sr, sc, dir.dr, dir.dc, entry.answer.length);
            const areaIncrease = candidateBounds.area - baseArea;
            const center = size / 2;
            const span = Math.abs(sr - center) + Math.abs(sc - center);

            if (
              !best ||
              areaIncrease < best.areaIncrease ||
              (areaIncrease === best.areaIncrease && hits < best.hits) ||
              (areaIncrease === best.areaIncrease && hits === best.hits && span < best.span)
            ) {
              best = {
                r: sr,
                c: sc,
                dr: dir.dr,
                dc: dir.dc,
                hits,
                span,
                areaIncrease,
                newBounds: candidateBounds
              };
            }
          }
        }
      }
    }

    return best;
  }

  function buildPuzzle(words, preferredSize) {
    if (!words.length) return null;
    const size = preferredSize || computeGridSize(words);
    let bestResult = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const grid = makeEmptyGrid(size);
      const placements = [];
      const order = shuffle(words.slice()).sort((a, b) => b.answer.length - a.answer.length);
      const first = order.shift();
      const startR = Math.floor(size / 2);
      const startC = Math.floor((size - first.answer.length) / 2);
      if (!canPlace(grid, first.answer, startR, startC, 0, 1)) continue;
      placeWord(grid, first.answer, startR, startC, 0, 1);
      placements.push({ answer: first.answer, clue: first.clue, r: startR, c: startC, dr: 0, dc: 1 });
      let bounds = extendBounds(null, startR, startC, 0, 1, first.answer.length);

      for (const entry of order) {
        const best = findBestPlacement(grid, entry, bounds);
        if (!best) continue; // discard word if no compliant intersection
        placeWord(grid, entry.answer, best.r, best.c, best.dr, best.dc);
        placements.push({ answer: entry.answer, clue: entry.clue, r: best.r, c: best.c, dr: best.dr, dc: best.dc });
        bounds = best.newBounds;
      }

      const candidate = finalizePuzzle(grid, placements, bounds);
      if (!candidate) continue;

      if (
        !bestResult ||
        candidate.placements.length > bestResult.placements.length ||
        (candidate.placements.length === bestResult.placements.length && candidate.bounds.area < bestResult.bounds.area)
      ) {
        bestResult = candidate;
      }

      if (bestResult.placements.length === words.length) break;
    }

    return bestResult;
  }

  function generateWithResize(words) {
    if (!words.length) return null;
    let size = computeGridSize(words);
    let best = null;
    for (let i = 0; i < 4; i++) {
      const attempt = buildPuzzle(words, size);
      if (
        attempt &&
        (!best ||
          attempt.placements.length > best.placements.length ||
          (attempt.placements.length === best.placements.length && attempt.bounds.area < best.bounds.area))
      ) {
        best = attempt;
      }
      if (best && best.placements.length === words.length) break;
      size += 2;
    }
    return best;
  }

  function computeNumbers(grid) {
    const rows = grid.length;
    const cols = grid[0] ? grid[0].length : 0;
    const numbers = Array.from({ length: rows }, () => Array(cols).fill(null));
    let num = 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!grid[r][c]) continue;
        const startsAcross = (c === 0 || !grid[r][c - 1]) && (c + 1 < cols && grid[r][c + 1]);
        const startsDown = (r === 0 || !grid[r - 1][c]) && (r + 1 < rows && grid[r + 1][c]);
        if (startsAcross || startsDown) {
          numbers[r][c] = num++;
        }
      }
    }

    return numbers;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[ch]);
  }

  async function loadThemes() {
    try {
      const localUrl = `word-themes.json?v=${Date.now()}`;
      let response = await fetch(localUrl, { cache: 'no-store' });
      if (!response.ok) {
        const fallbackUrl = 'https://raw.githubusercontent.com/Rakoren/maze-books/master/docs/word-themes.json';
        response = await fetch(fallbackUrl, { cache: 'no-store' });
      }
      if (!response.ok) {
        throw new Error(`Theme load failed (${response.status})`);
      }
      const data = await response.json();
      wordDatabase = (data.wordDatabase || []).map(item => ensureCluesForItem(item));
      const themeSet = new Set();

      wordDatabase.forEach(entry => {
        if (entry.tags) {
          entry.tags.forEach(tag => themeSet.add(tag));
        }
      });

      const themeSelect = document.getElementById('themeSelect');
      Array.from(themeSet).sort().forEach(theme => {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
        themeSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Failed to load themes:', error);
      updateStatus('Failed to load themes. Please refresh or check the site URL.', 'error');
    }
  }

  function generateWordList(theme, level, maxWords = 20) {
    let filtered = wordDatabase.filter(entry => {
      const levelNum = parseInt(level, 10);
      const entryLevel = entry.level || 3;
      return entry.tags && entry.tags.includes(theme) && entryLevel <= levelNum;
    });

    if (filtered.length === 0) {
      filtered = wordDatabase.filter(entry => entry.tags && entry.tags.includes(theme));
    }

    const unique = Array.from(new Map(filtered.map(e => [e.word, e])).values());
    const shuffled = unique.sort(() => Math.random() - 0.5);
    return shuffled
      .filter(item => (item.word || '').length >= 3)
      .slice(0, maxWords)
      .map(e => ({
        word: e.word,
        clue: e.clue,
        clues: e.clues,
        tags: Array.isArray(e.tags) ? e.tags.slice() : [],
        level: e.level || 3
      }));
  }

  function updateStatus(message, type = 'loading') {
    const status = document.getElementById('status');
    if (!status) return;
    status.textContent = message;
    status.className = 'status ' + type;
  }

  function buildEntries(wordList, level) {
    const allWords = wordList.map(item => normalizeWord(item.word || ''));
    const raw = wordList.map(item => ({
      answer: item.word,
      clue: buildClueForItem(item, level, allWords)
    }));
    return normalizeEntries(raw);
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

  function buildClueForItem(item, level, allWords) {
    const word = normalizeWord(item.word || item.answer || '');
    if (!word) return '';
    const length = word.length;
    const levelKey = `level${Math.min(5, Math.max(1, parseInt(level, 10) || 3))}`;
    const existing = String(item.clue || '').trim();
    const fromArray = item.clues && typeof item.clues === 'object' ? String(item.clues[levelKey] || '').trim() : '';

    const candidates = [fromArray, existing].filter(Boolean);
    for (const candidate of candidates) {
      if (isValidClue(candidate, word, length)) {
        return enforceUniqueClue(candidate, word, allWords);
      }
    }

    const tags = Array.isArray(item.tags) ? item.tags : [];
    const tag = tags.length ? tags[0] : 'Theme';
    const templates = getClueTemplates(tag, length, levelKey, word);
    const pick = getDeterministicIndex(word, templates.length);
    const templated = templates[pick];
    return enforceUniqueClue(templated, word, allWords);
  }

  function isGenericClue(clue, length) {
    const text = clue.toLowerCase();
    if (/\bword from\b/.test(text)) return true;
    if (/\bterm\b/.test(text)) return true;
    if (/\bletters\b/.test(text)) return true;
    if (/\bcommon\b.*\bword\b/.test(text)) return true;
    if (text === `${length} letters`) return true;
    return false;
  }

  function getClueTemplates(tag, length) {
    const lower = tag.toLowerCase();
    const themed = {
      animals: [
        `Animal you might see on a farm (${length} letters)`,
        `Creature from the wild (${length})`,
        `A ${length}-letter animal`,
        `Animal commonly seen in stories`,
        `A ${length}-letter creature`
      ],
      fantasy: [
        `Magical or mythical theme (${length})`,
        `Fantasy-world item (${length} letters)`,
        `Creature from a fantasy tale`,
        `Storybook magic word (${length})`,
        `Mythic or magical answer (${length})`
      ],
      weather: [
        `Weather you can feel outside (${length})`,
        `Sky condition (${length} letters)`,
        `Outdoor forecast feature`,
        `Type of storm or condition (${length})`,
        `Weather you might see today`
      ],
      space: [
        `Something found in space (${length})`,
        `Night-sky object (${length} letters)`,
        `Part of the solar system`,
        `Space-related answer (${length})`,
        `Celestial item (${length} letters)`
      ],
      food: [
        `Something you can eat (${length})`,
        `Common food item (${length} letters)`,
        `A ${length}-letter food`,
        `Goes on a plate (${length})`,
        `Kitchen or meal word`
      ],
      vehicles: [
        `Something you can ride in (${length})`,
        `A way to travel (${length} letters)`,
        `Vehicle with wheels (${length})`,
        `Common ride (${length})`,
        `Transport-related answer`
      ],
      ocean: [
        `Found in the ocean (${length})`,
        `Sea-related answer (${length})`,
        `Ocean life or feature (${length})`,
        `Something from the sea`,
        `Marine word (${length})`
      ]
    };

    if (themed[lower]) return themed[lower];

    return [
      `A ${length}-letter answer about ${lower}`,
      `Related to ${lower}`,
      `Something linked to ${lower}`,
      `A ${length}-letter ${lower} answer`,
      `Topic: ${tag}`
    ];
  }

  function isGenericClue(clue, length) {
    const text = clue.toLowerCase();
    if (/\bword from\b/.test(text)) return true;
    if (/\bterm\b/.test(text)) return true;
    if (/\bletters\b/.test(text)) return true;
    if (/\bcommon\b.*\bword\b/.test(text)) return true;
    if (text === `${length} letters`) return true;
    return false;
  }

  function isValidClue(clue, word, length) {
    if (!clue) return false;
    if (wordInClue(clue, word)) return false;
    if (isGenericClue(clue, length)) return false;
    if (countWords(clue) > 10) return false;
    return true;
  }

  function enforceUniqueClue(clue, word, allWords) {
    if (!clue) return clue;
    const needsDisambiguation = allWords.filter(w => w.length === word.length).length > 1;
    if (!needsDisambiguation) return clue;
    if (!isGenericClue(clue, word.length)) return clue;
    if (/starts with/i.test(clue)) return clue;
    const add = `Starts with ${word[0]}.`;
    return countWords(clue) <= 8 ? `${clue} ${add}` : add;
  }

  function wordInClue(clue, word) {
    const cleanClue = normalizeWord(clue);
    if (!cleanClue) return false;
    if (cleanClue.includes(word)) return true;
    if (word.endsWith('S') && cleanClue.includes(word.slice(0, -1))) return true;
    if (word.endsWith('ES') && cleanClue.includes(word.slice(0, -2))) return true;
    return false;
  }

  function normalizeWord(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
  }

  function countWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  function getClueTemplates(tag, length, levelKey, word) {
    if (!td || !td.classList.contains('letter')) return;
    if ((input.value || '').trim()) {
      td.classList.add('filled');
        {
          level1: `A farm animal. A is for ___.`,
          level2: `An animal that can be a pet.`,
          level3: `A type of animal.`,
          level4: `An animal often seen in stories.`,
          level5: `A common creature in folklore.`
        },
        {
          level1: `A wild animal.`,
          level2: `A creature that lives outdoors.`,
          level3: `A kind of animal.`,
          level4: `A wild creature often studied.`,
          level5: `A creature of myth or nature.`
        }
  function handleCellInput(event) {
    if (!currentPuzzle || currentPuzzle.showingAnswers) return;
        {
          level1: `A magic word.`,
          level2: `Something from a fairy tale.`,
          level3: `A fantasy story word.`,
          level4: `A myth or legend item.`,
          level5: `A mystical or arcane word.`
        },
        {
          level1: `A magical creature.`,
          level2: `A creature from a fantasy tale.`,
          level3: `A mythical creature.`,
          level4: `A legend creature.`,
          level5: `A creature of lore.`
        }
    if (!input.value) {
      delete currentPuzzle.userEntries[cellId];
        {
          level1: `A kind of weather.`,
          level2: `Weather you can see outside.`,
          level3: `A weather condition.`,
          level4: `A forecast detail.`,
          level5: `A meteorology term.`
        },
        {
          level1: `The sky looks this way.`,
          level2: `Sky condition.`,
          level3: `A sky condition word.`,
          level4: `A weather description.`,
          level5: `A sky term.`
        }

  function renderGrid() {
        {
          level1: `Something in space.`,
          level2: `Something seen in the night sky.`,
          level3: `A space object.`,
          level4: `A solar system term.`,
          level5: `A celestial object.`
        },
        {
          level1: `A starry-sky thing.`,
          level2: `A night-sky object.`,
          level3: `A space-related word.`,
          level4: `An astronomy word.`,
          level5: `A cosmic term.`
        }
    const table = document.createElement('table');
    table.className = 'grid crossword';
        {
          level1: `Something you can eat.`,
          level2: `A food you might have.`,
          level3: `A type of food.`,
          level4: `A common meal item.`,
          level5: `A culinary word.`
        },
        {
          level1: `A yummy food.`,
          level2: `A kitchen item to eat.`,
          level3: `A food word.`,
          level4: `A food term.`,
          level5: `A gastronomy word.`
        }
      const tr = document.createElement('tr');
      row.forEach((letter, c) => {
        {
          level1: `Something you can ride in.`,
          level2: `A way to travel.`,
          level3: `A type of vehicle.`,
          level4: `A transport term.`,
          level5: `A transit word.`
        },
        {
          level1: `A ride you can take.`,
          level2: `A vehicle you might see.`,
          level3: `A transport word.`,
          level4: `A travel term.`,
          level5: `A mobility word.`
        }
        }

        {
          level1: `Something from the sea.`,
          level2: `A sea or ocean word.`,
          level3: `An ocean-related word.`,
          level4: `A marine term.`,
          level5: `A nautical word.`
        },
        {
          level1: `A sea creature or thing.`,
          level2: `A thing found in the ocean.`,
          level3: `A marine word.`,
          level4: `A sea-related term.`,
          level5: `An ocean term.`
        }
          numSpan.className = 'num';
          numSpan.textContent = num;
          td.appendChild(numSpan);
    const pool = themed[lower]
      ? themed[lower].map(entry => entry[levelKey] || entry.level3)
      : [
          `A ${length}-letter ${lower} answer`,
          `Related to ${lower}`,
          `Something linked to ${lower}`,
          `Topic: ${tag}`,
          `A ${length}-letter word about ${lower}`
        ];

    const adjusted = pool.map(template => adjustGrammar(template, word));
    return adjusted.filter(t => t && countWords(t) <= 10);
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

        currentPuzzle.inputs.push(input);
        td.appendChild(input);
        syncCellFillState(input);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    gridDiv.appendChild(table);
  }

  function renderClues(placements, numbers) {
    const cluesDiv = document.getElementById('cluesContent');
    if (!cluesDiv) return;

    const mapped = placements
      .map(p => {
        const num = numbers[p.r][p.c];
        if (!num) return null;
        const dir = p.dr === 0 && p.dc === 1 ? 'across' : 'down';
        return { num, dir, clue: p.clue || p.answer };
      })
      .filter(Boolean);

    const across = mapped.filter(c => c.dir === 'across').sort((a, b) => a.num - b.num);
    const down = mapped.filter(c => c.dir === 'down').sort((a, b) => a.num - b.num);

    const renderList = list => list.map(item => `<li><strong>${item.num}.</strong> ${escapeHtml(item.clue)}</li>`).join('') || '<li>No clues yet</li>';

    cluesDiv.innerHTML = `
      <div class="clues">
        <div>
          <h3>Across</h3>
          <ol>${renderList(across)}</ol>
        </div>
        <div>
          <h3>Down</h3>
          <ol>${renderList(down)}</ol>
        </div>
      </div>
    `;
  }

  function toggleAnswers() {
    if (!currentPuzzle) return;
    const show = !currentPuzzle.showingAnswers;
    currentPuzzle.showingAnswers = show;

    currentPuzzle.inputs.forEach(input => {
      const cellId = input.dataset.cell;
      if (show) {
        input.value = input.dataset.answer;
        input.readOnly = true;
      } else {
        input.value = currentPuzzle.userEntries[cellId] || '';
        input.readOnly = false;
      }
      syncCellFillState(input);
      input.classList.remove('correct', 'incorrect');
    });

    const button = document.getElementById('showAnswersBtn');
    button.textContent = show ? 'Hide Answers' : 'Show Answers';
  }

  function resetPuzzleInputs() {
    if (!currentPuzzle) return;
    currentPuzzle.userEntries = {};
    currentPuzzle.showingAnswers = false;
    currentPuzzle.inputs.forEach(input => {
      input.readOnly = false;
      input.value = '';
      syncCellFillState(input);
      input.classList.remove('correct', 'incorrect');
    });
    document.getElementById('showAnswersBtn').textContent = 'Show Answers';
    updateStatus('Puzzle cleared. Happy solving!', 'info');
  }

  function checkPuzzle() {
    if (!currentPuzzle) return;

    let total = 0;
    let correct = 0;

    currentPuzzle.inputs.forEach(input => {
      const expected = input.dataset.answer;
      const value = (input.value || '').toUpperCase();
      total++;
      if (!value) {
        input.classList.remove('correct', 'incorrect');
        return;
      }
      if (value === expected) {
        correct++;
        input.classList.add('correct');
        input.classList.remove('incorrect');
      } else {
        input.classList.add('incorrect');
        input.classList.remove('correct');
      }
    });

    if (correct === total && total > 0) {
      updateStatus('Great job! Puzzle solved!', 'success');
    } else {
      const remaining = total - correct;
      updateStatus(`Keep going! ${remaining} letters still need attention.`, 'info');
    }
  }

  function generateCrossword() {
    const theme = document.getElementById('themeSelect').value;
    const level = document.getElementById('levelSelect').value;
    const sizeInput = parseInt(document.getElementById('sizeInput').value, 10);

    if (!theme) {
      updateStatus('Please select a theme', 'error');
      return;
    }

    updateStatus('Generating crossword...', 'loading');

    setTimeout(() => {
      try {
        const wordList = generateWordList(theme, level, 25);
        const entries = buildEntries(wordList, level);
        if (entries.length === 0) {
          updateStatus('Not enough words for this theme/level.', 'error');
          return;
        }

        let puzzle = null;
        if (!Number.isNaN(sizeInput) && sizeInput > 0) {
          puzzle = buildPuzzle(entries, sizeInput);
        }
        if (!puzzle) {
          puzzle = generateWithResize(entries);
        }

        if (!puzzle) {
          updateStatus('Failed to build crossword. Try a different theme.', 'error');
          return;
        }

        const numbers = computeNumbers(puzzle.grid);
        currentPuzzle = {
          grid: puzzle.grid,
          numbers,
          placements: puzzle.placements,
          userEntries: {},
          showingAnswers: false,
          inputs: []
        };

        renderGrid();
        renderClues(puzzle.placements, numbers);

        updateStatus(`Crossword generated with ${puzzle.placements.length} words`, 'success');

        const showBtn = document.getElementById('showAnswersBtn');
        if (showBtn) {
          showBtn.disabled = false;
          showBtn.textContent = 'Show Answers';
        }
        const printBtn = document.getElementById('printBtn');
        if (printBtn) printBtn.disabled = false;
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) resetBtn.disabled = false;
        const checkBtn = document.getElementById('checkBtn');
        if (checkBtn) checkBtn.disabled = false;
        const saveBtn = document.getElementById('savePngBtn');
        if (saveBtn) saveBtn.disabled = false;
      } catch (error) {
        console.error('Generation error:', error);
        updateStatus('Failed to generate crossword', 'error');
      }
    }, 50);
  }

  document.getElementById('generateBtn').addEventListener('click', generateCrossword);
  document.getElementById('showAnswersBtn').addEventListener('click', toggleAnswers);
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetPuzzleInputs);
  document.getElementById('printBtn').addEventListener('click', () => window.print());
  const checkBtn = document.getElementById('checkBtn');
  if (checkBtn) checkBtn.addEventListener('click', checkPuzzle);
  const saveBtn = document.getElementById('savePngBtn');
  if (saveBtn) saveBtn.addEventListener('click', savePuzzleAsPng);

  const bgSelect = document.getElementById('bgSelect');
  if (bgSelect) {
    applyBackground(bgSelect.value);
    bgSelect.addEventListener('change', event => applyBackground(event.target.value));
  } else {
    applyBackground('transparent');
  }

  loadThemes();
})();
