import { Compilation } from "../compiler/compilation";

export enum TypingSpeed {
  Instant = 0,
  Fast = 20,
  Medium = 40,
  Slow = 80,
}

export interface AnimationStep {
  text: string;
  typingSpeedDelayMs: number;
}

export function createAnimationStep(
  text: string,
  typingSpeed: number = TypingSpeed.Medium,
): AnimationStep {
  return {
    text,
    typingSpeedDelayMs: typingSpeed,
  };
}

const createSpeedHelper =
  (speed: TypingSpeed) =>
  (text: string): AnimationStep =>
    createAnimationStep(text, speed);

export const instant = createSpeedHelper(TypingSpeed.Instant);
export const fast = createSpeedHelper(TypingSpeed.Fast);
export const normal = createSpeedHelper(TypingSpeed.Medium);
export const slow = createSpeedHelper(TypingSpeed.Slow);

// Teach each grammar rule as a ludeme
export interface Puzzlet {
  name: string;
  instructions: AnimationStep[];
  examples: AnimationStep[];
  successCondition: (compilation: Compilation) => boolean;
}

export interface LudicModule {
  name: string;
  puzzlets: Puzzlet[];
}

export class Lesson {
  private readonly modules: LudicModule[];
  private readonly flattenedPuzzlets: Puzzlet[];
  private readonly puzzletIndexToModuleIndex: number[];
  private currentPuzzletIndex: number = 0;

  constructor(modules: LudicModule[]) {
    this.modules = modules;
    this.flattenedPuzzlets = this.modules.flatMap((module) => module.puzzlets);

    // Precompute puzzlet index to module index mapping
    this.puzzletIndexToModuleIndex = this.modules.flatMap(
      (module, moduleIndex) => Array(module.puzzlets.length).fill(moduleIndex),
    );
  }

  public getCurrentPuzzletIndex(): number {
    return this.currentPuzzletIndex;
  }

  public getNumPuzzlets(): number {
    return this.flattenedPuzzlets.length;
  }

  public getCurrentPuzzlet(): Puzzlet {
    return this.flattenedPuzzlets[this.currentPuzzletIndex];
  }

  public getCurrentModule(): LudicModule {
    const moduleIdx = this.puzzletIndexToModuleIndex[this.currentPuzzletIndex];
    return this.modules[moduleIdx];
  }

  public isComplete(): boolean {
    return this.currentPuzzletIndex >= this.flattenedPuzzlets.length;
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
