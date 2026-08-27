# Phase 14 — 呪いと状態異常カード

## 目的

デッキが汚れる手段を作る。現行版にはリスクを取る軸が存在しなかった。

## 前提

Phase 13 完了。データは `docs/upgrade-sts.md` 7章。

---

## 1. 新しいカテゴリ

`cat: 'STATUS'` と `cat: 'CURSE'` を追加する。**4カテゴリのいずれにも属さない。**

### 抽選からの除外(重要)

以下の全ての抽選で、`cat` が `STATUS` / `CURSE` のカードを候補から除く。

- `rollCardOf()`(運動由来の生成)
- `pickRewardCards()`(戦闘報酬)
- `makeShopStock()`(ショップ)
- 強化所のカード開放一覧
- イベントの「RARE カード1枚獲得」など

`CATEGORIES` 定数は4カテゴリのまま維持し、`ALL_CATS = CATEGORIES.concat(['STATUS','CURSE'])` を別に用意する。

---

## 2. カード定義(8種)

`docs/upgrade-sts.md` 7.2 / 7.3章のとおり。全て `unplayable: true`、`up` は持たない。

`effectiveCard()` は `up` が無いカードをそのまま返すので変更不要。
ただし `upgradableCards()` は `CARDS[c.id].up` で判定しているので自動的に対象外になる。

### 特殊挙動の実装位置

| カード | 実装位置 |
|---|---|
| `st_out_of_breath` 息切れ | `ethereal: true` を立てるだけ(Phase 12 で実装済) |
| `st_lactate` 乳酸 | `endPlayerTurn()` の手札処理で、手札にあれば `selfDamage 2` |
| `st_cramp` 痙攣 | `drawCard()` で引いたとき `B.crampThisTurn += 3` → `gainBlock` で減算 |
| `cur_chronic_fatigue` 慢性疲労 | `startPlayerTurn()` の後、手札にあれば HP-1。`unexhaustable: true` |
| `cur_old_injury` 古傷 | `innate: true` |
| `cur_laziness` 怠惰 | `endPlayerTurn()` で手札にあれば `B.nextTurnEnergyDelta -= 1` |
| `cur_overconfidence` 過信 | `calcDamage()` で、手札に存在すれば最終値を `floor(v * 0.9)` |

`B.nextTurnEnergyDelta` は `startPlayerTurn()` で `B.energy += delta` した後に 0 に戻す。

---

## 3. 入手経路

| 経路 | 実装 |
|---|---|
| 敵の攻撃 | `act.addCard = {cardId, count, to:'discard'}`(Phase 17 の敵が使う) |
| イベント | 下記のイベント改訂 |

### イベントの改訂と追加

`ev_overwork` の選択肢A を差し替える:

```
A: 追い込む — 呪い「怠惰」を1枚デッキに加え、恒久的に Energy+1
   run.deck.push(newCardInstance('cur_laziness'));
   run.bonusEnergy += 1;
```

`run.bonusEnergy` は `startBattle()` で `B.maxEnergy += run.bonusEnergy`。

> Phase 13 で `run.balancedBonus`(4種目5回以上でゴールド+50)は廃止した。
> 「全部やる」動機は 2.2章の深さが担保するため。

**新規イベント4種**(`docs/upgrade-sts.md` 7.5章):
`ev_mirror` 鏡の間 / `ev_scale` 体重計 / `ev_spotter` 補助者 / `ev_forge` 鍛冶場

`ev_mirror` の「デッキから1枚を複製」は `openCardPicker` を使い、
選んだカードの `id` と `upgraded` をコピーして `newCardInstance` する。

---

## 4. UI

- `cat-STATUS` は灰色枠 + 半透明、`cat-CURSE` は紫黒枠
- コストバッジは「-」
- 手札では常にグレーアウトし、クリックしても反応しない
- カード詳細(長押し)には「このカードは使用できません」と明記
- デッキ閲覧・除去の選択で、呪いを**先頭に並べる**(除去したい対象なので)

---

## 5. 完了条件

- [ ] `Object.keys(CARDS).length` → **81**、うち抽選対象は73
- [ ] 呪い・状態異常が生成・報酬・ショップ・強化所のどこにも出ない(1000回試行)
- [ ] 使用不可カードがクリックしても発動せず、Energy も減らない
- [ ] `息切れ` がターン終了時に除外される
- [ ] `乳酸` が手札にある状態でターン終了すると HP-2
- [ ] `痙攣` を引いたターン、ガードのブロックが 7 → 4 になる
- [ ] `慢性疲労` が除外効果の対象にならない(`気合` で除外されない)
- [ ] `古傷` が戦闘開始の初手に必ず入る
- [ ] `怠惰` を手札に残してターン終了すると、次のターンの Energy が2になる
- [ ] `過信` が手札にある間、パンチのダメージが 6 → 5 になる
- [ ] 状態異常カードは**戦闘終了後にデッキに残らない**
- [ ] 呪いは**戦闘終了後もデッキに残る**
- [ ] `ev_overwork` で呪いを受け取ると、以降の全戦闘で Energy+1
- [ ] 新規イベント4種が全て動く

## コミット

```
Phase 14: 状態異常カード4種・呪い4種・イベント4種を追加
```
