// Synthetic topology for the public visual kit. All nodes, links, status and telemetry are
// illustrative fixtures, not a deployment inventory or a control-system specification.
// Some stable IDs are retained for compatibility with existing panel selections.
function freeze(value) { if(value && typeof value === "object" && !Object.isFrozen(value)) {Object.freeze(value); for(const inner of Object.values(value)) freeze(inner);} return value; }
export const STATES = freeze({
  "running": {
    "label": "RUNNING",
    "says": "SYNTHETIC RUNNING STATUS FOR UI REVIEW"
  },
  "built": {
    "label": "BUILT",
    "says": "SYNTHETIC BUILT STATUS FOR UI REVIEW"
  },
  "designed": {
    "label": "DESIGNED",
    "says": "SYNTHETIC DESIGNED STATUS FOR UI REVIEW"
  },
  "named": {
    "label": "NAMED",
    "says": "SYNTHETIC NAMED STATUS FOR UI REVIEW"
  },
  "planned": {
    "label": "PLANNED",
    "says": "SYNTHETIC PLANNED STATUS FOR UI REVIEW"
  }
});

export const OWNERS = freeze({
  "lead": "DEMO PLATFORM",
  "work": "DEMO EXTENSIONS",
  "dji": "DEMO VENDOR",
  "bought": "DEMO HARDWARE",
  "people": "DEMO PEOPLE"
});

export const ORIGINS = freeze({
  "sim": "SIM",
  "dji-simulator": "VIRTUAL",
  "real": "SAMPLE"
});

export const TIERS = freeze([
  {
    "id": "people",
    "label": "PEOPLE"
  },
  {
    "id": "ground",
    "label": "DEMO HUB"
  },
  {
    "id": "devices",
    "label": "DEVICES"
  },
  {
    "id": "sensors",
    "label": "SENSORS"
  },
  {
    "id": "aircraft",
    "label": "AIRCRAFT"
  },
  {
    "id": "outside",
    "label": "COMPUTE"
  }
]);

export const GLYPHS = freeze({
  "person": "admin",
  "service": "processor",
  "store": "store",
  "cluster": "device",
  "device": "device",
  "sensor": "sensor",
  "aircraft": "aircraft",
  "rc": "rc",
  "compute": "processor",
  "module": "module"
});

export const LINK_KINDS = freeze({
  "ethernet": {
    "label": "ETHERNET",
    "style": "ethernet"
  },
  "wifi": {
    "label": "WIFI",
    "style": "wifi"
  },
  "usb": {
    "label": "USB",
    "style": "usb"
  },
  "serial": {
    "label": "SERIAL",
    "style": "usb"
  },
  "mount": {
    "label": "MOUNT",
    "style": "mount"
  },
  "radio": {
    "label": "RADIO",
    "style": "radio"
  },
  "access": {
    "label": "ACCESS",
    "style": "access"
  },
  "local": {
    "label": "LOCAL",
    "style": "local"
  },
  "sim": {
    "label": "SIM",
    "style": "wifi"
  }
});

