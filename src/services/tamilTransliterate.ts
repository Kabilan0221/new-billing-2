/**
 * Offline Tamil Phonetic Transliteration Engine (Tanglish -> தமிழ் Unicode)
 * Specially tuned for commercial retail grocery, supermarket, hardware and provisions catalog.
 */

// Common Retail, Grocery & Supermarket Dictionary for 100% accurate standard Tamil names
export const COMMON_DICTIONARY: Record<string, string> = {
  // Staples & Rice
  arisi: 'அரிசி',
  rice: 'அரிசி',
  ponni: 'பொன்னி',
  rawrice: 'பச்சரிசி',
  pachcharisi: 'பச்சரிசி',
  pacharisi: 'பச்சரிசி',
  puzhungal: 'புழுங்கல்',
  idli: 'இட்லி',
  idly: 'இட்லி',
  dosa: 'தோசை',
  dosai: 'தோசை',
  seeragasamba: 'சீரகச்சம்பா',
  samba: 'சம்பா',
  basmati: 'பாஸ்மதி',
  boiledrice: 'புழுங்கல் அரிசி',

  // Pulses & Dhalls
  paruppu: 'பருப்பு',
  dhal: 'பருப்பு',
  dal: 'பருப்பு',
  dhall: 'பருப்பு',
  thuvaram: 'துவரம்',
  toordal: 'துவரம் பருப்பு',
  toor: 'துவரம்',
  ulunthu: 'உளுந்து',
  urad: 'உளுந்து',
  uraddal: 'உளுத்தம் பருப்பு',
  ulunthuparuppu: 'உளுத்தம் பருப்பு',
  pasi: 'பாசி',
  pasiparuppu: 'பாசிப்பருப்பு',
  moong: 'பாசிப்பருப்பு',
  moongdal: 'பாசிப்பருப்பு',
  kadalai: 'கடலை',
  kadalaiparuppu: 'கடலைப்பருப்பு',
  chana: 'கொண்டைக்கடலை',
  chanadal: 'கடலைப்பருப்பு',
  kondaikadalai: 'கொண்டைக்கடலை',
  pottukadalai: 'பொட்டுக்கடலை',
  kollu: 'கொள்ளு',
  thattaipayiru: 'தட்டப்பயிறு',
  payiru: 'பயிறு',
  rajma: 'ராஜ்மா',
  mochai: 'மொச்சை',

  // Oils & Ghee
  ennai: 'எண்ணெய்',
  oil: 'ஆயில்',
  nallennai: 'நல்லெண்ணெய்',
  gingelly: 'நல்லெண்ணெய்',
  kadugennai: 'கடுகெண்ணெய்',
  thegai: 'தேங்காய்',
  thengaai: 'தேங்காய்',
  thengaiennai: 'தேங்காய் எண்ணெய்',
  coconut: 'தேங்காய்',
  coconutoil: 'தேங்காய் எண்ணெய்',
  kadalaiennai: 'கடலை எண்ணெய்',
  groundnutoil: 'கடலை எண்ணெய்',
  groundnut: 'வேர்க்கடலை',
  verkkadalai: 'வேர்க்கடலை',
  sunfloweroil: 'சூரியகாந்தி எண்ணெய்',
  sunflower: 'சூரியகாந்தி',
  deepam: 'தீபம்',
  deepamennai: 'தீப எண்ணெய்',
  nei: 'நெய்',
  ghee: 'நெய்',
  vanaspati: 'வனஸ்பதி',
  dalda: 'டால்டா',

  // Spices & Condiments
  sakkarai: 'சர்க்கரை',
  sarkarai: 'சர்க்கரை',
  sugar: 'சர்க்கரை',
  nattu: 'நாட்டு',
  nattusakkarai: 'நாட்டுச்சர்க்கரை',
  nattusarkarai: 'நாட்டுச்சர்க்கரை',
  vellam: 'வெல்லம்',
  jaggery: 'வெல்லம்',
  karupatti: 'கருப்பட்டி',
  kalkandu: 'கற்கண்டு',
  uppu: 'உப்பு',
  salt: 'உப்பு',
  kalluppu: 'கல்லுப்பு',
  thooluppu: 'தூளுப்பு',
  kadugu: 'கடுகு',
  mustard: 'கடுகு',
  seeragam: 'சீரகம்',
  jeera: 'சீரகம்',
  cumin: 'சீரகம்',
  sombu: 'சோம்பு',
  fennel: 'சோம்பு',
  milagu: 'மிளகு',
  pepper: 'மிளகு',
  milagai: 'மிளகாய்',
  chilli: 'மிளகாய்',
  chillies: 'மிளகாய்',
  redchilli: 'சிகப்பு மிளகாய்',
  kanchamilagai: 'காய்ந்த மிளகாய்',
  pachaamilagai: 'பச்சை மிளகாய்',
  greenchilli: 'பச்சை மிளகாய்',
  manjal: 'மஞ்சள்',
  turmeric: 'மஞ்சள்',
  manjalthool: 'மஞ்சள் தூள்',
  vendhayam: 'வெந்தயம்',
  fenugreek: 'வெந்தயம்',
  perungayam: 'பெருங்காயம்',
  asafoetida: 'பெருங்காயம்',
  elakkai: 'ஏலக்காய்',
  cardamom: 'ஏலக்காய்',
  lavangam: 'லவங்கம்',
  clove: 'கிராம்பு',
  grambu: 'கிராம்பு',
  pattai: 'பட்டை',
  cinnamon: 'பட்டை',
  biriyanielai: 'பிரியாணி இலை',
  poondu: 'பூண்டு',
  garlic: 'பூண்டு',
  inji: 'இஞ்சி',
  ginger: 'இஞ்சி',
  puli: 'புளி',
  tamarind: 'புளி',
  thool: 'தூள்',
  podi: 'பொடி',
  powder: 'பவுடர்',
  masala: 'மசாலா',
  sambarpodi: 'சாம்பார் பொடி',
  rasampodi: 'ரசம் பொடி',

  // Flours & Grains
  maavu: 'மாவு',
  flour: 'மாவு',
  atta: 'ஆட்டா',
  gothumai: 'கோதுமை',
  wheat: 'கோதுமை',
  gothumaimaavu: 'கோதுமை மாவு',
  maida: 'மைதா',
  maidha: 'மைதா',
  rava: 'ரவை',
  ravai: 'ரவை',
  sooji: 'ரவை',
  semiya: 'சேமியா',
  vermicelli: 'சேமியா',
  arishimaavu: 'அரிசி மாவு',
  kadalaimaavu: 'கடலை மாவு',
  besan: 'கடலை மாவு',
  cornflour: 'கார்ன் ஃப்ளவர்',
  aval: 'அவல்',
  poha: 'அவல்',
  appalam: 'அப்பளம்',
  papad: 'அப்பளம்',
  vadagam: 'வடகம்',
  oorugai: 'ஊறுகாய்',
  pickle: 'ஊறுகாய்',

  // Vegetables & Essentials
  vengayam: 'வெங்காயம்',
  onion: 'வெங்காயம்',
  chinnavengayam: 'சின்ன வெங்காயம்',
  periyavengayam: 'பெரிய வெங்காயம்',
  thakkali: 'தக்காளி',
  tomato: 'தக்காளி',
  urulaikilangu: 'உருளைக்கிழங்கு',
  potato: 'உருளைக்கிழங்கு',
  koththamalli: 'கொத்தமல்லி',
  coriander: 'கொத்தமல்லி',
  karuveppilai: 'கருவேப்பிலை',
  curryleaves: 'கருவேப்பிலை',
  pudhina: 'புதினா',
  mint: 'புதினா',

  // Dairy & Beverages
  paal: 'பால்',
  milk: 'பால்',
  thayir: 'தயிர்',
  curd: 'தயிர்',
  mor: 'மோர்',
  vennai: 'வெண்ணெய்',
  butter: 'வெண்ணெய்',
  panneer: 'பன்னீர்',
  paneer: 'பன்னீர்',
  tea: 'டீ',
  theeneer: 'டீ தூள்',
  teapowder: 'டீ தூள்',
  coffee: 'காபி',
  kaapi: 'காபி',
  coffeepowder: 'காபி தூள்',

  // Household, Personal Care & Units
  soap: 'சோப்',
  soppu: 'சோப்',
  biscuit: 'பிஸ்கட்',
  detergent: 'சலவை தூள்',
  shampoo: 'ஷாம்பு',
  toothpaste: 'டூத் பேஸ்ட்',
  paste: 'பேஸ்ட்',
  brush: 'பிரஷ்',
  theepetti: 'தீப்பெட்டி',
  matchbox: 'தீப்பெட்டி',
  agarbathi: 'அகர்பத்தி',
  sambirani: 'சாம்பிராணி',
  karpuram: 'கற்பூரம்',
  camphor: 'கற்பூரம்',
  dabba: 'டப்பா',
  packet: 'பாக்கெட்',
  pkt: 'பாக்கெட்',
  bag: 'பை',
  kg: 'கிலோ',
  kilo: 'கிலோ',
  g: 'கிராம்',
  gm: 'கிராம்',
  gram: 'கிராம்',
  l: 'லிட்டர்',
  ltr: 'லிட்டர்',
  litre: 'லிட்டர்',
  ml: 'மி.லி',
  pcs: 'எண்ணிக்கை',
  piece: 'பீஸ்',
  box: 'பாக்ஸ்',
  bottle: 'பாட்டில்',
  tin: 'டின்',
  can: 'கேன்',
  bundle: 'கட்டு',
  kattu: 'கட்டு',
};

