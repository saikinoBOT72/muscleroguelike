# Phase 16 — レリック拡張・ボスレリック・祝福

## 目的

レリックを 6種 → **30種**(通常24 + ボス6)にする。
ラン開始の祝福(Neow 相当)を追加する。

## 前提

Phase 15 完了(`onPotionUse` フックが必要)。
データは `docs/upgrade-sts.md` 9章・10章。

---

## 1. フックの追加(9種)

`docs/upgrade-sts.md` 9.1章の表のとおり、`fireRelicHook` の呼び出し位置を追加する。

| フック | 呼び出し位置 |
|---|---|
| `onCardPlayed` | `playCard()` で効果解決・山への移動を終えた直後 |
| `onTurnEnd` | `endPlayerTurn()` の**先頭**(反発の解決より前) |
| `onTakeDamage` | `dealDamageToPlayer()` の HP 減算の**直後**、`checkBattleEnd` より前 |
| `onEnemyKilled` | `onEnemyDeath()` の中 |
| `onRest` | 休憩所の「休む」で `healPlayer` を呼ぶ前(`ctx.heal` を書き換え可能に) |
| `onShopEnter` | `makeShopStock()` の直後(`ctx.stock` の価格を書き換え可能に) |
| `onActStart` | 幕の開始時(`startRun` と `advanceAct` の両方) |
| `onDrawCard` | `drawCard()` の1枚ごと(`ctx.card` を渡す) |
| `onPotionUse` | `usePotion()`(Phase 15 で実装済) |

### ダメージ軽減系フックの契約

`onTakeDamage` は「HP を減らした後」に呼ぶが、
`rel_wrist_wrap`(5以下を1に軽減)と `rel_second_wind_charm`(HP1で耐える)は
**減算前**に介入する必要がある。そこで2つに分ける。

| フック | 位置 | 用途 |
|---|---|---|
| **`onIncomingDamage`** | ブロック計算の後、HP 減算の**前** | `ctx.amount` を書き換える(リストラップ) |
| **`onLethal`** | HP が0以下になった直後、敗北判定の前 | `ctx.prevented = true` にすると HP1 で耐える(再起の護符・妖精の薬) |
| `onTakeDamage` | HP 減算の後 | 通知系(気付け薬のHP閾値判定) |

`pot_fairy` も `onLethal` の仕組みに乗せる(Phase 15 の実装をここで統合してよい)。

---

## 2. 通常レリック18種の追加

`docs/upgrade-sts.md` 9.2章の表のとおり。既存6種は変更しない。

### 実装上の注意

| レリック | 注意点 |
|---|---|
| `rel_protein_shaker` | ドロー枚数を増やすのではなく `onBattleStart` で `drawCard(1)`。手札上限を尊重する |
| `rel_chalk_bag` | 「毎ターン最初のATTACK」なので `B.chalkUsedThisTurn` を持ち、`startPlayerTurn` でリセット。`onCardPlayed` ではなく **damage 計算に割り込む**必要があるため、`calcDamage` の呼び出し元(`resolveEffect` の damage 系)で加算する |
| `rel_stopwatch` | `onTurnStart` で `turn === 3` |
| `rel_wrist_wrap` | `onIncomingDamage` で `if (ctx.amount <= 5) ctx.amount = 1` |
| `rel_gym_membership` | `onShopEnter` で `stock.cards` / `stock.relics` / `stock.potions` の price を `ceil(p * 0.75)` |
| `rel_logbook` | `onActStart` でランダムな強化可能カード1枚を `upgraded = true` |
| `rel_resistance_band` | `onTurnEnd` で `B.block > 0` なら `B.status.strength += 1` |
| `rel_smelling_salts` | `onTakeDamage` で HP割合 ≤30% かつ `B.relicOnce.smelling_salts` が未消費なら発動 |
| `rel_mirror_shard` | `onBattleStart`。初期ドローの**後**に走る必要があるので、`onBattleStart` の発火位置(Phase 7 で `startPlayerTurn()` の後にした)がそのまま使える |
| `rel_torn_page` | `onDrawCard` で `CARDS[ctx.card.id].cat === 'CURSE'` なら `drawCard(1)` |
| `rel_second_wind_charm` | `onLethal` で `B.relicOnce.second_wind` が未消費なら `ctx.prevented = true` |

`B.relicOnce = {}` を戦闘開始時に初期化する。

---

## 3. ボスレリック(6種)

