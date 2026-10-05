/**
 * Chrome's built-in page translator (and some browser extensions) rewrite
 * text nodes in place, outside React's control. When that lands inside a
 * part of the tree React is about to reconcile — which, on a live-scoring
 * screen re-rendering every second (the countdown, the score strip, chat),
 * is basically guaranteed to happen eventually — React's next commit tries
 * to insertBefore/removeChild a DOM node it still believes is there, and
 * the browser throws "... is not a child of this node", taking the whole
 * screen down to the router's generic error page. This was first
 * misdiagnosed as a Leaflet-vs-React race scoped to the map (see
 * MapErrorBoundary) because the first report happened to be on a map
 * screen, but it kept recurring, Chrome-only, after that fix shipped —
 * consistent with Chrome Translate corrupting ANY part of the page, not
 * just the map.
 *
 * There is no correct DOM mutation to perform once the node a third party
 * moved or removed is simply gone, so the safest fix downgrades it to a
 * no-op instead of letting it crash — a well-known, widely used workaround
 * for this exact "Chrome Translate breaks React" failure mode.
 */
export function patchDomAgainstThirdPartyMutations(): void {
  if (typeof Node === "undefined") return;
  const proto = Node.prototype as Node & { __domPatchedForThirdPartyMutations?: boolean };
  if (proto.__domPatchedForThirdPartyMutations) return;
  proto.__domPatchedForThirdPartyMutations = true;

  const nativeInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    return nativeInsertBefore.call(this, newNode, referenceNode) as T;
  };

  const nativeRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return nativeRemoveChild.call(this, child) as T;
  };
}