// Independent Vowels (உயிர் எழுத்துக்கள்)
const INDEPENDENT_VOWELS: Record<string, string> = {
  aa: 'ஆ',
  A: 'ஆ',
  a: 'அ',
  ii: 'ஈ',
  ee: 'ஈ',
  I: 'ஈ',
  i: 'இ',
  uu: 'ஊ',
  oo: 'ஊ',
  U: 'ஊ',
  u: 'உ',
  ae: 'ஏ',
  ea: 'ஏ',
  E: 'ஏ',
  e: 'எ',
  ai: 'ஐ',
  oa: 'ஓ',
  O: 'ஓ',
  o: 'ஒ',
  au: 'ஔ',
  ou: 'ஔ',
  ak: 'ஃ',
  q: 'ஃ',
};

// Vowel signs (உயிர்மெய் குறிகள்) attached to a base consonant
const VOWEL_SIGNS: [string, string][] = [
  ['aai', '\u0BBE\u0BAF\u0BCD'], // ாய்
  ['aau', '\u0BBE\u0BB5\u0BCD'], // ாவ்
  ['aa', '\u0BBE'],  // ா
  ['A', '\u0BBE'],
  ['ii', '\u0BC0'],  // ீ
  ['ee', '\u0BC0'],  // ீ
  ['I', '\u0BC0'],
  ['i', '\u0BBF'],   // ி
  ['uu', '\u0BC2'],  // ூ
  ['oo', '\u0BC2'],  // ூ
  ['U', '\u0BC2'],
  ['u', '\u0BC1'],   // ு
  ['ae', '\u0BC7'],  // ே
  ['ea', '\u0BC7'],  // ே
  ['E', '\u0BC7'],
  ['e', '\u0BC6'],   // ெ
  ['ai', '\u0BC8'],  // ை
  ['oa', '\u0BCB'],  // ோ
  ['O', '\u0BCB'],
  ['o', '\u0BCA'],   // ொ
  ['au', '\u0BCC'],  // ௌ
  ['ou', '\u0BCC'],
  ['a', ''],         // Inherent vowel, removes virama
];

