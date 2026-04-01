/**
 * WebGL-освещение через Pixi.js: normal map + направленный свет.
 *
 * Спрайт запекается в своей ЛОКАЛЬНОЙ ориентации (как в PNG).
 * Вектор света поворачивается на -angle танка, чтобы имитировать
 * неподвижное мировое солнце при вращении танка.
 */
import * as PIXI from 'pixi.js';

/* ─── Шейдер (простой, без поворота нормалей) ─── */
const NORMAL_MAP_FRAG = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uNormalMap;
uniform vec3 uLightDir;
uniform float uAmbient;
uniform float uLightIntensity;

void main() {
    vec4 color = texture2D(uSampler, vTextureCoord);
    if (color.a < 0.01) discard;

    vec3 normal = texture2D(uNormalMap, vTextureCoord).rgb * 2.0 - 1.0;
    normal.y = -normal.y;  // компенсация UNPACK_FLIP_Y_WEBGL
    normal = normalize(normal);

    float NdotL = max(dot(normal, uLightDir), 0.0);
    vec3 lit = color.rgb * (uAmbient + uLightIntensity * NdotL);

    gl_FragColor = vec4(min(lit, vec3(1.0)), color.a);
}
`;

/* ─── Скрытый WebGL-рендерер ─── */
let renderer = null;

function getRenderer() {
    if (!renderer) {
        try {
            renderer = new PIXI.Renderer({
                width: 256,
                height: 256,
                backgroundAlpha: 0,
            });
        } catch (e) {
            console.warn('WebGL не доступен для normal map освещения:', e);
            return null;
        }
    }
    return renderer;
}

/* ─── Настройки глобального света ─── */
// Мировое направление К свету: верхний левый, под ~45°
const WORLD_LIGHT = { x: -0.5, y: -0.7, z: 0.5 };
const len = Math.sqrt(WORLD_LIGHT.x ** 2 + WORLD_LIGHT.y ** 2 + WORLD_LIGHT.z ** 2);
WORLD_LIGHT.x /= len;
WORLD_LIGHT.y /= len;
WORLD_LIGHT.z /= len;

const AMBIENT = 0.55;
const LIGHT_INTENSITY = 1.0;

/**
 * Поворачиваем мировой свет в локальное пространство спрайта.
 * Танк повернулся на angle → солнце в его системе координат сдвинулось на -angle.
 */
function getLocalLightDir(worldAngle) {
    const cos = Math.cos(-worldAngle);
    const sin = Math.sin(-worldAngle);
    return [
        cos * WORLD_LIGHT.x - sin * WORLD_LIGHT.y,
        sin * WORLD_LIGHT.x + cos * WORLD_LIGHT.y,
        WORLD_LIGHT.z,
    ];
}

/**
 * Запекает спрайт с normal map освещением.
 * Спрайт остаётся в своей локальной ориентации (как в PNG файле).
 * Canvas 2D потом рисует его с обычным ctx.rotate().
 *
 * @param {HTMLImageElement} colorImg — цветная текстура
 * @param {HTMLImageElement} normalMapImg — карта нормалей
 * @param {number} scale — масштаб
 * @param {number} worldAngle — мировой угол объекта (рад), для поворота света
 * @returns {HTMLCanvasElement|null}
 */
export function bakeLitSprite(colorImg, normalMapImg, scale, worldAngle) {
    const r = getRenderer();
    if (!r) return null;

    const w = Math.round(colorImg.naturalWidth * scale);
    const h = Math.round(colorImg.naturalHeight * scale);
    r.resize(w, h);

    const colorTex = PIXI.Texture.from(colorImg);
    const normalTex = PIXI.Texture.from(normalMapImg);

    const sprite = new PIXI.Sprite(colorTex);
    sprite.width = w;
    sprite.height = h;

    // Свет повёрнут в локальную систему координат спрайта
    const localLight = getLocalLightDir(worldAngle);

    const filter = new PIXI.Filter(null, NORMAL_MAP_FRAG, {
        uLightDir: localLight,
        uAmbient: AMBIENT,
        uLightIntensity: LIGHT_INTENSITY,
    });
    filter.uniforms.uNormalMap = normalTex;

    sprite.filters = [filter];

    const stage = new PIXI.Container();
    stage.addChild(sprite);

    const rt = PIXI.RenderTexture.create({ width: w, height: h });
    r.render(stage, { renderTexture: rt });

    const canvas = r.extract.canvas(rt);

    rt.destroy(true);
    sprite.destroy();
    stage.destroy();

    return canvas;
}

/* ─── Point-light шейдер (вспышка выстрела) ─── */
const POINT_LIGHT_FRAG = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D uNormalMap;
uniform vec2 uLightUV;
uniform float uLightIntensity;
uniform float uAspect;

void main() {
    vec4 color = texture2D(uSampler, vTextureCoord);
    if (color.a < 0.01) discard;

    vec3 normal = texture2D(uNormalMap, vTextureCoord).rgb * 2.0 - 1.0;
    normal.y = -normal.y;
    normal = normalize(normal);

    vec2 diff = uLightUV - vTextureCoord;
    diff.x *= uAspect;

    vec3 lightDir = normalize(vec3(diff * 4.0, 0.4));

    float dist = length(diff);
    float atten = 1.0 / (1.0 + dist * dist * 25.0);

    float NdotL = max(dot(normal, lightDir), 0.0);
    float brightness = NdotL * atten * uLightIntensity;

    vec3 flashColor = color.rgb * vec3(1.0, 0.78, 0.45) * brightness;
    gl_FragColor = vec4(flashColor, color.a);
}
`;

/**
 * Рендерит overlay вспышки (point light) через normal map.
 * Результат рисуется поверх танка с globalCompositeOperation='lighter'.
 *
 * @param {HTMLImageElement} colorImg — цветная текстура
 * @param {HTMLImageElement} normalMapImg — карта нормалей
 * @param {number} scale — масштаб спрайта
 * @param {number} lightLocalX — позиция света в локальных координатах спрайта (px, от центра)
 * @param {number} lightLocalY — позиция света в локальных координатах спрайта (px, от центра)
 * @param {number} intensity — яркость вспышки (0..3+)
 * @returns {HTMLCanvasElement|null}
 */
export function renderFlashOverlay(colorImg, normalMapImg, scale, lightLocalX, lightLocalY, intensity) {
    const r = getRenderer();
    if (!r) return null;

    const w = Math.round(colorImg.naturalWidth * scale);
    const h = Math.round(colorImg.naturalHeight * scale);
    r.resize(w, h);

    const colorTex = PIXI.Texture.from(colorImg);
    const normalTex = PIXI.Texture.from(normalMapImg);

    const sprite = new PIXI.Sprite(colorTex);
    sprite.width = w;
    sprite.height = h;

    // Конвертируем локальные пиксели (от центра) в UV (0-1)
    const uv = [0.5 + lightLocalX / w, 0.5 + lightLocalY / h];

    const filter = new PIXI.Filter(null, POINT_LIGHT_FRAG, {
        uLightUV: uv,
        uLightIntensity: intensity,
        uAspect: w / h,
    });
    filter.uniforms.uNormalMap = normalTex;

    sprite.filters = [filter];

    const stage = new PIXI.Container();
    stage.addChild(sprite);

    const rt = PIXI.RenderTexture.create({ width: w, height: h });
    r.render(stage, { renderTexture: rt });

    const canvas = r.extract.canvas(rt);

    rt.destroy(true);
    sprite.destroy();
    stage.destroy();

    return canvas;
}
