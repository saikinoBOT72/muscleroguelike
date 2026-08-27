# Phase 1 — 運動入力 → デッキ生成 / 難易度選択

## 目的

「その日の運動記録」を入力してデッキが組み上がるところまで。ここがこのゲームの独自性の核。

## 前提

Phase 0 完了(`CARDS` / `DIFFICULTY` / `G.run` スキーマが存在する)。

---

## 1. 難易度選択画面

タイトルの「ラン開始」→ **難易度選択** → 運動入力 の順。

- 「ふつう」「むずい」の2ボタン
- 各ボタンに効果サマリを表示すること:
  - ふつう: `最大HP 70 / 標準の敵 / 報酬 ×1.0`
  - むずい: `最大HP 60 / 敵HP・攻撃力 ×1.25 / 敵は開始時に力を持つ / 休憩の回復量減 / 報酬 ×1.2`
- **「むずい」は Phase 0 の `DIFFICULTY.HARD` を選ぶだけ**。実際に各倍率を効かせるのは Phase 4・6・9。
  この時点では `run.difficulty` と `maxHp` だけ反映されていればよい
- 選択後 `run` を初期化: `hp = maxHp = DIFFICULTY[d].playerMaxHp`, `gold = 99`

---

## 2. 運動入力画面

4種目を入力する。数値入力(`type="number"` + ステッパーボタン `-10 / -1 / +1 / +10`)。

| 種目 | キー | 単位 | カテゴリ | コア |
|---|---|---|---|---|
| 腕立て伏せ | `pushup` | 回 | ATTACK | 胸コア |
| ジャンプスクワット | `jumpSquat` | 回 | SKILL | 脚コア |
| ツイストレッグレイズ | `twistLegRaise` | 回 | DEBUFF | 捻転コア |
| プランク | `plankSeconds` | **秒** | POWER | 体幹コア |

入力は 0 以上の整数。上限は設けないが、内部の枚数計算に上限がある旨を表示する。

### 2.1 プランク換算(確定事項)

```
plankCount = floor(plankSeconds / 2)      // 2秒 = 1カウント
```

以降 `plankCount` を他種目の「回数」と全く同じ式に載せる。
UIには `120秒 → 60カウント相当` のようにリアルタイム表示すること。

### 2.2 カード生成枚数

```
cards = min( floor( sqrt(count / 5) ), 4 )
```

| count | 枚数 |
|---|---|
| 0–4 | 0 |
| 5–19 | 1 |
| 20–44 | 2 |
| 45–79 | 3 |
| 80+ | 4(上限) |

プランク換算例: 10秒→5count→1枚 / 40秒→20count→2枚 / 90秒→45count→3枚 / 160秒→80count→4枚

### 2.3 レアリティ抽選

生成される1枚ごとに独立抽選。**BASIC は抽選対象外**。

| レアリティ | 重み(ふつう) | 重み(むずい) |
|---|---|---|
| COMMON | 65 | 62 |
| UNCOMMON | 25 | 25 |
| RARE | 10 | 13 |

> むずいの `rareWeightBonus:3` は RARE に +3、COMMON から -3。

抽選手順:
1. 該当カテゴリ かつ 抽選されたレアリティ かつ **アンロック済**(Phase 8 まで全カード解禁扱い)のカードを候補にする
2. 候補が空ならレアリティを1段下げて再抽選(RARE→UNCOMMON→COMMON)
3. 候補から一様ランダムで1枚。**同一ラン内で同じカードIDが3枚を超えないよう**、3枚に達したものは候補から除外(除外後に候補が空なら制限を解除)

### 2.4 初期デッキ

```
パンチ ×3, ダブルパンチ ×1, ガード ×3, 踏ん張り ×1,
サイドステップ ×1, ダッシュ ×1, フェイント ×1, 鋭い視線 ×1   (計12枚)
```

BASIC 8種すべてを含める。BASIC は生成・報酬・ショップの抽選対象外なので、
ここに入っていないカードは一生入手できなくなるため。

```
```
`G.meta.upgradedBasics` に含まれるIDは `upgraded:true` で生成(Phase 8 まで常に空)。

最終デッキ = 初期デッキ12枚 + 生成カード(最大16枚) = **12〜28枚**

---

## 3. 結果確認画面

デッキ生成後、いきなりマップへ行かず**確認画面を挟む**。

- 生成されたカードをカテゴリ別に一覧表示(レアリティで枠色を変える)
- 各種目の `入力値 → count → 生成枚数` を表で表示
- 獲得予定コア数も表示: `cores = min(floor(count / 10), 5)`
  (プランクは `plankCount` ベース。実際の付与は Phase 8、ここは表示のみ)
- 「この構成で開始」ボタン → MAP画面(Phase 5 まではプレースホルダ)
- 「入力し直す」ボタン

### デッキ表示コンポーネント(以降のフェーズで再利用)

```js
renderCardEl(cardInstance, opts)   // opts: {playable, onClick, showCost}
renderDeckList(cards, opts)        // グリッド表示
```
Phase 2・6・8 で使い回すので、汎用に作ること。

---

## 4. 実装する関数

```js
function normalizeExercise(input)          // → {ATTACK:n, SKILL:n, DEBUFF:n, POWER:n} の count
function cardsFromCount(count)             // → 0..4
function coresFromCount(count)             // → 0..5
function rollRarity(diffKey)               // → 'COMMON'|'UNCOMMON'|'RARE'
function rollCardOf(cat, rarity, deckSoFar)// → cardId
function buildDeck(exercise, meta, diffKey)// → cardInstance[]
function newCardInstance(id, upgraded)     // → {uid, id, upgraded}
```

---

## 5. 完了条件

- [ ] タイトル→難易度選択→運動入力→デッキ確認、が通しで動く
- [ ] プランク 120 秒 の表示が `60カウント / 3枚` になる
- [ ] 全種目 0 でも初期デッキ12枚でランを開始できる
- [ ] 全種目に 200 を入れると 12 + 16 = 28枚になる
- [ ] 生成カードが8枚で手札6枚、14枚で手札7枚になる
- [ ] 生成カードに BASIC が1枚も混ざらない
- [ ] 同一カードIDが4枚以上生成されない(候補枯渇時を除く)
- [ ] リロード後も `run` が復元される(saveGame が呼ばれている)
- [ ] 「むずい」選択時、最大HPが 60 になる

## このフェーズで触らないもの

戦闘、マップ、コアの実付与。

## コミット

```
Phase 1: 運動入力→デッキ生成と難易度選択を実装(プランク2秒=1カウント)
```
