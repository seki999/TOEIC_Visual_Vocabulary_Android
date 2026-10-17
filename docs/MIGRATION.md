# Web 源码复用与 Android 模块

来源：https://github.com/seki999/toeic-visual-vocabulary

本次读取的源版本：`b07e33dee1b9c834c3e333b0ce38af7194af307f`。原仓库只克隆到本地忽略目录 `.upstream-web/` 供阅读，未修改或推送。Android 版本在当前独立仓库开发。

| 分类 | 来源/模块 | Android 处理 |
|---|---|---|
| 直接复用 | `src/types.ts` | Word、Picture、List、Manifest、Field、fieldText、language、asset 保持兼容 |
| 直接复用 | `public/data/`、`public/images/` | 原样复制，构建时逐路径验证；无数量常量 |
| 修改复用 | `src/store.ts` | 保留 Zustand 设置与默认语速，新增 Tab、稳定词汇 ID，迁移不重置用户语速及常亮偏好 |
| 修改复用 | `App.tsx` NumericSettingInput | 沿用字符串草稿/失焦提交，移入 `Settings.tsx` |
| 修改复用 | 词汇字段、朗读顺序、重复/循环语义 | 复用字段映射；队列迁入原生 QueueCursor，独立字段 utterance |
| 替换 | Web `SpeechPlayer` | Kotlin `PlaybackService` 是唯一播放所有者，页面无 speechSynthesis 或播放计时器 |
| 修改 | Web 单体 Reader/PictureView/设置 UI | 原文件耦合上传及草稿编辑，拆为触屏只读界面、图片查看器及设置；手机不强制并列 |
| 不带入 | drafts、localEditor、IndexedDB 图片草稿、JSZip、Excel 导入、编辑 Vite 插件 | 不安装对应运行依赖，不存在 App 数据编辑入口 |
| 新增 | native.ts / VocabularyTTSPlugin | 命令、版本化快照、前台重新同步、离线声音查询、通知权限 |
| 新增 | PlaybackService / QueueCursor / OfflineVoicePolicy | 前台通知、原生队列、MediaSession、音频焦点、超时与回调失效、语言包检测 |
| 新增 | PlaylistOrder / 多 List 循环设置 | manifest 顺序解析所选 List，原生服务跨 List 连播、组末回环、删除 ID 兼容、设置持久化及循环模式互斥 |
| 新增 | MainActivity | Android 系统 Insets、返回键/手势、旋转配置、FLAG_KEEP_SCREEN_ON |
| 新增 | 资源校验、PowerShell、Actions、测试 | 构建 APK、检测升级位置及未来 manifest List、四种视口 |

UI 显示状态与播放状态分离：Zustand 保存显示和学习偏好；服务保存正在播放的 List/词条/字段/重复和间隔。切换图文 Tab 仅修改显示设置，不发 play/seek。服务向 UI 发布递增 revision，忽略过期快照；TTS 回调同时匹配队列代次及 utterance ID。设置变更只在下一语音边界应用，不创建第二个播放器。

暂停策略：停止当前 utterance，保存字段游标；恢复时从该字段开头重新朗读。若已进入间隔，恢复重新等待该间隔。操作系统杀死整个进程后，不自动抢占音频重播；重开 App 恢复词汇位置，由用户点播放从该词首字段开始。停止保留当前词汇，释放服务及播放资源。

原生服务每次读取打包后的 `public/data/manifest.json` 和对应 List，不信任固定文件名。词汇 JSON 与图片关联规则未改；开发者维护 JSON，普通用户只读。

Android 实现参考：[Android 音频焦点](https://developer.android.com/media/optimize/audio-focus)、[Capacitor 自定义 Android 插件](https://capacitorjs.com/docs/v6/android/custom-code)。目标 API 35 的音频焦点在进入媒体播放前台服务后申请。
