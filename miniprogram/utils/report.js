const reportSections = [
  {
    id: "profile-summary",
    title: "基础命盘摘要",
    purpose: "说明出生信息、原生四柱摘要和紫微十二宫摘要。",
  },
  {
    id: "personality",
    title: "性格与行为模式",
    purpose: "把日主、五行结构翻译成日常的做事风格和心理底色。",
  },
  {
    id: "career",
    title: "事业 / 职业方向",
    purpose: "给出职业发力方式和工作环境建议。",
  },
  {
    id: "wealth",
    title: "财运 / 资源管理",
    purpose: "解释资源获取、风险承受、现金流和长期积累方式。",
  },
  {
    id: "relationship",
    title: "感情 / 关系",
    purpose: "解释亲密关系、合作关系中的期待、边界和沟通模式。",
  },
  {
    id: "health-pressure",
    title: "健康 / 压力",
    purpose: "只做压力与生活习惯提醒，不做医学诊断。",
  },
  {
    id: "current-cycle",
    title: "当前大运 / 流年阶段",
    purpose: "把当前年龄阶段翻译成阶段主题。",
  },
  {
    id: "cross-check",
    title: "紫微与八字合参校验",
    purpose: "说明两套体系互相支持、互相提醒和需要谨慎判断的地方。",
  },
  {
    id: "action-plan",
    title: "行动建议",
    purpose: "把报告结论收束成具体、可执行、不过度宿命化的建议。",
  },
];

function buildPrompt(profile, context = {}) {
  const queryDate = context.queryDate || "";

  return [
    "你是一名传统文化命盘解释助手。请把出生信息、四柱摘要、紫微十二宫和星曜摘要翻译成普通人能听懂的话。",
    queryDate ? `本次查询日期：${queryDate}。涉及“当前、近期、今天、本阶段”的判断时，只能围绕这个查询日期解释。` : "",
    "要求：",
    "1. 不要说绝对化预言，不要制造焦虑。",
    "2. 每个结论都要附上中文盘面依据，依据只能来自输入资料。",
    "3. 严格按下方报告结构输出，不要新增、删除或改名一级章节。",
    "4. 每个章节必须包含：人话解释、盘面依据、建议。",
    "5. 每个一级章节必须使用 Markdown 二级标题，格式为 `## 章节名`，章节名必须和下方报告结构完全一致。",
    "6. 不要提技术实现、内部数据结构、产品端形态、接口、字段来源或任何英文路径。",
    "7. 盘面依据只能写成人能读懂的中文表达，例如“四柱显示……”“命宫显示……”“财帛宫显示……”。",
    "8. 不要在括号里补充字段来源；不要写类似“依据：某字段”的说明。",
    "",
    "报告结构：",
    ...reportSections.map(
      (section, index) =>
        `${index + 1}. ${section.title}：${section.purpose}`,
    ),
    "",
    "盘面资料：",
    formatProfileForPrompt(compactProfileForPrompt(profile, context)),
  ].filter(Boolean).join("\n");
}

function compactProfileForPrompt(profile, context = {}) {
  const ziwei = profile.ziwei || {};

  return {
    query: {
      date: context.queryDate,
      generatedAt: context.generatedAt,
      timezone: context.timezone || "Asia/Shanghai",
    },
    birth: profile.birth,
    bazi: {
      dayMaster: profile.bazi && profile.bazi.dayMaster,
      pillars: profile.bazi && profile.bazi.pillars,
      elementCounts: profile.bazi && profile.bazi.elementCounts,
      strongestElements: profile.bazi && profile.bazi.strongestElements,
      missingElements: profile.bazi && profile.bazi.missingElements,
      nominalAge: profile.bazi && profile.bazi.nominalAge,
    },
    ziwei: {
      solarDate: ziwei.solarDate,
      lunarDate: ziwei.lunarDate,
      chineseDate: ziwei.chineseDate,
      time: ziwei.time,
      zodiac: ziwei.zodiac,
      sign: ziwei.sign,
      fiveElementsClass: ziwei.fiveElementsClass,
      soul: ziwei.soul,
      body: ziwei.body,
      mingPalace: compactPalace(ziwei.mingPalace),
      bodyPalace: compactPalace(ziwei.bodyPalace),
      keyPalaces: (ziwei.keyPalaces || []).map(compactPalace),
      palaces: (ziwei.palaces || []).map(compactPalace),
      note: ziwei.note,
    },
  };
}

