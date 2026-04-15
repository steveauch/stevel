const ANSWERS = [
  "APPLE", "BAKER", "BRAVE", "CHAIR", "DREAM", "EARTH", "FLAME", "GLASS",
  "HOUSE", "LIGHT", "MUSIC", "NURSE", "OCEAN", "PLANT", "QUEST", "RIVER",
  "SMILE", "STONE", "TABLE", "TRAIN", "WATER", "YOUNG"
];

const VALID_GUESSES = new Set([
  ...ANSWERS,
  "ABOUT", "ADORE", "ALERT", "ALIEN", "ANGLE", "AWAKE", "BEACH", "BLEND",
  "BLOOM", "BRAIN", "BREAD", "BRICK", "CANDY", "CLOUD", "COAST", "CRANE",
  "DANCE", "DELTA", "EAGER", "FAITH", "FIELD", "FRAME", "FRUIT", "GIANT",
  "GRACE", "GREEN", "HABIT", "HEART", "HONOR", "INDEX", "JUICE", "KNIFE",
  "LASER", "LEMON", "MAGIC", "MAPLE", "MARCH", "METAL", "MIGHT", "MOTOR",
  "NOBLE", "NORTH", "OPERA", "PEARL", "PILOT", "PRIZE", "QUICK", "ROBIN",
  "ROUTE", "SHARE", "SHINE", "SHORE", "SKILL", "SOUND", "SPICE", "STACK",
  "SUNNY", "SWEET", "THINK", "TIGER", "TODAY", "TOUCH", "UNION", "VIVID",
  "VOICE", "WORLD", "WORTH", "YIELD", "ZEBRA"
]);

const KEY_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"]
];

const MAX_ROWS = 6;
const WORD_LENGTH = 5;
const STORAGE_KEY = "stevel-state";
const FAMILY_KEY = "stevel-family-scores";
const DICTIONARY_CACHE_KEY = "stevel-dictionary-cache";
const WORD_BANK_CACHE_KEY = "stevel-word-bank-cache-v1";
const DEFAULT_PLAYER = "Steve";
const DICTIONARY_API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const ONLINE_WORD_BANK_URL = "https://raw.githubusercontent.com/darkermango/5-Letter-words/v1.0.0/words.json";

const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const messageEl = document.getElementById("message");
const gameNumberEl = document.getElementById("game-number");
const resetButton = document.getElementById("reset-button");
const nextGameButton = document.getElementById("next-game-button");
const helpButton = document.getElementById("help-button");
const helpDialog = document.getElementById("help-dialog");
const playerNameEl = document.getElementById("player-name");
const savePlayerButton = document.getElementById("save-player-button");
const scoreboardEl = document.getElementById("scoreboard");
const shareButton = document.getElementById("share-button");
const importButton = document.getElementById("import-button");

let state = createFreshState();
let familyScores = loadFamilyScores();
let dictionaryCache = loadDictionaryCache();
let wordBank = ANSWERS.slice();

function getDefaultGameNumber() {
  return 1;
}

function hashGameNumber(gameNumber) {
  const normalized = String(gameNumber);
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) % 2147483647;
  }

  return hash;
}

function pickAnswerForGame(gameNumber) {
  const bank = wordBank.length > 0 ? wordBank : ANSWERS;
  return bank[hashGameNumber(gameNumber) % bank.length];
}

function createFreshState(overrides = {}) {
  const gameNumber = Number.isInteger(overrides.gameNumber) && overrides.gameNumber > 0
    ? overrides.gameNumber
    : getDefaultGameNumber();
  const playerName = overrides.playerName || DEFAULT_PLAYER;

  return {
    answer: pickAnswerForGame(gameNumber),
    guesses: Array.from({ length: MAX_ROWS }, () => Array(WORD_LENGTH).fill("")),
    evaluations: Array.from({ length: MAX_ROWS }, () => Array(WORD_LENGTH).fill("")),
    rowIndex: 0,
    letterIndex: 0,
    finished: false,
    keyStates: {},
    playerName,
    gameNumber,
    roundRecorded: false
  };
}

function createEmptyPlayerRecord(name) {
  return {
    name,
    played: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    best: null,
    games: {}
  };
}

function sanitizePlayerName(name) {
  return (name || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
}

function loadFamilyScores() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAMILY_KEY));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveFamilyScores() {
  localStorage.setItem(FAMILY_KEY, JSON.stringify(familyScores));
}

function loadDictionaryCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(DICTIONARY_CACHE_KEY));
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function saveDictionaryCache() {
  localStorage.setItem(DICTIONARY_CACHE_KEY, JSON.stringify(dictionaryCache));
}

function loadWordBankCache() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORD_BANK_CACHE_KEY));
    if (!Array.isArray(saved) || saved.length === 0) {
      return null;
    }

    return saved;
  } catch {
    return null;
  }
}

function saveWordBankCache(words) {
  localStorage.setItem(WORD_BANK_CACHE_KEY, JSON.stringify(words));
}

function normalizeWordBank(words) {
  return [...new Set(
    words
      .filter((word) => typeof word === "string")
      .map((word) => word.trim().toUpperCase())
      .filter((word) => /^[A-Z]{5}$/.test(word))
  )];
}

function ensurePlayerRecord(name) {
  const safeName = sanitizePlayerName(name) || DEFAULT_PLAYER;
  if (!familyScores[safeName]) {
    familyScores[safeName] = createEmptyPlayerRecord(safeName);
    saveFamilyScores();
  } else if (!familyScores[safeName].games || typeof familyScores[safeName].games !== "object") {
    familyScores[safeName].games = {};
    saveFamilyScores();
  }
  return safeName;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) {
      return;
    }

    const isValidShape =
      typeof saved.answer === "string" &&
      saved.answer.length === WORD_LENGTH &&
      Array.isArray(saved.guesses) &&
      Array.isArray(saved.evaluations);

    if (!isValidShape) {
      return;
    }

    state = saved;
    state.playerName = ensurePlayerRecord(state.playerName || DEFAULT_PLAYER);
    state.gameNumber = Number.isInteger(saved.gameNumber) && saved.gameNumber > 0 ? saved.gameNumber : getDefaultGameNumber();
    state.answer = pickAnswerForGame(state.gameNumber);
    state.roundRecorded = Boolean(state.roundRecorded);
  } catch {
    state = createFreshState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildScoreboard() {
  const players = Object.values(familyScores).sort((left, right) => {
    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }

    if (left.losses !== right.losses) {
      return left.losses - right.losses;
    }

    return left.name.localeCompare(right.name);
  });

  if (players.length === 0) {
    scoreboardEl.innerHTML = '<p class="empty-scoreboard">No scores yet. Add a player and start a round.</p>';
    return;
  }

  scoreboardEl.innerHTML = "";

  const head = document.createElement("div");
  head.className = "score-row score-head";
  head.innerHTML = `
    <div>Player</div>
    <div class="score-meta">W</div>
    <div class="score-meta">L</div>
    <div class="score-meta">Best</div>
    <div class="score-meta">Streak</div>
  `;
  scoreboardEl.appendChild(head);

  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "score-row";

    if (player.name === state.playerName) {
      row.classList.add("current-player");
    }

    row.innerHTML = `
      <div class="score-name">${player.name}</div>
      <div class="score-meta">${player.wins}</div>
      <div class="score-meta">${player.losses}</div>
      <div class="score-meta">${player.best ?? "-"}</div>
      <div class="score-meta">${player.streak}</div>
    `;

    scoreboardEl.appendChild(row);
  });
}

function updateGameNumberDisplay() {
  gameNumberEl.textContent = String(state.gameNumber);
}

