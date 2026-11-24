// Public visual flow example: page geometry and navigation are preserved.
// Bindings describe synthetic fixtures, not a private application architecture.
export const STEPS = [
  {
    "n": 1,
    "name": "SITE",
    "page": "site-find"
  },
  {
    "n": 2,
    "name": "PREVIEW",
    "page": "site-preview"
  },
  {
    "n": 3,
    "name": "SIMULATE",
    "page": "site-simulate"
  },
  {
    "n": 4,
    "name": "RUN",
    "page": "site-run"
  },
  {
    "n": 5,
    "name": "REVIEW",
    "page": "site-review"
  },
  {
    "n": 6,
    "name": "COMPARE",
    "page": "site-compare"
  }
];

export const OUTLINE = [
  {
    "id": "home",
    "label": "Home",
    "panels": [
      {
        "id": "home-map",
        "label": "sites and devices",
        "box": [
          0,
          0,
          50,
          40
        ],
        "link": null,
        "map": {
          "el": "siteMap",
          "adapter": "domain",
          "feed": "SYNTHETIC SITES AND DEVICES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-mine",
        "label": "my assigned work",
        "box": [
          51,
          0,
          26,
          20
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC MY ASSIGNED WORK DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-attention",
        "label": "needs attention",
        "box": [
          78,
          0,
          26,
          20
        ],
        "link": null,
        "map": {
          "el": "alert",
          "adapter": "domain",
          "feed": "SYNTHETIC NEEDS ATTENTION DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-today",
        "label": "today",
        "box": [
          51,
          21,
          53,
          19
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC TODAY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-flights",
        "label": "flights under way",
        "box": [
          0,
          41,
          34,
          16
        ],
        "link": null,
        "map": {
          "el": "runPanel",
          "adapter": "telemetry",
          "feed": "SYNTHETIC FLIGHTS UNDER WAY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-cases",
        "label": "cases to decide",
        "box": [
          35,
          41,
          34,
          16
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC CASES TO DECIDE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-activity",
        "label": "activity",
        "box": [
          70,
          41,
          34,
          16
        ],
        "link": null,
        "map": {
          "el": "textline",
          "adapter": "domain",
          "feed": "SYNTHETIC ACTIVITY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-notes",
        "label": "notes",
        "box": [
          0,
          58,
          34,
          12
        ],
        "link": null,
        "map": {
          "el": "label",
          "adapter": "domain",
          "feed": "SYNTHETIC NOTES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-system",
        "label": "system state",
        "box": [
          35,
          58,
          69,
          12
        ],
        "link": null,
        "map": {
          "el": "badge",
          "adapter": "none",
          "feed": "SYNTHETIC SYSTEM STATE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-go-bench",
        "label": "open bench",
        "box": [
          0,
          71,
          16,
          4
        ],
        "link": "bench",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN BENCH DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-go-files",
        "label": "open files",
        "box": [
          17,
          71,
          16,
          4
        ],
        "link": "files",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN FILES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-go-pipeline",
        "label": "open pipeline editor",
        "box": [
          34,
          71,
          18,
          4
        ],
        "link": "pipeline",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN PIPELINE EDITOR DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-go-assistant",
        "label": "open assistant",
        "box": [
          53,
          71,
          16,
          4
        ],
        "link": "assistant",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN ASSISTANT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-go-simkit",
        "label": "open sim kit and training",
        "box": [
          70,
          71,
          18,
          4
        ],
        "link": "simkit",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN SIM KIT AND TRAINING DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "home-go-settings",
        "label": "open settings",
        "box": [
          89,
          71,
          15,
          4
        ],
        "link": "settings",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN SETTINGS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "site",
    "label": "Site",
    "panels": [
      {
        "id": "rect-98d1c6fa-2fac-4a0c-ac47-2ba2518fed0b",
        "label": "site map: assets highlighted",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "siteMap",
          "adapter": "domain",
          "feed": "SYNTHETIC SITE MAP: ASSETS HIGHLIGHTED DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-9812aae0-d3d3-4119-8d29-3c7f702b2a3e",
        "label": "data panel",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC DATA PANEL DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-43b09773-8b70-4533-8aa1-2374cdeadb0c",
        "label": "telemetry",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "telemetry",
          "feed": "SYNTHETIC TELEMETRY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-efd05934-c0f8-4d7b-834c-e3080a16ee70",
        "label": "coordinates",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "position",
          "adapter": "telemetry",
          "feed": "SYNTHETIC COORDINATES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-6434f479-1e03-42d1-8295-cac9d610d42d",
        "label": "compass",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "heading",
          "adapter": "telemetry",
          "feed": "SYNTHETIC COMPASS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-b0df0b4b-177f-4a97-8d12-abae3794b1f3",
        "label": "mode",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "badge",
          "adapter": "telemetry",
          "feed": "SYNTHETIC MODE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-742e5a5f-fb43-48a8-add4-5b7052b02c9d",
        "label": "asset details",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "label",
          "adapter": "domain",
          "feed": "SYNTHETIC ASSET DETAILS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-01c5c173-30e1-46ba-8888-f5848545adaa",
        "label": "pending",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC PENDING DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-b104bb82-1619-4298-98e9-350b260addc7",
        "label": "recent",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC RECENT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-2cbe0f05-9a17-4ca3-92e9-d199d7792bac",
        "label": "notes",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "label",
          "adapter": "domain",
          "feed": "SYNTHETIC NOTES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-f20a007b-e3da-408f-a25d-4fa443cbf303",
        "label": "details",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "target",
          "adapter": "domain",
          "feed": "SYNTHETIC DETAILS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-chain-return",
        "label": "return",
        "box": [
          0,
          85,
          8,
          4
        ],
        "link": "home",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC RETURN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-chain-1",
        "label": "step 1: site",
        "box": [
          9,
          85,
          8,
          4
        ],
        "link": "site-find",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 1: SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-chain-2",
        "label": "step 2: preview",
        "box": [
          18,
          85,
          8,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 2: PREVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-chain-3",
        "label": "step 3: simulate",
        "box": [
          27,
          85,
          8,
          4
        ],
        "link": "site-simulate",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 3: SIMULATE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-chain-4",
        "label": "step 4: run",
        "box": [
          36,
          85,
          8,
          4
        ],
        "link": "site-run",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 4: RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-chain-5",
        "label": "step 5: review",
        "box": [
          45,
          85,
          8,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 5: REVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-chain-6",
        "label": "step 6: compare",
        "box": [
          54,
          85,
          8,
          4
        ],
        "link": "site-compare",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 6: COMPARE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-chain-next",
        "label": "next",
        "box": [
          65,
          85,
          8,
          4
        ],
        "link": "site-find",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC NEXT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-go-find",
        "label": "find a site",
        "box": [
          0,
          90,
          20,
          3
        ],
        "link": "site-find",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC FIND A SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "site-find",
    "label": "Site: find a place",
    "hidden": true,
    "panels": [
      {
        "id": "site-find-search",
        "label": "find a place",
        "box": [
          0,
          0,
          26,
          8
        ],
        "link": null,
        "map": {
          "el": "field",
          "adapter": "domain",
          "feed": "SYNTHETIC FIND A PLACE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-places",
        "label": "places found",
        "box": [
          0,
          9,
          26,
          20
        ],
        "link": null,
        "map": {
          "el": "place",
          "adapter": "domain",
          "feed": "SYNTHETIC PLACES FOUND DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-kept",
        "label": "sites kept",
        "box": [
          0,
          30,
          26,
          24
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC SITES KEPT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-keep",
        "label": "keep the site",
        "box": [
          0,
          55,
          26,
          4
        ],
        "link": null,
        "map": {
          "el": "button",
          "adapter": "domain",
          "feed": "SYNTHETIC KEEP THE SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-map",
        "label": "site map",
        "box": [
          27,
          0,
          50,
          78
        ],
        "link": null,
        "map": {
          "el": "siteMap",
          "adapter": "domain",
          "feed": "SYNTHETIC SITE MAP DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-picked",
        "label": "picked building",
        "box": [
          78,
          0,
          26,
          22
        ],
        "link": null,
        "map": {
          "el": "target",
          "adapter": "domain",
          "feed": "SYNTHETIC PICKED BUILDING DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-roof",
        "label": "roof by hand",
        "box": [
          78,
          23,
          26,
          8
        ],
        "link": null,
        "map": {
          "el": "stepper",
          "adapter": "domain",
          "feed": "SYNTHETIC ROOF BY HAND DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-outline",
        "label": "edit the outline",
        "box": [
          78,
          32,
          26,
          10
        ],
        "link": null,
        "map": {
          "el": "button",
          "adapter": "domain",
          "feed": "SYNTHETIC EDIT THE OUTLINE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-source",
        "label": "where it came from",
        "box": [
          78,
          43,
          26,
          8
        ],
        "link": null,
        "map": {
          "el": "provenance",
          "adapter": "domain",
          "feed": "SYNTHETIC WHERE IT CAME FROM DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-holds",
        "label": "what this site holds",
        "box": [
          27,
          80,
          50,
          5
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC WHAT THIS SITE HOLDS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-chain-return",
        "label": "return",
        "box": [
          0,
          87,
          10,
          4
        ],
        "link": "site",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC RETURN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-chain-1",
        "label": "step 1: site",
        "box": [
          11,
          87,
          12,
          4
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 1: SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-chain-2",
        "label": "step 2: preview",
        "box": [
          24,
          87,
          12,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 2: PREVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-chain-3",
        "label": "step 3: simulate",
        "box": [
          37,
          87,
          12,
          4
        ],
        "link": "site-simulate",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 3: SIMULATE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-chain-4",
        "label": "step 4: run",
        "box": [
          50,
          87,
          12,
          4
        ],
        "link": "site-run",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 4: RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-chain-5",
        "label": "step 5: review",
        "box": [
          63,
          87,
          12,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 5: REVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-chain-6",
        "label": "step 6: compare",
        "box": [
          76,
          87,
          12,
          4
        ],
        "link": "site-compare",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 6: COMPARE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-find-chain-next",
        "label": "next",
        "box": [
          94,
          87,
          10,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC NEXT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "site-preview",
    "label": "Site: preview",
    "hidden": true,
    "panels": [
      {
        "id": "site-preview-flights",
        "label": "flights at this site",
        "box": [
          0,
          0,
          26,
          12
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC FLIGHTS AT THIS SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-covers",
        "label": "this flight covers",
        "box": [
          0,
          13,
          26,
          10
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC THIS FLIGHT COVERS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-generator",
        "label": "generator",
        "box": [
          0,
          24,
          26,
          7
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "domain",
          "feed": "SYNTHETIC GENERATOR DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-settings",
        "label": "settings",
        "box": [
          0,
          32,
          26,
          16
        ],
        "link": null,
        "map": {
          "el": "slider",
          "adapter": "domain",
          "feed": "SYNTHETIC SETTINGS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-home",
        "label": "home",
        "box": [
          0,
          49,
          26,
          7
        ],
        "link": null,
        "map": {
          "el": "toggle",
          "adapter": "domain",
          "feed": "SYNTHETIC HOME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-make",
        "label": "make the plan",
        "box": [
          0,
          57,
          26,
          4
        ],
        "link": null,
        "map": {
          "el": "button",
          "adapter": "domain",
          "feed": "SYNTHETIC MAKE THE PLAN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-scene",
        "label": "the plan from above",
        "box": [
          27,
          0,
          50,
          78
        ],
        "link": null,
        "map": {
          "el": "planMap",
          "adapter": "domain",
          "feed": "SYNTHETIC THE PLAN FROM ABOVE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-checks",
        "label": "checks",
        "box": [
          78,
          0,
          26,
          12
        ],
        "link": null,
        "map": {
          "el": "check",
          "adapter": "domain",
          "feed": "SYNTHETIC CHECKS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-reach",
        "label": "how far it reaches",
        "box": [
          78,
          13,
          26,
          16
        ],
        "link": null,
        "map": {
          "el": "fence",
          "adapter": "domain",
          "feed": "SYNTHETIC HOW FAR IT REACHES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-coverage",
        "label": "coverage by target",
        "box": [
          78,
          30,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "coverage",
          "adapter": "domain",
          "feed": "SYNTHETIC COVERAGE BY TARGET DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-expected",
        "label": "slam and splat expected",
        "box": [
          78,
          45,
          26,
          8
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC SLAM AND SPLAT EXPECTED DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-missions",
        "label": "missions",
        "box": [
          78,
          54,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "mission",
          "adapter": "domain",
          "feed": "SYNTHETIC MISSIONS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-profile",
        "label": "height along the path",
        "box": [
          27,
          80,
          50,
          5
        ],
        "link": null,
        "map": {
          "el": "saas-viz:line",
          "adapter": "domain",
          "feed": "SYNTHETIC HEIGHT ALONG THE PATH DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-chain-return",
        "label": "return",
        "box": [
          0,
          87,
          10,
          4
        ],
        "link": "site-find",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC RETURN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-chain-1",
        "label": "step 1: site",
        "box": [
          11,
          87,
          12,
          4
        ],
        "link": "site-find",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 1: SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-chain-2",
        "label": "step 2: preview",
        "box": [
          24,
          87,
          12,
          4
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 2: PREVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-chain-3",
        "label": "step 3: simulate",
        "box": [
          37,
          87,
          12,
          4
        ],
        "link": "site-simulate",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 3: SIMULATE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-chain-4",
        "label": "step 4: run",
        "box": [
          50,
          87,
          12,
          4
        ],
        "link": "site-run",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 4: RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-chain-5",
        "label": "step 5: review",
        "box": [
          63,
          87,
          12,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 5: REVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-chain-6",
        "label": "step 6: compare",
        "box": [
          76,
          87,
          12,
          4
        ],
        "link": "site-compare",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 6: COMPARE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-preview-chain-next",
        "label": "next",
        "box": [
          94,
          87,
          10,
          4
        ],
        "link": "site-simulate",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC NEXT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "site-simulate",
    "label": "Site: simulate / edit",
    "hidden": true,
    "panels": [
      {
        "id": "site-simulate-on",
        "label": "simulate on",
        "box": [
          0,
          0,
          26,
          5
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "domain",
          "feed": "SYNTHETIC SIMULATE ON DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-guard",
        "label": "the guard",
        "box": [
          0,
          6,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "toggle",
          "adapter": "domain",
          "feed": "SYNTHETIC THE GUARD DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-waypoint",
        "label": "waypoint",
        "box": [
          0,
          21,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "waypoint",
          "adapter": "domain",
          "feed": "SYNTHETIC WAYPOINT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-runs",
        "label": "runs so far",
        "box": [
          0,
          36,
          26,
          18
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC RUNS SO FAR DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-go",
        "label": "run the simulation",
        "box": [
          0,
          55,
          26,
          4
        ],
        "link": null,
        "map": {
          "el": "button",
          "adapter": "domain",
          "feed": "SYNTHETIC RUN THE SIMULATION DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-scene",
        "label": "the simulated scene",
        "box": [
          27,
          0,
          50,
          60
        ],
        "link": null,
        "map": {
          "el": "planMap",
          "adapter": "domain",
          "feed": "SYNTHETIC THE SIMULATED SCENE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-camera",
        "label": "simulated camera",
        "box": [
          27,
          61,
          50,
          17
        ],
        "link": null,
        "map": {
          "el": "picture",
          "adapter": "telemetry",
          "feed": "SYNTHETIC SIMULATED CAMERA DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-sensors",
        "label": "sensors on board",
        "box": [
          78,
          0,
          26,
          20
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "none",
          "feed": "SYNTHETIC SENSORS ON BOARD DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-left",
        "label": "where it left the plan",
        "box": [
          78,
          21,
          26,
          18
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC WHERE IT LEFT THE PLAN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-faults",
        "label": "wind and faults",
        "box": [
          78,
          40,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "toggle",
          "adapter": "domain",
          "feed": "SYNTHETIC WIND AND FAULTS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-run",
        "label": "the run",
        "box": [
          27,
          80,
          50,
          5
        ],
        "link": null,
        "map": {
          "el": "transport",
          "adapter": "domain",
          "feed": "SYNTHETIC THE RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-chain-return",
        "label": "return",
        "box": [
          0,
          87,
          10,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC RETURN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-chain-1",
        "label": "step 1: site",
        "box": [
          11,
          87,
          12,
          4
        ],
        "link": "site-find",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 1: SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-chain-2",
        "label": "step 2: preview",
        "box": [
          24,
          87,
          12,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 2: PREVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-chain-3",
        "label": "step 3: simulate",
        "box": [
          37,
          87,
          12,
          4
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 3: SIMULATE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-chain-4",
        "label": "step 4: run",
        "box": [
          50,
          87,
          12,
          4
        ],
        "link": "site-run",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 4: RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-chain-5",
        "label": "step 5: review",
        "box": [
          63,
          87,
          12,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 5: REVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-chain-6",
        "label": "step 6: compare",
        "box": [
          76,
          87,
          12,
          4
        ],
        "link": "site-compare",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 6: COMPARE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-simulate-chain-next",
        "label": "next",
        "box": [
          94,
          87,
          10,
          4
        ],
        "link": "site-run",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC NEXT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "site-run",
    "label": "Site: run",
    "hidden": true,
    "panels": [
      {
        "id": "site-run-on",
        "label": "fly on",
        "box": [
          0,
          0,
          26,
          5
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "commands",
          "feed": "SYNTHETIC FLY ON DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-gates",
        "label": "before it flies",
        "box": [
          0,
          6,
          26,
          20
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "domain",
          "feed": "SYNTHETIC BEFORE IT FLIES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-ready",
        "label": "ready?",
        "box": [
          0,
          27,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "badge",
          "adapter": "telemetry",
          "feed": "SYNTHETIC READY? DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-controls",
        "label": "start, pause, return, stop",
        "box": [
          0,
          42,
          26,
          10
        ],
        "link": null,
        "map": {
          "el": "button",
          "adapter": "commands",
          "feed": "SYNTHETIC START, PAUSE, RETURN, STOP DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-sim",
        "label": "simulator view",
        "box": [
          27,
          0,
          50,
          40
        ],
        "link": null,
        "map": {
          "el": "planMap",
          "adapter": "telemetry",
          "feed": "SYNTHETIC SIMULATOR VIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-live",
        "label": "live view with telemetry",
        "box": [
          27,
          41,
          50,
          37
        ],
        "link": null,
        "map": {
          "el": "flightCluster",
          "adapter": "telemetry",
          "feed": "SYNTHETIC LIVE VIEW WITH TELEMETRY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-control",
        "label": "who holds control",
        "box": [
          78,
          0,
          26,
          12
        ],
        "link": null,
        "map": {
          "el": "lease",
          "adapter": "session",
          "feed": "SYNTHETIC WHO HOLDS CONTROL DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-recording",
        "label": "recording",
        "box": [
          78,
          13,
          26,
          10
        ],
        "link": null,
        "map": {
          "el": "progress",
          "adapter": "commands",
          "feed": "SYNTHETIC RECORDING DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-sensors",
        "label": "sensors live",
        "box": [
          78,
          24,
          26,
          18
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "telemetry",
          "feed": "SYNTHETIC SENSORS LIVE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-layers",
        "label": "on the view",
        "box": [
          78,
          43,
          26,
          10
        ],
        "link": null,
        "map": {
          "el": "toggle",
          "adapter": "none",
          "feed": "SYNTHETIC ON THE VIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-go-bench",
        "label": "open bench",
        "box": [
          78,
          54,
          26,
          4
        ],
        "link": "bench",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN BENCH DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-run",
        "label": "the run",
        "box": [
          27,
          80,
          50,
          5
        ],
        "link": null,
        "map": {
          "el": "transport",
          "adapter": "telemetry",
          "feed": "SYNTHETIC THE RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-chain-return",
        "label": "return",
        "box": [
          0,
          87,
          10,
          4
        ],
        "link": "site-simulate",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC RETURN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-chain-1",
        "label": "step 1: site",
        "box": [
          11,
          87,
          12,
          4
        ],
        "link": "site-find",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 1: SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-chain-2",
        "label": "step 2: preview",
        "box": [
          24,
          87,
          12,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 2: PREVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-chain-3",
        "label": "step 3: simulate",
        "box": [
          37,
          87,
          12,
          4
        ],
        "link": "site-simulate",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 3: SIMULATE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-chain-4",
        "label": "step 4: run",
        "box": [
          50,
          87,
          12,
          4
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 4: RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-chain-5",
        "label": "step 5: review",
        "box": [
          63,
          87,
          12,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 5: REVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-chain-6",
        "label": "step 6: compare",
        "box": [
          76,
          87,
          12,
          4
        ],
        "link": "site-compare",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 6: COMPARE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-run-chain-next",
        "label": "next",
        "box": [
          94,
          87,
          10,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC NEXT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "site-review",
    "label": "Site: review",
    "hidden": true,
    "panels": [
      {
        "id": "site-review-recordings",
        "label": "recordings of this flight",
        "box": [
          0,
          0,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC RECORDINGS OF THIS FLIGHT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-show",
        "label": "show",
        "box": [
          0,
          15,
          26,
          10
        ],
        "link": null,
        "map": {
          "el": "toggle",
          "adapter": "none",
          "feed": "SYNTHETIC SHOW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-topics",
        "label": "topics",
        "box": [
          0,
          26,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC TOPICS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-pipeline",
        "label": "pipeline",
        "box": [
          0,
          41,
          26,
          10
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "domain",
          "feed": "SYNTHETIC PIPELINE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-go-pipeline",
        "label": "open pipeline editor",
        "box": [
          0,
          52,
          26,
          4
        ],
        "link": "pipeline",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN PIPELINE EDITOR DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-scene",
        "label": "the result",
        "box": [
          27,
          0,
          50,
          78
        ],
        "link": null,
        "map": {
          "el": "siteMap",
          "adapter": "domain",
          "feed": "SYNTHETIC THE RESULT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-picked",
        "label": "picked",
        "box": [
          78,
          0,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC PICKED DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-measured",
        "label": "this run, measured",
        "box": [
          78,
          15,
          26,
          14
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC THIS RUN, MEASURED DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-jobs",
        "label": "jobs",
        "box": [
          78,
          30,
          26,
          12
        ],
        "link": null,
        "map": {
          "el": "progress",
          "adapter": "domain",
          "feed": "SYNTHETIC JOBS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-export",
        "label": "export to the rtx 2080",
        "box": [
          78,
          43,
          26,
          4
        ],
        "link": null,
        "map": {
          "el": "button",
          "adapter": "domain",
          "feed": "SYNTHETIC EXPORT TO THE RTX 2080 DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-go-compare",
        "label": "compare it",
        "box": [
          78,
          48,
          26,
          4
        ],
        "link": "site-compare",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC COMPARE IT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-recording",
        "label": "the recording",
        "box": [
          27,
          80,
          50,
          5
        ],
        "link": null,
        "map": {
          "el": "transport",
          "adapter": "domain",
          "feed": "SYNTHETIC THE RECORDING DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-chain-return",
        "label": "return",
        "box": [
          0,
          87,
          10,
          4
        ],
        "link": "site-run",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC RETURN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-chain-1",
        "label": "step 1: site",
        "box": [
          11,
          87,
          12,
          4
        ],
        "link": "site-find",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 1: SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-chain-2",
        "label": "step 2: preview",
        "box": [
          24,
          87,
          12,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 2: PREVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-chain-3",
        "label": "step 3: simulate",
        "box": [
          37,
          87,
          12,
          4
        ],
        "link": "site-simulate",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 3: SIMULATE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-chain-4",
        "label": "step 4: run",
        "box": [
          50,
          87,
          12,
          4
        ],
        "link": "site-run",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 4: RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-chain-5",
        "label": "step 5: review",
        "box": [
          63,
          87,
          12,
          4
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 5: REVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-chain-6",
        "label": "step 6: compare",
        "box": [
          76,
          87,
          12,
          4
        ],
        "link": "site-compare",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 6: COMPARE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-review-chain-next",
        "label": "next",
        "box": [
          94,
          87,
          10,
          4
        ],
        "link": "site-compare",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC NEXT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "site-compare",
    "label": "Site: compare",
    "hidden": true,
    "panels": [
      {
        "id": "site-compare-target",
        "label": "which target",
        "box": [
          0,
          0,
          26,
          8
        ],
        "link": null,
        "map": {
          "el": "select",
          "adapter": "domain",
          "feed": "SYNTHETIC WHICH TARGET DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-scans",
        "label": "scans of this area",
        "box": [
          0,
          9,
          26,
          16
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC SCANS OF THIS AREA DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-pair",
        "label": "compare",
        "box": [
          0,
          26,
          26,
          8
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "none",
          "feed": "SYNTHETIC COMPARE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-mode",
        "label": "show",
        "box": [
          0,
          35,
          26,
          8
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "none",
          "feed": "SYNTHETIC SHOW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-scene",
        "label": "two scans",
        "box": [
          27,
          0,
          50,
          78
        ],
        "link": null,
        "map": {
          "el": "siteMap",
          "adapter": "domain",
          "feed": "SYNTHETIC TWO SCANS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-changed",
        "label": "what changed",
        "box": [
          78,
          0,
          26,
          16
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC WHAT CHANGED DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-numbers",
        "label": "expected, simulated, flown",
        "box": [
          78,
          17,
          26,
          16
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC EXPECTED, SIMULATED, FLOWN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-go-preview",
        "label": "back to preview",
        "box": [
          78,
          34,
          26,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC BACK TO PREVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-over-time",
        "label": "scans over time",
        "box": [
          27,
          80,
          50,
          5
        ],
        "link": null,
        "map": {
          "el": "saas-viz:sparkline",
          "adapter": "domain",
          "feed": "SYNTHETIC SCANS OVER TIME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-chain-return",
        "label": "return",
        "box": [
          0,
          87,
          10,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC RETURN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-chain-1",
        "label": "step 1: site",
        "box": [
          11,
          87,
          12,
          4
        ],
        "link": "site-find",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 1: SITE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-chain-2",
        "label": "step 2: preview",
        "box": [
          24,
          87,
          12,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 2: PREVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-chain-3",
        "label": "step 3: simulate",
        "box": [
          37,
          87,
          12,
          4
        ],
        "link": "site-simulate",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 3: SIMULATE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-chain-4",
        "label": "step 4: run",
        "box": [
          50,
          87,
          12,
          4
        ],
        "link": "site-run",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 4: RUN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-chain-5",
        "label": "step 5: review",
        "box": [
          63,
          87,
          12,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 5: REVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-chain-6",
        "label": "step 6: compare",
        "box": [
          76,
          87,
          12,
          4
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC STEP 6: COMPARE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "site-compare-chain-next",
        "label": "next",
        "box": [
          94,
          87,
          10,
          4
        ],
        "link": "site",
        "map": {
          "el": "steps",
          "adapter": "router",
          "feed": "SYNTHETIC NEXT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "system",
    "label": "System",
    "panels": [
      {
        "id": "system-view-devices",
        "label": "view: devices",
        "box": [
          0,
          0,
          18,
          4
        ],
        "link": null,
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: DEVICES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-view-modules",
        "label": "view: modules",
        "box": [
          19,
          0,
          18,
          4
        ],
        "link": "system-modules",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: MODULES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-view-chains",
        "label": "view: chains",
        "box": [
          38,
          0,
          18,
          4
        ],
        "link": "system-chains",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: CHAINS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-view-activity",
        "label": "view: activity",
        "box": [
          57,
          0,
          19,
          4
        ],
        "link": "system-activity",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: ACTIVITY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-topology",
        "label": "topology",
        "box": [
          0,
          5,
          77,
          88
        ],
        "link": null,
        "map": {
          "el": "diagram:topology",
          "adapter": "domain",
          "feed": "SYNTHETIC TOPOLOGY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-49bbd53e-dd8e-452a-99f3-39e6b0450d4b",
        "label": "device details",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "badge",
          "adapter": "domain",
          "feed": "SYNTHETIC DEVICE DETAILS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-b0d147a5-3220-4fd8-9403-88aeea6c9edb",
        "label": "device info",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC DEVICE INFO DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-9e995e00-361f-4d27-9488-e200ca01652c",
        "label": "location",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC LOCATION DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-b80df292-0200-46b4-a39f-199ff87243c4",
        "label": "installed modules",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC INSTALLED MODULES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-d531925b-2bf3-45d2-9c20-907f17a462f1",
        "label": "sensor types",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC SENSOR TYPES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-0b4f1c97-9099-4daf-a626-d60d6d15eb71",
        "label": "device management",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "lease",
          "adapter": "session",
          "feed": "SYNTHETIC DEVICE MANAGEMENT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-links",
        "label": "links",
        "box": [
          0,
          94,
          38,
          26
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "none",
          "feed": "SYNTHETIC LINKS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-command-path",
        "label": "command path",
        "box": [
          39,
          94,
          38,
          26
        ],
        "link": null,
        "map": {
          "el": "diagram:command-path",
          "adapter": "none",
          "feed": "SYNTHETIC COMMAND PATH DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-deploy",
        "label": "deploy",
        "box": [
          0,
          121,
          38,
          16
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC DEPLOY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-telemetry",
        "label": "telemetry of the picked device",
        "box": [
          39,
          121,
          38,
          16
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "telemetry",
          "feed": "SYNTHETIC TELEMETRY OF THE PICKED DEVICE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-go-device",
        "label": "open the device page",
        "box": [
          77,
          94,
          27,
          4
        ],
        "link": "system-device",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC OPEN THE DEVICE PAGE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "system-modules",
    "label": "System: modules",
    "hidden": true,
    "panels": [
      {
        "id": "system-modules-view-devices",
        "label": "view: devices",
        "box": [
          0,
          0,
          18,
          4
        ],
        "link": "system",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: DEVICES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-modules-view-modules",
        "label": "view: modules",
        "box": [
          19,
          0,
          18,
          4
        ],
        "link": null,
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: MODULES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-modules-view-chains",
        "label": "view: chains",
        "box": [
          38,
          0,
          18,
          4
        ],
        "link": "system-chains",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: CHAINS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-modules-view-activity",
        "label": "view: activity",
        "box": [
          57,
          0,
          19,
          4
        ],
        "link": "system-activity",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: ACTIVITY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-modules-list",
        "label": "modules",
        "box": [
          0,
          5,
          60,
          60
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC MODULES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-modules-picked",
        "label": "the picked module",
        "box": [
          61,
          5,
          43,
          40
        ],
        "link": null,
        "map": {
          "el": "moduleTile",
          "adapter": "domain",
          "feed": "SYNTHETIC THE PICKED MODULE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-modules-apps",
        "label": "module apps in the shell",
        "box": [
          61,
          46,
          43,
          19
        ],
        "link": null,
        "map": {
          "el": "alert",
          "adapter": "none",
          "feed": "SYNTHETIC MODULE APPS IN THE SHELL DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-modules-interfaces",
        "label": "interfaces",
        "box": [
          0,
          66,
          104,
          24
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "none",
          "feed": "SYNTHETIC INTERFACES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "system-chains",
    "label": "System: chains",
    "hidden": true,
    "panels": [
      {
        "id": "system-chains-view-devices",
        "label": "view: devices",
        "box": [
          0,
          0,
          18,
          4
        ],
        "link": "system",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: DEVICES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-chains-view-modules",
        "label": "view: modules",
        "box": [
          19,
          0,
          18,
          4
        ],
        "link": "system-modules",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: MODULES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-chains-view-chains",
        "label": "view: chains",
        "box": [
          38,
          0,
          18,
          4
        ],
        "link": null,
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: CHAINS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-chains-view-activity",
        "label": "view: activity",
        "box": [
          57,
          0,
          19,
          4
        ],
        "link": "system-activity",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: ACTIVITY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-chains-diagram",
        "label": "chains",
        "box": [
          0,
          5,
          104,
          60
        ],
        "link": null,
        "map": {
          "el": "diagram:chains",
          "adapter": "domain",
          "feed": "SYNTHETIC CHAINS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-chains-picked",
        "label": "the picked step of a chain",
        "box": [
          0,
          66,
          104,
          16
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC THE PICKED STEP OF A CHAIN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "system-activity",
    "label": "System: activity",
    "hidden": true,
    "panels": [
      {
        "id": "system-activity-view-devices",
        "label": "view: devices",
        "box": [
          0,
          0,
          18,
          4
        ],
        "link": "system",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: DEVICES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-activity-view-modules",
        "label": "view: modules",
        "box": [
          19,
          0,
          18,
          4
        ],
        "link": "system-modules",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: MODULES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-activity-view-chains",
        "label": "view: chains",
        "box": [
          38,
          0,
          18,
          4
        ],
        "link": "system-chains",
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: CHAINS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-activity-view-activity",
        "label": "view: activity",
        "box": [
          57,
          0,
          19,
          4
        ],
        "link": null,
        "map": {
          "el": "tabs",
          "adapter": "router",
          "feed": "SYNTHETIC VIEW: ACTIVITY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-activity-log",
        "label": "command log",
        "box": [
          0,
          5,
          64,
          60
        ],
        "link": null,
        "map": {
          "el": "textline",
          "adapter": "domain",
          "feed": "SYNTHETIC COMMAND LOG DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-activity-leases",
        "label": "leases",
        "box": [
          65,
          5,
          39,
          30
        ],
        "link": null,
        "map": {
          "el": "lease",
          "adapter": "session",
          "feed": "SYNTHETIC LEASES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-activity-deploys",
        "label": "deploys",
        "box": [
          65,
          36,
          39,
          29
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC DEPLOYS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "system-device",
    "label": "Device",
    "hidden": true,
    "panels": [
      {
        "id": "system-device-card",
        "label": "device",
        "box": [
          0,
          0,
          40,
          40
        ],
        "link": null,
        "map": {
          "el": "deviceCard",
          "adapter": "domain",
          "feed": "SYNTHETIC DEVICE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-device-ports",
        "label": "ports",
        "box": [
          41,
          0,
          30,
          20
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC PORTS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-device-sensors",
        "label": "sensors",
        "box": [
          41,
          21,
          30,
          19
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC SENSORS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-device-driver",
        "label": "driver",
        "box": [
          72,
          0,
          32,
          10
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC DRIVER DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-device-static",
        "label": "static pods",
        "box": [
          72,
          11,
          32,
          14
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC STATIC PODS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-device-logs",
        "label": "logs",
        "box": [
          0,
          41,
          104,
          24
        ],
        "link": null,
        "map": {
          "el": "textline",
          "adapter": "domain",
          "feed": "SYNTHETIC LOGS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "system-device-back",
        "label": "back to system",
        "box": [
          0,
          66,
          20,
          4
        ],
        "link": "system",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC BACK TO SYSTEM DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "assets",
    "label": "Assets",
    "panels": [
      {
        "id": "assets-filter",
        "label": "planes, tanks, sites",
        "box": [
          0,
          0,
          40,
          4
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "none",
          "feed": "SYNTHETIC PLANES, TANKS, SITES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assets-list",
        "label": "asset list",
        "box": [
          0,
          5,
          40,
          50
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC ASSET LIST DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assets-model",
        "label": "the asset model",
        "box": [
          41,
          0,
          40,
          55
        ],
        "link": null,
        "map": {
          "el": "siteMap",
          "adapter": "domain",
          "feed": "SYNTHETIC THE ASSET MODEL DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assets-record",
        "label": "asset record",
        "box": [
          82,
          0,
          22,
          30
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC ASSET RECORD DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assets-scans",
        "label": "scans over time",
        "box": [
          41,
          56,
          40,
          16
        ],
        "link": null,
        "map": {
          "el": "saas-viz:bar",
          "adapter": "domain",
          "feed": "SYNTHETIC SCANS OVER TIME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assets-cases",
        "label": "open cases",
        "box": [
          82,
          31,
          22,
          16
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC OPEN CASES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assets-go-plan",
        "label": "plan an inspection",
        "box": [
          82,
          48,
          22,
          4
        ],
        "link": "site-preview",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC PLAN AN INSPECTION DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assets-regime",
        "label": "regime",
        "box": [
          82,
          53,
          22,
          10
        ],
        "link": null,
        "map": {
          "el": "alert",
          "adapter": "domain",
          "feed": "SYNTHETIC REGIME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assets-identity",
        "label": "identity and frame",
        "box": [
          0,
          56,
          40,
          16
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC IDENTITY AND FRAME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "cases",
    "label": "Cases",
    "panels": [
      {
        "id": "cases-filter",
        "label": "filters",
        "box": [
          0,
          0,
          30,
          5
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "none",
          "feed": "SYNTHETIC FILTERS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-queue",
        "label": "case queue",
        "box": [
          0,
          6,
          30,
          40
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC CASE QUEUE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-findings",
        "label": "findings",
        "box": [
          0,
          47,
          30,
          20
        ],
        "link": null,
        "map": {
          "el": "check",
          "adapter": "domain",
          "feed": "SYNTHETIC FINDINGS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-evidence",
        "label": "evidence",
        "box": [
          31,
          0,
          44,
          46
        ],
        "link": null,
        "map": {
          "el": "siteMap",
          "adapter": "domain",
          "feed": "SYNTHETIC EVIDENCE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-frames",
        "label": "frames",
        "box": [
          31,
          47,
          44,
          20
        ],
        "link": null,
        "map": {
          "el": "picture",
          "adapter": "domain",
          "feed": "SYNTHETIC FRAMES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-details",
        "label": "case details",
        "box": [
          76,
          0,
          28,
          16
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC CASE DETAILS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-decision",
        "label": "decision",
        "box": [
          76,
          17,
          28,
          16
        ],
        "link": null,
        "map": {
          "el": "button",
          "adapter": "domain",
          "feed": "SYNTHETIC DECISION DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-history",
        "label": "action history",
        "box": [
          76,
          34,
          28,
          18
        ],
        "link": null,
        "map": {
          "el": "textline",
          "adapter": "domain",
          "feed": "SYNTHETIC ACTION HISTORY DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-trail",
        "label": "evidence trail",
        "box": [
          76,
          53,
          28,
          14
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC EVIDENCE TRAIL DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "cases-ops",
        "label": "disposition, parts, sign-off",
        "box": [
          0,
          68,
          104,
          8
        ],
        "link": null,
        "map": {
          "el": "alert",
          "adapter": "domain",
          "feed": "SYNTHETIC DISPOSITION, PARTS, SIGN-OFF DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "calendar",
    "label": "Calendar",
    "panels": [
      {
        "id": "calendar-scope",
        "label": "scope",
        "box": [
          0,
          0,
          73,
          4
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "none",
          "feed": "SYNTHETIC SCOPE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "calendar-grid",
        "label": "the grid",
        "box": [
          0,
          5,
          73,
          50
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC THE GRID DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "calendar-upcoming",
        "label": "upcoming",
        "box": [
          0,
          56,
          46,
          30
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC UPCOMING DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "calendar-gates",
        "label": "gates before a flight",
        "box": [
          47,
          56,
          26,
          30
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "domain",
          "feed": "SYNTHETIC GATES BEFORE A FLIGHT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-b13f49a1-f694-4e8b-a3e3-4f210f63a339",
        "label": "event details",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC EVENT DETAILS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "analyze",
    "label": "Analyze",
    "panels": [
      {
        "id": "analyze-scope",
        "label": "scope",
        "box": [
          0,
          0,
          69,
          4
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "none",
          "feed": "SYNTHETIC SCOPE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "analyze-coverage",
        "label": "coverage over scans",
        "box": [
          0,
          5,
          34,
          22
        ],
        "link": null,
        "map": {
          "el": "saas-viz:line",
          "adapter": "domain",
          "feed": "SYNTHETIC COVERAGE OVER SCANS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "analyze-findings",
        "label": "findings over scans",
        "box": [
          35,
          5,
          34,
          22
        ],
        "link": null,
        "map": {
          "el": "saas-viz:bar",
          "adapter": "domain",
          "feed": "SYNTHETIC FINDINGS OVER SCANS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "analyze-esf",
        "label": "expected, simulated, flown",
        "box": [
          0,
          28,
          34,
          22
        ],
        "link": null,
        "map": {
          "el": "saas-viz:bullet",
          "adapter": "domain",
          "feed": "SYNTHETIC EXPECTED, SIMULATED, FLOWN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "analyze-runs",
        "label": "runs",
        "box": [
          35,
          28,
          34,
          22
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC RUNS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "analyze-models",
        "label": "models",
        "box": [
          0,
          51,
          34,
          20
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC MODELS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "analyze-pipeline",
        "label": "pipeline timing",
        "box": [
          35,
          51,
          34,
          20
        ],
        "link": null,
        "map": {
          "el": "saas-viz:bullet",
          "adapter": "domain",
          "feed": "SYNTHETIC PIPELINE TIMING DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "rect-79eac940-2aa2-4e37-8208-6c3beccd895e",
        "label": "analysis details",
        "kept": true,
        "box": null,
        "link": null,
        "map": {
          "el": "saas-viz:line",
          "adapter": "domain",
          "feed": "SYNTHETIC ANALYSIS DETAILS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "bench",
    "label": "Bench",
    "hidden": true,
    "panels": [
      {
        "id": "bench-weight",
        "label": "weight and balance",
        "box": [
          0,
          0,
          50,
          30
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC WEIGHT AND BALANCE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "bench-checklist",
        "label": "props-off checklist",
        "box": [
          51,
          0,
          53,
          30
        ],
        "link": null,
        "map": {
          "el": "steps",
          "adapter": "domain",
          "feed": "SYNTHETIC PROPS-OFF CHECKLIST DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "bench-aircraft",
        "label": "the aircraft",
        "box": [
          0,
          31,
          50,
          20
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "telemetry",
          "feed": "SYNTHETIC THE AIRCRAFT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "bench-back",
        "label": "back to home",
        "box": [
          0,
          52,
          16,
          4
        ],
        "link": "home",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC BACK TO HOME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "files",
    "label": "Files",
    "hidden": true,
    "panels": [
      {
        "id": "files-sites",
        "label": "sites",
        "box": [
          0,
          0,
          34,
          30
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC SITES DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "files-flights",
        "label": "flights",
        "box": [
          35,
          0,
          34,
          30
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC FLIGHTS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "files-recordings",
        "label": "recordings",
        "box": [
          70,
          0,
          34,
          30
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC RECORDINGS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "files-results",
        "label": "results",
        "box": [
          0,
          31,
          104,
          20
        ],
        "link": null,
        "map": {
          "el": "tableRow",
          "adapter": "domain",
          "feed": "SYNTHETIC RESULTS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "files-back",
        "label": "back to home",
        "box": [
          0,
          52,
          16,
          4
        ],
        "link": "home",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC BACK TO HOME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "pipeline",
    "label": "Pipeline editor",
    "hidden": true,
    "panels": [
      {
        "id": "pipeline-graph",
        "label": "pipeline",
        "box": [
          0,
          0,
          104,
          40
        ],
        "link": null,
        "map": {
          "el": "diagram:pipeline",
          "adapter": "domain",
          "feed": "SYNTHETIC PIPELINE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "pipeline-picked",
        "label": "the picked stage",
        "box": [
          0,
          41,
          52,
          20
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC THE PICKED STAGE DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "pipeline-jobs",
        "label": "jobs",
        "box": [
          53,
          41,
          51,
          20
        ],
        "link": null,
        "map": {
          "el": "progress",
          "adapter": "domain",
          "feed": "SYNTHETIC JOBS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "pipeline-back",
        "label": "back to review",
        "box": [
          0,
          62,
          18,
          4
        ],
        "link": "site-review",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC BACK TO REVIEW DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "assistant",
    "label": "Assistant",
    "hidden": true,
    "panels": [
      {
        "id": "assistant-conversation",
        "label": "conversation",
        "box": [
          0,
          0,
          70,
          60
        ],
        "link": null,
        "map": {
          "el": "textline",
          "adapter": "domain",
          "feed": "SYNTHETIC CONVERSATION DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assistant-may",
        "label": "what it may do",
        "box": [
          71,
          0,
          33,
          30
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "none",
          "feed": "SYNTHETIC WHAT IT MAY DO DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assistant-may-not",
        "label": "what it may not do",
        "box": [
          71,
          31,
          33,
          29
        ],
        "link": null,
        "map": {
          "el": "alert",
          "adapter": "none",
          "feed": "SYNTHETIC WHAT IT MAY NOT DO DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "assistant-back",
        "label": "back to home",
        "box": [
          0,
          61,
          16,
          4
        ],
        "link": "home",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC BACK TO HOME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "simkit",
    "label": "Sim Kit and training",
    "hidden": true,
    "panels": [
      {
        "id": "simkit-scenarios",
        "label": "scenarios",
        "box": [
          0,
          0,
          34,
          40
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC SCENARIOS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "simkit-renders",
        "label": "render jobs",
        "box": [
          35,
          0,
          34,
          40
        ],
        "link": null,
        "map": {
          "el": "progress",
          "adapter": "domain",
          "feed": "SYNTHETIC RENDER JOBS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "simkit-training",
        "label": "training runs",
        "box": [
          70,
          0,
          34,
          40
        ],
        "link": null,
        "map": {
          "el": "row",
          "adapter": "domain",
          "feed": "SYNTHETIC TRAINING RUNS DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "simkit-truth",
        "label": "truth",
        "box": [
          0,
          41,
          104,
          16
        ],
        "link": null,
        "map": {
          "el": "keyvalue",
          "adapter": "domain",
          "feed": "SYNTHETIC TRUTH DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "simkit-back",
        "label": "back to home",
        "box": [
          0,
          58,
          16,
          4
        ],
        "link": "home",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC BACK TO HOME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "settings",
    "label": "Settings",
    "hidden": true,
    "panels": [
      {
        "id": "settings-units",
        "label": "units and time",
        "box": [
          0,
          0,
          50,
          20
        ],
        "link": null,
        "map": {
          "el": "select",
          "adapter": "session",
          "feed": "SYNTHETIC UNITS AND TIME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "settings-data",
        "label": "preview data",
        "box": [
          51,
          0,
          53,
          20
        ],
        "link": null,
        "map": {
          "el": "segmented",
          "adapter": "layout",
          "feed": "SYNTHETIC PREVIEW DATA DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "settings-layout",
        "label": "layout",
        "box": [
          0,
          21,
          50,
          16
        ],
        "link": null,
        "map": {
          "el": "button",
          "adapter": "layout",
          "feed": "SYNTHETIC LAYOUT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "settings-account",
        "label": "account",
        "box": [
          51,
          21,
          53,
          4
        ],
        "link": "sign-in",
        "map": {
          "el": "button",
          "adapter": "session",
          "feed": "SYNTHETIC ACCOUNT DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "settings-back",
        "label": "back to home",
        "box": [
          0,
          38,
          16,
          4
        ],
        "link": "home",
        "map": {
          "el": "button",
          "adapter": "router",
          "feed": "SYNTHETIC BACK TO HOME DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "sign-in",
    "label": "Sign in",
    "hidden": true,
    "panels": [
      {
        "id": "sign-in-form",
        "label": "sign in",
        "box": [
          35,
          20,
          34,
          30
        ],
        "link": null,
        "map": {
          "el": "field",
          "adapter": "session",
          "feed": "SYNTHETIC SIGN IN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "sign-in-go-up",
        "label": "sign up",
        "box": [
          35,
          51,
          16,
          4
        ],
        "link": "sign-up",
        "map": {
          "el": "button",
          "adapter": "session",
          "feed": "SYNTHETIC SIGN UP DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "sign-in-go-reset",
        "label": "reset password",
        "box": [
          53,
          51,
          16,
          4
        ],
        "link": "reset-password",
        "map": {
          "el": "button",
          "adapter": "session",
          "feed": "SYNTHETIC RESET PASSWORD DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "sign-in-about",
        "label": "about sign-in",
        "box": [
          35,
          57,
          34,
          12
        ],
        "link": null,
        "map": {
          "el": "alert",
          "adapter": "none",
          "feed": "SYNTHETIC ABOUT SIGN-IN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "sign-up",
    "label": "Sign up",
    "hidden": true,
    "panels": [
      {
        "id": "sign-up-form",
        "label": "sign up",
        "box": [
          35,
          20,
          34,
          30
        ],
        "link": null,
        "map": {
          "el": "field",
          "adapter": "session",
          "feed": "SYNTHETIC SIGN UP DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "sign-up-back",
        "label": "back to sign in",
        "box": [
          35,
          51,
          18,
          4
        ],
        "link": "sign-in",
        "map": {
          "el": "button",
          "adapter": "session",
          "feed": "SYNTHETIC BACK TO SIGN IN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  },
  {
    "id": "reset-password",
    "label": "Reset password",
    "hidden": true,
    "panels": [
      {
        "id": "reset-password-form",
        "label": "reset password",
        "box": [
          35,
          20,
          34,
          30
        ],
        "link": null,
        "map": {
          "el": "field",
          "adapter": "session",
          "feed": "SYNTHETIC RESET PASSWORD DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      },
      {
        "id": "reset-password-back",
        "label": "back to sign in",
        "box": [
          35,
          51,
          18,
          4
        ],
        "link": "sign-in",
        "map": {
          "el": "button",
          "adapter": "session",
          "feed": "SYNTHETIC BACK TO SIGN IN DATA",
          "by": "phosphor",
          "state": "working",
          "where": "blank.html"
        }
      }
    ]
  }
];

export const LINKED_PAGES = [
  {
    "id": "site-find",
    "label": "Site: find a place"
  },
  {
    "id": "site-preview",
    "label": "Site: preview"
  },
  {
    "id": "site-simulate",
    "label": "Site: simulate / edit"
  },
  {
    "id": "site-run",
    "label": "Site: run"
  },
  {
    "id": "site-review",
    "label": "Site: review"
  },
  {
    "id": "site-compare",
    "label": "Site: compare"
  },
  {
    "id": "system-modules",
    "label": "System: modules"
  },
  {
    "id": "system-chains",
    "label": "System: chains"
  },
  {
    "id": "system-activity",
    "label": "System: activity"
  },
  {
    "id": "system-device",
    "label": "Device"
  },
  {
    "id": "bench",
    "label": "Bench"
  },
  {
    "id": "files",
    "label": "Files"
  },
  {
    "id": "pipeline",
    "label": "Pipeline editor"
  },
  {
    "id": "assistant",
    "label": "Assistant"
  },
  {
    "id": "simkit",
    "label": "Sim Kit and training"
  },
  {
    "id": "settings",
    "label": "Settings"
  },
  {
    "id": "sign-in",
    "label": "Sign in"
  },
  {
    "id": "sign-up",
    "label": "Sign up"
  },
  {
    "id": "reset-password",
    "label": "Reset password"
  }
];

export const FLOW_BOARD_WINDOWS = {
  "signin": "sign-in",
  "shell": "system",
  "devpage": "system-device",
  "search": "site-find",
  "earth": "site",
  "lasso": "site-find",
  "target": "site-find",
  "outline": "site-find",
  "bundles": "files",
  "plansetup": "site-preview",
  "plandrawn": "site-preview",
  "coverage": "site-preview",
  "missions": "site-preview",
  "expected": "site-preview",
  "save": "site-preview",
  "browsersim": "site-simulate",
  "edit": "site-simulate",
  "simrun": "site-simulate",
  "device": "site-run",
  "live": "site-run",
  "record": "site-run",
  "control": "site-run",
  "video": "site-run",
  "recordings": "site-review",
  "viewer": "site-review",
  "jobs": "pipeline",
  "compare": "site-compare",
  "wb": "bench",
  "checklist": "bench",
  "simkit": "simkit",
  "train": "simkit",
  "assistant": "assistant",
  "rancher": "system"
};
