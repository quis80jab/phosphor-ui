import test from 'node:test';
import assert from 'node:assert/strict';
import { binVoxelPoints } from '../dist/voxel-test-worker.js';

const points = records => new Float32Array(records.flat());
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} should be near ${expected}`);

test('occupied cells combine linear RGB with opacity weights', () => {
  const result = binVoxelPoints(points([[.1,.2,.3,1,0,0,.25],[.7,.8,.9,0,0,1,.75]]), 1);
  assert.equal(result.count, 1);
  assert.equal(result.processed, 2);
  assert.equal(result.skipped, 0);
  assert.deepEqual([...result.positions], [.5,.5,.5]);
  assert.deepEqual([...result.colors], [.25,0,.75]);
  assert.deepEqual(result.bounds, {min:[0,0,0],max:[1,1,1]});
});

test('negative coordinates and exact boundaries use the same cubic lattice', () => {
  const result = binVoxelPoints(points([[-1,0,0,1,0,0,1],[-.125,0,0,1,0,0,1],[0,0,0,0,1,0,1],[1,0,0,0,0,1,1]]), 1);
  assert.equal(result.count, 3);
  assert.equal(result.processed, 4);
  assert.deepEqual([...result.positions], [-.5,.5,.5,.5,.5,.5,1.5,.5,.5]);
  assert.deepEqual(result.bounds, {min:[-1,0,0],max:[2,1,1]});
});

test('numeric hash collisions preserve distinct full coordinates', () => {
  const result = binVoxelPoints(points([[0,0,0,1,0,0,1],[2**32,0,0,0,1,0,1],[-(2**32),0,0,0,0,1,1],[.25,0,0,1,0,0,1]]), 1);
  assert.equal(result.count, 3, 'coordinates differing by 2^32 share hash bits but must not merge');
  assert.equal(result.processed, 4);
  assert.deepEqual([...result.colors], [1,0,0,0,1,0,0,0,1]);
  assert.equal(result.positions[0], .5);
  assert.equal(result.positions[3], 2**32);
  assert.equal(result.positions[6], -(2**32));
  assert.deepEqual(result.bounds, {min:[-(2**32)-.5,0,0],max:[2**32+.5,1,1]});
});

test('only invalid or effectively transparent points are skipped, including no dark-color filtering', () => {
  const result = binVoxelPoints(points([
    [0,0,0,0,0,0,1], [NaN,0,0,1,1,1,1], [0,0,0,Infinity,1,1,1],
    [0,0,0,1,1,1,NaN], [0,0,0,1,1,1,0], [0,0,0,1,1,1,1e-7]
  ]), 1);
  assert.equal(result.count, 1);
  assert.equal(result.processed, 1);
  assert.equal(result.skipped, 5);
  assert.deepEqual([...result.colors], [0,0,0]);
});

test('changing pitch recomputes occupancy and cube positions without dropping valid points', () => {
  const source = points([[.1,.1,.1,.2,.4,.6,1],[.6,.1,.1,.8,.6,.4,1]]);
  const coarse = binVoxelPoints(source, 1), fine = binVoxelPoints(source, .5);
  assert.equal(coarse.count, 1); assert.equal(fine.count, 2);
  assert.equal(coarse.processed, 2); assert.equal(fine.processed, 2);
  assert.deepEqual([...fine.positions], [.25,.25,.25,.75,.25,.25]);
  close(coarse.colors[0], .5); close(coarse.colors[1], .5); close(coarse.colors[2], .5);
  assert.deepEqual(fine.bounds, {min:[0,0,0],max:[1,.5,.5]});
});

test('sparse storage grows without cropping or a cell-count cap and progress is monotonic', () => {
  const count = 70000, source = new Float32Array(count * 7), progress = [];
  for (let i = 0; i < count; i++) source.set([i + .25,0,0,.2,.4,.6,1],i * 7);
  const result = binVoxelPoints(source, 1, {onProgress:value => progress.push(value)});
  assert.equal(result.count, count); assert.equal(result.processed, count); assert.equal(result.skipped, 0);
  assert.equal(result.positions.length, count * 3); assert.equal(result.colors.length, count * 3);
  assert.equal(result.positions[0], .5); assert.equal(result.positions.at(-3), count - .5);
  assert.deepEqual(result.bounds, {min:[0,0,0],max:[count,1,1]});
  assert.equal(progress[0], 0); assert.equal(progress.at(-1), 1);
  assert.ok(progress.length > 2);
  assert.ok(progress.every((value,index) => value >= 0 && value <= 1 && (index === 0 || value >= progress[index-1])));
});

test('empty input has finite bounds and malformed input fails explicitly', () => {
  const empty = binVoxelPoints(new Float32Array(), 1);
  assert.equal(empty.count, 0); assert.equal(empty.processed, 0); assert.equal(empty.skipped, 0);
  assert.deepEqual(empty.bounds, {min:[0,0,0],max:[0,0,0]});
  assert.throws(() => binVoxelPoints(new Float32Array(6), 1), /seven floats/);
  assert.throws(() => binVoxelPoints([], 1), /seven floats/);
  for (const pitch of [0,-1,NaN,Infinity]) assert.throws(() => binVoxelPoints(new Float32Array(), pitch), /positive and finite/);
});
