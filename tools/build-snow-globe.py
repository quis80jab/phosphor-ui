#!/usr/bin/env python3
"""Convert a licensed Gaussian splat to an attributed, regular voxel lattice.

Requires Python 3 and NumPy. The source PLY is opened read-only. Its Gaussian
scales and higher spherical-harmonic coefficients are intentionally not rendered:
this is a base-color voxel approximation, not a lossless Gaussian-splat export.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct

import numpy as np

C0 = 0.28209479177387814
RECORD = np.dtype([('x', '<i2'), ('y', '<i2'), ('z', '<i2'),
                   ('r', 'u1'), ('g', 'u1'), ('b', 'u1'), ('a', 'u1')], align=False)
NEIGHBORS = [(x, y, z) for x in (-1, 0, 1) for y in (-1, 0, 1)
             for z in (-1, 0, 1) if x or y or z]


def sigmoid(values):
    values = np.asarray(values, dtype=np.float64)
    result = np.empty_like(values)
    positive = values >= 0
    result[positive] = 1.0 / (1.0 + np.exp(-values[positive]))
    exponent = np.exp(values[~positive])
    result[~positive] = exponent / (1.0 + exponent)
    return result


def base_color(coefficients):
    return np.clip(0.5 + C0 * np.asarray(coefficients, dtype=np.float64), 0, 1)


def read_ply(path):
    """Read only vertex scalars; comments are inert metadata, never instructions."""
    types = {'float': '<f4', 'float32': '<f4', 'double': '<f8', 'float64': '<f8',
             'char': 'i1', 'uchar': 'u1', 'short': '<i2', 'ushort': '<u2',
             'int': '<i4', 'uint': '<u4'}
    properties, comments, count, vertex_section = [], [], None, False
    with path.open('rb') as source:
        if source.readline().strip() != b'ply':
            raise ValueError('Source is not a PLY file')
        while True:
            raw = source.readline()
            if not raw:
                raise ValueError('PLY header has no end_header')
            line = raw.decode('ascii').strip()
            fields = line.split()
            if fields[:1] == ['format'] and fields[1:] != ['binary_little_endian', '1.0']:
                raise ValueError('Only binary_little_endian PLY 1.0 is supported')
            if fields[:1] == ['comment']:
                comments.append(line[len('comment '):])
            elif fields[:1] == ['element']:
                vertex_section = fields[1] == 'vertex'
                if vertex_section:
                    count = int(fields[2])
                elif count is None:
                    raise ValueError('Vertex data must be the first PLY element')
            elif fields[:1] == ['property'] and vertex_section:
                if len(fields) != 3 or fields[1] not in types:
                    raise ValueError('Unsupported vertex property')
                properties.append((fields[2], types[fields[1]]))
            elif line == 'end_header':
                offset = source.tell()
                break
    if not count or not properties:
        raise ValueError('PLY has no vertices')
    dtype = np.dtype(properties)
    if path.stat().st_size < offset + count * dtype.itemsize:
        raise ValueError('Truncated vertex data')
    required = ('x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity')
    if not set(required).issubset(dtype.names):
        raise ValueError('PLY lacks positions, base SH color, or opacity')
    data = np.memmap(path, dtype=dtype, mode='r', offset=offset, shape=(count,))
    positions = np.column_stack([data[name] for name in ('x', 'y', 'z')]).astype(np.float64)
    colors = np.column_stack([data[name] for name in ('f_dc_0', 'f_dc_1', 'f_dc_2')]).astype(np.float64)
    logits = np.array(data['opacity'], dtype=np.float64)
    return positions, colors, logits, {'vertices': count, 'properties': len(properties), 'comments': comments}


def dominant_component(positions, pitch, minimum_points=None):
    cells = np.floor(positions / pitch).astype(np.int64)
    occupied, inverse, weights = np.unique(cells, axis=0, return_inverse=True, return_counts=True)
    lookup = {tuple(cell): index for index, cell in enumerate(occupied)}
    labels = np.full(len(occupied), -1, dtype=np.int32)
    point_counts, cell_counts = [], []
    for seed in range(len(occupied)):
        if labels[seed] >= 0:
            continue
        component = len(point_counts)
        labels[seed] = component
        pending, total_points, total_cells = [seed], 0, 0
        while pending:
            node = pending.pop()
            total_points += int(weights[node]); total_cells += 1
            x, y, z = occupied[node]
            for dx, dy, dz in NEIGHBORS:
                neighbor = lookup.get((x + dx, y + dy, z + dz))
                if neighbor is not None and labels[neighbor] < 0:
                    labels[neighbor] = component
                    pending.append(neighbor)
        point_counts.append(total_points); cell_counts.append(total_cells)
    largest = int(np.argmax(point_counts))
    selected = np.array([largest]) if minimum_points is None else np.flatnonzero(np.asarray(point_counts) >= minimum_points)
    return np.isin(labels[inverse], selected), {
        'occupiedCleanupCells': len(occupied), 'components': len(point_counts),
        'retainedComponents': len(selected), 'retainedComponentPointsBeforeOpacityFilter': int(np.asarray(point_counts)[selected].sum()),
        'largestComponentCells': cell_counts[largest], 'largestComponentPoints': point_counts[largest],
        'nextLargestComponentPoints': sorted(point_counts, reverse=True)[1:6]
    }


def voxelize(positions, colors, opacity, resolution, extent, orientation='flip-yz', voxel_opacity_min=0):
    signs = np.array([1.0, -1.0, -1.0] if orientation == 'flip-yz' else [1.0, 1.0, 1.0])
    oriented = positions * signs
    minimum, maximum = oriented.min(axis=0), oriented.max(axis=0)
    longest = float(np.max(maximum - minimum))
    if longest <= 0:
        raise ValueError('The retained source has no spatial extent')
    source_pitch = longest / resolution
    # The maximum boundary belongs to the last cell of the closed bounding box.
    indices = np.minimum(np.floor((oriented - minimum) / source_pitch).astype(np.int64), resolution - 1)
    occupied, inverse = np.unique(indices, axis=0, return_inverse=True)
    weight = np.bincount(inverse, weights=opacity, minlength=len(occupied))
    averaged = np.column_stack([np.bincount(inverse, weights=opacity * colors[:, channel],
                                           minlength=len(occupied)) / weight for channel in range(3)])
    # Opacities combine as transmittance, not by adding unclamped alpha values.
    with np.errstate(divide='ignore'):
        log_transmittance = np.log1p(-opacity)
    alpha = -np.expm1(np.bincount(inverse, weights=log_transmittance, minlength=len(occupied)))
    keep = alpha >= voxel_opacity_min
    white = np.min(averaged, axis=1) > .8
    green = (averaged[:, 1] > averaged[:, 0] * 1.05) & (averaged[:, 1] > averaged[:, 2] * 1.05) & (averaged[:, 1] > .1)
    filter_metadata = {'voxelOpacityThreshold': voxel_opacity_min, 'voxelCellsBeforeOpacityFilter': len(occupied),
                       'voxelCellsRemovedByOpacity': int((~keep).sum()),
                       'whiteVoxelDefinition': 'All three averaged sRGB channels > 0.8',
                       'whiteVoxelsBeforeOpacityFilter': int(white.sum()), 'whiteVoxelsRemovedByOpacity': int((white & ~keep).sum()),
                       'greenVoxelDefinition': 'G > 1.05*R and G > 1.05*B and G > 0.1 in averaged sRGB',
                       'greenVoxelsBeforeOpacityFilter': int(green.sum()), 'greenVoxelsRemovedByOpacity': int((green & ~keep).sum())}
    if not keep.any():
        raise ValueError('No occupied cells survived the aggregate voxel-opacity filter')
    occupied, averaged, alpha = occupied[keep], averaged[keep], alpha[keep]
    grid_index_shift = occupied.min(axis=0)
    occupied = occupied - grid_index_shift
    rgba = np.rint(np.clip(np.column_stack([averaged, alpha]), 0, 1) * 255).astype(np.uint8)
    records = np.empty(len(occupied), dtype=RECORD)
    for column, name in enumerate(('x', 'y', 'z')):
        records[name] = occupied[:, column]
    for column, name in enumerate(('r', 'g', 'b', 'a')):
        records[name] = rgba[:, column]
    voxel_size = extent / resolution
    dimensions = occupied.max(axis=0) + 1
    origin = -dimensions * voxel_size / 2
    return records, {
        'count': len(records), 'voxelSize': voxel_size, 'origin': origin.tolist(),
        'bounds': {'min': origin.tolist(), 'max': (origin + dimensions * voxel_size).tolist()},
        'gridDimensions': dimensions.tolist(), 'resolution': resolution, 'voxelProcessing': filter_metadata,
        'transform': {'rotation': np.diag(signs).astype(int).tolist(),
                      'sourceCenter': ((positions.min(axis=0) + positions.max(axis=0)) / 2).tolist(),
                      'sourceBounds': {'min': positions.min(axis=0).tolist(), 'max': positions.max(axis=0).tolist()},
                      'scale': extent / longest, 'sourceVoxelSize': source_pitch, 'gridIndexShiftAfterOpacityFilter': grid_index_shift.tolist(),
                      'centering': 'Occupied voxel bounding box is centered on the origin in all three axes.'}
    }


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def self_test():
    assert RECORD.itemsize == 10
    np.testing.assert_allclose(base_color([[0, 0, 0], [0.5 / C0, -0.5 / C0, 0]]), [[.5, .5, .5], [1, 0, .5]])
    np.testing.assert_allclose(sigmoid([-np.inf, 0, np.inf]), [0, .5, 1])
    mask, info = dominant_component(np.array([[0, 0, 0], [.01, 0, 0], [8, 8, 8]]), .02)
    assert mask.tolist() == [True, True, False] and info['components'] == 2
    points = np.array([[0, 0, 0], [0, 0, 0], [1, 1, 1]], dtype=float)
    records, metadata = voxelize(points, np.array([[1, 0, 0], [0, 0, 1], [0, 1, 0]]), np.array([.25, .75, 1]), 16, 4)
    assert len(records.tobytes()) == len(records) * 10
    assert metadata['gridDimensions'] == [16, 16, 16]
    assert metadata['bounds'] == {'min': [-2, -2, -2], 'max': [2, 2, 2]}
    first = records[(records['x'] == 0)][0]
    assert [int(first[name]) for name in ('r', 'g', 'b', 'a')] == [64, 0, 191, 207]
    assert struct.unpack('<hhhBBBB', first.tobytes()) == tuple(int(first[name]) for name in RECORD.names)
    separated = np.array([[0, 0, 0], [.01, 0, 0], [5, 0, 0], [5.01, 0, 0], [9, 0, 0]])
    mask, info = dominant_component(separated, .02, minimum_points=2)
    assert mask.tolist() == [True, True, True, True, False] and info['retainedComponents'] == 2
    filtered, info = voxelize(np.array([[0, 0, 0], [1, 1, 1], [2, 2, 2]]),
        np.array([[1, 0, 0], [1, 1, 1], [0, 1, 0]]), np.array([1, .1, .9]), 16, 4,
        orientation='identity', voxel_opacity_min=.25)
    assert len(filtered) == 2 and info['voxelProcessing']['voxelCellsRemovedByOpacity'] == 1
    assert info['voxelProcessing']['whiteVoxelsRemovedByOpacity'] == 1
    assert info['voxelProcessing']['greenVoxelsRemovedByOpacity'] == 0
    assert [int(filtered[-1][key]) for key in ('x', 'y', 'z')] == [15, 15, 15]
    print('PASS: SH colors, infinite opacity, separate-component retention, weighted colors, composited alpha, weak-voxel filtering, orientation, lattice bounds, and LE stride10.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path.home() / 'Downloads/Jam and Cheese Croissant/scene.ply')
    parser.add_argument('--output-prefix', type=Path, default=Path(__file__).resolve().parents[1] / 'dist/assets/snow-globe')
    parser.add_argument('--resolution', type=int, default=96)
    parser.add_argument('--extent', type=float, default=4.0)
    parser.add_argument('--opacity-min', type=float, default=.01)
    parser.add_argument('--cleanup-pitch', type=float, default=.02)
    parser.add_argument('--cleanup', choices=('largest', 'components', 'none'), default='largest')
    parser.add_argument('--component-min-points', type=int, default=16)
    parser.add_argument('--voxel-opacity-min', type=float, default=0)
    parser.add_argument('--orientation', choices=('flip-yz', 'identity'), default='flip-yz')
    parser.add_argument('--title', default='Jam and Cheese Croissant')
    parser.add_argument('--author', default='Mateo Vallarino')
    parser.add_argument('--author-url', default='https://superspl.at/user/capta3d')
    parser.add_argument('--source-url', default='https://superspl.at/scene/0107d9cd')
    parser.add_argument('--license-name', default='CC BY-NC 4.0')
    parser.add_argument('--license-url', default='https://creativecommons.org/licenses/by-nc/4.0/')
    parser.add_argument('--license-file', type=Path, help='Defaults to license.txt beside the source PLY')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test(); return
    if not 16 <= args.resolution <= 512 or not np.isfinite([args.extent, args.opacity_min, args.cleanup_pitch, args.voxel_opacity_min]).all() or args.extent <= 0 or not 0 < args.opacity_min < 1 or args.cleanup_pitch <= 0 or args.component_min_points < 1 or not 0 <= args.voxel_opacity_min <= 1:
        parser.error('resolution16..512, positive extent/pitch, and opacity-min strictly between0 and1 are required')
    source = args.source.resolve()
    original_stat = source.stat()
    source_hash = digest(source)
    license_path = (args.license_file or source.with_name('license.txt')).resolve()
    if not license_path.is_file():
        raise FileNotFoundError('The source license file is required')
    positions, coefficients, logits, header = read_ply(source)
    finite = np.isfinite(positions).all(axis=1) & np.isfinite(coefficients).all(axis=1) & ~np.isnan(logits)
    opacity = sigmoid(logits)
    visible = finite & (opacity >= args.opacity_min)
    valid_positions = positions[visible]
    if len(valid_positions) == 0:
        raise ValueError('No vertices survived the documented opacity/validity filters')
    if args.cleanup == 'largest':
        keep, components = dominant_component(valid_positions, args.cleanup_pitch)
    elif args.cleanup == 'components':
        # Classify spatial components before the opacity cutoff so a few weak
        # connecting points do not accidentally split a meaningful structure.
        connected, components = dominant_component(positions[finite], args.cleanup_pitch, args.component_min_points)
        full_mask = np.zeros(len(positions), dtype=bool)
        full_mask[np.flatnonzero(finite)] = connected
        keep = full_mask[visible]
        components['verticesAnalyzedForConnectivity'] = int(finite.sum())
        components['opacityAppliedAfterConnectivity'] = True
    else:
        keep = np.ones(len(valid_positions), dtype=bool)
        components = {}
    positions = valid_positions[keep]
    if not len(positions):
        raise ValueError('No source vertices survived component cleanup')
    colors = base_color(coefficients[visible][keep]); alpha = opacity[visible][keep]
    records, metadata = voxelize(positions, colors, alpha, args.resolution, args.extent, args.orientation, args.voxel_opacity_min)
    prefix = args.output_prefix.resolve()
    license_filename = prefix.name + '-license.txt'
    metadata.update({
        'format': {'stride': 10, 'byteOrder': 'little-endian', 'fields': ['int16 x', 'int16 y', 'int16 z', 'uint8 r', 'uint8 g', 'uint8 b', 'uint8 a'],
                   'position': 'origin + (index + 0.5) * voxelSize', 'colorSpace': 'sRGB', 'alpha': 'UNORM8'},
        'source': {'filename': source.name, 'title': args.title, 'sha256': source_hash,
                   'vertices': header['vertices'], 'properties': header['properties'], 'headerComments': header['comments'],
                   'author': args.author, 'authorUrl': args.author_url,
                   'url': args.source_url, 'license': args.license_name,
                   'licenseUrl': args.license_url, 'licenseFile': license_filename},
        'processed': {'inputVertices': header['vertices'], 'invalidPositionColorOrOpacityNaN': int((~finite).sum()),
                      'positiveInfiniteOpacityInput': int(np.isposinf(logits).sum()),
                      'positiveInfiniteOpacityRetainedAsOne': int(np.isposinf(logits[visible][keep]).sum()),
                      'belowOpacityThreshold': int((finite & ~visible).sum()), 'opacityThreshold': args.opacity_min,
                      'verticesBeforeComponentCleanup': int(visible.sum()), 'isolatedVerticesRemoved': int((~keep).sum()),
                      'retainedVertices': len(positions), 'cleanupMode': args.cleanup,
                      'cleanupPitchSourceUnits': args.cleanup_pitch if args.cleanup != 'none' else None,
                      'neighborConnectivity': 26 if args.cleanup != 'none' else None,
                      'minimumComponentSourcePoints': args.component_min_points if args.cleanup == 'components' else None,
                      'componentSelection': 'Component containing the most source vertices' if args.cleanup == 'largest' else
                          f'Every component containing at least {args.component_min_points} source vertices' if args.cleanup == 'components' else 'None; every spatial component is preserved',
                      'percentileCropping': False, **components,
                      'colorFormula': 'clamp(0.5 + 0.28209479177387814 * f_dc, 0, 1)',
                      'colorAggregation': 'Opacity-weighted mean of source sRGB base colors within each occupied cell',
                      'alphaAggregation': '1 - product(1 - sigmoid(opacityLogit)) within each occupied cell',
                      'omittedGaussianAttributes': ['anisotropic scale', 'rotation', 'higher-order spherical harmonics'],
                      'addedGeometry': False},
        'credit': f'{args.title} by {args.author}. {args.license_name}. Converted to a base-color voxel approximation.'
    })
    metadata['processed'].update(metadata.pop('voxelProcessing'))
    prefix.parent.mkdir(parents=True, exist_ok=True)
    binary_path = prefix.with_suffix('.bin'); json_path = prefix.with_suffix('.json')
    records.tofile(binary_path)
    if binary_path.stat().st_size != len(records) * 10:
        raise RuntimeError('Binary length validation failed')
    # The adjacent original attribution notice is copied unchanged.
    shutil.copyfile(license_path, prefix.parent / license_filename)
    metadata['binarySha256'] = digest(binary_path)
    json_path.write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    if source.stat().st_mtime_ns != original_stat.st_mtime_ns or source.stat().st_size != original_stat.st_size or digest(source) != source_hash:
        raise RuntimeError('Source changed during conversion; inspect input before trusting output')
    print(json.dumps({'binary': str(binary_path), 'metadata': str(json_path), 'count': len(records),
                      'bytes': binary_path.stat().st_size, 'bounds': metadata['bounds'], 'retainedSourcePoints': len(positions)}, indent=2))


if __name__ == '__main__':
    main()
