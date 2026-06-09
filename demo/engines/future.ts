export type ReferenceSystem = {
  id: string;
  name: string;
  status: string;
  inputs: string[];
  value: string;
  firstStep: string;
};

export const referenceSystems: ReferenceSystem[] = [
  {
    id: "guolao",
    name: "果老星宗 / 七政四余",
    status: "待接算法",
    inputs: ["出生年月日时", "性别", "出生地经纬度"],
    value: "中国古典星命体系，可用真实天象补充命盘层面的星体参考。",
    firstStep: "先调研可靠星历算法与宫制，再决定是否纳入主排盘。",
  },
  {
    id: "tieban",
    name: "铁板神数",
    status: "待接算法",
    inputs: ["出生年月日时", "性别", "校验问题"],
    value: "偏条文索引和校验推断，适合作为旁证，不适合第一阶段当主算法。",
    firstStep: "先整理公开流派资料，抽象成可追溯的规则表和版本标记。",
  },
];
