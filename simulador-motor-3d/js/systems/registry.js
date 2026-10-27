import { OTTO, DIESEL, TWO_STROKE } from './pistonEngine.js';
import { WANKEL } from './wankel.js';
import { CAR } from './car.js';
import { ELECTRIC } from './electric.js';
import { TURBOFAN } from './turbofan.js';
import { STEAM, STIRLING } from './external.js';
import { PLANETARY, DIFFERENTIAL } from './mechanisms.js';

export const SYSTEMS = [OTTO, DIESEL, TWO_STROKE, WANKEL, CAR, ELECTRIC, TURBOFAN, STEAM, STIRLING, PLANETARY, DIFFERENTIAL];
export const byId = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));
