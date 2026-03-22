/**
 * Camera shake system.
 * Intensities: shot (еле заметно), hit (чуть сильнее), explosion (ещё сильнее).
 */

let shakeIntensity = 0;
let shakeDuration = 0;
let shakeTimer = 0;

/**
 * Trigger camera shake.
 * @param {'shot' | 'hit' | 'explosionNear' | 'explosionDamage'} type
 */
export function triggerShake(type) {
    const presets = {
        shot:            { intensity: 2.0,  duration: 0.10 },
        hit:             { intensity: 5.0,  duration: 0.15 },
        explosionNear:   { intensity: 5.0,  duration: 0.18 },
        explosionDamage: { intensity: 8.0,  duration: 0.22 },
    };
    const p = presets[type] || presets.shot;
    // Don't override stronger shake with weaker one
    if (p.intensity >= shakeIntensity || shakeTimer <= 0) {
        shakeIntensity = p.intensity;
        shakeDuration = p.duration;
        shakeTimer = p.duration;
    }
}

/**
 * Get current shake offset. Call once per frame.
 * @param {number} dt - delta time in seconds
 * @returns {{ x: number, y: number }}
 */
export function getShakeOffset(dt) {
    if (shakeTimer <= 0) return { x: 0, y: 0 };
    shakeTimer -= dt;
    const progress = Math.max(0, shakeTimer / shakeDuration);
    const currentIntensity = shakeIntensity * progress;
    return {
        x: (Math.random() - 0.5) * 2 * currentIntensity,
        y: (Math.random() - 0.5) * 2 * currentIntensity,
    };
}
