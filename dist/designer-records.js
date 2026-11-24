// Synthetic public UI records. Every run, metric, device, case and message is invented.
// Only the public San Francisco OSM building geometry is real geographic data.
import {SAMPLE_SITE, SAMPLE_BUILDINGS} from "./designer-sample-site.js";
function freeze(value) { if(value && typeof value === "object" && !Object.isFrozen(value)) {Object.freeze(value); for(const inner of Object.values(value)) freeze(inner);} return value; }
export const ACTIVITY = freeze([
  {
    "time": "08:00",
    "kind": "deploy",
    "text": "DEMO PACKAGE ADDED TO THE WORKSPACE",
    "who": "DEMO ADMIN"
  },
  {
    "time": "08:20",
    "kind": "deploy",
    "text": "SAMPLE UPDATE READY FOR REVIEW",
    "who": "DEMO SCHEDULER"
  },
  {
    "time": "10:00",
    "kind": "lease",
    "text": "VIRTUAL ROBOT SELECTED",
    "who": "OPERATOR A"
  },
  {
    "time": "10:01",
    "kind": "command",
    "text": "PREVIEW STARTED",
    "who": "OPERATOR A"
  },
  {
    "time": "10:02",
    "kind": "command",
    "text": "SYNTHETIC OBSTACLE HIGHLIGHTED",
    "who": "DEMO SENSOR"
  },
  {
    "time": "10:03",
    "kind": "command",
    "text": "PREVIEW PAUSED",
    "who": "OPERATOR A"
  },
  {
    "time": "10:04",
    "kind": "command",
    "text": "PREVIEW RESUMED",
    "who": "OPERATOR A"
  },
  {
    "time": "10:05",
    "kind": "lease",
    "text": "VIRTUAL ROBOT RELEASED",
    "who": "OPERATOR A"
  }
]);

