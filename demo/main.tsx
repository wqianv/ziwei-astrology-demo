import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Markdown from "markdown-to-jsx";
import { Iztrolabe } from "../src";
import {
  BirthdayType,
  Gender,
  birthTimes,
  buildBirthProfile,
} from "./engines/birth";
import { BaziChart, createBaziChart } from "./engines/bazi";
import {
  InterpretationResult,
  buildInterpretationPayload,
  createLocalInterpretation,
} from "./engines/interpretation";
import {
  DeepSeekInterpretationResponse,
  requestDeepSeekInterpretation,
} from "./engines/deepseek";
import { hasParsedLLMSections, parseLLMMarkdown } from "./engines/llmReport";
import { createZiweiSummary } from "./engines/ziwei";
import { referenceSystems } from "./engines/future";
import "./style.css";

type ActiveView = "ziwei" | "bazi" | "analysis";

const sampleProfiles = [
  { label: "示例 A", birthday: "2003-10-12", birthTime: 1, gender: "male" },
  { label: "示例 B", birthday: "1992-05-18", birthTime: 6, gender: "female" },
  { label: "示例 C", birthday: "1988-11-03", birthTime: 9, gender: "male" },
] as const;

const deepSeekProgressSteps = [
  "整理紫微和八字数据",
  "发送 DeepSeek Pro 请求",
  "等待模型推理",
  "接收并拆分报告",
];

