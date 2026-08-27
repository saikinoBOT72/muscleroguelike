# Phase 6 — 報酬・ショップ・休憩・イベント・宝箱

## 目的

戦闘以外の全ノードを実装し、**1ランを最初から最後まで通せる**状態にする。

## 前提

Phase 5 完了(マップを踏破できる)。

---

## 1. 戦闘報酬画面(REWARD)

戦闘勝利時に表示。

| 報酬 | 内容 |
|---|---|
| ゴールド | NORMAL戦 `10〜20` / ELITE `25〜40` / BOSS `50〜75`。`× D.goldMult` を適用し `floor` |
| カード | **3択、選ばずスキップ可**(下記) |
| レリック | ELITE 撃破時 100%、BOSS 撃破時 100%、NORMAL戦は 0%(宝箱・ショップのみ) |

### 1.1 カード報酬の抽選(確定事項:全カテゴリ均等)

```
pickRewardCards(difficulty):
  cats = shuffle(['ATTACK','SKILL','DEBUFF','POWER']).slice(0, 3)   // 重複なしで3カテゴリ
  result = []
  for cat of cats:
     rarity = weightedPick(REWARD_RARITY[difficulty])
     card   = 候補から一様ランダム(cat一致 / rarity一致 / BASIC除外 / アンロック済 / result内と重複なし)
     候補が空 → rarity を1段下げて再試行(RARE→UNCOMMON→COMMON)
     result.push(card)
  return result
```

```js
const REWARD_RARITY = {
  NORMAL: [{v:'COMMON',w:65},{v:'UNCOMMON',w:25},{v:'RARE',w:10}],
  HARD:   [{v:'COMMON',w:62},{v:'UNCOMMON',w:25},{v:'RARE',w:13}]
};
```

- 毎回必ず**異なる3カテゴリ**が出る = 4カテゴリが均等に近い頻度で出る
- ELITE / BOSS 戦の報酬では `UNCOMMON` 以上を保証(COMMON が引かれたら1段上げる)
- 「スキップ」ボタンを必ず用意する(デッキを薄く保つ戦略を潰さないため)

---

## 2. 休憩所(REST)

2択(どちらか1つのみ)。

| 選択肢 | 効果 |
|---|---|
| 🔥 休む | 最大HPの `restHealRate` 分回復(ふつう30% / むずい20%)。切り上げ |
| ⚒ 鍛える | デッキから1枚選んで **Upgrade(+)** 。既に強化済 / `up` を持たないカードは選択不可 |

- 強化可能なカードが1枚も無い場合は「鍛える」を無効化
- ボス直前の REST は特に重要なので、UI に「次はボスです」の警告を出す

---

## 3. ショップ(SHOP)

| 項目 | 内容 |
|---|---|
| 販売カード | **5枚**。レアリティ比 COMMON3 / UNCOMMON1 / RARE1。カテゴリは4種から均等に抽選 |
| 販売レリック | **2〜3個**(未所持のものから) |
| カード除去 | 1回目 `75G`、以降 `+25G`(`run.removeCost`。ラン内で持ち越し) |

### 価格
```js
const PRICE = { COMMON:[50,60], UNCOMMON:[75,95], RARE:[150,200], RELIC:[150,300] };
price = floor( range(min,max) * D.shopPriceMult );
```
価格は入店時に確定し、再描画で変動しないこと(`node.shopStock` に保存)。

- 購入済の商品は「SOLD」表示で残す
- ゴールド不足の商品はグレーアウト
- 「立ち去る」で MAP へ

---

## 4. 宝箱(TREASURE)

- 未所持レリックから1個をランダム付与
- 30% の確率で追加ゴールド `20〜40`(`× goldMult`)
- 演出: 箱をタップ → 開く → レリック取得表示

---

## 5. イベント(EVENT)

`EVENTS` 配列を新規定義。各イベントは `{id, title, text, choices:[{label, desc, effect(), available()}]}`。

**最低6種**を実装する:

| id | タイトル | 選択肢 |
|---|---|---|
| `ev_training_ground` | 廃れた練習場 | A: 最大HP+5(現HPも+5) / B: デッキから1枚 Upgrade / C: 立ち去る |
| `ev_iron_offering` | 鉄の供物 | A: HPを10失いレリック1個獲得 / B: 立ち去る |
| `ev_dusty_shelf` | 埃まみれの棚 | A: ゴールド `30〜60` 獲得 / B: カード1枚(RARE確定)獲得しHP-8 |
| `ev_purge_altar` | 削ぎ落としの祭壇 | A: デッキから1枚除去(無料) / B: 最大HP+8 |
| `ev_grudge_shrine` | 執念の祠 | A(**デッキのDEBUFFカードが5枚以上のときのみ**): `rel_grudge_record` 獲得 / B: HP20回復 |
| `ev_overwork` | オーバーワーク | A: 次の戦闘のみ Energy+1(`run.tempBuff`)、HP-5 / B: 立ち去る |

- `available()` が false の選択肢は「条件未達」と理由付きでグレー表示する
- 選択後は結果テキストを1画面挟んでから MAP に戻る
- 同一ラン内で同じイベントは2回出さない(`run.seenEvents`)

---

## 6. カード除去/選択UI(共通コンポーネント)

ショップ除去・REST強化・イベント除去で使い回す。

```js
function openCardPicker({title, cards, filter, onPick, cancelable})
```
- デッキ全カードをグリッド表示、`filter` で選択不可を判定してグレーアウト
- 選択 → 確認ダイアログ → `onPick(cardInstance)`

---

## 7. 敗北 / 勝利

### GAMEOVER
- 「敗北」表示 + 到達 Row / 撃破数
- **筋力コアが50%没収される**旨を明示(獲得予定→実際の取得量を並べて表示。Phase 8 で実付与)
- 救済メッセージ: `今日の運動はちゃんと記録されました。半分は持ち帰れます。`
- 「タイトルへ」ボタン。`run = null`

### VICTORY
- 「制覇!」表示 + 最終デッキ一覧 + 難易度バッジ
- むずいクリア時は `meta.clearedHard = true`
- 「タイトルへ」ボタン

---

## 8. 完了条件

- [ ] 1ランを開始から BOSS 撃破まで通しでプレイできる
- [ ] カード報酬の3択が**毎回異なる3カテゴリ**から出る
- [ ] 報酬に BASIC カードが出ない
- [ ] ELITE/BOSS の報酬が必ず UNCOMMON 以上
- [ ] 「スキップ」でカードを取らずに進める
- [ ] REST の回復量がふつう21(70の30%)、むずい12(60の20%)
- [ ] REST の「鍛える」でカードが `+` になり、次の戦闘で強化後の数値が出る
- [ ] ショップで購入したカードがデッキに入り、ゴールドが減る
- [ ] 除去コストが 75 → 100 → 125 と上がり、マップを跨いでも維持される
- [ ] ショップの価格が再描画で変動しない
- [ ] 6種のイベントが全て表示・選択できる
- [ ] 執念の祠の条件付き選択肢が DEBUFF 5枚未満でグレーアウトする
- [ ] 宝箱で未所持レリックが手に入る(所持済は出ない)
- [ ] HP0 で GAMEOVER、ボス撃破で VICTORY
- [ ] 「むずい」でショップ価格が 1.25 倍、ゴールド報酬が 1.2 倍になる

## コミット

```
Phase 6: 報酬・ショップ・休憩・イベント・宝箱・勝敗画面を実装
```