export const NODES = freeze([
  {
    "id": "operator",
    "kind": "person",
    "tier": "people",
    "name": "DEMO OPERATOR",
    "parent": null,
    "role": null,
    "model": "DEMO PERSON",
    "origin": null,
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "running",
    "owner": "people",
    "says": "ILLUSTRATIVE PERSON IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO",
    "glyph": "admin"
  },
  {
    "id": "observer",
    "kind": "person",
    "tier": "people",
    "name": "DEMO VIEWER",
    "parent": null,
    "role": null,
    "model": "DEMO PERSON",
    "origin": null,
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "built",
    "owner": "people",
    "says": "ILLUSTRATIVE PERSON IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO",
    "glyph": "viewer"
  },
  {
    "id": "pilot",
    "kind": "person",
    "tier": "people",
    "name": "DEMO PILOT",
    "parent": null,
    "role": null,
    "model": "DEMO PERSON",
    "origin": null,
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "designed",
    "owner": "people",
    "says": "ILLUSTRATIVE PERSON IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO",
    "glyph": "pilot"
  },
  {
    "id": "ground",
    "kind": "cluster",
    "tier": "ground",
    "name": "DEMO HUB",
    "parent": null,
    "role": null,
    "model": "DEMO CLUSTER",
    "origin": "sim",
    "ports": [],
    "runs": [
      "DEMO DASHBOARD",
      "DEMO RECORDS"
    ],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "named",
    "owner": "lead",
    "says": "ILLUSTRATIVE CLUSTER IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "shell",
    "kind": "service",
    "tier": "ground",
    "name": "DASHBOARD",
    "parent": "ground",
    "role": null,
    "model": "DEMO SERVICE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "planned",
    "owner": "work",
    "says": "ILLUSTRATIVE SERVICE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "gateway",
    "kind": "service",
    "tier": "ground",
    "name": "EVENT BRIDGE",
    "parent": "ground",
    "role": null,
    "model": "DEMO SERVICE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "running",
    "owner": "lead",
    "says": "ILLUSTRATIVE SERVICE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "rancher",
    "kind": "service",
    "tier": "ground",
    "name": "SCHEDULER",
    "parent": "ground",
    "role": null,
    "model": "DEMO SERVICE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "built",
    "owner": "work",
    "says": "ILLUSTRATIVE SERVICE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "harbor",
    "kind": "store",
    "tier": "ground",
    "name": "IMAGE STORE",
    "parent": "ground",
    "role": null,
    "model": "DEMO STORE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "designed",
    "owner": "lead",
    "says": "ILLUSTRATIVE STORE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "logs",
    "kind": "service",
    "tier": "ground",
    "name": "EVENT LOG",
    "parent": "ground",
    "role": null,
    "model": "DEMO SERVICE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "named",
    "owner": "work",
    "says": "ILLUSTRATIVE SERVICE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "postgres",
    "kind": "store",
    "tier": "ground",
    "name": "RECORD STORE",
    "parent": "ground",
    "role": null,
    "model": "DEMO STORE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "planned",
    "owner": "lead",
    "says": "ILLUSTRATIVE STORE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "minio",
    "kind": "store",
    "tier": "ground",
    "name": "FILE STORE",
    "parent": "ground",
    "role": null,
    "model": "DEMO STORE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "running",
    "owner": "work",
    "says": "ILLUSTRATIVE STORE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "base-orin",
    "kind": "device",
    "tier": "devices",
    "name": "EDGE LINK",
    "parent": null,
    "role": "link",
    "model": "DEMO DEVICE",
    "origin": "sim",
    "ports": [
      "COLOR",
      "DEPTH",
      "STATUS"
    ],
    "runs": [
      "DEMO TELEMETRY",
      "DEMO CAPTURE"
    ],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "built",
    "owner": "lead",
    "says": "ILLUSTRATIVE DEVICE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "flight-orin",
    "kind": "device",
    "tier": "devices",
    "name": "ROBOT 01",
    "parent": null,
    "role": "robot",
    "model": "DEMO DEVICE",
    "origin": "sim",
    "ports": [
      "COLOR",
      "DEPTH",
      "STATUS"
    ],
    "runs": [
      "DEMO TELEMETRY",
      "DEMO CAPTURE"
    ],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "built",
    "owner": "work",
    "says": "ILLUSTRATIVE DEVICE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "sim-robot",
    "kind": "device",
    "tier": "devices",
    "name": "SIM ROBOT",
    "parent": null,
    "role": "robot",
    "model": "DEMO DEVICE",
    "origin": "sim",
    "ports": [
      "COLOR",
      "DEPTH",
      "STATUS"
    ],
    "runs": [
      "DEMO TELEMETRY",
      "DEMO CAPTURE"
    ],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "named",
    "owner": "lead",
    "says": "ILLUSTRATIVE DEVICE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "sim-orin",
    "kind": "device",
    "tier": "devices",
    "name": "SIM LINK",
    "parent": null,
    "role": "link",
    "model": "DEMO DEVICE",
    "origin": "sim",
    "ports": [
      "COLOR",
      "DEPTH",
      "STATUS"
    ],
    "runs": [
      "DEMO TELEMETRY",
      "DEMO CAPTURE"
    ],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "planned",
    "owner": "work",
    "says": "ILLUSTRATIVE DEVICE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "d455",
    "kind": "sensor",
    "tier": "sensors",
    "name": "DEPTH CAMERA",
    "parent": "flight-orin",
    "role": null,
    "model": "DEMO SENSOR",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "running",
    "owner": "lead",
    "says": "ILLUSTRATIVE SENSOR IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "gps",
    "kind": "sensor",
    "tier": "sensors",
    "name": "POSITION SENSOR",
    "parent": "flight-orin",
    "role": null,
    "model": "DEMO SENSOR",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "built",
    "owner": "work",
    "says": "ILLUSTRATIVE SENSOR IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "xt2",
    "kind": "sensor",
    "tier": "sensors",
    "name": "THERMAL CAMERA",
    "parent": "sim-robot",
    "role": null,
    "model": "DEMO SENSOR",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "designed",
    "owner": "lead",
    "says": "ILLUSTRATIVE SENSOR IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "z30",
    "kind": "sensor",
    "tier": "sensors",
    "name": "ZOOM CAMERA",
    "parent": "sim-robot",
    "role": null,
    "model": "DEMO SENSOR",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "named",
    "owner": "work",
    "says": "ILLUSTRATIVE SENSOR IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "range",
    "kind": "sensor",
    "tier": "sensors",
    "name": "RANGE SENSOR",
    "parent": "flight-orin",
    "role": null,
    "model": "DEMO SENSOR",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "planned",
    "owner": "lead",
    "says": "ILLUSTRATIVE SENSOR IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "imu-main",
    "kind": "sensor",
    "tier": "sensors",
    "name": "MOTION SENSOR",
    "parent": "sim-robot",
    "role": null,
    "model": "DEMO SENSOR",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "running",
    "owner": "work",
    "says": "ILLUSTRATIVE SENSOR IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "sim-sensors",
    "kind": "sensor",
    "tier": "sensors",
    "name": "TEST SENSORS",
    "parent": "sim-robot",
    "role": null,
    "model": "DEMO SENSOR",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "built",
    "owner": "lead",
    "says": "ILLUSTRATIVE SENSOR IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "aircraft",
    "kind": "aircraft",
    "tier": "aircraft",
    "name": "VIRTUAL DRONE",
    "parent": null,
    "role": null,
    "model": "DEMO AIRCRAFT",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "designed",
    "owner": "work",
    "says": "ILLUSTRATIVE AIRCRAFT IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "rc",
    "kind": "rc",
    "tier": "aircraft",
    "name": "REMOTE CONTROL",
    "parent": null,
    "role": null,
    "model": "DEMO RC",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "named",
    "owner": "lead",
    "says": "ILLUSTRATIVE RC IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "mac",
    "kind": "compute",
    "tier": "outside",
    "name": "WORKSTATION",
    "parent": null,
    "role": null,
    "model": "DEMO COMPUTE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "planned",
    "owner": "work",
    "says": "ILLUSTRATIVE COMPUTE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "rtx2080",
    "kind": "compute",
    "tier": "outside",
    "name": "RENDER NODE",
    "parent": null,
    "role": null,
    "model": "DEMO COMPUTE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "running",
    "owner": "lead",
    "says": "ILLUSTRATIVE COMPUTE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "cloud",
    "kind": "compute",
    "tier": "outside",
    "name": "COMPUTE POOL",
    "parent": null,
    "role": null,
    "model": "DEMO COMPUTE",
    "origin": "sim",
    "ports": [],
    "runs": [],
    "today": "SYNTHETIC UI FIXTURE; NO CONNECTED HARDWARE",
    "state": "built",
    "owner": "work",
    "says": "ILLUSTRATIVE COMPUTE IN THE DEMO WORKSPACE",
    "source": "SYNTHETIC DEMO"
  }
]);

