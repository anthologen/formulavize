import { Lesson, AnimationStep } from "./lesson";
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
    this.animateInstructions(firstPuzzlet.instructions);
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
      this.animateInstructions(nextPuzzlet.instructions);
    } finally {
      this.isAdvancing = false;
    }
  }

  private getProgressString(): string {
    const curIdx = this.currentLesson.getCurrentPuzzletIndex();
    const numPuzzlets = this.currentLesson.getNumPuzzlets();
    return `fiz tutorial (${curIdx + 1}/${numPuzzlets})\n`;
  }

  private async animateInstructions(
    instructions: AnimationStep[],
  ): Promise<void> {
    this.cancelAnimation(); // Prevent overlapping animations
    this.isAnimating = true;

    let headerText = this.getProgressString();
    this.setTutorialHeaderText(headerText);

    const lockedSteps = instructions.filter((step) => !step.editable);
    for (const step of lockedSteps) {
      for (const char of step.text) {
        if (!this.isAnimating) break;
        headerText += char;
        this.setTutorialHeaderText("/* " + headerText + " */\n");
        await this.delay(step.typingSpeedDelayMs);
      }
    }

    const editableSteps = instructions.filter((step) => step.editable);
    const editableText = editableSteps.map((step) => step.text).join("");
    this.insertAtHeaderBoundary(editableText);
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
