# Phase 13 — 運動記録の再設計とカードプール拡張

## 目的

**このアップグレードの中心。** 2つのことを同時にやる。

1. **運動記録を「デッキそのもの」から「ビルドの土台」に作り替える**
   (深さ / 型 / 体力 / 成果カード)。STS の構築アークを取り戻す
2. カードを 37枚 → **73枚**にし、`effect type` を22種追加する。
   カード報酬の「全カテゴリ均等」を撤廃する

## 前提

Phase 12 完了(新しい状態異常とキーワードが動く)。
データは `docs/upgrade-sts.md` **2章**・5章・6章。

**作業量が大きいので3コミットに分ける。**

---

# 13a — 運動記録の再設計

`docs/upgrade-sts.md` 2章の全て。**先にこれをやる**(カードプールより優先度が高い)。

## 1. 初期デッキを8枚に戻す

```js
const STARTING_DECK = [
  'atk_punch','atk_punch','atk_punch',
  'pwr_guard','pwr_guard','pwr_guard',
  'skl_sidestep','dbf_feint',
];
```

Phase 9 で12枚にしたのは「BASIC 4種が入手不能」問題への対処だった。
その問題は **2.10章の初期デッキ差し替え**で解決するので、8枚に戻してよい。

## 2. 深さ(2.2章)

```js
const DEPTH_TIERS = [
  { min:  0, cap: null }, { min:  5, cap: 'COMMON' },
  { min: 25, cap: 'UNCOMMON' }, { min: 80, cap: 'RARE' },
];
function depthCap(count){ /* ... */ }
function inDepth(cardId){ /* ... */ }
```

`run.depth` を `startRun()` で確定させる。

**`inDepth()` を通す箇所**(`isUnlocked()` と AND):
- `pickRewardCards()`
- `makeShopStock()`(カードのみ。レリック・ポーションは対象外)
- イベントの「カード1枚獲得」
- 祝福「見識」(Phase 16)

**全カテゴリが 0〜4 のとき**は全カテゴリを COMMON まで解禁する(救済)。
このとき型も体力ボーナスも付かないので、実質的な最低難度スタートになる。

## 3. 型(2.3章)

```js
run.form = 'ATTACK' | 'SKILL' | 'DEBUFF' | 'POWER' | 'BALANCED' | null;
function categoryWeight(cat){ return G.run.form === cat ? 1.5 : 1.0; }
```

- 最多の種目が1つ → そのカテゴリの型。開始レリックを**メタ進行のアンロックを無視して**付与
- 最多が2種目以上で並ぶ → `'BALANCED'`。レリックなし、最大HP+10
- 全種目0 → `null`
- 型のレリックを既に持っている場合はゴールド+80 で代替

## 4. 体力(2.4章)

```js
const VOLUME_TIERS = [
  { min:0, maxHp:70, hand:5, gold:99 }, { min:20, maxHp:75, hand:5, gold:110 },
  { min:60, maxHp:80, hand:6, gold:125 }, { min:120, maxHp:85, hand:6, gold:145 },
  { min:240, maxHp:90, hand:7, gold:170 },
];
```

- むずいは最大HP から -10
- `run.handSize` は `handSizeFor(generatedCount)` ではなく **volume から**決める
- **Phase 9 の「生成カード枚数で手札が増える」仕組みは削除する**
- `run.maxHp` / `run.gold` も volume から決める(`DIFFICULTY.playerMaxHp` は基準値として残すが未使用にする)

## 5. 成果カード(2.5章)

```js
function buildDeck(exercise, meta, diffKey){
  const deck = STARTING_DECK.map(id => newCardInstance(applySwap(id), meta.upgradedBasics.includes(id)));
  const counts = normalizeExercise(exercise);
  for (const ex of EXERCISES){
    const n = counts[ex.cat];
    const cap = depthCap(n);
    if (!cap) continue;
    const id = rollCardOf(ex.cat, cap, deck, []);
    if (id) deck.push(newCardInstance(id, n >= 160));
  }
  return deck;
}
```

**削除するもの**: `cardsFromCount()` / `rarityBonus()` / `rarityWeights()` / `upgradeBonus()` /
`handSizeFor()`。これらは Phase 9 で追加した希釈対策で、本改訂では役目を終える。

## 6. 初期デッキの差し替え(2.10章)

`BASIC_SWAPS` と `meta.deckSwaps` / `meta.swapsPurchased`。
強化所の「初期デッキ」タブを差し替え式に作り替える。

