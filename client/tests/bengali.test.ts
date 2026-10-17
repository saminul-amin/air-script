import { describe, expect, it } from "vitest";
import { BENGALI_LABELS, BENGALI_CONSONANTS, BENGALI_DIGITS, BENGALI_VOWELS, composeBengali } from "../src/recognition/bengali";

describe("Bengali label set", () => {
  it("has 11 vowels, 39 consonants and 10 digits in dataset order", () => {
    expect(BENGALI_VOWELS).toHaveLength(11);
    expect(BENGALI_CONSONANTS).toHaveLength(39);
    expect(BENGALI_DIGITS).toHaveLength(10);
    expect(BENGALI_LABELS.slice(0, 11)).toEqual([...BENGALI_VOWELS]);
    expect(BENGALI_LABELS.slice(11, 50)).toEqual([...BENGALI_CONSONANTS]);
    expect(BENGALI_LABELS.slice(50, 60)).toEqual([...BENGALI_DIGITS]);
  });

  it("has no duplicate labels", () => {
    expect(new Set(BENGALI_LABELS).size).toBe(BENGALI_LABELS.length);
  });
});

describe("composeBengali", () => {
  it("attaches a vowel written after a consonant as its sign", () => {
    expect(composeBengali(["ক", "ি"].map((c) => (c === "ি" ? "ই" : c)))).toBe("কি");
    expect(composeBengali(["ব", "আ", "ং", "ল", "আ"])).toBe("বাংলা");
    expect(composeBengali(["ক", "এ", "ন"])).toBe("কেন");
    // দ+ই→দি; the next আ follows a vowel, not a consonant, so it stays independent.
    expect(composeBengali(["দ", "ই", "আ"])).toBe("দিআ");
  });

  it("drops অ after a consonant, the inherent vowel", () => {
    expect(composeBengali(["ক", "অ", "ল"])).toBe("কল");
  });

  it("keeps vowels independent at a word start, after digits, spaces and ৎ ং ঃ ঁ", () => {
    expect(composeBengali(["অ", "ই"])).toBe("অই");
    expect(composeBengali(["এ", "ক"])).toBe("এক");
    expect(composeBengali(["১", "আ"])).toBe("১আ");
    expect(composeBengali(["ব", " ", "ই"])).toBe("ব ই");
    expect(composeBengali(["ং", "আ"])).toBe("ংআ");
  });

  it("keeps digits and spaces as they are", () => {
    expect(composeBengali(["২", "০", "২", "৬"])).toBe("২০২৬");
    expect(composeBengali(["ক", " ", "ল"])).toBe("ক ল");
  });
});
