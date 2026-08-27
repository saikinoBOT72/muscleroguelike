# Phase 11 — 3幕構成・マップ拡張

## 目的

1幕7行(実質7ノード・4.6戦)を **3幕 × 12行(36ノード・約24戦)** にする。
これがアップグレード全体で最も効果の大きい変更。

## 前提

Phase 0〜9 完成版。データは `docs/upgrade-sts.md` 3章。

---

## 1. 定数の変更

```js
const ACTS = 3;
const ROWS_PER_ACT = 12;          // Row 0..11、Row11 が幕ボス
const BOSS_ROW = ROWS_PER_ACT - 1;
const MAP_COLS = 4;               // 変更なし
const MAP_PATHS = 8;              // 6 → 8
```

`MAP_ROWS` は `ROWS_PER_ACT` に改名する。`BOSS_ROW` を参照している箇所は自動で追従する。

---

## 2. run への追加

```js
run.act = 1;              // 1..3
run.actCleared = [];      // 撃破した幕ボスの id
```

`startRun()` で `act:1`、`map: generateMap(difficulty, 1)` にする。

---

## 3. マップ生成の更新

### 3.1 `generateMap(diffKey, act)`

第2引数に幕を取り、`assignEnemyGroups` に渡す。

### 3.2 制約補正の更新

| 制約 | 変更 |
|---|---|
| ELITE の個数 | 1〜2 → **2〜4** |
| SHOP の個数 | 1以上 → **1〜2** |
| 敵編成の行しきい値 | Row1-2/3-4/5 → **Row1-4 = EARLY / Row5-8 = MID / Row9-10 = LATE** |
| ボス直前の REST | Row5 → **Row10** |

### 3.3 到達可能性の保証(新規・必須)

現行は「マップ上に存在する」しか保証しておらず、実測でショップに入れるランは50%しかなかった。

```
ensureReachable(map):
  reach = Row0 の全ノードから BFS で到達可能なノード集合(Row1..Row10)
  for type of ['SHOP', 'REST']:
     if reach に type が1つも無い:
        reach 内から、置換しても他の制約を壊さないノードを1つ選んで type にする
  再度 validateMap を通す
```

`ensureConstraints()` の**最後**に呼ぶ。ELITE も同様に、到達可能な集合に1つ以上ある状態を保証する
(ELITE は2〜4個あるので通常は満たされるが、念のため検証に含める)。

### 3.4 `mapProblems()` に追加する検証

- 到達可能集合に SHOP が1つ以上あるか
- 到達可能集合に REST が1つ以上あるか
- 到達可能集合に ELITE が1つ以上あるか
- Row10 に REST があるか

---

## 4. 幕倍率

```js
const ACT_SCALE = {
  1: { hpMult: 1.00, dmgMult: 1.00, goldMult: 1.0 },
  2: { hpMult: 1.15, dmgMult: 1.10, goldMult: 1.2 },
  3: { hpMult: 1.30, dmgMult: 1.20, goldMult: 1.5 },
};
function actScale(){ return ACT_SCALE[G.run ? G.run.act : 1] || ACT_SCALE[1]; }
```

適用箇所:

| 箇所 | 変更 |
|---|---|
| `makeEnemy()` の HP | `round(range(hpMin,hpMax) * d.enemyHpMult * actScale().hpMult)` |
| `actEnemy()` の攻撃力 | `floor(act.value * d.enemyDmgMult * actScale().dmgMult)` |
| `intentText()` | 上と同じ式(表示と実ダメージを必ず一致させる) |
| `makeReward()` のゴールド | `floor(range(...) * d.goldMult * actScale().goldMult)` |

> `intentText()` と `actEnemy()` で同じ計算をするので、
> **`enemyAttackValue(enemy, action)` に切り出して両方から呼ぶ**こと。
> Phase 4 で表示と実ダメージがずれるバグを出しているので、二重実装しない。

---

## 5. 幕クリア画面(新規 `ACT_CLEAR`)

幕ボス撃破時、`REWARD` の後に挟む。

表示:
- 「第N幕 突破」
- 通常の戦闘報酬(ゴールド・カード3択)は `REWARD` で済ませてから遷移する
- **ボスレリック3択**(Phase 16 まではプレースホルダで「Phase 16 で実装」と表示)
- **ポーション1個**(Phase 15 まではスキップ)
- 最大HPの **5%** 回復(切り上げ)
- 「第N+1幕へ」ボタン

