import { Lesson, Puzzlet, normal, fast, slow } from "./lesson";
import { Compilation } from "src/compiler/compilation";

export function createFizLesson(): Lesson {
  const introPuzzlet: Puzzlet = {
    name: "Let's get func-y!",
    instructions: [
      normal("Welcome to an interactive fiz language tutorial!\n"),
      normal("Start by uncommenting the following line:"),
    ],
    examples: [fast("// f()")],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().length > 0;
    },
  };

  const functionsPuzzlets: Puzzlet[] = [
    {
      name: "Getting Edgy",
      instructions: [
        normal("f() is a function.\n"),
        normal("Functions consist of a word followed by ( ).\n"),
        normal("Functions are visualized as nodes.\n"),
        normal("Functions can be input to other functions.\n"),
        normal("Put another function between the ( )."),
      ],
      examples: [],
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getEdgeList().length > 0;
      },
    },
    {
      name: "Double Edged",
      instructions: [
        normal("Arguments to functions are visualized as edges.\n"),
        normal("Functions can also take multiple comma separated inputs.\n"),
        normal("Add a ',' and then another function to the outermost ( )."),
      ],
      examples: [],
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getNodeList().some(
          (node) =>
            compilation.DAG.getEdgeList().filter(
              (edge) => edge.destNodeId === node.id,
            ).length >= 2,
        );
      },
    },
    {
      name: "Compose Yourself",
      instructions: [
        normal("Functions can also be arbitrarily nested.\n"),
        normal("Add another function inside an innermost ( )."),
      ],
      examples: [],
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getNodeList().some((node) => {
          const inDegree = compilation.DAG.getEdgeList().filter(
            (edge) => edge.destNodeId === node.id,
          ).length;
          const outDegree = compilation.DAG.getEdgeList().filter(
            (edge) => edge.srcNodeId === node.id,
          ).length;
          return inDegree >= 1 && outDegree >= 1;
        });
      },
    },
  ];

  const outroPuzzlet: Puzzlet = {
    name: "The End of the Beginning",
    instructions: [
      slow("Congratulations! "),
      normal("You completed the tutorial!\n"),
      normal("Uncomment the exit() function to exit this tutorial."),
    ],
    examples: [fast("// exit()")],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().some((node) => node.name === "exit");
    },
  };

  const introModule = {
    name: "Intro",
    puzzlets: [introPuzzlet],
  };
  const functionsModule = {
    name: "Functions",
    puzzlets: functionsPuzzlets,
  };
  const outroModule = {
    name: "Outro",
    puzzlets: [outroPuzzlet],
  };

  return new Lesson([introModule, functionsModule, outroModule]);
}
