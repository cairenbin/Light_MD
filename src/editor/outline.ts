export type OutlineHeading = {
  level: number;
  text: string;
  line: number;
};

export function parseOutline(content: string): OutlineHeading[] {
  if (!content) {
    return [];
  }

  const lines = content.split(/\r\n|\r|\n/);
  const headings: OutlineHeading[] = [];
  let fenceMarker: "`" | "~" | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const fenceMatch = raw.match(/^ {0,3}(`{3,}|~{3,})/);

    if (fenceMatch) {
      const ch = fenceMatch[1][0] as "`" | "~";

      if (fenceMarker === null) {
        fenceMarker = ch;
        continue;
      }

      if (fenceMarker === ch) {
        fenceMarker = null;
      }

      continue;
    }

    if (fenceMarker !== null) {
      continue;
    }

    const headingMatch = raw.match(/^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/);

    if (!headingMatch) {
      continue;
    }

    const level = headingMatch[1].length;
    const body = headingMatch[2].replace(/(?:^|\s)+#+\s*$/, "");
    const text = body.trim();
    headings.push({ level, text, line: i });
  }

  return headings;
}
