import type { Locale } from "../types";
import { DEFAULT_LOCALE } from "../constants";

export type TranslationKey =
  | "app.title"
  | "toolbar.file.new"
  | "toolbar.file.open"
  | "toolbar.file.save"
  | "toolbar.insert"
  | "toolbar.format.bold"
  | "toolbar.format.italic"
  | "toolbar.format.link"
  | "toolbar.format.code"
  | "toolbar.format.quote"
  | "mode.write"
  | "mode.split"
  | "mode.read"
  | "settings.open"
  | "settings.theme"
  | "settings.theme.light"
  | "settings.theme.dark"
  | "settings.zoom"
  | "settings.zoom.out"
  | "settings.zoom.in"
  | "settings.autocomplete"
  | "settings.trigger"
  | "settings.language"
  | "sidebar.toggle"
  | "drawer.openDocuments"
  | "drawer.documents"
  | "drawer.outline"
  | "drawer.shortcuts"
  | "drawer.localDraft"
  | "outline.empty"
  | "autocomplete.title"
  | "dialog.close.title"
  | "dialog.close.message"
  | "dialog.reload.title"
  | "dialog.reload.message"
  | "dialog.reload.confirm"
  | "dialog.reload.keep"
  | "dialog.cancel"
  | "dialog.discard"
  | "dialog.save"
  | "find.placeholder"
  | "find.replace.placeholder"
  | "find.matchCase"
  | "find.matchWholeWord"
  | "find.matchRegex"
  | "find.invalidRegex"
  | "find.previous"
  | "find.next"
  | "find.replace"
  | "find.replaceAll"
  | "find.close"
  | "find.toggleReplace.open"
  | "find.toggleReplace.close"
  | "find.result"
  | "find.result.none"
  | "state.draftSaved"
  | "state.unsaved"
  | "state.saved"
  | "state.reloaded"
  | "state.openFailed"
  | "state.saveFailed"
  | "state.imageNeedsSavedFile"
  | "state.imageInserted"
  | "state.imageInsertFailed"
  | "state.assetsCleaned"
  | "state.assetsCleanFailed"
  | "stats.words"
  | "stats.chars"
  | "stats.lines";

export type LocaleDictionary = Record<TranslationKey, string>;

