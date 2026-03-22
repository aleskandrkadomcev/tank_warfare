import grassBaseUrl from '../game-assets/images/grass_base.png?url';
import grassOverlayUrl from '../game-assets/images/grass_overlay.png?url';
import perlinMaskUrl from '../game-assets/images/perlin_mask.png?url';
import forestUrl from '../game-assets/images/forest.png?url';
import tankBaseUrl from '../game-assets/images/tank_base_green.png?url';
import tankTurretUrl from '../game-assets/images/tank_turret_green.png?url';
import brickHitUrl from '../game-assets/sounds/brick_hit.mp3?url';
import explosionUrl from '../game-assets/sounds/explosion.mp3?url';
import hitUrl from '../game-assets/sounds/hit.mp3?url';
import shootUrl from '../game-assets/sounds/shoot.mp3?url';

const totalAssets = 10;
let assetsLoadedCount = 0;

function checkAssetsLoaded(assets) {
  assetsLoadedCount++;
  if (assetsLoadedCount >= totalAssets) {
    assets.loaded = true;
    console.log('✅ Все ассеты загружены');
  }
}

function createAssets() {
  const assets = {
    images: {
      grassBase: new Image(),
      grassOverlay: new Image(),
      perlinMask: new Image(),
      forest: new Image(),
      tankBase: new Image(),
      tankTurret: new Image(),
    },
    sounds: {
      shoot: new Audio(),
      hit: new Audio(),
      explosion: new Audio(),
      brickHit: new Audio(),
    },
    loaded: false,
  };

  // URL из импортов Vite (?url) — файлы попадают в dist при build, без отдельного /public в контейнере.
  assets.images.grassBase.src = grassBaseUrl;
  assets.images.grassOverlay.src = grassOverlayUrl;
  assets.images.perlinMask.src = perlinMaskUrl;
  assets.images.forest.src = forestUrl;
  assets.images.tankBase.src = tankBaseUrl;
  assets.images.tankTurret.src = tankTurretUrl;
  assets.sounds.shoot.src = shootUrl;
  assets.sounds.hit.src = hitUrl;
  assets.sounds.explosion.src = explosionUrl;
  assets.sounds.brickHit.src = brickHitUrl;

  Object.values(assets.images).forEach((img) => {
    img.onload = () => checkAssetsLoaded(assets);
    img.onerror = () => {
      console.warn('Не загрузилось изображение:', img.src);
      checkAssetsLoaded(assets);
    };
  });

  Object.values(assets.sounds).forEach((audio) => {
    audio.addEventListener('canplaythrough', () => checkAssetsLoaded(assets));
    audio.addEventListener('error', () => {
      console.warn('Не загрузился звук:', audio.src);
      checkAssetsLoaded(assets);
    });
    audio.preload = 'auto';
    audio.load();
  });

  return assets;
}

export const assets = createAssets();
