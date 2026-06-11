let iztroAstro;

try {
  iztroAstro = require("../vendor/iztro").astro;
} catch (error) {
  iztroAstro = undefined;
}

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

const palaceNames = [
  "命宫",
  "兄弟",
  "夫妻",
  "子女",
  "财帛",
  "疾厄",
  "迁移",
  "仆役",
  "官禄",
  "田宅",
  "福德",
  "父母",
];

const keyPalaceNames = ["命宫", "官禄", "财帛", "夫妻", "福德", "迁移", "疾厄"];

const palaceFocus = {
  命宫: "自我底色、行动方式",
  兄弟: "同辈关系、协作节奏",
  夫妻: "亲密关系、合作模式",
  子女: "表达创造、长期传承",
  财帛: "收入方式、资源管理",
  疾厄: "压力来源、作息习惯",
  迁移: "外部机会、环境变化",
  仆役: "团队资源、人际支持",
  官禄: "事业路径、职责定位",
  田宅: "家庭根基、资产秩序",
  福德: "精神能量、休息方式",
  父母: "长辈支持、规则系统",
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
  const genderText = gender === "female" ? "女" : "男";
  const astrolabe = createAstrolabe({
    birthDate,
    birthTimeIndex,
    genderText,
  });

  if (astrolabe) {
    return buildIztroProfile({
      astrolabe,
      birthDate,
      birthTimeIndex,
      genderText,
      parsed,
    });
  }

  return buildFallbackProfile({
    birthDate,
    birthTimeIndex,
    genderText,
    parsed,
  });
}

function buildIztroProfile({
  astrolabe,
  birthDate,
  birthTimeIndex,
  genderText,
  parsed,
}) {
  const pillars = parseChineseDatePillars(astrolabe.chineseDate);
  const elementCounts = countElements(pillars);
  const strongestElements = elementCounts
    .filter((item) => item.count === Math.max.apply(null, elementCounts.map((entry) => entry.count)))
    .map((item) => item.name);
  const missingElements = elementCounts
    .filter((item) => item.count === 0)
    .map((item) => item.name);
  const dayPillar = pillars[2] || sexagenary(0);
  const dayMaster = {
    stem: dayPillar.stem,
    element: dayPillar.element,
    yinYang: stems.indexOf(dayPillar.stem) % 2 === 0 ? "阳" : "阴",
  };
  const nominalAge = new Date().getFullYear() - parsed.year + 1;
  const ziwei = buildZiweiFromAstrolabe(astrolabe);

  return {
    birth: {
      source: `阳历 ${astrolabe.solarDate || birthDate}`,
      solar: astrolabe.solarDate || birthDate,
      lunar: astrolabe.lunarDate || "",
      chineseDate: astrolabe.chineseDate || "",
      zodiac: astrolabe.zodiac || "",
      sign: astrolabe.sign || "",
      gender: genderText,
      birthTime: birthTimes[birthTimeIndex] || birthTimes[0],
      astrolabeTime: astrolabe.time || "",
    },
    bazi: {
      dayMaster,
      pillars,
      elementCounts,
      strongestElements,
      missingElements,
      nominalAge,
      note: "原生版已通过 iztro 生成农历、四柱和紫微十二宫摘要；网页版完整盘继续保留用于详细盘面校验。",
    },
    ziwei,
  };
}

function buildFallbackProfile({ birthDate, birthTimeIndex, genderText, parsed }) {
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
  const ziwei = buildZiweiPreview({
    parsed,
    birthTimeIndex,
    yearStem: yearPillar.stem,
  });

  return {
    birth: {
      source: `阳历 ${birthDate}`,
      solar: birthDate,
      lunar: "",
      chineseDate: "",
      zodiac: "",
      sign: "",
      gender: genderText,
      birthTime: birthTimes[birthTimeIndex] || birthTimes[0],
      astrolabeTime: "",
    },
    bazi: {
      dayMaster,
      pillars,
      elementCounts,
      strongestElements,
      missingElements,
      nominalAge,
      note: "iztro vendor 不可用时回退到轻量干支摘要；完整紫微斗数与精细农历换算以网页版完整盘为准。",
    },
    ziwei,
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
      title: "农历 / 星座",
      value: `${profile.birth.lunar || "农历待校验"} · ${profile.birth.zodiac || "-"} · ${
        profile.birth.sign || "-"
      }`,
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
    {
      title: "命宫主星",
      value: formatPalaceLead(profile.ziwei.mingPalace),
    },
  ];
}

function createAstrolabe({ birthDate, birthTimeIndex, genderText }) {
  if (!iztroAstro || typeof iztroAstro.bySolar !== "function") {
    return undefined;
  }

  try {
    return iztroAstro.bySolar(birthDate, birthTimeIndex, genderText, true, "zh-CN");
  } catch (error) {
    return undefined;
  }
}

