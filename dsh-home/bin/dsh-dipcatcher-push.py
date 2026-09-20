#!/usr/bin/env python3
import os
import subprocess
import sys
import tempfile

SRC = os.path.expanduser("~/.dsh/ssh-workspaces/me@100.116.120.51/D_dipcatcher")
if not os.path.isdir(os.path.join(SRC, "src")):
    print("local tree not populated yet", file=sys.stderr)
    sys.exit(2)
batch = """
lcd {src}
put -r src /D:/dipcatcher/src
put -r tests /D:/dipcatcher/tests
put -r configs /D:/dipcatcher/configs
put -r scripts /D:/dipcatcher/scripts
-put README.md /D:/dipcatcher/README.md
-put pyproject.toml /D:/dipcatcher/pyproject.toml
-put Makefile /D:/dipcatcher/Makefile
bye
""".format(src=SRC)
with tempfile.NamedTemporaryFile("w", delete=False, suffix=".sftp") as fh:
    fh.write(batch)
    path = fh.name
try:
    result = subprocess.run(
        ["sftp", "-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "-b", path, "ah-remote"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write((result.stderr or result.stdout or "")[:800] + "\n")
        sys.exit(result.returncode)
    print("pushed workspace to D:\\dipcatcher")
finally:
    os.unlink(path)
