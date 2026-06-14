import { BaziChart } from "./bazi";
import { BirthProfile } from "./birth";
import { ZiweiPalaceSummary, ZiweiSummary } from "./ziwei";

export type InterpretationPayload = {
  birth: {
    source: string;
    solar: string;
    lunar: string;
    gender: string;
    birthTime: string;
  };
  ziwei: ZiweiSummary;
  bazi: BaziChart;
};

export type ReportSectionId =
  | "profile-summary"
  | "personality"
  | "career"
  | "wealth"
  | "relationship"
  | "health-pressure"
  | "current-cycle"
  | "cross-check"
  | "action-plan";

export type ReportSectionDefinition = {
  id: ReportSectionId;
  title: string;
  purpose: string;
};

export type InterpretationSection = {
  id: ReportSectionId;
  title: string;
  plain: string;
  evidence: string[];
  advice: string[];
};

export type InterpretationResult = {
  headline: string;
  summary: string;
  sections: InterpretationSection[];
  reminders: string[];
  prompt: string;
  provider: "local-template" | "llm";
};

export type InterpretationProvider = {
  id: string;
  explain: (payload: InterpretationPayload) => Promise<InterpretationResult>;
};

export const reportSectionSchema: ReportSectionDefinition[] = [
  {
    id: "profile-summary",
    title: "基础命盘摘要",
    purpose: "说明出生信息、紫微基础盘、八字基础盘，让用户先知道报告依据。",
  },
  {
    id: "personality",
    title: "性格与行为模式",
    purpose: "把命宫、日主、五行结构翻译成日常的做事风格和心理底色。",
  },
  {
    id: "career",
    title: "事业 / 职业方向",
    purpose: "结合官禄宫、八字十神和五行倾向，给出职业发力方式。",
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
    purpose: "把八字大运和紫微大限翻译成当前阶段主题。",
  },
  {
    id: "cross-check",
    title: "紫微与八字合参校验",
    purpose: "列出两套体系互相印证和需要谨慎判断的地方。",
  },
  {
    id: "action-plan",
    title: "行动建议",
    purpose: "把报告结论收束成具体、可执行、不过度宿命化的建议。",
  },
];

export function buildInterpretationPayload(
  birth: BirthProfile,
  ziwei: ZiweiSummary,
  bazi: BaziChart,
): InterpretationPayload {
  return {
    birth: {
      source: `${birth.labels.calendar} ${birth.labels.sourceDate}`,
      solar: birth.labels.solarDate,
      lunar: birth.labels.lunarDate,
      gender: birth.labels.gender,
      birthTime: birth.labels.birthTime,
    },
    ziwei,
    bazi,
  };
}

