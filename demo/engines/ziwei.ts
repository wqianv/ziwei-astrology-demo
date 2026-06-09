import { astro } from "iztro";
import { BirthProfile } from "./birth";

export type ZiweiStar = {
  name: string;
  brightness?: string;
  mutagen?: string;
};

export type ZiweiPalaceSummary = {
  key: string;
  name: string;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars: ZiweiStar[];
  minorStars: ZiweiStar[];
  adjectiveStars: string[];
  decadalRange: [number, number];
  isEmpty: boolean;
};

export type ZiweiSummary = {
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  time: string;
  zodiac: string;
  sign: string;
  fiveElementsClass: string;
  soul: string;
  body: string;
  keyPalaces: ZiweiPalaceSummary[];
};

const keyPalaceNames = ["命宫", "官禄", "财帛", "夫妻", "福德", "迁移", "疾厄"];

export function createZiweiSummary(profile: BirthProfile): ZiweiSummary {
  const gender = profile.gender === "male" ? "男" : "女";
  const astrolabe =
    profile.birthdayType === "solar"
      ? astro.bySolar(profile.birthday, profile.birthTime, gender, true, "zh-CN")
      : astro.byLunar(
          profile.birthday,
          profile.birthTime,
          gender,
          profile.isLeapMonth,
          true,
          "zh-CN",
        );

  return {
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    chineseDate: astrolabe.chineseDate,
    time: astrolabe.time,
    zodiac: astrolabe.zodiac,
    sign: astrolabe.sign,
    fiveElementsClass: astrolabe.fiveElementsClass,
    soul: astrolabe.soul,
    body: astrolabe.body,
    keyPalaces: keyPalaceNames
      .map((name) => astrolabe.palace(name as never))
      .filter(Boolean)
      .map((palace) => ({
        key: palace!.name,
        name: palace!.name,
        heavenlyStem: palace!.heavenlyStem,
        earthlyBranch: palace!.earthlyBranch,
        majorStars: palace!.majorStars.map(formatStar),
        minorStars: palace!.minorStars.slice(0, 5).map(formatStar),
        adjectiveStars: palace!.adjectiveStars
          .slice(0, 6)
          .map((star) => star.name),
        decadalRange: palace!.decadal.range,
        isEmpty: palace!.isEmpty(),
      })),
  };
}

function formatStar(star: {
  name: string;
  brightness?: string;
  mutagen?: string;
}): ZiweiStar {
  return {
    name: star.name,
    brightness: star.brightness || undefined,
    mutagen: star.mutagen || undefined,
  };
}
