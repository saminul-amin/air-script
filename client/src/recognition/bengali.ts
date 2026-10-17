/**
 * Bengali (বাংলা) label set and the composition rule for building words.
 *
 * The class order mirrors `BENGALI_LABELS` in `ai-service/model_bn.py`
 * (BanglaLekha-Isolated folder order): 11 vowels, 39 consonants, 10 digits,
 * then the dataset's 24 compound characters.
 */

export const BENGALI_VOWELS = ["অ", "আ", "ই", "ঈ", "উ", "ঊ", "ঋ", "এ", "ঐ", "ও", "ঔ"] as const;

export const BENGALI_CONSONANTS = [
  "ক", "খ", "গ", "ঘ", "ঙ",
  "চ", "ছ", "জ", "ঝ", "ঞ",
  "ট", "ঠ", "ড", "ঢ", "ণ",
  "ত", "থ", "দ", "ধ", "ন",
  "প", "ফ", "ব", "ভ", "ম",
  "য", "র", "ল", "শ", "ষ", "স", "হ",
  "ড়", "ঢ়", "য়", "ৎ", "ং", "ঃ", "ঁ",
] as const;

export const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;

/**
 * Folders 61–84 of BanglaLekha-Isolated. The dataset ships no character list
 * for these; this is a reading of the handwriting by eye, cross-checked by
 * classifying printed glyphs with the trained model, and still to be verified
 * by a native speaker. Must stay identical to COMPOUNDS in ai-service/model_bn.py.
 */
export const BENGALI_COMPOUNDS: readonly string[] = [
  "ক্ষ", "ব্দ", "ঙ্ক", "ষ্ণ", "স্ক", "স্থ",
  "চ্ছ", "ত্ত", "স্ন", "ষ্ট", "ম্প", "স্ম",
  "প্ত", "ম্ব", "ঙ্গ", "দ্ধ", "শ্চ", "ষ্ঠ",
  "ল্প", "ষ্প", "ন্দ", "ন্ধ", "ম্ম", "ক্ত",
];

export const BENGALI_LABELS: readonly string[] = [...BENGALI_VOWELS, ...BENGALI_CONSONANTS, ...BENGALI_DIGITS, ...BENGALI_COMPOUNDS];

/**
 * Independent vowel → its dependent form (কার), the sign that attaches to a
 * preceding consonant. অ has no sign: it is the inherent vowel of every
 * consonant, so ক + অ stays ক.
 */
export const VOWEL_SIGNS: Readonly<Record<string, string>> = {
  "অ": "",
  "আ": "া",
  "ই": "ি",
  "ঈ": "ী",
  "উ": "ু",
  "ঊ": "ূ",
  "ঋ": "ৃ",
  "এ": "ে",
  "ঐ": "ৈ",
  "ও": "ো",
  "ঔ": "ৌ",
};

/** Consonants that can carry a vowel sign. ৎ ং ঃ ঁ cannot. */
const SIGN_CARRIERS = new Set<string>([...BENGALI_CONSONANTS].filter((c) => !["ৎ", "ং", "ঃ", "ঁ"].includes(c)));

/** Consonants, compounds and the anusvara-like marks: anything that is not a vowel or a digit. */
export function isBengaliConsonant(label: string): boolean {
  return SIGN_CARRIERS.has(label) || BENGALI_COMPOUNDS.includes(label);
}

export function isBengaliVowel(label: string): boolean {
  return (BENGALI_VOWELS as readonly string[]).includes(label);
}

/**
 * The composition rule: an independent vowel recognised right after a
 * consonant (or a compound) becomes that vowel's sign, so ক then ি reads কি
 * and ব আ ং ল আ reads বাংলা. Vowels at the start of a word, after a digit,
 * after a space, or after ৎ ং ঃ ঁ stay independent (অই, এক, ওরা).
 *
 * What this cannot write in v1: an independent vowel directly after a
 * consonant inside a word (বই, কই, দই need a space before the vowel), words
 * that need conjuncts outside the dataset's 24 compounds, and the signs
 * written with a hasanta (্) or the য-ফলা / র-ফলা forms.
 */
export function composeBengali(labels: readonly string[]): string {
  let out = "";
  let previous: string | null = null;
  for (const label of labels) {
    if (isBengaliVowel(label) && previous !== null && isBengaliConsonant(previous)) {
      out += VOWEL_SIGNS[label] ?? label;
    } else {
      out += label;
    }
    previous = label;
  }
  return out;
}
