# Phase 2 — 戦闘コア

## 目的

「1回の戦闘が最後まで成立する」状態にする。カードは**BASIC 4種のみ**動けばよい。
残り32枚は Phase 3。敵は固定1体(`slime_fake`)で、AIも固定ループのみ。

## 前提

Phase 1 完了(デッキが組める)。

---

## 1. battle 状態

```js
G.battle = {
  enemies: [ {uid, id, name, hp, maxHp, block:0,
              status:{weak:0, vulnerable:0, bleed:0, strength:0},
              phaseIdx:0, patternIdx:0, intent:null, turnCount:0, alive:true} ],
  drawPile: [], hand: [], discardPile: [], exhaustPile: [],
  powers: [],                        // 場に残る【Power】カードインスタンス
  energy: 3, maxEnergy: 3,
  block: 0,
  status: { weak:0, vulnerable:0, strength:0 },
  evade: 0,                          // 残り回避回数
  counter: 0,                        // 反撃ダメージ(0=なし)
  keepBlock: false,
  reflectPending: 0,
  blockPerTurn: [],                  // [{value, turnsLeft}] turnsLeft=Infinity で永続
  attacksPlayedThisTurn: 0,
  turn: 1,
  phase: 'PLAYER',                   // PLAYER / ENEMY / WIN / LOSE
  log: []
};
```

---

## 2. ターンフロー(仕様書6章の実装)

```
startBattle(enemyIds):
    敵インスタンス生成(HPは hpMin..hpMax の乱数)
    drawPile = shuffle(run.deck のコピー)
    hand = [], discardPile = [], exhaustPile = [], powers = []
    (Phase 7: 戦闘開始時レリック効果)
    turn = 1 → startPlayerTurn()

startPlayerTurn():
    energy = maxEnergy
    if (!keepBlock) block = 0
    blockPerTurn の各項目を適用 → gainBlock(value)、turnsLeft--、0になったら除去
    自分の weak / vulnerable を 1 減少
    attacksPlayedThisTurn = 0
    手札が5枚になるまで drawCard()
    敵の Intent を決定 → decideIntent(enemy)
    phase = 'PLAYER'

playCard(handIndex, targetIdx):
    cost 判定 → energy 不足なら弾く
    energy -= cost
    hand から取り除く
    effects を順に resolveEffect()
    card.keep なら powers[] へ / exhaust なら exhaustPile へ / それ以外 discardPile へ
    type==='attack' なら attacksPlayedThisTurn++
    checkBattleEnd()

endPlayerTurn():
    reflect が立っていれば 残block値のダメージを全敵に → reflectPending = 0
    手札を全て discardPile へ（保持効果は今作では無し）
    phase = 'ENEMY' → enemyTurn()

enemyTurn():
    生存する敵ごとに:
        intent を実行(attack / block / buff / debuff)
        自分の weak / vulnerable を 1 減少
    全敵のターン終了時効果: bleed スタック分のダメージを敵自身に(block無視)
    checkBattleEnd()
    turn++ → startPlayerTurn()

checkBattleEnd():
    敵が全滅 → phase='WIN' → 報酬へ(Phase 6。Phase 2 では「勝利」表示のみ)
    プレイヤーHP <= 0 → phase='LOSE' → ゲームオーバー画面
```

---

## 3. ダメージ計算(仕様書2章)

```js
function calcDamage(base, attacker, defender){
  let v = base + (attacker.status.strength || 0);
  if (defender.status.vulnerable > 0) v *= 1.5;
  if (attacker.status.weak > 0)       v *= 0.75;
  return Math.floor(v);
}
```
- **力は ATTACK カード(`type:'attack'`)の damage / damageMulti にのみ乗る**。
  DEBUFF カードの小ダメージ・出血・反射には乗らない
- `damageMulti` は **1ヒットごとに個別計算**(切り捨ても毎回)
- 敵の攻撃も同じ式。難易度倍率は Phase 4 で `value` 側に適用する

