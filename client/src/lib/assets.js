import grassBaseUrl from '../game-assets/images/grass_base.png?url';
import grassOverlayUrl from '../game-assets/images/grass_overlay.png?url';
import perlinMaskUrl from '../game-assets/images/perlin_mask.png?url';
import bush2Url from '../game-assets/images/bush2.png?url';
import bush2ShadowUrl from '../game-assets/images/bush2_shadow.png?url';
import bush3Url from '../game-assets/images/bush3.png?url';
import bush3ShadowUrl from '../game-assets/images/bush3_shadow.png?url';
import tankBaseUrl from '../game-assets/images/MTank_base_color.png?url';
import tankTurretUrl from '../game-assets/images/MTank_turret_color.png?url';
import tankBaseNMUrl from '../game-assets/images/MTank_base_NM.png?url';
import tankTurretNMUrl from '../game-assets/images/MTank_turret_NM.png?url';
import tankTurretShadowUrl from '../game-assets/images/MTank_turret_shadow.png?url';
import tankLightBaseUrl from '../game-assets/images/tank_light1_base_green.png?url';
import tankLightTurretUrl from '../game-assets/images/tank_light1_turret_green.png?url';
import tankHeavyBaseUrl from '../game-assets/images/tank_heavy1_base_green.png?url';
import tankHeavyTurretUrl from '../game-assets/images/tank_heavy1_turret_green.png?url';
import shadowBrickUrl from '../game-assets/images/shadow_brick.png?url';
import brickUrl from '../game-assets/images/brick.png?url';
// shadow_forest.png убран — теперь используем bush2_shadow / bush3_shadow
import smokeUrl from '../game-assets/images/smoke.png?url';
import smokeBlackUrl from '../game-assets/images/smoke_black.png?url';
import smokeGreyUrl from '../game-assets/images/smoke_grey.png?url';
import rocketUrl from '../game-assets/images/rocket.png?url';
import tankDeadUrl from '../game-assets/images/tank_med_dead.png?url';
import explosionMarkUrl from '../game-assets/images/explosion_mark.png?url';
import explosionMarkNMUrl from '../game-assets/images/explosion_mark_NM.png?url';
import cloudShadowUrl from '../game-assets/images/cloud_shadow.png?url';
import repairBoxUrl from '../game-assets/images/repair_box.png?url';
import atackSpeedUrl from '../game-assets/images/atack_speed.png?url';
import speedBoostUrl from '../game-assets/images/speed_boost.png?url';
import smokeBoxUrl from '../game-assets/images/smoke_box.png?url';
import mineBoxUrl from '../game-assets/images/mine_box.png?url';
import rocketBoxUrl from '../game-assets/images/rocket_box.png?url';
import repairBoxInvUrl from '../game-assets/images/repair_box_inv.png?url';
import smokeBoxInvUrl from '../game-assets/images/smoke_box_inv.png?url';
import rocketBoxInvUrl from '../game-assets/images/rocket_box_inv.png?url';
import mineUrl from '../game-assets/images/mine.png?url';
import cursorUrl from '../game-assets/images/cursor.png?url';
import camouflage1Url from '../game-assets/images/camouflage1.png?url';
import stone1Url from '../game-assets/images/stone1.png?url';
import stone2Url from '../game-assets/images/stone2.png?url';
import stone3Url from '../game-assets/images/stone3.png?url';
import stone4Url from '../game-assets/images/stone4.png?url';
import stone5Url from '../game-assets/images/stone5.png?url';
import stone1NMUrl from '../game-assets/images/stone1_NM.png?url';
import stone2NMUrl from '../game-assets/images/stone2_NM.png?url';
import stone3NMUrl from '../game-assets/images/stone3_NM.png?url';
import stone4NMUrl from '../game-assets/images/stone4_NM.png?url';
import stone5NMUrl from '../game-assets/images/stone5_NM.png?url';
import vignetteUrl from '../game-assets/images/vinetka.png?url';
import repairUrl from '../game-assets/sounds/repair.mp3?url';
import brickHit1Url from '../game-assets/sounds/brick_hit1.mp3?url';
import brickHit2Url from '../game-assets/sounds/brick_hit2.mp3?url';
import brickHit3Url from '../game-assets/sounds/brick_hit3.mp3?url';
import explosionUrl from '../game-assets/sounds/explosion.mp3?url';
import hitUrl from '../game-assets/sounds/hit.mp3?url';
import shootUrl from '../game-assets/sounds/shoot.mp3?url';
import shootHeavyUrl from '../game-assets/sounds/tank_shot2.mp3?url';
import click1Url from '../game-assets/sounds/click1.mp3?url';
import click2Url from '../game-assets/sounds/click2.mp3?url';