export const LINKS = freeze([
  {
    "id": "demo-link-1",
    "from": "operator",
    "to": "shell",
    "kind": "access",
    "carries": "DEMO SESSION",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "running",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-2",
    "from": "observer",
    "to": "shell",
    "kind": "access",
    "carries": "DEMO SESSION",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "built",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-3",
    "from": "pilot",
    "to": "rc",
    "kind": "access",
    "carries": "DEMO SESSION",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "designed",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-4",
    "from": "shell",
    "to": "gateway",
    "kind": "local",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "named",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-5",
    "from": "gateway",
    "to": "postgres",
    "kind": "local",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "planned",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-6",
    "from": "shell",
    "to": "minio",
    "kind": "local",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "running",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-7",
    "from": "gateway",
    "to": "base-orin",
    "kind": "ethernet",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "built",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-8",
    "from": "base-orin",
    "to": "flight-orin",
    "kind": "wifi",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "designed",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-9",
    "from": "shell",
    "to": "sim-robot",
    "kind": "sim",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "named",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-10",
    "from": "sim-robot",
    "to": "sim-orin",
    "kind": "sim",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "planned",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-11",
    "from": "flight-orin",
    "to": "aircraft",
    "kind": "serial",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "running",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-12",
    "from": "d455",
    "to": "flight-orin",
    "kind": "usb",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "built",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-13",
    "from": "gps",
    "to": "flight-orin",
    "kind": "serial",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "designed",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-14",
    "from": "rc",
    "to": "ground",
    "kind": "usb",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "named",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-15",
    "from": "rc",
    "to": "aircraft",
    "kind": "radio",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "planned",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-16",
    "from": "xt2",
    "to": "sim-robot",
    "kind": "mount",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "running",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-17",
    "from": "z30",
    "to": "sim-robot",
    "kind": "mount",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "built",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-18",
    "from": "range",
    "to": "flight-orin",
    "kind": "mount",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "designed",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-19",
    "from": "imu-main",
    "to": "sim-robot",
    "kind": "sim",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "named",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "demo-link-20",
    "from": "sim-sensors",
    "to": "sim-orin",
    "kind": "sim",
    "carries": "SYNTHETIC SAMPLE STREAM",
    "measured": null,
    "today": "ILLUSTRATION ONLY",
    "state": "planned",
    "source": "SYNTHETIC DEMO"
  }
]);

