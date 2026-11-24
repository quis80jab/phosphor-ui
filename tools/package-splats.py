#!/usr/bin/env python3
"""Package original Gaussian PLY bytes as one deterministic gzip stream in chunks.

Uses only Python's standard library. No Gaussian decoding, filtering, cropping,
quantization, reordering, or property omission is performed. Original files and
prior voxel assets are opened read-only. Framing metadata controls placement only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import zlib

BUFFER_BYTES = 8 * 1024 * 1024
TYPE_BYTES = {'float': 4, 'float32': 4, 'double': 8, 'float64': 8,
              'char': 1, 'uchar': 1, 'short': 2, 'ushort': 2, 'int': 4, 'uint': 4}


def header_info(source):
    header = bytearray()
    properties = []
    count = None
    vertex = False
    with source.open('rb') as stream:
        while True:
            line = stream.readline()
            if not line or len(header) + len(line) > 1024 * 1024:
                raise ValueError('Missing or oversized PLY header')
            header.extend(line)
            fields = line.decode('ascii').strip().split()
            if fields[:1] == ['element']:
                vertex = fields[1] == 'vertex'
                if vertex:
                    if count is not None:
                        raise ValueError('Duplicate vertex element')
                    count = int(fields[2])
                elif int(fields[2]) != 0:
                    raise ValueError('Only a vertex-only Gaussian PLY is supported')
            elif fields[:1] == ['property'] and vertex:
                if len(fields) != 3 or fields[1] not in TYPE_BYTES:
                    raise ValueError('Only fixed-width scalar vertex properties are supported')
                properties.append({'name': fields[2], 'type': fields[1]})
            if fields == ['end_header']:
                break
    if not header.startswith(b'ply\n') or b'format binary_little_endian 1.0' not in header:
        raise ValueError('Expected an original binary little-endian PLY')
    if not count or not properties:
        raise ValueError('Missing vertex count or properties')
    stride = sum(TYPE_BYTES[prop['type']] for prop in properties)
    expected = len(header) + count * stride
    if expected != source.stat().st_size:
        raise ValueError('Original byte length does not match every declared vertex record')
    names = {prop['name'] for prop in properties}
    required = {'x', 'y', 'z', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'scale_0', 'scale_1', 'scale_2', 'opacity', 'f_dc_0', 'f_dc_1', 'f_dc_2'}
    if not required.issubset(names):
        raise ValueError('Source lacks Gaussian shape, opacity, or base color properties')
    rest = sum(name.startswith('f_rest_') for name in names)
    degree = next((degree for degree in range(5) if 3 * ((degree + 1) ** 2 - 1) == rest), None)
    if degree is None:
        raise ValueError('Unrecognized spherical-harmonic property count')
    return bytes(header), count, properties, stride, degree


class ChunkWriter:
    def __init__(self, directory, maximum):
        self.directory = directory
        self.maximum = maximum
        self.pending = bytearray()
        self.chunks = []
        self.total = 0
        self.digest = hashlib.sha256()
        self.gzip_header = bytearray()

    def append(self, data):
        if len(self.gzip_header) < 10:
            self.gzip_header.extend(data[:10 - len(self.gzip_header)])
        self.total += len(data)
        self.digest.update(data)
        self.pending.extend(data)
        while len(self.pending) >= self.maximum:
            self.write(bytes(self.pending[:self.maximum]))
            del self.pending[:self.maximum]

    def write(self, data):
        filename = f'part-{len(self.chunks):03d}.bin'
        destination = self.directory / filename
        temporary = destination.with_suffix('.tmp')
        temporary.write_bytes(data)
        os.replace(temporary, destination)
        self.chunks.append({'url': self.directory.name + '/' + filename,
                            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})

    def finish(self):
        if self.pending:
            self.write(bytes(self.pending)); self.pending.clear()
        if self.gzip_header[:2] != b'\x1f\x8b' or self.gzip_header[4:8] != b'\0\0\0\0':
            raise ValueError('The gzip stream is not deterministic with mtime=0')


def verify_stream(directory, chunks, expected_bytes, expected_hash):
    decoder = zlib.decompressobj(31)
    output_hash = hashlib.sha256()
    output_bytes = 0
    for chunk in chunks:
        path = directory / Path(chunk['url']).name
        chunk_hash = hashlib.sha256()
        with path.open('rb') as stream:
            while data := stream.read(BUFFER_BYTES):
                chunk_hash.update(data)
                while data:
                    decoded = decoder.decompress(data, BUFFER_BYTES)
                    data = decoder.unconsumed_tail
                    output_hash.update(decoded); output_bytes += len(decoded)
        if path.stat().st_size != chunk['bytes'] or chunk_hash.hexdigest() != chunk['sha256']:
            raise ValueError('Chunk integrity validation failed')
    tail = decoder.flush()
    output_hash.update(tail); output_bytes += len(tail)
    if not decoder.eof or decoder.unused_data:
        raise ValueError('Expected exactly one complete gzip member, not multiple members')
    if output_bytes != expected_bytes or output_hash.hexdigest() != expected_hash:
        raise ValueError('Reconstructed PLY is not byte-for-byte identical to its source')
    return {'verified': True, 'reconstructedBytes': output_bytes,
            'reconstructedSha256': output_hash.hexdigest(), 'gzipMembers': 1,
            'allOriginalPropertyBytesPreserved': True}


def package(source, framing_path, prefix, chunk_bytes, level):
    if not prefix.name.endswith('-splats'):
        raise ValueError('Output prefix must end in -splats to keep previous assets separate')
    if prefix.with_suffix('.json') == framing_path:
        raise ValueError('Output must not overwrite the framing metadata')
    before = source.stat()
    header, count, properties, stride, degree = header_info(source)
    previous = json.loads(framing_path.read_text(encoding='utf-8'))
    attribution = previous['source']
    license_path = framing_path.parent / attribution['licenseFile']
    if not license_path.is_file():
        raise FileNotFoundError('The existing attribution/license file must be retained')
    prefix.mkdir(parents=True, exist_ok=True)
    writer = ChunkWriter(prefix, chunk_bytes)
    source_hash = hashlib.sha256()
    compressor = zlib.compressobj(level, zlib.DEFLATED, 31)
    source_bytes = 0
    with source.open('rb') as stream:
        while data := stream.read(BUFFER_BYTES):
            source_hash.update(data); source_bytes += len(data)
            writer.append(compressor.compress(data))
    writer.append(compressor.flush()); writer.finish()
    digest = source_hash.hexdigest()
    after = source.stat()
    if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
        raise RuntimeError('The original PLY changed during packaging')
    if source_bytes != before.st_size or digest != attribution['sha256']:
        raise ValueError('Source does not match its previously verified original checksum')
    verification = verify_stream(prefix, writer.chunks, source_bytes, digest)
    rotation = previous['transform']['rotation']
    flattened = [value for row in rotation for value in row]
    transform = {'sourceCenter': previous['transform']['sourceCenter'],
                 'scale': previous['transform']['scale'], 'rotation': flattened,
                 'flipYZ': flattened == [1, 0, 0, 0, -1, 0, 0, 0, -1],
                 'purpose': 'View placement only; this transform applies to every original Gaussian.'}
    source_metadata = dict(attribution)
    source_metadata.update({'filename': source.name, 'bytes': source_bytes, 'sha256': digest,
                            'vertices': count, 'properties': len(properties), 'propertyCount': len(properties),
                            'propertyList': properties, 'recordStride': stride, 'headerBytes': len(header),
                            'headerText': header.decode('ascii'), 'shDegree': degree})
    manifest = {
        'version': 1, 'format': 'original-ply-gzip-chunks', 'encoding': 'gzip', 'lossless': True,
        'count': count, 'shDegree': degree, 'source': source_metadata,
        'compressedBytes': writer.total, 'gzipBytes': writer.total,
        'gzipSha256': writer.digest.hexdigest(), 'gzipMtime': 0, 'compressionLevel': level,
        'maximumChunkBytes': chunk_bytes, 'chunks': writer.chunks,
        'transform': transform, 'bounds': previous['bounds'], 'boundsPurpose': 'camera-framing-only',
        'framing': {'cameraOnly': True, 'sourceMetadata': framing_path.name,
                    'bounds': previous['bounds'], 'transform': transform,
                    'note': 'Reuses the prior camera placement only. Bounds are not a data filter or clipping volume.'},
        'processing': {'filtering': False, 'cropping': False, 'voxelization': False,
                       'decimation': False, 'quantization': False, 'reordering': False,
                       'originalRecordsPreserved': count, 'propertiesPerRecord': len(properties),
                       'coordinateTransformInPayload': False},
        'verification': verification,
        'credit': f"{attribution['title']} by {attribution['author']}. {attribution['license']}. Original Gaussian PLY delivered losslessly."
    }
    manifest_path = prefix.with_suffix('.json')
    temporary = manifest_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, manifest_path)
    # Only stale parts owned by this output prefix are removed after verification.
    current = {Path(chunk['url']).name for chunk in writer.chunks}
    for path in prefix.iterdir():
        if re.fullmatch(r'part-\d{3}\.bin', path.name) and path.name not in current:
            path.unlink()
    return {'manifest': str(manifest_path), 'count': count, 'properties': len(properties),
            'sourceBytes': source_bytes, 'gzipBytes': writer.total, 'chunks': len(writer.chunks),
            'maximumChunkBytes': max(chunk['bytes'] for chunk in writer.chunks),
            'sourceSha256': digest, 'gzipSha256': writer.digest.hexdigest(), 'verified': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--framing', type=Path, required=True)
    parser.add_argument('--output-prefix', type=Path, required=True)
    parser.add_argument('--chunk-mib', type=int, default=16)
    parser.add_argument('--level', type=int, choices=range(1, 10), default=6)
    args = parser.parse_args()
    if not 1 <= args.chunk_mib <= 16:
        parser.error('chunk-mib must be1..16 to remain below the static asset limit')
    result = package(args.source.resolve(), args.framing.resolve(), args.output_prefix.resolve(), args.chunk_mib * 1024 * 1024, args.level)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