function buildZiweiFromAstrolabe(astrolabe) {
  const palaces = palaceNames
    .map((name) => astrolabe.palace(name))
    .filter(Boolean)
    .map(formatIztroPalace);
  const mingPalace = palaces.find((palace) => palace.name === "命宫") || palaces[0];
  const bodyPalace =
    palaces.find((palace) => palace.isBody) ||
    palaces.find((palace) => palace.earthlyBranch === astrolabe.earthlyBranchOfBodyPalace) ||
    mingPalace;

  return {
    status: "原生 iztro 排盘",
    source: "iztro",
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    chineseDate: astrolabe.chineseDate,
    time: astrolabe.time,
    zodiac: astrolabe.zodiac,
    sign: astrolabe.sign,
    fiveElementsClass: astrolabe.fiveElementsClass,
    soul: astrolabe.soul,
    body: astrolabe.body,
    palaces,
    mingPalace,
    bodyPalace,
    keyPalaces: keyPalaceNames
      .map((name) => palaces.find((palace) => palace.name === name))
      .filter(Boolean),
    note: "原生版已接入 iztro 生成紫微十二宫、主星辅星和大限摘要；网页版完整盘继续保留用于详细盘面校验。",
  };
}

function formatIztroPalace(palace) {
  const majorStars = palace.majorStars.map(formatStar);
  const minorStars = palace.minorStars.slice(0, 6).map(formatStar);
  const adjectiveStars = palace.adjectiveStars.slice(0, 6).map((star) => star.name);
  const decadalRange = palace.decadal && palace.decadal.range ? palace.decadal.range : [];
  const majorStarsText = formatStarsText(majorStars, "无主星");
  const minorStarsText = formatStarsText(minorStars, "辅星少");

  return {
    name: palace.name,
    heavenlyStem: palace.heavenlyStem,
    earthlyBranch: palace.earthlyBranch,
    branch: `${palace.heavenlyStem}${palace.earthlyBranch}`,
    focus: palaceFocus[palace.name],
    isMing: palace.name === "命宫",
    isBody: Boolean(palace.isBodyPalace),
    isEmpty: typeof palace.isEmpty === "function" ? palace.isEmpty() : majorStars.length === 0,
    majorStars,
    minorStars,
    adjectiveStars,
    majorStarsText,
    minorStarsText,
    adjectiveStarsText: adjectiveStars.length ? adjectiveStars.join("、") : "杂曜少",
    starStatus: majorStarsText,
    decadalRange,
    decadalText: decadalRange.length === 2 ? `${decadalRange[0]}-${decadalRange[1]} 岁` : "大限待校验",
  };
}

function formatStar(star) {
  return {
    name: star.name,
    brightness: star.brightness || "",
    mutagen: star.mutagen || "",
  };
}

function formatStarsText(stars, emptyText) {
  if (!stars.length) {
    return emptyText;
  }

  return stars
    .map((star) => {
      const extras = [star.brightness, star.mutagen].filter(Boolean).join("");
      return extras ? `${star.name}(${extras})` : star.name;
    })
    .join("、");
}

function formatPalaceLead(palace) {
  const branch = palace && palace.branch ? palace.branch : "-";
  const stars = palace && palace.majorStarsText ? palace.majorStarsText : "无主星";
  return `${branch} · ${stars}`;
}

function buildZiweiPreview({ parsed, birthTimeIndex, yearStem }) {
  const hourBranchIndex = birthTimeIndex === 12 ? 0 : birthTimeIndex;
  const mingBranchIndex = positiveMod(2 + parsed.month - 1 - hourBranchIndex, 12);
  const bodyBranchIndex = positiveMod(2 + parsed.month - 1 + hourBranchIndex, 12);
  const yearStemIndex = Math.max(0, stems.indexOf(yearStem));
  const palaces = palaceNames.map((name, index) => {
    const branchIndex = positiveMod(mingBranchIndex + index, 12);
    const stem = stems[positiveMod(yearStemIndex * 2 + branchIndex, 10)];

    return {
      name,
      heavenlyStem: stem,
      earthlyBranch: branches[branchIndex],
      branch: `${stem}${branches[branchIndex]}`,
      focus: palaceFocus[name],
      isMing: index === 0,
      isBody: branchIndex === bodyBranchIndex,
      isEmpty: true,
      majorStars: [],
      minorStars: [],
      adjectiveStars: [],
      majorStarsText: "星曜待接入",
      minorStarsText: "星曜待接入",
      adjectiveStarsText: "星曜待接入",
      starStatus: "星曜待接入完整盘",
      decadalRange: [],
      decadalText: "大限待接入",
    };
  });
  const mingPalace = palaces[0];
  const bodyPalace =
    palaces.find((palace) => palace.earthlyBranch === branches[bodyBranchIndex]) ||
    mingPalace;

  return {
    status: "原生十二宫预览",
    palaces,
    mingPalace,
    bodyPalace,
    keyPalaces: keyPalaceNames
      .map((name) => palaces.find((palace) => palace.name === name))
      .filter(Boolean),
    note: "原生版已展示十二宫结构预览；星曜、四化、大限与精细农历换算仍以网页版完整盘为准。",
  };
}

function parseChineseDatePillars(chineseDate) {
  const names = ["年柱", "月柱", "日柱", "时柱"];
  const parts = String(chineseDate || "").trim().split(/\s+/).slice(0, 4);

  return names.map((name, index) => {
    const raw = parts[index] || "";
    const stem = raw.charAt(0) || stems[0];
    const branch = raw.charAt(1) || branches[0];

    return {
      name,
      stem,
      branch,
      ganzhi: stem && branch ? `${stem}${branch}` : raw,
      element: elementByStem[stem] || "",
    };
  });
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
