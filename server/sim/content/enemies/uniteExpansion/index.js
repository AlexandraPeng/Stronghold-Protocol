// Dedicated registry: existing-mode overrides are selected only with flags.uniteExpansion.
import { UNITE_SIMPLE_KITS } from './simple.js';
import { UNITE_TIDE_KITS } from './tide.js';
import { UNITE_FRACTAL_KITS } from './fractals.js';
import { UNITE_KNIGHT_KITS } from './knights.js';
import { UNITE_TALISMAN_KITS } from './talismans.js';
import { UNITE_ELEMENT_KITS } from './elements.js';
import { UNITE_FILM_KITS } from './film.js';
import { UNITE_THEATRE_KITS } from './theatre.js';
import { UNITE_FLY_KITS } from './flying.js';
import { UNITE_CAPTURE_KITS } from './capture.js';
import { UNITE_COMBAT_LEADER_KITS } from './combatLeaders.js';
import { UNITE_MOON_KITS } from './moons.js';
import { UNITE_WRITER_KITS } from './writer.js';
import { UNITE_HANKO_KITS } from './hanko.js';
import { UNITE_LAMALIEN_KITS } from './lamalien.js';
import { UNITE_STRESS_KITS } from './stressRobot.js';
export const UNITE_KITS = Object.freeze({
  ...UNITE_SIMPLE_KITS,...UNITE_TIDE_KITS,...UNITE_FRACTAL_KITS,...UNITE_KNIGHT_KITS,
  ...UNITE_TALISMAN_KITS,...UNITE_ELEMENT_KITS,...UNITE_FILM_KITS,...UNITE_THEATRE_KITS,
  ...UNITE_FLY_KITS,...UNITE_CAPTURE_KITS,...UNITE_COMBAT_LEADER_KITS,...UNITE_MOON_KITS,
  ...UNITE_WRITER_KITS,...UNITE_HANKO_KITS,...UNITE_LAMALIEN_KITS,...UNITE_STRESS_KITS,
});