function formatProfileForPrompt(data) {
  const lines = [];
  const query = data.query || {};
  const birth = data.birth || {};
  const bazi = data.bazi || {};
  const ziwei = data.ziwei || {};

  lines.push("【查询】");
  appendLine(lines, "查询日期", query.date);
  appendLine(lines, "生成时间", query.generatedAt);
  appendLine(lines, "时区", query.timezone);

  lines.push("");
  lines.push("【出生信息】");
  appendLine(lines, "出生日期", birth.source || birth.solar);
  appendLine(lines, "阳历", birth.solar || ziwei.solarDate);
  appendLine(lines, "农历", birth.lunar || ziwei.lunarDate);
  appendLine(lines, "干支日期", birth.chineseDate || ziwei.chineseDate);
  appendLine(lines, "性别", birth.gender);
  appendLine(lines, "出生时辰", birth.birthTime || birth.astrolabeTime || ziwei.time);
  appendLine(lines, "生肖与星座", [birth.zodiac || ziwei.zodiac, birth.sign || ziwei.sign].filter(Boolean).join("、"));

  lines.push("");
  lines.push("【四柱八字】");
  appendLine(lines, "日主", formatDayMaster(bazi.dayMaster));
  appendLine(lines, "四柱", formatPillars(bazi.pillars));
  appendLine(lines, "五行可见分布", formatElements(bazi.elementCounts));
  appendLine(lines, "较突出的五行", formatList(bazi.strongestElements));
  appendLine(lines, "偏少或未见的五行", formatList(bazi.missingElements));
  appendLine(lines, "参考虚岁", bazi.nominalAge ? `${bazi.nominalAge} 岁` : "");

  lines.push("");
  lines.push("【紫微斗数】");
  appendLine(lines, "基础信息", [ziwei.zodiac, ziwei.sign, ziwei.fiveElementsClass].filter(Boolean).join("、"));
  appendLine(lines, "命主身主", [ziwei.soul ? `命主${ziwei.soul}` : "", ziwei.body ? `身主${ziwei.body}` : ""].filter(Boolean).join("、"));
  appendLine(lines, "命宫", formatPalaceForPrompt(ziwei.mingPalace));
  appendLine(lines, "身宫", formatPalaceForPrompt(ziwei.bodyPalace));

  const keyPalaces = (ziwei.keyPalaces || [])
    .map(formatPalaceForPrompt)
    .filter(Boolean);
  if (keyPalaces.length) {
    lines.push("重点宫位：");
    keyPalaces.forEach((palace) => lines.push(`- ${palace}`));
  }

  const palaces = (ziwei.palaces || [])
    .map(formatPalaceForPrompt)
    .filter(Boolean);
  if (palaces.length) {
    lines.push("十二宫摘要：");
    palaces.forEach((palace) => lines.push(`- ${palace}`));
  }

  return lines.join("\n");
}

function appendLine(lines, label, value) {
  const text = String(value || "").trim();

  if (text) {
    lines.push(`${label}：${text}`);
  }
}

function formatDayMaster(dayMaster) {
  if (!dayMaster) {
    return "";
  }

  return [dayMaster.yinYang, dayMaster.element, dayMaster.stem].filter(Boolean).join("");
}

function formatPillars(pillars) {
  return (pillars || [])
    .map((pillar) => {
      const name = pillar.name || "";
      const ganzhi = pillar.ganzhi || [pillar.stem, pillar.branch].filter(Boolean).join("");
      const element = pillar.element ? `属${pillar.element}` : "";
      return [name, ganzhi, element].filter(Boolean).join("");
    })
    .filter(Boolean)
    .join("；");
}

