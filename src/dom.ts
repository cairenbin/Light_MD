let appRoot: HTMLElement;

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = appRoot.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required element was not found: ${selector}`);
  }

  return element;
}

export let titleInput!: HTMLInputElement;
export let saveState!: HTMLSpanElement;
export let workspace!: HTMLElement;
export let topbar!: HTMLElement;
export let mainArea!: HTMLElement;
export let sidebarToggle!: HTMLButtonElement;
export let documentList!: HTMLUListElement;
export let editor!: HTMLTextAreaElement;
export let preview!: HTMLElement;
export let autocompletePanel!: HTMLDivElement;
export let autocompleteList!: HTMLUListElement;
export let formattingButtons!: {
  bold: HTMLButtonElement;
  italic: HTMLButtonElement;
  link: HTMLButtonElement;
  code: HTMLButtonElement;
  quote: HTMLButtonElement;
};
export let insertMenuButton!: HTMLButtonElement;
export let insertMenu!: HTMLDivElement;
export let settingsMenuButton!: HTMLButtonElement;
export let settingsMenu!: HTMLDivElement;
export let languageSelect!: HTMLSelectElement;
export let wordStat!: HTMLSpanElement;
export let charStat!: HTMLSpanElement;
export let lineStat!: HTMLSpanElement;
export let themeOptionButtons!: HTMLButtonElement[];
export let fontDecreaseButton!: HTMLButtonElement;
export let fontIncreaseButton!: HTMLButtonElement;
export let fontSizeLabel!: HTMLSpanElement;
export let shortcutSelect!: HTMLSelectElement;
export let documentCount!: HTMLSpanElement;
export let shortcutCopy!: HTMLParagraphElement;
export let dialogBackdrop!: HTMLDivElement;
export let confirmDialogMessage!: HTMLParagraphElement;
export let confirmCloseSaveButton!: HTMLButtonElement;
export let modeButtons!: HTMLButtonElement[];
export let fileActionButtons!: {
  new: HTMLButtonElement;
  open: HTMLButtonElement;
  save: HTMLButtonElement;
};
export let settingsGroupTitles!: HTMLHeadingElement[];
export let settingsFieldLabels!: HTMLSpanElement[];
export let drawerSectionTitle!: HTMLSpanElement;
export let drawerNoteTitle!: HTMLSpanElement;
export let autocompleteTitle!: HTMLDivElement;
export let confirmDialogTitle!: HTMLHeadingElement;
export let confirmCloseCancelButton!: HTMLButtonElement;
export let confirmCloseDiscardButton!: HTMLButtonElement;
export let findPanel!: HTMLDivElement;
export let findInput!: HTMLInputElement;
export let replaceInput!: HTMLInputElement;
export let findStatus!: HTMLSpanElement;
export let replaceRow!: HTMLDivElement;
export let findMatchCaseButton!: HTMLButtonElement;
export let findMatchWordButton!: HTMLButtonElement;
export let findPrevButton!: HTMLButtonElement;
export let findNextButton!: HTMLButtonElement;
export let findCloseButton!: HTMLButtonElement;
export let findToggleReplaceButton!: HTMLButtonElement;
export let findReplaceButton!: HTMLButtonElement;
export let findReplaceAllButton!: HTMLButtonElement;

export function initDom(app: HTMLElement): void {
  appRoot = app;

  titleInput = requireElement<HTMLInputElement>(".title-input");
  saveState = requireElement<HTMLSpanElement>(".save-state");
  workspace = requireElement<HTMLElement>(".workspace");
  topbar = requireElement<HTMLElement>(".topbar");
  mainArea = requireElement<HTMLElement>(".main-area");
  sidebarToggle = requireElement<HTMLButtonElement>(".sidebar-toggle");
  documentList = requireElement<HTMLUListElement>(".document-list");
  editor = requireElement<HTMLTextAreaElement>(".editor");
  preview = requireElement<HTMLElement>(".preview");
  autocompletePanel = requireElement<HTMLDivElement>(".autocomplete-panel");
  autocompleteList = requireElement<HTMLUListElement>(".autocomplete-list");
  formattingButtons = {
    bold: requireElement<HTMLButtonElement>("[data-action='format-bold']"),
    italic: requireElement<HTMLButtonElement>("[data-action='format-italic']"),
    link: requireElement<HTMLButtonElement>("[data-action='format-link']"),
    code: requireElement<HTMLButtonElement>("[data-action='format-code']"),
    quote: requireElement<HTMLButtonElement>("[data-action='format-quote']")
  };
  insertMenuButton = requireElement<HTMLButtonElement>(".menu-button");
  insertMenu = requireElement<HTMLDivElement>(".insert-menu");
  settingsMenuButton = requireElement<HTMLButtonElement>(".settings-button");
  settingsMenu = requireElement<HTMLDivElement>(".settings-menu");
  languageSelect = requireElement<HTMLSelectElement>(".settings-language-select");
  wordStat = requireElement<HTMLSpanElement>(".words");
  charStat = requireElement<HTMLSpanElement>(".characters");
  lineStat = requireElement<HTMLSpanElement>(".lines");
  themeOptionButtons = Array.from(app.querySelectorAll<HTMLButtonElement>("[data-action='set-theme']"));
  fontDecreaseButton = requireElement<HTMLButtonElement>("[data-action='font-decrease']");
  fontIncreaseButton = requireElement<HTMLButtonElement>("[data-action='font-increase']");
  fontSizeLabel = requireElement<HTMLSpanElement>(".font-size-label");
  shortcutSelect = requireElement<HTMLSelectElement>(".settings-shortcut-select");
  documentCount = requireElement<HTMLSpanElement>(".drawer-section-count");
  shortcutCopy = requireElement<HTMLParagraphElement>(".shortcut-copy");
  dialogBackdrop = requireElement<HTMLDivElement>(".dialog-backdrop");
  confirmDialogMessage = requireElement<HTMLParagraphElement>(".confirm-dialog-message");
  confirmCloseSaveButton = requireElement<HTMLButtonElement>("[data-action='confirm-close-save']");
  modeButtons = Array.from(app.querySelectorAll<HTMLButtonElement>("[data-mode]"));
  fileActionButtons = {
    new: requireElement<HTMLButtonElement>("[data-action='new']"),
    open: requireElement<HTMLButtonElement>("[data-action='open']"),
    save: requireElement<HTMLButtonElement>("[data-action='save']")
  };
  settingsGroupTitles = Array.from(app.querySelectorAll<HTMLHeadingElement>(".settings-group-title"));
  settingsFieldLabels = Array.from(app.querySelectorAll<HTMLSpanElement>(".settings-field-label"));
  drawerSectionTitle = requireElement<HTMLSpanElement>(".drawer-section-title");
  drawerNoteTitle = requireElement<HTMLSpanElement>(".drawer-note-title");
  autocompleteTitle = requireElement<HTMLDivElement>(".autocomplete-title");
  confirmDialogTitle = requireElement<HTMLHeadingElement>(".confirm-dialog-title");
  confirmCloseCancelButton = requireElement<HTMLButtonElement>("[data-action='confirm-close-cancel']");
  confirmCloseDiscardButton = requireElement<HTMLButtonElement>("[data-action='confirm-close-discard']");
  findPanel = requireElement<HTMLDivElement>(".find-panel");
  findInput = requireElement<HTMLInputElement>(".find-input");
  replaceInput = requireElement<HTMLInputElement>(".replace-input");
  findStatus = requireElement<HTMLSpanElement>(".find-status");
  replaceRow = requireElement<HTMLDivElement>(".replace-row");
  findMatchCaseButton = requireElement<HTMLButtonElement>("[data-action='find-match-case']");
  findMatchWordButton = requireElement<HTMLButtonElement>("[data-action='find-match-word']");
  findPrevButton = requireElement<HTMLButtonElement>("[data-action='find-prev']");
  findNextButton = requireElement<HTMLButtonElement>("[data-action='find-next']");
  findCloseButton = requireElement<HTMLButtonElement>("[data-action='find-close']");
  findToggleReplaceButton = requireElement<HTMLButtonElement>("[data-action='find-toggle-replace']");
  findReplaceButton = requireElement<HTMLButtonElement>("[data-action='find-replace']");
  findReplaceAllButton = requireElement<HTMLButtonElement>("[data-action='find-replace-all']");
}
