"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, type Ref } from "react";

import styles from "@/components/water-sort/water-sort.module.css";
import type { ColorId } from "@/lib/water-sort/domain/colors";
import { LIQUID_COLORS } from "@/lib/water-sort/presentation/palette";
import { DEFAULT_VIAL_SKIN } from "@/lib/water-sort/presentation/vial-skins";

const VIAL_CAPACITY = 4;
const LIQUID_BOTTOM = 259;
const LIQUID_TOP = DEFAULT_VIAL_SKIN.liquidSurfaceY;
const LAYER_HEIGHT = (LIQUID_BOTTOM - LIQUID_TOP) / VIAL_CAPACITY;
const SOURCE_TOP_Y = LIQUID_BOTTOM - LAYER_HEIGHT * 2;
const DESTINATION_NEW_TOP_Y = LIQUID_BOTTOM - LAYER_HEIGHT * 3;

const CLIP_ID = "home-hero-vial-interior";
const GLASS_GRADIENT_ID = "home-hero-glass-gradient";
const EDGE_GRADIENT_ID = "home-hero-edge-gradient";
const STREAM_GRADIENT_ID = "home-hero-stream-gradient";

// These demo-only vials deliberately use simple SVG paint instead of a
// second WebGL renderer. Gameplay keeps its existing Pixi liquid simulation.
function HeroVial({
  positionX,
  colors,
  groupRef,
  animatedBand,
}: {
  positionX: number;
  colors: readonly ColorId[];
  groupRef: Ref<SVGGElement>;
  animatedBand?: {
    color: ColorId;
    initialY: number;
    initialHeight: number;
    elementRef: Ref<SVGRectElement>;
  };
}) {
  return (
    <g transform={`translate(${positionX} 22) scale(0.7)`}>
      <g ref={groupRef}>
        <g clipPath={`url(#${CLIP_ID})`}>
          {colors.map((color, index) => (
            <rect
              key={index}
              x={14.5}
              y={LIQUID_BOTTOM - (index + 1) * LAYER_HEIGHT}
              width={71}
              height={LAYER_HEIGHT + 0.5}
              fill={LIQUID_COLORS[color]}
            />
          ))}
          {animatedBand !== undefined && (
            <rect
              ref={animatedBand.elementRef}
              x={14.5}
              y={animatedBand.initialY}
              width={71}
              height={animatedBand.initialHeight}
              fill={LIQUID_COLORS[animatedBand.color]}
            />
          )}
        </g>
        <path
          d="M12 18V214C12 246 28 262 50 262C72 262 88 246 88 214V18Z"
          fill={`url(#${GLASS_GRADIENT_ID})`}
        />
        <path
          d="M12 18V214C12 246 28 262 50 262C72 262 88 246 88 214V18"
          stroke={`url(#${EDGE_GRADIENT_ID})`}
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          cx="50"
          cy="18"
          rx="38"
          ry="7.5"
          fill="#07131c"
          fillOpacity="0.27"
          stroke="#9edcf5"
          strokeOpacity="0.66"
          strokeWidth="3.5"
        />
        <ellipse
          cx="50"
          cy="18"
          rx="32.5"
          ry="4.7"
          fill="#061018"
          fillOpacity="0.32"
          stroke="#effbff"
          strokeOpacity="0.26"
          strokeWidth="1.4"
        />
        <path
          d="M12 18C20 27 80 27 88 18"
          stroke="#f1fbff"
          strokeOpacity="0.62"
          strokeWidth="2.1"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M19 34V198C19 224 28 242 40 250"
          stroke="#ffffff"
          strokeOpacity="0.27"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </g>
  );
}