- 初回のみ対応コア10。以降は無料で切り替え
- 既存の「BASIC を恒久 Upgrade(コア12)」は残し、差し替えた側も個別に強化できる

## 7. UI の作り直し(2.9章)

運動入力画面を、4つの軸がリアルタイムで見えるように作り替える。
深さは ★☆☆ / ★★☆ / ★★★ の3段階、次の閾値までの残りを表示、0回のカテゴリは赤字で警告。

## 13a の完了条件

- [ ] 初期デッキが8枚に戻り、成果カードは最大4枚(デッキ 8〜12枚)
- [ ] 腕立て0回のとき、ATTACK のカードが報酬・ショップに1枚も出ない(500回試行)
- [ ] 腕立て4回で出ない、5回で COMMON まで、25回で UNCOMMON まで、80回で RARE まで出る
- [ ] 全種目0回のとき、救済で全カテゴリ COMMON まで出る
- [ ] 腕立てが最多なら「押しの型」になり、鍛錬の証を必ず持って開始する
- [ ] 型のレリックはメタ進行で未開放でも手に入る
- [ ] 最多が並ぶと「総合の型」になり、最大HP+10 でレリックなし
- [ ] volume 195 で 最大HP85 / 手札6 / ゴールド145、むずいなら最大HP75
- [ ] 各種目160回以上の成果カードが強化(+)版で生成される
- [ ] 強化所で初期デッキを差し替えると、次のランの初期デッキが変わる
- [ ] 差し替えは元に戻せて、2回目以降はコアを消費しない
- [ ] BASIC 8種すべてが入手経路を持つ
- [ ] 入力画面に深さ★・型・体力・警告がリアルタイム表示される

---

# 13b — effect type 22種

`docs/upgrade-sts.md` 5.1章の表のとおり `resolveEffect()` に実装する。

### 実装上の注意

| type | 注意点 |
|---|---|
| `selfDamage` | ブロックを無視し、脆弱の影響も受けない。HPが0になれば敗北する |
| `heal` | 最大HPが上限 |
| `gainMaxHp` | 現在HPも同量増やす |
| `statusSelf` | `applyStatus(playerEntity, ...)` 経由。アーティファクトの判定に通す |
| `statusDelta` | 負値可。力を下げるのはデバフなのでアーティファクトで防がれる |
| `multiplyStatus` | `floor(n * mult)`。0 のときは何も起きない |
| `randomStatus` | **1回ごとに生存敵を抽選し直す** |
| `damageIfStatus` | 判定は damage 適用**前**の状態で行う |
| `exhaustRandom` | `unexhaustable` を対象外にする。対象が足りなければあるだけ |
| `exhaustFiltered` | 同上。`blockPer > 0` なら除外枚数 × blockPer を `gainBlock` |
| `shuffleDiscardIntoDraw` | 山札に**混ぜて**シャッフル |
| `discardHandDrawSame` | このカード自身は既に手札から抜かれているので数に入らない |
| `damageAllPerEnergy` | `n = B.energy` を保存 → `B.energy = 0` → n 回、全生存敵に damage |
| `blockAsDamage` | `B.block` をそのまま基礎ダメージに。力は乗らない |
| `doubleBlock` | `B.block *= 2`。`gainBlock` を通さない(敏捷・虚弱の二重適用を避ける) |
| `conditionalBlock` | `run.hp / run.maxHp <= hpBelow` で altValue。`gainBlock` を通す |
| `onKillMaxHp` | 直前の damage で倒したかを `ctx.killedThisEffect` で判定 |
| `damageOnBlock` | 場に残る Power。`gainBlock` の中から発火 |
| `strengthPerTurn` / `dexterityPerTurn` | `startPlayerTurn()` で `B.powers` を走査 |
| `addCard` | `to`(`'discard'`/`'draw'`/`'hand'`)。`'hand'` は手札上限を尊重 |
| `blockPerAttackPlayed` | `base + B.attacksPlayedThisTurn * per` |

### セット(2.8章)

`B.playedThisTurn = {}` を `startPlayerTurn()` でリセットし、`playCard()` の先頭で
`B.playedThisTurn[inst.id] = (…||0) + 1` する。

`effects[].setBonus` が定義されていれば、
`B.playedThisTurn[inst.id] >= 2` のとき `value += setBonus` にする。

対象は3枚のみ: `atk_double_punch`(+1/hit) / `atk_rush`(+2/hit) / `skl_dash`(+1枚ドロー)。

## 13b の完了条件

