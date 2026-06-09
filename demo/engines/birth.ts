import { lunar2solar, solar2lunar } from "lunar-lite";

export type Gender = "male" | "female";
export type BirthdayType = "solar" | "lunar";

export type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type BirthInput = {
  birthday: string;
  birthTime: number;
  birthdayType: BirthdayType;
  gender: Gender;
  isLeapMonth?: boolean;
};

export type BirthProfile = BirthInput & {
  solar: DateParts;
  lunar: DateParts & { isLeap: boolean };
  hour: number;
  minute: number;
  date: Date;
  labels: {
    calendar: string;
    gender: string;
    birthTime: string;
    sourceDate: string;
    solarDate: string;
    lunarDate: string;
  };
};

export const birthTimes = [
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

const birthTimeHours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 23];

export function buildBirthProfile(input: BirthInput): BirthProfile {
  const sourceDate = parseDate(input.birthday);
  const hour = birthTimeHours[input.birthTime] ?? 0;
  let solar: DateParts;
  let lunar: DateParts & { isLeap: boolean };

  if (input.birthdayType === "solar") {
    const lunarDate = solar2lunar(input.birthday);
    solar = sourceDate;
    lunar = {
      year: lunarDate.lunarYear,
      month: lunarDate.lunarMonth,
      day: lunarDate.lunarDay,
      isLeap: lunarDate.isLeap,
    };
  } else {
    const solarDate = lunar2solar(input.birthday, input.isLeapMonth);
    solar = {
      year: solarDate.solarYear,
      month: solarDate.solarMonth,
      day: solarDate.solarDay,
    };
    lunar = { ...sourceDate, isLeap: Boolean(input.isLeapMonth) };
  }

  return {
    ...input,
    solar,
    lunar,
    hour,
    minute: 0,
    date: new Date(solar.year, solar.month - 1, solar.day, hour, 0, 0),
    labels: {
      calendar: input.birthdayType === "solar" ? "阳历" : "农历",
      gender: input.gender === "male" ? "男" : "女",
      birthTime: birthTimes[input.birthTime] ?? birthTimes[0],
      sourceDate: formatDate(sourceDate),
      solarDate: formatDate(solar),
      lunarDate: `${formatDate(lunar)}${lunar.isLeap ? " 闰月" : ""}`,
    },
  };
}

export function formatDate(date: DateParts): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}

function parseDate(date: string): DateParts {
  const [year, month, day] = date.split("-").map(Number);

  return { year, month, day };
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}
