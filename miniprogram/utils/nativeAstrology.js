const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const branches = [
  "子",
  "丑",
  "寅",
  "卯",
  "辰",
  "巳",
  "午",
  "未",
  "申",
  "酉",
  "戌",
  "亥",
];
const elements = ["木", "火", "土", "金", "水"];
const elementByStem = {
  甲: "木",
  乙: "木",
  丙: "火",
  丁: "火",
  戊: "土",
  己: "土",
  庚: "金",
  辛: "金",
  壬: "水",
  癸: "水",
};

const birthTimes = [
  "早子 00:00-01:00",
  "丑 01:00-03:00",
  "寅 03:00-05:00",
  "卯 05:00-07:00",
  "辰 07:00-09:00",
  "巳 09:00-11:00",
  "午 11:00-13:00",
  "未 13:00-15:00",
  "申 15:00-17:00",
  "酉 17:00-19:00",
  "戌 19:00-21:00",
  "亥 21:00-23:00",
  "晚子 23:00-00:00",
];

const genderOptions = [
  { label: "男", value: "male" },
  { label: "女", value: "female" },
];

function buildNativeProfile({ birthDate, birthTimeIndex, gender }) {
  const parsed = parseDate(birthDate);
  const yearPillar = sexagenary(parsed.year - 4);
  const monthPillar = roughMonthPillar(parsed.year, parsed.month);
  const dayPillar = roughDayPillar(parsed.year, parsed.month, parsed.day);
  const hourPillar = roughHourPillar(dayPillar.stem, birthTimeIndex);
  const pillars = [
    { name: "年柱", ganzhi: yearPillar.ganzhi, element: yearPillar.element },
    { name: "月柱", ganzhi: monthPillar.ganzhi, element: monthPillar.element },
    { name: "日柱", ganzhi: dayPillar.ganzhi, element: dayPillar.element },
    { name: "时柱", ganzhi: hourPillar.ganzhi, element: hourPillar.element },
  ];
  const elementCounts = countElements(pillars);
  const strongestElements = elementCounts
    .filter((item) => item.count === Math.max.apply(null, elementCounts.map((entry) => entry.count)))
    .map((item) => item.name);
  const missingElements = elementCounts
    .filter((item) => item.count === 0)
    .map((item) => item.name);
  const dayMaster = {
    stem: dayPillar.stem,
    element: dayPillar.element,
    yinYang: stems.indexOf(dayPillar.stem) % 2 === 0 ? "阳" : "阴",
  };
  const nominalAge = new Date().getFullYear() - parsed.year + 1;

  return {
    birth: {
      source: `阳历 ${birthDate}`,
      solar: birthDate,
      gender: gender === "female" ? "女" : "男",
      birthTime: birthTimes[birthTimeIndex] || birthTimes[0],
    },
    bazi: {
      dayMaster,
      pillars,
      elementCounts,
      strongestElements,
      missingElements,
      nominalAge,
      note: "原生小程序 MVP 使用轻量干支摘要；完整紫微斗数与精细农历换算以网页版完整盘为准。",
    },
    ziwei: {
      status: "完整紫微盘暂由网页版承载",
      keyPalaces: ["命宫", "官禄", "财帛", "夫妻", "福德", "迁移", "疾厄"],
      note: "原生版先提供结构化输入、八字摘要和 LLM 解读闭环，后续再迁移完整紫微盘面。",
    },
  };
}

function buildLocalCards(profile) {
  const pillars = profile.bazi.pillars.map((item) => item.ganzhi).join(" ");
  const elementsText = profile.bazi.elementCounts
    .map((item) => `${item.name}${item.count}`)
    .join("、");

  return [
    {
      title: "出生信息",
      value: `${profile.birth.source} · ${profile.birth.birthTime} · ${profile.birth.gender}`,
    },
    {
      title: "四柱摘要",
      value: pillars,
    },
    {
      title: "日主",
      value: `${profile.bazi.dayMaster.yinYang}${profile.bazi.dayMaster.element}${profile.bazi.dayMaster.stem}`,
    },
    {
      title: "五行可见",
      value: elementsText,
    },
  ];
}

function parseDate(value) {
  const parts = String(value || "").split("-").map(Number);
  return {
    year: parts[0] || new Date().getFullYear(),
    month: parts[1] || 1,
    day: parts[2] || 1,
  };
}

function sexagenary(offset) {
  const stem = stems[positiveMod(offset, 10)];
  const branch = branches[positiveMod(offset, 12)];
  return {
    stem,
    branch,
    ganzhi: `${stem}${branch}`,
    element: elementByStem[stem],
  };
}

function roughMonthPillar(year, month) {
  const branchIndex = positiveMod(month, 12);
  const stemIndex = positiveMod((year - 4) * 12 + month + 1, 10);
  const stem = stems[stemIndex];
  const branch = branches[branchIndex];

  return {
    stem,
    branch,
    ganzhi: `${stem}${branch}`,
    element: elementByStem[stem],
  };
}

function roughDayPillar(year, month, day) {
  const utc = Date.UTC(year, month - 1, day);
  const epoch = Date.UTC(2000, 0, 1);
  const days = Math.floor((utc - epoch) / 86400000);
  return sexagenary(days + 16);
}

function roughHourPillar(dayStem, birthTimeIndex) {
  const branchIndex = birthTimeIndex === 12 ? 0 : birthTimeIndex;
  const dayStemIndex = Math.max(0, stems.indexOf(dayStem));
  const stem = stems[positiveMod(dayStemIndex * 2 + branchIndex, 10)];
  const branch = branches[branchIndex];

  return {
    stem,
    branch,
    ganzhi: `${stem}${branch}`,
    element: elementByStem[stem],
  };
}

function countElements(pillars) {
  return elements.map((name) => ({
    name,
    count: pillars.filter((pillar) => pillar.element === name).length,
  }));
}

function positiveMod(value, size) {
  return ((value % size) + size) % size;
}

module.exports = {
  birthTimes,
  buildLocalCards,
  buildNativeProfile,
  genderOptions,
};
