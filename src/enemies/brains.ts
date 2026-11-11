// Какой «мозг» у какого врага. Каждый мозг — в своём файле.
import type { EnemyType } from '../config';
import type { Brain } from './helpers';
import { warrior } from './warrior';
import { archer } from './archer';
import { necro } from './necro';
import { healer } from './healer';
import { mimic } from './mimic';
import { king } from './king';

export const BRAINS: Record<EnemyType, Brain> = { warrior, archer, necro, healer, mimic, king };
