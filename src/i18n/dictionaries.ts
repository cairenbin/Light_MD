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
  | "drawer.shortcuts"
  | "drawer.localDraft"
  | "autocomplete.title"
  | "dialog.close.title"
  | "dialog.close.message"
  | "dialog.cancel"
  | "dialog.discard"
  | "dialog.save"
  | "find.placeholder"
  | "find.replace.placeholder"
  | "find.matchCase"
  | "find.matchWholeWord"
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
  | "state.openFailed"
  | "state.saveFailed"
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
    "drawer.shortcuts": "Shortcuts",
    "drawer.localDraft": "Local draft",
    "autocomplete.title": "Markdown Syntax",
    "dialog.close.title": "Save changes before closing?",
    "dialog.close.message": '"{name}" has unsaved changes. Save before closing?',
    "dialog.cancel": "Cancel",
    "dialog.discard": "Don't Save",
    "dialog.save": "Save",
    "find.placeholder": "Find",
    "find.replace.placeholder": "Replace with",
    "find.matchCase": "Match case",
    "find.matchWholeWord": "Match whole word",
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
    "state.openFailed": "Could not open file",
    "state.saveFailed": "Could not save file",
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
    "drawer.shortcuts": "快捷键",
    "drawer.localDraft": "本地草稿",
    "autocomplete.title": "Markdown 语法",
    "dialog.close.title": "关闭前保存更改？",
    "dialog.close.message": "“{name}” 有未保存更改，是否先保存？",
    "dialog.cancel": "取消",
    "dialog.discard": "不保存",
    "dialog.save": "保存",
    "find.placeholder": "查找",
    "find.replace.placeholder": "替换为",
    "find.matchCase": "区分大小写",
    "find.matchWholeWord": "全词匹配",
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
    "state.openFailed": "打开文件失败",
    "state.saveFailed": "保存文件失败",
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
    "drawer.shortcuts": "ショートカット",
    "drawer.localDraft": "ローカル下書き",
    "autocomplete.title": "Markdown 構文",
    "dialog.close.title": "閉じる前に保存しますか？",
    "dialog.close.message": "「{name}」に未保存の変更があります。保存して閉じますか？",
    "dialog.cancel": "キャンセル",
    "dialog.discard": "保存しない",
    "dialog.save": "保存",
    "find.placeholder": "検索",
    "find.replace.placeholder": "置換",
    "find.matchCase": "大文字/小文字を区別",
    "find.matchWholeWord": "単語単位で一致",
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
    "state.openFailed": "ファイルを開けませんでした",
    "state.saveFailed": "ファイルを保存できませんでした",
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
