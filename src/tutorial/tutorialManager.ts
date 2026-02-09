import { Lesson, Puzzlet } from "./lesson";
import { createFizLesson } from "./lessonPlan";
import { Compilation } from "../compiler/compilation";

export class TutorialManager {
  private callbacks: {
    setEditorText: ((text: string) => void) | null;
    setTutorialHeaderText: ((text: string) => void) | null;
    insertAtHeaderBoundary: ((text: string) => void) | null;
  } = {
    setEditorText: null,
    setTutorialHeaderText: null,
    insertAtHeaderBoundary: null,
  };

  private isAnimating: boolean = false;
  private animationHandle: number | null = null;
  private currentLesson: Lesson = createFizLesson();
  private isAdvancing: boolean = false;
  private tutorialActive: boolean = false;

  public setCallbacks(
    setEditorText: (text: string) => void,
    setTutorialHeaderText: (text: string) => void,
    insertAtHeaderBoundary: (text: string) => void,
  ): void {
    this.callbacks = {
      setEditorText,
      setTutorialHeaderText,
      insertAtHeaderBoundary,
    };
  }

  private setEditorText(text: string): void {
    this.callbacks.setEditorText?.(text);
  }

  private setTutorialHeaderText(text: string): void {
    this.callbacks.setTutorialHeaderText?.(text);
  }

  private insertAtHeaderBoundary(text: string): void {
    this.callbacks.insertAtHeaderBoundary?.(text);
  }

  public startTutorial(): void {
    if (
      !this.callbacks.setEditorText ||
      !this.callbacks.setTutorialHeaderText ||
      !this.callbacks.insertAtHeaderBoundary
    ) {
      console.warn("Text editor callbacks not set. Cannot start tutorial.");
      return;
    }
    this.currentLesson.reset();
    this.tutorialActive = true;
    this.setEditorText("");
    const firstPuzzlet = this.currentLesson.getCurrentPuzzlet();
    this.animatePuzzlet(firstPuzzlet);
  }

  public stopTutorial(): void {
    this.tutorialActive = false;
    this.cancelAnimation();
  }

  public async onCompilation(compilation: Compilation): Promise<void> {
    if (!this.tutorialActive || this.isAdvancing) return;
    if (!this.currentLesson.canAdvance(compilation)) return;
    this.isAdvancing = true;
    try {
      await this.delay(500); // Small delay before advancing to allow user to see the successful change
      if (!this.tutorialActive) return;
      this.currentLesson.advance();
      const nextPuzzlet = this.currentLesson.getCurrentPuzzlet();
      this.animatePuzzlet(nextPuzzlet);
    } finally {
      this.isAdvancing = false;
    }
  }

  private getProgressString(): string {
    const curIdx = this.currentLesson.getCurrentPuzzletIndex();
    const numPuzzlets = this.currentLesson.getNumPuzzlets();
    return `fiz tutorial (${curIdx + 1}/${numPuzzlets})\n`;
  }

  private async animatePuzzlet(puzzlet: Puzzlet): Promise<void> {
    this.cancelAnimation(); // Prevent overlapping animations
    this.isAnimating = true;

    let headerText = this.getProgressString();
    this.setTutorialHeaderText(headerText);

    // Animate all instructions in the header
    for (const step of puzzlet.instructions) {
      for (const char of step.text) {
        if (!this.isAnimating) break;
        headerText += char;
        this.setTutorialHeaderText("/* " + headerText + " */\n");
        await this.delay(step.typingSpeedDelayMs);
      }
    }

    // Insert all examples at the header boundary (all are editable)
    const examplesText = puzzlet.examples.map((step) => step.text).join("");
    this.insertAtHeaderBoundary(examplesText);
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