`BOSS_RELIC_LIST` を別配列で持ち、`RELICS` には統合して入れる(`isBoss: true` を立てる)。
`relicPool()`(通常レリックの抽選)からは `isBoss` を除外する。

### 提示

幕ボス撃破後の `ACT_CLEAR` 画面で、未所持のボスレリックから**3択**を提示する。
候補が3未満なら残り全部。0なら「ゴールド+100」で代替する。
選択は必須(スキップ不可)。`run.bossRelics.push(id)` と `run.relics.push(id)` の両方に入れる。

### 実装上の注意

| レリック | 実装 |
|---|---|
| `boss_overload_core` | `onBattleStart` で `B.maxEnergy += 1`。`onTurnEnd` で手札を全て `exhaustPile` へ(`retain` も無視) |
| `boss_iron_lung` | 取得時に `run.maxHp -= 10`(現在HPも上限に合わせる)。`onBattleStart` で `B.maxEnergy += 1` |
| `boss_blind_drive` | `onBattleStart` で `B.maxEnergy += 1`。`intentText()` が `run.relics.includes('boss_blind_drive')` なら `'?'` を返す |
| `boss_growth_serum` | `onBattleStart` で 力+3 と 弱体2 を同時付与 |
| `boss_fortress_plate` | `onBattleStart` で `gainBlock(15)`。`handSize()` の戻り値から1引く |
| `boss_hollow_vessel` | `run.potions` の長さを5にする。`usePotion` で数値系 effect の value を `ceil(v/2)` にする |

> `boss_hollow_vessel` の「効果半減」は effect の value を書き換えるので、
> `POTIONS[id]` を直接変更せず、**コピーに対して適用**すること。

---

## 4. ラン開始の祝福

デッキ確認画面の「この構成で開始」の直後、マップに入る前に `BLESSING` 画面を挟む。

| 選択肢 | 効果 |
|---|---|
| 🩹 癒し | 最大HP +12(現在HPも+12) |
| 🃏 見識 | RARE カード3択から1枚をデッキに加える |
| 💰 蓄え | ゴールド +150、ポーション1個 |
| ⚖ 取引 | 通常レリックから未所持1個を獲得。最大HP -8 |

- 選択後は戻れない(確認ダイアログを挟む)
- `run.blessing` に id を記録
- 「見識」は `openCardPicker` ではなく、報酬画面と同じ3択カードUIを使う
  (RARE かつアンロック済のプールから3枚)

---

## 5. UI

- HUD のレリック欄が最大30個になるので、**横スクロール**にする(`overflow-x:auto`)
- ボスレリックはアイコンに金枠を付けて区別する
- レリック一覧モーダルを「通常 / ボス」で分けて表示
- 取得演出は既存のトーストを流用。ボスレリックは専用の3択画面

---

## 6. 完了条件

- [ ] `Object.keys(RELICS).length` → **30**(通常24 + ボス6)
- [ ] 24種の通常レリックがそれぞれ仕様どおり発動する(1つずつ検証)
- [ ] `グリップテープ`: 戦闘開始時 敏捷1、ガードのブロックが 7 → 8
- [ ] `チョークバッグ`: そのターン最初のATTACKだけ +3、2枚目は +0
- [ ] `リストラップ`: 5ダメージが1に、6ダメージはそのまま
- [ ] `再起の護符`: HP0になる攻撃で HP1 で耐え、同じ戦闘の2回目は耐えない
- [ ] `会員証`: ショップ価格が 75% になる
- [ ] `トレーニング日誌`: 幕開始時にカード1枚が + になる
- [ ] `破れたページ`: 呪いを引くとカードを1枚引く
- [ ] ボスレリックが幕ボス撃破後にのみ3択で出る
- [ ] `過負荷のコア`: Energy4 になり、ターン終了時に手札が全て除外される(保持カードも)
- [ ] `盲目の意志`: Energy4 になり、敵の Intent が「?」になる
- [ ] `要塞板`: 戦闘開始ブロック15、手札が1枚減る
- [ ] `空洞の器`: ポーション枠が5になり、硬化の薬が ブロック6 になる
- [ ] 同じボスレリックが2度提示されない
- [ ] 祝福4種が全て動き、選択後にマップへ進む
- [ ] 通常レリックの抽選にボスレリックが混ざらない
- [ ] Phase 7 の既存テストが全て通る

## コミット

```
Phase 16: レリック30種化・フック9種追加・ボスレリック6種・ラン開始の祝福を実装
```
