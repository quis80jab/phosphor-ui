#!/usr/bin/env python3
"""Package code + optional local settings into complete and UI-only handoffs."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--snapshots', type=Path)
args = parser.parse_args()
output = args.output.resolve()
if output == ROOT or ROOT in output.parents:
    raise SystemExit('Write the handoff outside the source repository.')
output.mkdir(parents=True, exist_ok=True)
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
dirty = subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip()
if dirty:
    raise SystemExit('Commit the exact source before packaging the handoff.')
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
files = [(name, ROOT / name) for name in tracked if name and (name.startswith(('dist/', 'tests/', 'tools/', 'handoff/', 'docs/')) or name in ('README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'package.json', '.gitignore'))]
if args.snapshots:
    for path in sorted(args.snapshots.resolve().glob('*.json')):
        snapshot = json.loads(path.read_text())
        if snapshot.get('format') != 'phosphor-project-backup' or snapshot.get('version') not in (1,2,3):
            raise SystemExit(f'Not a project settings snapshot: {path.name}')
        files.append((f'handoff/snapshots/{path.name}', path))
provenance = {'format': 'phosphor-source-handoff', 'version': 1, 'sourceCommit': commit,
              'runtime': 'native-browser-esm', 'entry': 'dist/handoff.html',
              'programEntry': 'dist/phosphor-kit.js', 'settingsEntry': 'dist/project-backup.js',
              'settingsOrigins': [json.loads(p.read_text())['origin'] for n, p in files if n.startswith('handoff/snapshots/')],
              'originalCodeLicense': 'MIT; see the bundled root LICENSE. Third-party components retain their notices.'}
reports = []
for variant in ('complete', 'ui-only'):
    selected = [(n, p) for n, p in files if variant == 'complete' or not n.startswith('dist/assets/') or n.endswith(('-license.txt', '-splats.json'))]
    details = {**provenance, 'variant': variant, 'includesSplatPayloads': variant == 'complete',
               'limitations': ['OSM tiles load online and are not an offline map archive.',
                               'Settings do not contain live flight pose, active joystick input, selection gestures, or GPU caches.']}
    checksums = []
    archive = output / f'phosphor-{variant}.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=3) as bundle:
        for name, path in sorted(selected):
            content = path.read_bytes()
            checksums.append(f'{hashlib.sha256(content).hexdigest()}  {name}')
            bundle.writestr(f'phosphor-ui/{name}', content)
        content = (json.dumps(details, indent=2) + '\n').encode()
        checksums.append(f'{hashlib.sha256(content).hexdigest()}  SOURCE.json')
        bundle.writestr('phosphor-ui/SOURCE.json', content)
        bundle.writestr('phosphor-ui/FILES.sha256', '\n'.join(checksums) + '\n')
    # Read every archived file back and compare against the recorded digest.
    with zipfile.ZipFile(archive) as bundle:
        for line in checksums:
            digest, name = line.split('  ', 1)
            if hashlib.sha256(bundle.read(f'phosphor-ui/{name}')).hexdigest() != digest:
                raise SystemExit(f'Archive verification failed: {name}')
    report = {'path': str(archive), 'bytes': archive.stat().st_size, 'files': len(checksums),
              'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'sourceCommit': commit}
    reports.append(report)
(output / 'PACKAGE.json').write_text(json.dumps(reports, indent=2) + '\n')
print(json.dumps(reports, indent=2))
