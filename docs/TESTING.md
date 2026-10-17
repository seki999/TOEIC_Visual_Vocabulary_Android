# 测试记录与真机验收

更新日期：2026-10-18（日本时间）。自动测试结果与设备实测严格分开。

## 已执行的检查

- 资源校验：13 List、626 词条、626 张关联图片，结构及引用完整；数字仅是本次校验结果，业务代码不依赖这些数量。
- TypeScript、ESLint、前端生产构建通过。
- Vitest：6 项，覆盖原字段/语言/路径规则、稳定 ID 恢复/删除夹取、新增 manifest List、允许缺图、拒绝损坏引用、初次安装与旧设置合并。
- Playwright：手机 393×851/851×393、平板 800×1280/1280×800，共 20 项通过。覆盖六字段默认顺序、取消后重新勾选的位置、手动排序和恢复默认，以及模式、Tab 不改词、选中位置、数字清空重输、持久化、无上传入口、主区域与控制栏不重叠、缺图、全屏按钮隐藏/恢复、回到首词、多个 List 的选择保存和循环模式互斥。此为 Chromium 视口测试，不是 Android 真机验收。
- 原生逻辑测试共 13 项通过：跳词、过期代次、暂停/恢复、字段/单词重复、单词/List 循环、停止、离线声音选择，以及 manifest 顺序、删除/重复 List ID、跨 List 首尾回环、重复完成后换 List、跨 List 后旧回调失效、暂停/停止边界。
- Android Lint 无错误，有依赖版本更新、模板资源等警告。系统 MediaSession 兼容 API 存在弃用编译警告。
- `assembleDebugAndroidTest` 已通过，包含服务生命周期测试的仪器 APK 编译成功，未在设备执行。
- APK 逐文件 SHA-256 验证通过：640 个引用（manifest、13 个 List 和 626 张图片）与项目资源完全一致。
- 一键脚本构建应用及仪器测试 APK。多个 List 循环版 1.1.0 已通过 `apksigner verify`（与旧本地 APK 相同的 Android Debug 证书、v2 签名）和 `aapt dump badging` 检查，minSdk=26、targetSdk=35。本次六字段默认顺序版提高到 versionName=1.1.1、versionCode=3，applicationId 保持一致。
- Vitest 设置迁移回归同时检查：原两字段默认顺序升级为六字段，保留语速和自定义顺序，不清空学习位置及多 List 设置。
- 最新 Debug APK 校验和在 `release/SHA256.txt`，每次一键构建后自动更新。

## 尚未完成的验证

本机 `adb devices` 无连接设备，也没有配置 Android 模拟器。`PlaybackLifecycleTest` 已添加，覆盖反复服务启动/停止与 Wake Lock 释放，编译通过与实际执行会分别记录。**未执行真机服务生命周期、安装启动、锁屏连续播放、电话/耳机控制和 30 分钟测试。**