async function initializeWordBank() {
  const cachedBank = loadWordBankCache();
  if (cachedBank && cachedBank.length > 0) {
    wordBank = normalizeWordBank(cachedBank);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(ONLINE_WORD_BANK_URL, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("Failed to fetch word bank");
    }

    const data = await response.json();
    const normalizedBank = normalizeWordBank(data);

    if (normalizedBank.length > 0) {
      wordBank = normalizedBank;
      saveWordBankCache(normalizedBank);
    }
  } catch {
    if (!cachedBank || cachedBank.length === 0) {
      wordBank = ANSWERS.slice();
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildBoard() {
  boardEl.innerHTML = "";

  state.guesses.forEach((row, rowIndex) => {
    const rowEl = document.createElement("div");
    rowEl.className = "board-row";

    row.forEach((letter, letterIndex) => {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${rowIndex}-${letterIndex}`;
      tile.textContent = letter;

      if (letter) {
        tile.classList.add("filled");
      }

      const evaluation = state.evaluations[rowIndex][letterIndex];
      if (evaluation) {
        tile.classList.add(evaluation);
      }

      rowEl.appendChild(tile);
    });

    boardEl.appendChild(rowEl);
  });
}

function buildKeyboard() {
  keyboardEl.innerHTML = "";

  KEY_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";

    row.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.dataset.key = key;
      button.textContent = key === "BACK" ? "Delete" : key;

      if (key === "ENTER" || key === "BACK") {
        button.classList.add("wide");
      }

      const stateClass = state.keyStates[key];
      if (stateClass) {
        button.classList.add(stateClass);
      }

      button.addEventListener("click", () => handleInput(key));
      rowEl.appendChild(button);
    });

    keyboardEl.appendChild(rowEl);
  });
}

function showMessage(text) {
  messageEl.textContent = text;
}

async function lookupWordOnline(word) {
  const normalized = word.toLowerCase();

  if (dictionaryCache[normalized] !== undefined) {
    return dictionaryCache[normalized];
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(`${DICTIONARY_API_URL}${encodeURIComponent(normalized)}`, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      dictionaryCache[normalized] = false;
      saveDictionaryCache();
      return false;
    }

    const data = await response.json();
    const isValid = Array.isArray(data) && data.length > 0;
    dictionaryCache[normalized] = isValid;
    saveDictionaryCache();
    return isValid;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function setActivePlayer(name) {
  const safeName = ensurePlayerRecord(name);
  state.playerName = safeName;
  playerNameEl.value = safeName;
  buildScoreboard();
  saveState();
}

function shakeRow(rowIndex) {
  const row = boardEl.children[rowIndex];
  row.classList.add("shake");
  window.setTimeout(() => row.classList.remove("shake"), 320);
}

function updateTile(rowIndex, letterIndex) {
  const tile = document.getElementById(`tile-${rowIndex}-${letterIndex}`);
  const letter = state.guesses[rowIndex][letterIndex];
  const evaluation = state.evaluations[rowIndex][letterIndex];

  tile.textContent = letter;
  tile.className = "tile";

  if (letter) {
    tile.classList.add("filled");
  }

  if (evaluation) {
    tile.classList.add(evaluation, "reveal");
    window.setTimeout(() => tile.classList.remove("reveal"), 240);
  }
}

function applyKeyState(letter, nextState) {
  const priority = { miss: 0, present: 1, hit: 2 };
  const currentState = state.keyStates[letter];

  if (!currentState || priority[nextState] > priority[currentState]) {
    state.keyStates[letter] = nextState;
  }
}

function evaluateGuess(guess) {
  const answerLetters = state.answer.split("");
  const result = Array(WORD_LENGTH).fill("miss");

  guess.forEach((letter, index) => {
    if (letter === answerLetters[index]) {
      result[index] = "hit";
      answerLetters[index] = null;
    }
  });

  guess.forEach((letter, index) => {
    if (result[index] !== "miss") {
      return;
    }

    const matchIndex = answerLetters.indexOf(letter);
    if (matchIndex !== -1) {
      result[index] = "present";
      answerLetters[matchIndex] = null;
    }
  });

  return result;
}

function revealGuess(evaluation) {
  evaluation.forEach((status, index) => {
    state.evaluations[state.rowIndex][index] = status;
    applyKeyState(state.guesses[state.rowIndex][index], status);
    updateTile(state.rowIndex, index);
  });
}

function recordRound(didWin) {
  if (state.roundRecorded) {
    return;
  }

  const playerName = ensurePlayerRecord(state.playerName);
  const record = familyScores[playerName];
  const gameKey = String(state.gameNumber);

  if (record.games[gameKey]) {
    state.roundRecorded = true;
    buildScoreboard();
    return;
  }

  record.played += 1;

  if (didWin) {
    record.wins += 1;
    record.streak += 1;
    const turnsUsed = state.rowIndex + 1;
    record.best = record.best === null ? turnsUsed : Math.min(record.best, turnsUsed);
  } else {
    record.losses += 1;
    record.streak = 0;
  }

  record.games[gameKey] = {
    won: didWin,
    tries: didWin ? state.rowIndex + 1 : null
  };
  state.roundRecorded = true;
  saveFamilyScores();
  buildScoreboard();
}

async function handleEnter() {
  if (state.letterIndex < WORD_LENGTH) {
    showMessage("Need 5 letters before you can submit.");
    shakeRow(state.rowIndex);
    return;
  }

  const guess = state.guesses[state.rowIndex];
  const guessWord = guess.join("");

  if (!VALID_GUESSES.has(guessWord)) {
    showMessage("Checking the online dictionary...");
    const onlineResult = await lookupWordOnline(guessWord);

    if (onlineResult === true) {
      VALID_GUESSES.add(guessWord);
      showMessage("Word accepted.");
    } else if (onlineResult === false) {
      showMessage("That word is not recognized by the online dictionary.");
      shakeRow(state.rowIndex);
      return;
    } else {
      showMessage("Dictionary check is unavailable right now. Try again when online.");
      shakeRow(state.rowIndex);
      return;
    }
  }

  const evaluation = evaluateGuess(guess);
  revealGuess(evaluation);

  if (guessWord === state.answer) {
    state.finished = true;
    recordRound(true);
    showMessage(`You got it in ${state.rowIndex + 1} ${state.rowIndex === 0 ? "try" : "tries"}!`);
  } else if (state.rowIndex === MAX_ROWS - 1) {
    state.finished = true;
    recordRound(false);
    showMessage(`Round over. The word was ${state.answer}.`);
  } else {
    state.rowIndex += 1;
    state.letterIndex = 0;
    showMessage(`${MAX_ROWS - state.rowIndex} tries left.`);
  }

  buildKeyboard();
  saveState();
}

function handleBackspace() {
  if (state.letterIndex === 0 || state.finished) {
    return;
  }

  state.letterIndex -= 1;
  state.guesses[state.rowIndex][state.letterIndex] = "";
  updateTile(state.rowIndex, state.letterIndex);
  saveState();
}

function handleLetter(letter) {
  if (state.letterIndex >= WORD_LENGTH || state.finished) {
    return;
  }

  state.guesses[state.rowIndex][state.letterIndex] = letter;
  updateTile(state.rowIndex, state.letterIndex);
  state.letterIndex += 1;
  saveState();
}

async function handleInput(key) {
  if (key === "ENTER") {
    await handleEnter();
    return;
  }

  if (key === "BACK") {
    handleBackspace();
    return;
  }

  if (/^[A-Z]$/.test(key)) {
    handleLetter(key);
  }
}

function resetGame() {
  const playerName = ensurePlayerRecord(state.playerName || DEFAULT_PLAYER);
  state = createFreshState({
    gameNumber: state.gameNumber,
    playerName
  });
  buildBoard();
  buildKeyboard();
  buildScoreboard();
  updateGameNumberDisplay();
  showMessage("You have 6 tries.");
  saveState();
}

function nextGame() {
  const playerName = ensurePlayerRecord(state.playerName || DEFAULT_PLAYER);
  state = createFreshState({
    gameNumber: state.gameNumber + 1,
    playerName
  });
  buildBoard();
  buildKeyboard();
  buildScoreboard();
  updateGameNumberDisplay();
  showMessage(`Game ${state.gameNumber} is ready.`);
  saveState();
}

function registerHardwareKeyboard() {
  window.addEventListener("keydown", async (event) => {
    const target = document.activeElement || event.target;
    const isEditableField =
      target instanceof HTMLElement &&
      (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );

    if (isEditableField) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      await handleInput("ENTER");
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      handleInput("BACK");
      return;
    }

    const letter = event.key.toUpperCase();
    if (/^[A-Z]$/.test(letter)) {
      await handleInput(letter);
    }
  });
}

function initDialog() {
  helpButton.addEventListener("click", () => helpDialog.showModal());
}

function initControls() {
  resetButton.addEventListener("click", resetGame);
  nextGameButton.addEventListener("click", nextGame);
  savePlayerButton.addEventListener("click", () => {
    const nextName = sanitizePlayerName(playerNameEl.value);
    if (!nextName) {
      showMessage("Enter a player name for the family scoreboard.");
      return;
    }

    setActivePlayer(nextName);
    showMessage(`${nextName} is ready to play.`);
  });

  shareButton.addEventListener("click", async () => {
    const players = Object.values(familyScores);
    if (players.length === 0) {
      showMessage("No standings to copy yet.");
      return;
    }

    const lines = players
      .sort((left, right) => right.wins - left.wins || left.losses - right.losses || left.name.localeCompare(right.name))
      .map((player, index) => `${index + 1}. ${player.name}  W:${player.wins}  L:${player.losses}  Best:${player.best ?? "-"}  Streak:${player.streak}`);

    const payload = `Stevel Family Standings\n${lines.join("\n")}\n\nImport code:\n${JSON.stringify(familyScores)}`;

    try {
      await navigator.clipboard.writeText(payload);
      showMessage("Standings copied. Family can paste the import code on another phone.");
    } catch {
      showMessage("Clipboard access failed. Try copying from a browser that allows clipboard access.");
    }
  });

  importButton.addEventListener("click", () => {
    const incoming = window.prompt("Paste Stevel family score data here.");
    if (!incoming) {
      return;
    }

    const jsonStart = incoming.indexOf("{");
    if (jsonStart === -1) {
      showMessage("That import did not contain valid score data.");
      return;
    }

    try {
      const imported = JSON.parse(incoming.slice(jsonStart));
      Object.entries(imported).forEach(([name, record]) => {
        const safeName = sanitizePlayerName(name);
        if (!safeName || !record || typeof record !== "object") {
          return;
        }

        const existing = familyScores[safeName] || createEmptyPlayerRecord(safeName);
        familyScores[safeName] = {
          name: safeName,
          played: Math.max(existing.played, Number(record.played) || 0),
          wins: Math.max(existing.wins, Number(record.wins) || 0),
          losses: Math.max(existing.losses, Number(record.losses) || 0),
          streak: Math.max(existing.streak, Number(record.streak) || 0),
          best: existing.best === null ? (Number(record.best) || null) : (
            Number(record.best) ? Math.min(existing.best, Number(record.best)) : existing.best
          ),
          games: {
            ...(existing.games && typeof existing.games === "object" ? existing.games : {}),
            ...(record.games && typeof record.games === "object" ? record.games : {})
          }
        };
      });

      saveFamilyScores();
      buildScoreboard();
      showMessage("Family standings imported.");
    } catch {
      showMessage("That import could not be read.");
    }
  });
}

async function init() {
  loadState();
  await initializeWordBank();
  state.answer = pickAnswerForGame(state.gameNumber);
  ensurePlayerRecord(state.playerName || DEFAULT_PLAYER);
  buildBoard();
  buildKeyboard();
  buildScoreboard();
  updateGameNumberDisplay();
  registerHardwareKeyboard();
  initControls();
  initDialog();
  playerNameEl.value = state.playerName || DEFAULT_PLAYER;

  if (state.finished) {
    if (state.guesses[state.rowIndex].join("") === state.answer) {
      showMessage(`You won. Tap New Round to play again.`);
    } else {
      showMessage(`Round over. The word was ${state.answer}.`);
    }
  }
}

init();
