# Phase 12 — 状態異常とキーワードの拡張

## 目的

状態異常を 4種 → **11種**、キーワードを 1種 → **5種**にする。
出血を STS の毒と同じ減衰式に変更する。

## 前提

Phase 11 完了。データは `docs/upgrade-sts.md` 4章。

---

## 1. 状態異常の追加(7種)

`newStatus()` に `dexterity / frail / thorns / regen / metallicize / artifact / rage` を追加する。

### 1.1 ブロック計算式の変更

```js
function gainBlock(v, opts){
  let amount = v;
  for (const p of B.powers)
    for (const e of effectiveCard(p).effects) if (e.type === 'blockBonus') amount += e.value;
  amount += (B.status.dexterity || 0);
  if (B.status.frail > 0) amount = Math.floor(amount * 0.75);
  if (amount < 0) amount = 0;
  amount = Math.max(0, fireRelicHook('onGainBlock', { amount }).amount);
  B.block += amount;
  // 重装【Power】
  for (const p of B.powers)
    for (const e of effectiveCard(p).effects)
      if (e.type === 'damageOnBlock') { /* ランダムな生存敵に e.value ダメージ */ }
  if (amount > 0) popup('player', '🛡+' + amount, 'blk');
  return amount;
}
```

- `doubleBlock`(塹壕)は `gainBlock` を経由せず `B.block *= 2` にする(敏捷・虚弱を二重適用しないため)
- 敵側のブロックにも敏捷・虚弱を適用する(`gainEnemyBlock(enemy, v)` を新設)

### 1.2 アーティファクトによるデバフ無効化

`docs/upgrade-sts.md` 4.6章の `applyStatus()` を実装し、
**`effects[].type === 'status'` / `'statusSelf'` / `'statusDelta'` を全てこの関数経由にする**。
敵の `act.status` によるプレイヤーへの付与も同様。

### 1.3 棘

`docs/upgrade-sts.md` 4.7章。攻撃を受けた側の `thorns` が攻撃者にダメージ。
**反射・出血・棘自身は棘を誘発しない**(無限ループ防止)。

### 1.4 出血の減衰化

```js
// finishEnemyTurn() 内
for (const e of livingEnemies()){
  if (e.status.bleed > 0){
    const amount = fireRelicHook('onBleedDamage', { amount: e.status.bleed, enemy: e }).amount;
    dealDamageToEnemy(e, amount, { ignoreBlock: true, noThorns: true });
    e.status.bleed--;                    // ← 追加
  }
  if (e.status.regen > 0){ e.hp = Math.min(e.maxHp, e.hp + e.status.regen); e.status.regen--; }
}
// プレイヤー側も同様に処理する(出血・再生は「両方」が対象)
```

**既存カードの出血付与量を `docs/upgrade-sts.md` 5.2章のとおり引き上げる。**

### 1.5 金属化・激昂

- 金属化: `endPlayerTurn()` の反発解決の**直後**に `gainBlock(B.status.metallicize)`
- 激昂: `playCard()` で `card.type === 'attack'` のとき `gainBlock(B.status.rage)`。
  `startPlayerTurn()` で `B.status.rage = 0`

---

## 2. キーワードの追加(4種)

### 2.1 カード定義への追加

```js
retain: false, ethereal: false, innate: false, unplayable: false, unexhaustable: false
```

### 2.2 `startBattle()` — 先天(innate)

```js
B.drawPile = shuffle(run.deck.map(...));
// 先天カードを山札の先頭へ寄せる(初期ドローで必ず手札に入る)
const innate = B.drawPile.filter(c => effectiveCard(c).innate);
B.drawPile = B.drawPile.filter(c => !effectiveCard(c).innate).concat(innate);
```

> 先天が手札枚数を超える場合は、超えた分は通常どおり山札に残す。

### 2.3 `endPlayerTurn()` — 保持と霊質

```js
const keep = [];
while (B.hand.length){
  const c = B.hand.pop();
  const def = effectiveCard(c);
  if (def.ethereal)      B.exhaustPile.push(c);
  else if (def.retain)   keep.push(c);
  else                   B.discardPile.push(c);
}
B.hand = keep.reverse();
```

`startPlayerTurn()` のドローは `handSize() - B.hand.length` のままでよい(保持分だけ引く枚数が減る)。

### 2.4 使用不可(unplayable)

- `canPlay(inst)` は `unplayable` なら常に false
- 手札での表示: コストバッジを「-」、カード全体をグレーアウト
- 除外効果(`exhaustRandom` / `exhaustFiltered`)は `unexhaustable` を対象外にする

---

## 3. UI

- 状態異常アイコンを11種すべて表示(`STATUS_ICON` / `STATUS_NAME` に追加)
- アイコンをタップすると説明のツールチップ(`showStatusHelp()`)
- カード枠に保持(📌)/ 霊質(👻)/ 先天(⚡)のマークを出す
- ブロック表示に敏捷・虚弱の影響が乗った実効値を出す(`cardDisplayText` の `previewBlock` を更新)

---

## 4. 完了条件

- [ ] 敏捷+2 でガードのブロックが 7 → 9 になる
- [ ] 虚弱でガードのブロックが 7 → 5(`floor(7*0.75)`)になる
- [ ] 敏捷+2 と虚弱の同時適用で `floor((7+2)*0.75) = 6`
- [ ] 棘+3 の状態で敵の攻撃を受けると敵に3ダメージ、ブロックで全吸収しても発動する
- [ ] 棘持ちの敵に反射・出血でダメージを与えても棘が誘発しない
- [ ] 再生5 が 5→4→3… と減衰しながら回復する
- [ ] 金属化3 がターン終了時にブロック3を与える
- [ ] アーティファクト1 で脆弱の付与が1回無効化され、スタックが0になる
- [ ] アーティファクトは力の**増加**を無効化しない(デバフのみ)
- [ ] 出血5 が 5→4→3→2→1→0 と減衰する(合計15ダメージ)
- [ ] 出血の一撃で出血4、蝕む一撃で出血9が付く
- [ ] 保持カードがターンを跨いで手札に残り、翌ターンのドローが1枚減る
- [ ] 霊質カードがターン終了時に除外される(捨て札に行かない)
- [ ] 先天カードが戦闘開始の初手に必ず入る
- [ ] 使用不可カードがクリックしても発動しない
- [ ] 全37枚の既存カードが今までどおり動く(Phase 3 のテストが通る)

## コミット

```
Phase 12: 状態異常7種・キーワード4種を追加し、出血を減衰式に変更
```