// Base consonants without virama
const CONSONANT_BASE: Record<string, string> = {
  k: 'க',
  g: 'க',
  kh: 'க',
  gh: 'க',
  ng: 'ங',
  ch: 'ச',
  c: 'ச',
  s: 'ச',
  j: 'ஜ',
  jh: 'ஜ',
  nj: 'ஞ',
  gn: 'ஞ',
  th: 'த',
  dh: 'த',
  t: 'ட',
  d: 'ட',
  T: 'ட',
  D: 'ட',
  N: 'ண',
  nh: 'ந',
  n: 'ந',
  p: 'ப',
  b: 'ப',
  ph: 'ப',
  bh: 'ப',
  m: 'ம',
  y: 'ய',
  r: 'ர',
  R: 'ற',
  l: 'ல',
  L: 'ள',
  v: 'வ',
  w: 'வ',
  zh: 'ழ',
  z: 'ழ',
  sh: 'ஷ',
  S: 'ஸ',
  h: 'ஹ',
  nn: 'ன',
  ksh: 'க்ஷ',
};

const CONSONANT_KEYS = Object.keys(CONSONANT_BASE).sort((a, b) => b.length - a.length);
const INDEPENDENT_VOWEL_KEYS = Object.keys(INDEPENDENT_VOWELS).sort((a, b) => b.length - a.length);

/**
 * Checks if a string contains any Tamil Unicode characters (U+0B80 - U+0BFF).
 */
export function isTamilText(text: string): boolean {
  return /[\u0B80-\u0BFF]/.test(text);
}

/**
 * Transliterates a single Tanglish word into Tamil.
 */