export const ASSETS = freeze([
  {
    "id": "a-ferry",
    "kind": "site",
    "name": "FERRY TERMINAL",
    "full": "SAN FRANCISCO GOLDEN GATE FERRY TERMINAL",
    "osm": "osm:way/69707604",
    "mobility": "FIXED",
    "site": "sf-waterfront",
    "frame": "THE SITE FRAME OF SF WATERFRONT",
    "heights": "ROOF 11 M FROM THE OSM HEIGHT TAG; GROUND TAKEN AS FLAT",
    "scans": 0,
    "cases": 0,
    "regime": null,
    "outline": [
      {
        "x": 72.6,
        "y": 10.6
      },
      {
        "x": 73.8,
        "y": 8.4
      },
      {
        "x": 76.3,
        "y": 4
      },
      {
        "x": 79.9,
        "y": -2.4
      },
      {
        "x": 97.1,
        "y": 7.2
      },
      {
        "x": 99.5,
        "y": 3
      },
      {
        "x": 101.8,
        "y": -1.1
      },
      {
        "x": 103,
        "y": -3.3
      },
      {
        "x": 105.7,
        "y": -1.9
      },
      {
        "x": 113.9,
        "y": 2.8
      },
      {
        "x": 116.4,
        "y": 4.1
      },
      {
        "x": 115.1,
        "y": 6.3
      },
      {
        "x": 113.5,
        "y": 9.2
      },
      {
        "x": 110.4,
        "y": 14.8
      },
      {
        "x": 125.1,
        "y": 23
      },
      {
        "x": 129.2,
        "y": 15.6
      },
      {
        "x": 133.3,
        "y": 17.8
      },
      {
        "x": 128.2,
        "y": 26.8
      },
      {
        "x": 125.5,
        "y": 31.7
      },
      {
        "x": 123.1,
        "y": 35.9
      },
      {
        "x": 121.4,
        "y": 35
      },
      {
        "x": 120.2,
        "y": 37.2
      },
      {
        "x": 119.9,
        "y": 37.1
      },
      {
        "x": 100.9,
        "y": 26.4
      },
      {
        "x": 92.5,
        "y": 21.8
      },
      {
        "x": 74.9,
        "y": 11.9
      },
      {
        "x": 72.9,
        "y": 10.8
      }
    ],
    "roof_m": 11
  },
  {
    "id": "a-transition",
    "kind": "site",
    "name": "TRANSITION STRUCTURE",
    "full": "SAN FRANCISCO TRANSITION STRUCTURE",
    "osm": "osm:way/123559872",
    "mobility": "FIXED",
    "site": "sf-waterfront",
    "frame": "THE SITE FRAME OF SF WATERFRONT",
    "heights": "ROOF 16 M FROM THE OSM HEIGHT TAG; GROUND TAKEN AS FLAT",
    "scans": 0,
    "cases": 0,
    "regime": null,
    "outline": [
      {
        "x": 193.5,
        "y": 36.4
      },
      {
        "x": 193.1,
        "y": 37.1
      },
      {
        "x": 180.6,
        "y": 59.1
      },
      {
        "x": 153.9,
        "y": 44.2
      },
      {
        "x": 151.9,
        "y": 47.7
      },
      {
        "x": 141.1,
        "y": 41.7
      },
      {
        "x": 149.6,
        "y": 26.6
      },
      {
        "x": 155.9,
        "y": 15.4
      },
      {
        "x": 163.3,
        "y": 19.5
      },
      {
        "x": 176.5,
        "y": 26.8
      }
    ],
    "roof_m": 16
  },
  {
    "id": "a-small",
    "kind": "site",
    "name": "BUILDING 260927791",
    "full": "A SMALL BUILDING WITH NO NAME IN OPENSTREETMAP",
    "osm": "osm:way/260927791",
    "mobility": "FIXED",
    "site": "sf-waterfront",
    "frame": "THE SITE FRAME OF SF WATERFRONT",
    "heights": "ROOF 10 M: A GUESS (NO HEIGHT IN OSM); GROUND TAKEN AS FLAT",
    "scans": 2,
    "cases": 1,
    "regime": null,
    "outline": [
      {
        "x": -230.7,
        "y": 142.7
      },
      {
        "x": -227.4,
        "y": 143.3
      },
      {
        "x": -229,
        "y": 152.6
      },
      {
        "x": -232.5,
        "y": 152.1
      },
      {
        "x": -233,
        "y": 152
      },
      {
        "x": -231.5,
        "y": 142.6
      }
    ],
    "roof_m": 10
  },
  {
    "id": "a-audiffred",
    "kind": "site",
    "name": "AUDIFFRED BUILDING",
    "full": "THE AUDIFFRED BUILDING",
    "osm": "osm:way/193054136",
    "mobility": "FIXED",
    "site": "sf-waterfront",
    "frame": "THE SITE FRAME OF SF WATERFRONT",
    "heights": "ROOF 9 M FROM 3 LEVELS; GROUND TAKEN AS FLAT",
    "scans": 0,
    "cases": 0,
    "regime": null,
    "outline": [
      {
        "x": 61.7,
        "y": -251.6
      },
      {
        "x": 71.6,
        "y": -261.5
      },
      {
        "x": 101.3,
        "y": -232
      },
      {
        "x": 91.4,
        "y": -222.1
      }
    ],
    "roof_m": 9
  },
  {
    "id": "a-plane",
    "kind": "plane",
    "name": "A320 SAMPLE-01",
    "full": "AN AIRLINER, A SAMPLE RECORD",
    "osm": null,
    "mobility": "MOVABLE",
    "site": null,
    "frame": "ITS OWN FRAME: A MOVABLE ASSET IS NOT ITS GPS",
    "heights": "NO SHAPE YET",
    "scans": 0,
    "cases": 0,
    "regime": "COMMERCIAL AIR (OPS V2)",
    "outline": null,
    "roof_m": null
  },
  {
    "id": "a-tank",
    "kind": "tank",
    "name": "M1 SAMPLE-02",
    "full": "AN ARMOURED VEHICLE, A SAMPLE RECORD",
    "osm": null,
    "mobility": "MOVABLE",
    "site": null,
    "frame": "ITS OWN FRAME: A MOVABLE ASSET IS NOT ITS GPS",
    "heights": "NO SHAPE YET",
    "scans": 0,
    "cases": 0,
    "regime": "MILITARY GROUND (OPS V2)",
    "outline": null,
    "roof_m": null
  }
]);

export const ASSISTANT = freeze({
  "conversation": [
    [
      "YOU",
      "SHOW A SAMPLE INSPECTION PLAN."
    ],
    [
      "ASSISTANT",
      "THE DEMO PLAN IS READY FOR REVIEW."
    ],
    [
      "YOU",
      "OPEN ITS SIMULATION."
    ],
    [
      "ASSISTANT",
      "THE PREVIEW IS READY. NO DEVICE IS CONNECTED."
    ]
  ],
  "may": [
    "FIND A PLACE AND ITS BUILDINGS",
    "SET HEIGHTS AND OUTLINES, WITH YOUR WORD",
    "MAKE AND CHECK A PLAN",
    "RUN A SIMULATION",
    "EXPLAIN A CHECK OR A FIND"
  ],
  "mayNot": [
    "COMMAND AN AIRCRAFT",
    "TAKE OR HOLD A LEASE",
    "SEND A MISSION TO FLIGHT",
    "APPROVE A DEPLOY",
    "DECIDE A CASE"
  ]
});

export const BENCH = freeze({
  "mass_kg": 2.8,
  "mtow_kg": 4.2,
  "cg": "SYNTHETIC CENTRE-OF-MASS EXAMPLE",
  "cg_cm": {
    "back": 0.5,
    "right": -0.4
  },
  "note": "INVENTED VALUES FOR EXERCISING THE BALANCE GAUGE; NO REAL TEST OR AIRCRAFT",
  "checklist": [
    [
      "DEMO FRAME READY",
      "done"
    ],
    [
      "INPUTS NEUTRAL",
      "done"
    ],
    [
      "SAMPLE DATA READY",
      "done"
    ],
    [
      "CHECK VIRTUAL LIMITS",
      "now"
    ],
    [
      "TEST PAUSE",
      "todo"
    ],
    [
      "TEST RESET",
      "todo"
    ]
  ]
});

