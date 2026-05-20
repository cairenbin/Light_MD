export function buildMarkdownContinuation(currentLine: string): string | null {
  const taskMatch = currentLine.match(/^(\s*)[-*+]\s\[( |x|X)\]\s?(.*)$/);

  if (taskMatch) {
    if (taskMatch[3].trim().length === 0) {
      return "";
    }

    return `${taskMatch[1]}- [ ] `;
  }

  const bulletMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);

  if (bulletMatch) {
    if (bulletMatch[3].trim().length === 0) {
      return "";
    }

    return `${bulletMatch[1]}${bulletMatch[2]} `;
  }

  const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);

  if (orderedMatch) {
    if (orderedMatch[3].trim().length === 0) {
      return "";
    }

    return `${orderedMatch[1]}${Number(orderedMatch[2]) + 1}. `;
  }

  const quoteMatch = currentLine.match(/^(\s*)>\s?(.*)$/);

  if (quoteMatch) {
    if (quoteMatch[2].trim().length === 0) {
      return "";
    }

    return `${quoteMatch[1]}> `;
  }

  return null;
}