export const translations: Record<Locale, LocaleDictionary> = {
  en: {
    "app.title": "Light Markdown Editor",
    "toolbar.file.new": "New",
    "toolbar.file.open": "Open",
    "toolbar.file.save": "Save",
    "toolbar.insert": "Insert",
    "toolbar.format.bold": "Bold",
    "toolbar.format.italic": "Italic",
    "toolbar.format.link": "Link",
    "toolbar.format.code": "Code",
    "toolbar.format.quote": "Quote",
    "mode.write": "Write",
    "mode.split": "Split",
    "mode.read": "Read",
    "settings.open": "Settings",
    "settings.theme": "Theme",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.zoom": "Zoom",
    "settings.zoom.out": "Zoom out document",
    "settings.zoom.in": "Zoom in document",
    "settings.autocomplete": "Autocomplete",
    "settings.trigger": "Trigger",
    "settings.language": "Language",
    "sidebar.toggle": "Toggle documents",
    "drawer.openDocuments": "Open Documents",
    "drawer.documents": "Documents",
    "drawer.outline": "Outline",
    "drawer.shortcuts": "Shortcuts",
    "drawer.localDraft": "Local draft",
    "outline.empty": "No headings yet",
    "autocomplete.title": "Markdown Syntax",
    "dialog.close.title": "Save changes before closing?",
    "dialog.close.message": '"{name}" has unsaved changes. Save before closing?',
    "dialog.reload.title": "File changed on disk",
    "dialog.reload.message": '"{name}" was modified externally. Reload and discard your unsaved changes?',
    "dialog.reload.confirm": "Reload",
    "dialog.reload.keep": "Keep mine",
    "dialog.cancel": "Cancel",
    "dialog.discard": "Don't Save",
    "dialog.save": "Save",
    "find.placeholder": "Find",
    "find.replace.placeholder": "Replace with",
    "find.matchCase": "Match case",
    "find.matchWholeWord": "Match whole word",
    "find.matchRegex": "Use regular expression",
    "find.invalidRegex": "Invalid regular expression",
    "find.previous": "Previous",
    "find.next": "Next",
    "find.replace": "Replace",
    "find.replaceAll": "Replace All",
    "find.close": "Close",
    "find.toggleReplace.open": "Replace",
    "find.toggleReplace.close": "Hide Replace",
    "find.result": "{current}/{total}",
    "find.result.none": "No matches",
    "state.draftSaved": "Draft saved locally",
    "state.unsaved": "Unsaved changes",
    "state.saved": "Saved",
    "state.reloaded": "Reloaded from disk",
    "state.openFailed": "Could not open file",
    "state.saveFailed": "Could not save file",
    "state.imageNeedsSavedFile": "Save the document first to insert images into assets",
    "state.imageInserted": "Inserted image: {name}",
    "state.imageInsertFailed": "Could not insert image",
    "state.assetsCleaned": "Moved {count} unused assets to Trash",
    "state.assetsCleanFailed": "Could not clean unused assets",
    "stats.words": "words",
    "stats.chars": "chars",
    "stats.lines": "lines"
  },
  zh: {
    "app.title": "轻量 Markdown 编辑器",
    "toolbar.file.new": "新建",
    "toolbar.file.open": "打开",
    "toolbar.file.save": "保存",
    "toolbar.insert": "插入",
    "toolbar.format.bold": "加粗",
    "toolbar.format.italic": "斜体",
    "toolbar.format.link": "链接",
    "toolbar.format.code": "代码",
    "toolbar.format.quote": "引用",
    "mode.write": "编辑",
    "mode.split": "分栏",
    "mode.read": "阅读",
    "settings.open": "设置",
    "settings.theme": "主题",
    "settings.theme.light": "明亮",
    "settings.theme.dark": "暗黑",
    "settings.zoom": "缩放",
    "settings.zoom.out": "缩小文档",
    "settings.zoom.in": "放大文档",
    "settings.autocomplete": "自动完成",
    "settings.trigger": "触发键",
    "settings.language": "语言",
    "sidebar.toggle": "切换文档列表",
    "drawer.openDocuments": "已打开文档",
    "drawer.documents": "文档",
    "drawer.outline": "大纲",
    "drawer.shortcuts": "快捷键",
    "drawer.localDraft": "本地草稿",
    "outline.empty": "暂无标题",
    "autocomplete.title": "Markdown 语法",
    "dialog.close.title": "关闭前保存更改？",
    "dialog.close.message": "“{name}” 有未保存更改，是否先保存？",
    "dialog.reload.title": "文件已在外部修改",
    "dialog.reload.message": "“{name}” 在外部被修改。是否重新载入并丢弃当前未保存的更改？",
    "dialog.reload.confirm": "重新载入",
    "dialog.reload.keep": "保留当前",
    "dialog.cancel": "取消",
    "dialog.discard": "不保存",
    "dialog.save": "保存",
    "find.placeholder": "查找",
    "find.replace.placeholder": "替换为",
    "find.matchCase": "区分大小写",
    "find.matchWholeWord": "全词匹配",
    "find.matchRegex": "使用正则表达式",
    "find.invalidRegex": "正则表达式无效",
    "find.previous": "上一个",
    "find.next": "下一个",
    "find.replace": "替换",
    "find.replaceAll": "全部替换",
    "find.close": "关闭",
    "find.toggleReplace.open": "替换",
    "find.toggleReplace.close": "收起",
    "find.result": "{current}/{total}",
    "find.result.none": "无匹配",
    "state.draftSaved": "草稿已保存到本地",
    "state.unsaved": "有未保存更改",
    "state.saved": "已保存",
    "state.reloaded": "已从磁盘重新载入",
    "state.openFailed": "打开文件失败",
    "state.saveFailed": "保存文件失败",
    "state.imageNeedsSavedFile": "请先保存当前文档，再插入图片到 assets",
    "state.imageInserted": "已插入图片：{name}",
    "state.imageInsertFailed": "插入图片失败",
    "state.assetsCleaned": "已将 {count} 个未引用资源移到回收站",
    "state.assetsCleanFailed": "清理未引用资源失败",
    "stats.words": "词",
    "stats.chars": "字符",
    "stats.lines": "行"
  },
  ja: {
    "app.title": "ライト Markdown エディタ",
    "toolbar.file.new": "新規",
    "toolbar.file.open": "開く",
    "toolbar.file.save": "保存",
    "toolbar.insert": "挿入",
    "toolbar.format.bold": "太字",
    "toolbar.format.italic": "斜体",
    "toolbar.format.link": "リンク",
    "toolbar.format.code": "コード",
    "toolbar.format.quote": "引用",
    "mode.write": "編集",
    "mode.split": "分割",
    "mode.read": "閲覧",
    "settings.open": "設定",
    "settings.theme": "テーマ",
    "settings.theme.light": "ライト",
    "settings.theme.dark": "ダーク",
    "settings.zoom": "ズーム",
    "settings.zoom.out": "ズームアウト",
    "settings.zoom.in": "ズームイン",
    "settings.autocomplete": "自動補完",
    "settings.trigger": "トリガー",
    "settings.language": "言語",
    "sidebar.toggle": "ドキュメント一覧の切替",
    "drawer.openDocuments": "開いているドキュメント",
    "drawer.documents": "ドキュメント",
    "drawer.outline": "アウトライン",
    "drawer.shortcuts": "ショートカット",
    "drawer.localDraft": "ローカル下書き",
    "outline.empty": "見出しがありません",
    "autocomplete.title": "Markdown 構文",
    "dialog.close.title": "閉じる前に保存しますか？",
    "dialog.close.message": "「{name}」に未保存の変更があります。保存して閉じますか？",
    "dialog.reload.title": "ファイルが外部で変更されました",
    "dialog.reload.message": "「{name}」は外部で変更されました。未保存の変更を破棄して再読み込みしますか？",
    "dialog.reload.confirm": "再読み込み",
    "dialog.reload.keep": "現状を維持",
    "dialog.cancel": "キャンセル",
    "dialog.discard": "保存しない",
    "dialog.save": "保存",
    "find.placeholder": "検索",
    "find.replace.placeholder": "置換",
    "find.matchCase": "大文字/小文字を区別",
    "find.matchWholeWord": "単語単位で一致",
    "find.matchRegex": "正規表現を使用",
    "find.invalidRegex": "正規表現が無効です",
    "find.previous": "前へ",
    "find.next": "次へ",
    "find.replace": "置換",
    "find.replaceAll": "すべて置換",
    "find.close": "閉じる",
    "find.toggleReplace.open": "置換",
    "find.toggleReplace.close": "折りたたむ",
    "find.result": "{current}/{total}",
    "find.result.none": "一致なし",
    "state.draftSaved": "下書きをローカルに保存しました",
    "state.unsaved": "未保存の変更",
    "state.saved": "保存済み",
    "state.reloaded": "ディスクから再読み込みしました",
    "state.openFailed": "ファイルを開けませんでした",
    "state.saveFailed": "ファイルを保存できませんでした",
    "state.imageNeedsSavedFile": "画像を assets に保存するには先にドキュメントを保存してください",
    "state.imageInserted": "画像を挿入しました: {name}",
    "state.imageInsertFailed": "画像を挿入できませんでした",
    "state.assetsCleaned": "未使用アセット {count} 件をゴミ箱へ移動しました",
    "state.assetsCleanFailed": "未使用アセットをクリーンできませんでした",
    "stats.words": "語",
    "stats.chars": "文字",
    "stats.lines": "行"
  }
};

export function translate(locale: Locale, key: TranslationKey): string {
  const dictionary = translations[locale] ?? translations[DEFAULT_LOCALE];
  return dictionary[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
}

export function formatMessage(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, value);
  }, template);
}

export function isSupportedLocale(value: string | null): value is Locale {
  return value === "zh" || value === "ja" || value === "en";
}
