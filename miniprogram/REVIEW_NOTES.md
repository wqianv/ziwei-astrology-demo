# WeChat Review Notes

Use this as a copy source when creating an experience-version draft or submitting
the Mini Program for review. Do not paste production secrets or backend access
keys into this file.

## Suggested Version Description

```text
原生小程序排盘与传统文化解读体验：接入 iztro 原生紫微斗数摘要、出生信息本机保存、LLM 解读发送确认、后端密钥本机保存和 H5 备案路线入口。
```

## Suggested Review Comment

```text
本小程序用于传统命理文化资料整理、排盘展示和娱乐参考，不提供确定性预测，不作为医疗、法律、投资、婚姻、人事录用等重大决策依据。

核心体验已原生化：用户可在首页进入“原生排盘”，修改生日、时辰和性别后查看本机生成的四柱摘要、紫微十二宫、星曜与大限信息。模型解读需要用户在“设置与上线检查”页保存后端访问密钥，并在原生排盘页勾选发送确认后才会请求后端代理。出生信息、发送确认、后端访问密钥和最近一次解读缓存均保存在本机微信存储，用户可在设置页点击“清除本机数据”删除。

保留的 H5 入口用于备案路线和完整盘面对照，业务域名为 https://www.tanxj.xyz；原生请求合法域名为 https://api.tanxj.xyz。后端接口未带访问密钥时返回 401，用于保护模型代理。
```

## Reviewer Test Path

```text
1. 打开小程序首页。
2. 点击“打开原生排盘”，确认页面无横向滚动。
3. 修改生日、时辰和性别，观察摘要卡片和紫微十二宫刷新。
4. 进入“设置与上线检查”，保存临时审核用后端访问密钥。
5. 点击“测试后端连接”，确认后端链路可用。
6. 回到“原生排盘”，勾选发送确认后点击“生成原生解读”。
7. 等待进度提示完成，查看分段解读结果。
8. 测试“复制解读”“清除本机解读”“重置出生信息”和“清除本机数据”。
9. 若 web-view 业务域名已通过平台配置，可点击“网页版完整盘”查看 H5 对照入口。
```

## Submitter Checklist

- Run `npm run mini:release-check -- --require-clean --with-domain-check`.
- Scan the latest preview QR on a phone and complete the Phone QA checklist in
  `README.md`.
- Confirm `https://api.tanxj.xyz` is configured as a request legal domain.
- Confirm `https://www.tanxj.xyz` is configured as a web-view business domain
  if the H5 route is included in review.
- Provide only a temporary reviewer backend access key through the WeChat
  submission channel if the reviewer needs to test LLM generation.
- Never commit backend access keys, model API keys, or WeChat private project
  configuration.