const totalAssets = 59;
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
      bush2: new Image(),
      bush2Shadow: new Image(),
      bush3: new Image(),
      bush3Shadow: new Image(),
      tankBase: new Image(),
      tankTurret: new Image(),
      tankBaseNM: new Image(),
      tankTurretNM: new Image(),
      tankTurretShadow: new Image(),
      tankLightBase: new Image(),
      tankLightTurret: new Image(),
      tankHeavyBase: new Image(),
      tankHeavyTurret: new Image(),
      shadowBrick: new Image(),
      // shadowForest убран — теперь bush2Shadow / bush3Shadow
      brick: new Image(),
      smoke: new Image(),
      smokeBlack: new Image(),
      smokeGrey: new Image(),
      rocket: new Image(),
      tankDead: new Image(),
      explosionMark: new Image(),
      explosionMarkNM: new Image(),
      cloudShadow: new Image(),
      repairBox: new Image(),
      atackSpeed: new Image(),
      speedBoost: new Image(),
      smokeBox: new Image(),
      mineBox: new Image(),
      rocketBox: new Image(),
      repairBoxInv: new Image(),
      smokeBoxInv: new Image(),
      rocketBoxInv: new Image(),
      mine: new Image(),
      cursor: new Image(),
      camouflage1: new Image(),
      stone1: new Image(),
      stone2: new Image(),
      stone3: new Image(),
      stone4: new Image(),
      stone5: new Image(),
      stone1NM: new Image(),
      stone2NM: new Image(),
      stone3NM: new Image(),
      stone4NM: new Image(),
      stone5NM: new Image(),
      vignette: new Image(),
    },
    sounds: {
      shoot: new Audio(),
      shootHeavy: new Audio(),
      hit: new Audio(),
      explosion: new Audio(),
      brickHit1: new Audio(),
      brickHit2: new Audio(),
      brickHit3: new Audio(),
      repair: new Audio(),
      click1: new Audio(),
      click2: new Audio(),
    },
    loaded: false,
  };

  // URL из импортов Vite (?url) — файлы попадают в dist при build, без отдельного /public в контейнере.
  assets.images.grassBase.src = grassBaseUrl;
  assets.images.grassOverlay.src = grassOverlayUrl;
  assets.images.perlinMask.src = perlinMaskUrl;
  assets.images.bush2.src = bush2Url;
  assets.images.bush2Shadow.src = bush2ShadowUrl;
  assets.images.bush3.src = bush3Url;
  assets.images.bush3Shadow.src = bush3ShadowUrl;
  assets.images.tankBase.src = tankBaseUrl;
  assets.images.tankTurret.src = tankTurretUrl;
  assets.images.tankBaseNM.src = tankBaseNMUrl;
  assets.images.tankTurretNM.src = tankTurretNMUrl;
  assets.images.tankTurretShadow.src = tankTurretShadowUrl;
  assets.images.tankLightBase.src = tankLightBaseUrl;
  assets.images.tankLightTurret.src = tankLightTurretUrl;
  assets.images.tankHeavyBase.src = tankHeavyBaseUrl;
  assets.images.tankHeavyTurret.src = tankHeavyTurretUrl;
  assets.images.shadowBrick.src = shadowBrickUrl;
  // shadowForest убран
  assets.images.brick.src = brickUrl;
  assets.images.smoke.src = smokeUrl;
  assets.images.smokeBlack.src = smokeBlackUrl;
  assets.images.smokeGrey.src = smokeGreyUrl;
  assets.images.rocket.src = rocketUrl;
  assets.images.tankDead.src = tankDeadUrl;
  assets.images.explosionMark.src = explosionMarkUrl;
  assets.images.explosionMarkNM.src = explosionMarkNMUrl;
  assets.images.cloudShadow.src = cloudShadowUrl;
  assets.images.repairBox.src = repairBoxUrl;
  assets.images.atackSpeed.src = atackSpeedUrl;
  assets.images.speedBoost.src = speedBoostUrl;
  assets.images.smokeBox.src = smokeBoxUrl;
  assets.images.mineBox.src = mineBoxUrl;
  assets.images.rocketBox.src = rocketBoxUrl;
  assets.images.repairBoxInv.src = repairBoxInvUrl;
  assets.images.smokeBoxInv.src = smokeBoxInvUrl;
  assets.images.rocketBoxInv.src = rocketBoxInvUrl;
  assets.images.mine.src = mineUrl;
  assets.images.cursor.src = cursorUrl;
  assets.images.camouflage1.src = camouflage1Url;
  assets.images.stone1.src = stone1Url;
  assets.images.stone2.src = stone2Url;
  assets.images.stone3.src = stone3Url;
  assets.images.stone4.src = stone4Url;
  assets.images.stone5.src = stone5Url;
  assets.images.stone1NM.src = stone1NMUrl;
  assets.images.stone2NM.src = stone2NMUrl;
  assets.images.stone3NM.src = stone3NMUrl;
  assets.images.stone4NM.src = stone4NMUrl;
  assets.images.stone5NM.src = stone5NMUrl;
  assets.images.vignette.src = vignetteUrl;
  assets.sounds.shoot.src = shootUrl;
  assets.sounds.shootHeavy.src = shootHeavyUrl;
  assets.sounds.hit.src = hitUrl;
  assets.sounds.explosion.src = explosionUrl;
  assets.sounds.brickHit1.src = brickHit1Url;
  assets.sounds.brickHit2.src = brickHit2Url;
  assets.sounds.brickHit3.src = brickHit3Url;
  assets.sounds.repair.src = repairUrl;
  assets.sounds.click1.src = click1Url;
  assets.sounds.click2.src = click2Url;

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