export const INTERFACES = freeze([
  {
    "id": "video.h264",
    "type": "DEMO/SAMPLE_1",
    "carries": "DEMO VIDEO.H264 PAYLOAD",
    "owner": "lead",
    "state": "running"
  },
  {
    "id": "dji.video-frame",
    "type": "DEMO/SAMPLE_2",
    "carries": "DEMO DJI.VIDEO-FRAME PAYLOAD",
    "owner": "work",
    "state": "built"
  },
  {
    "id": "image.jpeg",
    "type": "DEMO/SAMPLE_3",
    "carries": "DEMO IMAGE.JPEG PAYLOAD",
    "owner": "lead",
    "state": "designed"
  },
  {
    "id": "image.raw",
    "type": "DEMO/SAMPLE_4",
    "carries": "DEMO IMAGE.RAW PAYLOAD",
    "owner": "work",
    "state": "named"
  },
  {
    "id": "imu",
    "type": "DEMO/SAMPLE_5",
    "carries": "DEMO IMU PAYLOAD",
    "owner": "lead",
    "state": "planned"
  },
  {
    "id": "thermal.spot",
    "type": "DEMO/SAMPLE_6",
    "carries": "DEMO THERMAL.SPOT PAYLOAD",
    "owner": "work",
    "state": "running"
  },
  {
    "id": "gimbal.attitude",
    "type": "DEMO/SAMPLE_7",
    "carries": "DEMO GIMBAL.ATTITUDE PAYLOAD",
    "owner": "lead",
    "state": "built"
  },
  {
    "id": "camera.link",
    "type": "DEMO/SAMPLE_8",
    "carries": "DEMO CAMERA.LINK PAYLOAD",
    "owner": "work",
    "state": "designed"
  },
  {
    "id": "duml.raw",
    "type": "DEMO/SAMPLE_9",
    "carries": "DEMO DUML.RAW PAYLOAD",
    "owner": "lead",
    "state": "named"
  },
  {
    "id": "heartbeat.operator",
    "type": "DEMO/SAMPLE_10",
    "carries": "DEMO HEARTBEAT.OPERATOR PAYLOAD",
    "owner": "work",
    "state": "planned"
  },
  {
    "id": "text",
    "type": "DEMO/SAMPLE_11",
    "carries": "DEMO TEXT PAYLOAD",
    "owner": "lead",
    "state": "running"
  },
  {
    "id": "aircraft.state",
    "type": "DEMO/SAMPLE_12",
    "carries": "DEMO AIRCRAFT.STATE PAYLOAD",
    "owner": "work",
    "state": "built"
  },
  {
    "id": "mission",
    "type": "DEMO/SAMPLE_13",
    "carries": "DEMO MISSION PAYLOAD",
    "owner": "lead",
    "state": "designed"
  },
  {
    "id": "site.bundle",
    "type": "DEMO/SAMPLE_14",
    "carries": "DEMO SITE.BUNDLE PAYLOAD",
    "owner": "work",
    "state": "named"
  },
  {
    "id": "recording",
    "type": "DEMO/SAMPLE_15",
    "carries": "DEMO RECORDING PAYLOAD",
    "owner": "lead",
    "state": "planned"
  }
]);

