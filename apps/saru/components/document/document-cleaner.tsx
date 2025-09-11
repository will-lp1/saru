import { EditorState, Transaction } from "prosemirror-state";
import { Node } from "prosemirror-model";

function removeEmptyListItems(state: EditorState): Transaction {
  const tr = state.tr;
  const doc = state.doc;
  
  const emptyListItems: { pos: number, node: Node }[] = [];
  
  doc.descendants((node, pos) => {
    if (node.type.name === 'list_item' && isListItemEmpty(node)) {
      emptyListItems.push({ pos, node });
    }
    return true;
  });
  
  emptyListItems.reverse().forEach(({ pos, node }) => {
    tr.delete(pos, pos + node.nodeSize);
  });
  
  return tr;
}

function isListItemEmpty(node: Node): boolean {
  if (node.content.size === 0) return true;
  
  let hasContent = false;
  node.content.forEach((child: Node) => {
    if (child.isText && child.text && child.text.trim()) {
      hasContent = true;
    } else if (!child.isText && child.content.size > 0) {
      hasContent = hasContent || !isNodeEmpty(child);
    }
  });
  
  return !hasContent;
}

function isNodeEmpty(node: Node): boolean {
  if (node.isText) return !node.text || !node.text.trim();
  if (node.content.size === 0) return true;
  
  let isEmpty = true;
  node.content.forEach((child: Node) => {
    if (!isNodeEmpty(child)) isEmpty = false;
  });
  return isEmpty;
}

export default removeEmptyListItems