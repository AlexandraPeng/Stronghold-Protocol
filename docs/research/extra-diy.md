# 新增自选协防干员（2026-10-12）

## 配置与使用

在「干员调配 → 自选编队」的五阶或六阶槽位选择以下干员，再选择三项技能之一。沿用现有自选编队的槽位数量、升阶规则和满潜能训练数据。

| 干员 | 主羁绊 | 副羁绊 | 战斗实现 |
| --- | --- | --- | --- |
| 结城理 | 协防干员 | 拉特兰 | 三技能、人格面具切换、恐惧斩杀、弱点伤害、奥菲斯治疗/闪避、总攻击、PUM-Y 模组 |
| 丰川祥子 | 协防干员 | 无 | 三技能、音符追踪/穿透、钢琴/管风琴切换、共享 Fever、技力与持续时间处理、致命伤延迟退场、LOR-Y 模组 |
| 克莱门莎 | 协防干员 | 阿戈尔 | 三技能、船舱搬运与重量限制、漩涡、侵蚀损伤、遥击炮击与弹药 |

普通形态为精二 1 级、技能 4 级、无模组；精英形态为精二 60 级、技能 7 级，五阶/六阶分别使用 1/3 级模组。克莱门莎当前数据没有模组。所选副阵营按用户要求覆盖；原始势力仍保留，供 S.E.E.S. 和 Ave Mujica 机制辨认。

## 来源

- [PRTS 结城理](https://prts.wiki/w/结城理)
- [PRTS 丰川祥子](https://prts.wiki/w/Togawa_Sakiko)
- [PRTS 克莱门莎](https://prts.wiki/w/克莱门莎)
- 数值、技能黑板、天赋与模组来自 [ArknightsGameData 中文客户端数据镜像](https://github.com/Kengxxiao/ArknightsGameData/tree/master/zh_CN/gamedata/excel)，2026-10-12 获取。
- 克莱门莎技能及其测试改编自[LongQianChen/Stronghold-Protocol](https://github.com/LongQianChen/Stronghold-Protocol) 的 GPL-3.0-or-later 上游提交 `2e12cdfe73faff7e5eb64031a89f624ecd4c1b55`；适配了本仓库的范围注册 API、DIY 输入格式和满潜能数据。
- 方形头像来自 PRTS；自选槽位的竖版证件照来自 yuanyan3060/ArknightsGameResource 的 portrait 目录（180×360），与已有干员一致。技能图标和 Spine 模型沿用现有 fexli 资源下载链。资源权利归原权利人，二进制资源保持仓库既有忽略规则。

## 自走棋适配与证据边界

全部三技能和上述特殊机制均已接入，但不声称逐帧复刻原作客户端：

- 本游戏自动施放手动技能。结城理三技能的免费二次切换在可治疗友军生命不高于一半时触发，仍受操作冷却约束；受到致命伤也会切换。第二次切换不重置最初的替身到期时间。
- 祥子二技能满技力且有目标时自动切换音色。多名相同干员的同名光环取最高值，音符天赋按战场音符计数封顶，避免六人联机时同名加成成倍放大。这是多人自走棋适配规则。
- 祥子一技能首发采用 Spine 的 0.267 秒事件，其余七枚暂以 0.1 秒间隔发出；三技能一轮四枚音符目前同时发射，未逐帧拆分原动画的两个发射时点。
- 结城理初次切换使用模型的 1 秒动画长度；二次切换使用相同保护窗口。总攻击采用现有模拟的即时伤害调度及 1.6 秒阶段，未逐帧还原每个演出事件。
- PRTS 对克莱门莎部分细节尚缺明确说明。船舱放逐按禁止移动/攻击/阻挡但仍可受伤处理，边界留白 0.4 格；炮击首发延迟 0.5 秒，后两发相隔 1 秒；已发射炮弹保留至命中。这些假设集中在技能文件开头。
- 音符与 Fever 使用现有网页渲染器的粒子和进度条。没有加入原作 Fever 专属音乐或完整特效演出。
- 初次验证使用本机临时服务；发布批次为 0.2.1-fusion-patch3。本次不重新打包 APK。

## 重建

先将上述镜像的 `character_table.json`、`skill_table.json`、`range_table.json`、`uniequip_table.json`、`battle_equip_table.json` 放入 `.cache/new-operators/`，然后在仓库根目录运行：

```sh
node tools/build-extra-diy.mjs
python tools/fetch-extra-diy-images.py
node tools/fetch-diy-assets.mjs char_4217_makoto char_4182_oblvns char_4231_clemnt
```

`build-extra-diy.mjs` 只合并这三人的数据，已有干员不变。若运行全量旧数据构建器，需在其后再运行此步骤。下载器需要本项目依赖已经安装。网页运行时直接读取 `data/` 与 `server/sim/`；安卓打包时由既有 `bundle:android` 复制。

本次数值来源文件 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| character_table.json | e523c7c83c36e2d76697121079e17d0282da1a94d59a55e1cc55616edf0b41c4 |
| skill_table.json | b6559b845efea6042e23f1d976185f12e13de3d749464543f5c2c17a7d2fa280 |
| range_table.json | 4d974598394630a1ad465b954321254397f514c7fb26cba944d320ac18b874d0 |
| uniequip_table.json | c436d9ca672c8e8c3926d0ccbd496f7591004baf944f8cb47458572f4eaa8590 |
| battle_equip_table.json | 991ce1a8cd76682704b7e95fb71de8c726fd9ff62038a2da31b8a3870dc48055 |

## 验证

`test/content/extra-diy.test.js` 覆盖三名干员的五/六阶、普通/精英、三技能组合；三个独立技能测试文件覆盖替身、斩杀和护盾、船舱、弹药、音符、Fever、多名重复干员和房间状态隔离。合并运行现有伤害、自选 UI、商店、渲染和傀儡测试。

Edge 无头浏览器通过真实网页模拟器与渲染器加载三名干员，确认三套 Spine 就绪、结城理替身动画切换、祥子 Fever 条与音符快照有效，无页面异常或 HTTP 失败。尚未进行真人多人长局或安卓设备验证。

最终本地合并回归：195 项，193 通过、0 失败、2 项因现有满潜能测试所需的旧原始数据缓存缺失而跳过。自选界面浏览器验证：三名干员均显示正确羁绊、3 个技能选项，所用图片均加载成功。
