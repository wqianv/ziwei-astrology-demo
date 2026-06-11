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
    purpose: "标明原生 iztro 摘要、四柱结构与网页版完整盘之间的参考关系。",
  },
  {
    id: "action-plan",
    title: "行动建议",
    purpose: "把报告结论收束成具体、可执行、不过度宿命化的建议。",
  },
];

function buildPrompt(profile) {
  return [
    "你是一名传统命理报告解释助手。请把原生小程序提供的出生信息、四柱摘要、紫微十二宫和星曜摘要翻译成普通人能听懂的话。",
    "要求：",
    "1. 不要说绝对化预言，不要制造焦虑。",
    "2. 每个结论都要附上依据，依据只能来自输入数据。",
    "3. 严格按下方报告结构输出，不要新增、删除或改名一级章节。",
    "4. 每个章节必须包含：人话解释、盘面依据、建议。",
    "5. 每个一级章节必须使用 Markdown 二级标题，格式为 `## 章节名`，章节名必须和下方报告结构完全一致。",
    "6. 明确说明原生版已接入 iztro 生成紫微摘要，网页版完整盘保留用于查看更完整盘面和交叉校验。",
    "",
    "报告结构：",
    ...reportSections.map(
      (section, index) =>
        `${index + 1}. ${section.title}：${section.purpose}`,
    ),
    "",
    "结构化数据：",
    JSON.stringify(compactProfileForPrompt(profile), null, 2),
  ].join("\n");
}

function compactProfileForPrompt(profile) {
  const ziwei = profile.ziwei || {};

  return {
    birth: profile.birth,
    bazi: profile.bazi,
    ziwei: {
      status: ziwei.status,
      source: ziwei.source,
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
  return String(value || "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
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