export function createLocalInterpretation(
  payload: InterpretationPayload,
): InterpretationResult {
  const { bazi, ziwei } = payload;
  const lifePalace = findPalace(ziwei, "命宫");
  const careerPalace = findPalace(ziwei, "官禄");
  const wealthPalace = findPalace(ziwei, "财帛");
  const partnerPalace = findPalace(ziwei, "夫妻");
  const mindPalace = findPalace(ziwei, "福德");
  const travelPalace = findPalace(ziwei, "迁移");
  const healthPalace = findPalace(ziwei, "疾厄");
  const strongestElements = bazi.elementCounts
    .filter(
      (item) =>
        item.count === Math.max(...bazi.elementCounts.map((entry) => entry.count)),
    )
    .map((item) => item.name);
  const missingElements = bazi.elementCounts
    .filter((item) => item.count === 0)
    .map((item) => item.name);
  const birthYear = Number(payload.birth.solar.split("-")[0]);
  const currentYear = new Date().getFullYear();
  const nominalAge = currentYear - birthYear + 1;
  const currentLuck = bazi.daYun.items.find(
    (item) => currentYear >= item.startYear && currentYear <= item.endYear,
  );
  const firstLuck = bazi.daYun.items[0];
  const sections: InterpretationSection[] = [
    {
      id: "profile-summary",
      title: getSectionTitle("profile-summary"),
      plain: `这份报告基于${payload.birth.source}、${payload.birth.birthTime}、${payload.birth.gender}命盘生成。紫微斗数提供人生领域地图，八字提供五行、十神和时间轴；两者先分开看，再做合参。`,
      evidence: [
        `阳历：${payload.birth.solar}，农历：${payload.birth.lunar}`,
        `紫微基础：${ziwei.zodiac}，${ziwei.sign}，${ziwei.fiveElementsClass}，命主${ziwei.soul}，身主${ziwei.body}`,
        `八字四柱：${bazi.pillars.map((pillar) => pillar.ganzhi).join(" ")}`,
      ],
      advice: [
        "先把报告当作自我观察框架，不急着把任何一句话理解成定论。",
        "后续大模型报告应保留原始盘面摘要，方便用户回看依据。",
      ],
    },
    {
      id: "personality",
      title: getSectionTitle("personality"),
      plain: `这张盘的核心可以先看成“${bazi.dayMaster.yinYang}${bazi.dayMaster.element}${bazi.dayMaster.stem}日主”在主导。它通常代表一个人处理事情的底色：先看稳定感、承压方式和行动节奏，再结合命宫星曜判断外在表现。`,
      evidence: [
        `八字日主：${bazi.dayMaster.stem}，五行属${bazi.dayMaster.element}`,
        `紫微命宫：${describePalace(lifePalace)}`,
      ],
      advice: [
        "不要只看某一颗星或某一个五行，后续解读要用紫微宫位和八字结构互相校正。",
        "适合把优势写成可执行习惯，比如做事节奏、沟通方式、决策风格。",
      ],
    },
    {
      id: "career",
      title: getSectionTitle("career"),
      plain: `事业先看紫微的官禄宫，再看八字十神。当前官禄宫显示的是“${describePalace(careerPalace)}”，八字里出现的十神有${formatList(bazi.tenGods)}，可以把它理解成适合从哪些能力入口发力。`,
      evidence: [
        `官禄宫：${describeStars(careerPalace)}`,
        `八字十神：${formatList(bazi.tenGods)}`,
      ],
      advice: [
        "优先选择能长期积累作品、经验或专业信用的方向。",
        "如果盘面同时出现冲突信号，建议把职业建议拆成“适合做什么”和“需要避开什么工作环境”。",
      ],
    },
    {
      id: "wealth",
      title: getSectionTitle("wealth"),
      plain: `财运不能简单翻译成“有没有钱”，更像一个人获取、管理和承载资源的方式。财帛宫显示“${describePalace(wealthPalace)}”，八字可见五行里${formatList(strongestElements)}较突出${missingElements.length ? `，${formatList(missingElements)}偏少` : ""}。`,
      evidence: [
        `财帛宫：${describeStars(wealthPalace)}`,
        `五行分布：${bazi.elementCounts
          .map((item) => `${item.name}${item.count}`)
          .join("、")}`,
      ],
      advice: [
        "财务建议要落到现金流、风险承受能力和长期资产配置，不要只说“财旺”。",
        "五行偏少的部分可以翻译成习惯提醒，比如信息补足、节奏控制、合作边界。",
      ],
    },
    {
      id: "relationship",
      title: getSectionTitle("relationship"),
      plain: `关系层面先看夫妻宫，也要看命盘整体的沟通星曜和八字十神。这里夫妻宫为“${describePalace(partnerPalace)}”，适合进一步解释亲密关系里的期待、边界和相处模式。`,
      evidence: [
        `夫妻宫：${describeStars(partnerPalace)}`,
        `福德宫：${describeStars(mindPalace)}`,
      ],
      advice: [
        "关系建议要避免宿命化表达，重点放在沟通方式、选择标准和冲突处理。",
        "如果夫妻宫为空宫，也可以参考三方四正和福德宫，不要直接判定关系好坏。",
      ],
    },
    {
      id: "health-pressure",
      title: getSectionTitle("health-pressure"),
      plain: `健康部分只做压力和生活习惯提醒。紫微疾厄宫显示“${describePalace(healthPalace)}”，福德宫显示“${describePalace(mindPalace)}”，这两处可以一起看身体压力、情绪恢复和长期消耗模式。`,
      evidence: [
        `疾厄宫：${describeStars(healthPalace)}`,
        `福德宫：${describeStars(mindPalace)}`,
        `五行偏少：${missingElements.length ? formatList(missingElements) : "无明显缺项"}`,
      ],
      advice: [
        "这一节不能输出疾病诊断，只能提醒作息、压力、恢复节奏和检查意识。",
        "如果用户问具体疾病，应该建议咨询专业医生。",
      ],
    },
    {
      id: "current-cycle",
      title: getSectionTitle("current-cycle"),
      plain: currentLuck
        ? `按阳历 ${currentYear} 年粗看，当前约为虚岁 ${nominalAge} 岁，落在八字大运 ${currentLuck.ganzhi}（${currentLuck.startAge}-${currentLuck.endAge}岁，${currentLuck.startYear}-${currentLuck.endYear}年）。这节要把阶段主题说清楚，而不是只说“好/坏”。`
        : firstLuck
          ? `八字大运给了时间轴：首个完整大运是${firstLuck.ganzhi}，约${firstLuck.startAge}-${firstLuck.endAge}岁，对应${firstLuck.startYear}-${firstLuck.endYear}年。紫微也有大限，两套时间系统可以用来交叉看阶段主题。`
          : "当前已经生成大运数据，后续可以把紫微大限、八字大运和流年合并成阶段解释。",
      evidence: [
        `大运方向：${bazi.daYun.forward ? "顺行" : "逆行"}`,
        currentLuck
          ? `当前大运：${currentLuck.ganzhi}，${currentLuck.startYear}-${currentLuck.endYear}`
          : "当前大运：待按年龄定位",
        `迁移宫：${describeStars(travelPalace)}`,
      ],
      advice: [
        "阶段建议最好按年龄段输出：当前阶段、下个阶段、需要提前准备的变化。",
        "大运和大限只做趋势提示，不应该替代现实中的选择和行动。",
      ],
    },
    {
      id: "cross-check",
      title: getSectionTitle("cross-check"),
      plain: `合参校验的作用，是找紫微和八字互相支持的信号，也标出需要谨慎的地方。当前可先看：八字日主为${bazi.dayMaster.element}，紫微五行局为${ziwei.fiveElementsClass}；事业、财务、关系分别再对照官禄宫、财帛宫、夫妻宫。`,
      evidence: [
        `八字日主：${bazi.dayMaster.yinYang}${bazi.dayMaster.element}${bazi.dayMaster.stem}`,
        `紫微五行局：${ziwei.fiveElementsClass}`,
        `关键宫位：官禄=${describeStars(careerPalace)}；财帛=${describeStars(wealthPalace)}；夫妻=${describeStars(partnerPalace)}`,
      ],
      advice: [
        "模型输出时要明确区分“互相印证”和“暂时矛盾/待校验”。",
        "如果两套体系指向不同，不要强行统一结论，应提示可能与流派、出生时间精度或现实选择有关。",
      ],
    },
    {
      id: "action-plan",
      title: getSectionTitle("action-plan"),
      plain: "最后一节只保留能行动的建议，把前面的术语和判断收束成现实中的选择、习惯和注意事项。用户看完这里，应该知道接下来可以做什么，而不是只记住几个命理词。",
      evidence: [
        `性格依据：${describePalace(lifePalace)}`,
        `事业依据：${describePalace(careerPalace)}`,
        `阶段依据：${currentLuck ? `${currentLuck.ganzhi}大运` : "大运数据已生成"}`,
      ],
      advice: [
        "给 3-5 条具体建议，每条都对应一个盘面依据。",
        "建议要落在工作选择、钱的管理、关系沟通、压力恢复、阶段规划上。",
        "避免“必然发财”“一定结婚/离婚”“必有灾病”等不可验证、会制造焦虑的表达。",
      ],
    },
  ];

  return {
    headline: `${bazi.dayMaster.yinYang}${bazi.dayMaster.element}${bazi.dayMaster.stem}日主，紫微${ziwei.fiveElementsClass}`,
    summary: `这份报告会把术语先翻译成日常语言：八字负责看底层结构、五行和时间轴；紫微负责看人生领域，比如事业、财务、关系和心态。当前只是本地解释模板，后面可以把同一份结构化数据交给大模型生成更自然的长文。`,
    sections,
    reminders: [
      "命理解释适合作为自我观察和决策辅助，不应当做确定性预言。",
      "大模型输出必须引用盘面依据，避免凭空发挥。",
      "建议最终报告保留“依据”和“建议”两层，让用户知道结论从哪里来。",
    ],
    prompt: buildLLMPrompt(payload),
    provider: "local-template",
  };
}

