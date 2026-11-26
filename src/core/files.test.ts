// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { state } from "../state";
import { createFilesController } from "./files";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../storage/session", () => ({ persistDraft: vi.fn(), pushRecentFile: vi.fn() }));
vi.mock("../dom", () => ({
  editor: document.createElement("textarea"),
  titleInput: document.createElement("input")
}));

describe("saving while editing", () => {
  const controller = createFilesController({
    render: vi.fn(), renderDocuments: vi.fn(), renderSaveState: vi.fn(), closeAutocomplete: vi.fn()
  });
  beforeEach(() => {
    state.openFiles = [];
    controller.createNewDocument();
    state.content = "original";
    state.isDirty = true;
    controller.syncActiveFile();
    vi.mocked(invoke).mockReset().mockResolvedValue(undefined);
  });

  function delaySave() {
    let finish!: (saved: { name: string; path: string }) => void;
    vi.mocked(invoke).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    return () => finish({ name: "saved.md", path: "/docs/saved.md" });
  }

  it("applies a completed save only to its originating tab", async () => {
    const finish = delaySave();
    const origin = state.openFiles[0];
    const saving = controller.saveDocument();
    controller.createNewDocument();
    finish();
    expect(await saving).toBe(true);
    expect(origin).toMatchObject({ nativePath: "/docs/saved.md", isDirty: false });
    expect(state.nativePath).toBeNull();
  });

  it("keeps later edits dirty and serializes the next save to the selected path", async () => {
    const finish = delaySave();
    const first = controller.saveDocument();
    state.content = "later edit";
    vi.mocked(invoke).mockImplementation(async (command) => command === "save_markdown_file"
      ? { name: "saved.md", path: "/docs/saved.md" } : undefined);
    const second = controller.saveDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
    finish();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(state.isDirty).toBe(false);
    expect(invoke).toHaveBeenCalledWith("save_markdown_file", {
      path: "/docs/saved.md", suggestedName: "saved.md", content: "later edit"
    });
  });
});
