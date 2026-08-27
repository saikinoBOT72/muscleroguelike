# Phase 3 — 全カード効果の実装

## 目的

Phase 0 で定義した 36 枚**全て**を実際に機能させる。Phase 2 の `resolveEffect()` を埋め切る。

## 前提

Phase 2 完了(BASIC カードで戦闘が回る)。

---

## 1. 実装する effect type

Phase 2 で未実装の残り全て。

### `energy` — Energy 追加
`B.energy += value`。上限なし。

### `strength` — 力を得る
`B.status.strength += value`。**即時に既存の Intent 表示は変えない**(プレイヤー側なので影響なし)。

### `counter` — カウンター体勢
`B.counter = value`。プレイヤーが攻撃を受けた瞬間に**攻撃してきた敵**へ `value` ダメージ(力・弱体の影響を受けない固定値)を与え、`B.counter = 0`。
- `攻撃4×2` の場合、1ヒット目で発動して消費
- ブロックで全吸収した場合も**発動する**(「攻撃を受けたら」= 攻撃が飛んできたら)

### `blockPerTurn`(Phase 2 で実装済、`turns:0` の永続対応を追加)
`turns:0` → `turnsLeft = Infinity`。【Power】カード用。

### `reflect` — 反発
`B.reflectPending = 1` を立てる。**ターン終了処理の最初**に、その時点の `B.block` と同値のダメージを**全敵**に与える(ブロックを消費はしない。直後にブロックが0リセットされる)。
- `keepBlock` が有効でもこのターンの終了時に1回だけ反射する
- 反射ダメージに力・弱体は乗らない。敵の脆弱は乗る

### `blockOnPower` — 忍耐【Power】
`B.powers` に存在する間、`type:'power'` のカードを使用するたび `gainBlock(value)`。
- **忍耐自身を使ったターンからカウント**(忍耐使用時には発動しない。次に POWER を使ったとき発動)
- 複数枚あれば重複する

### `blockBonus` — 完全防御【Power】
`gainBlock(v)` の内部で `v += 各blockBonusの合計` してから加算。
- `blockPerTurn` 由来のブロックにも乗る
- 反射ダメージの計算にも当然影響する(ブロック値が増えるため)

### `keepBlock` — 金剛の構え
`B.keepBlock = true`。以降 `startPlayerTurn()` でブロックをリセットしない。戦闘終了で解除。

### `damagePerAttackPlayed` — フィニッシュブロー
```
base + (B.attacksPlayedThisTurn * per)
```
**このカード自身はカウントに含めない**(使用時点で `attacksPlayedThisTurn` はまだ加算前)。

### `damagePerAttackInHand` — 拳打乱舞
```
base + (このカードを除いた手札中の cat==='ATTACK' の枚数 * per)
```
手札から取り除いた**後**に数えること。

---

## 2. 【Power】カードの挙動

`keep:true` のカード(`pwr_lasting_strength` `pwr_endurance` `pwr_immovable` `pwr_perfect_defense`)は:

1. 使用時に `effects` を解決(`strength` などは即時発動)
2. `hand` から `B.powers[]` へ移動(discardPile には入れない)
3. 戦闘UIのプレイヤーステータス欄に**アイコン+スタック数**で常時表示
4. 戦闘終了時に破棄(デッキ本体には影響しない)

| カード | 使用時の即時効果 | 継続効果 |
|---|---|---|
| 継続する強さ | なし | ターン開始時 `gainBlock(3)` |
| 忍耐 | なし | POWERカード使用のたび `gainBlock(2)` |
| 不動の心 | `strength += 2`(即時) | (力として永続) |
| 完全防御 | なし | `gainBlock` に +2 |

同じ Power を複数枚使った場合は**効果が加算**される(スタック表示 `×2`)。

---

## 3. Exhaust(除外)

`card.exhaust === true` のカードは使用後 `exhaustPile` へ。捨て札のリシャッフル対象にならない。
- 対象: `atk_heavy_blow` `skl_footwork` `skl_sprint` `skl_lightning`
- **Upgrade で exhaust が外れるカード**: `skl_footwork+` `skl_sprint+`
  (`up` に `exhaust:false` を持たせ、`up` 適用時に上書きする)
- `atk_heavy_blow+` は exhaust 維持、`skl_lightning+` も維持

---

## 4. Upgrade(+)の適用

```js
function effectiveCard(inst){
  const base = CARDS[inst.id];
  if (!inst.upgraded || !base.up) return base;
  return { ...base, ...base.up, name: base.name + '+' };
}
```
- `up` は `effects` を**全置換**する(部分マージしない)
- `up.cost` があればコストも上書き(現状該当なしだが将来用に対応)
- カード表示は `+` 付き & 枠を金色にする

**この時点で全カードの `up` を実装すること**。実際に upgraded カードが手に入るのは Phase 6(休憩所)/Phase 8 だが、デバッグパネルから「手札を全部強化」で検証できるようにする。

---

## 5. カードテキストの動的表示

固定文字列ではなく、**現在の状態を反映した数値**を表示する。

- `パンチ`(力+3 / 敵に脆弱)→ `13ダメージ` と表示(内訳 `(6+3)×1.5 = 13`)
- `フィニッシュブロー`(このターン ATTACK 2枚使用済)→ `16ダメージ`
- `拳打乱舞`(手札に ATTACK 3枚)→ `10ダメージ`

`function cardDisplayText(inst, battleState, targetEnemy)` を実装して手札描画で使う。

---

## 6. 完了条件

各カードを実際に使って検証する。デバッグパネルに「任意のカードを手札に加える」を追加すること。

- [ ] 全37枚がクラッシュせず使用できる
- [ ] `フィニッシュブロー`: パンチ2枚の後に使うと `8 + 4×2 = 16` ダメージ
- [ ] `拳打乱舞`: 手札に他のATTACK3枚がある状態で `4 + 2×3 = 10` ダメージ
- [ ] `完全防御` + `ガード` → ブロック `7+2 = 9`
- [ ] `完全防御` + `継続する強さ` → ターン開始時ブロック `3+2 = 5`
- [ ] `忍耐` を出した直後に `ガード` を使うと `7+2 = 9` ブロック
- [ ] `反発`(ブロック6)でターン終了時に敵へ6ダメージ、その後ブロックが0になる
- [ ] `金剛の構え` 使用後、ターンを跨いでブロックが残る
- [ ] `カウンター体勢` → 敵の攻撃で5ダメージ反撃、2回目の攻撃では反撃しない
- [ ] `フットワーク+` が Exhaust されず捨て札に行く
- [ ] `蝕む一撃` の出血5が毎ターン敵に5ダメージを与え続け、減衰しない
- [ ] `全体崩し` が敵2体両方に脆弱2+弱体2を付与する(敵2体は Phase 4 で検証してもよい)
- [ ] Upgrade版の全カードが仕様通りの数値になる

## コミット

```
Phase 3: 全37枚のカード効果・Power継続・Exhaust・Upgradeを実装
```
