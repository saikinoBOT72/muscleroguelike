# Phase 5 — マップ生成と踏破

## 目的

STS 型の分岐マップを生成し、ノードを選んで進めるようにする。
戦闘ノードのみ中身がある状態でよい(他ノードは Phase 6)。

## 前提

Phase 4 完了(敵が全種動く)。

---

## 1. マップ構造

- **7行(Row 0〜6)× 各行 最大4列**
- Row 0 … スタート地点(必ず COMBAT、ノード2〜3個)
- Row 1〜5 … 抽選ノード
- Row 6 … BOSS(1ノードに収束)

```js
run.map = {
  rows: [ [ {row, col, type, enemyGroup, next:[col,...], seen:false} , ... ], ... ]
};
run.currentRow = -1;   // -1 = 未出発
run.currentCol = null;
```

---

## 2. 生成アルゴリズム

```
generateMap(difficulty):
  1. 空グリッド rows=7, cols=4 を用意
  2. パス生成: 6本のパスを Row0 → Row6 へ引く
     - 各パスの開始列は Row0 のノード数からランダム
     - 次の行へは {col-1, col, col+1} のうち範囲内からランダムに1つ選び辺を張る
     - Row5 → Row6 は全て BOSS(col=0)へ収束
  3. 辺が1本も入っていないノードは削除(has_incoming_edge が false)
  4. Row1〜5 の各ノードにタイプを抽選
  5. 制約補正: ensureConstraints()
```

### 生成後の制約補正 `ensureConstraints()`
順に適用する:

| 制約 | 処理 |
|---|---|
| Row1 は ELITE / REST 禁止 | 該当したら COMBAT に置換 |
| ELITE は Row2 以降のみ | 上と同じ |
| ELITE はラン中 1〜2 個 | 0個なら Row3〜4 のランダムな COMBAT を ELITE 化。3個以上なら余剰を COMBAT 化 |
| SHOP はラン中 1 個以上 | 0個なら Row3 のランダムノードを SHOP 化 |
| REST は連続禁止 | 親ノードが REST の REST を EVENT に置換 |
| EVENT は連続2回まで | 3連続になる経路があれば3つ目を COMBAT に置換 |
| ボス直前(Row5)に REST 保証 | Row5 に REST が1つも無ければ、Row5 のランダムノードを REST 化 |

> 制約補正は「経路単位」で見る必要がある。実装が重ければ「そのノードの全親ノード」を見る近似でよい。

### 戦闘ノードの敵決定
生成時に `enemyGroup` を確定させておく(その場でランダムにするとリロードで変わるため)。
- Row1–2 → `COMBAT_EARLY`
- Row3–4 → `COMBAT_MID`
- Row5 → `COMBAT_LATE`
- ELITE → `ELITE` / Row6 → `BOSS`

タイプ抽選の重みは `NODE_WEIGHTS[difficulty]`(Phase 0 定義)を使う。

---

## 3. マップUI

- **縦スクロール**、下(Row0)から上(Row6)へ進む形が分かりやすい
- ノードはアイコン付きの円:
  `⚔ COMBAT` `👹 ELITE` `❓ EVENT` `🔥 REST` `🏪 SHOP` `🎁 TREASURE` `💀 BOSS`
- 辺は SVG の線で描く(`<svg>` を絶対配置でオーバーレイ)
- **選択可能なノード**(現在地から辺が伸びている先)のみ発光 + タップ可能。それ以外は暗く
- 訪問済ノードにはチェックマーク
- 上部に HUD(HP / ゴールド / レリック / 難易度バッジ / Row表示)

---

## 4. 進行処理

```js
function enterNode(row, col){
  run.currentRow = row; run.currentCol = col;
  run.visited.push(`${row}_${col}`);
  saveGame();
  switch(node.type){
    case 'COMBAT': case 'ELITE': case 'BOSS': startBattle(node.enemyGroup); break;
    default: go(node.type);   // Phase 6 まではプレースホルダ
  }
}
```

戦闘勝利後は `go('REWARD')`(Phase 6 まではゴールドだけ渡してマップに戻す)。
BOSS 撃破時は `go('VICTORY')`。

---

## 5. 完了条件

- [ ] 「マップ再生成」デバッグボタンで50回生成してもエラーが出ず、必ず Row0→Row6 の経路が存在する
- [ ] 孤立ノード(辺のないノード)が描画されない
- [ ] ELITE が 1〜2 個、SHOP が 1 個以上、Row5 に REST が 1 個以上、必ず存在する
- [ ] Row1 に ELITE / REST が出ない
- [ ] REST が連続で並ばない
- [ ] 現在地から到達できないノードはタップできない
- [ ] 戦闘に勝つとマップに戻り、次の行のノードが選択可能になる
- [ ] Row6 に到達するとボス戦になり、勝つと VICTORY 画面が出る
- [ ] リロードしてもマップと現在地が復元され、ノードのタイプ・敵編成が変わらない
- [ ] 「むずい」では ELITE 出現率が明確に上がる(10回生成して平均ELITE数を比較)

## コミット

```
Phase 5: STS型分岐マップの生成・制約補正・踏破処理を実装
```
