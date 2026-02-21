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
    let visible = false;

    const setVisible = (state: boolean) => {
      visible = state;
      if (dotRef.current) dotRef.current.style.opacity = state ? "1" : "0";
      if (tailRef.current) tailRef.current.style.opacity = state ? "1" : "0";
    };

    const onMove = (event: MouseEvent) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      if (!visible) setVisible(true);
    };
    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    const frame = () => {
      dotX += (mouseX - dotX) * 0.62;
      dotY += (mouseY - dotY) * 0.62;
      tailX += (dotX - tailX) * 0.36;
      tailY += (dotY - tailY) * 0.36;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${dotX}px, ${dotY}px, 0)`;
      }
      if (tailRef.current) {
        tailRef.current.style.transform = `translate3d(${tailX}px, ${tailY}px, 0)`;
      }

      raf = requestAnimationFrame(frame);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave);
    window.addEventListener("mouseenter", onEnter);
    setVisible(false);
    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      window.removeEventListener("mouseenter", onEnter);
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