export const CASES = freeze([
  {
    "id": "c1",
    "name": "CASE 1",
    "asset": "a-small",
    "state": "IN REVIEW",
    "owner": "REVIEWER B",
    "opened": "2026-11-24 10:40",
    "findings": [
      "fd1",
      "fd2",
      "fd3"
    ],
    "decision": null,
    "evidence": {
      "recording": "rec3",
      "pipeline": "SLAM, MODEL A, SPLAT",
      "model": "MODEL A, CLOUD",
      "origin": "sim"
    },
    "history": [
      [
        "10:40",
        "OPENED FROM RUN 3 (SIM)"
      ],
      [
        "10:41",
        "ASSIGNED TO REVIEWER B"
      ],
      [
        "10:52",
        "CRACK MARKED CRITICAL"
      ],
      [
        "11:05",
        "HOT SPOT MARKED NEW"
      ]
    ]
  },
  {
    "id": "c2",
    "name": "CASE 2",
    "asset": "a-small",
    "state": "DECIDED",
    "owner": "REVIEWER B",
    "opened": "2026-11-24 10:46",
    "findings": [
      "fd4"
    ],
    "decision": {
      "what": "FOLLOW UP",
      "who": "REVIEWER B",
      "when": "2026-11-24 11:20",
      "on": "RECORDING OF RUN 3, MODEL A, CLOUD"
    },
    "evidence": {
      "recording": "rec3",
      "pipeline": "SLAM, COMPARE",
      "model": "CHANGE BY DEPTH",
      "origin": "sim"
    },
    "history": [
      [
        "10:46",
        "OPENED FROM COMPARE: A NEW OBJECT"
      ],
      [
        "11:20",
        "FOLLOW UP: ADD THE POLE TO THE SITE"
      ]
    ]
  }
]);

export const CHANGES = freeze({
  "rows": [
    {
      "title": "NEW: 1 OBJECT",
      "detail": "WEST, 13 M OUT",
      "level": "fail"
    },
    {
      "title": "GONE",
      "detail": "NOTHING",
      "level": "ok"
    },
    {
      "title": "MOVED",
      "detail": "NONE OVER 5 CM",
      "level": "ok"
    }
  ],
  "note": "THE POLE ADDED BETWEEN THE TWO SIMULATED SCANS: CASE 2"
});

export const DEPLOYS = freeze([
  {
    "node": "ground",
    "cluster": "DEMO HUB",
    "holds": "NONE",
    "last": "SAMPLE PACKAGE 1.0"
  },
  {
    "node": "base-orin",
    "cluster": "EDGE LINK",
    "holds": "DEMO UPDATE QUEUED",
    "last": "SAMPLE PACKAGE 2.0"
  },
  {
    "node": "sim-robot",
    "cluster": "SIM ROBOT",
    "holds": "NONE",
    "last": "SAMPLE PACKAGE 3.0"
  },
  {
    "node": "flight-orin",
    "cluster": "ROBOT 01",
    "holds": "NONE",
    "last": "SAMPLE PACKAGE 4.0"
  }
]);

