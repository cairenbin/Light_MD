const INDENT_UNIT = "  ";

export interface TabIndentParams {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  outdent: boolean;
}

export interface TabIndentResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  changed: boolean;
}

function getLineStart(value: string, index: number): number {
  if (index <= 0) {
    return 0;
  }
  return value.lastIndexOf("\n", index - 1) + 1;
}

function getRemovableIndentLength(value: string, lineStart: number): number {
  if (value.startsWith("\t", lineStart)) {
    return 1;
  }

  let count = 0;
  while (count < INDENT_UNIT.length && value.charAt(lineStart + count) === " ") {
    count += 1;
  }

  return count;
}

function collectAffectedLineStarts(value: string, selectionStart: number, selectionEnd: number): number[] {
  const firstLineStart = getLineStart(value, selectionStart);
  const lineStarts = [firstLineStart];

  for (let index = firstLineStart; index < selectionEnd; index += 1) {
    if (value.charAt(index) === "\n" && index + 1 < selectionEnd) {
      lineStarts.push(index + 1);
    }
  }

  return lineStarts;
}

function indentSingleCursor(value: string, selectionStart: number): TabIndentResult {
  const nextValue = `${value.slice(0, selectionStart)}${INDENT_UNIT}${value.slice(selectionStart)}`;
  const nextSelection = selectionStart + INDENT_UNIT.length;

  return {
    value: nextValue,
    selectionStart: nextSelection,
    selectionEnd: nextSelection,
    changed: true
  };
}

function outdentSingleCursor(value: string, selectionStart: number): TabIndentResult {
  const lineStart = getLineStart(value, selectionStart);
  const removableLength = getRemovableIndentLength(value, lineStart);

  if (removableLength === 0) {
    return {
      value,
      selectionStart,
      selectionEnd: selectionStart,
      changed: false
    };
  }

  const nextValue = `${value.slice(0, lineStart)}${value.slice(lineStart + removableLength)}`;
  const nextSelection =
    selectionStart <= lineStart ? selectionStart : Math.max(lineStart, selectionStart - removableLength);

  return {
    value: nextValue,
    selectionStart: nextSelection,
    selectionEnd: nextSelection,
    changed: true
  };
}

function indentSelection(value: string, selectionStart: number, selectionEnd: number): TabIndentResult {
  const lineStarts = collectAffectedLineStarts(value, selectionStart, selectionEnd);
  let nextValue = value;
  let offset = 0;
  let addedBeforeStart = 0;
  let addedBeforeEnd = 0;

  for (const lineStart of lineStarts) {
    const adjustedStart = lineStart + offset;
    nextValue = `${nextValue.slice(0, adjustedStart)}${INDENT_UNIT}${nextValue.slice(adjustedStart)}`;

    if (lineStart < selectionStart) {
      addedBeforeStart += INDENT_UNIT.length;
    }
    if (lineStart < selectionEnd) {
      addedBeforeEnd += INDENT_UNIT.length;
    }

    offset += INDENT_UNIT.length;
  }

  return {
    value: nextValue,
    selectionStart: selectionStart + addedBeforeStart,
    selectionEnd: selectionEnd + addedBeforeEnd,
    changed: true
  };
}

function outdentSelection(value: string, selectionStart: number, selectionEnd: number): TabIndentResult {
  const lineStarts = collectAffectedLineStarts(value, selectionStart, selectionEnd);
  let nextValue = value;
  let removedOffset = 0;
  let removedBeforeStart = 0;
  let removedBeforeEnd = 0;
  let changed = false;

  for (const lineStart of lineStarts) {
    const adjustedStart = lineStart - removedOffset;
    const removableLength = getRemovableIndentLength(nextValue, adjustedStart);

    if (removableLength === 0) {
      continue;
    }

    changed = true;
    nextValue = `${nextValue.slice(0, adjustedStart)}${nextValue.slice(adjustedStart + removableLength)}`;
    removedOffset += removableLength;

    if (lineStart < selectionStart) {
      removedBeforeStart += Math.min(removableLength, selectionStart - lineStart);
    }
    if (lineStart < selectionEnd) {
      removedBeforeEnd += Math.min(removableLength, selectionEnd - lineStart);
    }
  }

  return {
    value: nextValue,
    selectionStart: Math.max(0, selectionStart - removedBeforeStart),
    selectionEnd: Math.max(0, selectionEnd - removedBeforeEnd),
    changed
  };
}

export function applyTabIndentation({
  value,
  selectionStart,
  selectionEnd,
  outdent
}: TabIndentParams): TabIndentResult {
  if (selectionStart === selectionEnd) {
    return outdent ? outdentSingleCursor(value, selectionStart) : indentSingleCursor(value, selectionStart);
  }

  return outdent
    ? outdentSelection(value, selectionStart, selectionEnd)
    : indentSelection(value, selectionStart, selectionEnd);
}