### ダメージ適用
```js
function dealDamageToEnemy(enemy, amount){
  const absorbed = Math.min(enemy.block, amount);
  enemy.block -= absorbed;
  enemy.hp -= (amount - absorbed);
  if (enemy.hp <= 0) { enemy.hp = 0; enemy.alive = false; }
}

function dealDamageToPlayer(amount){
  if (B.evade > 0) { B.evade--; log('回避!'); return; }      // 攻撃1回まるごと無効
  const absorbed = Math.min(B.block, amount);
  B.block -= absorbed;
  G.run.hp -= (amount - absorbed);
  if (B.counter > 0) { /* 反撃: 攻撃してきた敵に counter ダメージ、counter=0 */ }
}
```
- `evade` は「攻撃1回」を無効化。`攻撃4×2` は 1ヒットのみ無効化する
- ブロック獲得は必ず `gainBlock(v)` 経由(Phase 3 の `blockBonus` を差し込むため)

### 状態異常
| 名称 | key | 効果 | 減衰 |
|---|---|---|---|
| 弱体 | `weak` | 与ダメージ ×0.75 | 自ターン開始時 -1 |
| 脆弱 | `vulnerable` | 被ダメージ ×1.5 | 自ターン開始時 -1 |
| 出血 | `bleed` | 敵のターン終了時にスタック分ダメージ(ブロック無視) | 減衰しない |
| 力 | `strength` | ATTACKダメージ +スタック | 戦闘中永続 |

---

## 4. 戦闘UI

上から順に:
1. **敵エリア** … 名前 / HPバー / ブロック値 / 状態異常アイコン / **Intent 表示**
2. **プレイヤーステータス** … HPバー / ブロック / 状態異常 / 場のPower一覧
3. **Energy 表示**(`3/3` の丸バッジ)
4. **手札** … 横スクロールのカード列。使用不可カード(コスト不足)はグレーアウト
5. **ボタン** … 「ターン終了」/ 山札・捨て札の枚数表示(タップで中身確認)
6. **ログ**(直近5行、折りたたみ可)

### Intent 表示
| intent | アイコン | 表示 |
|---|---|---|
| attack | ⚔ | `⚔ 6`(複数回は `⚔ 4×2`)。表示値は倍率適用後の実ダメージ |
| block | 🛡 | `🛡 8` |
| buff | ⬆ | `⬆` |
| debuff | ⬇ | `⬇` |
| heal | ✚ | `✚ 5` |

### 対象選択
- `target:'single'` かつ敵が2体以上のとき、カードをタップ → 敵をタップ で確定
- 敵1体なら自動選択(タップ1回で発動)
- `target:'all'` / `'self'` は即発動

---

## 5. Phase 2 で動くべきカード

BASIC 8枚のみ: `atk_punch` `atk_double_punch` `skl_sidestep` `skl_dash`
`dbf_feint` `dbf_sharp_gaze` `pwr_guard` `pwr_brace`

→ effect type としては `damage` `damageMulti` `evade` `draw` `status` `block` `blockPerTurn` を実装すればよい。
残りの type は `resolveEffect()` の switch に **`default: console.warn('未実装', e.type)`** を置いて Phase 3 へ回す。

## 6. デバッグ用

`?debug=1` で開いたときのみ、戦闘画面にデバッグパネルを出す:
- 「敵HP1にする」「Energy+10」「1枚引く」「勝利」ボタン
- 以降のフェーズの検証で使うので必ず入れる

---

## 7. 完了条件

- [ ] タイトルから通しでスライムモドキ1体との戦闘に入れる(暫定でMAP画面に「テスト戦闘」ボタンを置く)
- [ ] Energy 3 で始まり、コスト分だけ減る。0 でコスト1が使えない
- [ ] ターン終了でブロックが 0 になり、翌ターン手札が5枚に補充される
- [ ] 山札が尽きたら捨て札がシャッフルされて山札に戻る
- [ ] 「踏ん張り」使用後、次の2ターンの開始時にブロック+2される
- [ ] 「サイドステップ」使用ターンに敵の攻撃が完全に無効化される
- [ ] 「鋭い視線」で脆弱を付けた敵へのダメージが 1.5 倍になる(6 → 9)
- [ ] 敵HP0 で勝利画面、プレイヤーHP0 で敗北画面に遷移する
- [ ] 戦闘を10回連続で回してもコンソールエラーが出ない

## コミット

```
Phase 2: 戦闘コア(ターンフロー・Energy/Block・状態異常・ダメージ計算)を実装
```
