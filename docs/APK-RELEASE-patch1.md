## Android 0.2.1-fusion-patch1

- 支持手机离线单机和服务器联机，包含中日语音、皮肤及离线资源。
- 合入指定技能扩大范围触发、阿戈尔复活名额保护；保留融合版较新的修复。
- 适用 Android 7.0+、ARM64；建议预留至少 2 GB 空间。
- 应用 ID：`com.pyf.stronghold`；版本号：`20261009`。与此前本地提供的 pyf APK 使用同一签名，可覆盖升级；与其他作者签名的 APK 不通用。
- 联机请自行填写完整服务器网址，本公开版不预填个人服务器。

### 验证

构建及 APK v2 签名验证通过；266 项补丁/兼容性测试通过。13,219 个资源路径齐全，中日语音各 2,674 条；449 个包内源码/数据文件与本次构建目录一致。尚无安卓真机验收。完整回归仍有 31 项修改前已存在的失败，详见 docs/LOCAL_FORK.md。

文件：`Stronghold-Protocol-0.2.1-fusion-patch1-arm64.apk`

大小：644407587 字节（约 644 MB）。

SHA-256：
```
cf4adaac22581872d302c25e63bfafb75437ca78bdc4efcae24abd1a9bff8f7f
```

签名证书 SHA-256：
```
a7d9872d55941add9962f77b514133ed1f1c04af3b9e483bc0cf608f45b5efee
```

### 来源与许可

基于 sganggs/Stronghold-Protocol、Paper-Yuan/Stronghold-Protocol（06cd3d0），选择性合入 Duo-Bu/Stronghold-Protocol-v0.1.3patch（a9c536d）。保留 GPL 及第三方许可声明；非官方同人，素材版权归鹰角/Yostar，禁止商业使用。