export function buildLLMPrompt(payload: InterpretationPayload): string {
  return [
    "你是一名传统文化命盘解释助手。请把紫微斗数和四柱八字资料翻译成普通人能听懂的话。",
    "要求：",
    "1. 不要说绝对化预言，不要制造焦虑。",
    "2. 每个结论都要附上中文盘面依据，依据只能来自输入资料。",
    "3. 严格按下方报告结构输出，不要新增、删除或改名一级章节。",
    "4. 每个章节必须包含：人话解释、盘面依据、建议。",
    "5. 每个一级章节必须使用 Markdown 二级标题，格式为 `## 章节名`，章节名必须和下方报告结构完全一致。",
    "6. 语言要像咨询师一样清楚、温和、具体，不要堆术语。",
    "7. 不要提技术实现、内部数据结构、产品端形态、接口、字段来源或任何英文路径。",
    "8. 盘面依据只能写成人能读懂的中文表达，例如“四柱显示……”“命宫显示……”“财帛宫显示……”。",
    "9. 不要在括号里补充字段来源；不要写类似“依据：某字段”的说明。",
    "",
    "报告结构：",
    ...reportSectionSchema.map(
      (section, index) =>
        `${index + 1}. ${section.title}：${section.purpose}`,
    ),
    "",
    "盘面资料：",
    formatPayloadForPrompt(payload),
  ].join("\n");
}