export const MODULES = freeze([
  {
    "id": "m-operator",
    "name": "SESSION",
    "inputs": [],
    "outputs": [],
    "app": "DEMO-SESSION",
    "runs": "job",
    "where": "ground",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "lead",
    "state": "running",
    "says": "ILLUSTRATES THE SESSION MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-telemetry",
    "name": "TELEMETRY",
    "inputs": [
      "aircraft.state"
    ],
    "outputs": [],
    "app": "DEMO-TELEMETRY",
    "runs": "live",
    "where": "ground",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "lead",
    "state": "built",
    "says": "ILLUSTRATES THE TELEMETRY MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-cameras",
    "name": "CAMERAS",
    "inputs": [
      "image.jpeg"
    ],
    "outputs": [],
    "app": "DEMO-CAMERAS",
    "runs": "live",
    "where": "ground",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "lead",
    "state": "designed",
    "says": "ILLUSTRATES THE CAMERAS MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-planner",
    "name": "PLANNER",
    "inputs": [],
    "outputs": [],
    "app": "DEMO-PLANNER",
    "runs": "live",
    "where": "ground",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "lead",
    "state": "named",
    "says": "ILLUSTRATES THE PLANNER MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-flight",
    "name": "SIM MOTION",
    "inputs": [],
    "outputs": [],
    "app": "DEMO-SIM-MOTION",
    "runs": "job",
    "where": "ground",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "lead",
    "state": "planned",
    "says": "ILLUSTRATES THE SIM MOTION MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-slam",
    "name": "MAPPING",
    "inputs": [
      "image.raw"
    ],
    "outputs": [],
    "app": null,
    "runs": "live",
    "where": "robot",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "lead",
    "state": "running",
    "says": "ILLUSTRATES THE MAPPING MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-recording",
    "name": "CAPTURE",
    "inputs": [],
    "outputs": [
      "recording"
    ],
    "app": null,
    "runs": "live",
    "where": "robot",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "lead",
    "state": "built",
    "says": "ILLUSTRATES THE CAPTURE MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-recon",
    "name": "RECONSTRUCTION",
    "inputs": [
      "recording",
      "recording"
    ],
    "outputs": [],
    "app": null,
    "runs": "live",
    "where": "robot",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "lead",
    "state": "designed",
    "says": "ILLUSTRATES THE RECONSTRUCTION MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-video-jpeg",
    "name": "IMAGE CONVERTER",
    "inputs": [
      "image.raw"
    ],
    "outputs": [
      "image.jpeg"
    ],
    "app": null,
    "runs": "job",
    "where": "robot",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "work",
    "state": "named",
    "says": "ILLUSTRATES THE IMAGE CONVERTER MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-imu-echo",
    "name": "SIGNAL MONITOR",
    "inputs": [
      "imu"
    ],
    "outputs": [
      "text"
    ],
    "app": null,
    "runs": "live",
    "where": "ground GPU",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "work",
    "state": "planned",
    "says": "ILLUSTRATES THE SIGNAL MONITOR MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-site",
    "name": "SITE",
    "inputs": [],
    "outputs": [
      "site.bundle"
    ],
    "app": "DEMO-SITE",
    "runs": "live",
    "where": "ground GPU",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "work",
    "state": "running",
    "says": "ILLUSTRATES THE SITE MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-planning",
    "name": "PATH EDITOR",
    "inputs": [
      "site.bundle"
    ],
    "outputs": [
      "mission"
    ],
    "app": null,
    "runs": "live",
    "where": "ground GPU",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "work",
    "state": "built",
    "says": "ILLUSTRATES THE PATH EDITOR MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-simulation",
    "name": "SIMULATION",
    "inputs": [
      "mission"
    ],
    "outputs": [
      "aircraft.state"
    ],
    "app": null,
    "runs": "job",
    "where": "sim cluster",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "work",
    "state": "designed",
    "says": "ILLUSTRATES THE SIMULATION MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-simkit",
    "name": "SCENE GENERATOR",
    "inputs": [],
    "outputs": [
      "recording"
    ],
    "app": null,
    "runs": "live",
    "where": "ground GPU",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "work",
    "state": "named",
    "says": "ILLUSTRATES THE SCENE GENERATOR MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-bench",
    "name": "BENCH",
    "inputs": [],
    "outputs": [],
    "app": "DEMO-BENCH",
    "runs": "live",
    "where": "ground GPU",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "work",
    "state": "planned",
    "says": "ILLUSTRATES THE BENCH MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  },
  {
    "id": "m-assistant",
    "name": "ASSISTANT",
    "inputs": [],
    "outputs": [],
    "app": "DEMO-ASSISTANT",
    "runs": "live",
    "where": "ground GPU",
    "today": "SYNTHETIC UI FIXTURE",
    "owner": "work",
    "state": "running",
    "says": "ILLUSTRATES THE ASSISTANT MODULE PANEL",
    "source": "SYNTHETIC DEMO"
  }
]);

export const CHAINS = freeze([
  {
    "id": "demo-camera",
    "name": "CAMERA PREVIEW",
    "steps": [
      {
        "node": "d455",
        "port": "COLOR"
      },
      {
        "iface": "image.raw"
      },
      {
        "module": "m-video-jpeg"
      },
      {
        "iface": "image.jpeg"
      },
      {
        "module": "m-cameras"
      }
    ]
  },
  {
    "id": "demo-map",
    "name": "DEPTH TO MAP",
    "steps": [
      {
        "node": "d455",
        "port": "DEPTH"
      },
      {
        "iface": "image.raw"
      },
      {
        "module": "m-slam"
      },
      {
        "module": "m-recon"
      }
    ]
  },
  {
    "id": "demo-signal",
    "name": "MOTION MONITOR",
    "steps": [
      {
        "node": "imu-main",
        "port": "MOTION"
      },
      {
        "iface": "imu"
      },
      {
        "module": "m-imu-echo"
      },
      {
        "iface": "text"
      }
    ]
  },
  {
    "id": "demo-plan",
    "name": "SITE TO SIMULATION",
    "steps": [
      {
        "module": "m-site"
      },
      {
        "iface": "site.bundle"
      },
      {
        "module": "m-planning"
      },
      {
        "iface": "mission"
      },
      {
        "module": "m-simulation"
      },
      {
        "iface": "aircraft.state"
      },
      {
        "module": "m-telemetry"
      }
    ]
  },
  {
    "id": "demo-record",
    "name": "CAPTURE TO FILES",
    "steps": [
      {
        "node": "sim-robot",
        "port": "SAMPLES"
      },
      {
        "module": "m-recording"
      },
      {
        "iface": "recording"
      },
      {
        "module": "m-recon"
      }
    ]
  },
  {
    "id": "demo-scene",
    "name": "SYNTHETIC SCENE",
    "steps": [
      {
        "module": "m-simkit"
      },
      {
        "iface": "recording"
      },
      {
        "module": "m-recon"
      }
    ]
  }
]);

export const COMMAND_PATH = freeze([
  {
    "id": "cp-sign-in",
    "node": "operator",
    "step": "OPEN DEMO SESSION",
    "says": "LOCAL VISUAL PREVIEW; NO DEVICE COMMAND IS SENT"
  },
  {
    "id": "cp-lease",
    "node": "shell",
    "step": "SELECT A VIRTUAL DEVICE",
    "says": "LOCAL VISUAL PREVIEW; NO DEVICE COMMAND IS SENT"
  },
  {
    "id": "cp-heartbeat",
    "node": "shell",
    "step": "SEND A SAMPLE EVENT",
    "says": "LOCAL VISUAL PREVIEW; NO DEVICE COMMAND IS SENT"
  },
  {
    "id": "cp-zenoh",
    "node": "gateway",
    "step": "ROUTE IN MEMORY",
    "says": "LOCAL VISUAL PREVIEW; NO DEVICE COMMAND IS SENT"
  },
  {
    "id": "cp-gate",
    "node": "flight-orin",
    "step": "CHECK DEMO INPUT",
    "says": "LOCAL VISUAL PREVIEW; NO DEVICE COMMAND IS SENT"
  },
  {
    "id": "cp-safety",
    "node": "flight-orin",
    "step": "UPDATE SIMULATION",
    "says": "LOCAL VISUAL PREVIEW; NO DEVICE COMMAND IS SENT"
  },
  {
    "id": "cp-link",
    "node": "flight-orin",
    "step": "DRAW TELEMETRY",
    "says": "LOCAL VISUAL PREVIEW; NO DEVICE COMMAND IS SENT"
  },
  {
    "id": "cp-fc",
    "node": "aircraft",
    "step": "ANIMATE THE DRONE",
    "says": "LOCAL VISUAL PREVIEW; NO DEVICE COMMAND IS SENT"
  }
]);

export const SAFETY = freeze({
  "overrides": "ALL MOTION IS A LOCAL ANIMATION",
  "unsigned": "DEMO CONTROLS HAVE NO HARDWARE CONNECTION",
  "limits": "ILLUSTRATIVE VALUES ONLY; NOT FLIGHT LIMITS",
  "failsafes": [
    [
      "PAUSE",
      "FREEZE THE PREVIEW"
    ],
    [
      "RESET",
      "RETURN TO THE SAMPLE START"
    ],
    [
      "CLOSE",
      "DISCARD TRANSIENT INPUT"
    ]
  ],
  "source": "SYNTHETIC DEMO"
});

export const OPEN_WITH_THE_LEAD = freeze([
  "MOUNT THE VISUAL COMPONENTS IN YOUR OWN HOST",
  "CONNECT THE HOST TO YOUR OWN DATA ADAPTERS",
  "ALL BUNDLED TOPOLOGY AND STATUS DATA IS SYNTHETIC"
]);

export const nodeById = Object.freeze(Object.fromEntries(NODES.map(entry => [entry.id, entry])));
export const moduleById = Object.freeze(Object.fromEntries(MODULES.map(entry => [entry.id, entry])));
export const interfaceById = Object.freeze(Object.fromEntries(INTERFACES.map(entry => [entry.id, entry])));

/** The links that touch a node. */
export const linksOf = id => LINKS.filter(entry => entry.from === id || entry.to === id);
/** The sensors on a node. */
export const sensorsOf = id => NODES.filter(entry => entry.kind === 'sensor' && entry.parent === id);
/** The services and stores inside a cluster node. */
export const membersOf = id => NODES.filter(entry => entry.parent === id && entry.kind !== 'sensor');
/** The modules that run on a node: by where they run (ground, robot, sim cluster). */
export function modulesOn(id) {
  const where = id === 'ground' ? ['ground', 'ground GPU'] : id === 'flight-orin' ? ['robot'] : id === 'sim-robot' ? ['sim cluster'] : [];
  return MODULES.filter(entry => where.includes(entry.where));
}
