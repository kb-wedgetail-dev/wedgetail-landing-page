const loopingClips = new Set(['idle_A0', 'fly_A0', 'gliding_A0']);

// Saved time is the starting frame. Transition clips remain scroll-controlled;
// repeating clips keep moving while the visitor reads a section.
export function referenceTime(reference, elapsed = 0) {
  const start = Math.max(0, reference.time || 0);
  return start + (loopingClips.has(reference.clip) ? elapsed * (reference.speed ?? 1) : 0);
}
