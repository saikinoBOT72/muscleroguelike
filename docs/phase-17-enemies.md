# Phase 17 — 敵の拡張

## 目的

敵を 9種 → **27種(定義28)**にし、幕別プールを作る。
第2幕・第3幕が第1幕の焼き直しにならないようにする。

## 前提

Phase 11(幕構成)と Phase 12(状態異常)完了。
データは `docs/upgrade-sts.md` 11章。

---

## 1. 幕別プール

`ENCOUNTERS` を幕別に再構成する。

```js
const ENCOUNTERS = {
  1: {
    COMBAT_EARLY: [...], COMBAT_MID: [...], COMBAT_LATE: [...],
    ELITE: [...], BOSS: [...],
  },
  2: { ... },
  3: { ... },
};
function pickEncounter(act, poolKey, lastKey){ ... }
```

`assignEnemyGroups(map, act)` が幕を受け取り、`ENCOUNTERS[act]` から引く。

### 行しきい値(Phase 11 で決めたもの)

| Row | プール |
|---|---|
| 0〜4 | `COMBAT_EARLY` |
| 5〜8 | `COMBAT_MID` |
| 9〜10 | `COMBAT_LATE` |

### 編成(各幕とも 2〜3体を基本にする)

| 幕 | EARLY | MID | LATE |
|---|---|---|---|
| 1 | 既存のまま(スライム+ネズミ 等) | 既存のまま | 既存のまま |
| 2 | 鉄の猟犬 / 乳酸のヘドロ+走路の這い手 / 鏡の影+トゲネズミ | 重錘の亡霊+乳酸のヘドロ / 鏡の影×2 / 鉄の猟犬+走路の這い手 | 重錘の亡霊×2 / 鏡の影+鉄の猟犬+乳酸のヘドロ |
| 3 | 過負荷の歩哨 / 萎縮の魂+痙攣の恐怖 / 反復の残響+萎縮の魂 | バーベルの巨人 / 過負荷の歩哨+痙攣の恐怖 / 反復の残響×2 | バーベルの巨人+過負荷の歩哨 / 痙攣の恐怖+萎縮の魂+反復の残響 |

---

## 2. 敵の追加(17種)

`docs/upgrade-sts.md` 11.2〜11.5章の表のとおり。既存9種は変更しない。

| 種別 | 追加 | 合計 |
|---|---|---|
| 通常敵 | 10 | 15 |
| エリート | 4 | 6(定義7) |
| ボス | 4 | 6 |

---

## 3. 敵の新しい行動

`actEnemy()` と `intentText()` の両方に実装する。

### 3.1 デバフの拡張

```js
if (act.status){
  for (const k in act.status) applyStatus(playerActor(), k, act.status[k]);
}
if (act.statusDelta){
  for (const k in act.statusDelta) applyStatus(playerActor(), k, act.statusDelta[k]);
}
```
`frail` / `bleed` / `strength: -1` が扱えるようになる(Phase 12 の `applyStatus` を通す)。

### 3.2 状態異常カードの押し付け

```js
if (act.addCard){
  const { cardId, count, to } = act.addCard;
  for (let i = 0; i < count; i++){
    const inst = newCardInstance(cardId, false);
    if (to === 'draw') B.drawPile.splice(rnd(B.drawPile.length + 1), 0, inst);
    else B.discardPile.push(inst);
  }
  log(e.name + 'が' + CARDS[cardId].name + 'を' + count + '枚 押し付けてきた');
}
```

> **戦闘終了時に `run.deck` へ戻さない**こと。
> 山札・捨て札は戦闘開始時に `run.deck` からコピーして作っているので、
> 押し付けられたカードは戦闘終了とともに自然に消える(Phase 14 の仕様どおり)。

### 3.3 `damageMode`

```js
function enemyAttackValue(e, act){
  const d = DIFFICULTY[G.run.difficulty];
  let base;
  if (act.damageMode === 'playerBlock')   base = B.block;
  else if (act.damageMode === 'deckSize') base = Math.floor(G.run.deck.length / (act.div || 2));
  else                                    base = act.value;
  return Math.floor(base * d.enemyDmgMult * actScale().dmgMult);
}
```

**`intentText()` と `actEnemy()` の両方からこの関数を呼ぶ。**
Phase 4 で表示と実ダメージがずれるバグを出しているので、絶対に二重実装しない。

`damageMode` の Intent はプレイヤーの状態で毎ターン変わるため、
`startPlayerTurn()` で Intent を決めた**後**に計算する必要がある。
`intentText()` は描画のたびに呼ばれるので自然に追従するが、
`playerBlock` はプレイヤーがブロックを得るたびに表示が変わる点に注意
(これは仕様。「ブロックを張るほど痛い」という読み合いになる)。

---

## 4. ボスの追加(4種)

`docs/upgrade-sts.md` 11.5章。既存のフェーズ機構(`phases` / `onEnter` / `onTurnStart`)で表現できる。

| ボス | 実装メモ |
|---|---|
| `boss_plateau` 停滞の壁 | P2 の「2ターンに1回ブロック20」は `pattern:[{attack24},{attack24, block:20}]` |
| `boss_hunger` 飢餓の獣 | P1 の自己回復が閾値を跨がないよう、**フェーズ遷移は一方向**(Phase 4 で実装済)に依存 |
| `boss_limit` 限界の化身 | P2 の「3ターンに1回 力+5」は pattern 3要素で表現 |
| `boss_yesterday_self` 昨日の自分 | `damageMode:'deckSize'`。デッキを膨らませるほど痛い |

各幕のボスは2種からランダムに1体。同じランで同じボスは出さない(`run.actCleared` で除外)。

---

## 5. UI

- 敵が3体並ぶことが増えるので、`.mr-enemies` を **3列グリッド**に(375px で3体が収まる幅にする)
- 敵の名前が長いものがあるので `.ename` を2行まで許容し、`font-size` を12pxに
- ボスの HP バーは幅いっぱいに(1体のみのとき `flex-basis: 100%`)

---

## 6. 完了条件

- [ ] `Object.keys(ENEMIES).length` → **28**
- [ ] 27種すべてと戦闘でき、パターンが仕様どおりループする(1体ずつ検証)
- [ ] 第1幕に第2幕・第3幕の敵が出ない(400マップ検証)
- [ ] 第2幕・第3幕の敵が幕倍率を受けている
- [ ] `乳酸のヘドロ` が捨て札に「乳酸」を追加し、それを引くとターン終了時にHP-2
- [ ] 押し付けられた状態異常カードが**戦闘終了後にデッキに残らない**
- [ ] `萎縮の魂` がプレイヤーの力を1下げる(アーティファクトがあれば防がれる)
- [ ] `痙攣の恐怖` がプレイヤーに出血4を付け、毎ターン減衰しながらダメージを与える
- [ ] `鏡の覇者` の「ブロック値と同じダメージ」の Intent 表示が、
      プレイヤーがブロックを得るたびリアルタイムに更新される
- [ ] `昨日の自分` の Intent 表示がデッキ枚数の1/2と一致する
- [ ] **全敵の Intent 表示値と実際の被ダメージが一致する**(全27種 × ふつう/むずい × 幕1/2/3)
- [ ] 各幕のボスが2種からランダムに選ばれ、同じランで重複しない
- [ ] 敵3体が375px幅で崩れずに表示される

## コミット

```
Phase 17: 敵17種を追加し、幕別プールと新しい敵行動(デバフ拡張・カード押し付け・可変ダメージ)を実装
```