export const EVENTS = freeze([
  {
    "id": "e1",
    "day": "2026-11-22",
    "time": "15:00",
    "kind": "flight",
    "title": "FLIGHT 1 IN VIRTUAL SIMULATOR",
    "asset": "a-ferry",
    "who": "OPERATOR A",
    "state": "cancelled",
    "why": "REFUSED BY THE 45 M DEMO BOUNDARY"
  },
  {
    "id": "e2",
    "day": "2026-11-23",
    "time": "16:10",
    "kind": "flight",
    "title": "RUN 1 IN THE PAGE",
    "asset": "a-small",
    "who": "OPERATOR A",
    "state": "completed"
  },
  {
    "id": "e3",
    "day": "2026-11-23",
    "time": "18:00",
    "kind": "job",
    "title": "SPLAT OF THE EARLIER SCAN",
    "asset": "a-small",
    "who": "DEMO RENDER NODE",
    "state": "completed"
  },
  {
    "id": "e4",
    "day": "2026-11-24",
    "time": "16:00",
    "kind": "flight",
    "title": "RUN 4 IN VIRTUAL SIMULATOR",
    "asset": "a-small",
    "who": "OPERATOR A",
    "state": "planned",
    "gates": [
      {
        "label": "SIM",
        "says": "RUN 3 PASSED IN SIMULATION",
        "state": "done"
      },
      {
        "label": "BENCH",
        "says": "BENCH CHECKS, PROPS OFF",
        "state": "now"
      },
      {
        "label": "REVIEW",
        "says": "DEMO ADMIN AGREES",
        "state": "todo"
      }
    ]
  },
  {
    "id": "e5",
    "day": "2026-11-24",
    "time": "10:05",
    "kind": "job",
    "title": "SLAM AND SPLAT OF RUN 3",
    "asset": "a-small",
    "who": "CLOUD GPU",
    "state": "active"
  },
  {
    "id": "e6",
    "day": "2026-11-24",
    "time": "11:00",
    "kind": "bench",
    "title": "BENCH: PROPS-OFF CHECKS",
    "asset": null,
    "who": "OPERATOR A",
    "state": "planned"
  },
  {
    "id": "e7",
    "day": "2026-11-24",
    "time": "14:00",
    "kind": "review",
    "title": "REVIEW DUE: CASE 1",
    "asset": "a-small",
    "who": "REVIEWER B",
    "state": "planned"
  },
  {
    "id": "e8",
    "day": "2026-11-25",
    "time": "10:00",
    "kind": "deploy",
    "title": "DEPLOY WAITING: RC LINK ON EDGE LINK",
    "asset": null,
    "who": "DEMO ADMIN",
    "state": "planned"
  },
  {
    "id": "e9",
    "day": "2026-11-26",
    "time": "10:00",
    "kind": "rescan",
    "title": "RE-SCAN DUE: BUILDING 260927791",
    "asset": "a-small",
    "who": "OPERATOR A",
    "state": "planned"
  }
]);

export const FAULTS = freeze([
  {
    "key": "wind",
    "label": "WIND 5 M/S"
  },
  {
    "key": "link",
    "label": "LINK LOST 10 S"
  },
  {
    "key": "battery",
    "label": "BATTERY AT 25 %"
  }
]);

export const FINDINGS = freeze([
  {
    "id": "fd1",
    "asset": "a-small",
    "case": "c1",
    "type": "CORROSION",
    "zone": "ROOF EDGE, NORTH",
    "severity": "major",
    "modality": "RGB",
    "confidence": 0.81,
    "frame": 1184,
    "state": "IN REVIEW",
    "truth": "PLACED IN THE SCENARIO",
    "at": {
      "x": 0,
      "y": 5.5
    }
  },
  {
    "id": "fd2",
    "asset": "a-small",
    "case": "c1",
    "type": "CRACK",
    "zone": "EAST WALL",
    "severity": "critical",
    "modality": "RGB",
    "confidence": 0.74,
    "frame": 1530,
    "state": "IN REVIEW",
    "truth": "PLACED IN THE SCENARIO",
    "at": {
      "x": 3.4,
      "y": 0
    }
  },
  {
    "id": "fd3",
    "asset": "a-small",
    "case": "c1",
    "type": "HOT SPOT",
    "zone": "ROOF, CENTRE",
    "severity": "minor",
    "modality": "THERMAL",
    "confidence": 0.66,
    "frame": 1702,
    "state": "NEW",
    "truth": "NOT IN THE SCENARIO: A FALSE FIND",
    "at": {
      "x": 0,
      "y": 0
    }
  },
  {
    "id": "fd4",
    "asset": "a-small",
    "case": "c2",
    "type": "NEW OBJECT",
    "zone": "WEST, 13 M OUT",
    "severity": "minor",
    "modality": "DEPTH",
    "confidence": 0.97,
    "frame": 610,
    "state": "DECIDED",
    "truth": "THE POLE, ADDED BETWEEN THE TWO SCANS",
    "at": {
      "x": -8.4,
      "y": 10.9
    }
  }
]);

