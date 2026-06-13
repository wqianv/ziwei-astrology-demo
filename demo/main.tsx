import React, { useEffect, useMemo, useRef, useState } from "react";
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
  "发送 LLM 请求",
  "等待模型推理",
  "接收并拆分报告",
];

const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com";
const DEFAULT_LLM_MODEL = "deepseek-v4-pro";
const LLM_API_KEY_STORAGE_KEY = "ziwei.llm.apiKey";
const LLM_BASE_URL_STORAGE_KEY = "ziwei.llm.baseUrl";
const LLM_MODEL_STORAGE_KEY = "ziwei.llm.model";
const LLM_PROXY_ACCESS_KEY_STORAGE_KEY = "ziwei.llm.proxyAccessKey";
const LEGACY_DEEPSEEK_API_KEY_STORAGE_KEY = "ziwei.deepseek.apiKey";
const LEGACY_DEEPSEEK_MODEL_STORAGE_KEY = "ziwei.deepseek.model";
const DASHBOARD_SESSION_STORAGE_KEY = "ziwei.dashboard.adminSession";
const DEFAULT_WORKER_BASE_URL = "https://api.tanxj.xyz";
const ADMIN_LOGIN_ENDPOINT =
  import.meta.env.VITE_ADMIN_LOGIN_URL ||
  `${workerBaseUrl()}/api/admin/login`;
const ADMIN_STATS_ENDPOINT =
  import.meta.env.VITE_ADMIN_STATS_URL ||
  `${workerBaseUrl()}/api/admin/stats`;

type AdminSession = {
  token: string;
  username: string;
  expiresAt: string;
};

type AdminStats = {
  generatedAt?: string;
  limits?: Record<string, number | string>;
  today?: Record<string, number>;
  currentHour?: Record<string, number>;
  total?: Record<string, number>;
  last?: Record<string, unknown>;
  jobTtlSeconds?: number;
};

