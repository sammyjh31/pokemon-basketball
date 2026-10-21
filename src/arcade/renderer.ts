import { isShinyPokemon } from "../game/shiny";
import { publicAsset } from "../assets";
import type {
  ArcadeEvent,
  ArcadePlayer,
  ArcadeState,
} from "../game/arcade/types";

const TEAM_COLORS = ["#5dd4e8", "#ff896b"] as const;
const INK = "#102339";
const CREAM = "#fff4d8";
const TYPE_COLORS: Record<string, string> = {
  fire: "#ff864c",
  water: "#63c4ff",
  electric: "#ffe06b",
  grass: "#a4e88c",
  ice: "#a5ecf6",
  fighting: "#fca681",
  poison: "#df9bf9",
  ground: "#e8b985",
  flying: "#c5c5ff",
  psychic: "#ff8fc7",
  bug: "#d4e67b",
  rock: "#d6c896",
  ghost: "#c2a2ff",
  dragon: "#a99dff",
  dark: "#b7a5d3",
  steel: "#c8e1e9",
  fairy: "#ffc8e6",
  normal: "#fff4d8",
};
type Point = { x: number; y: number; scale: number };
type SpriteBounds = { x: number; y: number; width: number; height: number };
const spriteBounds = new WeakMap<HTMLImageElement, SpriteBounds>();

/** A single floor/height projection is shared by all moving and stationary art. */
export function projectCourt(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
): Point {
  const depth = y / 15;
  const inset = width * (0.08 - depth * 0.04);
  const scale = Math.min(width / 31, height / 13);
  return {
    x: inset + (x / 28) * (width - inset * 2),
    y: height * (0.29 + depth * 0.58) - z * scale * 0.88,
    scale,
  };
}

function measureSprite(image: HTMLImageElement): void {
  if (!image.naturalWidth || !image.naturalHeight) return;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width,
      top = canvas.height,
      right = -1,
      bottom = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right >= left && bottom >= top) {
      spriteBounds.set(image, {
        x: left,
        y: top,
        width: right - left + 1,
        height: bottom - top + 1,
      });
    }
  } catch {
    // Canvas pixel access is optional; an uncropped local sprite is still usable.
  }
}

/** A missing or stalled image must never hold the exhibition loading screen open. */
export async function loadArcadeAssets(
  ids: number[],
  shinySeed?: number,
): Promise<Map<number, HTMLImageElement>> {
  const assets = new Map<number, HTMLImageElement>();
  await Promise.all(
    [...new Set(ids)]
      .filter((id) => Number.isInteger(id) && id > 0)
      .map(
        (id) =>
          new Promise<void>((resolve) => {
            let image: HTMLImageElement;
            try {
              image = new Image();
            } catch {
              resolve();
              return;
            }
            let settled = false;
            const finish = (loaded: boolean) => {
              if (settled) return;
              settled = true;
              clearTimeout(timeout);
              image.onload = null;
              image.onerror = null;
              if (loaded) {
                assets.set(id, image);
                measureSprite(image);
              }
              resolve();
            };
            const timeout = setTimeout(() => finish(false), 4000);
            image.onload = () => finish(true);
            image.onerror = () => finish(false);
            try {
              image.src = publicAsset(
                `/${isShinyPokemon(id, shinySeed) ? "pokemon-shiny" : "pokemon-pixel"}/${id}.png`,
              );
            } catch {
              finish(false);
            }
          }),
      ),
  );
  return assets;
}

