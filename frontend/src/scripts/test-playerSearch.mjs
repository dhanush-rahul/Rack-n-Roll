import assert from 'assert';
import {
  includesLoose,
  filterGamesByPlayerQueries,
  buildPlayerSearchIndex,
} from '../utils/playerSearch.js';
import { mergeFilteredGamesAfterSave } from '../utils/fixtureFilterMerge.js';

assert.strictEqual(includesLoose('John Smith', 'john'), true);
assert.strictEqual(includesLoose('John Smith', 'js'), true);
assert.strictEqual(includesLoose('John Smith', 'xyz'), false);

const games = [
  {
    id: 'g1',
    playerAId: 'p1',
    playerBId: 'p2',
    playerA: { displayName: 'Alice Alpha' },
    playerB: { displayName: 'Bob Beta' },
  },
  {
    id: 'g2',
    playerAId: 'p3',
    playerBId: 'p4',
    playerA: { displayName: 'Carol Gamma' },
    playerB: { displayName: 'Dan Delta' },
  },
];

const index = buildPlayerSearchIndex([], games);
const filtered = filterGamesByPlayerQueries(games, 'alice', 'bob', { playerSearchIndex: index });
assert.strictEqual(filtered.length, 1);
assert.strictEqual(filtered[0].id, 'g1');

const refreshed = [{ ...games[0], status: 'completed' }, games[1]];
const merged = mergeFilteredGamesAfterSave(filtered, refreshed);
assert.strictEqual(merged[0].status, 'completed');
assert.strictEqual(merged.length, 1);

console.log('playerSearch and fixtureFilterMerge tests passed');