export function transliterateWord(rawWord: string): string {
  if (!rawWord) return '';

  // If already contains Tamil Unicode, return as-is
  if (isTamilText(rawWord)) {
    return rawWord;
  }

  // Preserve pure numbers or pure symbols
  if (!/[a-zA-Z]/.test(rawWord)) {
    return rawWord;
  }

  // Check common supermarket dictionary first
  const lower = rawWord.toLowerCase();
  if (COMMON_DICTIONARY[lower]) {
    return COMMON_DICTIONARY[lower];
  }

  let result = '';
  let i = 0;
  const word = rawWord;
  const len = word.length;

  while (i < len) {
    const ch = word[i];

    // Preserve numbers, symbols, and non-letters as-is
    if (!/[a-zA-Z]/.test(ch)) {
      result += ch;
      i++;
      continue;
    }

    // Special prefix: 'sri' or 'shree' -> ஸ்ரீ
    if (word.substring(i, i + 5).toLowerCase() === 'shree') {
      result += 'ஸ்ரீ';
      i += 5;
      continue;
    }
    if (word.substring(i, i + 3).toLowerCase() === 'sri') {
      result += 'ஸ்ரீ';
      i += 3;
      continue;
    }

    // Check for consonant match at position i
    let matchedConsonant: string | null = null;
    let consonantKey = '';

    for (const key of CONSONANT_KEYS) {
      const sub = word.substring(i, i + key.length);
      const matches = (key === 'T' || key === 'D' || key === 'N' || key === 'R' || key === 'S')
        ? sub === key
        : sub.toLowerCase() === key.toLowerCase();

      if (matches) {
        matchedConsonant = CONSONANT_BASE[key];
        consonantKey = key;
        i += key.length;
        break;
      }
    }

    if (matchedConsonant) {
      // Look ahead for vowel sign
      let matchedVowelSign: string | null = null;
      let vowelLen = 0;

      for (const [vKey, vSign] of VOWEL_SIGNS) {
        const sub = word.substring(i, i + vKey.length);
        const matches = (vKey === 'A' || vKey === 'I' || vKey === 'U' || vKey === 'E' || vKey === 'O')
          ? sub === vKey
          : sub.toLowerCase() === vKey.toLowerCase();

        if (matches) {
          matchedVowelSign = vSign;
          vowelLen = vKey.length;
          break;
        }
      }

      if (matchedVowelSign !== null) {
        // Consonant + Vowel
        let base = matchedConsonant;
        if (consonantKey.toLowerCase() === 'n' && i - consonantKey.length > 0) {
          base = 'ன';
        }
        result += base + matchedVowelSign;
        i += vowelLen;
      } else {
        // Consonant without vowel (Virama / புள்ளி)
        let base = matchedConsonant;
        if (consonantKey.toLowerCase() === 'n' && (i >= len || !/[a-zA-Z]/.test(word[i]))) {
          base = 'ன';
        }
        result += base + '\u0BCD'; // Add virama ்
      }
      continue;
    }

    // Check for independent vowel match at position i (start of syllable)
    let matchedIndVowel: string | null = null;
    let indVowelLen = 0;

    for (const key of INDEPENDENT_VOWEL_KEYS) {
      const sub = word.substring(i, i + key.length);
      const matches = (key === 'A' || key === 'I' || key === 'U' || key === 'E' || key === 'O')
        ? sub === key
        : sub.toLowerCase() === key.toLowerCase();

      if (matches) {
        matchedIndVowel = INDEPENDENT_VOWELS[key];
        indVowelLen = key.length;
        break;
      }
    }

    if (matchedIndVowel) {
      result += matchedIndVowel;
      i += indVowelLen;
      continue;
    }

    // Fallback: character couldn't be matched, keep as-is
    result += ch;
    i++;
  }

  return result;
}

/**
 * Transliterates an entire text string (containing multiple words, numbers, slashes, etc.)
 * e.g. "Ponni Arisi 5kg" -> "பொன்னி அரிசி 5கிலோ" or preserves English if mixed
 */
export function transliterateTamil(text: string): string {
  if (!text) return '';

  // Split text by word boundaries while preserving whitespace, punctuation, and digit/letter transitions
  const tokens = text.split(/([ \t\n\r\/\\\-+*.,()[\]{}|:;!?]+|(?<=\d)(?=[a-zA-Z])|(?<=[a-zA-Z])(?=\d))/);

  return tokens
    .map((token) => {
      if (!token) return '';
      // If token is delimiter or already purely non-English, keep as-is
      if (/^[ \t\n\r\/\\\-+*.,()[\]{}|:;!?]+$/.test(token) || !/[a-zA-Z]/.test(token)) {
        return token;
      }
      return transliterateWord(token);
    })
    .join('');
}