function formatElements(elements) {
  return (elements || [])
    .map((item) => `${item.name}${item.count}`)
    .filter(Boolean)
    .join("、");
}

function formatList(items) {
  return (items || []).filter(Boolean).join("、") || "不明显";
}

function compactPalace(palace) {
  if (!palace) {
    return undefined;
  }

  return {
    name: palace.name,
    branch: palace.branch,
    focus: palace.focus,
    isMing: palace.isMing,
    isBody: palace.isBody,
    isEmpty: palace.isEmpty,
    majorStars: palace.majorStarsText,
    minorStars: palace.minorStarsText,
    adjectiveStars: palace.adjectiveStarsText,
    decadal: palace.decadalText,
  };
}

function formatPalaceForPrompt(palace) {
  if (!palace) {
    return "";
  }

  const flags = [
    palace.isMing ? "命宫" : "",
    palace.isBody ? "身宫" : "",
    palace.isEmpty ? "主星空宫" : "",
  ].filter(Boolean);
  const parts = [
    `${palace.name || "宫位"}${palace.branch ? `（${palace.branch}）` : ""}`,
    palace.focus ? `主题：${palace.focus}` : "",
    palace.majorStars ? `主星：${palace.majorStars}` : "",
    palace.minorStars ? `辅星：${palace.minorStars}` : "",
    palace.adjectiveStars ? `杂曜：${palace.adjectiveStars}` : "",
    palace.decadal ? `大限：${palace.decadal}` : "",
    flags.length ? `标记：${flags.join("、")}` : "",
  ].filter(Boolean);

  return parts.join("；");
}

function parseLLMReport(markdown) {
  const source = String(markdown || "");
  const lines = source.split(/\r?\n/);
  const sectionMap = {};
  let currentId = "";
  const intro = [];

  lines.forEach((line) => {
    const matched = matchSection(line);

    if (matched) {
      currentId = matched.id;
      sectionMap[currentId] = "";
      return;
    }

    if (currentId) {
      sectionMap[currentId] = `${sectionMap[currentId] || ""}${line}\n`;
    } else {
      intro.push(line);
    }
  });

  return {
    intro: intro.join("\n").trim(),
    sections: reportSections.map((section) => ({
      id: section.id,
      title: section.title,
      content: cleanMarkdown(sectionMap[section.id] || ""),
      hasContent: Boolean((sectionMap[section.id] || "").trim()),
    })),
    matchedCount: Object.keys(sectionMap).length,
    raw: cleanMarkdown(source),
  };
}

function cleanMarkdown(value) {
  return stripInternalReferences(String(value || ""))
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function stripInternalReferences(value) {
  return String(value || "")
    .replace(/（依据[:：][^）]*(?:[A-Za-z_]+\.[A-Za-z0-9_.]+|JSON|字段|变量|key)[^）]*）/gi, "")
    .replace(/\(依据[:：][^)]*(?:[A-Za-z_]+\.[A-Za-z0-9_.]+|JSON|字段|变量|key)[^)]*\)/gi, "")
    .split(/\r?\n/)
    .filter((line) => !/(参照说明|原生版|网页版完整盘|iztro|JSON|字段名|变量名|接口名|bazi\.|ziwei\.|elementCounts|mingPalace|bodyPalace)/i.test(line))
    .join("\n");
}

function matchSection(line) {
  const normalized = normalizeHeading(line);

  if (!normalized) {
    return undefined;
  }

  return reportSections.find((section) => {
    const title = normalizeHeading(section.title);
    return normalized === title || normalized.includes(title) || title.includes(normalized);
  });
}

function normalizeHeading(value) {
  return String(value || "")
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+[\.\)、)]\s*/, "")
    .replace(/^[一二三四五六七八九十]+[、\.\)]\s*/, "")
    .replace(/[*_`~]/g, "")
    .replace(/[：:]\s*$/, "")
    .replace(/[\s/／｜|·・\-—–]+/g, "")
    .replace(/[，,。.;；]/g, "")
    .toLowerCase();
}

module.exports = {
  buildPrompt,
  parseLLMReport,
  reportSections,
};
