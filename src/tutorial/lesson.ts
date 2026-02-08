import { Compilation } from "../compiler/compilation";

export enum TypingSpeed {
  Instant = 0,
  Fast = 20,
  Medium = 50,
  Slow = 100,
}

export interface AnimationStep {
  text: string;
  typingSpeedDelayMs: number;
}

export function createAnimationStep(
  text: string,
  typingSpeed: TypingSpeed = TypingSpeed.Medium,
): AnimationStep {
  return {
    text,
    typingSpeedDelayMs: typingSpeed,
  };
}

export interface Puzzlet {
  instructions: AnimationStep[];
  successCondition: (compilation: Compilation) => boolean;
}

export class Lesson {
  private puzzlets: Puzzlet[];
  private currentPuzzletIndex: number = 0;

  constructor(puzzlets: Puzzlet[]) {
    this.puzzlets = puzzlets;
  }

  public getCurrentPuzzlet(): Puzzlet {
    return this.puzzlets[this.currentPuzzletIndex];
  }

  public isComplete(): boolean {
    return this.currentPuzzletIndex >= this.puzzlets.length;
  }

  public canAdvance(compilation: Compilation): boolean {
    if (this.isComplete()) return false;
    return this.getCurrentPuzzlet().successCondition(compilation);
  }

  public advance(): boolean {
    if (this.isComplete()) return false;
    this.currentPuzzletIndex++;
    return true;
  }

  public reset(): void {
    this.currentPuzzletIndex = 0;
  }
}
