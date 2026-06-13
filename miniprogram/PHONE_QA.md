# Phone QA Record

Use this file as the manual QA record after scanning a preview QR or opening an
experience version on a real phone. Do not paste admin passwords, backend keys,
model API keys, session tokens, or other secrets here.

## Run Metadata

- Date:
- Tester:
- Phone model / OS:
- WeChat version:
- Mini Program source:
- Preview QR or experience version:
- Git commit:
- Management login: owner account tested / not tested

## Required Checks

Mark each item as `PASS`, `FAIL`, or `N/A`, then add a short note when useful.

| Result | Check | Notes |
| --- | --- | --- |
|  | Mini Program opens directly to the native chart page. |  |
|  | Native chart page opens without horizontal scrolling. |  |
|  | Birth date, birth time, and gender changes refresh the local summary cards. |  |
|  | Birth profile restores after reopening, and `重置出生信息` clears the saved profile. |  |
|  | The 4x4 Ziwei board fits the phone width and palace selection updates the detail card. |  |
|  | Tapping `模型解读` seven times on the usage page opens the management backend. |  |
|  | Management page requires admin username/password and the owner WeChat identity. |  |
|  | Management page backend test succeeds, or shows a readable domain/session/network error. |  |
|  | Management page refreshes usage, failure, invalid-key, and rate-limit stats. |  |
|  | Management page can copy diagnostic text without including passwords, tokens, backend keys, or model keys. |  |
|  | Management page `清除本机数据` resets local admin session, client id, birth profile, send consent, and latest report cache. |  |
|  | LLM generation stays disabled until send consent is selected. |  |
|  | Slow LLM requests show progress text, and a successful response fills sectioned report cards. |  |
|  | Reopening the same birth profile restores the latest local LLM report. |  |
|  | `清除本机解读` removes the local report cache. |  |
|  | `复制解读` copies the sectioned report with a usage-boundary note and no backend or model secret. |  |
|  | Native/web-view share entries behave as expected. |  |
|  | Web-view entry opens `https://www.tanxj.xyz` after the business domain is accepted by WeChat. |  |

## Result Summary

- Overall result:
- Blocking issues:
- Non-blocking polish:
- Follow-up owner:
