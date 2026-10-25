# 干员皮肤 (Operator skins)

An operator's Spine model and its pictures can be replaced by one of its official alternative outfits (时装). This
document is the normative reference for that feature; the art itself is **never** downloaded or written by the server —
it comes from a **cosmetic plugin's overlay** (docs/PLUGINS.md §9), which the server's owner installs in `plugins/` and
each player switches on for themself.

> 上游 #652 被关闭的原因写在这里，因为它是这个设计的出发点：**服务器不提供安装通道**。当时的 `room.skin.install`
> 让任何已连接的客户端都能让服务器去网上下载文件并改写所有客户端共读的 `data/assets.json`，而随包发布的
> `data/skins-installed.json` 又会让更新校验对不上。本实现没有安装报文、不写 `data/` 下的任何文件、不随包发布任何
> 安装状态：皮肤属于插件，插件怎么落地是 `plugins/` 目录（安装、studio、ZIP）本来就有的问题。

## The data: one overlay, no catalogue file

```
plugins/<id>/plugin.json
  └── assets (or a .json file):  chars[<charId>].illust ……     the operator's own 立绘 (one picture)
                                 chars[<charId>].skins[<skinKey>] = { name, group, avatar, avatarE2,
                                                                      portrait, portraitE2, illust,
                                                                      spine: { front, back? } }
        │
        ├── the server checks the overlay (shared/plugins/visual.js, docs/PLUGINS.md §9) and serves it as a document:
        │   /vs/<vs16>/overlay.json — composed on the INSTALLATION's manifest, never on a copy of it
        │
        └── the browser composes it (public/js/cosmetics.js cosmetics.apply) on the manifest it already loaded
                 │
                 └── data.get('assets') — what every screen reads (public/js/data.js setView)
                          │
                          ├── chars[<charId>].skins[<skinKey>]  →  the picker's rows (public/js/ui/skins.js availableSkins)
                          └── chars[<charId>].skins[<skinKey>].spine  →  the model (public/js/assets.js spineEntry { skin })
```

Three properties are load-bearing:

- **A skin key is the KEY, and it is data.** It carries `@` `#` `+` `.` (`char_002_amiya@winter#1`), so it is **not** an
  `isId` (shared/protocol.js `isSkinId`). A plugin that has no official id for a skin may write the stem form
  (`char_102_texas_epoque_7`) [ASSUMED: docs/PLUGINS.md §9]. Whatever writes a skin and whatever wears it must agree on
  that exact string.
- **The choice is keyed by OPERATOR (charId), not by chess.** `chars[<charId>].skins` is the manifest's own grouping, so
  one entry covers an operator's normal piece, its elite (the merge) and a 自选 slot fielding it. The renderer agrees:
  a unit's skin resolves through `d.spine ?? d.charId ?? u.defId` (server/sim/snapshot.js), i.e. the charId.
  Every owner/scout board, hand, temp and battle input resolves the **effective body** with `PlayerState.fieldRecord`:
  a stand-in uses `backup.charId`, a 自选 slot its pick. Official source:
  `activity_table.activity.AUTOCHESS_SEASON.act2autochess.charShopChessDatas` `backupCharId` (for example
  `chess_char_3_01_a`: `char_103_angel` → `char_603_csnipe`). [ASSUMED] Skin choices follow that body too, so an original
  operator's selected outfit never dresses its stand-in; the official table specifies bodies, not this cosmetic UI.
- **A missing piece falls back; nothing is ever a placeholder.** `spineEntry(m, id, { skin })` draws the operator's own
  model when the skin (or its model) is not in the manifest; `avatarUrl` / `portraitUrl` / `illustUrl` fall back to the
  operator's own pictures. The picker shows the operator's portrait on a skin that ships none.

## The switch model: the owner installs, each player switches on

| Who | What they do | Where it is stored |
|---|---|---|
| The server's owner | Drops the plugin folder into `plugins/` (the studio, a ZIP, or by hand), and switches it on for the **room** if they want a set everyone in that room sees | `plugins/`, a room's `vs` |
| A player | Switches a `scope: ["personal"]` cosmetic plugin on for **themself** — a skin of their own choosing | `sp.pref.cosmetics` (this browser only, never sent) |

A room's **host is not part of it**: an appearance a player wears comes from *their* browser's layers, so a plugin with
`scope: ["personal"]` never appears in the room's 插件 panel and no room setting can force a skin on anyone. Two players
of the same co-op match may therefore see different models for the same piece — see the switch below.

## 设置「显示其他玩家的皮肤」 (default on)

A pure client preference (`settings.otherSkins`, `sp.pref.settings`; **never sent**):

- **on** (the default) — a piece draws the appearance its owner chose, which the match published
  (`Match.publicView().players[].skins`, and `UnitInfo.skin` of every unit);
- **off** — every other seat's piece draws the operator's own model; **this player's own pieces keep their skin**.

The asymmetry is deliberate and is what the setting is for: what you draw is your own choice, what others draw is theirs.
Turning it off hides *their* look from *you* and changes nothing on their screen (public/js/render/app.js `skinOf`). The
renderer decides who is "other" from `UnitInfo.ownerId` and the local `me.playerId`
(public/js/ui/fieldHost.js `setMe`) — never from the seat whose camera happens to be on screen.

[ASSUMED] Switching off retains the received skin ID separately (`sourceSkin`) and derives only the displayed `skin`.
Switching back on restores already loaded units immediately, including a boss partner's read-only prep pieces and
units received while hidden. `room.skins` remains valid in every phase: `Match.setSkins` marks the owner's private
view, which also refreshes existing prep scouts and the boss partner. `fieldHost` forwards public seat choices to
`view.setSkins(players)` on mount and when they change. The current battle's operators use that latest selection
(an omitted `skins` map clears it), even if later spawn metadata carries an older choice. This rebuilds appearance
only: it neither changes the running sim / BattleSpec nor restarts playback. Live refresh timing is a remake UI
choice, not a rule established by the official tables.

## The picker: two display rules

In 干员调配 (`screens/loadout.js Detail`) and in the 自选编队 picker's detail (`screens/diy.js DiyPickerView`), the 皮肤
section sits under the operator's name. 潜能与练度 immediately follows 皮肤 wherever cultivation is offered.
The preserved 0.3.1 order is 皮肤 → 潜能与练度 → 特质 → 技能 → 局内数值 → 模组 in 干员调配, and
皮肤 → 潜能与练度 → 局内数值 → 技能 → 模组 in 自选编队 (prototype picks omit cultivation).
[ASSUMED] This is the existing remake panel order; official tables do not prescribe a skin picker layout.

1. **The section is GLOBAL: every operator shows it, or none does.** The one question `SkinSection` asks is
   `public/js/ui/skins.js hasAnySkinChoices()` — **at least one** operator of the composed manifest has one **wear-able**
   skin (`chars[<charId>].skins[<skinKey>]` with a model this client resolves). While that is false — no plugin at all,
   a plugin that writes only pictures, or only skins that are art without a model — nothing is drawn anywhere, header
   included: an installation without a cosmetic layer looks exactly as it did before this feature.
   While it is true, **every** operator shows the section, including one the plugins wrote no skin for. That operator
   gets the 默认 tile alone, a real picture on it and no empty art box, and the header's note reads `0 套外观`: the count
   is kept at zero on purpose, because the whole point of the global rule is that this box **means something** — "the
   plugin is on, this operator has no 时装". A section hidden per operator said nothing, and left the player unable to
   tell an operator without skins from a plugin that failed to load. This is the **reverse** of the rule this feature
   first shipped with (a per-operator `hasSkinChoices`: 默认 plus a wear-able skin of *that* operator, else no section),
   and it must not be turned back. `hasSkinChoices` remains the single-operator criterion — no production code calls it
   — and is what `hasAnySkinChoices` is counted from, so the two can never disagree about "wear-able".
   The gate counts **wear-able appearances**, never pictures: a plugin that writes only 立绘 (`chars[<charId>].illust`) and
   no skin turns the section on nowhere, and this picker then shows none of its pictures. That is deliberate — the
   section exists to choose a 时装 and its note counts 套外观, so one replaced 立绘 must not put a `0 套外观` box on every
   operator of the installation. A plugin whose 立绘 has to be seen has to give some operator a wear-able skin (then every
   operator's 默认 tile draws the 立绘 it has, per the rule below), or needs a surface of its own. Should the gate ever be
   meant to count a 立绘 as well, the one line that changes is the body of `hasAnySkinChoices`.
2. **A missing layer falls back to the operator's own art** — a skin with no `portrait` shows the operator's portrait
   (its `illust`, then the portrait), never a slash or a placeholder; the tile is dimmed (`.lo-skin--fallback`) so the
   replacement is legible. The enlarged preview (`.lo-skin-preview`, a `Modal`) shows the skin's 立绘.

The 默认 tile is the operator's **real** appearance, not an empty slot: it draws the operator's own 立绘
(`chars[<charId>].illust` — the picture an appearance plugin may write for an operator it gives no skin at all, and this
tile is the only place that picture is seen), else `chars[<charId>].portrait`, else its avatar. The 立绘 wins over the
portrait on purpose, for the same reason the section is global: what a plugin wrote for the operator has to be visible,
and the 1:2 tile crops to the top exactly as it already does for a skin that ships only an illust. It is never empty
while the record has any of the three; an operator the composed manifest does not hold at all (not even a 默认 tile
exists) gets no section rather than an empty grid.

## New files

| Path | What |
|---|---|
| `public/js/ui/skins.js` | The client store (`sp.pref.skins`, `{ [charId]: skinId }`, at most `SKIN_LIMITS.entries` pairs: `parseStoredSkins` is the one parse of a stored selection — the store's initial state, every edit and what the sync sends — so the wire's own limit is applied where the selection is read), `availableSkins` (the composed manifest's rows, with `playable` and with art already resolved and fallen back; the 默认 row exists for every operator the manifest holds, also one with no `skins`), `hasAnySkinChoices` (the section's global rule), `hasSkinChoices` (the single-operator criterion, kept for tests and future rules), `chosenSkin` (a stored entry that is not one of this operator's wear-able skins counts as 默认), `setSkin` / `clearSkin` |
| `public/js/ui/skinPicker.js` | The 皮肤 section itself: `SkinSection` (nothing while `hasAnySkinChoices` is false — for every operator alike; the 默认 tile alone for an operator without a skin), `SkinPreview` (the enlarged 立绘), the five-tile grid's markup |
| `test/skins.test.js` | The wire shape (`isSkinId` / `isSkinSelection`), the lobby → Match → PlayerState chain, the public view, reconnect, the sim's UnitInfo, the client's fallbacks, and the absence of the install channel |
| `test/lobby-skins.test.js` | `room.skins` over WebSocket: validation, session and seat storage, the seats handed to the Match, bots, the change made mid-match |
| `test/ui/skin-picker.test.js` | The picker's rules against a composed manifest: the rows, `playable`, the art fallbacks, the global `hasAnySkinChoices` and the per-operator `hasSkinChoices`, `chosenSkin`, and that the section's gate is the global one |
| `docs/SKINS.md` | This document |

## Edits to existing files

| File | Where | What |
|---|---|---|
| `shared/protocol.js` | before `isNotOwnedList` | `SKIN_LIMITS` (256 [ASSUMED]), `isSkinId` (**not** `isId`; the same character class as `isSkinKey`), `isCharId`, `isSkinSelection`, `operatorCharIds`, `checkSkinSelection` |
| `shared/protocol.js` | `C2S` | `'room.skins'` — and **no** `'room.skin.install'` |
| `server/net.js` | `HEAVY_TYPES`, `Session` ctor | `'room.skins'`; `session.skins` |
| `server/lobby.js` | after `freezeDiy`, `onMessage`, after `diy()`, `humanSeat`, `seatSettings`, `startMatch` | `freezeSkins` (charId + skinId, drop operators the room lacks; a bad map is BAD_MSG and does not clear), `case 'room.skins'`, `skins()` — **no phase gate**, unlike the loadout — and the selection riding into the match |
| `server/match/PlayerState.js` | ctor | `this.skins = Object.freeze({})` + `setSkins(seat.skins)` |
| `server/match/player/basics.js` | after `setLoadout` | `skinCharIdOf` / `skinFor` / `setSkins` (bots refused; a bad map refused whole, unknown operators dropped) |
| `server/match/match/platform.js` | after `setLoadout` | `setSkins(playerId, skins)` — any phase, `markPrivate()` (owner, prep scouts, boss partner) and `markPublic()` |
| `server/match/match/views.js` | `publicView().players[]`, `_prepBoardUnits`, the scouted bench | `skins` (omitted when empty), and `skin` on every unit the player owns |
| `server/match/player/round.js` | `battleInput` | the unit's `skin`, from the player's own selection and the piece's operator (a 自选 slot follows its pick) |
| `server/match/player/views.js` | `pieceView` | `skin` on the prep board / hand / temp views |
| `server/sim/units.js`, `server/sim/battle/players.js`, `server/sim/snapshot.js` | `Unit`, `_createAllyFromInput` / `_makeAlly`, `unitInfo` | carried to the client; `skin: u.skin ?? undefined`, so a piece without one adds no key to the wire |
| `public/js/assets.js` | `portraitUrl` / `illustUrl` (new) / `spineEntry` / `hasBackSpine` / `unitPictureUrl` / `skinsOf` / `skinHasModel` | every helper takes `opts.skin` (the skinId) and falls back to the operator's own art |
| `public/js/render/units.js` | `_pictureUrl`, `_modelEntry`, `_wantsBack`, `_loadPicture` | `info.skin` reaches the Spine entry, the diamond and the Front/Back question; the picture's cache key carries the skinId |
| `public/js/render/app.js` | `otherSkins` setting, `ctx.myPlayerId`, `applyInfo`, `refreshSkins`, `setSettings`, `setMe`, `setSkins`, `pieceInfo` | received `sourceSkin` is retained while displayed `skin` follows the switch and latest public selection; a changed appearance drops the view; read-only prep pieces refresh too |
| `public/js/render/app/info.js` | `renderInfo` | `skin` |
| `public/js/ui/loadoutSync.js` | header, `installSkinsSync` | the fourth `installPrefSync` setting (`room.skins { skins }`) |
| `public/js/main.js` | boot | `installSkinsSync({ net })` |
| `public/js/ui/settings.js` | `CosmeticSection` | the 显示其他玩家的皮肤 switch — with or without a cosmetic plugin |
| `public/js/ui/gameLogic/settings.js` | `DEFAULT_SETTINGS`, `sanitizeSettings` | `otherSkins: true` |
| `public/js/ui/fieldHost.js` | mount, store subscription, `OPTIONAL` | `view.setMe` and `view.setSkins` adopt and follow local identity / public seat choices; unmount removes the subscription |
| `public/css/screens/loadout.css` | end | `.lo-skins` / `.lo-skin*` tiles, `.lo-skin-preview` |
| `public/i18n/*.json` | — | the strings above, in every pack (`node tools/i18n.mjs check --all --strict`) |

## Invariants

- **No `cs`.** An appearance is never part of a room's content set: it changes nothing a battle does, so no battle
  identity moves for it (docs/PLUGINS.md §6).
- **No `server/sim/` rule.** The sim carries `skin` as opaque data (`Unit.skin` → `unitInfo().skin`); no rule reads it
  (`server/sim/units.js` stores it, `battle/players.js` copies it onto the ally, `snapshot.js` publishes it). The same
  seeded battle run with and without a skin returns the same `Battle.result()` (`test/skins.test.js`), and
  `test/golden/*.json` is unchanged. `skin` is listed with the sim fields in `docs/design/engine.md` §5.2 and
  `docs/SIM.md` §2 as display-only.
- **No `data/` write.** Nothing in this feature writes a data file; a plugin's own files are served from
  `plugins/<id>/` under `/p/<id>/<hash>/…` (docs/PLUGINS.md §9).
- **No game art in git.** As ever: skin art belongs to a plugin (or to a locally extracted client), never to this
  repository.
- **A bad map is refused whole.** `isSkinSelection` / `validateC2S` (`room.skins`), the lobby (`freezeSkins` / `skins()`)
  and `PlayerState.setSkins` all require a plain object, a charId key (`isCharId`: official `char_<digits>_<token>` or
  a plugin `char_x_…`, never a chess id) and a skinId value (`isSkinId`). An array, a null-prototype object, one bad
  key or value, or more than 256 entries [ASSUMED] is BAD_MSG and does **not** clear a choice already stored. A charId
  the room's content does not have (`operatorCharIds`: chess records, `backups.units`, `diy.ownedPool`,
  `diy.operators`) is dropped and the rest kept, so the stored map is at most that operator count. An unknown skinId
  of an operator the room does have still draws the default model (`spineEntry`).
- **The client never sends more than the wire accepts.** `SKIN_LIMITS.entries` (256 [ASSUMED]) is applied in
  `public/js/ui/skins.js parseStoredSkins`, the one place a stored selection is read — the store's initial state, every
  edit and the `room.skins` payload the sync prepares. The limit has to be honoured there because an over-long map is not
  trimmed entry by entry on the server: `isSkinSelection` refuses the WHOLE message (BAD_MSG), so nothing would be stored
  and the sync would sit in `error` (public/js/ui/loadoutSync.js `installPrefSync`) instead of saving the rest.
- **A tile never outgrows the panel it sits in.** `.lo-skins` is `repeat(5, minmax(0, 1fr))` (three columns below 900 px,
  where the detail panel is a whole phone width — or a narrow window — and tall enough for the 1:2 box), so a tile is a
  share of the detail panel and its size never moves with how many skins an operator has. The tile draws the appearance's
  1:2 portrait, and on a panel too short for that box it draws the same appearance's 1:1 `avatar` instead —
  `@media (max-width: 1000px) and (max-height: 520px)` at the end of the picker's block in
  `public/css/screens/loadout.css`. That query is a phone in landscape: its detail panel is 193–263 px tall (measured
  740×360 … 932×430) while the 1:2 tile is 264–379 px there, which made 皮肤 the ONE section of that panel a phone could
  not see whole (潜能与练度 / 技能 / 局内数值 / 模组 are 135–163 px in the same panel). Both images of a tile are in the DOM
  (`public/js/ui/skinPicker.js`, `availableSkins().avatar`) and CSS alone decides, so no resize listener and no re-render;
  273/273 of the installed skins ship an `avatar` of their own (measured), and a row whose manifest has none keeps its
  portrait on every screen. A 1:2 box is still what every wider panel draws, with `min-height: max(1.5rem, 130px)` as
  the floor of a narrow one. Portrait is not a case to solve: a portrait phone is covered by 「请将设备横屏」
  (`public/index.html .rotate-hint`, shown by `public/css/theme.css`
  `@media (orientation: portrait) and (max-width: 1024px) { .sp-rotatable .rotate-hint { display: grid } }` for the
  `sp-rotatable` that `public/js/ui/device.js` sets on a coarse pointer whose screen is not landscape).

## Known limitations

- **Bots always wear the default model** (`PlayerState.setSkins` refuses a bot, as `setLoadout` does).
- **The studio does not list skins.** It finds an operator, an enemy or an interface picture by its official name
  (`server/studio/targets.js`), so a skin key is copied from the installation's manifest or written in the stem form.
- **No skin effects and no operator voices** (a separate piece of work; docs/ASSETS.md).
- **A 自选 slot's own record has `charId: null`**, so it wears its **pick's** operator's skin — the slot has no body of
  its own. The picker offers the appearance while picking that operator, and the choice is kept per operator, so
  changing the slot's operator changes the appearance with it.

## 本地皮肤包兼容说明

An operator's Spine model and avatar can be replaced by one of its official alternative outfits (时装). Written to
be **portable**: nearly everything lives in new files, and the handful of edits to existing ones are listed below
line by line so they can be re-applied after merging an upstream release.

> Line numbers are as of the commit that added this document and will drift. The anchor (the enclosing function or
> section) is the durable part.

## How it works

```
docs/research/08-skins.json        what EXISTS upstream (174 skins / 115 operators) — a static list, like the other
        │                          research tables; never fetched at build time
        ├── tools/build-skins.mjs ──→ data/skins.json          the catalogue the CLIENT reads: id, name, series.
        │                                                      No URLs — an uninstalled skin has no files to point at.
        │
        └── tools/install-skins.mjs  downloads ONE skin on demand (7 files) and splices it into
                 │                   data/assets.json + data/skins-installed.json
                 │
                 └── server/skinInstall.js   the in-game 「安装」 button, queued (the same work, imported)
                                              │
                     data/assets.json ────────┴──→ chars[charId].skins[skinId] = { spine:{front,back?}, avatar, name, group }

player picks a skin ──→ room.skins ──→ PlayerState.skins ──→ Match.publicView().players[].skins   (PUBLIC: teammates see it)
                                              │
                                              └── battleInput() u.skin ──→ snapshot ──→ renderer ──→ spineEntry(m, id, {skin})
```

Three properties are load-bearing:

- **Skins are installed on demand, never wholesale.** All 174 are ~190 MB, and the upstream link measured ~35 KB/s
  from a mainland China line — a full set would be over an hour. `data/skins-installed.json` starts empty and only
  `tools/install-skins.mjs` adds to it, so a fresh clone downloads no skins at all.
- **The skin *choice* is keyed by chess id; the skin *catalogue* and the asset manifest are keyed by operator id.**
  A chess record is `chess_char_1_01_a` and carries `charId: char_498_inside`. Mixing the two is silent: the picker
  renders an empty section and `setSkins` drops every entry.
- **A skin model must go through the build-time spine pipeline.** `resolveRoles()` runs offline in
  `tools/assets/spine.mjs`, and the client's `validSpine()` requires the `anims` it produces. A model that skipped
  that step fails to load and leaves the unit on its placeholder avatar forever — invisible until someone looks at
  the board. `installSkins()` therefore builds its models through the same `fexliModelDef()` the full plan uses.

## New files

| Path | What |
|---|---|
| `docs/research/08-skins.json` | Static research table: `{ meta, skins: { [charId]: [{ skinId, stem, name, group, avatar, battleSpine }] } }` |
| `tools/build-skins.mjs` | `docs/research/08-skins.json` → `data/skins.json` |
| `tools/install-skins.mjs` | Install/uninstall skins on demand; `list` / `add` / `remove` / `add-char`. Also the library `server/skinInstall.js` imports |
| `server/skinInstall.js` | Serialised background install queue: why it is queued, why it is never awaited (8 s client timeout) |
| `data/skins.json` | The client's catalogue (no URLs) |
| `data/skins-installed.json` | Which skin ids are installed — the single source of truth the build reads |
| `public/js/ui/skins.js` | Client store + `room.skins` sync + install requests + manifest reload on `skins.changed` |
| `public/js/ui/skinPicker.js` | The 皮肤 section of 干员调配 (self-contained: `screens/loadout.js` only names it) |
| `test/skins.test.js`, `test/skins-protocol.test.js`, `test/ui/skins.e2e.test.js` | Lookup, wire format, real-browser picker |

## Edits to existing files

| File | Where | What |
|---|---|---|
| `shared/protocol.js` | before `isLoadoutEntries` | `SKIN_LIMITS`, `isSkinId`, `isSkinSelection`. **`isSkinId` cannot be `isId`**: that allows only `[A-Za-z0-9_\-.:]` and skin ids carry `@` and `#` |
| `shared/protocol.js` | `C2S` table | `'room.skins'` and `'room.skin.install'` |
| `server/net.js` | `HEAVY_TYPES` | `'room.skins'`, `'room.skin.install'` |
| `server/net.js` | `Session` ctor | `this.skins = null` |
| `server/lobby.js` | import | `installSkinInBackground` |
| `server/lobby.js` | after `freezeLoadout` | `freezeSkins()` — the same gate as `checkLoadout` (`isGolden` / `visible === false` / `isHidden` / `isDiy` / `baseId !== id`) |
| `server/lobby.js` | `onMessage` | `case 'room.skins'` / `case 'room.skin.install'` |
| `server/lobby.js` | after `loadout()` | `skins()` — no phase gate (unlike the loadout: a skin is cosmetic and public) — and `skinInstall()`, which acknowledges at once and broadcasts `skins.changed` to **every** session on completion |
| `server/lobby.js` | `humanSeat()` & `startMatch()` | passes `skins` from session to seat and from room seats to `new Match()` |
| `server/match/Match.js` | after `setLoadout` | `setSkins()` — any phase, `markPublic()` |
| `server/match/Match.js` | `publicView().players[]` | `...(Object.keys(ps.skins).length ? { skins: ps.skins } : {})` — omitted when empty, so the payload is unchanged for players with no skins |
| `server/match/Match.js` | prep view units | `skin: ps.skins?.[rec?.baseId || piece.id] || ps.skins?.[piece.id]` — supports both base and golden/promoted pieces |
| `server/match/PlayerState.js` | ctor | `this.skins = Object.freeze({})` + restore from `seat.skins` |
| `server/match/PlayerState.js` | after `setLoadout` | `setSkins()` — bots refused, same gate as above, calls `this.dirty()` |
| `server/match/PlayerState.js` | `battleInput()` | `const baseId = (rec && rec.baseId) || piece.id; const skin = this.skins[baseId] || this.skins[piece.id]; if (skin) u.skin = skin;` — preserves skin when upgraded to golden |
| `server/match/PlayerState.js` | `pieceView()` | includes `skin` on prep board/hand/temp piece views |
| `server/sim/snapshot.js` | `unitInfo()` | `skin: u.skin ?? undefined` — **`undefined`, not `null`**: `JSON.stringify` drops it, so the `DESIGN §8.2` wire-format contract test still passes and an install with no skins is byte-identical to before |
| `public/js/assets.js` | `spineEntry()` | `opts.skin` → `chars[id].skins[id].spine`, else the operator's own model |
| `public/js/assets.js` | `avatarUrl()` & `hasBackSpine()` | supports `opts.skin` for avatar; `hasBack(id, skinId)` forwards skin |
| `public/js/render/units.js` | `_loadSpine()` & `_loadPicture()` | passes `skin: this.info.skin` to spine and avatar diamond fallback |
| `public/js/render/units.js` | `_wantsBack()` | asks `hasBack(id, this.info.skin)` |
| `public/js/render/app.js` | `pieceInfo()` and `addInfo()` | `skin: piece.skin ?? skinFor(baseId) ?? null` / `skin: u.skin ?? null`; `sig` includes `skin` to drop cache on switch |
| `public/js/data.js` | `DATA_FILES` | `skins: 'skins.json'` |
| `public/js/ui/gameComponents.js` | `GAME_FILES` | `'skins'` — `test/ui/playtest3.test.js` requires every file the in-match UI reads to be awaited by the match screen, and 干员调配 is reachable during a match |
| `public/js/screens/loadout.js` | imports + `Detail()` | import `SkinSection`, then `<${SkinSection} chess=${chess} />`. **Two lines** — the section itself is entirely in `ui/skinPicker.js` |
| `public/js/main.js` | imports + boot | `installSkinsSync({ net })` |
| `public/css/screens/loadout.css` | end | `.lo-skins` / `.lo-skin` tiles (mirrors `.lo-mods`) |
| `data/assets.json` | — | regenerated; carries `chars[charId].skins` for whatever is installed |

## Regenerating the asset side

```
node tools/build-skins.mjs                                   # docs/research/08-skins.json → data/skins.json
node tools/install-skins.mjs list [text]                     # what exists / what is installed
node tools/install-skins.mjs add <skinId…>                   # install (resumable; safe to interrupt)
node tools/install-skins.mjs add-char <charId…>              # every skin of those operators
node tools/install-skins.mjs remove <skinId…>                # uninstall (files stay on disk)
npm run assets                                               # rebuilds the manifest from the selection file
```

`tools/fetch-assets.mjs` only builds the skins listed in `data/skins-installed.json`, so a full run never
re-downloads one that was uninstalled **and** removes it from the manifest — matching what the installer writes.

Upstream sources: `fexli/ArknightsResource` (`spine/{charId}/{stem}/{Front,Back}/`) for the models,
`yuanyan3060/ArknightsGameResource` (`avatar/{avatarId}.png`) for the 180×180 thumbnails, and Kengxxiao's
`skin_table.json` for the names and series. Two naming rules, both verified:

```
stem   = skinId.replace(/@/g, '_').replace(/#/g, '_')      char_002_amiya@winter#1 → char_002_amiya_winter_1
avatar = 'avatar/' + encodeURIComponent(avatarId) + '.png'  avatarId comes from skin_table, NOT from the skinId
```

The full skin art (`skin/{portraitId}b.png`) is deliberately **not** used: at ~2.5 MB each it would add ~435 MB,
more than the entire rest of the asset set, for a thumbnail.

## Known limitations

- **No skin effects.** The official per-character battle effects are `.ab` particle bundles that the project does
  not extract (`docs/ASSETS.md`); battle FX stay procedural.
- **No operator voices.** A separate piece of work; the files exist (`ArknightsAssets2`, `voice` branch) but there
  is no event→line mapping or playback path yet.
- **Bots always wear the default model** (`setSkins` refuses bots, as `setLoadout` does).
- **Uninstalling leaves the files on disk.** They are shared between skins and a reinstall would only fetch them
  again; `npm run assets --prune` clears the orphans.
- **Docker images cannot install.** The runtime stage of the `Dockerfile` copies `server/`, `shared/`, `data/`,
  `public/` and `docs/research/` but not `tools/`, which `server/skinInstall.js` imports on demand. Add `tools/` to
  that stage if the in-game button should work there.
- **An install is tens of seconds, not instant.** The seven files come from GitHub at the link's speed; the panel
  acknowledges immediately and reports back through `skins.changed`.
