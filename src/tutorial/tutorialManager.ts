export class TutorialManager {
  private textEditorUpdateCallback: ((text: string) => void) | null = null;
  private isAnimating: boolean = false;
  private animationHandle: number | null = null;
  private typingSpeed: number = 50; // milliseconds per character

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
    this.animateText("Hello World!");
  }

  public stopTutorial(): void {
    this.cancelAnimation();
  }

  private async animateText(fullText: string): Promise<void> {
    this.cancelAnimation(); // Prevent overlapping animations
    this.isAnimating = true;

    for (let i = 0; i <= fullText.length; i++) {
      if (!this.isAnimating) break; // Allow early exit

      const currentText = fullText.substring(0, i);
      this.textEditorUpdateCallback?.(currentText);

      await this.delay(this.typingSpeed);
    }

    this.isAnimating = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.animationHandle = window.setTimeout(resolve, ms);
    });
  }

  private cancelAnimation(): void {
    this.isAnimating = false;
    if (this.animationHandle !== null) {
      clearTimeout(this.animationHandle);
      this.animationHandle = null;
    }
  }
}