function polygon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  fill?: string,
  stroke?: string,
) {
  if (!points.length) return;
  ctx.beginPath();
  points.forEach((point, index) =>
    index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y),
  );
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  stroke = false,
) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (stroke) {
    ctx.strokeStyle = color;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color = CREAM,
) {
  ctx.font = `800 ${size}px "Roboto Condensed", "Arial Narrow", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color = CREAM,
) {
  ctx.font = `800 ${fontSize}px "Roboto Condensed", "Arial Narrow", sans-serif`;
  const width = ctx.measureText(text).width + fontSize * 1.35;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(
    x - width / 2,
    y - fontSize * 0.8,
    width,
    fontSize * 1.6,
    fontSize * 0.4,
  );
  ctx.fill();
  label(ctx, text, x, y, fontSize, color);
}

function drawCourt(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const p = (x: number, y: number, z = 0) =>
    projectCourt(x, y, z, width, height);
  const scale = p(0, 0).scale;
  const background = ctx.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, "#091522");
  background.addColorStop(1, "#20364c");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Quiet arena tiers leave contrast behind the players and backboards.
  for (let tier = 0; tier < 3; tier++) {
    const y = height * (0.07 + tier * 0.058);
    ctx.fillStyle = ["#15283d", "#1a3047", "#213a50"][tier];
    ctx.fillRect(width * 0.035, y, width * 0.93, height * 0.042);
    for (let seat = 0; seat < 52; seat++) {
      ctx.fillStyle = (seat + tier * 3) % 7 === 0 ? "#b89263" : "#345064";
      ctx.fillRect(
        width * (0.05 + seat * 0.0174),
        y + height * 0.013,
        Math.max(2, width * 0.006),
        height * 0.008,
      );
    }
  }
  polygon(
    ctx,
    [p(-0.75, -0.8), p(28.75, -0.8), p(28.75, 15.9), p(-0.75, 15.9)],
    "#13283d",
  );
  polygon(
    ctx,
    [p(-0.16, -0.18), p(28.16, -0.18), p(28.16, 15.18), p(-0.16, 15.18)],
    "#f0d3a3",
  );

  // Narrow boards, offset joins, and restrained grain stay legible under motion.
  for (let row = 0; row < 30; row++) {
    const y = row / 2;
    const colors = ["#c89256", "#d29b60", "#d7a56c", "#cd985e", "#dfac73"];
    polygon(
      ctx,
      [p(0, y), p(28, y), p(28, y + 0.5), p(0, y + 0.5)],
      colors[row % colors.length],
    );
    ctx.strokeStyle = "#9a6b3b30";
    ctx.lineWidth = 0.65;
    for (let x = (row % 3) * 2; x < 28; x += 5.6) {
      const a = p(x, y),
        b = p(x, y + 0.5);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  const light = ctx.createLinearGradient(0, height * 0.3, 0, height * 0.9);
  light.addColorStop(0, "#fff3ca18");
  light.addColorStop(0.5, "#ffe8bb30");
  light.addColorStop(1, "#3c1d0c10");
  ctx.fillStyle = light;
  ctx.beginPath();
  [p(0, 0), p(28, 0), p(28, 15), p(0, 15)].forEach((v, i) =>
    i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y),
  );
  ctx.closePath();
  ctx.fill();

  polygon(
    ctx,
    [p(0, 5.05), p(5.8, 5.05), p(5.8, 9.95), p(0, 9.95)],
    "#173d4dc7",
  );
  polygon(
    ctx,
    [p(22.2, 5.05), p(28, 5.05), p(28, 9.95), p(22.2, 9.95)],
    "#833f35c7",
  );
  ctx.lineWidth = Math.max(1, scale * 0.048);
  polygon(ctx, [p(0, 0), p(28, 0), p(28, 15), p(0, 15)], undefined, "#fff4dd");
  const line = (coords: number[][], close = false) => {
    ctx.beginPath();
    coords.forEach(([x, y], i) => {
      const pt = p(x, y);
      if (i) ctx.lineTo(pt.x, pt.y);
      else ctx.moveTo(pt.x, pt.y);
    });
    if (close) ctx.closePath();
    ctx.strokeStyle = "#fff4dd";
    ctx.stroke();
  };
  const arc = (
    x: number,
    y: number,
    radius: number,
    from: number,
    to: number,
  ) => {
    const points = Array.from({ length: 65 }, (_, i) => {
      const angle = from + ((to - from) * i) / 64;
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
    });
    line(points);
  };
  line([
    [14, 0],
    [14, 15],
  ]);
  arc(14, 7.5, 1.8, 0, Math.PI * 2);
  for (const right of [false, true]) {
    const mirror = (x: number) => (right ? 28 - x : x);
    line([
      [mirror(0), 5.05],
      [mirror(5.8), 5.05],
      [mirror(5.8), 9.95],
      [mirror(0), 9.95],
    ]);
    arc(
      mirror(5.8),
      7.5,
      2.45,
      right ? Math.PI / 2 : -Math.PI / 2,
      right ? Math.PI * 1.5 : Math.PI / 2,
    );
    arc(
      mirror(1.5),
      7.5,
      6.75,
      right ? Math.PI / 2 : -Math.PI / 2,
      right ? Math.PI * 1.5 : Math.PI / 2,
    );
    line([
      [mirror(0), 0.75],
      [mirror(1.5), 0.75],
    ]);
    line([
      [mirror(0), 14.25],
      [mirror(1.5), 14.25],
    ]);
    arc(
      mirror(1.5),
      7.5,
      1.25,
      right ? Math.PI / 2 : -Math.PI / 2,
      right ? Math.PI * 1.5 : Math.PI / 2,
    );
  }
  const center = p(14, 7.5);
  ellipse(ctx, center.x, center.y, scale * 1.27, scale * 0.78, "#173248e8");
  label(ctx, "POKÉ", center.x, center.y - scale * 0.15, scale * 0.48);
  label(
    ctx,
    "HOOPS",
    center.x,
    center.y + scale * 0.28,
    scale * 0.39,
    "#f2b66b",
  );
  label(
    ctx,
    "EXHIBITION  /  FIVE ON FIVE",
    width / 2,
    height * 0.955,
    Math.max(8, scale * 0.28),
    "#c4d3df",
  );
  if (width >= 600) {
    label(
      ctx,
      "HOME",
      width * 0.25,
      height * 0.245,
      scale * 0.3,
      TEAM_COLORS[0],
    );
    label(
      ctx,
      "AWAY",
      width * 0.75,
      height * 0.245,
      scale * 0.3,
      TEAM_COLORS[1],
    );
  }
}

function eventAge(
  state: Pick<ArcadeState, "elapsed"> & Partial<Pick<ArcadeState, "tick">>,
  event: ArcadeEvent & { tick?: number },
) {
  return event.tick !== undefined && state.tick !== undefined
    ? (state.tick - event.tick) / 60
    : state.elapsed - event.time;
}

export function recentRimContact(
  state: Pick<ArcadeState, "events" | "period" | "elapsed" | "ball"> &
    Partial<Pick<ArcadeState, "tick">>,
  side: 0 | 1,
): { age: number; dunk: boolean } | null {
  for (let index = state.events.length - 1; index >= 0; index--) {
    const event = state.events[index];
    if (event.kind !== "score" && event.kind !== "shot") continue;
    const basketSide = (event.team === 0) === state.period < 3 ? 1 : 0;
    if (basketSide !== side) return null;
    let age = eventAge(state, event);
    if (event.kind === "shot") {
      const ball = state.ball;
      if (
        ball.mode !== "loose" ||
        ball.made ||
        ball.reboundOf === null ||
        ball.travel < ball.duration ||
        ball.end.z <= 0 ||
        Math.abs(ball.end.x - (side ? 26.5 : 1.5)) > 0.1
      )
        return null;
      age -= ball.duration;
    }
    return age >= 0 && age < 0.48 ? { age, dunk: state.ball.dunk } : null;
  }
  return null;
}

function drawHoop(
  ctx: CanvasRenderingContext2D,
  side: 0 | 1,
  state: ArcadeState,
  width: number,
  height: number,
  reducedMotion: boolean,
) {
  const x = side ? 26.5 : 1.5;
  const direction = side ? -1 : 1;
  const rim = projectCourt(x, 7.5, 2.6, width, height);
  const base = projectCourt(side ? 28.5 : -0.5, 7.5, 0, width, height);
  const board = projectCourt(x - direction * 0.45, 7.5, 3, width, height);
  const s = rim.scale;
  const impact = reducedMotion ? null : recentRimContact(state, side);
  const pulse = impact
    ? Math.sin(impact.age * 45) *
      s *
      (impact.dunk ? 0.12 : 0.055) *
      (1 - impact.age / 0.48)
    : 0;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#091b2b";
  ctx.lineWidth = s * 0.22;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(base.x, board.y + s * 0.2);
  ctx.lineTo(board.x, board.y + s * 0.2);
  ctx.stroke();
  ctx.strokeStyle = "#8da0ae";
  ctx.lineWidth = s * 0.07;
  ctx.stroke();
  ctx.fillStyle = "#eff6f2e8";
  ctx.strokeStyle = "#718798";
  ctx.lineWidth = Math.max(1, s * 0.065);
  ctx.fillRect(board.x - s * 0.17, board.y - s * 0.65, s * 0.34, s * 1.3);
  ctx.strokeRect(board.x - s * 0.17, board.y - s * 0.65, s * 0.34, s * 1.3);
  ctx.fillStyle = "#ed7654";
  ctx.fillRect(board.x - s * 0.19, board.y + s * 0.12, s * 0.38, s * 0.09);
  ctx.strokeStyle = "#fff4d8c9";
  ctx.lineWidth = Math.max(0.8, s * 0.034);
  const rimY = rim.y + pulse;
  for (let strand = -2; strand <= 2; strand++) {
    ctx.beginPath();
    ctx.moveTo(rim.x + strand * s * 0.17, rimY);
    ctx.lineTo(rim.x + strand * s * 0.1, rimY + s * 0.5);
    ctx.stroke();
  }
  ellipse(ctx, rim.x, rimY + s * 0.45, s * 0.22, s * 0.065, "#fff4d8b0", true);
  ctx.lineWidth = Math.max(1.6, s * 0.075);
  ellipse(ctx, rim.x, rimY, s * 0.4, s * 0.13, "#ff8458", true);
  if (impact?.dunk) {
    const ground = projectCourt(x, 7.5, 0, width, height);
    ctx.save();
    ctx.globalAlpha = (1 - impact.age / 0.48) * 0.7;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ellipse(
      ctx,
      ground.x,
      ground.y,
      s * (0.55 + impact.age * 3.5),
      s * (0.18 + impact.age * 1.2),
      "#fff1a5",
      true,
    );
    ctx.restore();
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: ArcadePlayer,
  state: ArcadeState,
  assets: Map<number, HTMLImageElement>,
  width: number,
  height: number,
  reducedMotion: boolean,
) {
  const ground = projectCourt(player.x, player.y, 0, width, height);
  const actor = projectCourt(player.x, player.y, player.z, width, height);
  const s = actor.scale;
  const controlled = player.id === state.controlled;
  const isTarget =
    player.id === state.passTarget &&
    state.possession === 0 &&
    state.ball.owner !== player.id;
  const color = TEAM_COLORS[player.team];
  const speed = Math.hypot(player.vx, player.vy);
  const phase = state.tick * 0.27 + player.id * 1.9;
  const run = speed > 0.3;
  const bounce =
    run && !reducedMotion && player.z < 0.05
      ? Math.abs(Math.sin(phase)) * s * 0.11
      : 0;
  const fire = state.fire[player.team] > 0;
  ellipse(
    ctx,
    ground.x,
    ground.y + s * 0.05,
    s * (0.57 - Math.min(player.z, 2) * 0.08),
    s * 0.19,
    "#11233455",
  );
  ctx.lineWidth = Math.max(1.5, s * 0.065);
  ellipse(ctx, ground.x, ground.y, s * 0.64, s * 0.26, color, true);
  if (controlled) {
    ctx.lineWidth = Math.max(2, s * 0.075);
    ellipse(ctx, ground.x, ground.y, s * 0.84, s * 0.34, "#fff1a5", true);
  }
  if (isTarget) {
    ctx.setLineDash([s * 0.12, s * 0.1]);
    ctx.lineWidth = Math.max(1.5, s * 0.055);
    ellipse(ctx, ground.x, ground.y, s * 0.94, s * 0.4, CREAM, true);
    ctx.setLineDash([]);
    pill(ctx, "PASS", ground.x, ground.y + s * 0.65, Math.max(7, s * 0.24));
  }
  if (fire) {
    const aura = TYPE_COLORS[player.type.toLowerCase()] ?? TYPE_COLORS.normal;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ellipse(ctx, actor.x, actor.y - s * 0.7, s * 0.85, s * 1.05, aura);
    ctx.restore();
    if (!reducedMotion) {
      ctx.strokeStyle = aura;
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      for (let spark = 0; spark < 3; spark++) {
        const offset = (state.tick * 0.018 + spark * 0.33) % 1;
        const sx = actor.x + Math.sin(spark * 2 + player.id) * s * 0.7;
        ctx.globalAlpha = 1 - offset;
        ctx.beginPath();
        ctx.moveTo(sx, actor.y - s * offset * 2.1);
        ctx.lineTo(sx + s * 0.1, actor.y - s * (offset * 2.1 + 0.23));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  if (!reducedMotion && speed > 5.3) {
    const direction = Math.sign(player.vx) || player.facing || 1;
    ctx.lineWidth = Math.max(1, s * 0.045);
    for (let trail = 0; trail < 3; trail++) {
      ctx.strokeStyle = `${color}99`;
      ctx.beginPath();
      ctx.moveTo(
        actor.x - direction * s * (0.55 + trail * 0.15),
        actor.y - s * (0.4 + trail * 0.3),
      );
      ctx.lineTo(
        actor.x - direction * s * (1 + trail * 0.3),
        actor.y - s * (0.4 + trail * 0.3),
      );
      ctx.stroke();
    }
  }
  const sprite = assets.get(player.pokemonId);
  let spriteHeight = s * 1.95;
  ctx.save();
  ctx.translate(actor.x, actor.y - bounce);
  const lean =
    player.action === "steal"
      ? 0.23
      : player.action === "pass"
        ? 0.14
        : player.action === "dunk"
          ? -0.16
          : run
            ? Math.sin(phase) * 0.035
            : 0;
  ctx.rotate(reducedMotion ? 0 : lean * (player.facing || 1));
  ctx.scale(player.facing < 0 ? -1 : 1, 1);
  if (sprite) {
    const bounds = spriteBounds.get(sprite) ?? {
      x: 0,
      y: 0,
      width: sprite.naturalWidth || 96,
      height: sprite.naturalHeight || 96,
    };
    const factor = Math.min(
      (s * 2.25) / bounds.width,
      spriteHeight / bounds.height,
    );
    const spriteWidth = bounds.width * factor;
    spriteHeight = bounds.height * factor;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sprite,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      -spriteWidth / 2,
      -spriteHeight,
      spriteWidth,
      spriteHeight,
    );
  } else {
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, s * 0.055);
    ctx.beginPath();
    ctx.roundRect(-s * 0.5, -s * 1.4, s, s * 1.25, s * 0.3);
    ctx.fill();
    ctx.stroke();
    ellipse(ctx, -s * 0.15, -s, s * 0.055, s * 0.09, INK);
    ellipse(ctx, s * 0.15, -s, s * 0.055, s * 0.09, INK);
    spriteHeight = s * 1.4;
  }
  ctx.restore();
  if (controlled) {
    const top = actor.y - spriteHeight - s * 0.32 - bounce;
    polygon(
      ctx,
      [
        { x: actor.x - s * 0.16, y: top - s * 0.18, scale: s },
        { x: actor.x + s * 0.16, y: top - s * 0.18, scale: s },
        { x: actor.x, y: top, scale: s },
      ],
      "#fff1a5",
    );
  }
  if (controlled || state.ball.owner === player.id || !sprite) {
    pill(
      ctx,
      player.name.toUpperCase(),
      actor.x,
      ground.y + s * (isTarget ? 1.03 : 0.59),
      Math.max(8, s * 0.29),
      controlled ? "#fff1a5" : CREAM,
    );
  }
  if (player.charge !== null)
    drawShotMeter(
      ctx,
      player.charge,
      actor.x,
      actor.y - spriteHeight - s * 0.72,
      s,
    );
}

function drawShotMeter(
  ctx: CanvasRenderingContext2D,
  charge: number,
  x: number,
  y: number,
  s: number,
) {
  const width = Math.max(42, s * 2.3),
    height = Math.max(6, s * 0.25);
  const left = x - width / 2;
  ctx.fillStyle = INK;
  ctx.fillRect(left - 2, y - 2, width + 4, height + 4);
  ctx.fillStyle = "#556577";
  ctx.fillRect(left, y, width, height);
  ctx.fillStyle = "#97e5a0";
  ctx.fillRect(left + width * (0.53 / 1.2), y, width * (0.24 / 1.2), height);
  ctx.fillStyle = CREAM;
  ctx.fillRect(
    left + width * Math.min(1, Math.max(0, charge / 1.2)) - 1,
    y - 3,
    2,
    height + 6,
  );
  label(ctx, "RELEASE", x, y - Math.max(8, s * 0.26), Math.max(7, s * 0.23));
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  state: ArcadeState,
  width: number,
  height: number,
  reducedMotion: boolean,
) {
  const ball = state.ball;
  const owner =
    ball.owner === null
      ? undefined
      : state.players.find((player) => player.id === ball.owner);
  let x = ball.x,
    y = ball.y,
    z = ball.z;
  if (ball.mode === "held" && owner) {
    const shooting = owner.charge !== null;
    x = owner.x + (owner.facing || 1) * (shooting ? 0.35 : 0.62);
    y = owner.y + 0.09;
    const dribble = Math.abs(Math.sin(state.tick * 0.21));
    z = owner.z + (shooting ? 1.75 : 0.3 + dribble * 0.65);
  }
  const ground = projectCourt(x, y, 0, width, height);
  const point = projectCourt(x, y, z, width, height);
  const s = point.scale;
  ellipse(ctx, ground.x, ground.y + s * 0.05, s * 0.18, s * 0.065, "#10233966");
  if (!reducedMotion && ball.mode === "shot") {
    ctx.strokeStyle = "#fff0c688";
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = "round";
    const dx = ball.end.x - ball.start.x,
      dy = ball.end.y - ball.start.y;
    const trail = projectCourt(
      x - dx * 0.025,
      y - dy * 0.025,
      z - 0.12,
      width,
      height,
    );
    ctx.beginPath();
    ctx.moveTo(trail.x, trail.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }
  const radius = Math.max(3.1, s * 0.23);
  ellipse(ctx, point.x, point.y, radius + 1, radius + 1, INK);
  ellipse(ctx, point.x, point.y, radius, radius, "#f5a04d");
  ctx.save();
  ctx.translate(point.x, point.y);
  if (!reducedMotion) ctx.rotate(state.tick * 0.08);
  ctx.strokeStyle = "#79431e";
  ctx.lineWidth = Math.max(0.7, s * 0.027);
  ctx.beginPath();
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.46, radius, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFeedback(
  ctx: CanvasRenderingContext2D,
  state: ArcadeState,
  width: number,
  height: number,
  reducedMotion: boolean,
) {
  const scale = projectCourt(0, 0, 0, width, height).scale;
  if (state.message && state.messageTime > 0) {
    const text = state.message.toUpperCase();
    const size = Math.min(
      Math.max(11, scale * 0.45),
      width / Math.max(16, text.length * 0.65),
    );
    pill(ctx, text, width / 2, height * 0.19, size, "#ffe2a7");
  }
  if (state.phase === "tipoff") {
    pill(
      ctx,
      "J / SHOOT TO WIN THE TIP",
      width / 2,
      height * 0.75,
      Math.max(10, scale * 0.36),
    );
  }
  const score = [...state.events]
    .reverse()
    .find((event) => event.kind === "score");
  const age = score ? eventAge(state, score) : Infinity;
  if (score && age >= 0 && age < 1.1) {
    const fade = Math.max(0, 1 - age / 1.1);
    ctx.save();
    ctx.globalAlpha = fade;
    pill(
      ctx,
      `+${score.value ?? 2}`,
      width * (score.team === 0 ? 0.37 : 0.63),
      height * 0.4 - (reducedMotion ? 0 : (1 - fade) * scale * 0.4),
      Math.max(18, scale * 0.75),
      TEAM_COLORS[score.team],
    );
    ctx.restore();
  }
}

/** Read-only rendering. The caller supplies logical dimensions and its DPR transform. */
export function drawArcade(
  ctx: CanvasRenderingContext2D,
  state: ArcadeState,
  assets: Map<number, HTMLImageElement>,
  width: number,
  height: number,
  reducedMotion: boolean,
): void {
  if (width <= 0 || height <= 0) return;
  ctx.save();
  try {
    drawCourt(ctx, width, height);
    const actors: { depth: number; draw: () => void }[] = state.players
      .filter((player) => player.active)
      .map((player) => ({
        depth: player.y,
        draw: () =>
          drawPlayer(ctx, player, state, assets, width, height, reducedMotion),
      }));
    actors.push({
      depth: 7.5,
      draw: () => drawHoop(ctx, 0, state, width, height, reducedMotion),
    });
    actors.push({
      depth: 7.5,
      draw: () => drawHoop(ctx, 1, state, width, height, reducedMotion),
    });
    actors.sort((a, b) => a.depth - b.depth).forEach((actor) => actor.draw());
    drawBall(ctx, state, width, height, reducedMotion);
    drawFeedback(ctx, state, width, height, reducedMotion);
  } finally {
    ctx.restore();
  }
}
