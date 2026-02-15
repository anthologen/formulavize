import { DagElement, DagEdge } from "src/compiler/dag";

// Helper function to get in-degree of a node by ID
export function getInDegree(nodeId: string, edgeList: DagEdge[]): number {
  return edgeList.filter((edge) => edge.destNodeId === nodeId).length;
}

// Helper function to get out-degree of a node by ID
export function getOutDegree(nodeId: string, edgeList: DagEdge[]): number {
  return edgeList.filter((edge) => edge.srcNodeId === nodeId).length;
}

// Helper function to create a map of node IDs to variable name counts
export function createNodeIdToVarNameCount(
  varNameToNodeIdMap: Map<string, string>,
): Map<string, number> {
  const nodeIdToVarNameCount = new Map<string, number>();
  varNameToNodeIdMap.forEach((nodeId) => {
    nodeIdToVarNameCount.set(
      nodeId,
      (nodeIdToVarNameCount.get(nodeId) ?? 0) + 1,
    );
  });
  return nodeIdToVarNameCount;
}

// Helper function to get nodes that use at least one style tag with properties
export function getStyleTaggedNodes(
  flattenedStyles: Map<string, Map<string, string>>,
  nodes: DagElement[],
): DagElement[] {
  return nodes.filter((node) => {
    return node.styleTags.some((tag) => {
      const tagKey = tag.join(".");
      const properties = flattenedStyles.get(tagKey);
      if (!properties) return false;
      return properties.size > 0;
    });
  });
}