export const FLIGHTS = freeze([
  {
    "id": "f1",
    "name": "FLIGHT 1",
    "covers": [
      "a-ferry",
      "a-transition"
    ],
    "generator": "WHOLE",
    "camera": "COLOR VISUAL",
    "standoff_m": 8,
    "state": "REFUSED",
    "checks": [
      {
        "level": "error",
        "code": "OUTSIDE_FENCE",
        "message": "SAMPLE PATH EXCEEDS THE 45 M DEMO BOUNDARY",
        "count": 32
      },
      {
        "level": "warn",
        "code": "SEVERAL_TARGETS",
        "message": "DEMO CONTAINS TWO TARGETS"
      }
    ],
    "reach_m": 78,
    "missions": [],
    "note": "SYNTHETIC REFUSAL EXAMPLE: TARGET EXCEEDS THE DEMO WORKSPACE",
    "fence": {
      "bearing": 62,
      "building": {
        "east": 30,
        "north": 20,
        "width": 121,
        "depth": 62
      }
    }
  },
  {
    "id": "f2",
    "name": "FLIGHT 2",
    "covers": [
      "a-small"
    ],
    "generator": "ORBIT",
    "camera": "COLOR VISUAL",
    "standoff_m": 8,
    "state": "PASSED",
    "checks": [
      {
        "level": "warn",
        "code": "GUESSED_ROOF",
        "message": "THE ROOF HEIGHT IS A GUESS: 10 M"
      }
    ],
    "reach_m": 26.8,
    "home": {
      "x": -230.7,
      "y": 134.6
    },
    "path": [
      {
        "x": -230.7,
        "y": 133.8,
        "heading": 0
      },
      {
        "x": -234.3,
        "y": 134.2,
        "heading": 15
      },
      {
        "x": -237.6,
        "y": 135.6,
        "heading": 30
      },
      {
        "x": -240.4,
        "y": 137.8,
        "heading": 45
      },
      {
        "x": -242.6,
        "y": 140.7,
        "heading": 60
      },
      {
        "x": -244,
        "y": 144,
        "heading": 75
      },
      {
        "x": -244.5,
        "y": 147.6,
        "heading": 90
      },
      {
        "x": -244,
        "y": 151.1,
        "heading": 105
      },
      {
        "x": -242.6,
        "y": 154.5,
        "heading": 120
      },
      {
        "x": -240.4,
        "y": 157.3,
        "heading": 135
      },
      {
        "x": -237.6,
        "y": 159.5,
        "heading": 150
      },
      {
        "x": -234.3,
        "y": 160.9,
        "heading": 165
      },
      {
        "x": -230.7,
        "y": 161.4,
        "heading": 180
      },
      {
        "x": -227.1,
        "y": 160.9,
        "heading": 195
      },
      {
        "x": -223.8,
        "y": 159.5,
        "heading": 210
      },
      {
        "x": -220.9,
        "y": 157.3,
        "heading": 225
      },
      {
        "x": -218.7,
        "y": 154.5,
        "heading": 240
      },
      {
        "x": -217.4,
        "y": 151.1,
        "heading": 255
      },
      {
        "x": -216.9,
        "y": 147.6,
        "heading": 270
      },
      {
        "x": -217.4,
        "y": 144,
        "heading": 285
      },
      {
        "x": -218.7,
        "y": 140.7,
        "heading": 300
      },
      {
        "x": -220.9,
        "y": 137.8,
        "heading": 315
      },
      {
        "x": -223.8,
        "y": 135.6,
        "heading": 330
      },
      {
        "x": -227.1,
        "y": 134.2,
        "heading": 345
      },
      {
        "x": -230.7,
        "y": 133.8,
        "heading": 0
      }
    ],
    "missions": [
      {
        "name": "MISSION 1",
        "steps": 28,
        "of": 50,
        "time": "3:17",
        "loss": "SYNTHETIC MISSION PREVIEW"
      }
    ],
    "coverage": {
      "seen": 0.88,
      "three": 0.83,
      "faces": [
        {
          "name": "ROOF",
          "unseen": 0.5,
          "few": 0.1,
          "three": 0.1,
          "fine": 0.3
        },
        {
          "name": "N",
          "unseen": 0,
          "few": 0.05,
          "three": 0.15,
          "fine": 0.8
        },
        {
          "name": "E",
          "unseen": 0,
          "few": 0.05,
          "three": 0.2,
          "fine": 0.75
        },
        {
          "name": "S",
          "unseen": 0,
          "few": 0.05,
          "three": 0.15,
          "fine": 0.8
        },
        {
          "name": "W",
          "unseen": 0,
          "few": 0.1,
          "three": 0.2,
          "fine": 0.7
        }
      ]
    },
    "expected": {
      "registered": 0.91,
      "splatViews": 0.86
    },
    "profile": [
      0,
      1.2,
      12,
      12,
      12,
      12,
      12,
      12,
      12,
      12,
      1.2,
      0
    ],
    "homeNote": "FOUND 13 M SOUTH OF THE BUILDING",
    "fence": {
      "bearing": 0,
      "building": {
        "east": 0,
        "north": 13,
        "width": 6,
        "depth": 10
      }
    },
    "orbit": {
      "up_m": 12,
      "pitch_deg": -10
    },
    "guard": {
      "stopAt": 6,
      "rejoin": 10,
      "out_m": 18,
      "bearing_deg": 120,
      "leftOut": [
        7,
        8,
        9
      ],
      "trail": 24,
      "struckAt": 8
    }
  }
]);

export const GUARD_SENSORS = freeze([
  {
    "name": "DEMO DEPTH",
    "reach": "0-8 M"
  },
  {
    "name": "DEMO FORWARD",
    "reach": "0-20 M"
  },
  {
    "name": "DEMO UPWARD",
    "reach": "0-6 M"
  },
  {
    "name": "DEMO DOWNWARD",
    "reach": "0-8 M"
  }
]);

export const LIMITS = freeze({
  "fence_m": 45,
  "up_m": [
    3,
    45
  ],
  "speed_mps": 3,
  "climb_mps": 1.5,
  "battery_start_pct": 40,
  "battery_reserve_pct": 25
});

