# Phase 4 — 敵AI・Intent・エリート・ボス

## 目的

9種の敵を全て動かす。フェーズ切替・複数体戦闘・難易度倍率の適用まで。

## 前提

Phase 3 完了(全カードが機能する)。

---

## 1. 敵AIの共通エンジン

敵の行動は「フェーズ配列 + パターン配列」だけで表現する。

```js
function decideIntent(enemy){
  const def = ENEMIES[enemy.id];
  const ph  = currentPhase(enemy, def);        // HP割合で選択
  if (ph.weighted) return weightedPick(ph.pattern);   // 重み抽選型
  const act = ph.pattern[enemy.patternIdx % ph.pattern.length];
  return act;
}
function advancePattern(enemy){ enemy.patternIdx++; }
```

### フェーズ切替
```js
function currentPhase(enemy, def){
  const ratio = enemy.hp / enemy.maxHp;
  // phases は hpThreshold の降順。ratio <= hpThreshold の最後のものを選ぶ
}
```
- フェーズが切り替わった瞬間に `patternIdx = 0` にリセットし、`onEnter` があれば実行
- **フェーズ遷移は一方向**。自己回復でHPが閾値より上に戻っても前のフェーズには戻さない
  (過負荷の番人がP2の回復10でP1に戻ると、回復した結果として攻撃が18→14に弱くなってしまう)
- `bossPhase2` 難易度パラメータで閾値を差し替える(ふつう 0.50 / むずい 0.60)

### intent 実行
| intent | 動作 |
|---|---|
| `attack` | `value` ダメージ ×`times`(既定1)を `dealDamageToPlayer` へ。敵の力・弱体、プレイヤーの脆弱を適用 |
| `block` | `enemy.block += value` |
| `buff` | `enemy.status.strength += value` |
| `debuff` | プレイヤーに `status` を付与 |
| `heal` | `enemy.hp = min(maxHp, hp + value)` |

1つの action に複数キーを持たせられる: `{intent:'attack', value:6, status:{weak:1}}`
→ 攻撃してから状態異常を付与。`{intent:'block', value:15, strength:2}` のように複合も可。

---

## 2. 敵ごとの定義(確定版)

```js
slime_fake:  hp 18-22, pattern:[ {attack 6}, {attack 6, status:{weak:1}} ] loop
spike_rat:   hp 12-15, pattern:[ {attack 4, times:2} ] loop
wander_golem:hp 25-30, pattern:[ {attack 10}, {block 8} ] loop
bat_swarm:   hp 15-18, pattern:[ {attack 3, times:3} ] loop
shadow_scout:hp 20-24, weighted:[ {attack 8, w:70}, {heal 5, w:30} ]
```

### elite_heavy_soldier(重装兵)
`hp 45`, `pattern:[ {attack:12}, {block:15, strength:2} ]` loop

### elite_twin_shadows(双子の影) — 2体構成
- `elite_twin_shadow_a` / `elite_twin_shadow_b` として**2体を生成**(どちらも hp 28)
- 各個体が `pattern:[ {attack:6}, {debuff vulnerable:1} ]` を独立に回す
- **開始時の `patternIdx` をずらす**(A=0, B=1)ことで「交互」感を出す
- **片方が死亡した瞬間**、生存側に `strength += 3` と「怒り」ログを出す(1回のみ)
  → `onAllyDeath` フックを敵に持たせて実装

### boss_overload_warden(過負荷の番人) `hp 80`
| フェーズ | 条件 | パターン(loop) |
|---|---|---|
| P1 | ratio > 閾値 | `{debuff vulnerable:1, target:'player'}` → `{attack:14}` |
| P2 | ratio ≤ 閾値 | `{attack:18}` ×2 → `{attack:18, heal:10}`(=3ターンに1回回復) |

P2 突入時に `onEnter` で「暴走した!」ログ + 敵の見た目を変える(CSSクラス付与)。

### boss_sloth_colossus(怠惰の巨像) `hp 90`
- **毎ターン行動前に `strength += 1`**(`onTurnStart` フック)
- パターンは常に `{attack:8}`(力が乗るので実ダメージは 9, 10, 11 …と増える)
- P2 突入時(`onEnter`)に `strength += 3` を即時加算
- 「ターン経過で詰む」設計なので、プレイヤーは速攻を強いられる