遷移処理:

```js
function advanceAct(){
  const run = G.run;
  run.actCleared.push(currentNode().enemyGroup[0]);
  run.hp = Math.min(run.maxHp, run.hp + Math.ceil(run.maxHp * 0.05));
  run.act++;
  run.map = generateMap(run.difficulty, run.act);
  run.currentRow = -1;
  run.currentCol = null;
  run.visited = [];
  G.battle = null; B = null;
  saveGame();
  go('MAP');
}
```

`checkBattleEnd()` の勝利判定:

```js
const boss = node && node.type === 'BOSS';
if (boss && G.run.act >= ACTS){
  // 3幕目のボス → VICTORY
} else if (boss){
  // → REWARD → ACT_CLEAR
}
```

`meta.maxAct = max(meta.maxAct, run.act)` を幕開始時に更新する。

---

## 5b. 超回復(休憩所の変更)

`docs/upgrade-sts.md` 2.6章。

| 選択肢 | 効果 |
|---|---|
| 🔥 **超回復** | HPを最大HPの30%(むずい22%)回復。**さらに次の戦闘のみ 力+1、敏捷+1** |
| ⚒ 鍛える | デッキから1枚を Upgrade(変更なし) |

```js
// 休憩所で「超回復」を選んだとき
run.superCompensation = true;
// startBattle() の最後(fireRelicHook('onBattleStart') の後)
if (G.run.superCompensation){
  B.status.strength += 1;
  B.status.dexterity += 1;      // 敏捷は Phase 12 で実装
  log('[超回復] 力+1 敏捷+1');
  G.run.superCompensation = false;
}
```

> Phase 12 より前に着手する場合、敏捷はまだ無いので力+1のみ実装し、
> Phase 12 で敏捷を足す(TODO コメントを残す)。

---

## 6. UI の更新

- HUD に **幕表示**を追加(`第2幕 / Row 5`)
- マップ画面のヘッダを `第N幕 Row X / 11` に
- マップは12行 × 92px = 1104px になるのでスクロールが必須。現在地への自動スクロールは既存のまま
- 幕ごとにマップの背景色をわずかに変える(1幕=青寄り / 2幕=緑寄り / 3幕=赤寄りの暗色)
  `--bg` は変えず、`.mr-mapscroll` の背景だけを `--act-tint` で切り替える
- **漸進性過負荷の明示**: 幕の開始時に
  「第2幕 — 漸進性過負荷: 敵のHP +15% / 攻撃力 +10%」を 900ms 表示してからマップへ。
  HUD の幕バッジをタップすると現在の幕倍率が確認できる

---

## 7. セーブ互換

`docs/upgrade-sts.md` 13.4章のとおり。
**旧マップ(7行)を持つ進行中のランは復元できないので破棄**し、
タイトルで1度だけ「前回のランは新バージョンに引き継げませんでした」を表示する
(`meta.migrationNoticeShown` フラグ)。

---

## 8. 完了条件

- [ ] 1幕が12行になり、Row11 にボスが出る
- [ ] 幕ボスを倒すと ACT_CLEAR を経て第2幕のマップが生成される
- [ ] 第3幕のボスを倒すと VICTORY になる
- [ ] 敗北すると GAMEOVER になり、到達幕と Row が表示される
- [ ] マップ生成を400回試して `mapProblems()` が0件
- [ ] **到達可能な経路上に SHOP / REST / ELITE が必ず存在する**(400回検証)
- [ ] 1ランで実際に踏むノードが 36、戦闘回数が 20〜28 に収まる(200ラン計測)
- [ ] 第2幕の敵HPが第1幕の1.15倍、第3幕が1.30倍になっている
- [ ] Intent の表示値と実際の被ダメージが全幕で一致する
- [ ] リロードで幕・マップ・現在地が復元される
- [ ] 旧セーブ(7行マップ)を読み込んでもクラッシュせず、ランだけ破棄される
- [ ] 休憩所で「超回復」を選ぶと、次の戦闘の開始時に力+1が付き、その次の戦闘には付かない
- [ ] 幕の開始時に漸進性過負荷の表示が出る

## コミット

```
Phase 11: 3幕構成・マップ12行化・幕倍率・到達可能性の保証を実装
```
