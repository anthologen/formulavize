import { Lesson, Puzzlet } from "./lesson";
import { Compilation } from "src/compiler/compilation";

export function createInitialLesson(): Lesson {
  const puzzlets: Puzzlet[] = [
    {
      instructions: [
        {
          text: "// Welcome to the formulavize tutorial! ",
          typingSpeedDelayMs: 50,
        },
        {
          text: "Let's start by writing a simple formula.",
          typingSpeedDelayMs: 50,
        },
      ],
      successCondition: (compilation: Compilation) => {
        // Check if DAG has at least one node
        return compilation.DAG.getNodeList().length > 0;
      },
    },
    {
      instructions: [
        {
          text: "// The End! ",
          typingSpeedDelayMs: 50,
        },
        {
          text: "Please click the Tutorial button to exit this tutorial.",
          typingSpeedDelayMs: 50,
        },
      ],
      successCondition: (_compilation: Compilation) => false,
    },
  ];

  return new Lesson(puzzlets);
}
