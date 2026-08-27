# 実装計画 — 筋トレ融合ローグライク(HTML版)

## 成果物

- `index.html` … **単一ファイル完結**のゲーム本体(HTML + CSS + Vanilla JS、ビルド不要、外部依存なし)
- `docs/spec-master.md` … 元の完全仕様書(正典)
- `docs/phase-*.md` … 各フェーズの実装指示書

ブラウザで `index.html` を開くだけで遊べること。CDN・npm・ビルドツールは一切使わない。

## 進め方(重要)

1. **1フェーズ = 1コミット**。フェーズを跨いだまとめコミットは禁止
2. 各フェーズは必ず「完了条件」を満たしてからコミットする
3. **各フェーズ終了時点で `index.html` は常に単体で動く**こと(未実装部分はプレースホルダ画面で逃がす)
4. 前フェーズで確定した関数名・データ構造は勝手に改名しない。変更が必要なら理由をコミットメッセージに書く
5. フェーズ指示書と `spec-master.md` が矛盾したら**フェーズ指示書を優先**

## フェーズ一覧

| Phase | 内容 | 完了時に遊べるもの |
|---|---|---|
| [0](phase-0-foundation.md) | 土台・データ定義・画面遷移・セーブ | タイトル→各画面のスケルトン遷移 |
| [1](phase-1-exercise-input.md) | 運動入力 → デッキ生成、難易度選択 | 回数を入れると生成デッキ一覧が見られる |
| [2](phase-2-battle-core.md) | 戦闘コア(ターン/Energy/Block/状態異常) | Basicカードだけで1戦闘が完結する |
| [3](phase-3-cards.md) | 全36枚のカード効果・Power・Exhaust | 全カードが正しく機能する戦闘 |
| [4](phase-4-enemies.md) | 敵AI・Intent表示・エリート・ボス | 通常敵/エリート/ボス戦が成立 |
| [5](phase-5-map.md) | STS型分岐マップ生成と踏破 | マップを進んで戦闘が連続する |
| [6](phase-6-nodes-rewards.md) | 報酬・ショップ・休憩・イベント・宝箱 | 1ランを最後まで通してクリアできる |
| [7](phase-7-relics.md) | レリック(パッシブ) | レリックが戦闘に影響する |
| [8](phase-8-meta.md) | 永続進行(筋力コア・アンロック・強化) | 日を跨いで強くなる |
| [9](phase-9-difficulty-polish.md) | 「むずい」実装・バランス・演出・仕上げ | 完成 |

## 全体アーキテクチャ(Phase 0 で確定、以降不変)

```
index.html
├── <style>            … 全CSS(CSS変数でテーマ色を定義)
├── <div id="app">     … 唯一のマウントポイント
└── <script>
    ├── SECTION: DATA      … CARDS / ENEMIES / RELICS / EVENTS / DIFFICULTY / NODE_WEIGHTS
    ├── SECTION: STATE     … G(グローバル状態)、save/load
    ├── SECTION: UTIL      … rng, weightedPick, shuffle, clamp, el()
    ├── SECTION: BATTLE    … 戦闘ロジック
    ├── SECTION: MAP       … マップ生成
    ├── SECTION: SCREENS   … 画面ごとの render 関数
    └── SECTION: BOOT      … 初期化
```

`SECTION:` コメントで区切り、新規コードは必ず該当セクション内に書く。

## 命名規約

- 定数: `UPPER_SNAKE`
- 関数: `camelCase`、画面描画は `renderXxx()`
- カードID: `atk_* / skl_* / dbf_* / pwr_*`
- 敵ID: `slime_fake` / `elite_*` / `boss_*`
- レリックID: `rel_*`
- CSSクラス: `.mr-*` プレフィックス