function App() {
  const [activeView, setActiveView] = useState<ActiveView>("ziwei");
  const [birthday, setBirthday] = useState("2003-10-12");
  const [birthTime, setBirthTime] = useState(1);
  const [gender, setGender] = useState<Gender>("male");
  const [birthdayType, setBirthdayType] = useState<BirthdayType>("solar");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [lang, setLang] = useState("zh-CN");
  const [horoscopeDate, setHoroscopeDate] = useState("2026-06-08");
  const [centerPalaceAlign, setCenterPalaceAlign] = useState(false);
  const birthProfile = useMemo(
    () =>
      buildBirthProfile({
        birthday,
        birthTime,
        birthdayType,
        gender,
        isLeapMonth,
      }),
    [birthday, birthdayType, birthTime, gender, isLeapMonth],
  );
  const baziChart = useMemo(() => createBaziChart(birthProfile), [birthProfile]);
  const ziweiSummary = useMemo(
    () => createZiweiSummary(birthProfile),
    [birthProfile],
  );
  const interpretationPayload = useMemo(
    () => buildInterpretationPayload(birthProfile, ziweiSummary, baziChart),
    [birthProfile, ziweiSummary, baziChart],
  );
  const interpretation = useMemo(
    () => createLocalInterpretation(interpretationPayload),
    [interpretationPayload],
  );
  const activeSummary = `${birthProfile.labels.calendar} ${birthProfile.labels.sourceDate} ${birthProfile.labels.birthTime} ${birthProfile.labels.gender}`;

  return (
    <main className="demo-shell">
      <aside className="control-panel" aria-label="排盘参数">
        <div className="brand-block">
          <span className="eyebrow">traditional astrology lab</span>
          <h1>命理排盘工作台</h1>
          <p>{activeSummary}</p>
        </div>

        <div className="view-tabs" aria-label="视图">
          <button
            className={activeView === "ziwei" ? "active" : ""}
            onClick={() => setActiveView("ziwei")}
            type="button"
          >
            紫微
          </button>
          <button
            className={activeView === "bazi" ? "active" : ""}
            onClick={() => setActiveView("bazi")}
            type="button"
          >
            八字详盘
          </button>
          <button
            className={activeView === "analysis" ? "active" : ""}
            onClick={() => setActiveView("analysis")}
            type="button"
          >
            综合解读
          </button>
        </div>

        <label>
          <span>生日</span>
          <input
            type="date"
            value={birthday}
            onChange={(event) => setBirthday(event.target.value)}
          />
        </label>

        <label>
          <span>时辰</span>
          <select
            value={birthTime}
            onChange={(event) => setBirthTime(Number(event.target.value))}
          >
            {birthTimes.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="segmented" aria-label="性别">
          <button
            className={gender === "male" ? "active" : ""}
            onClick={() => setGender("male")}
            type="button"
          >
            男
          </button>
          <button
            className={gender === "female" ? "active" : ""}
            onClick={() => setGender("female")}
            type="button"
          >
            女
          </button>
        </div>

        <div className="segmented" aria-label="历法">
          <button
            className={birthdayType === "solar" ? "active" : ""}
            onClick={() => setBirthdayType("solar")}
            type="button"
          >
            阳历
          </button>
          <button
            className={birthdayType === "lunar" ? "active" : ""}
            onClick={() => setBirthdayType("lunar")}
            type="button"
          >
            农历
          </button>
        </div>

        {birthdayType === "lunar" && (
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={isLeapMonth}
              onChange={(event) => setIsLeapMonth(event.target.checked)}
            />
            <span>闰月</span>
          </label>
        )}

        <label>
          <span>语言</span>
          <select value={lang} onChange={(event) => setLang(event.target.value)}>
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁体中文</option>
            <option value="en-US">English</option>
            <option value="ja-JP">日本語</option>
            <option value="ko-KR">한국어</option>
            <option value="vi-VN">Tiếng Việt</option>
          </select>
        </label>

        <label>
          <span>运限日期</span>
          <input
            type="date"
            value={horoscopeDate}
            onChange={(event) => setHoroscopeDate(event.target.value)}
          />
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={centerPalaceAlign}
            onChange={(event) => setCenterPalaceAlign(event.target.checked)}
          />
          <span>中宫居中</span>
        </label>

        <div className="sample-row">
          {sampleProfiles.map((profile) => (
            <button
              key={profile.label}
              type="button"
              onClick={() => {
                setBirthday(profile.birthday);
                setBirthTime(profile.birthTime);
                setGender(profile.gender);
                setBirthdayType("solar");
                setIsLeapMonth(false);
              }}
            >
              {profile.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="chart-stage" aria-label="排盘结果">
        <div className="stage-header">
          <div>
            <span className="eyebrow dark">birth profile</span>
            <h2>{viewTitle(activeView)}</h2>
          </div>
          <div className="birth-meta">
            <span>阳历 {birthProfile.labels.solarDate}</span>
            <span>农历 {birthProfile.labels.lunarDate}</span>
            <span>{birthProfile.labels.gender}</span>
          </div>
        </div>

        <div className="result-layout">
          <div className="primary-pane">
            {activeView === "ziwei" && (
              <div className="chart-frame ziwei-frame">
                <Iztrolabe
                  birthday={birthday}
                  birthTime={birthTime}
                  birthdayType={birthdayType}
                  gender={gender}
                  horoscopeDate={new Date(`${horoscopeDate}T12:00:00`)}
                  horoscopeHour={birthTime}
                  lang={lang}
                  astroType="heaven"
                  centerPalaceAlign={centerPalaceAlign}
                  isLeapMonth={isLeapMonth}
                  fixLeap
                  options={{ yearDivide: "exact" }}
                />
              </div>
            )}

            {activeView === "bazi" && <BaziPanel chart={baziChart} />}
            {activeView === "analysis" && (
              <InterpretationPanel result={interpretation} />
            )}
          </div>
          <ReferenceRail
            chart={baziChart}
            interpretation={interpretation}
            onOpenBazi={() => setActiveView("bazi")}
            onOpenAnalysis={() => setActiveView("analysis")}
          />
        </div>
      </section>
    </main>
  );
}

function BaziPanel({ chart }: { chart: BaziChart }) {
  const maxElementCount = Math.max(
    ...chart.elementCounts.map((item) => item.count),
    1,
  );

  return (
    <div className="bazi-layout">
      <section className="bazi-summary">
        <div>
          <span className="eyebrow dark">day master</span>
          <h3>
            {chart.dayMaster.yinYang}
            {chart.dayMaster.element}
            {chart.dayMaster.stem}
          </h3>
          <p>{chart.solarText}</p>
        </div>
        <div className="summary-grid">
          <SummaryItem label="纳音" value={chart.naYin.join(" / ")} />
          <SummaryItem
            label="大运"
            value={`${chart.daYun.forward ? "顺行" : "逆行"}，起运 ${chart.daYun.startsAfter}`}
          />
          <SummaryItem
            label="十神"
            value={chart.tenGods.length ? chart.tenGods.join("、") : "待分析"}
          />
        </div>
      </section>

      <section className="pillar-grid" aria-label="四柱">
        {chart.pillars.map((pillar) => (
          <article className="pillar-card" key={pillar.name}>
            <span>{pillar.name}</span>
            <strong>{pillar.ganzhi}</strong>
            <dl>
              <div>
                <dt>天干</dt>
                <dd>
                  {pillar.stem} · {pillar.stemTenGod}
                </dd>
              </div>
              <div>
                <dt>地支</dt>
                <dd>
                  {pillar.branch} · 藏 {pillar.hiddenStems.join("、")}
                </dd>
              </div>
              <div>
                <dt>五行</dt>
                <dd>{pillar.wuXing}</dd>
              </div>
              <div>
                <dt>十二长生</dt>
                <dd>{pillar.diShi}</dd>
              </div>
              <div>
                <dt>旬空</dt>
                <dd>{pillar.xunKong}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="bazi-panels">
        <div className="analysis-panel">
          <h3>结构摘要</h3>
          <ul>
            {chart.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <div className="analysis-panel">
          <h3>五行可见分布</h3>
          <div className="element-bars">
            {chart.elementCounts.map((item) => (
              <div className="element-bar" key={item.name}>
                <span>{item.name}</span>
                <div>
                  <i style={{ width: `${(item.count / maxElementCount) * 100}%` }} />
                </div>
                <b>{item.count}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="analysis-panel">
        <h3>大运</h3>
        <div className="luck-grid">
          {chart.daYun.items.map((item) => (
            <div className="luck-item" key={`${item.ganzhi}-${item.startYear}`}>
              <strong>{item.ganzhi}</strong>
              <span>
                {item.startAge}-{item.endAge}岁
              </span>
              <small>
                {item.startYear}-{item.endYear}
              </small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReferenceRail({
  chart,
  interpretation,
  onOpenBazi,
  onOpenAnalysis,
}: {
  chart: BaziChart;
  interpretation: InterpretationResult;
  onOpenBazi: () => void;
  onOpenAnalysis: () => void;
}) {
  return (
    <aside className="reference-rail" aria-label="合参参考">
      <div className="rail-heading">
        <span className="eyebrow dark">computed references</span>
        <h3>合参参考</h3>
      </div>

      <section className="reference-item interpretation-reference-item">
        <span>本地解释草案</span>
        <h3>综合解读</h3>
        <p>{interpretation.headline}</p>
        <dl>
          <div>
            <dt>一句话</dt>
            <dd>{interpretation.summary}</dd>
          </div>
        </dl>
        <button type="button" onClick={onOpenAnalysis}>
          查看完整解读
        </button>
      </section>

      <section className="reference-item bazi-reference-item">
        <span>已计算</span>
        <h3>四柱八字</h3>
        <div className="compact-pillars">
          {chart.pillars.map((pillar) => (
            <div key={pillar.name}>
              <span>{pillar.name.replace("柱", "")}</span>
              <strong>{pillar.ganzhi}</strong>
            </div>
          ))}
        </div>
        <dl>
          <div>
            <dt>日主</dt>
            <dd>
              {chart.dayMaster.yinYang}
              {chart.dayMaster.element}
              {chart.dayMaster.stem}
            </dd>
          </div>
          <div>
            <dt>大运</dt>
            <dd>
              {chart.daYun.forward ? "顺行" : "逆行"}，起运{" "}
              {chart.daYun.startsAfter}
            </dd>
          </div>
          <div>
            <dt>摘要</dt>
            <dd>{chart.notes[1]}</dd>
          </div>
        </dl>
        <button type="button" onClick={onOpenBazi}>
          查看八字详盘
        </button>
      </section>

      {referenceSystems.map((system) => (
        <article className="reference-item" key={system.id}>
          <span>{system.status}</span>
          <h3>{system.name}</h3>
          <p>{system.value}</p>
          <dl>
            <div>
              <dt>输入</dt>
              <dd>{system.inputs.join("、")}</dd>
            </div>
            <div>
              <dt>第一步</dt>
              <dd>{system.firstStep}</dd>
            </div>
          </dl>
        </article>
      ))}
    </aside>
  );
}

function InterpretationPanel({ result }: { result: InterpretationResult }) {
  const [deepSeekResult, setDeepSeekResult] =
    useState<DeepSeekInterpretationResponse>();
  const [deepSeekError, setDeepSeekError] = useState("");
  const [deepSeekLoading, setDeepSeekLoading] = useState(false);
  const [deepSeekStartedAt, setDeepSeekStartedAt] = useState<number>();
  const [deepSeekElapsedSeconds, setDeepSeekElapsedSeconds] = useState(0);
  const parsedDeepSeekReport = useMemo(
    () =>
      deepSeekResult ? parseLLMMarkdown(deepSeekResult.content) : undefined,
    [deepSeekResult],
  );
  const hasSectionedDeepSeekReport = parsedDeepSeekReport
    ? hasParsedLLMSections(parsedDeepSeekReport)
    : false;

  useEffect(() => {
    setDeepSeekResult(undefined);
    setDeepSeekError("");
    setDeepSeekElapsedSeconds(0);
    setDeepSeekStartedAt(undefined);
  }, [result.prompt]);

  useEffect(() => {
    if (!deepSeekLoading || !deepSeekStartedAt) {
      return;
    }

    const updateElapsed = () => {
      setDeepSeekElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - deepSeekStartedAt) / 1000)),
      );
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(timer);
  }, [deepSeekLoading, deepSeekStartedAt]);

  const generateDeepSeekReport = async () => {
    setDeepSeekLoading(true);
    setDeepSeekError("");
    setDeepSeekResult(undefined);
    setDeepSeekElapsedSeconds(0);
    setDeepSeekStartedAt(Date.now());

    try {
      setDeepSeekResult(await requestDeepSeekInterpretation(result.prompt));
    } catch (error) {
      setDeepSeekError(
        error instanceof Error ? error.message : "DeepSeek request failed",
      );
    } finally {
      setDeepSeekLoading(false);
    }
  };

  return (
    <div className="interpretation-layout">
      <section className="interpretation-hero">
        <span className="eyebrow dark">plain language report</span>
        <h3>{result.headline}</h3>
        <p>{result.summary}</p>
        <button
          className="deepseek-button"
          type="button"
          onClick={generateDeepSeekReport}
          disabled={deepSeekLoading}
        >
          {deepSeekLoading ? "DeepSeek 生成中..." : "用 DeepSeek 生成正式解读"}
        </button>
        {deepSeekError && <p className="deepseek-error">{deepSeekError}</p>}
      </section>

      {deepSeekLoading && (
        <section className="analysis-panel llm-progress-panel">
          <div className="llm-report-header">
            <h3>DeepSeek Pro 正在生成</h3>
            <span>{deepSeekElapsedSeconds}s</span>
          </div>
          <div className="progress-track">
            <i
              style={{
                width: `${deepSeekProgressPercent(deepSeekElapsedSeconds)}%`,
              }}
            />
          </div>
          <div className="progress-steps">
            {deepSeekProgressSteps.map((step, index) => (
              <div
                className={
                  index <= deepSeekProgressIndex(deepSeekElapsedSeconds)
                    ? "active"
                    : ""
                }
                key={step}
              >
                <b>{index + 1}</b>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <p>
            Pro 模型可能需要几十秒。请求没有丢，返回后会自动按章节填入下面的报告模块。
          </p>
        </section>
      )}

      {deepSeekResult && (
        <section className="analysis-panel llm-report-panel">
          <div className="llm-report-header">
            <h3>DeepSeek 解读已生成</h3>
            <span>{deepSeekResult.model || "deepseek"}</span>
          </div>
          <p>
            {hasSectionedDeepSeekReport
              ? "已按 9 个报告模块拆分填入下方章节。"
              : "未识别到标准章节标题，已放入未归类补充。"}
          </p>
          {deepSeekResult.usage && (
            <p>
              tokens: {deepSeekResult.usage.prompt_tokens ?? "-"} prompt /{" "}
              {deepSeekResult.usage.completion_tokens ?? "-"} completion /{" "}
              {deepSeekResult.usage.total_tokens ?? "-"} total
            </p>
          )}
        </section>
      )}

      {parsedDeepSeekReport &&
        (parsedDeepSeekReport.intro || parsedDeepSeekReport.unmatched) && (
          <section className="analysis-panel llm-supplement-panel">
            <h3>未归类补充</h3>
            <MarkdownPreview
              content={
                parsedDeepSeekReport.unmatched || parsedDeepSeekReport.intro
              }
            />
          </section>
        )}

      <section className="interpretation-grid">
        {result.sections.map((section) => (
          <article className="interpretation-card" key={section.title}>
            <h3>{section.title}</h3>
            {parsedDeepSeekReport?.sections[section.id] ? (
              <>
                <div className="section-llm-result">
                  <span>DeepSeek 正式解读</span>
                  <MarkdownPreview
                    content={parsedDeepSeekReport.sections[section.id] || ""}
                    compact
                  />
                </div>
                <LocalBasis section={section} collapsed />
              </>
            ) : (
              <>
                {deepSeekResult && (
                  <p className="section-missing">
                    DeepSeek 本次没有返回这一节，先显示本地解释草案。
                  </p>
                )}
                <p>{section.plain}</p>
                <LocalBasis section={section} />
              </>
            )}
          </article>
        ))}
      </section>

      <section className="analysis-panel prompt-panel">
        <h3>大模型 Prompt 草案</h3>
        <p>
          这份 prompt 会随出生信息和盘面变化而更新，后续接入真实模型时直接发送即可。
        </p>
        <textarea readOnly value={result.prompt} />
      </section>

      <section className="analysis-panel">
        <h3>解释边界</h3>
        <ul>
          {result.reminders.map((reminder) => (
            <li key={reminder}>{reminder}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function LocalBasis({
  section,
  collapsed = false,
}: {
  section: InterpretationResult["sections"][number];
  collapsed?: boolean;
}) {
  const content = (
    <>
      {collapsed && <p>{section.plain}</p>}
      <div className="interpretation-columns">
        <div>
          <strong>依据</strong>
          <ul>
            {section.evidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>建议</strong>
          <ul>
            {section.advice.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );

  if (collapsed) {
    return (
      <details className="local-basis">
        <summary>本地依据草案</summary>
        {content}
      </details>
    );
  }

  return content;
}

function MarkdownPreview({
  content,
  compact = false,
}: {
  content: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`markdown-preview${compact ? " markdown-preview-compact" : ""}`}
    >
      <Markdown
        options={{
          disableParsingRawHTML: true,
          forceBlock: true,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

function deepSeekProgressIndex(elapsedSeconds: number): number {
  if (elapsedSeconds < 2) {
    return 0;
  }

  if (elapsedSeconds < 6) {
    return 1;
  }

  if (elapsedSeconds < 45) {
    return 2;
  }

  return 3;
}

function deepSeekProgressPercent(elapsedSeconds: number): number {
  if (elapsedSeconds < 2) {
    return 18;
  }

  if (elapsedSeconds < 6) {
    return 38;
  }

  if (elapsedSeconds < 45) {
    return Math.min(88, 45 + elapsedSeconds);
  }

  return 94;
}

function viewTitle(activeView: ActiveView): string {
  if (activeView === "bazi") {
    return "四柱八字";
  }

  if (activeView === "analysis") {
    return "综合解读";
  }

  return "紫微斗数";
}

createRoot(document.getElementById("root")!).render(<App />);
