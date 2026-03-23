import grassBaseUrl from '../game-assets/images/grass_base.png?url';
import grassOverlayUrl from '../game-assets/images/grass_overlay.png?url';
import perlinMaskUrl from '../game-assets/images/perlin_mask.png?url';
import forestUrl from '../game-assets/images/forest.png?url';
import tankBaseUrl from '../game-assets/images/tank_base_green.png?url';
import tankTurretUrl from '../game-assets/images/tank_turret_green.png?url';
import shadowBrickUrl from '../game-assets/images/shadow_brick.png?url';
import brickUrl from '../game-assets/images/brick.png?url';
import shadowForestUrl from '../game-assets/images/shadow_forest.png?url';
import smokeUrl from '../game-assets/images/smoke.png?url';
import smokeBlackUrl from '../game-assets/images/smoke_black.png?url';
import smokeGreyUrl from '../game-assets/images/smoke_grey.png?url';
import rocketUrl from '../game-assets/images/rocket.png?url';
import tankDeadUrl from '../game-assets/images/tank_med_dead.png?url';
import explosionMarkUrl from '../game-assets/images/explosion_mark.png?url';
import brickHit1Url from '../game-assets/sounds/brick_hit1.mp3?url';
import brickHit2Url from '../game-assets/sounds/brick_hit2.mp3?url';
import brickHit3Url from '../game-assets/sounds/brick_hit3.mp3?url';
import explosionUrl from '../game-assets/sounds/explosion.mp3?url';
import hitUrl from '../game-assets/sounds/hit.mp3?url';
import shootUrl from '../game-assets/sounds/shoot.mp3?url';

const totalAssets = 21;
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
      shadowBrick: new Image(),
      shadowForest: new Image(),
      brick: new Image(),
      smoke: new Image(),
      smokeBlack: new Image(),
      smokeGrey: new Image(),
      rocket: new Image(),
      tankDead: new Image(),
      explosionMark: new Image(),
    },
    sounds: {
      shoot: new Audio(),
      hit: new Audio(),
      explosion: new Audio(),
      brickHit1: new Audio(),
      brickHit2: new Audio(),
      brickHit3: new Audio(),
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
  assets.images.shadowBrick.src = shadowBrickUrl;
  assets.images.shadowForest.src = shadowForestUrl;
  assets.images.brick.src = brickUrl;
  assets.images.smoke.src = smokeUrl;
  assets.images.smokeBlack.src = smokeBlackUrl;
  assets.images.smokeGrey.src = smokeGreyUrl;
  assets.images.rocket.src = rocketUrl;
  assets.images.tankDead.src = tankDeadUrl;
  assets.images.explosionMark.src = explosionMarkUrl;
  assets.sounds.shoot.src = shootUrl;
  assets.sounds.hit.src = hitUrl;
  assets.sounds.explosion.src = explosionUrl;
  assets.sounds.brickHit1.src = brickHit1Url;
  assets.sounds.brickHit2.src = brickHit2Url;
  assets.sounds.brickHit3.src = brickHit3Url;

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
