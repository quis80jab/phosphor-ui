import test from 'node:test';
import assert from 'node:assert/strict';
import {createDroneFlight,DRONE_FLIGHT_LIMITS} from '../dist/drone-flight.js';

const close=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
function run(flight,seconds,rate=60){for(let frame=0;frame<Math.round(seconds*rate);frame++)flight.advance(1/rate);return flight.getState();}

test('forward and strafe use geographic headings in metres',()=>{
 for(const [heading,dx,dz] of [[0,0,-1],[90,1,0],[180,0,1],[270,-1,0]]){
  const flight=createDroneFlight({pose:{heading}});flight.setInput({forward:1});const pose=run(flight,3);
  assert.ok(pose.x*dx+pose.z*dz>10);close(pose.x*dz-pose.z*dx,0);close(pose.speed,8);close(pose.heading,heading);close(pose.altitude,8);
  flight.reset({heading});flight.setInput({strafe:1});const right=run(flight,3);assert.ok(right.x*-dz+right.z*dx>10);close(right.x*dx+right.z*dz,0);
 }
});

test('all four simultaneous axes move and orient the same body with bounded speeds',()=>{
 const flight=createDroneFlight();flight.setInput({yaw:1,lift:1,forward:1,strafe:1});const pose=run(flight,1);
 close(pose.heading,90);assert.ok(pose.x>0&&Math.abs(pose.z)>.01);assert.ok(pose.altitude>8);close(pose.verticalSpeed,3);
 assert.ok(pose.speed<=DRONE_FLIGHT_LIMITS.speed);assert.ok(pose.roll>0);assert.ok(pose.pitch<0);
 const north=createDroneFlight();north.setInput({forward:1});run(north,.5);assert.ok(north.getState().pitch<0,'accelerating forward pitches nose down');
 const east=createDroneFlight();east.setInput({strafe:1});run(east,.5);assert.ok(east.getState().roll>0,'accelerating right banks right');
});

test('fixed-step trajectory matches at 30, 60, and 144 frames per second',()=>{
 const poses=[30,60,144].map(rate=>{const flight=createDroneFlight({pose:{heading:73}});flight.setInput({yaw:.3,lift:.4,forward:.8,strafe:-.2});run(flight,4,rate);flight.clearInput();return run(flight,2,rate);});
 for(const pose of poses.slice(1))for(const key of Object.keys(pose))close(pose[key],poses[0][key],1e-9);
});

test('releasing controls brakes to a stationary level hover rather than continuing orbit',()=>{
 const flight=createDroneFlight();flight.setInput({forward:1,lift:1});const moving=run(flight,3);flight.clearInput();const stopped=run(flight,3);
 close(stopped.speed,0);close(stopped.verticalSpeed,0);assert.ok(stopped.z<moving.z);assert.ok(stopped.altitude>moving.altitude);assert.ok(Math.abs(stopped.pitch)<.001);
 const later=run(flight,3);close(later.x,stopped.x);close(later.z,stopped.z);close(later.altitude,stopped.altitude);
});

test('source bounds and altitude floors stop outward velocity while other axes remain available',()=>{
 const flight=createDroneFlight({bounds:{minX:-2,maxX:2,minZ:-3,maxZ:3},pose:{heading:90}});flight.setInput({forward:1,lift:1});let pose=run(flight,30);
 close(pose.x,2);close(pose.vx,0);close(pose.altitude,50);close(pose.verticalSpeed,0);
 flight.setInput({forward:-1,strafe:1,lift:-1});pose=run(flight,30);close(pose.x,-2);close(pose.z,3);close(pose.altitude,1);close(pose.verticalSpeed,0);
});

test('time gaps and suspension stop stale commands without advancing the pose',()=>{
 for(const gap of[.251,4,-.1,Infinity,NaN]){
  const flight=createDroneFlight();flight.setInput({yaw:1,forward:1,lift:1});const before=run(flight,.5);flight.advance(gap);const after=run(flight,1);
  for(const key of['x','z','altitude','heading'])close(after[key],before[key]);close(after.speed,0);close(after.verticalSpeed,0);
 }
 const flight=createDroneFlight();flight.setInput({forward:1});run(flight,.5);flight.clearInput(true);const pose=flight.getState();run(flight,1);assert.deepEqual(flight.getState(),pose);
});

test('reset preserves the supplied pose and cancels velocity, while input is sanitized',()=>{
 const flight=createDroneFlight();flight.setInput({forward:100,lift:Infinity,yaw:NaN});let pose=run(flight,2);close(pose.heading,0);close(pose.altitude,8);close(pose.speed,8);
 flight.reset({x:5,z:9,altitude:20,heading:-90});pose=run(flight,1);close(pose.x,5);close(pose.z,9);close(pose.altitude,20);close(pose.heading,270);close(pose.speed,0);
});
