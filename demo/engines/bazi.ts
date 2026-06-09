import { Solar } from "lunar-typescript";
import { BirthProfile } from "./birth";

export type PillarName = "年柱" | "月柱" | "日柱" | "时柱";

export type BaziPillar = {
  name: PillarName;
  ganzhi: string;
  stem: string;
  branch: string;
  stemTenGod: string;
  branchTenGods: string[];
  hiddenStems: string[];
  wuXing: string;
  naYin: string;
  diShi: string;
  xunKong: string;
};

export type ElementCount = {
  name: string;
  count: number;
};

export type DaYunItem = {
  index: number;
  ganzhi: string;
  startAge: number;
  endAge: number;
  startYear: number;
  endYear: number;
};

export type BaziChart = {
  pillars: BaziPillar[];
  dayMaster: {
    stem: string;
    element: string;
    yinYang: string;
  };
  lunarText: string;
  solarText: string;
  elementCounts: ElementCount[];
  naYin: string[];
  tenGods: string[];
  daYun: {
    forward: boolean;
    startsAfter: string;
    items: DaYunItem[];
  };
  notes: string[];
};

const elements = ["木", "火", "土", "金", "水"];
const stemElement: Record<string, { element: string; yinYang: string }> = {
  甲: { element: "木", yinYang: "阳" },
  乙: { element: "木", yinYang: "阴" },
  丙: { element: "火", yinYang: "阳" },
  丁: { element: "火", yinYang: "阴" },
  戊: { element: "土", yinYang: "阳" },
  己: { element: "土", yinYang: "阴" },
  庚: { element: "金", yinYang: "阳" },
  辛: { element: "金", yinYang: "阴" },
  壬: { element: "水", yinYang: "阳" },
  癸: { element: "水", yinYang: "阴" },
};

export function createBaziChart(profile: BirthProfile): BaziChart {
  const lunar = Solar.fromYmdHms(
    profile.solar.year,
    profile.solar.month,
    profile.solar.day,
    profile.hour,
    profile.minute,
    0,
  ).getLunar();
  const eightChar = lunar.getEightChar();
  const pillars: BaziPillar[] = [
    {
      name: "年柱",
      ganzhi: eightChar.getYear(),
      stem: eightChar.getYearGan(),
      branch: eightChar.getYearZhi(),
      stemTenGod: eightChar.getYearShiShenGan(),
      branchTenGods: eightChar.getYearShiShenZhi(),
      hiddenStems: eightChar.getYearHideGan(),
      wuXing: eightChar.getYearWuXing(),
      naYin: eightChar.getYearNaYin(),
      diShi: eightChar.getYearDiShi(),
      xunKong: eightChar.getYearXunKong(),
    },
    {
      name: "月柱",
      ganzhi: eightChar.getMonth(),
      stem: eightChar.getMonthGan(),
      branch: eightChar.getMonthZhi(),
      stemTenGod: eightChar.getMonthShiShenGan(),
      branchTenGods: eightChar.getMonthShiShenZhi(),
      hiddenStems: eightChar.getMonthHideGan(),
      wuXing: eightChar.getMonthWuXing(),
      naYin: eightChar.getMonthNaYin(),
      diShi: eightChar.getMonthDiShi(),
      xunKong: eightChar.getMonthXunKong(),
    },
    {
      name: "日柱",
      ganzhi: eightChar.getDay(),
      stem: eightChar.getDayGan(),
      branch: eightChar.getDayZhi(),
      stemTenGod: eightChar.getDayShiShenGan(),
      branchTenGods: eightChar.getDayShiShenZhi(),
      hiddenStems: eightChar.getDayHideGan(),
      wuXing: eightChar.getDayWuXing(),
      naYin: eightChar.getDayNaYin(),
      diShi: eightChar.getDayDiShi(),
      xunKong: eightChar.getDayXunKong(),
    },
    {
      name: "时柱",
      ganzhi: eightChar.getTime(),
      stem: eightChar.getTimeGan(),
      branch: eightChar.getTimeZhi(),
      stemTenGod: eightChar.getTimeShiShenGan(),
      branchTenGods: eightChar.getTimeShiShenZhi(),
      hiddenStems: eightChar.getTimeHideGan(),
      wuXing: eightChar.getTimeWuXing(),
      naYin: eightChar.getTimeNaYin(),
      diShi: eightChar.getTimeDiShi(),
      xunKong: eightChar.getTimeXunKong(),
    },
  ];
  const dayMaster = {
    stem: eightChar.getDayGan(),
    element: stemElement[eightChar.getDayGan()]?.element ?? "",
    yinYang: stemElement[eightChar.getDayGan()]?.yinYang ?? "",
  };
  const elementCounts = countVisibleElements(pillars);
  const yun = eightChar.getYun(profile.gender === "male" ? 1 : 0);
  const daYunItems = yun
    .getDaYun(9)
    .filter((item) => item.getGanZhi())
    .map((item) => ({
      index: item.getIndex(),
      ganzhi: item.getGanZhi(),
      startAge: item.getStartAge(),
      endAge: item.getEndAge(),
      startYear: item.getStartYear(),
      endYear: item.getEndYear(),
    }));

  return {
    pillars,
    dayMaster,
    lunarText: lunar.toFullString(),
    solarText: `${profile.labels.solarDate} ${profile.labels.birthTime}`,
    elementCounts,
    naYin: pillars.map((pillar) => pillar.naYin),
    tenGods: unique(
      pillars.flatMap((pillar) => [
        pillar.stemTenGod,
        ...pillar.branchTenGods,
      ]),
    ).filter((item) => item && item !== "日主"),
    daYun: {
      forward: yun.isForward(),
      startsAfter: `${yun.getStartYear()}年${yun.getStartMonth()}月${yun.getStartDay()}日`,
      items: daYunItems,
    },
    notes: buildNotes(dayMaster, elementCounts, pillars, daYunItems),
  };
}

function countVisibleElements(pillars: BaziPillar[]): ElementCount[] {
  const counts = Object.fromEntries(elements.map((element) => [element, 0]));

  pillars.forEach((pillar) => {
    Array.from(pillar.wuXing).forEach((element) => {
      counts[element] += 1;
    });
  });

  return elements.map((name) => ({ name, count: counts[name] }));
}

function buildNotes(
  dayMaster: BaziChart["dayMaster"],
  elementCounts: ElementCount[],
  pillars: BaziPillar[],
  daYunItems: DaYunItem[],
): string[] {
  const sorted = [...elementCounts].sort((a, b) => b.count - a.count);
  const strongest = sorted.filter((item) => item.count === sorted[0].count);
  const missing = sorted.filter((item) => item.count === 0);
  const monthPillar = pillars[1];
  const firstLuck = daYunItems[0];

  return [
    `日主为${dayMaster.yinYang}${dayMaster.element}${dayMaster.stem}，先以日干作为八字分析中心。`,
    `可见五行中${strongest.map((item) => item.name).join("、")}较突出${
      missing.length ? `，${missing.map((item) => item.name).join("、")}未见` : ""
    }。`,
    `月令落在${monthPillar.ganzhi}，月支${monthPillar.branch}是后续判断旺衰和格局的入口。`,
    firstLuck
      ? `首个完整大运为${firstLuck.ganzhi}，约${firstLuck.startAge}-${firstLuck.endAge}岁，对应${firstLuck.startYear}-${firstLuck.endYear}年。`
      : "大运数据已生成，后续可以接入流年合参。",
  ];
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}
