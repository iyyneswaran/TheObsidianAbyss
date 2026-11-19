interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

const cameraZoomLevels = [0.25, 0.5, 1, 2];
const screenSpeed = 220;

export function createDungeonCamera(
  view: Size,
  world: Size,
  home: Point,
  initialZoom = 0.5,
) {
  const minZoom = Math.max(
    view.width / world.width,
    view.height / world.height,
  );
  const allowed = cameraZoomLevels.filter((zoom) => zoom >= minZoom);
  const levels = allowed.length ? allowed : [Math.ceil(minZoom)];
  const initialIndex = levels.findIndex((zoom) => zoom >= initialZoom);
  const homeIndex = initialIndex === -1 ? levels.length - 1 : initialIndex;

  let zoomIndex = homeIndex;
  let center: Point;

  function clamp({ x, y }: Point) {
    const zoom = levels[zoomIndex]!;
    const halfWidth = view.width / zoom / 2;
    const halfHeight = view.height / zoom / 2;
    return {
      x: Math.max(halfWidth, Math.min(x, world.width - halfWidth)),
      y: Math.max(halfHeight, Math.min(y, world.height - halfHeight)),
    };
  }

  function focus(point: Point) {
    center = clamp(point);
  }

  focus(home);

  return {
    get state() {
      return { ...center, zoom: levels[zoomIndex]! };
    },
    focus,
    follow(point: Point, milliseconds: number) {
      const target = clamp(point);
      const mix = 1 - Math.exp(-milliseconds / 85);
      const approach = (current: number, next: number) =>
        Math.abs(next - current) < 0.1
          ? next
          : current + (next - current) * mix;
      center = {
        x: approach(center.x, target.x),
        y: approach(center.y, target.y),
      };
    },
    zoomBy(step: -1 | 1) {
      zoomIndex = Math.max(0, Math.min(zoomIndex + step, levels.length - 1));
      focus(center);
    },
    pan(dx: number, dy: number, milliseconds: number) {
      if (!dx && !dy) return;
      const length = Math.hypot(dx, dy);
      const distance =
        (screenSpeed * milliseconds) / (1000 * levels[zoomIndex]!);
      focus({
        x: center.x + (dx / length) * distance,
        y: center.y + (dy / length) * distance,
      });
    },
    reset() {
      zoomIndex = homeIndex;
      focus(home);
    },
  };
}
