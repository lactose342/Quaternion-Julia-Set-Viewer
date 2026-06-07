export const CONFIG = {
    QUALITY: { 
        LOW: { steps: 150, iter: 15 }, 
        HIGH: { steps: 800, iter: 80 },
        EXPORT: { steps: 4000, iter: 120 }
    },
    RENDER_SETTINGS: {
        STEP_DIST_NORMAL: 0.95,
        STEP_DIST_EXPORT: 0.4,
        AO_BASE_NORMAL: 10.0,
        AO_BASE_EXPORT: 24.0
    },
    MAX_RENDER_SIZE: 1200,
    SYSTEM: {
        MAX_HISTORY: 30,
        DEFAULT_QUALITY: 'HIGH',
        AMP_LIMIT: 1.2
    },
    SCHEMAS: {
        camera: ['position', 'target'],
        fractal: ['cx', 'cy', 'cz', 'cw', 'rotX', 'rotY', 'rotZ', 'rotXW', 'rotYW', 'rotZW', 'fov'],
        material: ['hue', 'saturation', 'brightness', 'aoPower', 'specular', 'bgColor'],
        animation: ['speed', 'amp', 'sx', 'ax', 'px', 'sy', 'ay', 'py', 'sz', 'az', 'pz', 'sw', 'aw', 'pw']
    },
    PRESETS: {
        preset1: { cx: -0.517, cy: -0.341, cz: -0.407, cw: -0.071, rotX: 0, rotY: 0, rotZ: 2.02, rotXW: 0, rotYW: 0, rotZW: 0, hue: 0.586, saturation: 1, brightness: 2.3, aoPower: 1, specular: 10, bgColor: '#0a0c1a', fov: 45 },
        preset2: { cx: 0.415, cy: 0.56, cz: 0.175, cw: 0.459, rotX: 0, rotY: 0.7, rotZ: 0, rotXW: 0, rotYW: 0, rotZW: 0, hue: 0.35, saturation: 1, brightness: 1.5, aoPower: 1.2, specular: 24, bgColor: '#05220d', fov: 45 },
        preset3: { cx: 0.497, cy: 0.182, cz: 0.161, cw: -0.178, rotX: 2.25, rotY: 1.29, rotZ: 2.25, rotXW: 2.92, rotYW: 0, rotZW: 0.15, hue: 0, saturation: 0.814, brightness: 2.3, aoPower: 0.1, specular: 64, bgColor: '#fe9f9f', fov: 45 },
        preset4: { cx: 0.038, cy: 0.681, cz: 0.054, cw: 0.12, rotX: 3.81, rotY: 3.45, rotZ: 0.8, rotXW: 0, rotYW: 0, rotZW: 3.22, hue: 0.114, saturation: 0.898, brightness: 2.3, aoPower: 0.6, specular: 16, bgColor: '#b87d00', fov: 45 },
        preset5: { cx: 0, cy: 0, cz: 0, cw: 0, rotX: 0, rotY: 0, rotZ: 0, rotXW: 0, rotYW: 0, rotZW: 0, hue: 0, saturation: 0, brightness: 2.7, aoPower: 0.1, specular: 64, bgColor: '#dedede', fov: 45 }
    },
    ANIM_PRESETS: {
        preset1: { speed: 0.8, amp: 0.45, sx: 1.0, ax: 1.0, px: 0.0, sy: 0.75, ay: 1.0, py: 0.0, sz: 0.5, az: 1.0, pz: 0.0, sw: 0.25, aw: 1.0, pw: 0.0 },
        preset2: { speed: 0.5, amp: 0.15, sx: 1.35, ax: 1, px: 1.3, sy: 0.7, ay: 1, py: 3.7, sz: 0.75, az: 1, pz: 1.9, sw: 1.25, aw: 1, pw: 5.1 },
        preset3: { speed: 1.0, amp: 0.5, sx: 1.2, ax: 0.85, px: 4.4, sy: 1.3, ay: 0.7, py: 2.9, sz: 0.5, az: 0.6, pz: 4, sw: 1.2, aw: 0.75, pw: 2.7 },
        preset4: { speed: 1.5, amp: 0.5, sx: 1, ax: 1, px: 0, sy: 0.75, ay: 0.7, py: 0, sz: 0.5, az: 0.6, pz: 4, sw: 0.9, aw: 0.45, pw: 0 }
    }
};