> `onTurnStart` / `onEnter` / `onAllyDeath` の3フックを敵定義に持たせる。
> 値ではなく関数として `ENEMIES` に置いてよい(単一HTMLなのでJSON化の必要なし)。
>
> **`onTurnStart` は「敵が行動する直前」ではなく「プレイヤーのターン開始時、Intent を決める直前」に呼ぶ。**
> 行動直前に力を加算すると、既に表示済みの Intent より実際の被ダメージが大きくなり、
> 読み合いが成立しない(怠惰の巨像で表示12・実際13になる)。被ダメージの推移は変わらない。

---

## 3. 難易度倍率の適用

```js
const D = DIFFICULTY[G.run.difficulty];

// 敵生成時
enemy.maxHp = Math.round(range(hpMin, hpMax) * D.enemyHpMult);
enemy.status.strength = D.enemyStartStrength[tier];

// 攻撃実行時(intent 決定時にも同じ値で表示すること)
const dmg = Math.floor(action.value * D.enemyDmgMult);
```
- **Intent 表示は倍率適用後の値**を出す(プレイヤーが読めないと理不尽になる)
- `heal` / `block` には倍率をかけない

むずい時の実効値の例:
| 敵 | ふつう | むずい |
|---|---|---|
| スライムモドキ | HP20 / 攻6 | HP25 / 攻7(+力1で実質8) |
| 重装兵 | HP45 / 攻12 | HP56 / 攻15(+力2で実質17) |
| 過負荷の番人 P2 | HP80 / 攻18 | HP100 / 攻22(+力2で実質24) |

---

## 4. 敵の編成(エンカウントテーブル)

戦闘ノードで出す敵の組み合わせ。Row が進むほど強くする。

```js
const ENCOUNTERS = {
  COMBAT_EARLY: [   // Row 1-2
    ['slime_fake'], ['spike_rat','spike_rat'], ['bat_swarm']
  ],
  COMBAT_MID: [     // Row 3-4
    ['slime_fake','spike_rat'], ['wander_golem'], ['shadow_scout'],
    ['bat_swarm','spike_rat']
  ],
  COMBAT_LATE: [    // Row 5
    ['wander_golem','slime_fake'], ['shadow_scout','shadow_scout'],
    ['slime_fake','slime_fake','spike_rat']
  ],
  ELITE: [ ['elite_heavy_soldier'], ['elite_twin_shadows'] ],
  BOSS:  [ ['boss_overload_warden'], ['boss_sloth_colossus'] ]
};
```
同じランで同じエンカウントを2回連続で出さないこと。

---

## 5. UI追加

- 敵が複数のとき横並び。選択中の敵に枠ハイライト
- 敵の死亡アニメーション(フェードアウト 300ms)後にリストから消す
- ボスは名前の下に**フェーズ表示バー**(HP バーに閾値ラインを引く)
- 敵の力スタックを状態異常アイコンとして表示(`💪2`)

---

## 6. 完了条件

デバッグパネルに「任意の敵と戦闘開始」を追加して検証する。

- [ ] 全9種の敵と戦闘でき、パターンが仕様通りループする
- [ ] Intent の表示値と実際の被ダメージが一致する(脆弱時も含む)
- [ ] 徘徊ゴーレムのブロック8が翌ターンに残らない(敵ブロックもターン終了でリセット)
- [ ] 影の斥候が回復とダメージを 7:3 程度で使い分ける(20回試行で確認)
- [ ] 双子の影で片方を倒すと残りに `💪3` が付く
- [ ] 過負荷の番人が HP40 以下でフェーズ2に切り替わり、攻撃18になる
- [ ] 怠惰の巨像の攻撃が 8→9→10→11 と毎ターン1ずつ増える
- [ ] 「むずい」で全敵のHP・攻撃力が 1.25 倍になり、開始時に力を持つ
- [ ] 敵2体以上のとき `target:'single'` カードで対象選択ができる
- [ ] 全体攻撃/全体デバフが生存中の敵全員に当たる

## コミット

```
Phase 4: 敵AI・Intent表示・エリート/ボスのフェーズ切替・難易度倍率を実装
```
