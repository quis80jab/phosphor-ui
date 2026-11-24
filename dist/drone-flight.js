// Local demo flight in metres: +X east, +Z south, heading 0 north / 90 east.
// This controller has no hardware connection and makes no terrain assumptions.
export const DRONE_FLIGHT_LIMITS=Object.freeze({speed:8,verticalSpeed:3,yawRate:90,acceleration:6,braking:8,verticalAcceleration:4,minAltitude:1,maxAltitude:50,maxDelta:.25});
const STEP=1/120,DEG=Math.PI/180;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const heading=value=>((finite(value)%360)+360)%360;
const neutral=()=>({yaw:0,lift:0,forward:0,strafe:0});
const approach=(value,target,step)=>value+clamp(target-value,-step,step);

/** Fixed simulation steps keep trajectory and attitude independent of frame rate. */
export function createDroneFlight({bounds={minX:-Infinity,maxX:Infinity,minZ:-Infinity,maxZ:Infinity},pose={}}={}){
 let state,input=neutral(),remainder=0;
 function reset(next={}){
  state={x:clamp(finite(next.x),bounds.minX,bounds.maxX),z:clamp(finite(next.z),bounds.minZ,bounds.maxZ),altitude:clamp(finite(next.altitude,8),1,50),heading:heading(next.heading),vx:0,vz:0,verticalSpeed:0,roll:0,pitch:0};
  input=neutral();remainder=0;return getState();
 }
 function getState(){return{...state,yaw:state.heading,speed:Math.hypot(state.vx,state.vz)};}
 function setInput(next={}){
  const normalized=neutral();for(const axis of Object.keys(normalized))normalized[axis]=clamp(finite(next?.[axis]),-1,1);
  const changed=Object.keys(normalized).some(axis=>normalized[axis]!==input[axis]);input=normalized;return changed;
 }
 function clearInput(stop=false){
  const changed=setInput();
  if(stop){state.vx=state.vz=state.verticalSpeed=state.roll=state.pitch=0;remainder=0;}
  return changed;
 }
 function tick(dt){
  const limits=DRONE_FLIGHT_LIMITS,turn=input.yaw*limits.yawRate*dt,angle=(state.heading+turn*.5)*DEG;
  state.heading=heading(state.heading+turn);
  const sin=Math.sin(angle),cos=Math.cos(angle),magnitude=Math.max(1,Math.hypot(input.forward,input.strafe));
  const forward=input.forward/magnitude,right=input.strafe/magnitude;
  const tx=(sin*forward+cos*right)*limits.speed,tz=(-cos*forward+sin*right)*limits.speed;
  const oldX=state.vx,oldZ=state.vz,oldY=state.verticalSpeed,dx=tx-oldX,dz=tz-oldZ,distance=Math.hypot(dx,dz);
  const acceleration=(forward||right)?limits.acceleration:limits.braking,fraction=distance?Math.min(1,acceleration*dt/distance):0;
  state.vx+=dx*fraction;state.vz+=dz*fraction;
  state.verticalSpeed=approach(oldY,input.lift*limits.verticalSpeed,limits.verticalAcceleration*dt);
  const x=state.x+(oldX+state.vx)*.5*dt,z=state.z+(oldZ+state.vz)*.5*dt,altitude=state.altitude+(oldY+state.verticalSpeed)*.5*dt;
  state.x=clamp(x,bounds.minX,bounds.maxX);state.z=clamp(z,bounds.minZ,bounds.maxZ);state.altitude=clamp(altitude,limits.minAltitude,limits.maxAltitude);
  if(state.x!==x)state.vx=0;if(state.z!==z)state.vz=0;if(state.altitude!==altitude)state.verticalSpeed=0;
  // Tilt reflects acceleration plus a small drag compensation, not stick art.
  const ax=(state.vx-oldX)/dt+.18*state.vx,az=(state.vz-oldZ)/dt+.18*state.vz;
  const pitch=clamp(-Math.atan((ax*sin-az*cos)/9.80665)/DEG,-22,22),roll=clamp(Math.atan((ax*cos+az*sin)/9.80665)/DEG,-22,22),blend=1-Math.exp(-dt*8);
  state.pitch+=(pitch-state.pitch)*blend;state.roll+=(roll-state.roll)*blend;
 }
 function advance(seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>DRONE_FLIGHT_LIMITS.maxDelta){clearInput(true);return getState();}
  remainder+=seconds;
  while(remainder+1e-10>=STEP){tick(STEP);remainder=Math.max(0,remainder-STEP);}
  return getState();
 }
 reset(pose);return{reset,getState,setInput,clearInput,advance};
}