export const MODELS = freeze([
  {
    "name": "DEMO MODEL 1",
    "short": "MODEL 1",
    "kind": "SEGMENTATION, 5 CLASSES",
    "score": 0.72,
    "measure": "SYNTHETIC EXAMPLE SCORE"
  },
  {
    "name": "DEMO MODEL 2",
    "short": "MODEL 2",
    "kind": "SEGMENTATION, 5 CLASSES",
    "score": 0.64,
    "measure": "SYNTHETIC EXAMPLE SCORE"
  },
  {
    "name": "DEMO MODEL 3",
    "short": "MODEL 3",
    "kind": "DETECTION: BOLT, RIVET, SCREW",
    "score": 0.81,
    "measure": "SYNTHETIC EXAMPLE SCORE"
  }
]);

export const NOTES = freeze([
  {
    "when": "2026-11-24 10:00",
    "who": "OPERATOR A",
    "text": "SYNTHETIC NOTES FOR THE UI DEMO."
  },
  {
    "when": "2026-11-23 17:00",
    "who": "OPERATOR A",
    "text": "REVIEW THE SELECTED TARGET."
  },
  {
    "when": "2026-11-24 11:25",
    "who": "REVIEWER B",
    "text": "COMPARE THE TWO DEMO SCANS."
  }
]);

export const NOW = freeze({
  "day": "2026-11-24",
  "time": "11:30"
});

export const PIPELINE = freeze([
  {
    "stage": "SLAM",
    "minutes": 6.2,
    "target": 10,
    "done": 1,
    "takes": "RECORDING",
    "gives": "POSES, A MAP",
    "where": "CLOUD GPU"
  },
  {
    "stage": "MODELS",
    "minutes": 1.8,
    "target": 5,
    "done": 1,
    "takes": "FRAMES",
    "gives": "FINDS",
    "where": "CLOUD GPU"
  },
  {
    "stage": "SPLAT",
    "minutes": 18.5,
    "target": 20,
    "done": 0.6,
    "takes": "POSES, FRAMES",
    "gives": "A SPLAT",
    "where": "DEMO RENDER NODE"
  }
]);

export const PLACES = freeze([
  {
    "name": "SAN FRANCISCO FERRY BUILDING",
    "where": "37.79560 N  122.39350 W",
    "source": "NOMINATIM"
  },
  {
    "name": "FERRY BUILDING MARKETPLACE",
    "where": "37.79550 N  122.39340 W",
    "source": "NOMINATIM"
  }
]);

export const PLAN_SETTINGS = freeze([
  {
    "label": "STANDOFF",
    "key": "standoff_m",
    "min": 2,
    "max": 20,
    "unit": "m",
    "decimals": 0
  },
  {
    "label": "SPEED",
    "value": 2,
    "min": 0.5,
    "max": 2,
    "unit": "m/s",
    "decimals": 1
  },
  {
    "label": "LOWEST",
    "value": 3,
    "min": 2,
    "max": 30,
    "unit": "m",
    "decimals": 0
  },
  {
    "label": "CLEARANCE",
    "value": 3,
    "min": 1,
    "max": 10,
    "unit": "m",
    "decimals": 0
  }
]);

export const PLAYHEADS = freeze({
  "simulate": {
    "at": "01:33",
    "share": 0.47
  },
  "review": {
    "at": "01:36",
    "share": 0.47
  }
});

export const READY = freeze([
  [
    "SAMPLE DATA",
    "READY"
  ],
  [
    "INPUT MODE",
    "VIRTUAL"
  ],
  [
    "POSITION SOURCE",
    "SYNTHETIC"
  ],
  [
    "DEMO BATTERY",
    "92 %"
  ],
  [
    "HOME MARKER",
    "SET"
  ]
]);

export const RECORDINGS = freeze([
  {
    "id": "rec3",
    "name": "RECORDING OF RUN 3",
    "run": "r3",
    "origin": "sim",
    "length": "3:24",
    "size": "5.2 GB",
    "splits": 1,
    "topics": [
      [
        "/demo/color",
        "24 HZ"
      ],
      [
        "/demo/depth",
        "24 HZ"
      ],
      [
        "/demo/motion",
        "100 HZ"
      ]
    ],
    "truth": "TRUTH IN ITS OWN FILE: POSES, CAMERAS, THE POLE"
  },
  {
    "id": "rec0",
    "name": "EARLIER SCAN, SAME AREA",
    "run": null,
    "origin": "sim",
    "length": "3:10",
    "size": "4.9 GB",
    "splits": 1,
    "topics": [
      [
        "/demo/color",
        "24 HZ"
      ],
      [
        "/demo/depth",
        "24 HZ"
      ],
      [
        "/demo/motion",
        "100 HZ"
      ]
    ],
    "truth": "TRUTH IN ITS OWN FILE: NO POLE"
  }
]);

