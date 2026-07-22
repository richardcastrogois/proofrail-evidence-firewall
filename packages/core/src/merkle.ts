import { sha256Hex } from "./crypto";

function hashPair(left: string, right: string): string {
  return sha256Hex(`${left}:${right}`);
}

export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return sha256Hex("rational-gate:empty-tree");
  }

  let level = leaves.map((leaf) => sha256Hex(leaf));

  while (level.length > 1) {
    const next: string[] = [];

    for (let index = 0; index < level.length; index += 2) {
      const left = level[index]!;
      const right = level[index + 1] ?? left;
      next.push(hashPair(left, right));
    }

    level = next;
  }

  return level[0]!;
}
