import { Lesson, Puzzlet, normal, fast, slow } from "./lesson";
import { Compilation } from "src/compiler/compilation";
import { DagElement } from "src/compiler/dag";
import { NodeType, AssignmentTreeNode } from "src/compiler/ast";

export function createFizLesson(): Lesson {
  // Intro module
  const introPuzzlet: Puzzlet = {
    name: "Let's get func-y!",
    instructions: [
      normal("Welcome to an interactive fiz language tutorial!\n"),
      normal("Start by uncommenting the following line (remove the '//'):"),
    ],
    examples: [fast("// f()")],
    successCondition: (compilation: Compilation) => {
      return compilation.DAG.getNodeList().length > 0;
    },
  };
  const introModule = {
    name: "Intro",
    puzzlets: [introPuzzlet],
  };

  // Functions module
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
        normal("Add a ',' and then another function in the outermost ( )."),
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
  const functionsModule = {
    name: "Functions",
    puzzlets: functionsPuzzlets,
  };

  // Assignment module
  const assignmentPuzzlets: Puzzlet[] = [
    {
      name: "On Assignment",
      instructions: [
        normal("Functions can be assigned to variables using '='.\n"),
        normal("variable_name = function_name()\n"),
        normal("Uncomment the assignment below:"),
      ],
      examples: [fast("// x = f()")],
      clearEditorOnStart: true,
      successCondition: (compilation: Compilation) => {
        return compilation.DAG.getVarNameToNodeIdMap().size > 0;
      },
    },
    {
      name: "Understand the Assignment",
      instructions: [
        normal("Once assigned, variables can be input to functions.\n"),
        normal("On a new line, input the variable into another function."),
      ],
      examples: [],
      successCondition: (compilation: Compilation) => {
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const assignedNodeIds = new Set(varNameToNodeIdMap.values());
        return compilation.DAG.getEdgeList().some((edge) =>
          assignedNodeIds.has(edge.srcNodeId),
        );
      },
    },
    {
      name: "Making a Statement",
      instructions: [
        normal("Stand-alone function calls and assignments are statements.\n"),
        normal("There should only be one statement per line"),
        fast(" (unless ';' separated).\n"),
        normal("Statements are run in the order they appear.\n"),
        normal("Reorder the lines so the variable is assigned before used."),
      ],
      examples: [fast("g(x); h(x)")],
      successCondition: (compilation: Compilation) => {
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const assignedNodeIds = new Set(varNameToNodeIdMap.values());
        return (
          compilation.DAG.getEdgeList().filter((edge) =>
            assignedNodeIds.has(edge.srcNodeId),
          ).length >= 2
        );
      },
    },
    {
      name: "Legal Aliases",
      instructions: [
        normal("Variables can be assigned to other variables.\n"),
        normal("The new variable is an alias for the original variable.\n"),
        normal("Uncomment the function calls to use the alias"),
      ],
      examples: [
        fast("long_variable_name = f()\n"),
        fast("alias = long_variable_name\n"),
        fast("// g(long_variable_name); h(alias)"),
      ],
      successCondition: (compilation: Compilation) => {
        // Check AST for variable-to-variable assignment
        const hasVariableToVariableAssignment = compilation.AST.Statements.some(
          (stmt) => {
            if (stmt.Type !== NodeType.Assignment) return false;
            const assignment = stmt as AssignmentTreeNode;
            if (assignment.Lhs.length !== 1) return false;
            if (assignment.Rhs?.Type !== NodeType.QualifiedVariable) {
              return false;
            }
            return true;
          },
        );

        // Check DAG for alias usage
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const nodeIdToVarNameCount = new Map<string, number>();
        varNameToNodeIdMap.forEach((nodeId) => {
          nodeIdToVarNameCount.set(
            nodeId,
            (nodeIdToVarNameCount.get(nodeId) ?? 0) + 1,
          );
        });
        const hasAliasUsedInDAG = Array.from(
          nodeIdToVarNameCount.entries(),
        ).some(
          ([nodeId, count]) =>
            count >= 2 &&
            compilation.DAG.getEdgeList().filter(
              (edge) => edge.srcNodeId === nodeId,
            ).length >= 2,
        );

        return hasVariableToVariableAssignment && hasAliasUsedInDAG;
      },
    },
    {
      name: "Do the Splits",
      instructions: [
        normal("Multiple variables can be assigned in one statement.\n"),
        normal("Separate the variables with a comma ',' like x, y, z = f()\n"),
        normal("Uncomment the assignment below:"),
      ],
      examples: [
        fast("// yolk, white = split(egg())\n"),
        fast("whisk(yolk); whip(white)"),
      ],
      successCondition: (compilation: Compilation) => {
        // Check AST for multi-variable assignment
        const hasMultiVariableAssignment = compilation.AST.Statements.some(
          (stmt) => {
            if (stmt.Type !== NodeType.Assignment) return false;
            const assignment = stmt as AssignmentTreeNode;
            return assignment.Lhs.length >= 2;
          },
        );

        // Check DAG for multiple variables referencing same node
        const varNameToNodeIdMap = compilation.DAG.getVarNameToNodeIdMap();
        const nodeIdToVarNameCount = new Map<string, number>();
        varNameToNodeIdMap.forEach((nodeId) => {
          nodeIdToVarNameCount.set(
            nodeId,
            (nodeIdToVarNameCount.get(nodeId) ?? 0) + 1,
          );
        });
        const hasMultipleVarsInDAG = Array.from(
          nodeIdToVarNameCount.entries(),
        ).some(
          ([nodeId, count]) =>
            count >= 2 &&
            compilation.DAG.getEdgeList().filter(
              (edge) => edge.srcNodeId === nodeId,
            ).length >= 2,
        );

        return hasMultiVariableAssignment && hasMultipleVarsInDAG;
      },
    },
    {
      name: "Ace of Diamonds",
      instructions: [
        normal("Now you're thinking with formulas!\n"),
        normal("Formulas form DAGs (Directed Acyclic Graphs).\n"),
        normal("Functions are nodes.\n"),
        normal("Args are edges.\n"),
        normal("Coder is you!\n"),
        normal("Make a diamond-shaped DAG with 4 nodes to continue."),
      ],
      examples: [],
      clearEditorOnStart: true,
      successCondition: (compilation: Compilation) => {
        const nodeList = compilation.DAG.getNodeList();
        const edgeList = compilation.DAG.getEdgeList();

        if (nodeList.length < 4 || edgeList.length < 4) return false;

        const getInDegree = (node: DagElement) =>
          edgeList.filter((e) => e.destNodeId === node.id).length;
        const getOutDegree = (node: DagElement) =>
          edgeList.filter((e) => e.srcNodeId === node.id).length;

        const topNode = nodeList.find(
          (node) => getInDegree(node) === 0 && getOutDegree(node) === 2,
        );
        if (!topNode) return false;

        const bottomNode = nodeList.find(
          (node) => getInDegree(node) === 2 && getOutDegree(node) === 0,
        );
        if (!bottomNode) return false;

        const middleNodes = nodeList.filter(
          (node) => getInDegree(node) === 1 && getOutDegree(node) === 1,
        );
        if (middleNodes.length < 2) return false;

        return middleNodes.every(
          (node) =>
            edgeList.some(
              (e) => e.srcNodeId === topNode.id && e.destNodeId === node.id,
            ) &&
            edgeList.some(
              (e) => e.srcNodeId === node.id && e.destNodeId === bottomNode.id,
            ),
        );
      },
    },
  ];
  const assignmentModule = {
    name: "Assignment",
    puzzlets: assignmentPuzzlets,
  };

  // Outro module
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
  const outroModule = {
    name: "Outro",
    puzzlets: [outroPuzzlet],
  };

  return new Lesson([
    introModule,
    functionsModule,
    assignmentModule,
    outroModule,
  ]);
}
