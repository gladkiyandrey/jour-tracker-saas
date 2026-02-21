"use client";

import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const tailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let dotX = mouseX;
    let dotY = mouseY;
    let tailX = mouseX;
    let tailY = mouseY;
    let raf = 0;

    const onMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const frame = () => {
      dotX += (mouseX - dotX) * 0.35;
      dotY += (mouseY - dotY) * 0.35;
      tailX += (dotX - tailX) * 0.16;
      tailY += (dotY - tailY) * 0.16;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dotX}px, ${dotY}px, 0)`;
      }
      if (tailRef.current) {
        tailRef.current.style.transform = `translate3d(${tailX}px, ${tailY}px, 0)`;
      }

      raf = requestAnimationFrame(frame);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={tailRef} className="custom-cursor-tail" aria-hidden />
      <div ref={dotRef} className="custom-cursor-dot" aria-hidden />
    </>
  );
}

