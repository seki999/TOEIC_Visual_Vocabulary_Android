# TOEIC Visual Vocabulary Android

独立的 Android 手机/平板词汇学习项目，源自 [Web 版](https://github.com/seki999/toeic-visual-vocabulary)。使用 React 19、TypeScript、Vite、Zustand、Capacitor 和 Kotlin。没有改造原 Web 仓库。

当前可构建 **Debug APK**，未配置正式 Release 签名。真机 30 分钟常亮、锁屏和耳机测试尚未执行，不能据构建成功宣称这些设备行为已验收。

## 使用

- 图文：文字与图片两页，顶部 Tab 或横向滑动切换，不换词、不打断队列。
- 仅文字：单词、音标、词性、中英搭配与例句；字段显隐与字号可调。
- 仅图片：等比显示、全屏、图片覆盖字段、文字颜色/大小/位置/背景透明度、看图猜词。全屏可隐藏退出按钮，点击图片重新显示；Android 同时隐藏系统栏，返回键仍可退出。无图片仍能阅读和朗读。
- 左侧 List 抽屉及全词库搜索；底部词条条选择朗读起点，当前词高亮、自动跟随，手动滑动暂停跟随。
- 底部“首词”按钮可一键回到当前 List 第一个单词；播完后点击不自动播放，需再点“播放”。
- 设置 → 循环范围 →“多个 List 循环”：勾选所需 List，按词库顺序连续朗读，末尾回到首个选中的 List。当前 List 已选中时从当前词开始，否则从首个选中 List 的首词开始；切换到其他 List 时从首词开始。选择自动保存，新增 List 自动可选；与单词循环、单 List 循环互斥。播放期间的选择修改从下一次 List 切换生效，上一词/下一词和耳机控制可跨所选 List。
- 英语 0.8、中文 1.2 默认语速；独立声音/语速、美英口音（需系统离线声音）、音调、音量、顺序、重复、间隔、单词/List 循环。
- 原生 Android TTS 前台服务独立调度，MediaSession/通知栏控制，音频焦点中断和拔耳机处理。恢复从被中断字段开头重读，不声称能精确恢复句中位置。
- 朗读时默认由 Activity 开启 `FLAG_KEEP_SCREEN_ON`；暂停/停止或设置关闭时清除。电源键仍可锁屏，服务使用有超时保护的 Partial Wake Lock；暂停、停止、销毁均释放。

所有词汇和图片在 APK 内，App 没有上传、编辑、导入或导出功能，也未申请 INTERNET 权限。**离线朗读还需设备预先安装对应 TTS 引擎及英语/中文离线语言包**；缺包会停止并提示，不静默改用网络声音。极端省电、系统杀进程及强制停止可能中断播放；不申请电池优化豁免。

## Windows PowerShell 一键构建

需要 Node.js 22+、JDK 17、Android SDK（platform 35、build-tools 35.0.0、platform-tools）。可通过 Android Studio 的 SDK Manager 安装，设置 `JAVA_HOME`、`ANDROID_HOME`，并接受 SDK 许可。Gradle Wrapper 已包含，首次构建需要网络下载依赖。

如未设置 ANDROID_HOME，创建不提交的 `android/local.properties`：

```properties
sdk.dir=C:/Users/你的用户名/AppData/Local/Android/Sdk
```

在仓库根目录执行：

```powershell
.\build-android.ps1
# 已安装依赖时：
.\build-android.ps1 -SkipInstall
```

依次执行 npm ci、JSON/manifest/图片验证、类型检查、Lint、单元测试、Vite 构建、Capacitor 同步、Gradle 单元测试/Lint/应用与仪器测试 APK 编译，复制到：

`release/toeic-visual-vocabulary-Android-debug.apk`

仪器测试 APK 编译并不等于在设备上执行。浏览器回归单独运行：

```powershell
npx playwright install chromium
npm run test:browser
```

## 安装与测试

Android 8.0（API 26）以上，支持手机和平板、横竖屏。将 APK 传到设备，允许所用文件管理器“安装未知应用”，点击安装。开发设备也可用：

```powershell
adb devices
adb install -r .\release\toeic-visual-vocabulary-Android-debug.apk
adb shell am start -n com.seki999.toeicvisualvocabulary/.MainActivity
```

首次播放允许通知权限，以便查看通知栏控制。到系统“文字转语音输出”安装离线声音。关闭网络后分别查看图片、切换 List 并朗读英语和中文。

连接真机后运行生命周期测试：

```powershell
Set-Location android
.\gradlew.bat connectedDebugAndroidTest
```

详细测试记录与 30 分钟设备验收步骤：[docs/TESTING.md](docs/TESTING.md)。源码复用说明：[docs/MIGRATION.md](docs/MIGRATION.md)。

## 持续维护词库与升级

保持 Web 格式：`public/data/listXX.json`、`public/data/manifest.json`、`public/images/listXX/`。新增 List 或词条后，更新 manifest 的 id/title/count/file 和 total，重新运行脚本即可，不需修改 React、Kotlin 或播放器。图片数组允许为空；引用了不存在的文件则阻止构建。校验也会阻止重复 ID、结构缺失及资源目录越界。

升级时保持 `com.seki999.toeicvisualvocabulary` applicationId 和相同签名证书，在 `android/gradle.properties` 提高 `APP_VERSION_CODE`，可同时更新 `APP_VERSION_NAME`。使用 `adb install -r` 或普通覆盖安装；不要卸载或清除数据。Zustand 保留偏好及每个 List 的位置，按稳定词条 ID 优先恢复；删除词条时安全夹取索引，删除 List 后选择 manifest 首个可用 List。

本地 Debug 默认使用本机 Android debug.keystore。**不同电脑或 GitHub runner 的 Debug 签名可能不同，不能保证互相覆盖安装**。正式发布前应配置并备份长期签名证书；当前脚本和 CI 只输出明确命名的 Debug APK，不冒充正式版。

## GitHub Actions

`.github/workflows/android.yml` 在 push、PR 或手动触发时检查和构建，成功后在该次 Actions 页面 Artifacts 下载 `toeic-visual-vocabulary-Android-debug`。测试报告另存 `android-test-reports`。工作流配置已添加；本地开发不等于 GitHub 执行成功，需推送后查看真实运行记录。

## 开发边界

`npm run dev` 仅提供只读浏览器预览；浏览器不代替原生 TTS，不使用 speechSynthesis 模拟 Android 后台能力。原生播放所有权在 `PlaybackService.kt`，页面重建和旋转不重启服务。仓库未包含正式签名密钥。