export const RENDERS = freeze([
  {
    "name": "DEPTH FRAMES, RUN 3",
    "kernel": "GEOMETRIC",
    "state": "DONE",
    "frames": 3060
  },
  {
    "name": "COLOR VISUAL, RUN 3",
    "kernel": "GEOMETRIC",
    "state": "DONE",
    "frames": 6120
  },
  {
    "name": "THERMAL, RUN 3",
    "kernel": "DEMO THERMAL",
    "state": "PLANNED",
    "frames": null
  }
]);

export const RESULTS = freeze([
  {
    "name": "SPLAT, EARLIER SCAN",
    "from": "rec0",
    "kind": "SPLAT",
    "state": "DONE",
    "size": "310 MB"
  },
  {
    "name": "MAP, RUN 3",
    "from": "rec3",
    "kind": "SLAM MAP",
    "state": "DONE",
    "size": "84 MB"
  },
  {
    "name": "FINDS, RUN 3",
    "from": "rec3",
    "kind": "MODEL A",
    "state": "DONE",
    "size": "2 MB"
  },
  {
    "name": "SPLAT, RUN 3",
    "from": "rec3",
    "kind": "SPLAT",
    "state": "UNDER WAY",
    "size": "--"
  }
]);

export const RUNS = freeze([
  {
    "id": "r1",
    "name": "RUN 1",
    "flight": "f2",
    "origin": "sim",
    "where": "SYNTHETIC PREVIEW",
    "guard": "ON",
    "outcome": "COMPLETED",
    "time": "3:40",
    "stops": 2,
    "wentRound": "1 WAY, KEEPING 2 M",
    "leftOut": 2,
    "nearest_m": 3.1,
    "blind": "0 %",
    "when": "2026-11-23 16:10",
    "note": "INVENTED DEMO RUN; NOT A RECORDED RESULT"
  },
  {
    "id": "r2",
    "name": "RUN 2",
    "flight": "f2",
    "origin": "sim",
    "where": "SYNTHETIC PREVIEW",
    "guard": "OFF",
    "outcome": "STRUCK",
    "time": "1:20",
    "stops": 0,
    "wentRound": "NONE",
    "leftOut": 0,
    "nearest_m": 0.8,
    "blind": "0 %",
    "when": "2026-11-23 16:14",
    "note": "INVENTED DEMO RUN; NOT A RECORDED RESULT"
  },
  {
    "id": "r3",
    "name": "RUN 3",
    "flight": "f2",
    "origin": "sim",
    "where": "SYNTHETIC PREVIEW",
    "guard": "ON",
    "outcome": "COMPLETED",
    "time": "3:55",
    "stops": 2,
    "wentRound": "1 WAY, KEEPING 2 M",
    "leftOut": 2,
    "nearest_m": 2.9,
    "blind": "0 %",
    "when": "2026-11-24 10:05",
    "recording": "rec3",
    "note": "INVENTED DEMO RUN; NOT A RECORDED RESULT"
  },
  {
    "id": "r4",
    "name": "RUN 4",
    "flight": "f2",
    "origin": "dji-simulator",
    "where": "SYNTHETIC PREVIEW",
    "guard": "ON",
    "outcome": "PLANNED",
    "time": "--",
    "stops": 2,
    "wentRound": "--",
    "leftOut": 0,
    "nearest_m": null,
    "blind": "--",
    "when": "2026-11-24 16:00",
    "recording": null,
    "note": "INVENTED DEMO RUN; NOT A RECORDED RESULT"
  }
]);

export const SAMPLE_POLE = freeze({
  "x": -239.1,
  "y": 158.5,
  "side_m": 0.6,
  "height_m": 16
});

export const SCANS = freeze([
  {
    "id": "s0",
    "when": "2026-11-20",
    "run": null,
    "recording": "rec0",
    "origin": "sim",
    "seen": 0.84,
    "three": 0.78,
    "findings": 2,
    "registered": 0.88,
    "note": "EARLIER SCAN"
  },
  {
    "id": "s1",
    "when": "2026-11-23",
    "run": "r1",
    "recording": null,
    "origin": "sim",
    "seen": 0.88,
    "three": 0.83,
    "findings": 0,
    "registered": null,
    "note": "RUN IN THE PAGE: NO PICTURES"
  },
  {
    "id": "s3",
    "when": "2026-11-24",
    "run": "r3",
    "recording": "rec3",
    "origin": "sim",
    "seen": 0.86,
    "three": 0.81,
    "findings": 4,
    "registered": 0.91,
    "note": "WITH THE POLE"
  }
]);

export const SCENARIOS = freeze([
  {
    "name": "THE POLE ON THE WAY",
    "target": "BUILDING 260927791",
    "sensors": "SIM-DEPTH, SIM-COLOR",
    "state": "USED BY RUN 3"
  },
  {
    "name": "NO POLE",
    "target": "BUILDING 260927791",
    "sensors": "SIM-DEPTH",
    "state": "USED BY THE EARLIER SCAN"
  },
  {
    "name": "WIND 5 M/S",
    "target": "BUILDING 260927791",
    "sensors": "SIM-DEPTH, SIM-COLOR",
    "state": "PLANNED"
  }
]);

