import { Lesson, AnimationStep } from "./lesson";
import { createFizLesson } from "./lessonPlan";
import { Compilation } from "../compiler/compilation";

export class TutorialManager {
  private textEditorUpdateCallback:
    | ((text: string, append?: boolean) => void)
    | null = null;
  private isAnimating: boolean = false;
  private animationHandle: number | null = null;
  private currentLesson: Lesson = createFizLesson();

  public setTextEditorUpdateCallback(
    callback: (text: string, append?: boolean) => void,
  ): void {
    this.textEditorUpdateCallback = callback;
  }

  private setEditorText(text: string): void {
    this.textEditorUpdateCallback?.(text, false);
  }

  private appendToEditor(text: string): void {
    this.textEditorUpdateCallback?.(text, true);
  }

  public startTutorial(): void {
    if (!this.textEditorUpdateCallback) {
      console.warn(
        "Text editor update callback not set. Cannot start tutorial.",
      );
      return;
    }
    this.currentLesson.reset();
    const firstPuzzlet = this.currentLesson.getCurrentPuzzlet();
    this.animateInstructions(firstPuzzlet.instructions);
  }

  public stopTutorial(): void {
    this.cancelAnimation();
  }

  public onCompilation(compilation: Compilation): void {
    if (!this.currentLesson.canAdvance(compilation)) return;
    this.currentLesson.advance();
    const nextPuzzlet = this.currentLesson.getCurrentPuzzlet();
    this.animateInstructions(nextPuzzlet.instructions);
  }

  private getProgressString(): string {
    const curIdx = this.currentLesson.getCurrentPuzzletIndex();
    const numPuzzlets = this.currentLesson.getNumPuzzlets();
    return `// fiz tutorial (${curIdx + 1}/${numPuzzlets})\n`;
  }

  private async animateInstructions(
    instructions: AnimationStep[],
  ): Promise<void> {
    this.cancelAnimation(); // Prevent overlapping animations
    this.isAnimating = true;
    this.setEditorText(this.getProgressString()); // Clear editor before starting new instructions

    for (const step of instructions) {
      for (const char of step.text) {
        if (!this.isAnimating) break;
        this.appendToEditor(char);
        await this.delay(step.typingSpeedDelayMs);
      }
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
