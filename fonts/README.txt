【フォント同梱について】
koyomi.html は @font-face で以下のファイルを参照します（無くてもシステム明朝/等幅に自動フォールバックします）。
完全オフラインで意図どおりの見た目にするには、下記 woff2 をこのフォルダに置いてください。
（koyomi.html は assets 直下なので、この fonts/ フォルダは相対パス "fonts/..." で解決されます）

  ShipporiMincho-Regular.woff2   (weight 400)
  ShipporiMincho-Medium.woff2    (weight 500)
  ShipporiMincho-SemiBold.woff2  (weight 600)
  ShipporiMincho-Bold.woff2      (weight 700)
  ShipporiMincho-ExtraBold.woff2 (weight 800)
  SpaceMono-Regular.woff2        (weight 400)
  SpaceMono-Bold.woff2           (weight 700)

入手元（SIL Open Font License 1.1・商用可・要ライセンス表示）:
  Shippori Mincho : Google Fonts / GitHub (fontworks) → TTF を woff2 に変換
  Space Mono      : Google Fonts (Colophon Foundry)   → TTF を woff2 に変換

TTF→woff2 変換例:
  pip install fonttools brotli
  fonttools ttLib.woff2 compress ShipporiMincho-Regular.ttf

※ OFL のフォントを同梱する場合、アプリ内(ヘルプ等)かストア記載にライセンス表示を入れてください。
