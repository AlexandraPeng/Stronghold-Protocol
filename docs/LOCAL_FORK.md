# 本分支说明

## 来源

- Paper-Yuan/Stronghold-Protocol，feature/v0.2.1-fusion-master，提交 `06cd3d0aafee6d9b1a3c542414fb847e16871a4d`。
- Duo-Bu/Stronghold-Protocol-v0.1.3patch，提交 `a9c536d68ef6effc5bc672ceb3d37b6581e3f97c`。选择性移植，记录见根目录 PATCH_INFO.json。
- 保留各作者版权、GPL 许可及原生依赖许可。游戏素材需按上游工具和许可自行准备，不包含在 Git 仓库中。

## 网页运行

安装 Node.js 22+，在仓库根目录执行：

```sh
npm ci
npm run setup
npm start
```

默认访问 http://localhost:3000/ 。setup 下载素材需要网络；可选本地 3D 素材按上游 docs/DEPLOY.md 准备。游戏状态在内存中，重启服务会结束对局；部署应先检查 /healthz 的 rooms 和 matches，保留旧目录以便回滚。

## Android

使用 Java 17、Android SDK 34/build-tools 34.0.0 和 Gradle 8.0.2，先准备网页素材，再运行 `npm run bundle:android`，然后在 android 目录构建。`android/local.properties` 可设置本机 sdk.dir，但不得提交。签名通过 SP_STORE_FILE、SP_STORE_PASSWORD、SP_KEY_ALIAS、SP_KEY_PASSWORD 环境变量配置，私钥留在本机。应用 ID 为 com.pyf.stronghold，支持 ARM64。公开版不预填个人服务器地址，请在应用中填写自己的完整 http:// 或 https:// 地址。

仓库包含补丁后的 Android 源码；此前本地生成的 APK 未重新打包此补丁，不能视为当前源码的安装包。没有真实安卓设备验收记录。

## 修改与验证（2026-10-08）

- 指定干员的技能扩大范围触发；保留 SP_FULL 无条件触发。
- 阿戈尔复活回调前预留名额，避免嵌套倒地占用超额名额。
- 保留融合版 atkFinal、跨玩家吞噬与标记者倒地结算等更新。
- 旧 WebView 不支持的逻辑赋值写法改为等价兼容写法。
- Android 显式 http/https 地址不强加 3000 端口。

补丁专项测试 247/247；受时点影响的相关用例 3/3；两台服务器部署测试各 322/322；公网双客户端大厅和局内准备同步通过。扩大回归共 1516 项，1485 通过、31 项失败；31 项在修改前也能复现，不能宣称全量测试通过。

运行专项测试：

```sh
node --test test/content/selected-expanded-trigger.test.js test/content/egir-death-order-custom.test.js
```
