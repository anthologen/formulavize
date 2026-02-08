import { Lesson, AnimationStep } from "./lesson";
import { createInitialLesson } from "./lessonPlan";
import { Compilation } from "../compiler/compilation";

export class TutorialManager {
  private textEditorUpdateCallback: ((text: string) => void) | null = null;
  private isAnimating: boolean = false;
  private animationHandle: number | null = null;
  private currentLesson: Lesson = createInitialLesson();

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

  private async animateInstructions(
    instructions: AnimationStep[],
  ): Promise<void> {
    this.cancelAnimation(); // Prevent overlapping animations
    this.isAnimating = true;

    let accumulatedText = "";

    for (const step of instructions) {
      if (!this.isAnimating) break; // Allow early exit

      const segmentText = step.text;
      const typingSpeed = step.typingSpeedDelayMs;

      for (let i = 0; i <= segmentText.length; i++) {
        if (!this.isAnimating) break;

        const currentSegment = segmentText.substring(0, i);
        const currentText = accumulatedText + currentSegment;
        this.textEditorUpdateCallback?.(currentText);

        await this.delay(typingSpeed);
      }

      accumulatedText += segmentText;
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