export const SENSORS_LIVE = freeze([
  {
    "name": "DEMO COLOR",
    "rate": "24 HZ",
    "live": true
  },
  {
    "name": "DEMO DEPTH",
    "rate": "24 HZ",
    "live": true
  },
  {
    "name": "DEMO MOTION",
    "rate": "100 HZ",
    "live": true
  },
  {
    "name": "DEMO THERMAL",
    "rate": "12 HZ",
    "live": true
  },
  {
    "name": "DEMO ZOOM",
    "rate": "24 HZ",
    "live": false
  }
]);

export const SIM_CAMERA = freeze({
  "name": "SYNTHETIC COLOR CAMERA",
  "size": "960X540",
  "rate": "24 HZ"
});

export const SITES_KEPT = freeze([
  {
    "name": "SF WATERFRONT",
    "targets": 4,
    "kept": "2026-11-24"
  },
  {
    "name": "TEST BOX (SYNTHETIC)",
    "targets": 1,
    "kept": "2026-11-23"
  }
]);

export const TELEMETRY = freeze({
  "device": "SIM ROBOT",
  "origin": "sim",
  "run": "r3",
  "at": "10:08:31",
  "live": false,
  "up_m": 14,
  "speed_mps": 2.1,
  "heading_deg": 315,
  "roll": 1,
  "pitch": -2,
  "battery_pct": 92,
  "volts": 22.4,
  "latitude": "37.79683 N",
  "longitude": "122.39631 W",
  "fix": 4,
  "satellites": 14,
  "control": "COMPUTER",
  "step": "STEP 23 OF 28",
  "lease": "free",
  "leaseAge": null
});

export const TRAINING = freeze([
  {
    "name": "DEMO MODEL 1",
    "data": "SYNTHETIC FRAMES",
    "score": 0.72,
    "state": "DONE"
  },
  {
    "name": "DEMO MODEL 2",
    "data": "SYNTHETIC FRAMES",
    "score": null,
    "state": "PLANNED"
  }
]);

export const VIEWS = freeze({
  "site": {
    "centre": {
      "x": -20,
      "y": -55
    },
    "across_m": 480
  },
  "small": {
    "centre": {
      "x": -230.7,
      "y": 147.6
    },
    "across_m": 40
  }
});

export const WATCHED = freeze({
  "run": "r4",
  "device": "flight-orin",
  "origin": "dji-simulator",
  "at": "01:22",
  "of": "04:50",
  "share": 0.28,
  "recorded": 0.4,
  "recording": "FLIGHT LOG",
  "latitude": "10.00000 N",
  "longitude": "10.00000 E",
  "up_m": 14,
  "speed_mps": 2.1,
  "heading_deg": 315,
  "roll": 1,
  "pitch": -2,
  "battery_pct": 92,
  "volts": 22.4,
  "fix": 4,
  "satellites": 14,
  "control": "COMPUTER",
  "lease": "held",
  "leaseAge": 0.2,
  "aircraftAt": 12,
  "pilot": "VIRTUAL INPUT"
});

export const SAMPLE = Object.freeze({
  site: SAMPLE_SITE, buildings: SAMPLE_BUILDINGS, assets: ASSETS, flights: FLIGHTS, runs: RUNS, recordings: RECORDINGS, findings: FINDINGS,
  cases: CASES, events: EVENTS, telemetry: TELEMETRY, watched: WATCHED, activity: ACTIVITY, scans: SCANS, models: MODELS, pipeline: PIPELINE, bench: BENCH, pole: SAMPLE_POLE,
  places: PLACES, sitesKept: SITES_KEPT, views: VIEWS, planSettings: PLAN_SETTINGS, guardSensors: GUARD_SENSORS, faults: FAULTS, ready: READY,
  sensorsLive: SENSORS_LIVE, changes: CHANGES, notes: NOTES, deploys: DEPLOYS, results: RESULTS, scenarios: SCENARIOS, renders: RENDERS,
  training: TRAINING, assistant: ASSISTANT, playheads: PLAYHEADS, now: NOW, limits: LIMITS, simCamera: SIM_CAMERA,
  timeZone: 'SITE TIME, UTC-08', today: '2026-11-24',
});

export const assetById = id => ASSETS.find(entry => entry.id === id) || null;
export const flightById = id => FLIGHTS.find(entry => entry.id === id) || null;
export const runById = id => RUNS.find(entry => entry.id === id) || null;
export const caseById = id => CASES.find(entry => entry.id === id) || null;
export const findingById = id => FINDINGS.find(entry => entry.id === id) || null;
export const recordingById = id => RECORDINGS.find(entry => entry.id === id) || null;
