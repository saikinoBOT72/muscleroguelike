# Phase 0 — 土台・データ定義・画面遷移・セーブ

## 目的

以降の全フェーズが乗る骨格を作る。**ゲームロジックはまだ書かない**。
データ定義をここで全部済ませておくことで、Phase 3 以降は「解決処理を書くだけ」にする。

## 成果物

`index.html` を新規作成。単一ファイル、外部依存ゼロ。

---

## 1. ファイル骨格

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>筋トレローグライク</title>
<style>/* SECTION: STYLE */</style>
</head>
<body>
<div id="app"></div>
<script>
// SECTION: UTIL
// SECTION: DATA
// SECTION: STATE
// SECTION: SCREENS
// SECTION: BOOT
</script>
</body>
</html>
```

### スタイル方針
- ダークテーマ固定。CSS変数で色を定義する
  ```
  --bg:#14161c; --panel:#1e222c; --line:#333a48; --text:#e8ecf2; --dim:#8b93a5;
  --atk:#e2574c; --skl:#4caf7d; --dbf:#a86fd6; --pwr:#4a90d9;
  --hp:#d0453c; --block:#5a9fd4; --energy:#e8c34a; --gold:#e8c34a;
  ```
- スマホ縦持ち優先(`max-width:480px` の中央寄せコンテナ)。PCでも崩れないこと
- カードはCSSのみで描画(画像・アイコン画像は使わない。絵文字は可)

---

## 2. UTIL(必須ユーティリティ)

```js
const rnd    = (n) => Math.floor(Math.random() * n);        // 0..n-1
const pick   = (arr) => arr[rnd(arr.length)];
const range  = (min, max) => min + rnd(max - min + 1);      // 両端含む
const shuffle = (arr) => { /* Fisher-Yates、新配列を返す */ };
const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const weightedPick = (entries) => { /* [{v, w}] から w 重みで1つ返す */ };
const el = (tag, cls, html) => { /* 要素生成ヘルパ */ };
const fmt = (n) => String(n);
```

---

## 3. DATA — カード定義(全37枚)

`CARDS` を **id をキーにしたオブジェクト**で定義する。

### スキーマ
```js
{
  id: 'atk_punch',
  name: 'パンチ',
  cat: 'ATTACK',            // ATTACK / SKILL / DEBUFF / POWER
  rarity: 'BASIC',          // BASIC / COMMON / UNCOMMON / RARE
  cost: 1,
  type: 'attack',           // attack / skill / power
  target: 'single',         // single / all / self
  exhaust: false,
  keep: false,              // true = 使用後フィールドに残る【Power】カード
  effects: [ {type:'damage', value:6} ],
  up: { effects:[{type:'damage', value:9}] }    // Upgrade(+) の差分(effects全置換)
}
```

> カードの説明文は持たせない。**`effects` から動的に生成する**(Phase 3 の `cardDisplayText()`)。
> 力・脆弱・完全防御・使用済ATTACK枚数を反映した実数値を表示するため、静的な文面だと必ずずれる。

### effect.type の一覧(Phase 3 で解決処理を実装)
| type | フィールド | 意味 |
|---|---|---|
| `damage` | value | 単発ダメージ |
| `damageMulti` | value, times | value ダメージ × times 回 |
| `block` | value | ブロック獲得 |
| `draw` | value | カードを引く |
| `energy` | value | Energy 追加 |
| `status` | key(`weak`/`vulnerable`/`bleed`), value | 対象に付与 |
| `strength` | value | 自分に力を付与 |
| `evade` | value | 回避フラグを value ターン付与 |
| `counter` | value | 反撃態勢(1回、value ダメージ) |
| `blockPerTurn` | value, turns | turns ターンの間、ターン開始時 block 獲得(0=永続) |
| `reflect` | — | ターン終了時、残ブロック値を敵に反射(このターンのみ) |
| `blockOnPower` | value | 【Power】POWERカード使用のたび block |
| `blockBonus` | value | 【Power】ブロック獲得のたび +value |
| `keepBlock` | — | 以降ブロックがターン終了時に消えない |
| `damagePerAttackPlayed` | base, per | base + (このターン使用済ATTACK枚数 × per) |
| `damagePerAttackInHand` | base, per | base + (手札のATTACK枚数 × per) |

### 3.1 ATTACK(胸コア / 腕立て伏せ由来)

| id | 名前 | cost | rarity | effects | up |
|---|---|---|---|---|---|
| `atk_punch` | パンチ | 1 | BASIC | damage 6 | damage 9 |
| `atk_double_punch` | ダブルパンチ | 1 | BASIC | damageMulti 3×2 | 4×2 |
| `atk_body_blow` | ボディブロー | 1 | COMMON | damage 8 | damage 11 |
| `atk_hook` | フック | 1 | COMMON | damage 10 | damage 14 |
| `atk_rush` | ラッシュ | 2 | COMMON | damageMulti 6×2 | 8×2 |
| `atk_uppercut` | アッパーカット | 2 | UNCOMMON | damage 12, status weak 1 | 16 / weak 2 |
| `atk_barrage` | 連続殴打 | 2 | UNCOMMON | damageMulti 5×3 | 7×3 |
| `atk_heavy_blow` | ヘビーブロー | 2 | UNCOMMON | damage 14, **exhaust:true** | damage 18(exhaustは維持) |
| `atk_finish_blow` | フィニッシュブロー | 3 | RARE | damagePerAttackPlayed base8 per4 | base12 per6 |
| `atk_fist_dance` | 拳打乱舞 | 1 | RARE | damagePerAttackInHand base4 per2 | base6 per3 |

### 3.2 SKILL(脚コア / ジャンプスクワット由来)

| id | 名前 | cost | rarity | effects | up |
|---|---|---|---|---|---|
| `skl_sidestep` | サイドステップ | 0 | BASIC | evade 1 | evade 2 |
| `skl_dash` | ダッシュ | 1 | BASIC | draw 1 | draw 2 |
| `skl_footwork` | フットワーク | 1 | COMMON | energy 1, **exhaust:true** | exhaust:false |
| `skl_agility` | 俊敏 | 1 | COMMON | draw 2 | draw 3 |
| `skl_backstep` | バックステップ | 1 | COMMON | block 8 | block 11 |
| `skl_double_jump` | 二段跳び | 1 | UNCOMMON | energy 1, draw 1 | energy 1, draw 2 |
| `skl_counter_stance` | カウンター体勢 | 1 | UNCOMMON | counter 5 | counter 8 |
| `skl_sprint` | 疾走 | 0 | RARE | draw 2, **exhaust:true** | exhaust:false |
| `skl_lightning` | 電光石火 | 1 | RARE | energy 2, draw 2, **exhaust:true** | energy 3, draw 2 |

### 3.3 DEBUFF(捻転コア / ツイストレッグレイズ由来)

| id | 名前 | cost | rarity | target | effects | up |
|---|---|---|---|---|---|---|
| `dbf_feint` | フェイント | 1 | BASIC | single | status weak 1 | weak 2 |
| `dbf_sharp_gaze` | 鋭い視線 | 1 | BASIC | single | status vulnerable 1 | vulnerable 2 |
| `dbf_bleed_strike` | 出血の一撃 | 1 | COMMON | single | damage 4, bleed 2 | 6 / bleed 3 |
| `dbf_weaken_form` | 弱体化の型 | 1 | COMMON | **all** | weak 1 | weak 2 |
| `dbf_taunt` | 挑発 | 1 | COMMON | **all** | vulnerable 1 | vulnerable 2 |
| `dbf_curse` | 呪縛 | 1 | UNCOMMON | single | weak 2, vulnerable 1 | weak 2, vulnerable 2 |
| `dbf_finishing_thrust` | トドメの一突き | 2 | UNCOMMON | single | damage 8, bleed 3, vulnerable 1 | 10 / bleed 4 / vuln 2 |
| `dbf_mass_break` | 全体崩し | 2 | RARE | **all** | vulnerable 2, weak 2 | vuln 3, weak 3 |
| `dbf_erode` | 蝕む一撃 | 1 | RARE | single | damage 2, bleed 5 | bleed 7 |

### 3.4 POWER(体幹コア / プランク由来)

| id | 名前 | cost | rarity | keep | effects | up |
|---|---|---|---|---|---|---|
| `pwr_guard` | ガード | 1 | BASIC | – | block 7 | block 10 |
| `pwr_brace` | 踏ん張り | 1 | BASIC | – | block 5, blockPerTurn 2×2turns | block 5, 3×3turns |
| `pwr_iron_stance` | 鉄壁の構え | 2 | COMMON | – | block 12 | block 16 |
| `pwr_repel` | 反発 | 1 | COMMON | – | block 6, reflect | block 9 |
| `pwr_lasting_strength` | 継続する強さ【Power】 | 1 | COMMON | ✓ | blockPerTurn 3×0(永続) | 4 |
| `pwr_endurance` | 忍耐【Power】 | 1 | UNCOMMON | ✓ | blockOnPower 2 | 3 |
| `pwr_immovable` | 不動の心【Power】 | 2 | UNCOMMON | ✓ | strength 2 | 3 |
| `pwr_perfect_defense` | 完全防御【Power】 | 2 | RARE | ✓ | blockBonus 2 | 3 |
| `pwr_diamond_stance` | 金剛の構え | 3 | RARE | – | block 20, keepBlock | block 25 |

> `keep:true` のカードは使用後 `battle.powers[]` に移し、DiscardPile に入れない。

---

## 4. DATA — 敵定義

```js
{
  id:'slime_fake', name:'スライムモドキ', tier:'NORMAL',   // NORMAL/ELITE/BOSS
  hpMin:18, hpMax:22,
  phases:[
    { hpThreshold:1.0, loop:true, pattern:[
        {intent:'attack', value:6},
        {intent:'attack', value:6, status:{weak:1}}
    ]}
  ]
}
```

| id | 名前 | tier | HP | パターン |
|---|---|---|---|---|
| `slime_fake` | スライムモドキ | NORMAL | 18–22 | 攻6 → 攻6+weak1(ループ) |
| `spike_rat` | トゲネズミ | NORMAL | 12–15 | 攻4×2 固定(毎ターン) |
| `wander_golem` | 徘徊ゴーレム | NORMAL | 25–30 | 攻10 → ブロック8(ループ) |
| `bat_swarm` | コウモリの群れ | NORMAL | 15–18 | 攻3×3 固定 |
| `shadow_scout` | 影の斥候 | NORMAL | 20–24 | 重み抽選 攻8:70% / 自己回復5:30% |
| `elite_heavy_soldier` | 重装兵 | ELITE | 45 | 攻12 → ブロック15+力+2(ループ) |
| `elite_twin_shadows` | 双子の影 | ELITE | 28×2体 | 攻6 → vulnerable1(交互)。片方死亡で残りに力+3 |
| `boss_overload_warden` | 過負荷の番人 | BOSS | 80 | P1(HP>50%): 全体vuln1 → 攻14(ループ) / P2: 攻18、3ターンごとに自己回復10 |
| `boss_sloth_colossus` | 怠惰の巨像 | BOSS | 90 | P1: 毎ターン力+1 & 攻8+力 / P2(HP≤50%): 突入時 力+3 即時、以降 攻8+力 |

Phase 0 では**定義を置くだけ**。AI実行は Phase 4。

---

## 5. DATA — レリック / 難易度 / マップ重み

### RELICS(定義のみ、効果は Phase 7)
| id | 名前 | 効果 | 入手 |
|---|---|---|---|
| `rel_training_proof` | 鍛錬の証 | 戦闘開始時 力+1 | ELITE撃破 |
| `rel_unyielding_plate` | 不屈のプレート | 戦闘開始時 ブロック+5 | TREASURE |
| `rel_accelerator` | 加速装置 | 戦闘の最初のターンのみ Energy+1 | SHOP |
| `rel_grudge_record` | 執念の記録 | 出血ダメージ +50% | EVENT(DEBUFF5枚以上) |
| `rel_battle_wisdom` | 継戦の心得 | POWERカードのコスト -1(最低0) | BOSS撃破 |
| `rel_sweat_crystal` | 汗の結晶 | 戦闘勝利時 ゴールド+10 | SHOP |

### DIFFICULTY(値の適用は各フェーズ、定義はここ)
```js
const DIFFICULTY = {
  NORMAL: { key:'NORMAL', label:'ふつう', playerMaxHp:70,
            enemyHpMult:1.0,  enemyDmgMult:1.0, enemyStartStrength:{NORMAL:0,ELITE:0,BOSS:0},
            shopPriceMult:1.0, restHealRate:0.30, bossPhase2:0.50,
            goldMult:1.0, coreMult:1.0, rareWeightBonus:0 },
  HARD:   { key:'HARD',   label:'むずい', playerMaxHp:60,
            enemyHpMult:1.25, enemyDmgMult:1.25, enemyStartStrength:{NORMAL:1,ELITE:2,BOSS:2},
            shopPriceMult:1.25, restHealRate:0.20, bossPhase2:0.60,
            goldMult:1.2, coreMult:1.2, rareWeightBonus:3 }
};
```

### NODE_WEIGHTS
```js
const NODE_WEIGHTS = {
  NORMAL: [{v:'COMBAT',w:45},{v:'EVENT',w:22},{v:'REST',w:12},
           {v:'SHOP',w:8},{v:'ELITE',w:8},{v:'TREASURE',w:5}],
  HARD:   [{v:'COMBAT',w:48},{v:'EVENT',w:20},{v:'REST',w:8},
           {v:'SHOP',w:7},{v:'ELITE',w:13},{v:'TREASURE',w:4}]
};
```

---

## 6. STATE — グローバル状態

```js
const G = {
  screen: 'TITLE',
  meta: {              // localStorage に永続化
    cores: { chest:0, leg:0, core:0, twist:0 },
    unlocked: [],      // アンロック済カードID
    upgradedBasics: [],// Upgrade版に差し替え済のBASIC ID
    unlockedRelics: [],
    clearedHard: false,
    lastPlayDate: null
  },
  run: null,           // ラン中のみ非null
  battle: null         // 戦闘中のみ非null
};
```

```js
// run の形
{
  difficulty:'NORMAL',
  hp:70, maxHp:70, gold:99,
  deck:[ {uid:1, id:'atk_punch', upgraded:false}, ... ],  // uid でインスタンス識別
  relics:[],
  map:null, currentRow:-1, currentCol:null, visited:[],
  exercise:{ pushup:0, jumpSquat:0, twistLegRaise:0, plankSeconds:0 },
  removeCost:75
}
```

> **重要**: デッキのカードは「ID文字列」ではなく `{uid, id, upgraded}` のインスタンス。
> 除去・強化を個別に扱うため。`uid` は `run.nextUid++` で採番。

### セーブ
- `localStorage['mrog_save_v1']` に `{meta, run}` を JSON 保存
- `saveGame()` / `loadGame()` を実装。**状態が変わる操作のたびに `saveGame()` を呼ぶ**
- 戦闘中(`battle`)は保存対象外(戦闘途中の中断は Phase 9 で検討、Phase 0 では非対応)
- パース失敗時は初期状態にフォールバックし、壊れたセーブを破棄

---

## 7. SCREENS — 画面遷移スケルトン

```js
const SCREENS = {
  TITLE, EXERCISE, MAP, BATTLE, REWARD, SHOP, REST, EVENT, TREASURE, META, GAMEOVER, VICTORY
};
function go(screen){ G.screen = screen; render(); }
function render(){ /* #app を空にして renderXxx() を呼ぶ */ }
```

Phase 0 時点の中身:
- `renderTitle()` … タイトル、「ラン開始」「強化所」ボタン、所持コア表示
- 他は全て **「Phase N で実装」と表示するプレースホルダ + 戻るボタン** でよい
- 共通ヘッダ(HP / ゴールド / レリック欄)を `renderHud()` として作り、ラン中の画面で使い回す

---

## 8. 完了条件

- [ ] `index.html` をブラウザで開くとタイトル画面が表示される
- [ ] 「ラン開始」→ EXERCISE(プレースホルダ)→ 戻る、が動く
- [ ] コンソールに `Object.keys(CARDS).length` → **37**
      (ATTACK 10 / SKILL 9 / DEBUFF 9 / POWER 9)
- [ ] コンソールに `Object.keys(ENEMIES).length` → **10**
      (敵は9種だが、双子の影を `elite_twin_shadow_a` / `_b` の2定義に分割しているため)
- [ ] `saveGame()` 後にリロードして `G.meta` が復元される
- [ ] スマホ幅(375px)とPC幅の両方でレイアウトが崩れない
- [ ] エラー・警告がコンソールに出ない

## このフェーズで触らないもの

戦闘ロジック、マップ生成、カード効果解決、敵AI。**データを置くだけ**に徹する。

## コミット

```
Phase 0: 単一HTMLの土台・全データ定義・画面遷移・セーブを実装
```