function formatPayloadForPrompt(payload: InterpretationPayload): string {
  const lines: string[] = [];
  const { birth, bazi, ziwei } = payload;

  lines.push("【出生信息】");
  appendPromptLine(lines, "出生日期", birth.source);
  appendPromptLine(lines, "阳历", birth.solar);
  appendPromptLine(lines, "农历", birth.lunar);
  appendPromptLine(lines, "性别", birth.gender);
  appendPromptLine(lines, "出生时辰", birth.birthTime);

  lines.push("");
  lines.push("【四柱八字】");
  appendPromptLine(
    lines,
    "日主",
    `${bazi.dayMaster.yinYang}${bazi.dayMaster.element}${bazi.dayMaster.stem}`,
  );
  appendPromptLine(
    lines,
    "四柱",
    bazi.pillars
      .map((pillar) => {
        const details = [
          pillar.ganzhi,
          `天干${pillar.stem}${pillar.stemTenGod ? `/${pillar.stemTenGod}` : ""}`,
          `地支${pillar.branch}`,
          `五行${pillar.wuXing}`,
        ];
        return `${pillar.name}：${details.join("，")}`;
      })
      .join("；"),
  );
  appendPromptLine(
    lines,
    "五行可见分布",
    bazi.elementCounts.map((item) => `${item.name}${item.count}`).join("、"),
  );
  appendPromptLine(lines, "纳音", bazi.naYin.join("、"));
  appendPromptLine(lines, "十神", bazi.tenGods.join("、") || "不明显");
  appendPromptLine(
    lines,
    "大运",
    `${bazi.daYun.forward ? "顺行" : "逆行"}，起运 ${bazi.daYun.startsAfter}`,
  );
  if (bazi.daYun.items.length) {
    lines.push("大运列表：");
    bazi.daYun.items.forEach((item) => {
      lines.push(
        `- ${item.ganzhi}：${item.startAge}-${item.endAge}岁，${item.startYear}-${item.endYear}年`,
      );
    });
  }

  lines.push("");
  lines.push("【紫微斗数】");
  appendPromptLine(lines, "阳历", ziwei.solarDate);
  appendPromptLine(lines, "农历", ziwei.lunarDate);
  appendPromptLine(lines, "干支日期", ziwei.chineseDate);
  appendPromptLine(lines, "出生时辰", ziwei.time);
  appendPromptLine(lines, "生肖星座", [ziwei.zodiac, ziwei.sign].filter(Boolean).join("、"));
  appendPromptLine(lines, "五行局", ziwei.fiveElementsClass);
  appendPromptLine(
    lines,
    "命主身主",
    [ziwei.soul ? `命主${ziwei.soul}` : "", ziwei.body ? `身主${ziwei.body}` : ""]
      .filter(Boolean)
      .join("、"),
  );
  if (ziwei.keyPalaces.length) {
    lines.push("重点宫位：");
    ziwei.keyPalaces.forEach((palace) => lines.push(`- ${formatZiweiPalace(palace)}`));
  }

  return lines.join("\n");
}

