# Phase 15 — ポーション

## 目的

STS の「詰みかけを1回だけひっくり返す」リソースを追加する。
現行版には戦闘中の緊張の逃げ場が一切なかった。

## 前提

Phase 13 完了(新しい effect type が揃っている)。データは `docs/upgrade-sts.md` 8章。

---

## 1. データ定義

`POTION_LIST` を `SECTION: DATA` に追加する。**カードと同じ effect スキーマを流用する**ので、
`resolveEffect()` を再利用できる(新しい解決処理はほぼ不要)。

```js
{ id:'pot_block', name:'硬化の薬', rarity:'COMMON', target:'self',
  desc:'ブロック12',
  effects:[{ type:'block', value:12 }] }
```

`POTIONS = {}` に id でインデックスする。18種は `docs/upgrade-sts.md` 8.2章の表のとおり。

### 特殊処理が必要な3種

`special` フィールドで分岐する。

| id | special | 実装 |
|---|---|---|
| `pot_duplicate` | `'duplicate'` | `B.duplicateNext = 1`。`playCard()` の最後で `B.duplicateNext > 0` なら効果をもう一度解決し、0に戻す(カードは1枚しか消費しない) |
| `pot_fairy` | `'fairy'` | 所持しているだけで発動。`dealDamageToPlayer()` で HP が0以下になった瞬間、所持していれば消費して `run.hp = ceil(run.maxHp * 0.3)`。`B.fairyUsed` で1戦1回 |
| `pot_smoke` | `'smoke'` | 戦闘から離脱。報酬なしで `go('MAP')`。**ボス戦では使用不可**(ボタンをグレーアウト) |

`pot_entropic` はランダムな他ポーション3個を**その場で即使用**する(枠に入れない)。
選出時に `pot_entropic` / `pot_fairy` / `pot_smoke` は除外する(無限再帰と不整合を防ぐ)。

---

## 2. run への追加

```js
run.potions = [null, null, null];
```

### 入手

```js
function gainPotion(id){
  const slot = G.run.potions.indexOf(null);
  if (slot >= 0){ G.run.potions[slot] = id; saveGame(); return true; }
  return false;   // 枠が満杯 → 呼び出し側で「どれを捨てるか」を選ばせる
}
```

枠が満杯のときは `openPotionSwap(newId)` を開き、
「捨てるポーションを選ぶ / 受け取らない」の2択にする。

### ドロップ率

| 経路 | 率 |
|---|---|
| 通常戦闘勝利 | 40%(むずいは30%) |
| エリート撃破 | 100% |
| 幕ボス撃破 | 100% |
| 宝箱 | 30% |
| 祝福「蓄え」 | 1個(Phase 16) |

`makeReward()` に `potion: id | null` を追加し、報酬画面で受け取る。

### ショップ

`makeShopStock()` に `potions: [{id, price, sold}]` を3個追加する。
価格は COMMON 50 / UNCOMMON 75 / RARE 110 に `shopPriceMult` を掛ける。

---

## 3. 戦闘中の使用

- 戦闘画面の Energy バッジの隣に**ポーション3枠**を常時表示(空枠は点線の丸)
- タップ → 確認 → 使用。**Energy は消費しない**
- `target:'single'` のポーションは敵選択 UI を挟む(カードと同じ `B.selecting` の仕組みを流用。
  `B.selectingPotion` を別に持つ)
- 使用後は枠が空になり、`fireRelicHook('onPotionUse', {potion})` を呼ぶ
- **戦闘中以外でも捨てられる**ように、マップ画面のHUDからポーション枠を開けるようにする

```js
function usePotion(slot, targetIdx){
  const id = G.run.potions[slot];
  if (!id || !G.battle || G.battle.phase !== 'PLAYER') return;
  const p = POTIONS[id];
  G.run.potions[slot] = null;
  log('▶ ' + p.name);
  if (p.special) { resolvePotionSpecial(p); }
  else {
    const ctx = { card: { type:'potion', target:p.target, cat:'POTION' },
                  target: targetIdx != null ? B.enemies[targetIdx] : null };
    for (const e of p.effects) resolveEffect(e, ctx);
  }
  fireRelicHook('onPotionUse', { potion: p });
  checkBattleEnd();
  saveGame();
  render();
}
```

> `ctx.card.type` を `'potion'` にすることで、`resolveEffect` の
> `strength: card.type === 'attack'` 判定が自然に false になる(ポーションのダメージに力は乗らない)。

---

## 4. メタ進行

`meta.unlockedPotions` を追加。**初期解放は COMMON 8種のみ**。
UNCOMMON / RARE は強化所で **任意のコア6個**ずつ開放する。

強化所に5つ目のタブ「ポーション」を追加する。
未開放のポーションはドロップ・ショップの抽選候補から除く。

---

## 5. 完了条件

- [ ] 3枠が戦闘画面に常時表示され、空枠が点線で描かれる
- [ ] `硬化の薬` でブロック12を得る。Energy は減らない
- [ ] `発火の薬` で対象を選んで20ダメージ。**力は乗らない**
- [ ] `活力の薬` で Energy+2 され、そのターン中に使える
- [ ] `洗浄の薬` で自分の弱体・脆弱・虚弱が全て0になる
- [ ] `複製の薬` の後に使ったカード1枚の効果が2回発動し、カードは1枚しか消費されない
- [ ] `妖精の薬` を所持した状態で HP が0になると自動消費され、最大HPの30%で復帰する
- [ ] `妖精の薬` は1戦につき1回だけ発動する
- [ ] `煙玉` でボス戦以外から離脱でき、ボス戦ではボタンが押せない
- [ ] `混沌の薬` が他の3種を即時発動し、枠を消費しない
- [ ] 枠が満杯で新しいポーションを得ると、捨てる選択 or 辞退ができる
- [ ] 通常戦闘のドロップ率が約40%(むずいは約30%)、エリート/ボスは100%(500回計測)
- [ ] ショップにポーションが3個並び、購入するとゴールドが減る
- [ ] 未開放のポーションがドロップ・ショップに出ない
- [ ] 強化所でポーションを開放すると、次のランからドロップする
- [ ] リロードしてもポーション所持が復元される

## コミット

```
Phase 15: ポーション18種・3枠・ドロップ・ショップ・メタ解放を実装
```
