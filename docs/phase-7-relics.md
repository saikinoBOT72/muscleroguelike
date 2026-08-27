# Phase 7 — レリック(パッシブ)

## 目的

Phase 0 で定義した6種のレリックを実際に機能させる。フック方式で拡張しやすく作る。

## 前提

Phase 6 完了(レリックが入手できる導線がある)。

---

## 1. フック方式

戦闘ロジックの各所に「フック呼び出し」を1行ずつ差し込み、レリックはそこに反応する。

```js
function fireRelicHook(hookName, ctx){
  for (const rid of G.run.relics){
    const fn = RELICS[rid][hookName];
    if (fn) fn(ctx);
  }
}
```

### 必要なフック

| フック | 呼び出し位置 | ctx |
|---|---|---|
| `onBattleStart` | `startBattle()` の最後、初回ドロー前 | `{battle}` |
| `onTurnStart` | `startPlayerTurn()` の Energy 設定後 | `{battle, turn}` |
| `onCardCost` | コスト計算時(値を書き換える) | `{card, cost}` → `ctx.cost` を変更 |
| `onBleedDamage` | 出血ダメージ計算時 | `{amount}` → `ctx.amount` を変更 |
| `onBattleWin` | 勝利報酬計算時 | `{gold}` → `ctx.gold` を変更 |
| `onGainBlock` | `gainBlock()` 内 | `{amount}` |

---

## 2. 各レリックの実装

| id | 名前 | フック | 処理 |
|---|---|---|---|
| `rel_training_proof` | 鍛錬の証 | `onBattleStart` | `battle.status.strength += 1` |
| `rel_unyielding_plate` | 不屈のプレート | `onBattleStart` | `gainBlock(5)`(完全防御のボーナスも乗る) |
| `rel_accelerator` | 加速装置 | `onTurnStart` | `if (turn === 1) battle.energy += 1` |
| `rel_grudge_record` | 執念の記録 | `onBleedDamage` | `ctx.amount = floor(ctx.amount * 1.5)` |
| `rel_battle_wisdom` | 継戦の心得 | `onCardCost` | `if (card.type === 'power') ctx.cost = max(0, ctx.cost - 1)` |
| `rel_sweat_crystal` | 汗の結晶 | `onBattleWin` | `ctx.gold += 10`(**難易度倍率の適用後**に加算) |

> `rel_battle_wisdom` は `type:'power'` 判定。DEBUFF カテゴリの `type` は `skill` なので影響しない。
> POWER カテゴリのカードは全て `type:'power'` にしておくこと(Phase 0 の定義を確認)。

---

## 3. 入手経路(Phase 6 で実装済の導線に紐付け)

| 入手方法 | 対象レリック |
|---|---|
| ELITE 撃破 | 全レリックから未所持1個(`rel_training_proof` を優先度2倍) |
| BOSS 撃破 | 全レリックから未所持1個(`rel_battle_wisdom` を優先度2倍) |
| TREASURE | 全レリックから未所持1個(`rel_unyielding_plate` を優先度2倍) |
| SHOP | 未所持から2〜3個を陳列 |
| EVENT `ev_grudge_shrine` | `rel_grudge_record` |
| EVENT `ev_iron_offering` | 未所持からランダム1個 |

- 全て入手済のときは代わりにゴールド `50` を付与する

---

## 4. UI

- HUD にレリックアイコンを横並び表示。タップで名前+効果のツールチップ
- 発動した瞬間にアイコンを一瞬光らせる(CSS animation 300ms)+ ログに `[鍛錬の証] 力+1`
- 取得時に「レリック獲得」演出画面を挟む

---

## 5. 完了条件

- [ ] 6種すべてを取得でき、HUD に表示される
- [ ] `鍛錬の証`: 戦闘開始時にプレイヤーの力が 1 になり、パンチが 7 ダメージになる
- [ ] `不屈のプレート`: 戦闘開始時ブロック 5。完全防御と併用で 7
- [ ] `加速装置`: 1ターン目のみ Energy 4、2ターン目は 3
- [ ] `執念の記録`: 出血4 の敵が毎ターン 6 ダメージ受ける
- [ ] `継戦の心得`: ガードが 0 コスト、鉄壁の構えが 1 コストになる
- [ ] `汗の結晶`: 勝利ゴールドが +10 される(むずいでも +10 のまま、倍率後加算)
- [ ] 所持済レリックが宝箱/ショップに再出現しない
- [ ] 全レリック所持状態で宝箱を開くとゴールド50が入る

## コミット

```
Phase 7: レリック6種とフック機構を実装
```