- [ ] 22種の effect type が全て動く(1つずつ検証)
- [ ] `ダブルパンチ` をこのターン2回目に使うと 3×2 → 4×2 になる
- [ ] 別のターンに使えば 3×2 に戻る

---

# 13c — カード36枚と報酬の変更

## 1. カード36枚の追加

`docs/upgrade-sts.md` 5.3〜5.6章の表を `CARD_LIST` に追加する。

### 既存カードの変更(5.2章)

| カード | 出血の付与量 |
|---|---|
| 出血の一撃 | 2 / 3 → **4 / 6** |
| トドメの一突き | 3 / 4 → **5 / 7** |
| 蝕む一撃 | 5 / 7 → **9 / 12** |

### カテゴリ別の内訳(検証用)

| カテゴリ | BASIC | COMMON | UNCOMMON | RARE | 計 |
|---|---|---|---|---|---|
| ATTACK | 2 | 6 | 6 | 5 | 19 |
| SKILL | 2 | 6 | 5 | 5 | 18 |
| DEBUFF | 2 | 6 | 5 | 5 | 18 |
| POWER | 2 | 6 | 5 | 5 | 18 |
| **計** | 8 | 24 | 21 | 20 | **73** |

## 2. カード報酬(6章)

均等ルールを撤廃し、`inDepth()` と `categoryWeight()`(13a で実装済)を通す。

```js
function pickRewardCards(diffKey, tier, count){
  const pool = CARD_LIST.filter(c =>
    c.rarity !== 'BASIC' && c.cat !== 'STATUS' && c.cat !== 'CURSE'
    && isUnlocked(c.id) && inDepth(c.id));
  const out = [];
  for (let i = 0; i < (count || 3); i++){
    let rarity = weightedPick(REWARD_RARITY[diffKey] || REWARD_RARITY.NORMAL);
    if (tier !== 'COMBAT' && rarity === 'COMMON') rarity = 'UNCOMMON';
    let cand = [];
    for (const r of [rarity, 'UNCOMMON', 'COMMON']){
      cand = pool.filter(c => c.rarity === r && out.indexOf(c.id) < 0);
      if (cand.length) break;
    }
    if (!cand.length) cand = pool.filter(c => out.indexOf(c.id) < 0);
    if (!cand.length) break;
    out.push(weightedPick(cand.map(c => ({ v:c.id, w: categoryWeight(c.cat) }))));
  }
  return out;
}
```

**カテゴリの制約は一切かけない。**

## 13c の完了条件

- [ ] `Object.keys(CARDS).length` → **73**、カテゴリ別内訳が上表と一致
- [ ] 全73枚を通常版・強化版の両方で使用してもクラッシュしない
- [ ] `鉄の波動`: 5ダメージ + ブロック5
- [ ] `捨て身の一振り`: 敵に7、自分に3(ブロックがあっても自分は3受ける)
- [ ] `惨殺`: ターン終了時に手札に残っていたら除外される
- [ ] `旋風脚`: Energy3 で全体に各15ダメージ、Energy が0になる
- [ ] `捕食`: これで敵を倒すと最大HP+3、倒せなければ増えない
- [ ] `セカンドウィンド`: 非ATTACK3枚を除外してブロック15
- [ ] `触媒`: 出血6の敵が出血12になる
- [ ] `衰弱`: 敵の力が2下がる
- [ ] `破滅`: 出血していない敵に8、出血中の敵に16
- [ ] `体当たり`: ブロック20の状態で20ダメージ
- [ ] `塹壕`: ブロック12が24(敏捷が二重に乗らない)
- [ ] `背水の陣`: HP51%でブロック8、HP50%でブロック20
- [ ] `鬼神化`: 毎ターン開始時に力が+2ずつ増える
- [ ] 報酬3択に**同じカテゴリが2枚以上並ぶことがある**(200回試行)
- [ ] **深さの制限を超えたレアリティが報酬に出ない**(500回試行)
- [ ] 「今日の型」のカテゴリが報酬に約1.5倍出やすい(2000回試行で確認)
- [ ] 報酬に BASIC / STATUS / CURSE が出ない
- [ ] Phase 3・9 の既存テストが全て通る

---

## コミット

```
Phase 13a: 運動記録を深さ・型・体力・成果カードに再設計し、初期デッキを8枚に戻す
Phase 13b: effect type 22種と「セット」ボーナスを追加
Phase 13c: カード36枚を追加し、報酬の全カテゴリ均等を撤廃
```