function appendPromptLine(lines: string[], label: string, value: string) {
  const text = value.trim();

  if (text) {
    lines.push(`${label}：${text}`);
  }
}

function formatZiweiPalace(palace: ZiweiPalaceSummary): string {
  const major = palace.majorStars.map(formatStar).join("、") || "无主星";
  const minor = palace.minorStars.map(formatStar).join("、") || "辅星少";
  const adjective = palace.adjectiveStars.join("、") || "杂曜少";
  const decadal = palace.decadalRange.length === 2
    ? `${palace.decadalRange[0]}-${palace.decadalRange[1]}岁`
    : "大限待校验";

  return `${palace.name}（${palace.heavenlyStem}${palace.earthlyBranch}）：主星${major}；辅星${minor}；杂曜${adjective}；大限${decadal}${palace.isEmpty ? "；主星空宫" : ""}`;
}

function getSectionTitle(id: ReportSectionId): string {
  return reportSectionSchema.find((section) => section.id === id)!.title;
}

function findPalace(ziwei: ZiweiSummary, name: string) {
  return ziwei.keyPalaces.find((palace) => palace.name === name);
}

function describePalace(palace?: ZiweiPalaceSummary): string {
  if (!palace) {
    return "暂无数据";
  }

  const stars = describeStars(palace);
  return `${palace.name}${palace.earthlyBranch}位，${stars}`;
}

function describeStars(palace?: ZiweiPalaceSummary): string {
  if (!palace) {
    return "暂无数据";
  }

  if (palace.isEmpty && palace.minorStars.length === 0) {
    return "主星为空，需要参考三方四正";
  }

  const major = palace.majorStars.map(formatStar).join("、");
  const minor = palace.minorStars.map(formatStar).join("、");

  return [major, minor].filter(Boolean).join("；") || "暂无主要星曜";
}

function formatStar(star: { name: string; brightness?: string; mutagen?: string }) {
  const parts = [star.name];

  if (star.brightness) {
    parts.push(star.brightness);
  }

  if (star.mutagen) {
    parts.push(`化${star.mutagen}`);
  }

  return parts.join("");
}

function formatList(items: string[]): string {
  return items.length ? items.join("、") : "暂不明显";
}
