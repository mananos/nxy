export interface Layout {
  left: boolean;
  top: boolean;
}

export function applyLayout({ left, top }: Layout) {
  document.body.dataset.x = left ? "left" : "right";
  document.body.dataset.y = top ? "top" : "bottom";
}
