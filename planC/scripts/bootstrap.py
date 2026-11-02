"""Install the pinned local tools; never modifies the system Blender install."""
from pathlib import Path
import argparse
import hashlib
import platform
import shutil
import subprocess
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
VERSION = '4.5.3'
ARCHIVE = f'blender-{VERSION}-linux-x64.tar.xz'
CHECKSUM = '975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845'
URL = 'https://download.blender.org/release/Blender4.5/' + ARCHIVE


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--skip-blender', action='store_true')
    args = p.parse_args()
    uv = shutil.which('uv') or str(Path.home() / '.local/bin/uv')
    if not Path(uv).is_file() and not shutil.which(uv):
        raise SystemExit('Install uv first: python3 -m pip install --user uv')
    subprocess.run([uv, 'sync', '--project', str(ROOT), '--frozen', '--extra', 'test'], check=True)
    if args.skip_blender:
        return
    if platform.system() != 'Linux' or platform.machine() != 'x86_64':
        raise SystemExit('Portable installer targets Linux x86_64. Install Blender4.5.3 for your platform and set ARCHVIZ_BLENDER.')
    tools = ROOT / '.tools'
    tools.mkdir(exist_ok=True)
    archive = tools / ARCHIVE
    if not archive.is_file() or hashlib.sha256(archive.read_bytes()).hexdigest() != CHECKSUM:
        tmp = archive.with_suffix('.partial')
        print('Downloading official Blender archive:', URL, flush=True)
        urllib.request.urlretrieve(URL, tmp)
        if hashlib.sha256(tmp.read_bytes()).hexdigest() != CHECKSUM:
            raise SystemExit('Official archive SHA256 mismatch; refusing to extract')
        tmp.replace(archive)
    binary = tools / f'blender-{VERSION}-linux-x64/blender'
    if not binary.is_file():
        with tarfile.open(archive) as packed:
            for member in packed.getmembers():
                if not (tools / member.name).resolve().is_relative_to(tools.resolve()):
                    raise SystemExit('Archive path leaves local tool directory')
            # Official archive has a pinned SHA256 above, including its symlinks.
            packed.extractall(tools)
    subprocess.run([str(binary), '--version'], check=True)
    print('Ready. Documentation: docs/planC/README.md')


if __name__ == '__main__':
    main()
