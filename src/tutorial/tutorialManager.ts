export class TutorialManager {
  private textEditorUpdateCallback: ((text: string) => void) | null = null;

  public registerTextEditorUpdate(callback: (text: string) => void): void {
    this.textEditorUpdateCallback = callback;
  }

  public startTutorial(): void {
    if (!this.textEditorUpdateCallback) {
      console.warn(
        "Text editor update callback not registered. Cannot start tutorial.",
      );
      return;
    }
    this.textEditorUpdateCallback("Hello World!");
  }

  public stopTutorial(): void {}
}
