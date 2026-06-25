import { PARAMETER_DEFINITIONS, PARAMETER_SCHEMAS } from "../core/domain/ParameterDefinitions.js";

export const CONFIG = {
    QUALITY: {
        LOW: { steps: 250, iter: 15 },
        HIGH: { steps: 800, iter: 80 },
        EXPORT: { steps: 2000, iter: 120 },
        XR: { steps: 200, iter: 12 }
    },
    ADAPTIVE_QUALITY: {
        ANIM_MIN_RATIO: 0.85,      // limit resolution drop during auto-animation to maintain smoothness
        ANIM_START_RATIO: 1.2,     // pixel ratio immediately set when starting auto-animation
        INTERACT_MIN_RATIO: 1.0,   // limit resolution drop during manual drag to keep sharp visual quality (no lower than 1.0)
        INTERACT_START_RATIO: 1.3, // pixel ratio immediately set when starting manual interaction
        MAX_RATIO: 1.5,            // limit maximum pixel ratio during dynamic state to prevent chattering
    },
    RENDER_SETTINGS: {
        STEP_DIST_NORMAL: 0.95,
        STEP_DIST_EXPORT: 0.4,
        AO_BASE_NORMAL: 10.0,
        AO_BASE_EXPORT: 24.0,
        MAX_CANVAS_SIZE: 4096,
        TILE_MAX: 256
    },
    MAX_RENDER_SIZE: 1200,
    SYSTEM: {
        MAX_HISTORY: 30,
        DEFAULT_QUALITY: 'HIGH',
        AMP_LIMIT: 1.2,
        BREAKPOINT: 768
    },
    SCHEMAS: {
        camera: PARAMETER_SCHEMAS.camera,
        fractal: PARAMETER_SCHEMAS.fractal,
        material: PARAMETER_SCHEMAS.material,
        animation: PARAMETER_SCHEMAS.animation
    },
    definitions: PARAMETER_DEFINITIONS,
    UI_SECTIONS: [
        {
            id: "section-shape",
            title: "形の調整 (基本の形状)",
            open: true,
            groups: ["shape"]
        },
        {
            id: "section-rotation",
            title: "図形の回転",
            open: false,
            groups: ["rotation"],
            singleColumn: true
        },
        {
            id: "section-camera",
            title: "視野の広さとズーム",
            open: false,
            groups: ["camera"]
        },
        {
            id: "section-style",
            title: "色と見た目の質感",
            open: false,
            groups: ["style"],
            singleColumn: true
        },
        {
            id: "section-animation",
            title: "アニメーションの設定",
            open: false,
            groups: ["animation"]
        }
    ],
    PRESETS: {
        preset1: { cx: -0.517, cy: -0.341, cz: -0.407, cw: -0.071, rotX: 0, rotY: 0, rotZ: 2.02, rotXW: 0, rotYW: 0, rotZW: 0, hue: 0.586, saturation: 1, brightness: 2.3, aoPower: 1, specular: 10, bgColor: '#0a0c1a', bgAlpha: 1.0, fov: 45, zoom: 1.0, camera: { position: { x: 0, y: 0, z: 4.6 }, target: { x: 0, y: 0, z: 0 } } },
        preset2: { cx: 0.415, cy: 0.56, cz: 0.175, cw: 0.459, rotX: 0, rotY: 0.7, rotZ: 0, rotXW: 0, rotYW: 0, rotZW: 0, hue: 0.35, saturation: 1, brightness: 1.5, aoPower: 1.2, specular: 24, bgColor: '#05220d', bgAlpha: 1.0, fov: 45, zoom: 1.0, camera: { position: { x: 0, y: 0, z: 2 }, target: { x: 0, y: 0, z: 0 } } },
        preset3: { cx: -1.0, cy: 0.369, cz: 0.003, cw: 0.009, rotX: 0.0, rotY: 0.7435102613495844, rotZ: 0.9541715020653, rotXW: 0.0, rotYW: 0.0, rotZW: 0.0, hue: 0.09740259740259742, saturation: 0.37560975609756103, value: 0.803921568627451, brightness: 3.0, aoPower: 0.9, specular: 4.0, bgColor: '#fbdfbe', bgAlpha: 1.0, fov: 35.0, zoom: 1.0, camera: { position: { x: 0.752, y: -0.621, z: 3.089 }, target: { x: 0.109, y: -0.351, z: 0.112 } } },
        preset4: { cx: 0.038, cy: 0.681, cz: 0.054, cw: 0.12, rotX: 3.81, rotY: 3.45, rotZ: 0.8, rotXW: 0, rotYW: 0, rotZW: 0, hue: 0.114, saturation: 0.898, brightness: 3, aoPower: 2.1, specular: 32, bgColor: '#b87d00', bgAlpha: 1.0, fov: 45, zoom: 1.0, camera: { position: { x: -2.429, y: -1.757, z: 2.171 }, target: { x: 0, y: 0, z: 0 } } },
        preset5: { cx: 0, cy: 0, cz: 0, cw: 0, rotX: 0, rotY: 0, rotZ: 0, rotXW: 0, rotYW: 0, rotZW: 0, hue: 0, saturation: 0, brightness: 2.7, aoPower: 0.1, specular: 64, bgColor: '#dedede', bgAlpha: 1.0, fov: 45, zoom: 1.0, camera: { position: { x: 0, y: 0, z: 4 }, target: { x: 0, y: 0, z: 0 } } }
    },
    ANIM_PRESETS: {
        preset1: { speed: 0.8, amp: 0.45, sx: 1.0, ax: 1.0, px: 0.0, sy: 0.75, ay: 1.0, py: 0.0, sz: 0.5, az: 1.0, pz: 0.0, sw: 0.25, aw: 1.0, pw: 0.0 },
        preset2: { speed: 0.5, amp: 0.15, sx: 1.35, ax: 1, px: 1.3, sy: 0.7, ay: 1, py: 3.7, sz: 0.75, az: 1, pz: 1.9, sw: 1.25, aw: 1, pw: 5.1 },
        preset3: { speed: 1.0, amp: 0.5, sx: 1.2, ax: 0.85, px: 4.4, sy: 1.3, ay: 0.7, py: 2.9, sz: 0.5, az: 0.6, pz: 4, sw: 1.2, aw: 0.75, pw: 2.7 },
        preset4: { speed: 1.5, amp: 0.5, sx: 1, ax: 1, px: 0, sy: 0.75, ay: 0.7, py: 0, sz: 0.5, az: 0.6, pz: 4, sw: 0.9, aw: 0.45, pw: 0 }
    }
};