export function HomeHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<SVGGElement>(null);
  const destinationRef = useRef<SVGGElement>(null);
  const thirdVialRef = useRef<SVGGElement>(null);
  const sourceTopRef = useRef<SVGRectElement>(null);
  const destinationTopRef = useRef<SVGRectElement>(null);
  const streamRef = useRef<SVGPathElement>(null);

  useGSAP(() => {
    const source = sourceRef.current;
    const destination = destinationRef.current;
    const thirdVial = thirdVialRef.current;
    const sourceTop = sourceTopRef.current;
    const destinationTop = destinationTopRef.current;
    const stream = streamRef.current;

    if (
      source === null || destination === null || thirdVial === null
      || sourceTop === null || destinationTop === null || stream === null
    ) return;

    // Initial SVG markup is already visible, even before hydration or GSAP.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });

    timeline.set(source, { x: 0, y: 0, rotation: 0, transformOrigin: "88px 18px" }, 0);
    timeline.set([destination, thirdVial], { y: 0 }, 0);
    timeline.set(sourceTop, { attr: { y: SOURCE_TOP_Y, height: LAYER_HEIGHT } }, 0);
    timeline.set(destinationTop, { attr: { y: SOURCE_TOP_Y, height: 0 } }, 0);
    timeline.set(stream, { opacity: 0 }, 0);
    timeline.from(
      [source, destination, thirdVial],
      { y: 13, duration: 0.42, stagger: 0.09, ease: "back.out(1.5)" },
      0,
    );
    timeline.to(
      source,
      { x: 89, y: -41, rotation: 74, duration: 0.54, ease: "power2.inOut" },
      0.94,
    );
    timeline.to(stream, { opacity: 1, duration: 0.13 }, 1.36);
    timeline.to(
      sourceTop,
      { attr: { y: SOURCE_TOP_Y + LAYER_HEIGHT, height: 0 }, duration: 0.4, ease: "none" },
      1.47,
    );
    timeline.to(
      destinationTop,
      { attr: { y: DESTINATION_NEW_TOP_Y, height: LAYER_HEIGHT }, duration: 0.4, ease: "none" },
      1.47,
    );
    timeline.to(stream, { opacity: 0, duration: 0.12 }, 1.84);
    timeline.to(
      source,
      { x: 0, y: 0, rotation: 0, duration: 0.53, ease: "power2.inOut" },
      2.02,
    );

    return () => timeline.kill();
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={styles.homeHero} aria-hidden="true">
      <svg className={styles.homeHeroSvg} viewBox="0 0 340 230" fill="none">
        <defs>
          <clipPath id={CLIP_ID} clipPathUnits="userSpaceOnUse">
            <polygon
              points={DEFAULT_VIAL_SKIN.liquidPolygon.map(({x, y}) => `${x},${y}`).join(" ")}
            />
          </clipPath>
          <linearGradient id={GLASS_GRADIENT_ID} x1="10" y1="136" x2="90" y2="136" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#dff7ff" stopOpacity="0.10" />
            <stop offset="0.18" stopColor="#ffffff" stopOpacity="0.025" />
            <stop offset="0.72" stopColor="#8ddcff" stopOpacity="0.015" />
            <stop offset="1" stopColor="#bcecff" stopOpacity="0.09" />
          </linearGradient>
          <linearGradient id={EDGE_GRADIENT_ID} x1="10" y1="0" x2="90" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9edcf5" stopOpacity="0.78" />
            <stop offset="0.5" stopColor="#5d8fa8" stopOpacity="0.60" />
            <stop offset="1" stopColor="#9edcf5" stopOpacity="0.78" />
          </linearGradient>
          <linearGradient id={STREAM_GRADIENT_ID} x1="150" y1="0" x2="144" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={LIQUID_COLORS.coral} stopOpacity="0.8" />
            <stop offset="1" stopColor={LIQUID_COLORS.coral} />
          </linearGradient>
        </defs>
        <HeroVial
          positionX={26}
          colors={["cocoa"]}
          groupRef={sourceRef}
          animatedBand={{
            color: "coral",
            initialY: SOURCE_TOP_Y,
            initialHeight: LAYER_HEIGHT,
            elementRef: sourceTopRef,
          }}
        />
        <HeroVial
          positionX={135}
          colors={["coral", "coral"]}
          groupRef={destinationRef}
          animatedBand={{
            color: "coral",
            initialY: SOURCE_TOP_Y,
            initialHeight: 0,
            elementRef: destinationTopRef,
          }}
        />
        <HeroVial
          positionX={244}
          colors={["sky", "sky", "sky", "sky"]}
          groupRef={thirdVialRef}
        />
        <path
          ref={streamRef}
          d="M 151 6 Q 153 26 144 41"
          stroke={`url(#${STREAM_GRADIENT_ID})`}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0"
        />
      </svg>
    </div>
  );
}