GitHub Actions 已于 2026-10-16 验证成功：[运行 #2](https://github.com/seki999/TOEIC_Visual_Vocabulary_Android/actions/runs/38850950626)，代码提交 `c113e0d`。前端检查、原生单元测试、Android Lint、应用和仪器测试 APK 编译及 Artifacts 上传均成功，产物为 `toeic-visual-vocabulary-Android-debug` 和 `android-test-reports`。首轮失败发生在 SDK 安装：setup-android v3 默认请求已下架的 `tools` 包；修复为显式安装 `platform-tools`，并固定 Ubuntu 24.04、升级 setup-java v5。云端成功不代表真机测试通过。

## 真机测试矩阵（逐项填入设备/系统/结果/日志）

至少一台手机、一台平板。记录 Android API、TTS 引擎版本、离线语音名称及厂商省电模式；在普通模式与设备允许的省电模式下重复。以下均待测：

| 项目 | 操作与期望 | 状态 |
|---|---|---|
| 离线安装启动 | 安装 APK，关闭网络；切换全部 List，图片与无图词均可阅读 | 待真机 |
| 持续常亮 30 分钟 | 系统短超时，设置常亮开启，List 循环朗读 30 分钟，屏幕不自动黑屏 | 待真机 |
| 取消常亮 | 朗读中关闭常亮，或暂停/停止；等待系统休眠超时，恢复正常熄屏 | 待真机 |
| 电源键锁屏 | 播放中按电源键，应立即锁屏、朗读不中断 | 待真机 |
| 锁屏 30 分钟 | List 循环，含中英字段，记录词序和重复，至少自动前进 30 分钟 | 待真机 |
| 中英语速 | 英语 0.8、中文 1.2；锁屏继续，分别调速后下一语音边界应用 | 待真机 |
| 后台与恢复同步 | 切其他 App 10 分钟后回来，词条高亮与服务/通知一致 | 待真机 |
| 多 List 后台循环 | 选择不相邻的两个 List，从末词开始，锁屏验证切到下一所选 List 首词、组末回到组首、字段/单词重复、通知/前台同步以及耳机跨 List 控制 | 待真机 |
| 音频中断 | 来电/其他音频抢焦点时暂停；短暂中断可恢复，永久丢失需手动恢复 | 待真机 |
| 耳机和锁屏控制 | 蓝牙/有线支持的 play/pause/next/previous，拔耳机暂停 | 待真机 |
| 资源释放 | 播放/暂停/恢复/停止反复 20 次，停止后服务、通知、Wake Lock 无遗留 | 待真机 |
| 显示与旋转 | 三模式、全屏、横竖屏、字体最大值、返回键/手势关闭抽屉/设置/全屏 | 待真机 |
| 缺少语言包 | 无中文离线声音时选择中文字段，停止并提示，无网络回退或无限空转 | 待真机 |
| 升级 | 同证书、提高 versionCode，覆盖安装新增 List 和重新排序/删词版本；设置与旧 List 位置保留 | 待真机 |
| 极端省电/强行停止 | 记录系统行为；允许中断，不要求绕过系统/用户停止 | 待真机 |

## 日志与仪器测试

```powershell
adb devices
adb install -r .\release\toeic-visual-vocabulary-Android-debug.apk
Set-Location android
.\gradlew.bat connectedDebugAndroidTest
```

测试需设备已解锁、可前台启动 Activity、安装完成且允许测试控制。仪器测试报告在 `android/app/build/reports/androidTests/connected/`。

播放中、锁屏后和停止后分别保存以下信息（在根目录执行，先建立日志目录）：

```powershell
New-Item -ItemType Directory -Force device-test-logs
adb shell dumpsys power > device-test-logs/power.txt
adb shell dumpsys activity services com.seki999.toeicvisualvocabulary > device-test-logs/services.txt
adb shell dumpsys media_session > device-test-logs/media-session.txt
adb shell dumpsys audio > device-test-logs/audio.txt
adb logcat -d > device-test-logs/logcat.txt
```

使用不同文件名保留前后快照。播放期可见 `com.seki999.toeicvisualvocabulary:tts` Wake Lock，暂停/停止后应消失；Activity 常亮标志不应阻止主动锁屏。不要仅凭 dumpsys 判定可听播放，应同时实际聆听并记录词汇推进。

## 依赖审计

运行时依赖 `npm audit --omit=dev` 为 0。固定 Capacitor 6.2.2 修复了运行时已知代理源问题。完整开发依赖审计仍报告 Capacitor CLI 6 间接 `tar` 的 1 high、1 critical；仅用于受信 npm 安装包内模板解压，不进入 APK。试用强制覆盖 tar 7 时 CLI 模板解压 API 不兼容，已恢复可构建组合，未隐藏审计结果（见 `npm-audit.json`）。后续可连同 JDK/Capacitor 主版本一起升级，不能用不兼容覆盖冒充修复。