function Dashboard() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<AdminSession | null>(() =>
    readDashboardSession(),
  );
  const [stats, setStats] = useState<AdminStats>();
  const [loggingIn, setLoggingIn] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "warning" | "error">(
    "success",
  );

  const showNotice = (
    message: string,
    type: "success" | "warning" | "error" = "success",
  ) => {
    setNotice(message);
    setNoticeType(type);
  };

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      showNotice("请输入管理员用户名和密码。", "warning");
      return;
    }

    setLoggingIn(true);
    showNotice("正在登录管理后台。", "warning");

    try {
      const response = await fetch(ADMIN_LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          platform: "web",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(adminLoginErrorMessage(response.status, data));
      }

      const nextSession: AdminSession = {
        token: String(data.token || ""),
        username: String(data.username || username.trim()),
        expiresAt: String(data.expiresAt || ""),
      };

      if (!nextSession.token) {
        throw new Error("管理后台没有返回会话令牌，请确认 Worker 已部署最新版本。");
      }

      window.localStorage.setItem(
        DASHBOARD_SESSION_STORAGE_KEY,
        JSON.stringify(nextSession),
      );
      setPassword("");
      setSession(nextSession);
      showNotice("管理后台登录成功。");
      await loadStats(nextSession);
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "管理后台登录失败。",
        "error",
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = () => {
    window.localStorage.removeItem(DASHBOARD_SESSION_STORAGE_KEY);
    setSession(null);
    setStats(undefined);
    showNotice("已退出管理后台。");
  };

  const loadStats = async (targetSession = session) => {
    if (!targetSession?.token) {
      showNotice("请先登录管理后台。", "warning");
      return;
    }

    setLoadingStats(true);
    showNotice("正在读取 Worker 使用统计。", "warning");

    try {
      const response = await fetch(ADMIN_STATS_ENDPOINT, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${targetSession.token}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.localStorage.removeItem(DASHBOARD_SESSION_STORAGE_KEY);
          setSession(null);
        }

        throw new Error(adminStatsErrorMessage(response.status, data));
      }

      setStats(data);
      showNotice(`统计已更新：${dashboardDate(data.generatedAt)}`);
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "统计读取失败。",
        "error",
      );
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (session?.token) {
      void loadStats(session);
    }
  }, []);

  return (
    <main className="dashboard-shell">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow dark">admin dashboard</span>
          <h1>谈玄机后台</h1>
          <p>查看公开生成、完成、失败、限流、Token 和最近任务状态。</p>
        </div>
        {session && (
          <div className="dashboard-session">
            <span>{session.username}</span>
            <small>有效期 {dashboardDate(session.expiresAt)}</small>
          </div>
        )}
      </section>

      {!session ? (
        <form className="dashboard-card dashboard-login" onSubmit={login}>
          <h2>管理员登录</h2>
          <p>网页后台使用管理员用户名和密码登录；小程序管理页会额外校验微信身份。</p>
          <label>
            <span>用户名</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="管理员用户名"
            />
          </label>
          <label>
            <span>密码</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="管理员密码"
            />
          </label>
          <button type="submit" disabled={loggingIn}>
            {loggingIn ? "登录中" : "登录"}
          </button>
        </form>
      ) : (
        <section className="dashboard-grid">
          <div className="dashboard-card dashboard-toolbar">
            <div>
              <h2>使用统计</h2>
              <p>{stats ? `生成时间 ${dashboardDate(stats.generatedAt)}` : "暂无统计数据"}</p>
            </div>
            <div>
              <button
                className="secondary-dashboard-button"
                type="button"
                disabled={loadingStats}
                onClick={() => void loadStats()}
              >
                {loadingStats ? "刷新中" : "刷新"}
              </button>
              <button
                className="secondary-dashboard-button"
                type="button"
                onClick={logout}
              >
                退出
              </button>
            </div>
          </div>

          <div className="dashboard-stats">
            {dashboardStatCards(stats).map((card) => (
              <article className="dashboard-stat-card" key={card.label}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.subtext}</small>
              </article>
            ))}
          </div>

          <div className="dashboard-card dashboard-meta">
            <h2>接口与限制</h2>
            {dashboardMetaRows(stats).map((row) => (
              <div className="dashboard-meta-row" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {notice && (
        <div className={`dashboard-notice ${noticeType}`} role="status">
          {notice}
        </div>
      )}
    </main>
  );
}

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
              <div className="chart-scroll-shell" aria-label="紫微斗数命盘">
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
  const reportRef = useRef<HTMLDivElement>(null);
  const [deepSeekResult, setDeepSeekResult] =
    useState<DeepSeekInterpretationResponse>();
  const [deepSeekError, setDeepSeekError] = useState("");
  const [deepSeekLoading, setDeepSeekLoading] = useState(false);
  const [deepSeekStartedAt, setDeepSeekStartedAt] = useState<number>();
  const [deepSeekElapsedSeconds, setDeepSeekElapsedSeconds] = useState(0);
  const [deepSeekApiKey, setDeepSeekApiKey] = useState("");
  const [llmBaseUrl, setLLMBaseUrl] = useState(DEFAULT_LLM_BASE_URL);
  const [deepSeekModel, setDeepSeekModel] = useState(DEFAULT_LLM_MODEL);
  const [proxyAccessKey, setProxyAccessKey] = useState("");
  const [deepSeekApiKeySaved, setDeepSeekApiKeySaved] = useState(false);
  const [proxyAccessKeySaved, setProxyAccessKeySaved] = useState(false);
  const [deepSeekSaveNotice, setDeepSeekSaveNotice] = useState("");
  const trimmedDeepSeekApiKey = deepSeekApiKey.trim();
  const trimmedProxyAccessKey = proxyAccessKey.trim();
  const isGithubPages = window.location.hostname.endsWith("github.io");
  const hasExternalProxy = Boolean(
    import.meta.env.VITE_LLM_PROXY_URL || import.meta.env.VITE_DEEPSEEK_PROXY_URL,
  );
  const shouldPromptForApiKey =
    isGithubPages && !hasExternalProxy && !trimmedDeepSeekApiKey;
  const parsedDeepSeekReport = useMemo(
    () =>
      deepSeekResult ? parseLLMMarkdown(deepSeekResult.content) : undefined,
    [deepSeekResult],
  );
  const hasSectionedDeepSeekReport = parsedDeepSeekReport
    ? hasParsedLLMSections(parsedDeepSeekReport)
    : false;
  const hasProxyOption = hasExternalProxy || !isGithubPages;
  const canGenerateDeepSeekReport = Boolean(
    trimmedDeepSeekApiKey || (hasProxyOption && trimmedProxyAccessKey),
  );

  useEffect(() => {
    const savedApiKey = window.localStorage.getItem(
      LLM_API_KEY_STORAGE_KEY,
    );
    const legacySavedApiKey = window.localStorage.getItem(
      LEGACY_DEEPSEEK_API_KEY_STORAGE_KEY,
    );
    const savedBaseUrl = window.localStorage.getItem(LLM_BASE_URL_STORAGE_KEY);
    const savedModel = window.localStorage.getItem(LLM_MODEL_STORAGE_KEY);
    const legacySavedModel = window.localStorage.getItem(
      LEGACY_DEEPSEEK_MODEL_STORAGE_KEY,
    );
    const savedProxyAccessKey = window.localStorage.getItem(
      LLM_PROXY_ACCESS_KEY_STORAGE_KEY,
    );

    if (savedApiKey || legacySavedApiKey) {
      setDeepSeekApiKey(savedApiKey || legacySavedApiKey || "");
      setDeepSeekApiKeySaved(true);
    }

    if (savedBaseUrl) {
      setLLMBaseUrl(savedBaseUrl);
    }

    if (savedModel || legacySavedModel) {
      setDeepSeekModel(savedModel || legacySavedModel || DEFAULT_LLM_MODEL);
    }

    if (savedProxyAccessKey) {
      setProxyAccessKey(savedProxyAccessKey);
      setProxyAccessKeySaved(true);
    }
  }, []);

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

  useEffect(() => {
    if (!deepSeekResult) {
      return;
    }

    window.setTimeout(() => {
      reportRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }, [deepSeekResult]);

  const handleDeepSeekApiKeyChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setDeepSeekApiKey(event.target.value);
    setDeepSeekApiKeySaved(false);
    setDeepSeekSaveNotice("");
  };

  const handleProxyAccessKeyChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setProxyAccessKey(event.target.value);
    setProxyAccessKeySaved(false);
    setDeepSeekSaveNotice("");
  };

  const clearSavedDeepSeekApiKey = () => {
    window.localStorage.removeItem(LLM_API_KEY_STORAGE_KEY);
    window.localStorage.removeItem(LLM_BASE_URL_STORAGE_KEY);
    window.localStorage.removeItem(LLM_MODEL_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_DEEPSEEK_API_KEY_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_DEEPSEEK_MODEL_STORAGE_KEY);
    setDeepSeekApiKey("");
    setLLMBaseUrl(DEFAULT_LLM_BASE_URL);
    setDeepSeekModel(DEFAULT_LLM_MODEL);
    setDeepSeekApiKeySaved(false);
    setDeepSeekSaveNotice("已清除本机浏览器保存的 OpenAI 兼容接口配置。");
  };

  const clearSavedProxyAccessKey = () => {
    window.localStorage.removeItem(LLM_PROXY_ACCESS_KEY_STORAGE_KEY);
    setProxyAccessKey("");
    setProxyAccessKeySaved(false);
    setDeepSeekSaveNotice("已清除本机浏览器保存的后端访问密钥。");
  };

  const generateDeepSeekReport = async () => {
    if (!canGenerateDeepSeekReport) {
      setDeepSeekError(
        hasProxyOption
          ? "请填写后端访问密钥，或填写自己的模型 API Key。"
          : "当前环境没有可用后端代理，请填写自己的模型 API Key。",
      );
      return;
    }

    setDeepSeekLoading(true);
    setDeepSeekError("");
    setDeepSeekResult(undefined);
    setDeepSeekSaveNotice("");
    setDeepSeekElapsedSeconds(0);
    setDeepSeekStartedAt(Date.now());

    try {
      const response = await requestDeepSeekInterpretation(
        trimmedDeepSeekApiKey
          ? {
              mode: "browser",
              prompt: result.prompt,
              apiKey: trimmedDeepSeekApiKey,
              baseUrl: llmBaseUrl,
              model: deepSeekModel,
            }
          : {
              mode: "proxy",
              prompt: result.prompt,
              accessKey: trimmedProxyAccessKey,
            },
      );
      setDeepSeekResult(response);

      if (trimmedDeepSeekApiKey) {
        try {
          window.localStorage.setItem(
            LLM_API_KEY_STORAGE_KEY,
            trimmedDeepSeekApiKey,
          );
          window.localStorage.setItem(LLM_BASE_URL_STORAGE_KEY, llmBaseUrl);
          window.localStorage.setItem(
            LLM_MODEL_STORAGE_KEY,
            deepSeekModel,
          );
          setDeepSeekApiKeySaved(true);
          setDeepSeekSaveNotice(
            "已在本机浏览器保存 OpenAI 兼容接口配置，下次打开本页面会自动带出。",
          );
        } catch {
          setDeepSeekSaveNotice(
            "报告已生成，但浏览器拒绝本地保存接口配置。",
          );
        }
      } else if (trimmedProxyAccessKey) {
        try {
          window.localStorage.setItem(
            LLM_PROXY_ACCESS_KEY_STORAGE_KEY,
            trimmedProxyAccessKey,
          );
          setProxyAccessKeySaved(true);
          setDeepSeekSaveNotice(
            "已在本机浏览器保存后端访问密钥，下次打开本页面会自动带出。",
          );
        } catch {
          setDeepSeekSaveNotice(
            "报告已生成，但浏览器拒绝本地保存后端访问密钥。",
          );
        }
      }
    } catch (error) {
      setDeepSeekError(
        error instanceof Error ? error.message : "LLM request failed",
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

        <div className="deepseek-config" aria-label="LLM 连接配置">
          <div className="deepseek-config-header">
            <div>
              <strong>OpenAI 兼容接口</strong>
              <small>
                {trimmedDeepSeekApiKey
                  ? "使用你自己的模型账号直连"
                  : "使用我们配置的 Cloudflare Worker"}
              </small>
            </div>
            <span>
              {trimmedDeepSeekApiKey ? "浏览器直连" : "Cloudflare Worker"}
            </span>
          </div>
          <div className="deepseek-fields">
            <label>
              <span>自己的模型 API Key</span>
              <input
                type="password"
                autoComplete="off"
                value={deepSeekApiKey}
                onChange={handleDeepSeekApiKeyChange}
                placeholder="sk-..."
              />
            </label>
            <label>
              <span>API Base URL</span>
              <input
                value={llmBaseUrl}
                onChange={(event) => setLLMBaseUrl(event.target.value)}
                placeholder={DEFAULT_LLM_BASE_URL}
              />
            </label>
            <label>
              <span>模型</span>
              <input
                value={deepSeekModel}
                onChange={(event) => setDeepSeekModel(event.target.value)}
                placeholder={DEFAULT_LLM_MODEL}
              />
            </label>
            <label>
              <span>后端访问密钥</span>
              <input
                type="password"
                autoComplete="off"
                value={proxyAccessKey}
                onChange={handleProxyAccessKeyChange}
                placeholder="访问我们自建 Worker 的口令"
              />
            </label>
          </div>
          <p className="privacy-note">
            模型 API Key 和后端访问密钥只保存在你的浏览器本地；浏览器直连时我们不会收集、
            保存或上传你的模型 Key。走自建后端时，只会把后端访问密钥发给 Cloudflare
            Worker 做准入校验。
          </p>
          {shouldPromptForApiKey && (
            <p className="deepseek-warning">
              当前 GitHub Pages 未配置 Cloudflare Worker，请输入自己的模型 API Key 后生成。
            </p>
          )}
          {(deepSeekApiKeySaved ||
            proxyAccessKeySaved ||
            deepSeekSaveNotice) && (
            <div className="deepseek-local-row">
              <span>{deepSeekSaveNotice || "已读取本机保存的连接配置。"}</span>
              <div className="deepseek-local-actions">
                {deepSeekApiKeySaved && (
                  <button type="button" onClick={clearSavedDeepSeekApiKey}>
                    清除模型配置
                  </button>
                )}
                {proxyAccessKeySaved && (
                  <button type="button" onClick={clearSavedProxyAccessKey}>
                    清除后端密钥
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          className={`deepseek-button${deepSeekLoading ? " is-loading" : ""}`}
          type="button"
          onClick={generateDeepSeekReport}
          disabled={deepSeekLoading || !canGenerateDeepSeekReport}
          aria-busy={deepSeekLoading}
        >
          {deepSeekLoading
            ? `LLM 生成中 ${deepSeekElapsedSeconds}s`
            : trimmedDeepSeekApiKey
              ? "用我的 Key 生成正式解读"
              : "用后端代理生成正式解读"}
        </button>
        {!canGenerateDeepSeekReport && (
          <p className="deepseek-inline-hint">
            先填写后端访问密钥，或填自己的模型 API Key。配置只保存在当前浏览器。
          </p>
        )}
        {deepSeekError && <p className="deepseek-error">{deepSeekError}</p>}
      </section>

      {deepSeekLoading && (
        <section className="analysis-panel llm-progress-panel" aria-live="polite">
          <div className="llm-report-header">
            <h3>LLM 正在生成</h3>
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
            推理模型可能需要几十秒。请求没有丢，返回后会自动按章节填入下面的报告模块。
          </p>
        </section>
      )}

      {deepSeekResult && (
        <section className="analysis-panel llm-report-panel" ref={reportRef}>
          <div className="llm-report-header">
            <h3>LLM 解读已生成</h3>
            <span>
              {deepSeekResult.model || "llm"} ·{" "}
              {deepSeekResult.source === "browser" ? "浏览器直连" : "后端代理"}
            </span>
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
                  <span>LLM 正式解读</span>
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
                    LLM 本次没有返回这一节，先显示本地解释草案。
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

function workerBaseUrl(): string {
  const configuredBase = import.meta.env.VITE_WORKER_BASE_URL;

  if (configuredBase) {
    return trimTrailingSlash(String(configuredBase));
  }

  const proxyUrl =
    import.meta.env.VITE_LLM_PROXY_URL ||
    import.meta.env.VITE_DEEPSEEK_PROXY_URL;

  if (proxyUrl && /^https?:\/\//i.test(proxyUrl)) {
    try {
      return new URL(proxyUrl).origin;
    } catch {
      return DEFAULT_WORKER_BASE_URL;
    }
  }

  return DEFAULT_WORKER_BASE_URL;
}

function readDashboardSession(): AdminSession | null {
  const raw = window.localStorage.getItem(DASHBOARD_SESSION_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as AdminSession;

    if (!session.token) {
      return null;
    }

    if (session.expiresAt && Date.parse(session.expiresAt) <= Date.now()) {
      window.localStorage.removeItem(DASHBOARD_SESSION_STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    window.localStorage.removeItem(DASHBOARD_SESSION_STORAGE_KEY);
    return null;
  }
}

function dashboardStatCards(stats?: AdminStats) {
  const today = stats?.today || {};
  const hour = stats?.currentHour || {};
  const total = stats?.total || {};

  return [
    {
      label: "今日公开生成",
      value: dashboardNumber(today.publicCreateJob),
      subtext: `本小时 ${dashboardNumber(hour.publicCreateJob)} / 总计 ${dashboardNumber(total.publicCreateJob)}`,
    },
    {
      label: "今日完成",
      value: dashboardNumber(today.completedJobs),
      subtext: `本小时 ${dashboardNumber(hour.completedJobs)} / 总计 ${dashboardNumber(total.completedJobs)}`,
    },
    {
      label: "今日失败",
      value: dashboardNumber(today.failedJobs),
      subtext: `LLM 错误 ${dashboardNumber(today.llmError)} / 总计 ${dashboardNumber(total.failedJobs)}`,
    },
    {
      label: "今日限流",
      value: dashboardNumber(today.rateLimited),
      subtext: `本小时 ${dashboardNumber(hour.rateLimited)} / 总计 ${dashboardNumber(total.rateLimited)}`,
    },
    {
      label: "无效密钥",
      value: dashboardNumber(today.invalidKey),
      subtext: `本小时 ${dashboardNumber(hour.invalidKey)} / 总计 ${dashboardNumber(total.invalidKey)}`,
    },
    {
      label: "今日 Token",
      value: dashboardNumber(today.totalTokens),
      subtext: `输入 ${dashboardNumber(today.promptTokens)} / 输出 ${dashboardNumber(today.completionTokens)}`,
    },
  ];
}

function dashboardMetaRows(stats?: AdminStats) {
  const limits = stats?.limits || {};
  const last = stats?.last || {};

  return [
    {
      label: "公开限流",
      value: `每小时 ${limits.publicHourly || "-"} 次 / 每日 ${limits.publicDaily || "-"} 次 / IP 每日 ${limits.publicIpDaily || "-"}`,
    },
    {
      label: "公开任务接口",
      value: `${workerBaseUrl()}/api/llm/public/jobs`,
    },
    {
      label: "管理登录接口",
      value: ADMIN_LOGIN_ENDPOINT,
    },
    {
      label: "管理统计接口",
      value: ADMIN_STATS_ENDPOINT,
    },
    {
      label: "最近完成",
      value: dashboardLastEvent(last.completedJob),
    },
    {
      label: "最近失败",
      value: dashboardLastEvent(last.failedJob),
    },
    {
      label: "最近限流",
      value: dashboardLastEvent(last.rateLimited),
    },
  ];
}

function dashboardLastEvent(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "暂无";
  }

  const event = value as Record<string, string | number | undefined>;
  const parts = [
    dashboardDate(event.at),
    event.channel,
    event.reason,
    event.status,
  ];

  return parts.filter(Boolean).join(" · ") || "暂无";
}

function dashboardDate(value: unknown): string {
  if (!value) {
    return "-";
  }

  return String(value).replace("T", " ").slice(0, 19);
}

function dashboardNumber(value: unknown): string {
  const number = Number(value);

  return Number.isFinite(number) ? String(Math.floor(number)) : "0";
}

function adminLoginErrorMessage(status: number, data: Record<string, unknown>) {
  if (status === 401) {
    return "管理员用户名或密码不正确。";
  }

  if (status >= 500) {
    return `管理登录暂时异常（${status}）：${String(data.error || "未知错误")}`;
  }

  return `管理登录失败（${status}）：${String(data.error || "未知错误")}`;
}

function adminStatsErrorMessage(status: number, data: Record<string, unknown>) {
  if (status === 401) {
    return "管理登录已过期，请重新登录。";
  }

  if (status >= 500) {
    return `管理统计暂时异常（${status}）：${String(data.error || "未知错误")}`;
  }

  return `管理统计读取失败（${status}）：${String(data.error || "未知错误")}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
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

createRoot(document.getElementById("root")!).render(
  window.location.pathname.replace(/\/+$/, "") === "/dashboard" ? (
    <Dashboard />
  ) : (
    <App />
  ),
);
